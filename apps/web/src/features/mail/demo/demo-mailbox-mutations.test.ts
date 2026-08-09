import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveDemoThread,
  createDemoDraft,
  deleteDemoDraft,
  markDemoThreadRead,
  sendDemoMessage,
  updateDemoDraft,
} from "@/features/mail/demo/demo-mailbox-mutations";
import type { DemoMailboxState } from "@/features/mail/demo/demo-mailbox-state";
import {
  createDemoMailboxState,
  getDemoThreadIfExists,
  selectDemoMailboxCounts,
  selectDemoMailboxData,
} from "@/features/mail/demo/demo-mailbox-state";

const savedAt = "2026-08-10T09:00:00.000Z";

function folderThreadIds(state: DemoMailboxState, folder: "drafts" | "inbox" | "sent") {
  return selectDemoMailboxData(state, { folder, query: "", view: "all" }).messages.map(
    (message) => message.threadId,
  );
}

test("marking a thread read clears unread on every message in it", () => {
  const state = markDemoThreadRead(createDemoMailboxState(), {
    read: true,
    threadId: "demo-thread-001",
  });

  assert.equal(getDemoThreadIfExists(state, "demo-thread-001")?.read, true);
  assert.equal(selectDemoMailboxCounts(state).inboxUnread, 8);
});

test("marking a read thread unread puts it back in the unread view", () => {
  const state = markDemoThreadRead(createDemoMailboxState(), {
    read: false,
    threadId: "demo-thread-007",
  });
  const unread = selectDemoMailboxData(state, { folder: "inbox", query: "", view: "unread" });

  assert.equal(getDemoThreadIfExists(state, "demo-thread-007")?.read, false);
  assert.equal(
    unread.messages.some((message) => message.threadId === "demo-thread-007"),
    true,
  );
});

test("archiving a thread removes it from the inbox and adds it to archive", () => {
  const state = archiveDemoThread(createDemoMailboxState(), { threadId: "demo-thread-008" });
  const archive = selectDemoMailboxData(state, { folder: "archive", query: "", view: "all" });

  assert.equal(folderThreadIds(state, "inbox").includes("demo-thread-008"), false);
  assert.equal(
    archive.messages.some((message) => message.threadId === "demo-thread-008"),
    true,
  );
});

test("sending without a thread id opens a new thread in sent", () => {
  const result = sendDemoMessage(
    createDemoMailboxState(),
    {
      body: "Confirming Thursday at 2pm.",
      subject: "Thursday sync",
      to: "dana.whitfield@brightpathstudio.com",
    },
    savedAt,
  );

  assert.equal(result.threadId, "demo-thread-new-1");
  assert.equal(result.messageId, "demo-msg-new-1");
  assert.equal(folderThreadIds(result.state, "sent").includes("demo-thread-new-1"), true);
  assert.deepEqual(
    getDemoThreadIfExists(result.state, "demo-thread-new-1")?.messages.map(
      (message) => message.email,
    ),
    ["alicia@example.com"],
  );
});

test("sending a reply appends to the existing thread and leaves it in the inbox", () => {
  const result = sendDemoMessage(
    createDemoMailboxState(),
    {
      body: "Happy to take the token review — how does Tuesday look?",
      inReplyTo: "demo-msg-027",
      subject: "Re: Intro: Alicia <> Sofia Alvarez (design systems @ Kestrel)",
      threadId: "demo-thread-004",
      to: "sofia.alvarez@kestrelworks.com",
    },
    savedAt,
  );
  const thread = getDemoThreadIfExists(result.state, "demo-thread-004");

  assert.equal(result.threadId, "demo-thread-004");
  assert.deepEqual(
    thread?.messages.map((message) => message.id),
    ["demo-msg-027", "demo-msg-new-1"],
  );
  assert.equal(folderThreadIds(result.state, "inbox").includes("demo-thread-004"), true);
  assert.equal(folderThreadIds(result.state, "sent").includes("demo-thread-004"), true);
});

