import assert from "node:assert/strict";

import { test } from "vitest";

import { setRequiredTestEnv } from "../../test-env";

setRequiredTestEnv();

const {
  getCachedThreadWhere,
  markCachedThreadArchivedWithClient,
  markCachedThreadReadStateWithClient,
} = await import("./prisma-mail-sync-repository");
type MailMirrorWriteClient = Parameters<typeof markCachedThreadReadStateWithClient>[0];

// The mirror writes target threads cached for one user's Gmail account(s); the
// scope predicate must pin provider + user so another user's identical Gmail
// thread id can never be touched.
const mirrorThreadScopeWhere = {
  mailAccount: {
    provider: "GMAIL",
    userId: "user-1",
  },
  providerThreadId: "thread-1",
};

// Records every statement the mirror write issues, in order, and returns
// real-shaped narrow rows (ids only) like the production Prisma client would
// under the declared `select` projections.
function createMirrorWriteClientDouble() {
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
  } satisfies MailMirrorWriteClient;

  return { calls, client };
}

test("markCachedThreadReadStateWithClient marks read by clearing isRead and UNREAD label joins", async () => {
  const { calls, client } = createMirrorWriteClientDouble();

  await markCachedThreadReadStateWithClient(client, {
    read: true,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isRead: true },
        where: mirrorThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        where: {
          label: { providerLabelId: "UNREAD" },
          message: { mailThread: mirrorThreadScopeWhere },
        },
      },
      method: "mailMessageLabel.deleteMany",
    },
  ]);
});

test("markCachedThreadReadStateWithClient marks unread by restoring UNREAD joins on every thread message", async () => {
  const { calls, client } = createMirrorWriteClientDouble();

  await markCachedThreadReadStateWithClient(client, {
    read: false,
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isRead: false },
        where: mirrorThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        select: { id: true, mailAccountId: true },
        where: mirrorThreadScopeWhere,
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

test("markCachedThreadArchivedWithClient clears isInbox and INBOX label joins", async () => {
  const { calls, client } = createMirrorWriteClientDouble();

  await markCachedThreadArchivedWithClient(client, {
    threadId: "thread-1",
    userId: "user-1",
  });

  assert.deepEqual(calls, [
    {
      args: {
        data: { isInbox: false },
        where: mirrorThreadScopeWhere,
      },
      method: "mailThread.updateMany",
    },
    {
      args: {
        where: {
          label: { providerLabelId: "INBOX" },
          message: { mailThread: mirrorThreadScopeWhere },
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
