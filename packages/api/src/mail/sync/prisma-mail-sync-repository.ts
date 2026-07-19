import prisma, {
  MailAccountSyncStatus,
  MailProvider,
  MailSyncCursorKind,
  MailSyncScopeType,
  type Prisma,
  type PrismaClient,
} from "@code-main/db";
import { Context, Effect, Layer } from "effect";
import type { EvlogError } from "evlog";

import { isEvlogError, tryPromiseExpecting } from "../../effect-interop";
import type { MailboxData, MailMessage } from "../contracts";
import { getDisplayLabels } from "../label-presentation";
import {
  getGmailHeaderValue,
  getGmailMessageDate,
  getGmailMessageHtml,
  getGmailMessageSubject,
  getGmailMessageText,
  parseGmailAddressHeader,
  parseGmailEmailAddress,
} from "../gmail-message-utils";
import type { GmailMessage, GmailThread } from "../gmail-schemas";
import type { MailSyncRepository as ProcessorMailSyncRepository } from "./processor";

const gmailProviderId = "google";
const gmailMailboxScopeId = "mailbox";
const gmailThreadTransactionTimeoutMs = 120_000;
const systemLabelIds = new Set([
  "CATEGORY_FORUMS",
  "CATEGORY_PERSONAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "DRAFT",
  "INBOX",
  "SENT",
  "SPAM",
  "TRASH",
  "UNREAD",
]);

// Structural subset of the Prisma interactive transaction client that the Gmail
// thread writer touches. Method argument types stay pinned to Prisma (the schema
// is the single source of truth), while the narrowed return shapes let the sync
// unit test supply a typed in-memory transaction double — no client-wide stub or
// type assertions required to exercise applyGmailThreadToClient.
type MailSyncTransactionClient = {
  readonly mailLabel: {
    upsert(args: Prisma.MailLabelUpsertArgs): Promise<{ readonly id: string }>;
  };
  readonly mailMessage: {
    findUnique(args: Prisma.MailMessageFindUniqueArgs): Promise<{ readonly id: string } | null>;
    upsert(args: Prisma.MailMessageUpsertArgs): Promise<{ readonly id: string }>;
  };
  readonly mailMessageLabel: {
    create(args: Prisma.MailMessageLabelCreateArgs): Promise<unknown>;
    deleteMany(args: Prisma.MailMessageLabelDeleteManyArgs): Promise<unknown>;
  };
  readonly mailThread: {
    update(args: Prisma.MailThreadUpdateArgs): Promise<unknown>;
    upsert(args: Prisma.MailThreadUpsertArgs): Promise<{ readonly id: string }>;
  };
};

// The single Prisma capability applyGmailThreadToClient depends on: an
// interactive transaction that yields the narrowed transaction client above.
// The full PrismaClient is structurally assignable to it, so production wiring
// is unchanged; the sync unit test supplies a typed double for the same seam.
export type MailSyncThreadApplyClient = {
  $transaction<Result>(
    callback: (client: MailSyncTransactionClient) => Promise<Result>,
    options?: { readonly timeout?: number },
  ): Promise<Result>;
};

type PrismaMailSyncRepository = ReturnType<typeof createPrismaMailSyncRepository>;

type MailSyncRepositoryRequests = {
  readonly [Key in keyof PrismaMailSyncRepository]: PrismaMailSyncRepository[Key] extends (
    ...args: infer Args
  ) => Promise<infer Result>
    ? (...args: Args) => Effect.Effect<Result, EvlogError>
    : never;
};

/**
 * Effect v4 service wrapping the promise-based Prisma mail sync repository
 * below. The underlying Prisma logic stays unchanged; methods bridge rejected
 * promises into the Effect error channel so catalog EvlogError values keep the
 * same boundary behavior as the promise helper.
 */
export class MailSyncRepository extends Context.Service<
  MailSyncRepository,
  MailSyncRepositoryRequests
>()("mail/MailSyncRepository") {
  static readonly layer = MailSyncRepository.layerWithClient(prisma);

  static layerWithClient(client: PrismaClient) {
    return Layer.effect(
      MailSyncRepository,
      Effect.gen(function* () {
        yield* Effect.void;
        return MailSyncRepository.of(createEffectMailSyncRepository(client));
      }),
    );
  }
}

