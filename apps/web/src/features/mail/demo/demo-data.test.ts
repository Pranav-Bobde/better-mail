import assert from "node:assert/strict";
import test from "node:test";

import {
  getMailboxOutputSchema,
  getThreadOutputSchema,
  mailFolderSchema,
} from "@code-main/api/mail/contracts";

import { demoLabelById, demoMessages } from "@/features/mail/demo/demo-data";
import {
  createDemoMailboxState,
  selectDemoMailboxData,
  toDemoMailMessage,
} from "@/features/mail/demo/demo-mailbox-state";

test("every demo message satisfies the mail message contract", () => {
  const result = getThreadOutputSchema.safeParse({
    data: { messages: demoMessages.map(toDemoMailMessage) },
    status: "ok",
  });

  assert.equal(result.success, true);
});

test("every folder produces a mailbox payload that satisfies the contract", () => {
  for (const folder of mailFolderSchema.options) {
    const result = getMailboxOutputSchema.safeParse({
      data: selectDemoMailboxData(createDemoMailboxState(), { folder, query: "", view: "all" }),
      status: "ok",
    });

    assert.equal(result.success, true, `folder ${folder} must satisfy the mailbox contract`);
  }
});

test("demo messages only carry provider labels the demo label catalog knows", () => {
  const unknownLabels = demoMessages.flatMap((message) =>
    message.providerLabels.filter((labelId) => demoLabelById.has(labelId) === false),
  );

  assert.deepEqual(unknownLabels, []);
});

test("demo message and thread ids are unique and threads group more than one message", () => {
  const messageIds = new Set(demoMessages.map((message) => message.id));
  const threadIds = new Set(demoMessages.map((message) => message.threadId));

  assert.equal(messageIds.size, demoMessages.length);
  assert.equal(threadIds.size, 25);
  assert.equal(demoMessages.length, 32);
});

test("draft records line up with the draft-labelled fixture messages", () => {
  const state = createDemoMailboxState();
  const draftMessageIds = demoMessages
    .filter((message) => message.providerLabels.includes("DRAFT"))
    .map((message) => message.id);

  assert.deepEqual(
    state.drafts.map((draft) => draft.messageId),
    draftMessageIds,
  );
  assert.deepEqual(
    state.drafts.map((draft) => draft.draftId),
    ["demo-draft-1", "demo-draft-2", "demo-draft-3"],
  );
});

test("the demo mailbox covers every folder the sidebar can open", () => {
  const state = createDemoMailboxState();
  const threadCountByFolder = Object.fromEntries(
    mailFolderSchema.options.map((folder) => [
      folder,
      selectDemoMailboxData(state, { folder, query: "", view: "all" }).messages.length,
    ]),
  );

  assert.deepEqual(threadCountByFolder, {
    archive: 4,
    drafts: 3,
    forums: 1,
    inbox: 17,
    junk: 1,
    promotions: 2,
    sent: 5,
    social: 2,
    trash: 1,
    updates: 3,
  });
});
