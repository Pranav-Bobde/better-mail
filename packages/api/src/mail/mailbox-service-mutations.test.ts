import assert from "node:assert/strict";

import { afterEach, test } from "vitest";

import { Effect, Layer } from "effect";

import {
  assertGmailRequest,
  captureGmailFetch,
  createFakeMailSyncRepository,
  createGmailDraftResponse,
  createGmailModifyThreadResponse,
  createGmailThreadResponse,
  createRecordingAuthLog,
  createSignedInGmailContext,
  fakeCacheWriteFailureMessage,
  gmailDraftTestIds,
  gmailLegacyReadSendTestScopes,
  gmailModifyTestScopes,
  hasMailErrorCode,
  mockGmailJsonResponse,
  rejectGmailFetch,
  runServiceEffect,
} from "./mail-test-support";
import { setRequiredTestEnv } from "../test-env";

setRequiredTestEnv();

const {
  MailboxService,
  archiveMailboxThread,
  createMailboxDraft,
  deleteMailboxDraft,
  getMailboxData,
  listMailboxDrafts,
  sendMailboxMessage,
  setMailboxThreadReadState,
  shouldEnqueueCachedMailboxSync,
  updateMailboxDraft,
} = await import("./mailbox-service");
const { GmailClient } = await import("./gmail-client");
const { mailErrors } = await import("./errors");
const {
  archiveThreadOutputSchema,
  createDraftOutputSchema,
  deleteDraftInputSchema,
  deleteDraftOutputSchema,
  listDraftsOutputSchema,
  sendMailOutputSchema,
  setThreadReadOutputSchema,
  updateDraftOutputSchema,
} = await import("./contracts");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const modifyContext = (repository = createFakeMailSyncRepository().repository) => ({
  ...createSignedInGmailContext("better-auth-modify-token", gmailModifyTestScopes),
  mailSyncRepository: repository,
});
const legacyContext = (accessToken = "better-auth-modify-token") => ({
  ...createSignedInGmailContext(accessToken, gmailLegacyReadSendTestScopes),
  mailSyncRepository: createFakeMailSyncRepository().repository,
});
const scopeRejectionCheck = (error: unknown) =>
  hasMailErrorCode(error, mailErrors.GMAIL_SCOPE_MISSING.code);

const unreadInboxThreadSeed = {
  isInbox: true,
  isRead: false,
  labelIds: ["INBOX", "UNREAD"],
  threadId: gmailDraftTestIds.threadId,
};

test("delete draft input requires the thread id used for idempotent reconciliation", () => {
  assert.equal(
    deleteDraftInputSchema.safeParse({
      draftId: gmailDraftTestIds.draftId,
      threadId: gmailDraftTestIds.threadId,
    }).success,
    true,
  );
  assert.equal(
    deleteDraftInputSchema.safeParse({ draftId: gmailDraftTestIds.draftId }).success,
    false,
  );
});

test("cached mailbox sync enqueue uses a strict sliding 60-second freshness gate", () => {
  const now = new Date("2026-07-31T18:30:00.000Z");

  assert.equal(shouldEnqueueCachedMailboxSync(new Date("2026-07-31T18:29:00.001Z"), now), false);
  assert.equal(shouldEnqueueCachedMailboxSync(new Date("2026-07-31T18:29:00.000Z"), now), true);
  assert.equal(shouldEnqueueCachedMailboxSync(null, now), true);
  assert.equal(shouldEnqueueCachedMailboxSync(new Date("2026-07-31T18:30:01.000Z"), now), false);
});

// One unread inbox thread in the cache plus a recording operator log — the
// starting state shared by the write-through and cache-failure tests.
function createUnreadInboxCacheFixture(options: { readonly cacheWriteFailures?: number } = {}) {
  const fakeRepository = createFakeMailSyncRepository({
    ...options,
    threads: [unreadInboxThreadSeed],
  });
  const recordingLog = createRecordingAuthLog();
  const context = {
    ...modifyContext(fakeRepository.repository),
    log: recordingLog.log,
  };

  return { context, fakeRepository, recordingLog };
}

