import assert from "node:assert/strict";
import test from "node:test";

import { demoMailClient } from "@/features/mail/demo/demo-client";
import { resetDemoStore } from "@/features/mail/demo/demo-store";

// Every envelope below is narrowed with assert.ok rather than an inline
// `status === "ok" &&` guard, so an unexpected error envelope fails on the spot
// instead of being folded into the next comparison.
test("getMailbox returns an ok envelope with the demo account, counts and rows", async () => {
  resetDemoStore();

  const result = await demoMailClient.getMailbox({ folder: "inbox", query: "", view: "all" });

  assert.ok(result.status === "ok");
  assert.equal(result.data.source, "gmail");
  assert.deepEqual(result.data.account, {
    email: "alicia@example.com",
    label: "alicia",
  });
  assert.deepEqual(result.data.counts, { drafts: 3, inboxUnread: 9 });
  assert.equal(result.data.messages.length, 17);
});

test("getMailbox defaults to the inbox when no folder is supplied", async () => {
  resetDemoStore();

  const result = await demoMailClient.getMailbox({ query: "", view: "all" });

  assert.equal(result.status === "ok" && result.data.messages.length, 17);
});

test("getThread returns the conversation oldest first", async () => {
  resetDemoStore();

  const result = await demoMailClient.getThread({ threadId: "demo-thread-001" });

  assert.equal(result.status, "ok");
  assert.deepEqual(result.status === "ok" && result.data.messages.map((message) => message.id), [
    "demo-msg-015",
    "demo-msg-016",
    "demo-msg-017",
  ]);
});

test("setThreadRead persists so the next getMailbox reports the new count", async () => {
  resetDemoStore();

  const mutation = await demoMailClient.setThreadRead({ read: true, threadId: "demo-thread-001" });
  const mailbox = await demoMailClient.getMailbox({ folder: "inbox", query: "", view: "all" });

  assert.deepEqual(mutation, {
    data: { cacheApplied: true, read: true, threadId: "demo-thread-001" },
    status: "ok",
  });
  assert.equal(mailbox.status === "ok" && mailbox.data.counts.inboxUnread, 8);
});

test("archiveThread persists and drops the thread from the inbox", async () => {
  resetDemoStore();

  const mutation = await demoMailClient.archiveThread({ threadId: "demo-thread-008" });
  const mailbox = await demoMailClient.getMailbox({ folder: "inbox", query: "", view: "all" });

  assert.deepEqual(mutation, {
    data: { cacheApplied: true, threadId: "demo-thread-008" },
    status: "ok",
  });
  assert.equal(
    mailbox.status === "ok" &&
      mailbox.data.messages.some((message) => message.threadId === "demo-thread-008"),
    false,
  );
});

test("send returns the new message and thread ids", async () => {
  resetDemoStore();

  const result = await demoMailClient.send({
    body: "Confirming Thursday at 2pm.",
    subject: "Thursday sync",
    to: "dana.whitfield@brightpathstudio.com",
  });

  assert.deepEqual(result, {
    data: { cacheApplied: true, messageId: "demo-msg-new-1", threadId: "demo-thread-new-1" },
    status: "ok",
  });
});

test("drafts round-trip through create, list, update and delete", async () => {
  resetDemoStore();

  const created = await demoMailClient.createDraft({
    body: "Rough notes on the token naming.",
    subject: "Token naming",
  });

  assert.ok(created.status === "ok");
  assert.equal(created.data.draftId, "demo-draft-new-1");

  const listedAfterCreate = await demoMailClient.listDrafts({});

  assert.ok(listedAfterCreate.status === "ok");
  assert.equal(listedAfterCreate.data.drafts.length, 4);
  assert.deepEqual(listedAfterCreate.data.drafts.at(-1), {
    draftId: created.data.draftId,
    messageId: created.data.messageId,
    threadId: created.data.threadId,
  });

  const updated = await demoMailClient.updateDraft({
    body: "Second pass, much better.",
    draftId: "demo-draft-new-1",
    subject: "Token naming",
  });

  assert.ok(updated.status === "ok");
  assert.equal(updated.data.draftId, "demo-draft-new-1");
  assert.equal(updated.data.messageId, "demo-msg-new-2");

  const deleted = await demoMailClient.deleteDraft({
    draftId: "demo-draft-new-1",
    threadId: "demo-thread-new-1",
  });

  assert.deepEqual(deleted, {
    data: { cacheApplied: true, draftId: "demo-draft-new-1", threadId: "demo-thread-new-1" },
    status: "ok",
  });

  const listedAfterDelete = await demoMailClient.listDrafts({});

  assert.ok(listedAfterDelete.status === "ok");
  assert.equal(listedAfterDelete.data.drafts.length, 3);
});

test("updating a draft that is not in the mailbox returns the error envelope", async () => {
  resetDemoStore();

  const result = await demoMailClient.updateDraft({ body: "", draftId: "demo-draft-missing" });

  assert.equal(result.status, "error");
  assert.equal(
    result.status === "error" && result.error,
    "That draft is no longer available in the demo mailbox.",
  );
});

test("resetDemoStore restores the fixture mailbox", async () => {
  resetDemoStore();
  await demoMailClient.archiveThread({ threadId: "demo-thread-008" });
  resetDemoStore();

  const mailbox = await demoMailClient.getMailbox({ folder: "inbox", query: "", view: "all" });

  assert.equal(mailbox.status === "ok" && mailbox.data.messages.length, 17);
  assert.equal(mailbox.status === "ok" && mailbox.data.counts.inboxUnread, 9);
});
