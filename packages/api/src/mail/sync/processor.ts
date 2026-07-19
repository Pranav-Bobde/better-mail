import { Context, Effect, Layer } from "effect";
import type { EvlogError } from "evlog";

import type { GmailThread } from "../gmail-schemas";
import type { MailRealtimeNotifier } from "../realtime/contracts";
import { mailErrors } from "../errors";
import { mailSyncEventSchema, type MailSyncEvent } from "./contracts";
import { MailSyncRepository as MailSyncRepositoryService } from "./prisma-mail-sync-repository";

export const SYNC_LEASE_SECONDS = 300;
export const SYNC_LOCK_TTL_MS = SYNC_LEASE_SECONDS * 1000;
const gmailThreadSyncConcurrency = 5;

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
    readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
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
  readonly markGmailThreadDeleted: (input: {
    readonly mailAccountId: string;
    readonly threadId: string;
  }) => Promise<void>;
  readonly markMailAccountNeedsResync: (mailAccountId: string) => Promise<void>;
  readonly releaseSyncLock: (input: {
    readonly lockOwnerId: string;
    readonly syncCursorId: string;
  }) => Promise<void>;
  readonly updateSyncCursor: (input: {
    readonly cursorValue: string;
    readonly syncCursorId: string;
  }) => Promise<void>;
  readonly updateGmailWatch: (input: {
    readonly mailAccountId: string;
    readonly watchExpiresAt: Date;
  }) => Promise<void>;
};

export type GmailSyncProvider = {
  readonly getThread: (accessToken: string, threadId: string) => Promise<GmailThread | null>;
  readonly listLabels: (
    accessToken: string,
  ) => Promise<readonly { readonly id: string; readonly name: string; readonly type: string }[]>;
  readonly listHistory: (
    accessToken: string,
    startHistoryId: string,
  ) => Promise<{
    readonly history?: readonly GmailHistoryRecord[];
    readonly historyId?: string;
    readonly nextPageToken?: string;
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
  readonly log?: {
    readonly info: (fields: {
      readonly mailSync: {
        readonly errorCode: string;
        readonly eventType: MailSyncEvent["type"];
        readonly mailAccountId: string;
      };
      readonly module: "mail";
      readonly operation: "mail.sync.history.expired";
      readonly outcome: "resync_needed";
    }) => void;
  };
  readonly now: Date;
  readonly realtimeNotifier: MailRealtimeNotifier;
  readonly repository: MailSyncRepository;
  readonly tokenProvider: MailSyncTokenProvider;
};

export type MailSyncProcessorRequestDependencies = Omit<
  MailSyncProcessorDependencies,
  "repository"
>;

export type MailSyncProcessorResult = Awaited<ReturnType<typeof processMailSyncEvent>>;

type MailSyncProcessorRequests = {
  readonly processMailSyncEvent: (
    rawEvent: MailSyncEvent,
    dependencies: MailSyncProcessorRequestDependencies,
  ) => Effect.Effect<
    Awaited<ReturnType<typeof processMailSyncEvent>>,
    EvlogError | MailSyncLockBusyError
  >;
};

/**
 * Effect v4 service wrapping the promise-based mail sync processor below. It
 * sources its `MailSyncRepository` collaborator from the runtime and adapts it
 * back to the promise-based repository shape the processor expects, leaving the
 * sync/lock logic — and its by-design `MailSyncLockBusyError` lock-busy retry
 * semantics — untouched. Per-request collaborators (gmail provider, realtime
 * notifier, token provider, clock, lock owner, logger) stay call arguments.
 */
export class MailSyncProcessor extends Context.Service<
  MailSyncProcessor,
  MailSyncProcessorRequests
>()("mail/MailSyncProcessor") {
  static readonly layer = Layer.effect(
    MailSyncProcessor,
    Effect.gen(function* () {
      const repository = createEffectMailSyncRepository(yield* MailSyncRepositoryService);

      return MailSyncProcessor.of({
        processMailSyncEvent: (rawEvent, dependencies) =>
          wrapMailSyncProcessorRequest(() =>
            processMailSyncEvent(rawEvent, { ...dependencies, repository }),
          ),
      });
    }),
  );
}

function wrapMailSyncProcessorRequest<A>(
  request: () => Promise<A>,
): Effect.Effect<A, EvlogError | MailSyncLockBusyError> {
  // The lock-busy retry is by design: MailSyncLockBusyError travels the error
  // channel unchanged so the queue worker can still branch on it (Phase 3).
  return Effect.tryPromise({
    catch: (error) => error as EvlogError | MailSyncLockBusyError,
    try: request,
  });
}

function createEffectMailSyncRepository(
  repository: Context.Service.Shape<typeof MailSyncRepositoryService>,
): MailSyncRepository {
  return {
    acquireSyncLock: (input) => Effect.runPromise(repository.acquireSyncLock(input)),
    applyGmailThread: (input) => Effect.runPromise(repository.applyGmailThread(input)),
    getActiveMailAccountWithCursor: (mailAccountId) =>
      Effect.runPromise(repository.getActiveMailAccountWithCursor(mailAccountId)),
    markGmailThreadDeleted: (input) => Effect.runPromise(repository.markGmailThreadDeleted(input)),
    markMailAccountNeedsResync: (mailAccountId) =>
      Effect.runPromise(repository.markMailAccountNeedsResync(mailAccountId)),
    releaseSyncLock: (input) => Effect.runPromise(repository.releaseSyncLock(input)),
    updateSyncCursor: (input) => Effect.runPromise(repository.updateSyncCursor(input)),
    updateGmailWatch: (input) => Effect.runPromise(repository.updateGmailWatch(input)),
  };
}

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
      return processGmailIncrementalSync(event, dependencies);
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
    lockedUntil: new Date(dependencies.now.getTime() + SYNC_LOCK_TTL_MS),
    lockOwnerId: dependencies.lockOwnerId,
    syncCursorId: mailAccount.syncCursor.id,
  });

  if (!lock.acquired) {
    throw new MailSyncLockBusyError(mailAccount.syncCursor.id);
  }

  try {
    return await syncGmailHistory(mailAccount, dependencies);
  } catch (error) {
    if (getErrorCode(error) !== mailErrors.GMAIL_HISTORY_EXPIRED.code) {
      throw error;
    }

    await dependencies.repository.markMailAccountNeedsResync(mailAccount.id);
    dependencies.log?.info({
      mailSync: {
        errorCode: mailErrors.GMAIL_HISTORY_EXPIRED.code,
        eventType: event.type,
        mailAccountId: mailAccount.id,
      },
      module: "mail",
      operation: "mail.sync.history.expired",
      outcome: "resync_needed",
    });
    return;
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
  const history = historyResponse.history ?? [];
  const changedThreadIds = getChangedThreadIds(history);
  const labelCatalog =
    changedThreadIds.length > 0
      ? createLabelCatalog(await dependencies.gmailProvider.listLabels(token.accessToken))
      : undefined;

  await applyChangedGmailThreads({
    accessToken: token.accessToken,
    changedThreadIds,
    dependencies,
    labelCatalog,
    mailAccountId: mailAccount.id,
  });

  const checkpoint = getGmailHistoryCheckpoint(historyResponse, history);
  await saveGmailHistoryCheckpoint({
    changedThreadCount: changedThreadIds.length,
    checkpoint,
    dependencies,
    mailAccount,
  });

  return createGmailSyncContinuation(mailAccount.id, checkpoint, historyResponse.nextPageToken);
}