function captureGmailResponseSequence(
  responses: readonly (
    | { readonly json: unknown; readonly status?: number }
    | { readonly status: number }
  )[],
) {
  const bodies: string[] = [];
  const requests: Request[] = [];
  let responseIndex = 0;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    bodies.push(await request.text());
    const response = responses[responseIndex];
    responseIndex += 1;
    assert.ok(response, `Unexpected Gmail request ${request.method} ${request.url}`);

    if ("json" in response) {
      return Response.json(response.json, { status: response.status ?? 200 });
    }

    return new Response(null, { status: response.status });
  };

  return { bodies, requests };
}

test("marks a thread read by removing the UNREAD label through threads.modify", async () => {
  const captured = captureGmailFetch(createGmailModifyThreadResponse());

  const result = await setMailboxThreadReadState(
    { read: true, threadId: gmailDraftTestIds.threadId },
    modifyContext(),
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, read: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.equal(setThreadReadOutputSchema.safeParse(result).success, true);

  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    method: "POST",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}/modify`,
  });
  assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), { removeLabelIds: ["UNREAD"] });
});

test("marks a thread unread by adding the UNREAD label through threads.modify", async () => {
  const captured = captureGmailFetch(createGmailModifyThreadResponse());

  const result = await setMailboxThreadReadState(
    { read: false, threadId: gmailDraftTestIds.threadId },
    modifyContext(),
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, read: false, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), { addLabelIds: ["UNREAD"] });
});

test("rejects thread read-state changes without the gmail.modify scope", async () => {
  rejectGmailFetch("fetch should not run without the Gmail modify scope");

  await assert.rejects(
    () =>
      setMailboxThreadReadState(
        { read: true, threadId: gmailDraftTestIds.threadId },
        legacyContext(),
      ),
    scopeRejectionCheck,
  );
});

// Write-through outcome: after mark-read, a cache-served mailbox read (the
// same path the UI refetches through) must return the NEW state — asserting
// only the outbound Gmail request is exactly how the stale-cache bug shipped.
test("mark read writes through so a cache-served mailbox read returns read", async () => {
  captureGmailFetch(createGmailModifyThreadResponse());
  const { context, fakeRepository } = createUnreadInboxCacheFixture();

  const result = await setMailboxThreadReadState(
    { read: true, threadId: gmailDraftTestIds.threadId },
    context,
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, read: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      operation: "markCachedThreadReadState",
      read: true,
      threadId: gmailDraftTestIds.threadId,
      userId: "user-id",
    },
  ]);
  // Both read-state sources must agree after the write-through: the thread
  // isRead flag (unread-view filter) and the UNREAD label rows (per-message
  // read flag).
  assert.deepEqual(fakeRepository.getThreadState(gmailDraftTestIds.threadId), {
    isInbox: true,
    isRead: true,
    labelIds: ["INBOX"],
    threadId: gmailDraftTestIds.threadId,
  });
  assert.equal(fakeRepository.getThreadHistoryId(gmailDraftTestIds.threadId), "987660");

  const mailbox = await getMailboxData({ query: "", view: "all" }, context);
  const mailboxRow = mailbox.data.messages.find(
    (message) => message.threadId === gmailDraftTestIds.threadId,
  );
  assert.equal(mailbox.status, "ok");
  assert.equal(mailboxRow?.read, true);
});

test("mark unread writes through so the cache-served unread view includes the thread again", async () => {
  captureGmailFetch(createGmailModifyThreadResponse());
  const fakeRepository = createFakeMailSyncRepository({
    threads: [
      {
        isInbox: true,
        isRead: true,
        labelIds: ["INBOX"],
        threadId: gmailDraftTestIds.threadId,
      },
    ],
  });
  const context = modifyContext(fakeRepository.repository);

  const result = await setMailboxThreadReadState(
    { read: false, threadId: gmailDraftTestIds.threadId },
    context,
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, read: false, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.deepEqual(fakeRepository.getThreadState(gmailDraftTestIds.threadId), {
    isInbox: true,
    isRead: false,
    labelIds: ["INBOX", "UNREAD"],
    threadId: gmailDraftTestIds.threadId,
  });

  const unreadMailbox = await getMailboxData({ query: "", view: "unread" }, context);
  const unreadRow = unreadMailbox.data.messages.find(
    (message) => message.threadId === gmailDraftTestIds.threadId,
  );
  assert.equal(unreadMailbox.status, "ok");
  assert.equal(unreadRow?.read, false);
});

test("returns ok with cacheApplied false and logs when the cache write keeps failing", async () => {
  const captured = captureGmailFetch(createGmailModifyThreadResponse());
  const { context, fakeRepository, recordingLog } = createUnreadInboxCacheFixture({
    cacheWriteFailures: Number.MAX_SAFE_INTEGER,
  });

  const result = await setMailboxThreadReadState(
    { read: true, threadId: gmailDraftTestIds.threadId },
    context,
  );

  // Gmail succeeded and stays the source of truth: the request is still 200 ok,
  // the response only degrades to cacheApplied: false for the UI toast.
  assert.deepEqual(result, {
    data: { cacheApplied: false, read: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.equal(setThreadReadOutputSchema.safeParse(result).success, true);
  assert.equal(captured.requests.length, 1);
  // Internal retries: three attempts before giving up.
  assert.equal(fakeRepository.cachedWrites.length, 3);
  // The cache still holds the stale state — exactly what the operator
  // log below has to explain.
  assert.equal(fakeRepository.getThreadState(gmailDraftTestIds.threadId)?.isRead, false);
  assert.deepEqual(recordingLog.fields, [
    {
      mailCachedWrite: {
        attempts: 3,
        errorMessage: fakeCacheWriteFailureMessage,
        errorName: "Error",
        operation: "setThreadRead",
        outcome: "failed",
        threadId: gmailDraftTestIds.threadId,
        userId: "user-id",
      },
    },
  ]);
});

test("retries the cache write and reports cacheApplied true when a retry succeeds", async () => {
  captureGmailFetch(createGmailModifyThreadResponse());
  const { context, fakeRepository, recordingLog } = createUnreadInboxCacheFixture({
    cacheWriteFailures: 2,
  });

  const result = await setMailboxThreadReadState(
    { read: true, threadId: gmailDraftTestIds.threadId },
    context,
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, read: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.equal(fakeRepository.cachedWrites.length, 3);
  assert.equal(fakeRepository.getThreadState(gmailDraftTestIds.threadId)?.isRead, true);
  assert.deepEqual(recordingLog.fields, []);
});

test("archives a thread by removing the INBOX label through threads.modify", async () => {
  const captured = captureGmailFetch(createGmailModifyThreadResponse());

  const result = await archiveMailboxThread(
    { threadId: gmailDraftTestIds.threadId },
    modifyContext(),
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.equal(archiveThreadOutputSchema.safeParse(result).success, true);

  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}/modify`,
  });
  assert.deepEqual(JSON.parse(captured.bodies[0] ?? ""), { removeLabelIds: ["INBOX"] });
});