function createEffectMailSyncRepository(client: PrismaClient) {
  const repository = createPrismaMailSyncRepository(client);

  return {
    acquireSyncLock: (...args) => wrapPrismaRequest(() => repository.acquireSyncLock(...args)),
    applyGmailThread: (...args) => wrapPrismaRequest(() => repository.applyGmailThread(...args)),
    findGmailMailAccountsDueForWatchRenewal: (...args) =>
      wrapPrismaRequest(() => repository.findGmailMailAccountsDueForWatchRenewal(...args)),
    findRecentlyActiveGmailMailAccountByEmail: (...args) =>
      wrapPrismaRequest(() => repository.findRecentlyActiveGmailMailAccountByEmail(...args)),
    getActiveMailAccountWithCursor: (...args) =>
      wrapPrismaRequest(() => repository.getActiveMailAccountWithCursor(...args)),
    getCachedMailboxData: (...args) =>
      wrapPrismaRequest(() => repository.getCachedMailboxData(...args)),
    markGmailMailboxActivity: (...args) =>
      wrapPrismaRequest(() => repository.markGmailMailboxActivity(...args)),
    markGmailThreadDeleted: (...args) =>
      wrapPrismaRequest(() => repository.markGmailThreadDeleted(...args)),
    markMailAccountAuthError: (...args) =>
      wrapPrismaRequest(() => repository.markMailAccountAuthError(...args)),
    markMailAccountNeedsResync: (...args) =>
      wrapPrismaRequest(() => repository.markMailAccountNeedsResync(...args)),
    releaseSyncLock: (...args) => wrapPrismaRequest(() => repository.releaseSyncLock(...args)),
    updateGmailWatch: (...args) => wrapPrismaRequest(() => repository.updateGmailWatch(...args)),
    updateSyncCursor: (...args) => wrapPrismaRequest(() => repository.updateSyncCursor(...args)),
    upsertGmailMailAccount: (...args) =>
      wrapPrismaRequest(() => repository.upsertGmailMailAccount(...args)),
  } satisfies MailSyncRepositoryRequests;
}

function wrapPrismaRequest<A>(request: () => Promise<A>) {
  return tryPromiseExpecting(request, isEvlogError);
}

