import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.APP_URL = "http://localhost:4000";
process.env.BETTER_AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.BETTER_AUTH_URL = "http://localhost:4000";
process.env.CORS_ORIGIN = "http://localhost:4000";
process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/test_db";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-google-client-secret";
process.env.OPENROUTER_API_KEY = "sk-or-v1-real-shaped-test";
process.env.LANGSMITH_API_KEY = "lsv2_pt_real-shaped-test";
process.env.LANGSMITH_TRACING = "true";
process.env.LANGSMITH_PROJECT = "ai-email-client";
process.env.OPENROUTER_MODEL = "openai/gpt-5.4-nano";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
process.env.NODE_ENV = "test";

const { getMailboxData, sendMailboxMessage, toMailMessage } = await import("./mailbox-service");
const { mailErrors } = await import("./errors");
const { getMailboxOutputSchema } = await import("./contracts");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("requires a signed-in user before fetching mailbox data", async () => {
  globalThis.fetch = async () => {
    throw new Error("fetch should not run without auth");
  };

  await assert.rejects(
    () =>
      getMailboxData(
        {
          query: "",
          view: "all",
        },
        {
          getGoogleAccessToken: null,
          session: null,
        },
      ),
    (error: unknown) => hasMailErrorCode(error, mailErrors.AUTH_REQUIRED.code),
  );
});

