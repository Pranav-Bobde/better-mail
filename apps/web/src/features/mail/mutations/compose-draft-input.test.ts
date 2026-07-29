import assert from "node:assert/strict";
import test from "node:test";

import { createDraftInputSchema, updateDraftInputSchema } from "@code-main/api/mail/contracts";

import {
  createComposeStateFromDraftMessage,
  createDraftInputFromCompose,
  hasDraftContent,
} from "@/features/mail/mutations/compose-draft-input";

test("full compose maps to a valid createDraft input", () => {
  const draftInput = createDraftInputFromCompose({
    body: "Hi Near,\n\nDraft body.",
    inReplyTo: "19807d1a2b3c4d5e",
    open: true,
    subject: "Re: Launch sync",
    threadId: "19807d1a2b3c4d5e",
    to: "nearl0407@gmail.com",
  });

  assert.deepEqual(draftInput, {
    body: "Hi Near,\n\nDraft body.",
    inReplyTo: "19807d1a2b3c4d5e",
    subject: "Re: Launch sync",
    threadId: "19807d1a2b3c4d5e",
    to: "nearl0407@gmail.com",
  });
  // The mapped shape must satisfy the wire contract exactly.
  assert.deepEqual(createDraftInputSchema.parse(draftInput), draftInput);
  assert.deepEqual(
    updateDraftInputSchema.parse({ ...draftInput, draftId: "r-1234567890123456789" }),
    { ...draftInput, draftId: "r-1234567890123456789" },
  );
});

test("empty and invalid optional fields are omitted, not sent", () => {
  const draftInput = createDraftInputFromCompose({
    body: "Just a note to self",
    open: true,
    subject: "   ",
    to: "not-an-email",
  });

  assert.deepEqual(draftInput, { body: "Just a note to self" });
  assert.deepEqual(createDraftInputSchema.parse(draftInput), draftInput);
});

test("hasDraftContent requires at least one non-blank field", () => {
  assert.equal(hasDraftContent({ body: "", open: true, subject: "", to: "" }), false);
  assert.equal(hasDraftContent({ body: "  ", open: true, subject: " ", to: "" }), false);
  assert.equal(hasDraftContent({ body: "x", open: true, subject: "", to: "" }), true);
  assert.equal(hasDraftContent({ body: "", open: true, subject: "Hello", to: "" }), true);
  assert.equal(
    hasDraftContent({ body: "", open: true, subject: "", to: "nearl0407@gmail.com" }),
    true,
  );
});

test("a draft mailbox message loads into compose for editing", () => {
  // Shape from getMailbox drafts-folder rows: `email` is the parsed From header
  // (the user's own address for a draft) — the recipient is not available, so
  // the To field starts empty and the user re-enters it.
  const compose = createComposeStateFromDraftMessage({
    subject: "Launch sync",
    text: "Quick sync on the launch?\n\nNear",
  });

  assert.deepEqual(compose, {
    body: "Quick sync on the launch?\n\nNear",
    open: true,
    subject: "Launch sync",
    to: "",
  });
});
