import assert from "node:assert/strict";
import { test } from "node:test";

import { setRequiredTestEnv } from "../test-env";

setRequiredTestEnv();

const { gmailPubSubPushEnvelopeSchema, mailSyncEventSchema } = await import("./sync/contracts");
const { createGmailWebhookFields, createMailSyncQueueEnqueuedFields, createMailSyncWorkerFields } =
  await import("./sync/observability");
const { MailSyncLockBusyError, processMailSyncEvent } = await import("./sync/processor");
const { gmailThreadResponseSchema } = await import("./gmail-schemas");

test("parses real-shaped Gmail Pub/Sub push notification", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(createRealShapedGmailPubSubEnvelope());

  assert.deepEqual(parsedEnvelope.gmailNotification, {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
  });
  assert.equal(parsedEnvelope.message.messageId, "2070443601311540");
});

test("rejects malformed Gmail Pub/Sub push notification without throwing", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.safeParse({
    message: {
      data: Buffer.from("not-json", "utf8").toString("base64url"),
      messageId: "2070443601311541",
      publishTime: "2026-06-13T12:01:00.000Z",
    },
    subscription: "projects/rapid-snowfall-498906-b9/subscriptions/gmail-demo-webhook",
  });

  assert.equal(parsedEnvelope.success, false);
});

test("creates safe Gmail webhook fields without logging mailbox email", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(createRealShapedGmailPubSubEnvelope());

  const fields = createGmailWebhookFields({
    envelope: parsedEnvelope,
    mailAccountId: "mail-account-id",
    queueMessageId: "queue-message-id",
    queueTopicName: "mail-sync",
  });

  assert.deepEqual(fields, {
    handler: "api.webhooks.gmail.POST",
    mailSync: {
      enqueued: true,
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      provider: "GMAIL",
      pubsubMessageId: "2070443601311540",
      pubsubPublishTime: "2026-06-13T12:00:00.000Z",
      pubsubSubscription: "projects/rapid-snowfall-498906-b9/subscriptions/gmail-demo-webhook",
      queueMessageId: "queue-message-id",
      queueTopicName: "mail-sync",
    },
    module: "mail",
    operation: "mail.sync.webhook.gmail",
    outcome: "accepted",
  });
  assert.equal(JSON.stringify(fields).includes("demo-user@example.com"), false);
});

test("creates safe queue enqueue fields with idempotency metadata", () => {
  const fields = createMailSyncQueueEnqueuedFields({
    event: {
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    idempotencyKey: "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
    messageId: "queue-message-id",
    retentionSeconds: 604800,
    topicName: "mail-sync",
  });

  assert.deepEqual(fields, {
    handler: "vercel.queue.send",
    mailSync: {
      eventType: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
      idempotencyKey: "GMAIL_INCREMENTAL_SYNC_REQUESTED:mail-account-id:9876543210",
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      queueMessageId: "queue-message-id",
      retentionSeconds: 604800,
      queueTopicName: "mail-sync",
    },
    module: "mail",
    operation: "mail.sync.queue.enqueue",
    outcome: "queued",
  });
});

test("creates safe queue worker fields with delivery metadata", () => {
  const fields = createMailSyncWorkerFields({
    event: {
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    metadata: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 2,
      messageId: "queue-message-id",
      region: "iad1",
      topicName: "mail-sync",
    },
    outcome: "processed",
  });

  assert.deepEqual(fields, {
    handler: "api.queues.mail-sync.POST",
    mailSync: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 2,
      eventType: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      queueMessageId: "queue-message-id",
      queueTopicName: "mail-sync",
      region: "iad1",
    },
    module: "mail",
    operation: "mail.sync.queue.worker",
    outcome: "processed",
  });
});

test("creates safe queue worker retry fields with error metadata", () => {
  const fields = createMailSyncWorkerFields({
    errorName: "MailSyncLockBusyError",
    metadata: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 3,
      messageId: "queue-message-id",
      region: "iad1",
      topicName: "mail-sync",
    },
    outcome: "retry",
    retryAfterSeconds: 30,
  });

  assert.deepEqual(fields, {
    handler: "api.queues.mail-sync.POST",
    mailSync: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 3,
      errorName: "MailSyncLockBusyError",
      queueMessageId: "queue-message-id",
      queueTopicName: "mail-sync",
      region: "iad1",
      retryAfterSeconds: 30,
    },
    module: "mail",
    operation: "mail.sync.queue.worker",
    outcome: "retry",
  });
});

test("rejects queue events that contain OAuth credentials", () => {
  const parsedEvent = mailSyncEventSchema.safeParse({
    accessToken: "do-not-put-secrets-in-queue",
    mailAccountId: "mail-account-id",
    type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
  });

  assert.equal(parsedEvent.success, false);
});

test("throws a retryable lock error when the cursor is already locked", async () => {
  const repository = createMailSyncRepository({
    lockResult: { acquired: false },
  });

  await assert.rejects(
    () =>
      processMailSyncEvent(
        {
          mailAccountId: "mail-account-id",
          type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
        },
        {
          gmailProvider: createGmailSyncProvider(),
          lockOwnerId: "queue-message-1",
          now: new Date("2026-06-13T12:00:00.000Z"),
          repository,
          tokenProvider: createTokenProvider(),
        },
      ),
    MailSyncLockBusyError,
  );
});