export function createPrismaMailSyncRepository(client: PrismaClient = prisma) {
  return {
    acquireSyncLock: async (input: {
      readonly lockedUntil: Date;
      readonly lockOwnerId: string;
      readonly syncCursorId: string;
    }) => acquireSyncLock(client, input),
    applyGmailThread: async (input: {
      readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
      readonly latestMessageId: string;
      readonly mailAccountId: string;
      readonly thread: GmailThread;
      readonly threadId: string;
    }) => {
      await applyGmailThreadToClient(client, input);
    },
    getActiveMailAccountWithCursor: async (mailAccountId: string) => {
      const mailAccount = await client.mailAccount.findFirst({
        include: {
          cursors: {
            take: 1,
            where: {
              cursorKind: MailSyncCursorKind.GMAIL_HISTORY_ID,
              providerScopeId: gmailMailboxScopeId,
              scopeType: MailSyncScopeType.MAILBOX,
            },
          },
        },
        where: {
          id: mailAccountId,
          provider: MailProvider.GMAIL,
          syncStatus: MailAccountSyncStatus.ACTIVE,
        },
      });
      const syncCursor = mailAccount?.cursors[0];

      if (!mailAccount || !syncCursor) {
        return null;
      }

      return {
        authAccountId: mailAccount.authAccountId,
        email: mailAccount.email,
        id: mailAccount.id,
        providerAccountId: mailAccount.providerAccountId,
        syncCursor: {
          cursorValue: syncCursor.cursorValue,
          id: syncCursor.id,
        },
        userId: mailAccount.userId,
      };
    },
    getCachedMailboxData: async (input: {
      readonly query: string;
      readonly userId: string;
      readonly view: "all" | "unread";
    }) => getCachedMailboxData(client, input),
    findRecentlyActiveGmailMailAccountByEmail: async (input: {
      readonly activeSince: Date;
      readonly email: string;
    }) => {
      const mailAccount = await client.mailAccount.findFirst({
        where: {
          email: input.email,
          lastMailboxActivityAt: {
            gte: input.activeSince,
          },
          provider: MailProvider.GMAIL,
          syncStatus: MailAccountSyncStatus.ACTIVE,
        },
      });

      return mailAccount ? { id: mailAccount.id } : null;
    },
    findGmailMailAccountsDueForWatchRenewal: async (input: {
      readonly activeSince: Date;
      readonly expiresBefore: Date;
    }) =>
      client.mailAccount.findMany({
        select: {
          id: true,
        },
        where: {
          lastMailboxActivityAt: {
            gte: input.activeSince,
          },
          provider: MailProvider.GMAIL,
          syncStatus: MailAccountSyncStatus.ACTIVE,
          OR: [
            {
              watchExpiresAt: null,
            },
            {
              watchExpiresAt: {
                lte: input.expiresBefore,
              },
            },
          ],
        },
      }),
    markMailAccountAuthError: async (mailAccountId: string) => {
      await client.mailAccount.update({
        data: {
          syncStatus: MailAccountSyncStatus.AUTH_ERROR,
        },
        where: {
          id: mailAccountId,
        },
      });
    },
    markGmailMailboxActivity: async (userId: string) => {
      await client.mailAccount.updateMany({
        data: {
          lastMailboxActivityAt: new Date(),
        },
        where: {
          provider: MailProvider.GMAIL,
          userId,
        },
      });
    },
    markGmailThreadDeleted: async (input: {
      readonly mailAccountId: string;
      readonly threadId: string;
    }) => {
      await client.mailThread.updateMany({
        data: {
          deletedAt: new Date(),
        },
        where: {
          mailAccountId: input.mailAccountId,
          providerThreadId: input.threadId,
        },
      });
    },
    markMailAccountNeedsResync: async (mailAccountId: string) => {
      await client.mailAccount.update({
        data: {
          syncStatus: MailAccountSyncStatus.RESYNC_NEEDED,
        },
        where: {
          id: mailAccountId,
        },
      });
    },
    releaseSyncLock: async (input: {
      readonly lockOwnerId: string;
      readonly syncCursorId: string;
    }) => {
      await client.mailSyncLock.deleteMany({
        where: {
          lockedBy: input.lockOwnerId,
          mailSyncCursorId: input.syncCursorId,
        },
      });
    },
    updateSyncCursor: async (input: {
      readonly cursorValue: string;
      readonly syncCursorId: string;
    }) => {
      await client.mailSyncCursor.update({
        data: {
          cursorValue: input.cursorValue,
        },
        where: {
          id: input.syncCursorId,
        },
      });
    },
    updateGmailWatch: async (input: {
      readonly mailAccountId: string;
      readonly watchExpiresAt: Date;
    }) => {
      await client.mailAccount.update({
        data: {
          watchExpiresAt: input.watchExpiresAt,
        },
        where: {
          id: input.mailAccountId,
        },
      });
    },
    upsertGmailMailAccount: async (input: {
      readonly email: string;
      readonly historyId: string;
      readonly userId: string;
    }) => upsertGmailMailAccount(client, input),
  } satisfies ProcessorMailSyncRepository & {
    readonly getCachedMailboxData: (input: {
      readonly query: string;
      readonly userId: string;
      readonly view: "all" | "unread";
    }) => Promise<{
      readonly data: Omit<MailboxData, "counts">;
      readonly mailAccountId: string;
    } | null>;
    readonly findRecentlyActiveGmailMailAccountByEmail: (input: {
      readonly activeSince: Date;
      readonly email: string;
    }) => Promise<{ readonly id: string } | null>;
    readonly findGmailMailAccountsDueForWatchRenewal: (input: {
      readonly activeSince: Date;
      readonly expiresBefore: Date;
    }) => Promise<readonly { readonly id: string }[]>;
    readonly markMailAccountAuthError: (mailAccountId: string) => Promise<void>;
    readonly markMailAccountNeedsResync: (mailAccountId: string) => Promise<void>;
    readonly markGmailMailboxActivity: (userId: string) => Promise<void>;
    readonly upsertGmailMailAccount: (input: {
      readonly email: string;
      readonly historyId: string;
      readonly userId: string;
    }) => Promise<{ readonly id: string } | null>;
  };
}