test("fetches Gmail mailbox with the Better Auth Google access token", async () => {
  const mutableRequests: Request[] = [];
  globalThis.fetch = createMailboxReadFetchMock(mutableRequests);

  const result = await getMailboxData(
    {
      query: "from:sender",
      view: "unread",
    },
    createSignedInGmailContext("better-auth-read-token", [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.data.account.email, "demo-user@example.com");
  assert.equal(result.data.source, "gmail");
  assert.equal(result.data.messages.length, 1);
  assert.equal(result.data.messages[0]?.subject, "HTML hello");
  assert.equal(result.data.counts.inbox, 11);
  assert.equal(result.data.counts.unread, 5);
  assert.equal(result.data.counts.archive, 7);
  assert.equal(result.data.counts.shopping, 3);
  assert.ok(mutableRequests.length > 0);
});

test("sends Gmail with the Better Auth Google access token", async () => {
  const mutableRequests: Request[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    mutableRequests.push(request);

    if (request.url.includes("oauth2.googleapis.com")) {
      throw new Error("demo refresh-token flow should not run");
    }

    return Response.json({
      id: "sent-message-id",
      labelIds: ["SENT"],
      threadId: "sent-thread-id",
    });
  };

  const result = await sendMailboxMessage(
    {
      body: "Real-shaped test body",
      subject: "Real-shaped test subject",
      to: "receiver@example.com",
    },
    createSignedInGmailContext("better-auth-access-token"),
  );

  assert.deepEqual(result, {
    data: {
      messageId: "sent-message-id",
      threadId: "sent-thread-id",
    },
    status: "ok",
  });

  const sendRequest = mutableRequests[0];
  assert.ok(sendRequest);
  assert.equal(sendRequest.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(sendRequest.headers.get("authorization"), "Bearer better-auth-access-token");
});

test("requires the Gmail send scope before sending mail", async () => {
  globalThis.fetch = async () => {
    throw new Error("fetch should not run without Gmail send scope");
  };

  await assert.rejects(
    () =>
      sendMailboxMessage(
        {
          body: "Real-shaped test body",
          subject: "Real-shaped test subject",
          to: "receiver@example.com",
        },
        createSignedInGmailContext("better-auth-access-token", [
          "https://www.googleapis.com/auth/gmail.readonly",
        ]),
      ),
    (error: unknown) => hasMailErrorCode(error, mailErrors.GMAIL_SCOPE_MISSING.code),
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

function createUserLabels() {
  return [createLabel("Label_Important", "Important", "user")];
}

function createMailboxReadFetchMock(mutableRequests: Request[]) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    mutableRequests.push(request);
    assert.equal(request.headers.get("authorization"), "Bearer better-auth-read-token");

    return createMailboxReadResponse(request);
  };
}

function createMailboxReadResponse(request: Request) {
  const url = new URL(request.url);
  const exactResponse = createExactMailboxReadResponse(url);
  if (exactResponse) {
    return exactResponse;
  }

  if (url.pathname === "/gmail/v1/users/me/messages") {
    return createMailboxListResponse(url);
  }

  return createGmailLabelCountResponseFromUrl(url, request.url);
}

function createExactMailboxReadResponse(url: URL) {
  const exactResponses = new Map<string, () => Response>([
    ["/gmail/v1/users/me/profile", () => Response.json(createGmailProfileResponse())],
    ["/gmail/v1/users/me/labels", () => Response.json(createGmailLabelsResponse())],
    [
      "/gmail/v1/users/me/messages/18c2f5f6c5f9f001",
      () => Response.json(createGmailMessageDetailResponse(url)),
    ],
  ]);

  return exactResponses.get(url.pathname)?.();
}

function createGmailLabelCountResponseFromUrl(url: URL, requestUrl: string) {
  const labelId = url.pathname.match(/^\/gmail\/v1\/users\/me\/labels\/([^/]+)$/)?.[1];
  if (!labelId) {
    throw new Error(`Unexpected Gmail request: ${requestUrl}`);
  }

  return Response.json(createGmailLabelCountResponse(labelId));
}

function createGmailProfileResponse() {
  return {
    emailAddress: "demo-user@example.com",
    historyId: "176001",
    messagesTotal: 42,
    threadsTotal: 24,
  };
}

function createGmailLabelsResponse() {
  return {
    labels: [...systemLabelIds.map((id) => createLabel(id, id, "system")), ...createUserLabels()],
  };
}

function createGmailMessageDetailResponse(url: URL) {
  assert.equal(url.searchParams.get("format"), "full");
  return createHtmlGmailMessage();
}

function createMailboxListResponse(url: URL) {
  assert.equal(url.searchParams.get("includeSpamTrash"), "false");
  const query = url.searchParams.get("q");

  if (query === "from:sender is:unread") {
    assert.equal(url.searchParams.get("maxResults"), "20");
    assert.deepEqual(url.searchParams.getAll("labelIds"), ["INBOX", "UNREAD"]);
    return Response.json({
      messages: [{ id: "18c2f5f6c5f9f001", threadId: "18c2f5f6c5f9f001" }],
      resultSizeEstimate: 1,
    });
  }

  assert.equal(url.searchParams.get("maxResults"), "1");
  return Response.json({
    resultSizeEstimate: query === "-in:inbox -in:sent -in:drafts -in:trash -in:spam" ? 7 : 3,
  });
}

function createGmailLabelCountResponse(labelId: string) {
  return {
    ...createLabel(labelId, labelId, "system"),
    messagesTotal: getSystemLabelMessageTotal(labelId),
    messagesUnread: labelId === "UNREAD" ? 5 : 0,
  };
}

function getSystemLabelMessageTotal(labelId: string) {
  if (labelId === "INBOX") {
    return 11;
  }

  if (labelId === "UNREAD") {
    return 5;
  }

  return 2;
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

const systemLabelIds = [
  "DRAFT",
  "CATEGORY_FORUMS",
  "INBOX",
  "SPAM",
  "CATEGORY_PROMOTIONS",
  "SENT",
  "CATEGORY_SOCIAL",
  "TRASH",
  "UNREAD",
  "CATEGORY_UPDATES",
] as const;

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

function hasMailErrorCode(error: unknown, code: string) {
  const errorCode = (error as { readonly code?: unknown }).code;
  return error instanceof Error && typeof errorCode === "string" && errorCode === code;
}

function createSignedInGmailContext(
  accessToken: string,
  scopes: readonly string[] = [
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],
) {
  return {
    getGoogleAccessToken: async () => ({
      accessToken,
      scopes,
    }),
    session: {
      session: {
        expiresAt: new Date("2026-06-13T12:00:00.000Z"),
        id: "session-id",
        token: "session-token",
        userId: "user-id",
      },
      user: {
        email: "demo-user@example.com",
        emailVerified: true,
        id: "user-id",
        image: null,
        name: "Demo User",
      },
    },
  };
}