test("runs Gmail incremental sync from stored cursor and updates cache before cursor", async () => {
  const mutableOperations: string[] = [];
  const repository = createMailSyncRepository({
    mutableOperations,
  });
  const gmailProvider = createGmailSyncProvider({
    mutableOperations,
  });
  const tokenProvider = createTokenProvider({
    mutableOperations,
  });

  await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    {
      gmailProvider,
      lockOwnerId: "queue-message-1",
      now: new Date("2026-06-13T12:00:00.000Z"),
      repository,
      tokenProvider,
    },
  );

  assert.deepEqual(mutableOperations, [
    "acquire-lock:cursor-id",
    "get-token:user-id:google-account-id",
    "list-history:176001",
    "get-thread:thread-1",
    "apply-thread:thread-1:message-2",
    "update-cursor:176009",
    "release-lock:cursor-id",
  ]);
});

function createMailSyncRepository({
  lockResult = { acquired: true as const },
  mutableOperations = [],
}: {
  readonly lockResult?: { readonly acquired: boolean };
  readonly mutableOperations?: string[];
}) {
  return {
    acquireSyncLock: async (input: {
      readonly lockOwnerId: string;
      readonly syncCursorId: string;
    }) => {
      mutableOperations.push(`acquire-lock:${input.syncCursorId}`);
      return lockResult;
    },
    applyGmailThread: async (input: {
      readonly latestMessageId: string;
      readonly threadId: string;
    }) => {
      mutableOperations.push(`apply-thread:${input.threadId}:${input.latestMessageId}`);
    },
    getActiveMailAccountWithCursor: async () => ({
      authAccountId: "auth-account-id",
      email: "demo-user@example.com",
      id: "mail-account-id",
      providerAccountId: "google-account-id",
      syncCursor: {
        cursorValue: "176001",
        id: "cursor-id",
      },
      userId: "user-id",
    }),
    releaseSyncLock: async (input: {
      readonly lockOwnerId: string;
      readonly syncCursorId: string;
    }) => {
      assert.equal(input.lockOwnerId, "queue-message-1");
      mutableOperations.push(`release-lock:${input.syncCursorId}`);
    },
    updateSyncCursor: async (input: {
      readonly cursorValue: string;
      readonly syncCursorId: string;
    }) => {
      assert.equal(input.syncCursorId, "cursor-id");
      mutableOperations.push(`update-cursor:${input.cursorValue}`);
    },
    updateGmailWatch: async () => {},
  };
}

function createGmailSyncProvider({
  mutableOperations = [],
}: { readonly mutableOperations?: string[] } = {}) {
  return {
    getThread: async (_accessToken: string, threadId: string) => {
      mutableOperations.push(`get-thread:${threadId}`);
      return createRealShapedGmailThread();
    },
    listHistory: async (_accessToken: string, startHistoryId: string) => {
      mutableOperations.push(`list-history:${startHistoryId}`);
      return {
        history: [
          {
            id: "176009",
            messagesAdded: [
              {
                message: {
                  id: "message-2",
                  threadId: "thread-1",
                },
              },
            ],
          },
        ],
        historyId: "176009",
      };
    },
    watchMailbox: async () => ({
      expiration: "1780000000000",
      historyId: "176010",
    }),
  };
}

function createTokenProvider({
  mutableOperations = [],
}: { readonly mutableOperations?: string[] } = {}) {
  return {
    getGoogleAccessToken: async (input: {
      readonly providerAccountId: string;
      readonly userId: string;
    }) => {
      mutableOperations.push(`get-token:${input.userId}:${input.providerAccountId}`);
      return {
        accessToken: "better-auth-background-token",
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      };
    },
  };
}

function createRealShapedGmailPubSubEnvelope() {
  return {
    message: {
      data: Buffer.from(
        JSON.stringify({
          emailAddress: "demo-user@example.com",
          historyId: "9876543210",
        }),
        "utf8",
      ).toString("base64url"),
      messageId: "2070443601311540",
      publishTime: "2026-06-13T12:00:00.000Z",
    },
    subscription: "projects/rapid-snowfall-498906-b9/subscriptions/gmail-demo-webhook",
  };
}

function createRealShapedGmailThread() {
  return gmailThreadResponseSchema.parse({
    historyId: "176009",
    id: "thread-1",
    messages: [
      {
        historyId: "176008",
        id: "message-1",
        internalDate: "1760184330000",
        labelIds: ["INBOX"],
        payload: {
          body: { data: Buffer.from("Older body", "utf8").toString("base64url"), size: 10 },
          headers: [
            { name: "From", value: "Sender <sender@example.com>" },
            { name: "To", value: "Demo User <demo-user@example.com>" },
            { name: "Subject", value: "Project update" },
            { name: "Date", value: "Sat, 13 Jun 2026 10:45:30 +0530" },
            { name: "Message-ID", value: "<message-1@example.com>" },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 1000,
        snippet: "Older body",
        threadId: "thread-1",
      },
      {
        historyId: "176009",
        id: "message-2",
        internalDate: "1760187930000",
        labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
        payload: {
          body: { data: Buffer.from("Latest body", "utf8").toString("base64url"), size: 11 },
          headers: [
            { name: "From", value: "Sender <sender@example.com>" },
            { name: "To", value: "Demo User <demo-user@example.com>" },
            { name: "Subject", value: "Re: Project update" },
            { name: "Date", value: "Sat, 13 Jun 2026 11:45:30 +0530" },
            { name: "Message-ID", value: "<message-2@example.com>" },
            { name: "In-Reply-To", value: "<message-1@example.com>" },
            { name: "References", value: "<message-1@example.com>" },
          ],
          mimeType: "text/plain",
        },
        sizeEstimate: 1200,
        snippet: "Latest body",
        threadId: "thread-1",
      },
    ],
  });
}
