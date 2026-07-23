import assert from "node:assert/strict";

import { test } from "vitest";

import { setRequiredTestEnv } from "../../test-env";

setRequiredTestEnv();

const { getCachedThreadWhere } = await import("./prisma-mail-sync-repository");

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
