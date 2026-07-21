import assert from "node:assert/strict";

import { afterEach, test } from "vitest";

import { Effect, Layer, Result, Schema } from "effect";
import type { Context } from "effect";
import { EvlogError } from "evlog";
import type { GmailClient as GmailClientIdentifier } from "./gmail-client";
import type { MailboxService as MailboxServiceIdentifier } from "./mailbox-service";

import { setRequiredTestEnv } from "../test-env";

setRequiredTestEnv();

const { MailboxService, getMailboxData, getThreadData, sendMailboxMessage, toMailMessage } =
  await import("./mailbox-service");
const { GmailClient } = await import("./gmail-client");
const { mailErrors } = await import("./errors");
const { getMailboxOutputSchema, getThreadOutputSchema } = await import("./contracts");
const { gmailThreadResponseSchema } = await import("./gmail-schemas");

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
  assert.equal(result.data.counts.inboxUnread, 5);
  assert.equal(result.data.counts.drafts, 2);
  assert.ok(mutableRequests.length > 0);
});

test("MailboxService fetches mailbox data through the injected GmailClient service", async () => {
  globalThis.fetch = async () => {
    throw new Error("fetch should not run when GmailClient is injected");
  };

  const mutableCalls: string[] = [];
  const mailboxData = await runWithMailboxService(
    createInjectedGmailClientLayer(mutableCalls),
    (service) =>
      service.getMailboxData(
        {
          query: "project",
          view: "unread",
        },
        createSignedInGmailContext("better-auth-read-token", [
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly",
        ]),
      ),
  );

  assert.equal(mailboxData.status, "ok");
  assert.equal(mailboxData.data.account.email, "demo-user@example.com");
  assert.equal(mailboxData.data.messages[0]?.subject, "HTML hello");
  assert.deepEqual(mutableCalls, [
    "getLabel:INBOX",
    "getLabel:DRAFT",
    "getProfile",
    "listLabels",
    "listThreads",
    "getThread:18c2f5f6c5f9f001",
  ]);
});

test("MailboxService surfaces the raw catalog EvlogError from a failing GmailClient", async () => {
  globalThis.fetch = async () => {
    throw new Error("fetch should not run when GmailClient is injected");
  };

  const profileError = mailErrors.GMAIL_GET_PROFILE_FAILED({
    cause: new Error("Gmail profile endpoint returned HTTP 500"),
    internal: { dependencyStatus: 500, userId: "me" },
  });
  const failingLayer = createInjectedGmailClientLayer([], {
    getProfile: () => Effect.fail(profileError),
  });

  const error = await runWithMailboxService(failingLayer, (service) =>
    Effect.flip(
      service.getMailboxData(
        { query: "", view: "all" },
        createSignedInGmailContext("better-auth-read-token", [
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly",
        ]),
      ),
    ),
  );

  // The promise adapters must re-throw the raw catalog error, not a FiberFailure
  // wrapper, so handler envelope conversion keeps seeing the original code.
  assert.ok(error instanceof EvlogError);
  assert.equal(error.code, mailErrors.GMAIL_GET_PROFILE_FAILED.code);
});

