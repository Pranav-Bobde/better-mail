import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoMailboxState,
  getDemoThreadIfExists,
  selectDemoMailboxCounts,
  selectDemoMailboxData,
  selectDemoThreadMessages,
  toDemoThreadRow,
} from "@/features/mail/demo/demo-mailbox-state";

const state = createDemoMailboxState();

function inboxRowFor(threadId: string) {
  return selectDemoMailboxData(state, { folder: "inbox", query: "", view: "all" }).messages.find(
    (message) => message.threadId === threadId,
  );
}

test("a thread row is built from the newest message with thread-wide labels and read state", () => {
  const thread = getDemoThreadIfExists(state, "demo-thread-001");

  // Narrowed once up front so a missing thread fails here rather than turning
  // every assertion below into an undefined comparison.
  assert.ok(thread !== null);
  assert.deepEqual(
    thread.messages.map((message) => message.id),
    ["demo-msg-015", "demo-msg-016", "demo-msg-017"],
  );

  const row = toDemoThreadRow(thread);

  assert.equal(row.id, "demo-msg-017");
  assert.equal(row.subject, "Re: Design review: onboarding flow v3");
  assert.equal(row.email, "marcus.chen@northwind.design");
  assert.equal(row.read, false);
  assert.deepEqual(row.labels, ["important", "design"]);
});

test("a thread stays unread until every message in it is read", () => {
  const row = inboxRowFor("demo-thread-003");

  assert.equal(row?.read, false);
  assert.equal(row?.subject, "Re: Can we move Thursday's sync to 2:00pm?");
});

test("display labels aggregate across the thread and stop at three", () => {
  const row = inboxRowFor("demo-thread-002");

  assert.deepEqual(row?.labels, ["important", "starred", "work"]);
});

test("the unread view keeps only unread threads", () => {
  const all = selectDemoMailboxData(state, { folder: "inbox", query: "", view: "all" });
  const unread = selectDemoMailboxData(state, { folder: "inbox", query: "", view: "unread" });

  assert.equal(all.messages.length, 17);
  assert.equal(unread.messages.length, 9);
  assert.equal(
    unread.messages.every((message) => message.read === false),
    true,
  );
});

test("archive holds threads that are not in the inbox, drafts, spam or trash", () => {
  const archive = selectDemoMailboxData(state, { folder: "archive", query: "", view: "all" });

  assert.deepEqual(
    archive.messages.map((message) => message.threadId),
    ["demo-thread-022", "demo-thread-023", "demo-thread-021", "demo-thread-020"],
  );
});

test("drafts, junk and trash folders each select on their own provider label", () => {
  const drafts = selectDemoMailboxData(state, { folder: "drafts", query: "", view: "all" });
  const junk = selectDemoMailboxData(state, { folder: "junk", query: "", view: "all" });
  const trash = selectDemoMailboxData(state, { folder: "trash", query: "", view: "all" });

  assert.deepEqual(
    drafts.messages.map((message) => message.threadId),
    ["demo-thread-024", "demo-thread-025", "demo-thread-009"],
  );
  assert.deepEqual(
    junk.messages.map((message) => message.subject),
    ["CONGRATULATIONS!!! Your $1,000 gift card is waiting"],
  );
  assert.deepEqual(
    trash.messages.map((message) => message.subject),
    ["Standup notes — 6 July"],
  );
});

test("category folders select threads carrying the matching Gmail category label", () => {
  const folderCounts = {
    forums: selectDemoMailboxData(state, { folder: "forums", query: "", view: "all" }).messages
      .length,
    promotions: selectDemoMailboxData(state, { folder: "promotions", query: "", view: "all" })
      .messages.length,
    social: selectDemoMailboxData(state, { folder: "social", query: "", view: "all" }).messages
      .length,
    updates: selectDemoMailboxData(state, { folder: "updates", query: "", view: "all" }).messages
      .length,
  };

  assert.deepEqual(folderCounts, { forums: 1, promotions: 2, social: 2, updates: 3 });
});

test("rows are ordered newest thread first", () => {
  const inbox = selectDemoMailboxData(state, { folder: "inbox", query: "", view: "all" });
  const dates = inbox.messages.map((message) => Date.parse(message.date));

  assert.deepEqual(
    dates,
    [...dates].sort((left, right) => right - left),
  );
});

test("the mailbox reports the demo account and derived counts", () => {
  const inbox = selectDemoMailboxData(state, { folder: "inbox", query: "", view: "all" });

  assert.deepEqual(inbox.account, { email: "alicia@example.com", label: "alicia" });
  assert.equal(inbox.source, "gmail");
  assert.deepEqual(selectDemoMailboxCounts(state), { drafts: 3, inboxUnread: 9 });
});

test("thread messages are returned oldest first and an unknown thread is empty", () => {
  const messages = selectDemoThreadMessages(state, "demo-thread-003");

  assert.deepEqual(
    messages.map((message) => message.id),
    ["demo-msg-018", "demo-msg-019", "demo-msg-028"],
  );
  assert.deepEqual(selectDemoThreadMessages(state, "demo-thread-missing"), []);
});
