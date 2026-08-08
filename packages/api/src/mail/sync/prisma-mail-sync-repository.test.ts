import assert from "node:assert/strict";

import { test } from "vitest";

import { setRequiredTestEnv } from "../../test-env";

setRequiredTestEnv();

const {
  createPrismaMailSyncRepository,
  getCachedThreadWhere,
  markGmailThreadDeletedWithClient,
  shouldApplyGmailThreadSnapshot,
  markCachedThreadArchivedWithClient,
  markCachedThreadReadStateWithClient,
} = await import("./prisma-mail-sync-repository");
type MailCacheWriteClient = Parameters<typeof markCachedThreadReadStateWithClient>[0];

test("equal authoritative snapshot recovers a tombstone while an older snapshot stays blocked", () => {
  assert.equal(shouldApplyGmailThreadSnapshot(null, "100"), true);
  assert.equal(shouldApplyGmailThreadSnapshot(100n, "101"), true);
  assert.equal(shouldApplyGmailThreadSnapshot(100n, "100"), true);
  assert.equal(shouldApplyGmailThreadSnapshot(100n, "99"), false);
  assert.equal(shouldApplyGmailThreadSnapshot(100n, undefined), false);
  assert.equal(shouldApplyGmailThreadSnapshot(null, undefined), true);
});

test("mutation deletion fence guards the tombstone without replacing thread history", async () => {
  const calls: unknown[] = [];
  const client = {
    mailThread: {
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 1 };
      },
    },
  };

  await markGmailThreadDeletedWithClient(client, {
    deletionFenceHistoryId: "500",
    mailAccountId: "account-1",
    now: new Date("2026-07-31T00:00:00.000Z"),
    threadId: "thread-1",
  });

  assert.deepEqual(calls, [
    {
      data: { deletedAt: new Date("2026-07-31T00:00:00.000Z") },
      where: {
        mailAccountId: "account-1",
        OR: [{ providerHistoryId: null }, { providerHistoryId: { lt: 500n } }],
        providerThreadId: "thread-1",
      },
    },
  ]);
});

test("mutation deletion fence cannot tombstone a newer concurrent thread snapshot", async () => {
  let deletedAt: Date | null = null;
  const storedHistoryId = 501n;
  const client = {
    mailThread: {
      updateMany: async (rawArgs: unknown) => {
        const args = rawArgs as {
          readonly data: { readonly deletedAt: Date };
          readonly where: {
            readonly OR?: readonly [
              unknown,
              { readonly providerHistoryId: { readonly lt: bigint } },
            ];
          };
        };
        const deletionFence = args.where.OR?.[1].providerHistoryId.lt;

        if (deletionFence !== undefined && storedHistoryId < deletionFence) {
          deletedAt = args.data.deletedAt;
          return { count: 1 };
        }

        return { count: 0 };
      },
    },
  };

  await markGmailThreadDeletedWithClient(client, {
    deletionFenceHistoryId: "500",
    mailAccountId: "account-1",
    now: new Date("2026-07-31T00:00:00.000Z"),
    threadId: "thread-1",
  });

  assert.equal(deletedAt, null);
});

test("deleted history threads advance the fence only from an older snapshot", async () => {
  const calls: unknown[] = [];
  const client = {
    mailThread: {
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 1 };
      },
    },
  };

  await markGmailThreadDeletedWithClient(client, {
    historyId: "101",
    mailAccountId: "account-1",
    now: new Date("2026-07-31T00:00:00.000Z"),
    threadId: "thread-1",
  });

  assert.deepEqual(calls, [
    {
      data: {
        deletedAt: new Date("2026-07-31T00:00:00.000Z"),
        providerHistoryId: 101n,
      },
      where: {
        mailAccountId: "account-1",
        OR: [{ providerHistoryId: null }, { providerHistoryId: { lt: 101n } }],
        providerThreadId: "thread-1",
      },
    },
  ]);
});

