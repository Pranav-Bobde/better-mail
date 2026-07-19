import assert from "node:assert/strict";

import { Effect } from "effect";
import { afterEach, layer } from "@effect/vitest";

import { mailErrors } from "./errors";
import { GmailClient } from "./gmail-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// The GmailClient requirement is discharged once for every test in this block by
// the real service layer. Consumers obtain the service via `yield* GmailClient`
// exactly as later mail sub-phases do.
layer(GmailClient.layer)("GmailClient", (it) => {
  it.effect("getProfile parses the Gmail profile and forwards the bearer token", () =>
    Effect.gen(function* () {
      const mutableRequests: Request[] = [];
      globalThis.fetch = async (input, init) => {
        mutableRequests.push(new Request(input, init));
        return Response.json({
          emailAddress: "demo-user@example.com",
          historyId: "176001",
          messagesTotal: 42,
          threadsTotal: 24,
        });
      };

      const client = yield* GmailClient;
      const profile = yield* client.getProfile("read-token", "me");

      assert.equal(profile.emailAddress, "demo-user@example.com");
      const request = mutableRequests[0];
      assert.ok(request);
      assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
      assert.equal(request.headers.get("authorization"), "Bearer read-token");
    }),
  );

  it.effect("getProfile surfaces the catalog EvlogError in the error channel", () =>
    Effect.gen(function* () {
      globalThis.fetch = async () => Response.json({ error: { code: 500 } }, { status: 500 });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.getProfile("read-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_FAILED.code);
    }),
  );

  it.effect("getProfile fails with an invalid-response EvlogError when parsing fails", () =>
    Effect.gen(function* () {
      globalThis.fetch = async () => Response.json({ historyId: "176001" });

      const client = yield* GmailClient;
      const error = yield* Effect.flip(client.getProfile("read-token", "me"));

      assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_RESPONSE_INVALID.code);
    }),
  );

  it.effect("listLabels returns the parsed labels array", () =>
    Effect.gen(function* () {
      globalThis.fetch = async () =>
        Response.json({
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
      globalThis.fetch = async () => Response.json({ error: { code: 404 } }, { status: 404 });

      const client = yield* GmailClient;
      const thread = yield* client.getThreadIfExists("read-token", "me", "missing-thread");

      assert.equal(thread, null);
    }),
  );

  it.effect("sendMessage posts the raw MIME payload and parses the send response", () =>
    Effect.gen(function* () {
      const mutableRequests: Request[] = [];
      globalThis.fetch = async (input, init) => {
        mutableRequests.push(new Request(input, init));
        return Response.json({
          id: "sent-message-id",
          labelIds: ["SENT"],
          threadId: "sent-thread-id",
        });
      };

      const client = yield* GmailClient;
      const sent = yield* client.sendMessage({
        accessToken: "send-token",
        raw: "cmF3",
        userId: "me",
      });

      assert.equal(sent.id, "sent-message-id");
      assert.equal(sent.threadId, "sent-thread-id");
      const request = mutableRequests[0];
      assert.ok(request);
      assert.equal(request.method, "POST");
      assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
      assert.equal(request.headers.get("authorization"), "Bearer send-token");
    }),
  );
});