test("archive writes through so cache-served inbox drops the thread and archive serves it", async () => {
  captureGmailFetch(createGmailModifyThreadResponse());
  const fakeRepository = createFakeMailSyncRepository({
    threads: [
      unreadInboxThreadSeed,
      {
        isInbox: true,
        isRead: true,
        labelIds: ["INBOX"],
        threadId: "remaining-inbox-thread",
      },
    ],
  });
  const context = modifyContext(fakeRepository.repository);

  const result = await archiveMailboxThread({ threadId: gmailDraftTestIds.threadId }, context);

  assert.deepEqual(result, {
    data: { cacheApplied: true, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      operation: "markCachedThreadArchived",
      threadId: gmailDraftTestIds.threadId,
      userId: "user-id",
    },
  ]);
  assert.deepEqual(fakeRepository.getThreadState(gmailDraftTestIds.threadId), {
    isInbox: false,
    isRead: false,
    labelIds: ["UNREAD"],
    threadId: gmailDraftTestIds.threadId,
  });

  const inboxMailbox = await getMailboxData({ folder: "inbox", query: "", view: "all" }, context);
  assert.equal(inboxMailbox.status, "ok");
  assert.deepEqual(
    inboxMailbox.data.messages.map((message) => message.threadId),
    ["remaining-inbox-thread"],
  );

  const archiveMailbox = await getMailboxData(
    { folder: "archive", query: "", view: "all" },
    context,
  );
  assert.equal(archiveMailbox.status, "ok");
  assert.deepEqual(
    archiveMailbox.data.messages.map((message) => message.threadId),
    [gmailDraftTestIds.threadId],
  );
});

