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

const { handleGmailPushPayload, toMailMessage } = await import("./mailbox-service");
const { mailErrors } = await import("./errors");
const { getMailboxOutputSchema } = await import("./contracts");

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

test("maps real-shaped Gmail HTML message details into mailbox output", () => {
  const message = toMailMessage(createHtmlGmailMessage(), createLabelMap());

  assert.equal(message.html, "<p>Hello <strong>Pranav</strong></p>");
  assert.equal(message.text, "Hello Pranav");
  assert.equal(message.snippet, "Hello &lt;strong&gt;Pranav&lt;/strong&gt;");
  assert.equal(message.subject, "HTML hello");
  assert.equal(message.email, "sender@example.com");
  assert.equal(message.name, "Sender Name");
  assert.deepEqual(message.labels, ["important"]);
  assert.equal(message.read, false);

  assertMailboxMessageParses(message);
});

test("maps real-shaped plain Gmail message details without HTML", () => {
  const message = toMailMessage(createPlainGmailMessage(), createLabelMap());

  assert.equal(message.html, undefined);
  assert.equal(message.text, "Plain body from Gmail.");
  assert.equal(message.snippet, "Plain body from Gmail.");
  assert.equal(message.subject, "Plain hello");
  assert.equal(message.email, "plain@example.com");
  assert.equal(message.name, "plain@example.com");
  assert.deepEqual(message.labels, []);
  assert.equal(message.read, true);

  assertMailboxMessageParses(message);
});

test("maps nested real-shaped Gmail HTML message details", () => {
  const message = toMailMessage(createNestedHtmlGmailMessage(), createLabelMap());

  assert.equal(message.html, "<div>Nested HTML body</div>");
  assert.equal(message.snippet, "Nested HTML body");
  assert.equal(message.text, "Nested HTML body");
  assert.equal(message.subject, "Nested hello");
  assert.deepEqual(message.labels, []);

  assertMailboxMessageParses(message);
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

function createHtmlGmailMessage() {
  return {
    historyId: "12345",
    id: "18c2f5f6c5f9f001",
    internalDate: "1760184330000",
    labelIds: ["INBOX", "UNREAD", "Label_Important"],
    payload: {
      headers: [
        { name: "From", value: "Sender Name <sender@example.com>" },
        { name: "Subject", value: "HTML hello" },
        { name: "Date", value: "Sat, 13 Jun 2026 10:45:30 +0530" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        {
          body: { data: encodeGmailBody("Hello Pranav"), size: 12 },
          filename: "",
          headers: [{ name: "Content-Type", value: "text/plain; charset=UTF-8" }],
          mimeType: "text/plain",
          partId: "0",
        },
        {
          body: {
            data: encodeGmailBody("<p>Hello <strong>Pranav</strong></p>"),
            size: 38,
          },
          filename: "",
          headers: [{ name: "Content-Type", value: "text/html; charset=UTF-8" }],
          mimeType: "text/html",
          partId: "1",
        },
      ],
    },
    sizeEstimate: 2048,
    snippet: "Hello &lt;strong&gt;Pranav&lt;/strong&gt;",
    threadId: "18c2f5f6c5f9f001",
  };
}

function createPlainGmailMessage() {
  return {
    historyId: "12346",
    id: "18c2f5f6c5f9f002",
    internalDate: "1760184390000",
    labelIds: ["INBOX"],
    payload: {
      body: { data: encodeGmailBody("Plain body from Gmail."), size: 22 },
      headers: [
        { name: "From", value: "plain@example.com" },
        { name: "Subject", value: "Plain hello" },
        { name: "Date", value: "Sat, 13 Jun 2026 10:46:30 +0530" },
      ],
      mimeType: "text/plain",
    },
    sizeEstimate: 1024,
    snippet: "Plain body from Gmail.",
    threadId: "18c2f5f6c5f9f002",
  };
}

function createNestedHtmlGmailMessage() {
  return {
    historyId: "12347",
    id: "18c2f5f6c5f9f003",
    internalDate: "1760184450000",
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Nested Sender <nested@example.com>" },
        { name: "Subject", value: "Nested hello" },
        { name: "Date", value: "Sat, 13 Jun 2026 10:47:30 +0530" },
      ],
      mimeType: "multipart/mixed",
      parts: [
        {
          body: { size: 0 },
          filename: "",
          headers: [{ name: "Content-Type", value: "multipart/alternative" }],
          mimeType: "multipart/alternative",
          partId: "0",
          parts: [
            {
              body: { data: encodeGmailBody("Nested HTML body"), size: 16 },
              filename: "",
              headers: [{ name: "Content-Type", value: "text/plain; charset=UTF-8" }],
              mimeType: "text/plain",
              partId: "0.0",
            },
            {
              body: { data: encodeGmailBody("<div>Nested HTML body</div>"), size: 27 },
              filename: "",
              headers: [{ name: "Content-Type", value: "text/html; charset=UTF-8" }],
              mimeType: "text/html",
              partId: "0.1",
            },
          ],
        },
      ],
    },
    sizeEstimate: 1536,
    snippet: "Nested HTML body",
    threadId: "18c2f5f6c5f9f003",
  };
}

function createLabelMap() {
  return new Map([
    ["INBOX", createLabel("INBOX", "INBOX", "system")],
    ["UNREAD", createLabel("UNREAD", "UNREAD", "system")],
    ["Label_Important", createLabel("Label_Important", "Important", "user")],
  ]);
}

function createLabel(id: string, name: string, type: "system" | "user") {
  return {
    id,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
    name,
    type,
  };
}

function assertMailboxMessageParses(message: ReturnType<typeof toMailMessage>) {
  assert.equal(
    getMailboxOutputSchema.safeParse({
      data: {
        account: { email: "demo-user@example.com", label: "Gmail" },
        counts: {
          archive: 0,
          drafts: 0,
          forums: 0,
          inbox: 1,
          junk: 0,
          promotions: 0,
          sent: 0,
          shopping: 0,
          social: 0,
          trash: 0,
          unread: 0,
          updates: 0,
        },
        messages: [message],
        source: "gmail",
      },
      status: "ok",
    }).success,
    true,
  );
}

function encodeGmailBody(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}
