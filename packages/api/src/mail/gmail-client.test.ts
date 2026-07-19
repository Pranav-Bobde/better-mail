import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Effect } from "effect";

import { mailErrors } from "./errors";
import { GmailClient } from "./gmail-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Discharges the GmailClient requirement with the real service layer. Consumers
// obtain the service via `yield* GmailClient` exactly as later mail sub-phases do.
function provideGmailClient<A, E>(effect: Effect.Effect<A, E, GmailClient>) {
  return Effect.provide(effect, GmailClient.layer);
}

test("GmailClient.getProfile parses the Gmail profile and forwards the bearer token", async () => {
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

  const profile = await Effect.runPromise(
    provideGmailClient(
      Effect.gen(function* () {
        const client = yield* GmailClient;
        return yield* client.getProfile("read-token", "me");
      }),
    ),
  );

  assert.equal(profile.emailAddress, "demo-user@example.com");
  const request = mutableRequests[0];
  assert.ok(request);
  assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
  assert.equal(request.headers.get("authorization"), "Bearer read-token");
});

test("GmailClient.getProfile surfaces the catalog EvlogError in the error channel", async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 500 } }, { status: 500 });

  const error = await Effect.runPromise(
    Effect.flip(
      provideGmailClient(
        Effect.gen(function* () {
          const client = yield* GmailClient;
          return yield* client.getProfile("read-token", "me");
        }),
      ),
    ),
  );

  assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_FAILED.code);
});

test("GmailClient.getProfile fails with an invalid-response EvlogError when parsing fails", async () => {
  globalThis.fetch = async () => Response.json({ historyId: "176001" });

  const error = await Effect.runPromise(
    Effect.flip(
      provideGmailClient(
        Effect.gen(function* () {
          const client = yield* GmailClient;
          return yield* client.getProfile("read-token", "me");
        }),
      ),
    ),
  );

  assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_RESPONSE_INVALID.code);
});

test("GmailClient.listLabels returns the parsed labels array", async () => {
  globalThis.fetch = async () =>
    Response.json({
      labels: [{ id: "INBOX", name: "INBOX", type: "system" }],
    });

  const labels = await Effect.runPromise(
    provideGmailClient(
      Effect.gen(function* () {
        const client = yield* GmailClient;
        return yield* client.listLabels("read-token", "me");
      }),
    ),
  );

  assert.equal(labels.length, 1);
  assert.equal(labels[0]?.id, "INBOX");
});

test("GmailClient.getThreadIfExists resolves null on a Gmail 404", async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 404 } }, { status: 404 });

  const thread = await Effect.runPromise(
    provideGmailClient(
      Effect.gen(function* () {
        const client = yield* GmailClient;
        return yield* client.getThreadIfExists("read-token", "me", "missing-thread");
      }),
    ),
  );

  assert.equal(thread, null);
});

test("GmailClient.sendMessage posts the raw MIME payload and parses the send response", async () => {
  const mutableRequests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    mutableRequests.push(new Request(input, init));
    return Response.json({
      id: "sent-message-id",
      labelIds: ["SENT"],
      threadId: "sent-thread-id",
    });
  };

  const sent = await Effect.runPromise(
    provideGmailClient(
      Effect.gen(function* () {
        const client = yield* GmailClient;
        return yield* client.sendMessage({ accessToken: "send-token", raw: "cmF3", userId: "me" });
      }),
    ),
  );

  assert.equal(sent.id, "sent-message-id");
  assert.equal(sent.threadId, "sent-thread-id");
  const request = mutableRequests[0];
  assert.ok(request);
  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(request.headers.get("authorization"), "Bearer send-token");
});