async function saveGmailHistoryCheckpoint(input: {
  readonly changedThreadCount: number;
  readonly checkpoint: string | undefined;
  readonly dependencies: MailSyncProcessorDependencies;
  readonly mailAccount: NonNullable<
    Awaited<ReturnType<MailSyncRepository["getActiveMailAccountWithCursor"]>>
  >;
}) {
  if (!input.checkpoint) {
    return;
  }

  await input.dependencies.repository.updateSyncCursor({
    cursorValue: input.checkpoint,
    syncCursorId: input.mailAccount.syncCursor.id,
  });

  if (input.changedThreadCount === 0) {
    return;
  }

  await input.dependencies.realtimeNotifier.publishMailboxChanged({
    mailAccountId: input.mailAccount.id,
    mailboxVersion: input.checkpoint,
    type: "mailboxChanged",
    userId: input.mailAccount.userId,
  });
}

function getGmailHistoryCheckpoint(
  response: Awaited<ReturnType<GmailSyncProvider["listHistory"]>>,
  history: readonly GmailHistoryRecord[],
) {
  if (!response.nextPageToken) {
    return response.historyId;
  }

  return history.findLast((record) => record.id)?.id;
}

function createGmailSyncContinuation(
  mailAccountId: string,
  checkpoint: string | undefined,
  nextPageToken: string | undefined,
) {
  if (!checkpoint || !nextPageToken) {
    return undefined;
  }

  return {
    continuationEvent: {
      mailAccountId,
      notificationHistoryId: checkpoint,
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED" as const,
    },
  };
}

async function applyChangedGmailThreads(input: {
  readonly accessToken: string;
  readonly changedThreadIds: readonly string[];
  readonly dependencies: MailSyncProcessorDependencies;
  readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
  readonly mailAccountId: string;
}) {
  for (let index = 0; index < input.changedThreadIds.length; index += gmailThreadSyncConcurrency) {
    const threadIds = input.changedThreadIds.slice(index, index + gmailThreadSyncConcurrency);
    const threads = await Promise.all(
      threadIds.map(async (threadId) => ({
        thread: await input.dependencies.gmailProvider.getThread(input.accessToken, threadId),
        threadId,
      })),
    );

    for (const thread of threads) {
      await applyChangedGmailThread(input, thread.threadId, thread.thread);
    }
  }
}

async function applyChangedGmailThread(
  input: {
    readonly accessToken: string;
    readonly dependencies: MailSyncProcessorDependencies;
    readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
    readonly mailAccountId: string;
  },
  threadId: string,
  thread: GmailThread | null,
) {
  if (!thread) {
    await input.dependencies.repository.markGmailThreadDeleted({
      mailAccountId: input.mailAccountId,
      threadId,
    });
    return;
  }

  await input.dependencies.repository.applyGmailThread({
    labelCatalog: input.labelCatalog,
    latestMessageId: getLatestGmailThreadMessageId(thread),
    mailAccountId: input.mailAccountId,
    thread,
    threadId: thread.id,
  });
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

function createLabelCatalog(
  labels: readonly { readonly id: string; readonly name: string; readonly type: string }[],
) {
  return new Map(labels.map((label) => [label.id, { name: label.name, type: label.type }]));
}

function getLatestGmailThreadMessageId(thread: GmailThread) {
  return thread.messages[thread.messages.length - 1]?.id ?? thread.messages[0].id;
}

function getErrorCode(error: unknown) {
  const code = (Object(error) as { readonly code?: unknown }).code;

  return typeof code === "string" ? code : undefined;
}