test("archive returns ok with cacheApplied false and logs when the cache write keeps failing", async () => {
  captureGmailFetch(createGmailModifyThreadResponse());
  const { context, fakeRepository, recordingLog } = createUnreadInboxCacheFixture({
    cacheWriteFailures: Number.MAX_SAFE_INTEGER,
  });

  const result = await archiveMailboxThread({ threadId: gmailDraftTestIds.threadId }, context);

  assert.deepEqual(result, {
    data: { cacheApplied: false, threadId: gmailDraftTestIds.threadId },
    status: "ok",
  });
  assert.equal(archiveThreadOutputSchema.safeParse(result).success, true);
  assert.equal(fakeRepository.cachedWrites.length, 3);
  assert.equal(fakeRepository.getThreadState(gmailDraftTestIds.threadId)?.isInbox, true);
  assert.deepEqual(recordingLog.fields, [
    {
      mailCachedWrite: {
        attempts: 3,
        errorMessage: fakeCacheWriteFailureMessage,
        errorName: "Error",
        operation: "archiveThread",
        outcome: "failed",
        threadId: gmailDraftTestIds.threadId,
        userId: "user-id",
      },
    },
  ]);
});

test("rejects archiving without the gmail.modify scope", async () => {
  rejectGmailFetch("fetch should not run without the Gmail modify scope");

  await assert.rejects(
    () => archiveMailboxThread({ threadId: gmailDraftTestIds.threadId }, legacyContext()),
    scopeRejectionCheck,
  );
});

