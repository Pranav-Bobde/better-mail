import { EvlogError } from "evlog";

import type { AuthContext } from "../context";
import type { MailboxData, MailMessage } from "./contracts";
import { mailErrors } from "./errors";
import {
  getGmailLabel,
  getGmailProfile,
  getGmailThread,
  listGmailLabels,
  listGmailThreads,
  sendGmailMessage,
} from "./gmail-client";
import {
  getGmailHeaderValue,
  getGmailMessageDateIso,
  getGmailMessageDisplayHtml,
  getGmailMessageDisplayText,
  getGmailMessageSubject,
  parseGmailEmailAddress,
} from "./gmail-message-utils";
import type { GmailLabel, GmailMessage, GmailThread } from "./gmail-schemas";
import { getDisplayLabels } from "./label-presentation";

const mailboxMaxResults = 20;
const gmailUserId = "me";
const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";
const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";

type MailboxErrorOperation = "getMailbox" | "getThread" | "send";

const mailboxErrorByOperation = {
  getMailbox: (cause: Error) =>
    mailErrors.GMAIL_LIST_THREADS_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  getThread: (cause: Error) =>
    mailErrors.GMAIL_GET_THREAD_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  send: (cause: Error) =>
    mailErrors.GMAIL_SEND_MESSAGE_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
} satisfies Record<MailboxErrorOperation, (cause: Error) => EvlogError>;

export async function getMailboxData(
  input: {
    readonly query: string;
    readonly view: "all" | "unread";
  },
  authContext: AuthContext,
) {
  const credentials = await getGmailCredentials(authContext, [gmailReadonlyScope]);
  // Best-effort counts never reject, so the fetch can safely overlap the cache read.
  const countsPromise = getMailboxCountsBestEffort(
    credentials.accessToken,
    gmailUserId,
    authContext,
  );
  const cachedMailboxData = await getCachedMailboxData(input, authContext);

  if (cachedMailboxData) {
    await enqueueMailboxSyncIfAvailable(authContext, {
      mailAccountId: cachedMailboxData.mailAccountId,
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    });

    return {
      data: {
        ...cachedMailboxData.data,
        counts: await countsPromise,
      },
      status: "ok" as const,
    };
  }

  const mailboxBaseData = await getMailboxBaseData(
    input,
    credentials.accessToken,
    await countsPromise,
  );
  const threadDetails = await getMailboxThreadDetails(
    credentials.accessToken,
    gmailUserId,
    mailboxBaseData.listResponse.threads ?? [],
  );
  await cacheMailboxDataIfAvailable(authContext, mailboxBaseData, threadDetails);

  return createMailboxSuccessData(mailboxBaseData, threadDetails);
}

async function getCachedMailboxData(
  input: {
    readonly query: string;
    readonly view: "all" | "unread";
  },
  authContext: AuthContext,
) {
  if (!authContext.session || !authContext.mailSyncRepository) {
    return null;
  }

  await authContext.mailSyncRepository.markGmailMailboxActivity(authContext.session.user.id);

  const cachedMailbox = await authContext.mailSyncRepository.getCachedMailboxData({
    query: input.query,
    userId: authContext.session.user.id,
    view: input.view,
  });

  if (!cachedMailbox) {
    return null;
  }

  return {
    data: cachedMailbox.data,
    mailAccountId: cachedMailbox.mailAccountId,
  };
}

async function getMailboxBaseData(
  input: { readonly query: string; readonly view: "all" | "unread" },
  accessToken: string,
  counts: MailboxData["counts"],
) {
  const [profile, gmailLabels, listResponse] = await Promise.all([
    getGmailProfile(accessToken, gmailUserId),
    listGmailLabels(accessToken, gmailUserId),
    listGmailThreads({
      accessToken,
      labelIds: getListLabelIds(input.view),
      maxResults: mailboxMaxResults,
      query: getMailboxQuery(input),
      userId: gmailUserId,
    }),
  ]);

  return {
    counts,
    gmailLabels,
    listResponse,
    profile,
  };
}

async function getMailboxThreadDetails(
  accessToken: string,
  userId: string,
  threads: readonly { readonly id: string }[],
) {
  return Promise.all(threads.map((thread) => getGmailThread(accessToken, userId, thread.id)));
}

function createMailboxSuccessData(
  mailboxBaseData: Awaited<ReturnType<typeof getMailboxBaseData>>,
  threadDetails: readonly GmailThread[],
) {
  const labelById = new Map(mailboxBaseData.gmailLabels.map((label) => [label.id, label]));

  return {
    data: {
      account: {
        email: mailboxBaseData.profile.emailAddress,
        label: getMailboxLabel(mailboxBaseData.profile.emailAddress),
      },
      counts: mailboxBaseData.counts,
      messages: threadDetails.map((thread) => toMailboxThreadRow(thread, labelById)),
      source: "gmail" as const,
    } satisfies MailboxData,
    status: "ok" as const,
  };
}