test("sending a message keeps to on the outgoing message", () => {
  const result = sendDemoMessage(
    createDemoMailboxState(),
    {
      body: "Happy to take the token review — how does Tuesday look?",
      inReplyTo: "demo-msg-027",
      subject: "Re: Intro: Alicia <> Sofia Alvarez (design systems @ Kestrel)",
      threadId: "demo-thread-004",
      to: "sofia.alvarez@kestrelworks.com",
    },
    savedAt,
  );
  const thread = getDemoThreadIfExists(result.state, "demo-thread-004");

  assert.equal(
    thread?.messages.find((message) => message.id === "demo-msg-new-1")?.to,
    "sofia.alvarez@kestrelworks.com",
  );
});

// A visitor's own send is dated with the real wall clock, which can land far
// past the fixture's authored dates. If that mutation became the anchor for
// relative search operators, newer_than:7d would empty out once real time
// drifted more than a week past the fixture — this pins the fixture as the
// anchor instead.
test("a visitor's send does not drift the reference time used by relative search", () => {
  const result = sendDemoMessage(
    createDemoMailboxState(),
    {
      body: "Thanks, catching up now.",
      subject: "Catching up",
      to: "ben.okafor@brightpathstudio.com",
    },
    "2027-03-01T00:00:00.000Z",
  );

  const recent = selectDemoMailboxData(result.state, {
    folder: "inbox",
    query: "newer_than:7d",
    view: "all",
  });

  assert.equal(
    recent.messages.some((message) => message.threadId === "demo-thread-014"),
    true,
  );
});

test("a sent message carries a snippet derived from its body", () => {
  const result = sendDemoMessage(
    createDemoMailboxState(),
    { body: "Line one.\n\nLine two.", subject: "Notes", to: "ben.okafor@brightpathstudio.com" },
    savedAt,
  );

  assert.equal(result.state.messages.at(-1)?.snippet, "Line one. Line two.");
});

test("creating a draft adds it to the drafts folder and the drafts count", () => {
  const result = createDemoDraft(
    createDemoMailboxState(),
    { body: "Rough notes on the token naming.", subject: "Token naming" },
    savedAt,
  );

  assert.equal(result.draft.draftId, "demo-draft-new-1");
  assert.equal(result.draft.threadId, "demo-thread-new-1");
  assert.equal(selectDemoMailboxCounts(result.state).drafts, 4);
  assert.equal(folderThreadIds(result.state, "drafts").includes("demo-thread-new-1"), true);
});

test("updating a draft keeps the draft id and replaces its message", () => {
  const created = createDemoDraft(createDemoMailboxState(), { body: "First pass." }, savedAt);
  const updated = updateDemoDraft(
    created.state,
    {
      body: "Second pass, much better.",
      draftId: created.draft.draftId,
      subject: "Token naming",
      threadId: created.draft.threadId,
    },
    savedAt,
  );

  assert.equal(updated.found, true);
  assert.equal(updated.found === true && updated.draft.draftId, "demo-draft-new-1");
  assert.equal(updated.found === true && updated.draft.messageId, "demo-msg-new-2");
  assert.equal(selectDemoMailboxCounts(updated.state).drafts, 4);
  assert.equal(
    updated.state.messages.some((message) => message.id === created.draft.messageId),
    false,
  );
});

test("updating a draft that does not exist reports not found and leaves state alone", () => {
  const state = createDemoMailboxState();
  const updated = updateDemoDraft(state, { body: "", draftId: "demo-draft-missing" }, savedAt);

  assert.equal(updated.found, false);
  assert.equal(updated.state, state);
});

test("deleting a draft removes the draft record and its message", () => {
  const state = createDemoMailboxState();
  const result = deleteDemoDraft(state, {
    draftId: "demo-draft-1",
    threadId: "demo-thread-009",
  });

  assert.equal(result.threadId, "demo-thread-009");
  assert.equal(selectDemoMailboxCounts(result.state).drafts, 2);
  assert.equal(folderThreadIds(result.state, "drafts").includes("demo-thread-009"), false);
  assert.equal(
    result.state.messages.some((message) => message.id === "demo-msg-014"),
    false,
  );
});

test("deleting a draft that is already gone still succeeds", () => {
  const result = deleteDemoDraft(createDemoMailboxState(), {
    draftId: "demo-draft-missing",
    threadId: "demo-thread-009",
  });

  assert.equal(result.threadId, "demo-thread-009");
  assert.equal(selectDemoMailboxCounts(result.state).drafts, 3);
});