async function acquireSyncLock(
  client: PrismaClient,
  input: {
    readonly lockedUntil: Date;
    readonly lockOwnerId: string;
    readonly syncCursorId: string;
  },
) {
  const updatedLock = await client.mailSyncLock.updateMany({
    data: {
      lockedBy: input.lockOwnerId,
      lockedUntil: input.lockedUntil,
    },
    where: {
      lockedUntil: {
        lte: new Date(),
      },
      mailSyncCursorId: input.syncCursorId,
    },
  });

  if (updatedLock.count > 0) {
    return { acquired: true as const };
  }

  return createSyncLock(client, input);
}

async function createSyncLock(
  client: PrismaClient,
  input: {
    readonly lockedUntil: Date;
    readonly lockOwnerId: string;
    readonly syncCursorId: string;
  },
) {
  try {
    await client.mailSyncLock.create({
      data: {
        lockedBy: input.lockOwnerId,
        lockedUntil: input.lockedUntil,
        mailSyncCursorId: input.syncCursorId,
      },
    });
    return { acquired: true as const };
  } catch {
    return { acquired: false as const };
  }
}

async function upsertGmailMailAccount(
  client: PrismaClient,
  input: { readonly email: string; readonly historyId: string; readonly userId: string },
) {
  const authAccount = await client.account.findFirst({
    where: {
      providerId: gmailProviderId,
      userId: input.userId,
    },
  });

  if (!authAccount) {
    return null;
  }

  const mailAccount = await client.mailAccount.upsert({
    create: {
      authAccountId: authAccount.id,
      email: input.email,
      lastMailboxActivityAt: new Date(),
      provider: MailProvider.GMAIL,
      providerAccountId: authAccount.accountId,
      syncStatus: MailAccountSyncStatus.ACTIVE,
      userId: input.userId,
    },
    update: {
      authAccountId: authAccount.id,
      email: input.email,
      lastMailboxActivityAt: new Date(),
      syncStatus: MailAccountSyncStatus.ACTIVE,
    },
    where: {
      userId_provider_providerAccountId: {
        provider: MailProvider.GMAIL,
        providerAccountId: authAccount.accountId,
        userId: input.userId,
      },
    },
  });

  await client.mailSyncCursor.upsert({
    create: {
      cursorKind: MailSyncCursorKind.GMAIL_HISTORY_ID,
      cursorValue: input.historyId,
      mailAccountId: mailAccount.id,
      providerScopeId: gmailMailboxScopeId,
      scopeType: MailSyncScopeType.MAILBOX,
    },
    update: {
      cursorValue: input.historyId,
    },
    where: {
      mailAccountId_cursorKind_scopeType_providerScopeId: {
        cursorKind: MailSyncCursorKind.GMAIL_HISTORY_ID,
        mailAccountId: mailAccount.id,
        providerScopeId: gmailMailboxScopeId,
        scopeType: MailSyncScopeType.MAILBOX,
      },
    },
  });

  return { id: mailAccount.id };
}

async function getCachedMailboxData(
  client: PrismaClient,
  input: { readonly query: string; readonly userId: string; readonly view: "all" | "unread" },
) {
  if (!isCachedMailboxQuery(input.query)) {
    return null;
  }

  const mailAccount = await client.mailAccount.findFirst({
    include: {
      threads: {
        include: {
          latestMessage: {
            include: {
              labels: {
                include: {
                  label: true,
                },
              },
            },
          },
        },
        orderBy: {
          latestMessageAt: "desc",
        },
        take: 20,
        where: getCachedThreadWhere(input.view),
      },
    },
    where: {
      provider: MailProvider.GMAIL,
      syncStatus: MailAccountSyncStatus.ACTIVE,
      userId: input.userId,
    },
  });

  if (!hasCachedMailboxThreads(mailAccount)) {
    return null;
  }

  return {
    data: {
      account: {
        email: mailAccount.email,
        label: mailAccount.email.split("@")[0] ?? mailAccount.email,
      },
      messages: mailAccount.threads.flatMap((thread) =>
        thread.latestMessage
          ? [toCachedMailMessage(thread.latestMessage, thread.providerThreadId)]
          : [],
      ),
      source: "gmail" as const,
    },
    mailAccountId: mailAccount.id,
  };
}