test("creates a reply draft with To, Subject, and In-Reply-To MIME headers", async () => {
  const captured = captureGmailResponseSequence([
    { json: createGmailDraftResponse() },
    { json: createGmailThreadResponse() },
  ]);
  const fakeRepository = createFakeMailSyncRepository();

  const result = await createMailboxDraft(
    {
      body: "Draft body stays literal",
      inReplyTo: "<original-message@mail.gmail.com>",
      subject: "Re: Project kickoff",
      threadId: gmailDraftTestIds.threadId,
      to: "receiver@example.com",
    },
    modifyContext(fakeRepository.repository),
  );

  assert.deepEqual(result, {
    data: {
      draftId: gmailDraftTestIds.draftId,
      messageId: gmailDraftTestIds.messageId,
      threadId: gmailDraftTestIds.threadId,
      cacheApplied: true,
    },
    status: "ok",
  });
  assert.equal(createDraftOutputSchema.safeParse(result).success, true);

  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    method: "POST",
    url: "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
  });

  const payload = JSON.parse(captured.bodies[0] ?? "");
  assert.equal(payload.message.threadId, gmailDraftTestIds.threadId);
  const rawMimeMessage = decodeRawMimeMessage(payload.message.raw);
  assert.match(rawMimeMessage, /To: receiver@example.com\r\n/);
  assert.match(rawMimeMessage, /Subject: Re: Project kickoff\r\n/);
  assert.match(rawMimeMessage, /In-Reply-To: <original-message@mail.gmail.com>\r\n/);
  assert.match(rawMimeMessage, /References: <original-message@mail.gmail.com>\r\n/);
  assert.match(rawMimeMessage, /\r\n\r\nDraft body stays literal$/);
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      operation: "reconcileCachedGmailThread",
      threadId: gmailDraftTestIds.threadId,
      userId: "user-id",
    },
  ]);
  assertGmailRequest(captured.requests[1], {
    bearer: "better-auth-modify-token",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}?format=full`,
  });
});

test("creates a bare draft without To and Subject MIME headers", async () => {
  const captured = captureGmailFetch(createGmailDraftResponse());

  const result = await createMailboxDraft({ body: "Body only draft" }, modifyContext());

  assert.equal(result.status, "ok");

  const payload = JSON.parse(captured.bodies[0] ?? "");
  assert.equal("threadId" in payload.message, false);
  const rawMimeMessage = decodeRawMimeMessage(payload.message.raw);
  assert.equal(rawMimeMessage.includes("To: "), false);
  assert.equal(rawMimeMessage.includes("Subject: "), false);
  assert.match(rawMimeMessage, /Content-Type: text\/plain; charset=UTF-8\r\n/);
  assert.match(rawMimeMessage, /MIME-Version: 1.0\r\n/);
  assert.match(rawMimeMessage, /\r\n\r\nBody only draft$/);
});

test("encodes non-ASCII draft subjects as RFC 2047 encoded words", async () => {
  const captured = captureGmailFetch(createGmailDraftResponse());

  await createMailboxDraft(
    { body: "Body stays literal", subject: "Re: 😸 OpenAI goes hard" },
    modifyContext(),
  );

  const payload = JSON.parse(captured.bodies[0] ?? "");
  const rawMimeMessage = decodeRawMimeMessage(payload.message.raw);
  assert.match(rawMimeMessage, /Subject: =\?UTF-8\?B\?/);
});

test("rejects draft creation without the gmail.modify scope", async () => {
  rejectGmailFetch("fetch should not run without the Gmail modify scope");

  await assert.rejects(
    () => createMailboxDraft({ body: "Body only draft" }, legacyContext()),
    scopeRejectionCheck,
  );
});

test("updates a draft in place through drafts.update", async () => {
  const captured = captureGmailResponseSequence([
    { json: createGmailDraftResponse() },
    { json: createGmailDraftResponse() },
    { json: createGmailThreadResponse({ body: "Updated draft body" }) },
  ]);
  const fakeRepository = createFakeMailSyncRepository();

  const result = await updateMailboxDraft(
    {
      body: "Updated draft body",
      draftId: gmailDraftTestIds.draftId,
      subject: "Re: Project kickoff",
      threadId: gmailDraftTestIds.threadId,
      to: "receiver@example.com",
    },
    modifyContext(fakeRepository.repository),
  );

  assert.deepEqual(result, {
    data: {
      draftId: gmailDraftTestIds.draftId,
      messageId: gmailDraftTestIds.messageId,
      threadId: gmailDraftTestIds.threadId,
      cacheApplied: true,
    },
    status: "ok",
  });
  assert.equal(updateDraftOutputSchema.safeParse(result).success, true);

  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
  });
  assertGmailRequest(captured.requests[1], {
    bearer: "better-auth-modify-token",
    method: "PUT",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
  });

  const payload = JSON.parse(captured.bodies[1] ?? "");
  const rawMimeMessage = decodeRawMimeMessage(payload.message.raw);
  assert.match(rawMimeMessage, /\r\n\r\nUpdated draft body$/);
  assert.equal(fakeRepository.cachedWrites.length, 1);
});

test("draft update transient missing read preserves the old thread fence for recovery", async () => {
  const oldThreadId = "old-draft-thread-id";
  const replacementMessageId = "replacement-draft-message-id";
  const replacementThreadId = "replacement-draft-thread-id";
  const mutableCalls: string[] = [];
  const fakeRepository = createFakeMailSyncRepository();
  const gmailLayer = createInjectedGmailClientLayer(mutableCalls, {
    getDraft: (_accessToken, _userId, draftId) =>
      Effect.sync(() => {
        mutableCalls.push(`getDraft:${draftId}`);
        return {
          id: draftId,
          message: {
            id: gmailDraftTestIds.messageId,
            labelIds: ["DRAFT"],
            threadId: oldThreadId,
          },
        };
      }),
    getProfile: () =>
      Effect.sync(() => {
        mutableCalls.push("getProfile");
        return {
          emailAddress: "demo-user@example.com",
          historyId: "987663",
          messagesTotal: 10,
          threadsTotal: 8,
        };
      }),
    getThread: (_accessToken, _userId, threadId) =>
      Effect.sync(() => {
        mutableCalls.push(`getThread:${threadId}`);
        return createGmailThreadResponse({
          body: "Updated draft body",
          messageId: replacementMessageId,
          threadId,
        });
      }),
    getThreadIfExists: (_accessToken, _userId, threadId) =>
      Effect.sync(() => {
        mutableCalls.push(`getThreadIfExists:${threadId}`);
        return null;
      }),
    updateDraft: (input) =>
      Effect.sync(() => {
        mutableCalls.push(`updateDraft:${input.draftId}`);
        return {
          id: input.draftId,
          message: {
            id: replacementMessageId,
            labelIds: ["DRAFT"],
            threadId: replacementThreadId,
          },
        };
      }),
  });

  const result = await runServiceEffect(
    MailboxService.layer.pipe(Layer.provide(gmailLayer)),
    Effect.gen(function* () {
      const service = yield* MailboxService;
      return yield* service.updateMailboxDraft(
        { body: "Updated draft body", draftId: gmailDraftTestIds.draftId },
        modifyContext(fakeRepository.repository),
      );
    }),
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(mutableCalls, [
    `getDraft:${gmailDraftTestIds.draftId}`,
    `updateDraft:${gmailDraftTestIds.draftId}`,
    `getThread:${replacementThreadId}`,
    "getProfile",
    `getThreadIfExists:${oldThreadId}`,
  ]);
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      operation: "reconcileCachedGmailThread",
      threadId: replacementThreadId,
      userId: "user-id",
    },
    {
      deletionFenceHistoryId: "987663",
      operation: "reconcileCachedGmailThread",
      threadId: oldThreadId,
      userId: "user-id",
    },
  ]);
});

test("deletes a draft through drafts.delete and echoes the draft id", async () => {
  const captured = captureGmailResponseSequence([
    { json: createGmailDraftResponse() },
    { status: 204 },
    {
      json: {
        emailAddress: "demo-user@example.com",
        historyId: "987662",
        messagesTotal: 10,
        threadsTotal: 8,
      },
    },
    { status: 404 },
  ]);
  const fakeRepository = createFakeMailSyncRepository();

  const result = await deleteMailboxDraft(
    { draftId: gmailDraftTestIds.draftId, threadId: "stale-client-thread-id" },
    modifyContext(fakeRepository.repository),
  );

  assert.deepEqual(result, {
    data: {
      cacheApplied: true,
      draftId: gmailDraftTestIds.draftId,
      threadId: gmailDraftTestIds.threadId,
    },
    status: "ok",
  });
  assert.equal(deleteDraftOutputSchema.safeParse(result).success, true);

  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
  });
  assertGmailRequest(captured.requests[1], {
    bearer: "better-auth-modify-token",
    method: "DELETE",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
  });
  assertGmailRequest(captured.requests[2], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  });
  assertGmailRequest(captured.requests[3], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}?format=full`,
  });
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      deletionFenceHistoryId: "987662",
      operation: "reconcileCachedGmailThread",
      threadId: gmailDraftTestIds.threadId,
      userId: "user-id",
    },
  ]);
});

