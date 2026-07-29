import assert from "node:assert/strict";
import test from "node:test";

import { getMailboxOutputSchema } from "@code-main/api/mail/contracts";

import {
  getMailboxQueryKeyFolder,
  patchMailboxThreadRead,
  removeMailboxThread,
} from "@/features/mail/mutations/mailbox-cache";

// Real-shaped fixture: validated against the mailbox output contract so the
// cache patch tests exercise exactly what getMailbox resolves with.
const okMailbox = getMailboxOutputSchema.parse({
  data: {
    account: {
      email: "bobdep31@gmail.com",
      label: "bobdep31@gmail.com",
    },
    counts: {
      drafts: 2,
      inboxUnread: 3,
    },
    messages: [
      {
        date: "2026-07-20T09:12:44.000Z",
        email: "nearl0407@gmail.com",
        id: "19807d1a2b3c4d5e",
        labels: ["work"],
        name: "Near L",
        read: false,
        snippet: "Quick sync on the launch?",
        subject: "Launch sync",
        text: "Quick sync on the launch?\n\nNear",
        threadId: "19807d1a2b3c4d5e",
      },
      {
        date: "2026-07-19T18:03:02.000Z",
        email: "nearl0407@gmail.com",
        id: "19806fffeeddccbb",
        labels: [],
        name: "Near L",
        read: true,
        snippet: "See attached notes.",
        subject: "Notes",
        text: "See attached notes.",
        threadId: "198068880000aaaa",
      },
    ],
    source: "gmail",
  },
  status: "ok",
});

const errorMailbox = getMailboxOutputSchema.parse({
  error: "mail.GMAIL_LIST_THREADS_FAILED",
  status: "error",
});

test("patchMailboxThreadRead flips read on every message of the thread", () => {
  const patched = expectOkMailbox(patchMailboxThreadRead(okMailbox, "19807d1a2b3c4d5e", true));

  assert.notEqual(patched, okMailbox);
  assert.deepEqual(
    patched.data.messages.map((message) => message.read),
    [true, true],
  );
  // Untouched thread keeps its exact message object.
  assert.equal(patched.data.messages[1], expectOkMailbox(okMailbox).data.messages[1]);
});

test("patchMailboxThreadRead returns error cache entries unchanged", () => {
  assert.equal(patchMailboxThreadRead(errorMailbox, "19807d1a2b3c4d5e", true), errorMailbox);
});

test("patchMailboxThreadRead returns the same entry when nothing changes", () => {
  assert.equal(patchMailboxThreadRead(okMailbox, "unknown-thread", true), okMailbox);
  assert.equal(patchMailboxThreadRead(undefined, "19807d1a2b3c4d5e", true), undefined);
});

test("removeMailboxThread drops the thread's messages and keeps the rest", () => {
  const patched = expectOkMailbox(removeMailboxThread(okMailbox, "19807d1a2b3c4d5e"));

  assert.deepEqual(
    patched.data.messages.map((message) => message.id),
    ["19806fffeeddccbb"],
  );
});

test("removeMailboxThread leaves error entries and misses unchanged", () => {
  assert.equal(removeMailboxThread(errorMailbox, "19807d1a2b3c4d5e"), errorMailbox);
  assert.equal(removeMailboxThread(okMailbox, "unknown-thread"), okMailbox);
  assert.equal(removeMailboxThread(undefined, "19807d1a2b3c4d5e"), undefined);
});

test("getMailboxQueryKeyFolder reads the folder from an oRPC mailbox query key", () => {
  // Shape produced by @orpc/tanstack-query generateOperationKey(path, state).
  const inboxKey = [
    ["mail", "getMailbox"],
    { input: { folder: "inbox", query: "", view: "all" }, type: "query" },
  ];
  const draftsKey = [
    ["mail", "getMailbox"],
    { input: { folder: "drafts", query: "", view: "all" }, type: "query" },
  ];

  assert.equal(getMailboxQueryKeyFolder(inboxKey), "inbox");
  assert.equal(getMailboxQueryKeyFolder(draftsKey), "drafts");
});

test("getMailboxQueryKeyFolder returns null for keys without a folder input", () => {
  assert.equal(getMailboxQueryKeyFolder([["mail", "getMailbox"], {}]), null);
  assert.equal(getMailboxQueryKeyFolder([["mail", "getMailbox"]]), null);
  assert.equal(
    getMailboxQueryKeyFolder([["mail", "getMailbox"], { input: { folder: "not-a-folder" } }]),
    null,
  );
});

function expectOkMailbox(entry: ReturnType<typeof patchMailboxThreadRead>) {
  assert.ok(entry);

  if (entry.status !== "ok") {
    throw new Error("Expected an ok mailbox cache entry");
  }

  return entry;
}
