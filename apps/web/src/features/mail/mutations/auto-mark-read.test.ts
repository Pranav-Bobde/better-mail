import assert from "node:assert/strict";
import test from "node:test";

import * as autoMarkReadModule from "@/features/mail/mutations/auto-mark-read";

const { shouldAutoMarkThreadRead } = autoMarkReadModule;

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

test("manual unread intent survives folder changes and automatic reselection", () => {
  const manualUnreadThreadIds = new Set([unreadThread.threadId]);

  // Folder-away clears selection, but must not erase explicit unread intent.
  assert.equal(shouldAutoMarkThreadRead(null, null, manualUnreadThreadIds), false);
  // Returning to the folder can automatically select A again. That is not an
  // explicit reopen, so A must remain unread.
  assert.equal(shouldAutoMarkThreadRead(unreadThread, null, manualUnreadThreadIds), false);
});

test("explicit reopen clears unread intent so normal auto-read can run", () => {
  const manualUnreadThreadIds = getSetManualUnreadIntent()(
    new Set([unreadThread.threadId]),
    unreadThread.threadId,
    false,
  );

  assert.equal(shouldAutoMarkThreadRead(unreadThread, null, manualUnreadThreadIds), true);
});

test("manual mark-read clears the stored unread intent", () => {
  const manualUnreadThreadIds = getSetManualUnreadIntent()(
    new Set([unreadThread.threadId]),
    unreadThread.threadId,
    false,
  );

  assert.equal(manualUnreadThreadIds.has(unreadThread.threadId), false);
});

test("leaving and explicitly reopening a thread starts a fresh auto-read selection", () => {
  const resetAutoMarkGuardForSelection = (autoMarkReadModule as Record<string, unknown>)
    .resetAutoMarkGuardForSelection;
  assert.equal(typeof resetAutoMarkGuardForSelection, "function");

  const afterFolderAway = (resetAutoMarkGuardForSelection as ResetAutoMarkGuardForSelection)(
    null,
    unreadThread.threadId,
    unreadThread.threadId,
  );
  const afterExplicitReopen = (resetAutoMarkGuardForSelection as ResetAutoMarkGuardForSelection)(
    unreadThread.threadId,
    null,
    afterFolderAway,
  );

  assert.equal(shouldAutoMarkThreadRead(unreadThread, afterExplicitReopen, new Set()), true);
});

type SetManualUnreadIntent = (
  current: ReadonlySet<string>,
  threadId: string,
  preserveUnread: boolean,
) => ReadonlySet<string>;

function getSetManualUnreadIntent() {
  const setManualUnreadIntent = (autoMarkReadModule as Record<string, unknown>)
    .setManualUnreadIntent;
  assert.equal(typeof setManualUnreadIntent, "function");
  return setManualUnreadIntent as SetManualUnreadIntent;
}

type ResetAutoMarkGuardForSelection = (
  selectedThreadId: string | null,
  previousSelectedThreadId: string | null,
  lastAutoMarkedThreadId: string | null,
) => string | null;