test("treats an already-deleted Gmail draft as an idempotent success", async () => {
  const captured = captureGmailResponseSequence([
    { status: 404 },
    {
      json: {
        emailAddress: "demo-user@example.com",
        historyId: "987663",
        messagesTotal: 10,
        threadsTotal: 8,
      },
    },
    { status: 404 },
  ]);
  const fakeRepository = createFakeMailSyncRepository();

  const result = await deleteMailboxDraft(
    { draftId: gmailDraftTestIds.draftId, threadId: gmailDraftTestIds.threadId },
    modifyContext(fakeRepository.repository),
  );

  assert.deepEqual(result, {
    data: {
      cacheApplied: true,
      draftId: gmailDraftTestIds.draftId,
      threadId: gmailDraftTestIds.threadId,
    },
    status: "ok",
  });
  assert.equal(deleteDraftOutputSchema.safeParse(result).success, true);
  assert.equal(captured.requests.length, 3);
  assertGmailRequest(captured.requests[0], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftTestIds.draftId}`,
  });
  assertGmailRequest(captured.requests[1], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  });
  assertGmailRequest(captured.requests[2], {
    bearer: "better-auth-modify-token",
    method: "GET",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailDraftTestIds.threadId}?format=full`,
  });
  assert.deepEqual(fakeRepository.cachedWrites, [
    {
      deletionFenceHistoryId: "987663",
      operation: "reconcileCachedGmailThread",
      threadId: gmailDraftTestIds.threadId,
      userId: "user-id",
    },
  ]);
});

