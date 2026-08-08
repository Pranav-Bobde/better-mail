import assert from "node:assert/strict";

import { Effect } from "effect";
import { afterEach, layer } from "@effect/vitest";

import { mailErrors } from "./errors";
import { GmailClient } from "./gmail-client";
import {
  assertGmailRequest,
  captureGmailFetch,
  createGmailDraftResponse,
  createGmailModifyThreadResponse,
  gmailDraftTestIds,
  mockGmailFailureResponse,
  mockGmailJsonResponse,
} from "./mail-test-support";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const modifyThreadInput = {
  accessToken: "modify-token",
  removeLabelIds: ["UNREAD"],
  threadId: gmailDraftTestIds.threadId,
  userId: "me",
} as const;

const createDraftInput = {
  accessToken: "draft-token",
  raw: "cmF3LWRyYWZ0",
  userId: "me",
} as const;

const updateDraftInput = {
  accessToken: "draft-token",
  draftId: gmailDraftTestIds.draftId,
  raw: "dXBkYXRlZC1kcmFmdA",
  userId: "me",
} as const;

const deleteDraftInput = {
  accessToken: "draft-token",
  draftId: gmailDraftTestIds.draftId,
  userId: "me",
} as const;

// The GmailClient requirement is discharged once for every test in this block by
// the real service layer. Consumers obtain the service via `yield* GmailClient`
// exactly as later mail sub-phases do.
layer(GmailClient.layer)("GmailClient", (it) => {
  it.effect("getProfile parses the Gmail profile and forwards the bearer token", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch({
        emailAddress: "demo-user@example.com",
        historyId: "176001",
        messagesTotal: 42,
        threadsTotal: 24,
      });

      const client = yield* GmailClient;
      const profile = yield* client.getProfile("read-token", "me");

      assert.equal(profile.emailAddress, "demo-user@example.com");
      assertGmailRequest(captured.requests[0], {
        bearer: "read-token",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      });
    }),
  );

  it.effect("getProfile surfaces the catalog EvlogError in the error channel", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(500);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.getProfile("read-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_FAILED.code);
    }),
  );

  it.effect("getProfile fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({ historyId: "176001" });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.getProfile("read-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_RESPONSE_INVALID.code);
    }),
  );

  it.effect("listLabels returns the parsed labels array", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({
        labels: [{ id: "INBOX", name: "INBOX", type: "system" }],
      });

      const client = yield* GmailClient;
      const labels = yield* client.listLabels("read-token", "me");

      assert.equal(labels.length, 1);
      assert.equal(labels[0]?.id, "INBOX");
    }),
  );

  it.effect("getThreadIfExists resolves null on a Gmail 404", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(404);

      const client = yield* GmailClient;
      const thread = yield* client.getThreadIfExists("read-token", "me", "missing-thread");

      assert.equal(thread, null);
    }),
  );

  it.effect("modifyThread posts only the provided label id arrays and parses the response", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailModifyThreadResponse());

      const client = yield* GmailClient;
      const modified = yield* client.modifyThread(modifyThreadInput);

      assert.equal(modified.id, gmailDraftTestIds.threadId);
      assertGmailRequest(captured.requests[0], {
        bearer: "modify-token",
        method: "POST",
        url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}/modify`,
      });
      assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), { removeLabelIds: ["UNREAD"] });
    }),
  );

  it.effect("modifyThread sends addLabelIds when marking a thread unread", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailModifyThreadResponse(["INBOX", "UNREAD"]));

      const client = yield* GmailClient;
      yield* client.modifyThread({
        accessToken: "modify-token",
        addLabelIds: ["UNREAD"],
        threadId: gmailDraftTestIds.threadId,
        userId: "me",
      });

      assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), { addLabelIds: ["UNREAD"] });
    }),
  );

  it.effect("modifyThread surfaces the catalog EvlogError on a Gmail failure", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(403);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.modifyThread(modifyThreadInput));

      assert.equal(error.code, mailErrors.GMAIL_MODIFY_THREAD_FAILED.code);
    }),
  );

  it.effect("modifyThread fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({ historyId: "987660" });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.modifyThread(modifyThreadInput));

      assert.equal(error.code, mailErrors.GMAIL_MODIFY_THREAD_RESPONSE_INVALID.code);
    }),
  );

  it.effect("createDraft posts the draft message payload and parses the draft response", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailDraftResponse());

      const client = yield* GmailClient;
      const draft = yield* client.createDraft({
        ...createDraftInput,
        threadId: gmailDraftTestIds.threadId,
      });

      assert.equal(draft.id, gmailDraftTestIds.draftId);
      assert.equal(draft.message.id, gmailDraftTestIds.messageId);
      assert.equal(draft.message.threadId, gmailDraftTestIds.threadId);
      assertGmailRequest(captured.requests[0], {
        bearer: "draft-token",
        method: "POST",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      });
      assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), {
        message: { raw: "cmF3LWRyYWZ0", threadId: gmailDraftTestIds.threadId },
      });
    }),
  );

  it.effect("getDraft resolves the draft message and thread before deletion", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailDraftResponse());

      const client = yield* GmailClient;
      const draft = yield* client.getDraft("draft-token", "me", gmailDraftTestIds.draftId);

      assert.equal(draft.id, gmailDraftTestIds.draftId);
      assert.equal(draft.message.threadId, gmailDraftTestIds.threadId);
      assertGmailRequest(captured.requests[0], {
        bearer: "draft-token",
        method: "GET",
        url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
      });
    }),
  );

  it.effect("getDraftIfExists resolves null when Gmail reports an already-deleted draft", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(404);

      const client = yield* GmailClient;
      const draft = yield* client.getDraftIfExists("draft-token", "me", gmailDraftTestIds.draftId);

      assert.equal(draft, null);
    }),
  );

  it.effect("createDraft omits threadId from the message body when absent", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailDraftResponse());

      const client = yield* GmailClient;
      yield* client.createDraft(createDraftInput);

      assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), {
        message: { raw: "cmF3LWRyYWZ0" },
      });
    }),
  );

  it.effect("createDraft surfaces the catalog EvlogError on a Gmail failure", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(403);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.createDraft(createDraftInput));

      assert.equal(error.code, mailErrors.GMAIL_CREATE_DRAFT_FAILED.code);
    }),
  );

  it.effect("createDraft fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({ id: gmailDraftTestIds.draftId });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.createDraft(createDraftInput));

      assert.equal(error.code, mailErrors.GMAIL_CREATE_DRAFT_RESPONSE_INVALID.code);
    }),
  );

  it.effect("updateDraft puts the draft message payload to the draft id path", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch(createGmailDraftResponse());

      const client = yield* GmailClient;
      const draft = yield* client.updateDraft({
        ...updateDraftInput,
        threadId: gmailDraftTestIds.threadId,
      });

      assert.equal(draft.id, gmailDraftTestIds.draftId);
      assert.equal(draft.message.id, gmailDraftTestIds.messageId);
      assertGmailRequest(captured.requests[0], {
        bearer: "draft-token",
        method: "PUT",
        url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
      });
      assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), {
        message: { raw: "dXBkYXRlZC1kcmFmdA", threadId: gmailDraftTestIds.threadId },
      });
    }),
  );

  it.effect("updateDraft surfaces the catalog EvlogError on a Gmail failure", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(404);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.updateDraft(updateDraftInput));

      assert.equal(error.code, mailErrors.GMAIL_UPDATE_DRAFT_FAILED.code);
    }),
  );

  it.effect("updateDraft fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({ message: {} });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.updateDraft(updateDraftInput));

      assert.equal(error.code, mailErrors.GMAIL_UPDATE_DRAFT_RESPONSE_INVALID.code);
    }),
  );

  it.effect("deleteDraft issues a DELETE and resolves the draft id on an empty 204", () =>
    Effect.gen(function* () {
      const mutableRequests: Request[] = [];
      globalThis.fetch = async (input, init) => {
        mutableRequests.push(new Request(input, init));
        // drafts.delete succeeds with 204 No Content and an empty body.
        return new Response(null, { status: 204 });
      };

      const client = yield* GmailClient;
      const deleted = yield* client.deleteDraft(deleteDraftInput);

      assert.deepEqual(deleted, { draftId: gmailDraftTestIds.draftId });
      assertGmailRequest(mutableRequests[0], {
        bearer: "draft-token",
        method: "DELETE",
        url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
      });
    }),
  );

  it.effect("deleteDraft surfaces the catalog EvlogError on a Gmail failure", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(404);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.deleteDraft(deleteDraftInput));

      assert.equal(error.code, mailErrors.GMAIL_DELETE_DRAFT_FAILED.code);
    }),
  );

  it.effect("listDrafts returns the parsed drafts array", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch({
        drafts: [
          createGmailDraftResponse(),
          {
            id: "r-2230337403573001600",
            message: { id: "18c2f5f6c5f9f102", threadId: "18c2f5f6c5f9f102" },
          },
        ],
        resultSizeEstimate: 2,
      });

      const client = yield* GmailClient;
      const drafts = yield* client.listDrafts("draft-token", "me");

      assert.equal(drafts.length, 2);
      assert.equal(drafts[0]?.id, gmailDraftTestIds.draftId);
      assert.equal(drafts[0]?.message.threadId, gmailDraftTestIds.threadId);
      assertGmailRequest(captured.requests[0], {
        bearer: "draft-token",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      });
    }),
  );

  it.effect("listDrafts returns an empty array when Gmail omits the drafts key", () =>
    Effect.gen(function* () {
      // drafts.list omits the drafts key entirely for an empty mailbox.
      mockGmailJsonResponse({ resultSizeEstimate: 0 });

      const client = yield* GmailClient;
      const drafts = yield* client.listDrafts("draft-token", "me");

      assert.deepEqual(drafts, []);
    }),
  );

  it.effect("listDrafts surfaces the catalog EvlogError on a Gmail failure", () =>
    Effect.gen(function* () {
      mockGmailFailureResponse(500);

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.listDrafts("draft-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_LIST_DRAFTS_FAILED.code);
    }),
  );

  it.effect("listDrafts fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      mockGmailJsonResponse({ drafts: [{ id: 12345 }] });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.listDrafts("draft-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_LIST_DRAFTS_RESPONSE_INVALID.code);
    }),
  );

  it.effect("sendMessage posts the raw MIME payload and parses the send response", () =>
    Effect.gen(function* () {
      const captured = captureGmailFetch({
        id: "sent-message-id",
        labelIds: ["SENT"],
        threadId: "sent-thread-id",
      });

      const client = yield* GmailClient;
      const sent = yield* client.sendMessage({
        accessToken: "send-token",
        raw: "cmF3",
        userId: "me",
      });

      assert.equal(sent.id, "sent-message-id");
      assert.equal(sent.threadId, "sent-thread-id");
      assertGmailRequest(captured.requests[0], {
        bearer: "send-token",
        method: "POST",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      });
    }),
  );
});