async function cacheMailboxDataIfAvailable(
  authContext: AuthContext,
  mailboxBaseData: Awaited<ReturnType<typeof getMailboxBaseData>>,
  threadDetails: readonly GmailThread[],
) {
  const syncCacheContext = getSyncCacheContext(authContext, mailboxBaseData.profile.historyId);
  if (!syncCacheContext) {
    return;
  }

  const mailAccount = await syncCacheContext.repository.upsertGmailMailAccount({
    email: mailboxBaseData.profile.emailAddress,
    historyId: syncCacheContext.historyId,
    userId: syncCacheContext.userId,
  });

  if (!mailAccount) {
    return;
  }

  const labelCatalog = createLabelCatalog(mailboxBaseData.gmailLabels);

  await Promise.all(
    threadDetails.map((thread) =>
      syncCacheContext.repository.applyGmailThread({
        labelCatalog,
        latestMessageId: getLatestThreadMessage(thread.messages).id,
        mailAccountId: mailAccount.id,
        thread,
        threadId: thread.id,
      }),
    ),
  );

  await enqueueMailboxSyncIfAvailable(authContext, {
    mailAccountId: mailAccount.id,
    type: "GMAIL_RENEW_WATCH_REQUESTED",
  });
}

function getSyncCacheContext(authContext: AuthContext, historyId: string | undefined) {
  if (!authContext.session) {
    return null;
  }

  if (!authContext.mailSyncRepository) {
    return null;
  }

  if (!historyId) {
    return null;
  }

  return {
    historyId,
    repository: authContext.mailSyncRepository,
    userId: authContext.session.user.id,
  };
}

async function enqueueMailboxSyncIfAvailable(
  authContext: AuthContext,
  event: {
    readonly mailAccountId: string;
    readonly type: "GMAIL_INCREMENTAL_SYNC_REQUESTED" | "GMAIL_RENEW_WATCH_REQUESTED";
  },
) {
  try {
    await authContext.mailSyncBroker?.enqueueMailSyncEvent(event);
  } catch (error) {
    // Fire-and-forget nudge: a failed enqueue must never fail the mailbox load,
    // but it is a real queue failure, not a Gmail error — log it as itself.
    authContext.log?.set({
      mailSyncEnqueue: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : "UnknownError",
        eventType: event.type,
        mailAccountId: event.mailAccountId,
        outcome: "failed",
      },
    });
    return;
  }
}

export async function sendMailboxMessage(
  input: {
    readonly body: string;
    readonly inReplyTo?: string;
    readonly subject: string;
    readonly threadId?: string;
    readonly to: string;
  },
  authContext: AuthContext,
) {
  const credentials = await getGmailCredentials(authContext, [gmailSendScope]);
  const sentMessage = await sendGmailMessage({
    accessToken: credentials.accessToken,
    raw: createRawMimeMessage(input),
    threadId: input.threadId,
    userId: gmailUserId,
  });

  return {
    data: {
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    },
    status: "ok" as const,
  };
}

export async function getThreadData(
  input: { readonly threadId: string },
  authContext: AuthContext,
) {
  const credentials = await getGmailCredentials(authContext, [gmailReadonlyScope]);
  const [gmailLabels, thread] = await Promise.all([
    listGmailLabels(credentials.accessToken, gmailUserId),
    getGmailThread(credentials.accessToken, gmailUserId, input.threadId),
  ]);
  const labelById = new Map(gmailLabels.map((label) => [label.id, label]));

  return {
    data: {
      messages: thread.messages.map((message) => toMailMessage(message, labelById)),
    },
    status: "ok" as const,
  };
}

export function logMailboxError(
  log: { readonly error: (error: EvlogError) => void } | undefined,
  error: unknown,
  operation: MailboxErrorOperation,
) {
  const evlogError = getMailboxEvlogError(error, operation);

  log?.error(evlogError);

  return evlogError;
}

async function getGmailCredentials(authContext: AuthContext, requiredScopes: readonly string[]) {
  if (!authContext.session) {
    throw mailErrors.AUTH_REQUIRED({
      cause: new Error("Missing Better Auth session"),
    });
  }

  if (!authContext.getGoogleAccessToken) {
    throw mailErrors.GMAIL_ACCOUNT_NOT_CONNECTED({
      cause: new Error("Missing Google access token provider"),
      internal: {
        userId: authContext.session.user.id,
      },
    });
  }

  const token = await getGoogleAccessToken(authContext);
  const missingScope = requiredScopes.find((scope) => !token.scopes.includes(scope));

  if (missingScope) {
    throw mailErrors.GMAIL_SCOPE_MISSING({
      cause: new Error(`Missing required Gmail scope: ${missingScope}`),
      internal: {
        scope: missingScope,
        userId: authContext.session.user.id,
      },
    });
  }

  return {
    accessToken: token.accessToken,
  };
}