test("send reconciles the authoritative SENT thread into the cache", async () => {
  const sentThreadId = "sent-thread-id";
  const captured = captureGmailResponseSequence([
    {
      json: { id: "sent-message-id", labelIds: ["SENT"], threadId: sentThreadId },
    },
    {
      json: createGmailThreadResponse({
        labelIds: ["SENT"],
        messageId: "sent-message-id",
        threadId: sentThreadId,
      }),
    },
  ]);
  const fakeRepository = createFakeMailSyncRepository();

  const result = await sendMailboxMessage(
    {
      body: "Sent body",
      subject: "Sent subject",
      to: "receiver@example.com",
    },
    modifyContext(fakeRepository.repository),
  );

  assert.deepEqual(result, {
    data: { cacheApplied: true, messageId: "sent-message-id", threadId: sentThreadId },
    status: "ok",
  });
  assert.equal(sendMailOutputSchema.safeParse(result).success, true);
  assertGmailRequest(captured.requests[1], {
    bearer: "better-auth-modify-token",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/threads/${sentThreadId}?format=full`,
  });
  assert.equal(fakeRepository.cachedWrites.length, 1);
});

test("rejects draft deletion without the gmail.modify scope", async () => {
  rejectGmailFetch("fetch should not run without the Gmail modify scope");

  await assert.rejects(
    () =>
      deleteMailboxDraft(
        { draftId: gmailDraftTestIds.draftId, threadId: gmailDraftTestIds.threadId },
        legacyContext(),
      ),
    scopeRejectionCheck,
  );
});

test("lists drafts mapped into draft, message, and thread ids", async () => {
  mockGmailJsonResponse({
    drafts: [
      createGmailDraftResponse(),
      {
        id: "r-2230337403573001600",
        message: { id: "18c2f5f6c5f9f102", threadId: "18c2f5f6c5f9f102" },
      },
    ],
    resultSizeEstimate: 2,
  });

  const result = await listMailboxDrafts(modifyContext());

  assert.deepEqual(result, {
    data: {
      drafts: [
        {
          draftId: gmailDraftTestIds.draftId,
          messageId: gmailDraftTestIds.messageId,
          threadId: gmailDraftTestIds.threadId,
        },
        {
          draftId: "r-2230337403573001600",
          messageId: "18c2f5f6c5f9f102",
          threadId: "18c2f5f6c5f9f102",
        },
      ],
    },
    status: "ok",
  });
  assert.equal(listDraftsOutputSchema.safeParse(result).success, true);
});

test("lists drafts as empty when Gmail omits the drafts key", async () => {
  mockGmailJsonResponse({ resultSizeEstimate: 0 });

  const result = await listMailboxDrafts(modifyContext());

  assert.deepEqual(result, {
    data: { drafts: [] },
    status: "ok",
  });
});

test("lists drafts with a legacy readonly+send grant", async () => {
  mockGmailJsonResponse({ resultSizeEstimate: 0 });

  const result = await listMailboxDrafts(legacyContext("better-auth-read-token"));

  assert.equal(result.status, "ok");
});

test("scope error catalog copy points users at the Gmail access (gmail.modify) scope", () => {
  assert.match(mailErrors.GMAIL_ACCOUNT_NOT_CONNECTED.fix, /gmail\.modify/);
  assert.match(mailErrors.GMAIL_SCOPE_MISSING.fix, /gmail\.modify/);
});

test("MailboxService routes mutations through the injected GmailClient service", async () => {
  rejectGmailFetch("fetch should not run when GmailClient is injected");

  const mutableCalls: string[] = [];
  const result = await runServiceEffect(
    MailboxService.layer.pipe(Layer.provide(createInjectedGmailClientLayer(mutableCalls))),
    Effect.gen(function* () {
      const service = yield* MailboxService;
      yield* service.setMailboxThreadReadState(
        { read: true, threadId: gmailDraftTestIds.threadId },
        modifyContext(),
      );
      yield* service.archiveMailboxThread(
        { threadId: gmailDraftTestIds.threadId },
        modifyContext(),
      );
      yield* service.createMailboxDraft({ body: "Body only draft" }, modifyContext());
      yield* service.updateMailboxDraft(
        { body: "Updated body", draftId: gmailDraftTestIds.draftId },
        modifyContext(),
      );
      yield* service.deleteMailboxDraft(
        { draftId: gmailDraftTestIds.draftId, threadId: gmailDraftTestIds.threadId },
        modifyContext(),
      );
      return yield* service.listMailboxDrafts(modifyContext());
    }),
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(mutableCalls, [
    `modifyThread:${gmailDraftTestIds.threadId}`,
    `modifyThread:${gmailDraftTestIds.threadId}`,
    "createDraft",
    `getThread:${gmailDraftTestIds.threadId}`,
    `getDraft:${gmailDraftTestIds.draftId}`,
    `updateDraft:${gmailDraftTestIds.draftId}`,
    `getThread:${gmailDraftTestIds.threadId}`,
    `getDraftIfExists:${gmailDraftTestIds.draftId}`,
    `deleteDraft:${gmailDraftTestIds.draftId}`,
    "getProfile",
    `getThreadIfExists:${gmailDraftTestIds.threadId}`,
    "listDrafts",
  ]);
});

function createInjectedGmailClientLayer(
  mutableCalls: string[],
  overrides: Partial<Parameters<typeof GmailClient.of>[0]> = {},
) {
  return Layer.succeed(
    GmailClient,
    GmailClient.of({
      createDraft: () =>
        Effect.sync(() => {
          mutableCalls.push("createDraft");
          return createGmailDraftResponse();
        }),
      deleteDraft: (input) =>
        Effect.sync(() => {
          mutableCalls.push(`deleteDraft:${input.draftId}`);
          return { draftId: input.draftId };
        }),
      getDraft: (_accessToken, _userId, draftId) =>
        Effect.sync(() => {
          mutableCalls.push(`getDraft:${draftId}`);
          return createGmailDraftResponse();
        }),
      getDraftIfExists: (_accessToken, _userId, draftId) =>
        Effect.sync(() => {
          mutableCalls.push(`getDraftIfExists:${draftId}`);
          return createGmailDraftResponse();
        }),
      getLabel: () => Effect.die(new Error("getLabel is not exercised by mutation tests")),
      getProfile: () =>
        Effect.sync(() => {
          mutableCalls.push("getProfile");
          return {
            emailAddress: "demo-user@example.com",
            historyId: "987662",
            messagesTotal: 10,
            threadsTotal: 8,
          };
        }),
      getThread: (_accessToken, _userId, threadId) =>
        Effect.sync(() => {
          mutableCalls.push(`getThread:${threadId}`);
          return createGmailThreadResponse({ threadId });
        }),
      getThreadIfExists: (_accessToken, _userId, threadId) =>
        Effect.sync(() => {
          mutableCalls.push(`getThreadIfExists:${threadId}`);
          return null;
        }),
      listDrafts: () =>
        Effect.sync(() => {
          mutableCalls.push("listDrafts");
          return [
            {
              id: gmailDraftTestIds.draftId,
              message: { id: gmailDraftTestIds.messageId, threadId: gmailDraftTestIds.threadId },
            },
          ];
        }),
      listHistory: () => Effect.succeed({ history: [], historyId: "176001" }),
      listLabels: () => Effect.die(new Error("listLabels is not exercised by mutation tests")),
      listThreads: () => Effect.die(new Error("listThreads is not exercised by mutation tests")),
      modifyThread: (input) =>
        Effect.sync(() => {
          mutableCalls.push(`modifyThread:${input.threadId}`);
          return createGmailModifyThreadResponse();
        }),
      sendMessage: () => Effect.die(new Error("sendMessage is not exercised by mutation tests")),
      updateDraft: (input) =>
        Effect.sync(() => {
          mutableCalls.push(`updateDraft:${input.draftId}`);
          return createGmailDraftResponse();
        }),
      watchMailbox: () => Effect.succeed({ expiration: "176001", historyId: "176001" }),
      ...overrides,
    }),
  );
}

function decodeRawMimeMessage(raw: string) {
  return Buffer.from(raw, "base64url").toString("utf8");
}