function isCachedMailboxQuery(query: string) {
  return query.trim().length === 0;
}

function getCachedThreadWhere(view: "all" | "unread") {
  const baseWhere = {
    deletedAt: null,
    isInbox: true,
  };

  return view === "unread" ? { ...baseWhere, isRead: false } : baseWhere;
}

function hasCachedMailboxThreads<T extends { readonly threads: readonly unknown[] }>(
  mailAccount: T | null,
): mailAccount is T {
  return Boolean(mailAccount?.threads?.length);
}

export async function applyGmailThreadToClient(
  client: MailSyncThreadApplyClient,
  input: {
    readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
    readonly latestMessageId: string;
    readonly mailAccountId: string;
    readonly thread: GmailThread;
    readonly threadId: string;
  },
) {
  const latestMessage = getLatestGmailMessage(input.thread);
  const threadFlags = getThreadFlags(input.thread.messages);

  await client.$transaction(
    async (tx) => {
      const mailThread = await tx.mailThread.upsert({
        create: {
          ...threadFlags,
          latestMessageAt: getGmailMessageDate(latestMessage),
          mailAccountId: input.mailAccountId,
          messageCount: input.thread.messages.length,
          providerThreadId: input.threadId,
        },
        update: {
          ...threadFlags,
          deletedAt: null,
          latestMessageAt: getGmailMessageDate(latestMessage),
          messageCount: input.thread.messages.length,
        },
        where: {
          mailAccountId_providerThreadId: {
            mailAccountId: input.mailAccountId,
            providerThreadId: input.threadId,
          },
        },
      });

      for (const message of input.thread.messages) {
        await upsertGmailMessage(tx, {
          labelCatalog: input.labelCatalog,
          mailAccountId: input.mailAccountId,
          mailThreadId: mailThread.id,
          message,
        });
      }

      const internalLatestMessage = await tx.mailMessage.findUnique({
        where: {
          mailAccountId_providerMessageId: {
            mailAccountId: input.mailAccountId,
            providerMessageId: input.latestMessageId,
          },
        },
      });

      if (internalLatestMessage) {
        await tx.mailThread.update({
          data: {
            latestMessageId: internalLatestMessage.id,
          },
          where: {
            id: mailThread.id,
          },
        });
      }
    },
    { timeout: gmailThreadTransactionTimeoutMs },
  );
}

async function upsertGmailMessage(
  tx: MailSyncTransactionClient,
  input: {
    readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
    readonly mailAccountId: string;
    readonly mailThreadId: string;
    readonly message: GmailMessage;
  },
) {
  const messageData = toMailMessageWriteData(input.message);
  const mailMessage = await tx.mailMessage.upsert({
    create: {
      ...messageData,
      mailAccountId: input.mailAccountId,
      mailThreadId: input.mailThreadId,
      providerMessageId: input.message.id,
    },
    update: {
      ...messageData,
      mailThreadId: input.mailThreadId,
    },
    where: {
      mailAccountId_providerMessageId: {
        mailAccountId: input.mailAccountId,
        providerMessageId: input.message.id,
      },
    },
  });

  await replaceGmailMessageLabels(tx, {
    labelCatalog: input.labelCatalog,
    labelIds: input.message.labelIds ?? [],
    mailAccountId: input.mailAccountId,
    mailMessageId: mailMessage.id,
  });
}

function toMailMessageWriteData(message: GmailMessage) {
  const headers = message.payload?.headers ?? [];
  const from = parseGmailEmailAddress(getGmailHeaderValue(headers, "From"));

  return {
    bccRecipients: parseGmailAddressHeader(getGmailHeaderValue(headers, "Bcc")),
    ccRecipients: parseGmailAddressHeader(getGmailHeaderValue(headers, "Cc")),
    deletedAt: null,
    fromEmail: from.email,
    fromName: from.name,
    htmlBody: getGmailMessageHtml(message),
    inReplyToHeader: getNullableGmailHeader(headers, "In-Reply-To"),
    referencesHeader: getNullableGmailHeader(headers, "References"),
    rfc822MessageId: getNullableGmailHeader(headers, "Message-ID"),
    sentAt: getGmailMessageDate(message),
    sizeEstimate: message.sizeEstimate,
    snippet: message.snippet,
    subject: getGmailMessageSubject(headers),
    textBody: getGmailMessageText(message),
    toRecipients: parseGmailAddressHeader(getGmailHeaderValue(headers, "To")),
  };
}