test("returns one Gmail mailbox row per thread", async () => {
  const mutableRequests: Request[] = [];
  globalThis.fetch = createThreadedMailboxReadFetchMock(mutableRequests);

  const result = await getMailboxData(
    {
      query: "project",
      view: "all",
    },
    createSignedInGmailContext("better-auth-read-token", [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.data.messages.length, 1);

  const row = result.data.messages[0];
  assert.ok(row);
  assert.equal(row.id, "199aa22cc33dd441");
  assert.equal(row.threadId, "199aa11bb22cc330");
  assert.equal(row.subject, "Re: Project kickoff");
  assert.equal(row.date, new Date(1760187930000).toISOString());
  assert.equal(row.read, false);
  assert.ok(
    mutableRequests.some(
      (request) => new URL(request.url).pathname === "/gmail/v1/users/me/threads/199aa11bb22cc330",
    ),
  );
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

test("sends ASCII subjects without changing the raw MIME header value", async () => {
  const rawMimeMessage = await sendMessageAndGetRawMimeMessage({
    body: "Body stays literal",
    subject: "Weekly sync notes",
    to: "receiver@example.com",
  });

  assert.match(rawMimeMessage, /Subject: Weekly sync notes\r\n/);
  assert.equal(rawMimeMessage.includes("=?UTF-8?B?"), false);
});

test("sends emoji subjects as RFC 2047 encoded words", async () => {
  const subject = "Re: 😸 OpenAI goes hard";
  const rawMimeMessage = await sendMessageAndGetRawMimeMessage({
    body: "Body stays literal",
    subject,
    to: "receiver@example.com",
  });

  assert.match(rawMimeMessage, /Subject: =\?UTF-8\?B\?/);
  assert.equal(decodeMimeSubjectHeader(rawMimeMessage), subject);
});

test("sends Devanagari subjects as RFC 2047 encoded words", async () => {
  const subject = "नमस्ते दुनिया परीक्षण विषय";
  const rawMimeMessage = await sendMessageAndGetRawMimeMessage({
    body: "Body stays literal",
    subject,
    to: "receiver@example.com",
  });

  assert.match(rawMimeMessage, /Subject: =\?UTF-8\?B\?/);
  assert.equal(decodeMimeSubjectHeader(rawMimeMessage), subject);
});

test("folds long encoded subjects without splitting encoded words over 75 chars", async () => {
  const subject = Array.from({ length: 25 }, (_, index) => `Part ${index} 😸 नमस्ते`).join(" ");
  const rawMimeMessage = await sendMessageAndGetRawMimeMessage({
    body: "Body stays literal",
    subject,
    to: "receiver@example.com",
  });

  assert.match(rawMimeMessage, /Subject: =\?UTF-8\?B\?.*\r\n =\?UTF-8\?B\?/);
  assert.equal(decodeMimeSubjectHeader(rawMimeMessage), subject);

  const encodedWords = getSubjectEncodedWords(rawMimeMessage);
  assert.ok(encodedWords.length > 1);
  for (const encodedWord of encodedWords) {
    assert.ok(encodedWord.length <= 75, `${encodedWord.length}: ${encodedWord}`);
  }
});

test("sends body content as untouched raw UTF-8", async () => {
  const body = "Literal body with emoji 😸 and Devanagari नमस्ते.";
  const rawMimeMessage = await sendMessageAndGetRawMimeMessage({
    body,
    subject: "Re: 😸 OpenAI goes hard",
    to: "receiver@example.com",
  });

  assert.match(rawMimeMessage, new RegExp(`\\r\\n\\r\\n${body}$`, "u"));
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

test("fetches Gmail thread with the Better Auth Google access token", async () => {
  const mutableRequests: Request[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    mutableRequests.push(request);
    assert.equal(request.headers.get("authorization"), "Bearer better-auth-thread-token");

    const url = new URL(request.url);
    if (url.pathname === "/gmail/v1/users/me/labels") {
      return Response.json(createGmailLabelsResponse());
    }

    if (url.pathname === "/gmail/v1/users/me/threads/199aa11bb22cc330") {
      assert.equal(url.searchParams.get("format"), "full");
      return Response.json(createGmailThread());
    }

    throw new Error(`Unexpected Gmail request: ${request.url}`);
  };

  const result = await getThreadData(
    {
      threadId: "199aa11bb22cc330",
    },
    createSignedInGmailContext("better-auth-thread-token", [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(
    result.data.messages.map((message) => message.subject),
    ["Project kickoff", "Re: Project kickoff"],
  );
  assert.ok(mutableRequests.length > 0);
});

test("parses a real-shaped Gmail threads.get payload and maps it oldest-to-newest", () => {
  const parsedThread = Schema.decodeUnknownResult(gmailThreadResponseSchema)(createGmailThread());

  assert.equal(Result.isSuccess(parsedThread), true);
  if (!Result.isSuccess(parsedThread)) return;

  const labelById = createLabelMap();
  const messages = parsedThread.success.messages.map((message) =>
    toMailMessage(message, labelById),
  );

  // threads.get returns messages oldest-first; the conversation view relies on
  // this ordering to render the newest message last.
  assert.deepEqual(
    messages.map((message) => message.subject),
    ["Project kickoff", "Re: Project kickoff"],
  );
  assert.deepEqual(
    messages.map((message) => message.email),
    ["sarah@example.com", "demo-user@example.com"],
  );
  // Every message in a thread shares the same Gmail thread id.
  assert.deepEqual(
    messages.map((message) => message.threadId),
    ["199aa11bb22cc330", "199aa11bb22cc330"],
  );

  assert.equal(getThreadOutputSchema.safeParse({ data: { messages }, status: "ok" }).success, true);
});

function createGmailThread() {
  return {
    historyId: "987654",
    id: "199aa11bb22cc330",
    messages: [
      {
        historyId: "987650",
        id: "199aa11bb22cc330",
        internalDate: "1760184330000",
        labelIds: ["INBOX"],
        payload: {
          body: { data: encodeGmailBody("Let's kick off the project on Monday."), size: 37 },
          headers: [
            { name: "From", value: "Sarah Rao <sarah@example.com>" },
            { name: "Subject", value: "Project kickoff" },
            { name: "Date", value: "Sat, 13 Jun 2026 10:45:30 +0530" },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 1024,
        snippet: "Let's kick off the project on Monday.",
        threadId: "199aa11bb22cc330",
      },
      {
        historyId: "987654",
        id: "199aa22cc33dd441",
        internalDate: "1760187930000",
        labelIds: ["SENT"],
        payload: {
          headers: [
            { name: "From", value: "Demo User <demo-user@example.com>" },
            { name: "Subject", value: "Re: Project kickoff" },
            { name: "Date", value: "Sat, 13 Jun 2026 11:45:30 +0530" },
          ],
          mimeType: "multipart/alternative",
          parts: [
            {
              body: { data: encodeGmailBody("Sounds good, see you then."), size: 26 },
              filename: "",
              headers: [{ name: "Content-Type", value: "text/plain; charset=UTF-8" }],
              mimeType: "text/plain",
              partId: "0",
            },
            {
              body: { data: encodeGmailBody("<p>Sounds good, see you then.</p>"), size: 33 },
              filename: "",
              headers: [{ name: "Content-Type", value: "text/html; charset=UTF-8" }],
              mimeType: "text/html",
              partId: "1",
            },
          ],
        },
        sizeEstimate: 2048,
        snippet: "Sounds good, see you then.",
        threadId: "199aa11bb22cc330",
      },
    ],
  };
}

function createGmailThreadWithUnreadMessage() {
  const thread = createGmailThread();
  const firstMessage = thread.messages[0];
  const secondMessage = thread.messages[1];

  assert.ok(firstMessage);
  assert.ok(secondMessage);

  return {
    ...thread,
    messages: [
      {
        ...firstMessage,
        labelIds: ["INBOX", "UNREAD"],
      },
      secondMessage,
    ],
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

function createUserLabels() {
  return [createLabel("Label_Important", "Important", "user")];
}

function createMailboxReadFetchMock(mutableRequests: Request[]) {
  return createAuthorizedMailboxFetchMock(mutableRequests, createMailboxReadResponse);
}

function createThreadedMailboxReadFetchMock(mutableRequests: Request[]) {
  return createAuthorizedMailboxFetchMock(mutableRequests, createThreadedMailboxReadResponse);
}

function createAuthorizedMailboxFetchMock(
  mutableRequests: Request[],
  createResponse: (request: Request) => Response,
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    mutableRequests.push(request);
    assert.equal(request.headers.get("authorization"), "Bearer better-auth-read-token");

    return createResponse(request);
  };
}

async function sendMessageAndGetRawMimeMessage(input: {
  readonly body: string;
  readonly subject: string;
  readonly to: string;
}) {
  let rawMessage = "";

  globalThis.fetch = async (requestInput, init) => {
    const request = new Request(requestInput, init);
    assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(request.headers.get("authorization"), "Bearer better-auth-access-token");

    const payload = JSON.parse(await request.text());
    rawMessage = payload.raw;

    return Response.json({
      id: "sent-message-id",
      labelIds: ["SENT"],
      threadId: "sent-thread-id",
    });
  };

  await sendMailboxMessage(input, createSignedInGmailContext("better-auth-access-token"));

  return Buffer.from(rawMessage, "base64url").toString("utf8");
}

function decodeMimeSubjectHeader(rawMimeMessage: string) {
  const encodedWords = getSubjectEncodedWords(rawMimeMessage);
  const base64Value = encodedWords
    .map((encodedWord) => encodedWord.replace(/^=\?UTF-8\?B\?/, "").replace(/\?=$/, ""))
    .join("");

  return Buffer.from(base64Value, "base64").toString("utf8");
}

function getSubjectEncodedWords(rawMimeMessage: string) {
  const subjectHeader = getSubjectHeader(rawMimeMessage);
  return subjectHeader.match(/=\?UTF-8\?B\?[^?]+\?=/g) ?? [];
}

function getSubjectHeader(rawMimeMessage: string) {
  const headerBlock = rawMimeMessage.split("\r\n\r\n")[0] ?? "";
  const lines = headerBlock.split("\r\n");
  const subjectIndex = lines.findIndex((line) => line.startsWith("Subject: "));
  assert.notEqual(subjectIndex, -1);

  const subjectLines = [];
  for (const line of lines.slice(subjectIndex)) {
    if (subjectLines.length > 0 && !line.startsWith(" ")) {
      break;
    }

    subjectLines.push(line);
  }

  return subjectLines.join("\r\n").replace(/^Subject: /, "");
}

function createMailboxReadResponse(request: Request) {
  const url = new URL(request.url);
  const exactResponse = createExactMailboxReadResponse(url);
  if (exactResponse) {
    return exactResponse;
  }

  if (url.pathname === "/gmail/v1/users/me/threads") {
    return createMailboxThreadsResponse(url);
  }

  return createGmailLabelCountResponseFromUrl(url, request.url);
}

function createThreadedMailboxReadResponse(request: Request) {
  const url = new URL(request.url);
  const exactResponse = createExactThreadedMailboxReadResponse(url);
  if (exactResponse) {
    return exactResponse;
  }

  if (url.pathname === "/gmail/v1/users/me/threads") {
    return createThreadedMailboxThreadsResponse(url);
  }

  return createGmailLabelCountResponseFromUrl(url, request.url);
}

test("falls back to zero mailbox counts when Gmail label count fetch fails", async () => {
  const mutableRequests: Request[] = [];
  const mutableLoggedErrors: unknown[] = [];
  globalThis.fetch = createAuthorizedMailboxFetchMock(mutableRequests, (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/gmail/v1/users/me/labels/INBOX") {
      return Response.json(
        {
          error: {
            code: 429,
            message: "Quota exceeded for quota metric.",
            status: "RESOURCE_EXHAUSTED",
          },
        },
        { status: 429 },
      );
    }

    return createMailboxReadResponse(request);
  });

  const authContextWithLog = {
    ...createSignedInGmailContext("better-auth-read-token", [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
    log: {
      error: (error: unknown) => {
        mutableLoggedErrors.push(error);
      },
      set: () => {},
    },
  };

  const result = await getMailboxData(
    {
      query: "from:sender",
      view: "unread",
    },
    authContextWithLog,
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(result.data.counts, {
    drafts: 0,
    inboxUnread: 0,
  });
  assert.equal(mutableLoggedErrors.length, 1);
});

function createExactMailboxReadResponse(url: URL) {
  const exactResponses = new Map<string, () => Response>([
    ["/gmail/v1/users/me/profile", () => Response.json(createGmailProfileResponse())],
    ["/gmail/v1/users/me/labels", () => Response.json(createGmailLabelsResponse())],
    [
      "/gmail/v1/users/me/messages/18c2f5f6c5f9f001",
      () => Response.json(createGmailMessageDetailResponse(url)),
    ],
    [
      "/gmail/v1/users/me/threads/18c2f5f6c5f9f001",
      () => Response.json(createSingleMessageGmailThread(url)),
    ],
  ]);

  return exactResponses.get(url.pathname)?.();
}

function createExactThreadedMailboxReadResponse(url: URL) {
  const thread = createGmailThreadWithUnreadMessage();
  const exactResponses = new Map<string, () => Response>([
    ["/gmail/v1/users/me/profile", () => Response.json(createGmailProfileResponse())],
    ["/gmail/v1/users/me/labels", () => Response.json(createGmailLabelsResponse())],
    [
      `/gmail/v1/users/me/threads/${thread.id}`,
      () => {
        assert.equal(url.searchParams.get("format"), "full");
        return Response.json(thread);
      },
    ],
  ]);

  const exactResponse = exactResponses.get(url.pathname)?.();
  if (exactResponse) {
    return exactResponse;
  }

  return createExactThreadedMessageReadResponse(url, thread);
}

function createExactThreadedMessageReadResponse(
  url: URL,
  thread: ReturnType<typeof createGmailThreadWithUnreadMessage>,
) {
  const message = thread.messages.find(
    (item) => `/gmail/v1/users/me/messages/${item.id}` === url.pathname,
  );

  if (message) {
    assert.equal(url.searchParams.get("format"), "full");
    return Response.json(message);
  }

  return null;
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

function createSingleMessageGmailThread(url: URL) {
  const message = createHtmlGmailMessage();
  assert.equal(url.searchParams.get("format"), "full");

  return {
    historyId: message.historyId,
    id: message.threadId,
    messages: [message],
  };
}

function createThreadedMailboxThreadsResponse(url: URL) {
  const thread = createGmailThreadWithUnreadMessage();
  const latestMessage = thread.messages.at(-1);

  assert.ok(latestMessage);
  assert.equal(url.searchParams.get("includeSpamTrash"), "false");
  assert.equal(url.searchParams.get("maxResults"), "20");
  assert.equal(url.searchParams.get("q"), "project");
  assert.deepEqual(url.searchParams.getAll("labelIds"), ["INBOX"]);

  return Response.json({
    resultSizeEstimate: 1,
    threads: [
      {
        historyId: thread.historyId,
        id: thread.id,
        snippet: latestMessage.snippet,
      },
    ],
  });
}

function createMailboxThreadsResponse(url: URL) {
  assert.equal(url.searchParams.get("includeSpamTrash"), "false");
  const query = url.searchParams.get("q");

  if (query === "from:sender is:unread") {
    const message = createHtmlGmailMessage();
    assert.equal(url.searchParams.get("maxResults"), "20");
    assert.deepEqual(url.searchParams.getAll("labelIds"), ["INBOX", "UNREAD"]);
    return Response.json({
      resultSizeEstimate: 1,
      threads: [
        {
          historyId: message.historyId,
          id: message.threadId,
          snippet: message.snippet,
        },
      ],
    });
  }

  throw new Error(`Unexpected Gmail threads.list query: ${url.toString()}`);
}

function createGmailLabelCountResponse(labelId: string) {
  return {
    ...createLabel(labelId, labelId, "system"),
    messagesTotal: getSystemLabelMessageTotal(labelId),
    messagesUnread: labelId === "INBOX" ? 5 : 0,
  };
}

function getSystemLabelMessageTotal(labelId: string) {
  if (labelId === "DRAFT") {
    return 2;
  }

  return 11;
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
          drafts: 0,
          inboxUnread: 0,
        },
        messages: [message],
        source: "gmail",
      },
      status: "ok",
    }).success,
    true,
  );
}

async function runWithMailboxService<A, E>(
  gmailClientLayer: Layer.Layer<GmailClientIdentifier>,
  run: (service: Context.Service.Shape<typeof MailboxServiceIdentifier>) => Effect.Effect<A, E>,
) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const service = yield* MailboxService;
        return yield* run(service);
      }),
      MailboxService.layer.pipe(Layer.provide(gmailClientLayer)),
    ),
  );
}

function createInjectedGmailClientLayer(
  mutableCalls: string[],
  overrides: Partial<Context.Service.Shape<typeof GmailClientIdentifier>> = {},
) {
  return Layer.succeed(
    GmailClient,
    GmailClient.of({
      getLabel: (_accessToken: string, _userId: string, labelId: string) =>
        Effect.sync(() => {
          mutableCalls.push(`getLabel:${labelId}`);
          return createGmailLabelCountResponse(labelId);
        }),
      getProfile: () =>
        Effect.sync(() => {
          mutableCalls.push("getProfile");
          return createGmailProfileResponse();
        }),
      getThread: (_accessToken: string, _userId: string, threadId: string) =>
        Effect.sync(() => {
          mutableCalls.push(`getThread:${threadId}`);
          return Schema.decodeUnknownSync(gmailThreadResponseSchema)(
            createSingleMessageGmailThread(new URL(`https://gmail.test?format=full`)),
          );
        }),
      getThreadIfExists: () => Effect.succeed(null),
      listHistory: () => Effect.succeed({ history: [], historyId: "176001" }),
      listLabels: () =>
        Effect.sync(() => {
          mutableCalls.push("listLabels");
          return createGmailLabelsResponse().labels;
        }),
      listThreads: () =>
        Effect.sync(() => {
          mutableCalls.push("listThreads");
          return {
            resultSizeEstimate: 1,
            threads: [
              {
                historyId: "12345",
                id: "18c2f5f6c5f9f001",
                snippet: "Hello &lt;strong&gt;Pranav&lt;/strong&gt;",
              },
            ],
          };
        }),
      sendMessage: () =>
        Effect.succeed({
          id: "sent-message-id",
          labelIds: ["SENT"],
          threadId: "sent-thread-id",
        }),
      watchMailbox: () => Effect.succeed({ expiration: "176001", historyId: "176001" }),
      ...overrides,
    }),
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
