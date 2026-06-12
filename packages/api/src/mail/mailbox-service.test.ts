import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";

const stateDirectory = await mkdtemp(join(tmpdir(), "code-main-gmail-push-test-"));
const stateFilePath = join(stateDirectory, "state.json");
const pushToken = "test-push-token";

process.env.APP_URL = "http://localhost:4000";
process.env.BETTER_AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.BETTER_AUTH_URL = "http://localhost:4000";
process.env.CORS_ORIGIN = "http://localhost:4000";
process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/test_db";
process.env.GMAIL_DEMO_STATE_FILE = stateFilePath;
process.env.GMAIL_DEMO_USER = "demo-user@example.com";
process.env.GMAIL_OAUTH_CLIENT_ID = "test-gmail-client-id";
process.env.GMAIL_OAUTH_CLIENT_SECRET = "test-gmail-client-secret";
process.env.GMAIL_OAUTH_REFRESH_TOKEN = "test-gmail-refresh-token";
process.env.GMAIL_PUBSUB_TOPIC = "projects/sample/topics/mail-push";
process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN = pushToken;
process.env.GMAIL_WATCH_LABEL_IDS = "INBOX";
process.env.OPENROUTER_API_KEY = "sk-or-v1-real-shaped-test";
process.env.LANGSMITH_API_KEY = "lsv2_pt_real-shaped-test";
process.env.LANGSMITH_TRACING = "true";
process.env.LANGSMITH_PROJECT = "ai-email-client";
process.env.OPENROUTER_MODEL = "openai/gpt-5.4-nano";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
process.env.NODE_ENV = "test";

const { handleGmailPushPayload } = await import("./mailbox-service");
const { mailErrors } = await import("./errors");

after(async () => {
  await rm(stateDirectory, { force: true, recursive: true });
});

test("accepts Google Pub/Sub wrapped Gmail notification with Base64URL data", async () => {
  const result = await handleGmailPushPayload(
    createPushPayload({ historyId: "9876543210" }),
    pushToken,
  );

  assert.deepEqual(result, {
    data: {
      emailAddress: "user@example.com",
      historyId: "9876543210",
    },
    status: "ok",
  });
});

test("normalizes numeric Gmail history id from live Pub/Sub payloads", async () => {
  const result = await handleGmailPushPayload(
    createPushPayload({ historyId: 9876543210 }),
    pushToken,
  );

  assert.deepEqual(result, {
    data: {
      emailAddress: "user@example.com",
      historyId: "9876543210",
    },
    status: "ok",
  });

  const state = JSON.parse(await readFile(stateFilePath, "utf8"));
  assert.equal(state.historyId, "9876543210");
});

test("rejects invalid Gmail push token without writing state", async () => {
  await assert.rejects(
    () => handleGmailPushPayload(createPushPayload({ historyId: "9876543210" }), "wrong-token"),
    (error: unknown) => {
      const errorCode = (error as { readonly code?: unknown }).code;
      return (
        error instanceof Error &&
        typeof errorCode === "string" &&
        errorCode === mailErrors.GMAIL_PUBSUB_PUSH_INVALID.code
      );
    },
  );
});

function createPushPayload(input: { readonly historyId: number | string }) {
  const notification = {
    emailAddress: "user@example.com",
    historyId: input.historyId,
  };

  return {
    message: {
      data: Buffer.from(JSON.stringify(notification), "utf8").toString("base64url"),
      messageId: "pubsub-message-1",
      publishTime: "2026-06-11T19:13:55.749Z",
    },
    subscription: "projects/example/subscriptions/gmail-push",
  };
}
