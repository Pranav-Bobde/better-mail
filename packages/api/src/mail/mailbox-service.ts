import { Context, Effect, Layer } from "effect";
import { EvlogError } from "evlog";

import { isEvlogError, runPromiseRaw, tryPromiseExpecting } from "../effect-interop";
import type { AuthContext, AuthSession } from "../context";
import type { MailboxData, MailFolder, MailMessage } from "./contracts";
import { mailErrors } from "./errors";
import { getGmailFolderListParams } from "./folder-mapping";
import {
  GmailClient,
  createGmailDraft,
  deleteGmailDraft,
  getGmailLabel,
  getGmailProfile,
  getGmailThread,
  listGmailDrafts,
  listGmailLabels,
  listGmailThreads,
  modifyGmailThread,
  sendGmailMessage,
  updateGmailDraft,
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
const gmailModifyScope = "https://www.googleapis.com/auth/gmail.modify";
// gmail.modify is Google's documented superset of read+send+compose (it does
// NOT cover permanent delete), so a modify grant satisfies those two scopes.
const gmailModifyImpliedScopes: readonly string[] = [gmailReadonlyScope, gmailSendScope];
const inboxLabelId = "INBOX";
const unreadLabelId = "UNREAD";
const mimeHeaderEncodedWordPrefix = "=?UTF-8?B?";
const mimeHeaderEncodedWordSuffix = "?=";
const mimeHeaderEncodedWordMaxLength = 75;
const mimeHeaderBase64MaxLength =
  mimeHeaderEncodedWordMaxLength -
  mimeHeaderEncodedWordPrefix.length -
  mimeHeaderEncodedWordSuffix.length;
const mimeHeaderBase64ChunkMaxLength = Math.floor(mimeHeaderBase64MaxLength / 4) * 4;
// Internal retries for the post-Gmail cache mirror write before the request
// gives up and reports mirrorApplied: false (AGENTS.md internal API rules).
const mirrorWriteMaxAttempts = 3;

type MailSyncRepositoryPort = NonNullable<AuthContext["mailSyncRepository"]>;

/**
 * Context for mail mutations that write through to the local cache mirror.
 * The repository and session are REQUIRED at the type level so a missing
 * mirror write can no longer compile as a silent no-op — an optional
 * `mailSyncRepository` is exactly how the stale-cache revert bug shipped.
 */
export type MailMutationAuthContext = Omit<AuthContext, "mailSyncRepository" | "session"> & {
  readonly mailSyncRepository: MailSyncRepositoryPort;
  readonly session: AuthSession;
};

export function requireMailMutationAuthContext(authContext: AuthContext): MailMutationAuthContext {
  if (!authContext.session) {
    throw mailErrors.AUTH_REQUIRED({
      cause: new Error("Missing Better Auth session"),
    });
  }

  if (!authContext.mailSyncRepository) {
    throw mailErrors.MAIL_SYNC_REPOSITORY_MISSING({
      cause: new Error("Authenticated context was built without a mail sync repository"),
      internal: {
        userId: authContext.session.user.id,
      },
    });
  }

  return {
    ...authContext,
    mailSyncRepository: authContext.mailSyncRepository,
    session: authContext.session,
  };
}

type MailboxErrorOperation =
  | "archiveThread"
  | "createDraft"
  | "deleteDraft"
  | "getMailbox"
  | "getThread"
  | "listDrafts"
  | "send"
  | "setThreadRead"
  | "updateDraft";
type MailboxDataInput = {
  readonly folder?: MailFolder;
  readonly query: string;
  readonly view: "all" | "unread";
};
type SendMailboxMessageInput = {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject: string;
  readonly threadId?: string;
  readonly to: string;
};
type SetMailboxThreadReadStateInput = {
  readonly read: boolean;
  readonly threadId: string;
};
type ArchiveMailboxThreadInput = {
  readonly threadId: string;
};
// Drafts may be saved before a recipient or subject exists, unlike send input.
type CreateMailboxDraftInput = {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject?: string;
  readonly threadId?: string;
  readonly to?: string;
};
type UpdateMailboxDraftInput = {
  readonly body: string;
  readonly draftId: string;
  readonly inReplyTo?: string;
  readonly subject?: string;
  readonly threadId?: string;
  readonly to?: string;
};
type DeleteMailboxDraftInput = {
  readonly draftId: string;
};

type MailboxServiceRequests = {
  readonly archiveMailboxThread: (
    input: ArchiveMailboxThreadInput,
    authContext: MailMutationAuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof archiveMailboxThread>>, EvlogError>;
  readonly createMailboxDraft: (
    input: CreateMailboxDraftInput,
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof createMailboxDraft>>, EvlogError>;
  readonly deleteMailboxDraft: (
    input: DeleteMailboxDraftInput,
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof deleteMailboxDraft>>, EvlogError>;
  readonly getMailboxData: (
    input: MailboxDataInput,
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof getMailboxData>>, EvlogError>;
  readonly getThreadData: (
    input: { readonly threadId: string },
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof getThreadData>>, EvlogError>;
  readonly listMailboxDrafts: (
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof listMailboxDrafts>>, EvlogError>;
  readonly sendMailboxMessage: (
    input: SendMailboxMessageInput,
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof sendMailboxMessage>>, EvlogError>;
  readonly setMailboxThreadReadState: (
    input: SetMailboxThreadReadStateInput,
    authContext: MailMutationAuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof setMailboxThreadReadState>>, EvlogError>;
  readonly updateMailboxDraft: (
    input: UpdateMailboxDraftInput,
    authContext: AuthContext,
  ) => Effect.Effect<Awaited<ReturnType<typeof updateMailboxDraft>>, EvlogError>;
};

// Single source of truth: the promise helpers ARE the request contract, so
// both the raw and the GmailClient-backed providers stay pinned to them.
type MailboxGmailRequests = {
  readonly createDraft: typeof createGmailDraft;
  readonly deleteDraft: typeof deleteGmailDraft;
  readonly getLabel: typeof getGmailLabel;
  readonly getProfile: typeof getGmailProfile;
  readonly getThread: typeof getGmailThread;
  readonly listDrafts: typeof listGmailDrafts;
  readonly listLabels: typeof listGmailLabels;
  readonly listThreads: typeof listGmailThreads;
  readonly modifyThread: typeof modifyGmailThread;
  readonly sendMessage: typeof sendGmailMessage;
  readonly updateDraft: typeof updateGmailDraft;
};

export class MailboxService extends Context.Service<MailboxService, MailboxServiceRequests>()(
  "mail/MailboxService",
) {
  static readonly layer = Layer.effect(
    MailboxService,
    Effect.gen(function* () {
      const gmailClient = yield* GmailClient;
      const gmail = createEffectGmailRequests(gmailClient);

      return MailboxService.of({
        archiveMailboxThread: (input, authContext) =>
          wrapMailboxRequest(() => archiveMailboxThreadWithGmail(input, authContext, gmail)),
        createMailboxDraft: (input, authContext) =>
          wrapMailboxRequest(() => createMailboxDraftWithGmail(input, authContext, gmail)),
        deleteMailboxDraft: (input, authContext) =>
          wrapMailboxRequest(() => deleteMailboxDraftWithGmail(input, authContext, gmail)),
        getMailboxData: (input, authContext) =>
          wrapMailboxRequest(() => getMailboxDataWithGmail(input, authContext, gmail)),
        getThreadData: (input, authContext) =>
          wrapMailboxRequest(() => getThreadDataWithGmail(input, authContext, gmail)),
        listMailboxDrafts: (authContext) =>
          wrapMailboxRequest(() => listMailboxDraftsWithGmail(authContext, gmail)),
        sendMailboxMessage: (input, authContext) =>
          wrapMailboxRequest(() => sendMailboxMessageWithGmail(input, authContext, gmail)),
        setMailboxThreadReadState: (input, authContext) =>
          wrapMailboxRequest(() => setMailboxThreadReadStateWithGmail(input, authContext, gmail)),
        updateMailboxDraft: (input, authContext) =>
          wrapMailboxRequest(() => updateMailboxDraftWithGmail(input, authContext, gmail)),
      });
    }),
  );
}

function wrapMailboxRequest<A>(request: () => Promise<A>) {
  return tryPromiseExpecting(request, isEvlogError);
}

function createEffectGmailRequests(gmailClient: Context.Service.Shape<typeof GmailClient>) {
  return {
    createDraft: (input) => runPromiseRaw(gmailClient.createDraft(input)),
    deleteDraft: (input) => runPromiseRaw(gmailClient.deleteDraft(input)),
    getLabel: (accessToken, userId, labelId) =>
      runPromiseRaw(gmailClient.getLabel(accessToken, userId, labelId)),
    getProfile: (accessToken, userId) => runPromiseRaw(gmailClient.getProfile(accessToken, userId)),
    getThread: (accessToken, userId, threadId) =>
      runPromiseRaw(gmailClient.getThread(accessToken, userId, threadId)),
    listDrafts: (accessToken, userId) => runPromiseRaw(gmailClient.listDrafts(accessToken, userId)),
    listLabels: (accessToken, userId) => runPromiseRaw(gmailClient.listLabels(accessToken, userId)),
    listThreads: (input) => runPromiseRaw(gmailClient.listThreads(input)),
    modifyThread: (input) => runPromiseRaw(gmailClient.modifyThread(input)),
    sendMessage: (input) => runPromiseRaw(gmailClient.sendMessage(input)),
    updateDraft: (input) => runPromiseRaw(gmailClient.updateDraft(input)),
  } satisfies MailboxGmailRequests;
}

const rawGmailRequests = {
  createDraft: createGmailDraft,
  deleteDraft: deleteGmailDraft,
  getLabel: getGmailLabel,
  getProfile: getGmailProfile,
  getThread: getGmailThread,
  listDrafts: listGmailDrafts,
  listLabels: listGmailLabels,
  listThreads: listGmailThreads,
  modifyThread: modifyGmailThread,
  sendMessage: sendGmailMessage,
  updateDraft: updateGmailDraft,
} satisfies MailboxGmailRequests;

const mailboxErrorByOperation = {
  archiveThread: (cause: Error) =>
    mailErrors.GMAIL_MODIFY_THREAD_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  createDraft: (cause: Error) =>
    mailErrors.GMAIL_CREATE_DRAFT_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  deleteDraft: (cause: Error) =>
    mailErrors.GMAIL_DELETE_DRAFT_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
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
  listDrafts: (cause: Error) =>
    mailErrors.GMAIL_LIST_DRAFTS_FAILED({
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
  setThreadRead: (cause: Error) =>
    mailErrors.GMAIL_MODIFY_THREAD_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
  updateDraft: (cause: Error) =>
    mailErrors.GMAIL_UPDATE_DRAFT_FAILED({
      cause,
      internal: {
        dependencyOperation: "mailboxService",
      },
    }),
} satisfies Record<MailboxErrorOperation, (cause: Error) => EvlogError>;

export async function getMailboxData(input: MailboxDataInput, authContext: AuthContext) {
  return getMailboxDataWithGmail(input, authContext, rawGmailRequests);
}

async function getMailboxDataWithGmail(
  input: MailboxDataInput,
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const mailboxInput = {
    ...input,
    folder: input.folder ?? "inbox",
  };
  const credentials = await getGmailCredentials(authContext, [gmailReadonlyScope]);
  // Best-effort counts never reject, so the fetch can safely overlap the cache read.
  const countsPromise = getMailboxCountsBestEffort(
    credentials.accessToken,
    gmailUserId,
    authContext,
    gmail,
  );
  const cachedMailboxData = await getCachedMailboxData(mailboxInput, authContext);

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
    mailboxInput,
    credentials.accessToken,
    await countsPromise,
    gmail,
  );
  const threadDetails = await getMailboxThreadDetails(
    credentials.accessToken,
    gmailUserId,
    mailboxBaseData.listResponse.threads ?? [],
    gmail,
  );
  await cacheMailboxDataIfAvailable(authContext, mailboxBaseData, threadDetails);

  return createMailboxSuccessData(mailboxBaseData, threadDetails);
}

async function getCachedMailboxData(
  input: {
    readonly folder: MailFolder;
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
    folder: input.folder,
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
  input: { readonly folder: MailFolder; readonly query: string; readonly view: "all" | "unread" },
  accessToken: string,
  counts: MailboxData["counts"],
  gmail: MailboxGmailRequests,
) {
  const folderListParams = getGmailFolderListParams(input.folder);
  const [profile, gmailLabels, listResponse] = await Promise.all([
    gmail.getProfile(accessToken, gmailUserId),
    gmail.listLabels(accessToken, gmailUserId),
    gmail.listThreads({
      accessToken,
      ...(folderListParams.includeSpamTrash ? { includeSpamTrash: true } : {}),
      labelIds: getListLabelIds(input.view, input.folder),
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
  gmail: MailboxGmailRequests,
) {
  return Promise.all(threads.map((thread) => gmail.getThread(accessToken, userId, thread.id)));
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

export async function sendMailboxMessage(input: SendMailboxMessageInput, authContext: AuthContext) {
  return sendMailboxMessageWithGmail(input, authContext, rawGmailRequests);
}

async function sendMailboxMessageWithGmail(
  input: SendMailboxMessageInput,
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailSendScope]);
  const sentMessage = await gmail.sendMessage({
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

export async function setMailboxThreadReadState(
  input: SetMailboxThreadReadStateInput,
  authContext: MailMutationAuthContext,
) {
  return setMailboxThreadReadStateWithGmail(input, authContext, rawGmailRequests);
}

async function setMailboxThreadReadStateWithGmail(
  input: SetMailboxThreadReadStateInput,
  authContext: MailMutationAuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailModifyScope]);

  await gmail.modifyThread({
    accessToken: credentials.accessToken,
    threadId: input.threadId,
    userId: gmailUserId,
    ...(input.read ? { removeLabelIds: [unreadLabelId] } : { addLabelIds: [unreadLabelId] }),
  });

  // Write-through: getMailboxData is cache-first, so without this mirror write
  // the mutation's own refetch would serve the stale rows and revert the UI.
  const mirrorApplied = await applyMirrorWriteBestEffort(
    authContext,
    { operation: "setThreadRead", threadId: input.threadId },
    () =>
      authContext.mailSyncRepository.markCachedThreadReadState({
        read: input.read,
        threadId: input.threadId,
        userId: authContext.session.user.id,
      }),
  );

  return {
    data: {
      mirrorApplied,
      read: input.read,
      threadId: input.threadId,
    },
    status: "ok" as const,
  };
}

export async function archiveMailboxThread(
  input: ArchiveMailboxThreadInput,
  authContext: MailMutationAuthContext,
) {
  return archiveMailboxThreadWithGmail(input, authContext, rawGmailRequests);
}

async function archiveMailboxThreadWithGmail(
  input: ArchiveMailboxThreadInput,
  authContext: MailMutationAuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailModifyScope]);

  await gmail.modifyThread({
    accessToken: credentials.accessToken,
    removeLabelIds: [inboxLabelId],
    threadId: input.threadId,
    userId: gmailUserId,
  });

  const mirrorApplied = await applyMirrorWriteBestEffort(
    authContext,
    { operation: "archiveThread", threadId: input.threadId },
    () =>
      authContext.mailSyncRepository.markCachedThreadArchived({
        threadId: input.threadId,
        userId: authContext.session.user.id,
      }),
  );

  return {
    data: {
      mirrorApplied,
      threadId: input.threadId,
    },
    status: "ok" as const,
  };
}

// Gmail already accepted the change and stays the source of truth, so a mirror
// miss must NOT fail the request: retry internally, then log the miss with
// full operator context and report mirrorApplied: false so the UI can warn
// the user the change may briefly reappear until the next sync heals it.
async function applyMirrorWriteBestEffort(
  authContext: MailMutationAuthContext,
  event: { readonly operation: "archiveThread" | "setThreadRead"; readonly threadId: string },
  write: () => Promise<void>,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= mirrorWriteMaxAttempts; attempt += 1) {
    try {
      await write();
      return true;
    } catch (error) {
      lastError = error;
    }
  }

  authContext.log?.set({
    mailMirrorWrite: {
      attempts: mirrorWriteMaxAttempts,
      errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
      errorName: lastError instanceof Error ? lastError.name : "UnknownError",
      operation: event.operation,
      outcome: "failed",
      threadId: event.threadId,
      userId: authContext.session.user.id,
    },
  });

  return false;
}

export async function createMailboxDraft(input: CreateMailboxDraftInput, authContext: AuthContext) {
  return createMailboxDraftWithGmail(input, authContext, rawGmailRequests);
}

async function createMailboxDraftWithGmail(
  input: CreateMailboxDraftInput,
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailModifyScope]);
  const draft = await gmail.createDraft({
    accessToken: credentials.accessToken,
    raw: createRawMimeMessage(input),
    threadId: input.threadId,
    userId: gmailUserId,
  });

  return createDraftSuccessData(draft);
}

export async function updateMailboxDraft(input: UpdateMailboxDraftInput, authContext: AuthContext) {
  return updateMailboxDraftWithGmail(input, authContext, rawGmailRequests);
}

async function updateMailboxDraftWithGmail(
  input: UpdateMailboxDraftInput,
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailModifyScope]);
  const draft = await gmail.updateDraft({
    accessToken: credentials.accessToken,
    draftId: input.draftId,
    raw: createRawMimeMessage(input),
    threadId: input.threadId,
    userId: gmailUserId,
  });

  return createDraftSuccessData(draft);
}

function createDraftSuccessData(draft: {
  readonly id: string;
  readonly message: { readonly id: string; readonly threadId: string };
}) {
  return {
    data: {
      draftId: draft.id,
      messageId: draft.message.id,
      threadId: draft.message.threadId,
    },
    status: "ok" as const,
  };
}

export async function deleteMailboxDraft(input: DeleteMailboxDraftInput, authContext: AuthContext) {
  return deleteMailboxDraftWithGmail(input, authContext, rawGmailRequests);
}

async function deleteMailboxDraftWithGmail(
  input: DeleteMailboxDraftInput,
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailModifyScope]);

  await gmail.deleteDraft({
    accessToken: credentials.accessToken,
    draftId: input.draftId,
    userId: gmailUserId,
  });

  return {
    data: {
      draftId: input.draftId,
    },
    status: "ok" as const,
  };
}

export async function listMailboxDrafts(authContext: AuthContext) {
  return listMailboxDraftsWithGmail(authContext, rawGmailRequests);
}

async function listMailboxDraftsWithGmail(authContext: AuthContext, gmail: MailboxGmailRequests) {
  const credentials = await getGmailCredentials(authContext, [gmailReadonlyScope]);
  const drafts = await gmail.listDrafts(credentials.accessToken, gmailUserId);

  return {
    data: {
      drafts: drafts.map((draft) => ({
        draftId: draft.id,
        messageId: draft.message.id,
        threadId: draft.message.threadId,
      })),
    },
    status: "ok" as const,
  };
}

export async function getThreadData(
  input: { readonly threadId: string },
  authContext: AuthContext,
) {
  return getThreadDataWithGmail(input, authContext, rawGmailRequests);
}

async function getThreadDataWithGmail(
  input: { readonly threadId: string },
  authContext: AuthContext,
  gmail: MailboxGmailRequests,
) {
  const credentials = await getGmailCredentials(authContext, [gmailReadonlyScope]);
  const [gmailLabels, thread] = await Promise.all([
    gmail.listLabels(credentials.accessToken, gmailUserId),
    gmail.getThread(credentials.accessToken, gmailUserId, input.threadId),
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
  const missingScope = requiredScopes.find((scope) => !isGmailScopeSatisfied(token.scopes, scope));

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

// Legacy readonly+send grants keep read and send working verbatim; a granted
// gmail.modify additionally satisfies its implied read/send scopes.
function isGmailScopeSatisfied(grantedScopes: readonly string[], requiredScope: string) {
  if (grantedScopes.includes(requiredScope)) {
    return true;
  }

  return (
    grantedScopes.includes(gmailModifyScope) && gmailModifyImpliedScopes.includes(requiredScope)
  );
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
  gmail: MailboxGmailRequests,
) {
  try {
    return await getMailboxCounts(accessToken, userId, gmail);
  } catch (error) {
    logMailboxError(authContext.log, error, "getMailbox");
    return {
      drafts: 0,
      inboxUnread: 0,
    };
  }
}

async function getMailboxCounts(accessToken: string, userId: string, gmail: MailboxGmailRequests) {
  const [inboxLabel, draftLabel] = await Promise.all([
    gmail.getLabel(accessToken, userId, "INBOX"),
    gmail.getLabel(accessToken, userId, "DRAFT"),
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

function getListLabelIds(view: "all" | "unread", folder: MailFolder) {
  const folderLabelIds = getGmailFolderListParams(folder).labelIds;

  switch (view) {
    case "all":
      return folderLabelIds;
    case "unread":
      return folderLabelIds.length > 0 ? [...folderLabelIds, "UNREAD"] : folderLabelIds;
    default:
      return view satisfies never;
  }
}

function getMailboxQuery(input: {
  readonly folder: MailFolder;
  readonly query: string;
  readonly view: "all" | "unread";
}) {
  const folderListParams = getGmailFolderListParams(input.folder);
  const parts = [input.query.trim()];

  if (folderListParams.extraQuery) {
    parts.push(folderListParams.extraQuery);
  }

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

// To and Subject are optional so drafts can be saved before a recipient or
// subject exists; the send path keeps passing both, preserving its exact
// header layout (To, Subject, Content-Type, MIME-Version, In-Reply-To).
function createRawMimeMessage(input: {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly subject?: string;
  readonly to?: string;
}) {
  const headers: string[] = [];

  if (input.to !== undefined) {
    headers.push(`To: ${input.to}`);
  }

  if (input.subject !== undefined) {
    headers.push(`Subject: ${encodeMimeHeaderValue(input.subject)}`);
  }

  headers.push("Content-Type: text/plain; charset=UTF-8", "MIME-Version: 1.0");

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  }

  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`).toString("base64url");
}

function encodeMimeHeaderValue(value: string) {
  if (/^[\x20-\x7E]*$/u.test(value)) {
    return value;
  }

  const encodedWords: string[] = [];
  let chunkCodePoints: string[] = [];

  for (const codePoint of value) {
    const nextChunkCodePoints = [...chunkCodePoints, codePoint];
    const nextChunkBytes = getUtf8Bytes(nextChunkCodePoints);

    if (Buffer.from(nextChunkBytes).toString("base64").length <= mimeHeaderBase64ChunkMaxLength) {
      chunkCodePoints = nextChunkCodePoints;
      continue;
    }

    const chunk = getMimeHeaderBase64SafeChunk(chunkCodePoints);
    encodedWords.push(createMimeEncodedWord(getUtf8Bytes(chunk.encodedCodePoints)));
    chunkCodePoints = [...chunk.nextCodePoints, codePoint];
  }

  if (chunkCodePoints.length > 0) {
    encodedWords.push(createMimeEncodedWord(getUtf8Bytes(chunkCodePoints)));
  }

  return encodedWords.join("\r\n ");
}

function getMimeHeaderBase64SafeChunk(codePoints: readonly string[]) {
  for (let endIndex = codePoints.length; endIndex > 0; endIndex -= 1) {
    const encodedCodePoints = codePoints.slice(0, endIndex);
    if (getUtf8Bytes(encodedCodePoints).length % 3 !== 0) {
      continue;
    }

    return {
      encodedCodePoints,
      nextCodePoints: codePoints.slice(endIndex),
    };
  }

  return {
    encodedCodePoints: codePoints,
    nextCodePoints: [],
  };
}

function getUtf8Bytes(codePoints: readonly string[]) {
  return [...Buffer.from(codePoints.join(""), "utf8")];
}

function createMimeEncodedWord(bytes: readonly number[]) {
  return `${mimeHeaderEncodedWordPrefix}${Buffer.from(bytes).toString("base64")}${mimeHeaderEncodedWordSuffix}`;
}

function getMailboxLabel(email: string) {
  return email.split("@")[0] ?? email;
}

function toLabelLike(labelId: string, labelById: ReadonlyMap<string, GmailLabel>) {
  return labelById.get(labelId) ?? createFallbackLabel(labelId);
}

function createFallbackLabel(labelId: string) {
  return {
    id: labelId,
    name: labelId,
    type: "system" as const,
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
