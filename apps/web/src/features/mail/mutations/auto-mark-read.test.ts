import assert from "node:assert/strict";
import test from "node:test";

import { shouldAutoMarkThreadRead } from "@/features/mail/mutations/auto-mark-read";

const unreadThread = { read: false, threadId: "19807d1a2b3c4d5e" };
const readThread = { read: true, threadId: "19807d1a2b3c4d5e" };

test("fires for a freshly selected unread thread", () => {
  assert.equal(shouldAutoMarkThreadRead(unreadThread, null), true);
  assert.equal(shouldAutoMarkThreadRead(unreadThread, "198068880000aaaa"), true);
});

test("never fires without a selection or for an already-read thread", () => {
  assert.equal(shouldAutoMarkThreadRead(null, null), false);
  assert.equal(shouldAutoMarkThreadRead(readThread, null), false);
});

test("fires once per thread selection — a repeat for the same thread is blocked", () => {
  // Same thread still selected (e.g. optimistic patch rolled back and the
  // thread reads as unread again): the guard must not loop.
  assert.equal(shouldAutoMarkThreadRead(unreadThread, unreadThread.threadId), false);
});
