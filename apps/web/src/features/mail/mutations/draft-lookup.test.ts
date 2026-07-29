import assert from "node:assert/strict";
import test from "node:test";

import { listDraftsOutputSchema } from "@code-main/api/mail/contracts";

import {
  createDraftIdLookup,
  getDraftThreadId,
  removeDraftFromList,
  resolveDraftId,
} from "@/features/mail/mutations/draft-lookup";

// Real-shaped fixture validated against the listDrafts output contract.
const okDraftList = listDraftsOutputSchema.parse({
  data: {
    drafts: [
      {
        draftId: "r-1234567890123456789",
        messageId: "19807d1a2b3c4d5e",
        threadId: "19807d1a2b3c4d5e",
      },
      {
        draftId: "r-9876543210987654321",
        messageId: "19806fffeeddccbb",
        threadId: "198068880000aaaa",
      },
    ],
  },
  status: "ok",
});

const errorDraftList = listDraftsOutputSchema.parse({
  error: "mail.GMAIL_LIST_DRAFTS_FAILED",
  status: "error",
});

const okDrafts = okDraftList.status === "ok" ? okDraftList.data.drafts : [];

test("resolveDraftId prefers the message id and falls back to the thread id", () => {
  const lookup = createDraftIdLookup(okDrafts);

  assert.equal(
    resolveDraftId(lookup, { id: "19807d1a2b3c4d5e", threadId: "19807d1a2b3c4d5e" }),
    "r-1234567890123456789",
  );
  // Mailbox thread rows can surface a different latest-message id than the
  // draft's own message id — the thread id still resolves the draft.
  assert.equal(
    resolveDraftId(lookup, { id: "some-other-message", threadId: "198068880000aaaa" }),
    "r-9876543210987654321",
  );
  assert.equal(resolveDraftId(lookup, { id: "unknown", threadId: "unknown" }), null);
});

test("removeDraftFromList drops one draft and leaves error entries unchanged", () => {
  const patched = removeDraftFromList(okDraftList, "r-1234567890123456789");

  assert.equal(patched?.status, "ok");

  if (patched?.status !== "ok") {
    return;
  }

  assert.deepEqual(
    patched.data.drafts.map((draft) => draft.draftId),
    ["r-9876543210987654321"],
  );
  assert.equal(removeDraftFromList(errorDraftList, "r-1234567890123456789"), errorDraftList);
  assert.equal(removeDraftFromList(okDraftList, "unknown-draft"), okDraftList);
  assert.equal(removeDraftFromList(undefined, "r-1234567890123456789"), undefined);
});

test("getDraftThreadId resolves the thread the draft lives in", () => {
  assert.equal(getDraftThreadId(okDraftList, "r-9876543210987654321"), "198068880000aaaa");
  assert.equal(getDraftThreadId(okDraftList, "unknown-draft"), null);
  assert.equal(getDraftThreadId(errorDraftList, "r-9876543210987654321"), null);
  assert.equal(getDraftThreadId(undefined, "r-9876543210987654321"), null);
});