test("mutation reconciliation finds the user's Gmail account regardless of sync status", async () => {
  const accountLookups: unknown[] = [];
  const client = {
    mailAccount: {
      findFirst: async (args: unknown) => {
        accountLookups.push(args);
        return { id: "account-1" };
      },
    },
    mailThread: {
      updateMany: async () => ({ count: 1 }),
    },
  };
  const repository = createPrismaMailSyncRepository(
    client as unknown as Parameters<typeof createPrismaMailSyncRepository>[0],
  );

  await repository.reconcileCachedGmailThread({
    thread: null,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(accountLookups, [
    {
      select: { id: true },
      where: {
        provider: "GMAIL",
        userId: "user-1",
      },
    },
  ]);
});

test("missing-thread mutation reconciliation uses mailbox history only as a delete predicate", async () => {
  const threadUpdates: unknown[] = [];
  const client = {
    mailAccount: {
      findFirst: async () => ({ id: "account-1" }),
    },
    mailThread: {
      updateMany: async (args: unknown) => {
        threadUpdates.push(args);
        return { count: 0 };
      },
    },
  };
  const repository = createPrismaMailSyncRepository(
    client as unknown as Parameters<typeof createPrismaMailSyncRepository>[0],
  );
  const nowBefore = Date.now();

  await repository.reconcileCachedGmailThread({
    deletionFenceHistoryId: "102",
    thread: null,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.equal(threadUpdates.length, 1);
  const update = threadUpdates[0] as {
    readonly data: { readonly deletedAt: Date };
    readonly where: unknown;
  };
  assert.ok(update.data.deletedAt.getTime() >= nowBefore);
  assert.deepEqual(update.where, {
    mailAccountId: "account-1",
    OR: [{ providerHistoryId: null }, { providerHistoryId: { lt: 102n } }],
    providerThreadId: "thread-1",
  });
  assert.equal(
    "providerHistoryId" in
      (threadUpdates[0] as { readonly data: { readonly providerHistoryId?: bigint } }).data,
    false,
  );
});

// Cache writes target threads cached for one user's Gmail account(s); the
// scope predicate must pin provider + user so another user's identical Gmail
// thread id can never be touched.
const cachedThreadScopeWhere = {
  mailAccount: {
    provider: "GMAIL",
    userId: "user-1",
  },
  providerThreadId: "thread-1",
};
const newerThreadScopeWhere = {
  ...cachedThreadScopeWhere,
  OR: [{ providerHistoryId: null }, { providerHistoryId: { lt: 101n } }],
};

// Records every statement the cache write issues, in order, and returns
// real-shaped narrow rows (ids only) like the production Prisma client would
// under the declared `select` projections.
function createCacheWriteClientDouble() {
  const calls: { readonly args: unknown; readonly method: string }[] = [];
  const transactionClient = {
    mailLabel: {
      upsert: async (args: unknown) => {
        calls.push({ args, method: "mailLabel.upsert" });
        return { id: "label-unread-1" };
      },
    },
    mailMessage: {
      findMany: async (args: unknown) => {
        calls.push({ args, method: "mailMessage.findMany" });
        return [{ id: "message-1" }, { id: "message-2" }];
      },
    },
    mailMessageLabel: {
      createMany: async (args: unknown) => {
        calls.push({ args, method: "mailMessageLabel.createMany" });
        return { count: 2 };
      },
      deleteMany: async (args: unknown) => {
        calls.push({ args, method: "mailMessageLabel.deleteMany" });
        return { count: 1 };
      },
    },
    mailThread: {
      findMany: async (args: unknown) => {
        calls.push({ args, method: "mailThread.findMany" });
        return [{ id: "internal-thread-1", mailAccountId: "account-1" }];
      },
      updateMany: async (args: unknown) => {
        calls.push({ args, method: "mailThread.updateMany" });
        return { count: 1 };
      },
    },
  };
  const client = {
    $transaction: async <Result>(
      callback: (tx: typeof transactionClient) => Promise<Result>,
    ): Promise<Result> => callback(transactionClient),
  } satisfies MailCacheWriteClient;

  return { calls, client };
}

test("markCachedThreadReadStateWithClient advances the fence while marking read", async () => {
  const { calls, client } = createCacheWriteClientDouble();

  await markCachedThreadReadStateWithClient(client, {
    historyId: "101",
    read: true,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isRead: true, providerHistoryId: 101n },
        where: newerThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        where: {
          label: { providerLabelId: "UNREAD" },
          message: { mailThread: cachedThreadScopeWhere },
        },
      },
      method: "mailMessageLabel.deleteMany",
    },
  ]);
});

test("markCachedThreadReadStateWithClient marks unread by restoring UNREAD joins on every thread message", async () => {
  const { calls, client } = createCacheWriteClientDouble();

  await markCachedThreadReadStateWithClient(client, {
    historyId: "101",
    read: false,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isRead: false, providerHistoryId: 101n },
        where: newerThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        select: { id: true, mailAccountId: true },
        where: cachedThreadScopeWhere,
      },
      method: "mailThread.findMany",
    },
    {
      args: {
        create: {
          mailAccountId: "account-1",
          name: "UNREAD",
          providerLabelId: "UNREAD",
          type: "system",
        },
        update: {},
        where: {
          mailAccountId_providerLabelId: {
            mailAccountId: "account-1",
            providerLabelId: "UNREAD",
          },
        },
      },
      method: "mailLabel.upsert",
    },
    {
      args: {
        select: { id: true },
        where: { mailThreadId: "internal-thread-1" },
      },
      method: "mailMessage.findMany",
    },
    {
      args: {
        data: [
          { mailLabelId: "label-unread-1", mailMessageId: "message-1" },
          { mailLabelId: "label-unread-1", mailMessageId: "message-2" },
        ],
        skipDuplicates: true,
      },
      method: "mailMessageLabel.createMany",
    },
  ]);
});

test("markCachedThreadArchivedWithClient advances the fence while archiving", async () => {
  const { calls, client } = createCacheWriteClientDouble();

  await markCachedThreadArchivedWithClient(client, {
    historyId: "101",
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isInbox: false, providerHistoryId: 101n },
        where: newerThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        where: {
          label: { providerLabelId: "INBOX" },
          message: { mailThread: cachedThreadScopeWhere },
        },
      },
      method: "mailMessageLabel.deleteMany",
    },
  ]);
});

test("builds cached mailbox thread predicates for folder flags", () => {
  assert.deepEqual(getCachedThreadWhere("all", "inbox"), {
    deletedAt: null,
    isInbox: true,
  });
  assert.deepEqual(getCachedThreadWhere("unread", "sent"), {
    deletedAt: null,
    isRead: false,
    isSent: true,
  });
  assert.deepEqual(getCachedThreadWhere("all", "junk"), {
    deletedAt: null,
    isSpam: true,
  });
  assert.deepEqual(getCachedThreadWhere("all", "trash"), {
    deletedAt: null,
    isTrash: true,
  });
});

test("builds cached archive predicate without inbox trash spam or draft threads", () => {
  assert.deepEqual(getCachedThreadWhere("unread", "archive"), {
    deletedAt: null,
    isDraft: false,
    isInbox: false,
    isRead: false,
    isSpam: false,
    isTrash: false,
  });
});

test("builds cached category predicate through message labels without fetching extra columns", () => {
  assert.deepEqual(getCachedThreadWhere("all", "social"), {
    deletedAt: null,
    messages: {
      some: {
        labels: {
          some: {
            label: {
              providerLabelId: "CATEGORY_SOCIAL",
            },
          },
        },
      },
    },
  });
});