async function getGoogleAccessToken(authContext: AuthContext) {
  try {
    return await requireGoogleAccessToken(authContext);
  } catch (error) {
    throw mailErrors.GMAIL_ACCESS_TOKEN_REQUEST_FAILED({
      cause: getErrorCause(error),
      internal: {
        userId: authContext.session?.user.id,
      },
    });
  }
}

async function requireGoogleAccessToken(authContext: AuthContext) {
  const token = await authContext.getGoogleAccessToken?.();

  if (!token?.accessToken) {
    throw new Error("Google access token was empty");
  }

  return token;
}

async function getMailboxCountsBestEffort(
  accessToken: string,
  userId: string,
  authContext: AuthContext,
) {
  try {
    return await getMailboxCounts(accessToken, userId);
  } catch (error) {
    logMailboxError(authContext.log, error, "getMailbox");
    return {
      drafts: 0,
      inboxUnread: 0,
    };
  }
}

async function getMailboxCounts(accessToken: string, userId: string) {
  const [inboxLabel, draftLabel] = await Promise.all([
    getGmailLabel(accessToken, userId, "INBOX"),
    getGmailLabel(accessToken, userId, "DRAFT"),
  ]);

  return {
    drafts: draftLabel.messagesTotal ?? 0,
    inboxUnread: inboxLabel.messagesUnread ?? 0,
  };
}

export function toMailMessage(message: GmailMessage, labelById: ReadonlyMap<string, GmailLabel>) {
  const headers = message.payload?.headers ?? [];
  const from = parseGmailEmailAddress(getGmailHeaderValue(headers, "From"));
  const labelIds = message.labelIds ?? [];

  return {
    date: getGmailMessageDateIso(message),
    email: from.email,
    html: getGmailMessageDisplayHtml(message),
    id: message.id,
    labels: getLabelDisplayLabels(labelIds, labelById),
    name: from.name,
    read: !labelIds.includes("UNREAD"),
    snippet: message.snippet,
    subject: getGmailMessageSubject(headers),
    text: getGmailMessageDisplayText(message),
    threadId: message.threadId,
  } satisfies MailMessage;
}

function toMailboxThreadRow(thread: GmailThread, labelById: ReadonlyMap<string, GmailLabel>) {
  const latestMessage = getLatestThreadMessage(thread.messages);

  return {
    ...toMailMessage(latestMessage, labelById),
    labels: getThreadDisplayLabels(thread.messages, labelById),
    read: isThreadRead(thread.messages),
  } satisfies MailMessage;
}

function getLatestThreadMessage(messages: GmailThread["messages"]) {
  return messages[messages.length - 1] ?? messages[0];
}

function getThreadDisplayLabels(
  messages: GmailThread["messages"],
  labelById: ReadonlyMap<string, GmailLabel>,
) {
  return getLabelDisplayLabels(
    messages.flatMap((message) => message.labelIds ?? []),
    labelById,
  );
}

function isThreadRead(messages: GmailThread["messages"]) {
  return messages.every((message) => !(message.labelIds ?? []).includes("UNREAD"));
}

function getListLabelIds(view: "all" | "unread") {
  switch (view) {
    case "all":
      return ["INBOX"];
    case "unread":
      return ["INBOX", "UNREAD"];
    default:
      return view satisfies never;
  }
}

function getMailboxQuery(input: { readonly query: string; readonly view: "all" | "unread" }) {
  const parts = [input.query.trim()];

  if (input.view === "unread") {
    parts.push("is:unread");
  }

  return parts.filter((part) => part.length > 0).join(" ") || undefined;
}

function getLabelDisplayLabels(
  labelIds: readonly string[],
  labelById: ReadonlyMap<string, GmailLabel>,
) {
  return getDisplayLabels(labelIds.map((labelId) => toLabelLike(labelId, labelById)));
}

function createRawMimeMessage(input: {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject: string;
  readonly to: string;
}) {
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ];

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  }

  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`).toString("base64url");
}

function getMailboxLabel(email: string) {
  return email.split("@")[0] ?? email;
}

function toLabelLike(labelId: string, labelById: ReadonlyMap<string, GmailLabel>) {
  const label = labelById.get(labelId);

  return {
    id: labelId,
    name: label?.name ?? labelId,
    type: label?.type ?? "system",
  };
}

function createLabelCatalog(labels: readonly GmailLabel[]) {
  return new Map(labels.map((label) => [label.id, { name: label.name, type: label.type }]));
}

function getMailboxEvlogError(error: unknown, operation: MailboxErrorOperation) {
  if (error instanceof EvlogError) {
    return error;
  }

  return mailboxErrorByOperation[operation](getErrorCause(error));
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown mailbox failure");
}
