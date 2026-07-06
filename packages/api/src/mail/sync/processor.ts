import type { GmailThread } from "../gmail-schemas";
import { mailSyncEventSchema, type MailSyncEvent } from "./contracts";

const lockTtlMs = 5 * 60 * 1000;

export class MailSyncLockBusyError extends Error {
  constructor(syncCursorId: string) {
    super(`Mail sync cursor is already locked: ${syncCursorId}`);
    this.name = "MailSyncLockBusyError";
  }
}

export type MailSyncRepository = {
  readonly acquireSyncLock: (input: {
    readonly lockOwnerId: string;
    readonly lockedUntil: Date;
    readonly syncCursorId: string;
  }) => Promise<{ readonly acquired: boolean }>;
  readonly applyGmailThread: (input: {
    readonly latestMessageId: string;
    readonly mailAccountId: string;
    readonly thread: GmailThread;
    readonly threadId: string;
  }) => Promise<void>;
  readonly getActiveMailAccountWithCursor: (mailAccountId: string) => Promise<{
    readonly authAccountId: string | null;
    readonly email: string;
    readonly id: string;
    readonly providerAccountId: string;
    readonly syncCursor: {
      readonly cursorValue: string;
      readonly id: string;
    };
    readonly userId: string;
  } | null>;
  readonly releaseSyncLock: (input: {
    readonly lockOwnerId: string;
    readonly syncCursorId: string;
  }) => Promise<void>;
  readonly updateSyncCursor: (input: {
    readonly cursorValue: string;
    readonly syncCursorId: string;
  }) => Promise<void>;
  readonly updateGmailWatch: (input: {
    readonly cursorValue: string;
    readonly mailAccountId: string;
    readonly watchExpiresAt: Date;
  }) => Promise<void>;
};

export type GmailSyncProvider = {
  readonly getThread: (accessToken: string, threadId: string) => Promise<GmailThread>;
  readonly listHistory: (
    accessToken: string,
    startHistoryId: string,
  ) => Promise<{
    readonly history?: readonly GmailHistoryRecord[];
    readonly historyId?: string;
  }>;
  readonly watchMailbox: (accessToken: string) => Promise<{
    readonly expiration: string;
    readonly historyId: string;
  }>;
};

export type MailSyncTokenProvider = {
  readonly getGoogleAccessToken: (input: {
    readonly providerAccountId: string;
    readonly userId: string;
  }) => Promise<{
    readonly accessToken: string;
    readonly scopes: readonly string[];
  }>;
};

export type MailSyncProcessorDependencies = {
  readonly gmailProvider: GmailSyncProvider;
  readonly lockOwnerId: string;
  readonly now: Date;
  readonly repository: MailSyncRepository;
  readonly tokenProvider: MailSyncTokenProvider;
};

type GmailHistoryRecord = {
  readonly id?: string;
  readonly labelsAdded?: readonly GmailHistoryMessageReference[];
  readonly labelsRemoved?: readonly GmailHistoryMessageReference[];
  readonly messages?: readonly GmailHistoryMessage[];
  readonly messagesAdded?: readonly GmailHistoryMessageReference[];
  readonly messagesDeleted?: readonly GmailHistoryMessageReference[];
};

type GmailHistoryMessageReference = {
  readonly message: GmailHistoryMessage;
};

type GmailHistoryMessage = {
  readonly id: string;
  readonly threadId: string;
};

export async function processMailSyncEvent(
  rawEvent: MailSyncEvent,
  dependencies: MailSyncProcessorDependencies,
) {
  const event = mailSyncEventSchema.parse(rawEvent);

  switch (event.type) {
    case "GMAIL_INCREMENTAL_SYNC_REQUESTED":
      await processGmailIncrementalSync(event, dependencies);
      return;
    case "GMAIL_BOOTSTRAP_SYNC_REQUESTED":
      return;
    case "GMAIL_RENEW_WATCH_REQUESTED":
      await processGmailWatchRenewal(event, dependencies);
      return;
    default:
      return event satisfies never;
  }
}

async function processGmailWatchRenewal(
  event: Extract<MailSyncEvent, { readonly type: "GMAIL_RENEW_WATCH_REQUESTED" }>,
  dependencies: MailSyncProcessorDependencies,
) {
  const mailAccount = await dependencies.repository.getActiveMailAccountWithCursor(
    event.mailAccountId,
  );

  if (!mailAccount) {
    return;
  }

  const token = await dependencies.tokenProvider.getGoogleAccessToken({
    providerAccountId: mailAccount.providerAccountId,
    userId: mailAccount.userId,
  });
  const watchResponse = await dependencies.gmailProvider.watchMailbox(token.accessToken);

  await dependencies.repository.updateGmailWatch({
    cursorValue: watchResponse.historyId,
    mailAccountId: mailAccount.id,
    watchExpiresAt: new Date(Number(watchResponse.expiration)),
  });
}