function getNullableGmailHeader(
  headers: readonly { readonly name: string; readonly value: string }[],
  name: string,
) {
  const value = getGmailHeaderValue(headers, name);

  return value.length > 0 ? value : null;
}

async function replaceGmailMessageLabels(
  tx: MailSyncTransactionClient,
  input: {
    readonly labelCatalog?: ReadonlyMap<string, { readonly name: string; readonly type: string }>;
    readonly labelIds: readonly string[];
    readonly mailAccountId: string;
    readonly mailMessageId: string;
  },
) {
  await tx.mailMessageLabel.deleteMany({
    where: {
      mailMessageId: input.mailMessageId,
    },
  });

  for (const labelId of input.labelIds) {
    const labelCatalogItem = input.labelCatalog?.get(labelId);
    // With an authoritative labels.list catalog in hand, a miss cannot be a user
    // label (user labels always appear in labels.list) — it is a Gmail special
    // label like YELLOW_STAR, which chips must drop, so store it as "system".
    const labelType =
      labelCatalogItem?.type ?? (input.labelCatalog ? "system" : getLabelType(labelId));
    const label = await tx.mailLabel.upsert({
      create: {
        mailAccountId: input.mailAccountId,
        name: labelCatalogItem?.name ?? labelId,
        providerLabelId: labelId,
        type: labelType,
      },
      update: {
        name: labelCatalogItem?.name ?? labelId,
        type: labelType,
      },
      where: {
        mailAccountId_providerLabelId: {
          mailAccountId: input.mailAccountId,
          providerLabelId: labelId,
        },
      },
    });

    await tx.mailMessageLabel.create({
      data: {
        mailLabelId: label.id,
        mailMessageId: input.mailMessageId,
      },
    });
  }
}

function getLabelType(labelId: string) {
  return systemLabelIds.has(labelId) ? "system" : "user";
}

function toCachedMailMessage(
  message: {
    readonly fromEmail: string;
    readonly fromName: string;
    readonly htmlBody: string | null;
    readonly id: string;
    readonly labels: readonly {
      readonly label: {
        readonly name: string;
        readonly providerLabelId: string;
        readonly type: string;
      };
    }[];
    readonly providerMessageId: string;
    readonly sentAt: Date;
    readonly snippet: string | null;
    readonly subject: string;
    readonly textBody: string;
  },
  providerThreadId: string,
) {
  return {
    date: message.sentAt.toISOString(),
    email: message.fromEmail,
    html: message.htmlBody ?? undefined,
    id: message.providerMessageId,
    labels: getDisplayLabels(
      message.labels.map((item) => ({
        id: item.label.providerLabelId,
        name: item.label.name,
        type: item.label.type,
      })),
    ),
    name: message.fromName,
    read: !message.labels.some((item) => item.label.providerLabelId === "UNREAD"),
    snippet: message.snippet ?? undefined,
    subject: message.subject,
    text: message.textBody,
    threadId: providerThreadId,
  } satisfies MailMessage;
}

function getThreadFlags(messages: readonly GmailMessage[]) {
  const labelIds = messages.flatMap((message) => message.labelIds ?? []);

  return {
    isDraft: labelIds.includes("DRAFT"),
    isImportant: labelIds.includes("IMPORTANT"),
    isInbox: labelIds.includes("INBOX"),
    isRead: !labelIds.includes("UNREAD"),
    isSent: labelIds.includes("SENT"),
    isSpam: labelIds.includes("SPAM"),
    isStarred: labelIds.includes("STARRED"),
    isTrash: labelIds.includes("TRASH"),
  };
}

function getLatestGmailMessage(thread: GmailThread) {
  return thread.messages[thread.messages.length - 1] ?? thread.messages[0];
}