async function processGmailIncrementalSync(
  event: Extract<MailSyncEvent, { readonly type: "GMAIL_INCREMENTAL_SYNC_REQUESTED" }>,
  dependencies: MailSyncProcessorDependencies,
) {
  const mailAccount = await dependencies.repository.getActiveMailAccountWithCursor(
    event.mailAccountId,
  );

  if (!mailAccount) {
    return;
  }

  const lock = await dependencies.repository.acquireSyncLock({
    lockedUntil: new Date(dependencies.now.getTime() + lockTtlMs),
    lockOwnerId: dependencies.lockOwnerId,
    syncCursorId: mailAccount.syncCursor.id,
  });

  if (!lock.acquired) {
    throw new MailSyncLockBusyError(mailAccount.syncCursor.id);
  }

  try {
    await syncGmailHistory(mailAccount, dependencies);
  } finally {
    await dependencies.repository.releaseSyncLock({
      lockOwnerId: dependencies.lockOwnerId,
      syncCursorId: mailAccount.syncCursor.id,
    });
  }
}

async function syncGmailHistory(
  mailAccount: NonNullable<
    Awaited<ReturnType<MailSyncRepository["getActiveMailAccountWithCursor"]>>
  >,
  dependencies: MailSyncProcessorDependencies,
) {
  const token = await dependencies.tokenProvider.getGoogleAccessToken({
    providerAccountId: mailAccount.providerAccountId,
    userId: mailAccount.userId,
  });
  const historyResponse = await dependencies.gmailProvider.listHistory(
    token.accessToken,
    mailAccount.syncCursor.cursorValue,
  );

  await applyChangedGmailThreads({
    accessToken: token.accessToken,
    changedThreadIds: getChangedThreadIds(historyResponse.history ?? []),
    dependencies,
    mailAccountId: mailAccount.id,
  });

  if (historyResponse.historyId) {
    await dependencies.repository.updateSyncCursor({
      cursorValue: historyResponse.historyId,
      syncCursorId: mailAccount.syncCursor.id,
    });
  }
}

async function applyChangedGmailThreads(input: {
  readonly accessToken: string;
  readonly changedThreadIds: readonly string[];
  readonly dependencies: MailSyncProcessorDependencies;
  readonly mailAccountId: string;
}) {
  for (const threadId of input.changedThreadIds) {
    const thread = await input.dependencies.gmailProvider.getThread(input.accessToken, threadId);
    await input.dependencies.repository.applyGmailThread({
      latestMessageId: getLatestGmailThreadMessageId(thread),
      mailAccountId: input.mailAccountId,
      thread,
      threadId: thread.id,
    });
  }
}

function getChangedThreadIds(history: readonly GmailHistoryRecord[]) {
  const threadIds = new Set<string>();

  for (const item of history) {
    addHistoryRecordThreadIds(threadIds, item);
  }

  return [...threadIds];
}

function addHistoryRecordThreadIds(threadIds: Set<string>, item: GmailHistoryRecord) {
  addHistoryMessageThreadIds(threadIds, toReadonlyArray(item.messages));

  for (const messages of getHistoryMessageReferenceGroups(item)) {
    addHistoryMessageReferenceThreadIds(threadIds, messages);
  }
}

function getHistoryMessageReferenceGroups(item: GmailHistoryRecord) {
  return [
    toReadonlyArray(item.messagesAdded),
    toReadonlyArray(item.messagesDeleted),
    toReadonlyArray(item.labelsAdded),
    toReadonlyArray(item.labelsRemoved),
  ];
}

function addHistoryMessageThreadIds(
  threadIds: Set<string>,
  messages: readonly GmailHistoryMessage[],
) {
  for (const message of messages) {
    threadIds.add(message.threadId);
  }
}

function addHistoryMessageReferenceThreadIds(
  threadIds: Set<string>,
  messages: readonly GmailHistoryMessageReference[],
) {
  for (const message of messages) {
    threadIds.add(message.message.threadId);
  }
}

function toReadonlyArray<T>(value: readonly T[] | undefined) {
  return value ?? [];
}

function getLatestGmailThreadMessageId(thread: GmailThread) {
  return thread.messages[thread.messages.length - 1]?.id ?? thread.messages[0].id;
}
