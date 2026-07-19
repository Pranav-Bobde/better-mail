import assert from "node:assert/strict";
import { test } from "node:test";

import type { PrismaClient } from "@code-main/db";
import { Effect, Layer } from "effect";
import type { Context } from "effect";
import { EvlogError } from "evlog";

import { setRequiredTestEnv } from "../test-env";

setRequiredTestEnv();

const { getGmailPubSubPayloadShape, gmailPubSubPushEnvelopeSchema, mailSyncEventSchema } =
  await import("./sync/contracts");
const { mailErrors } = await import("./errors");
const {
  createGmailWebhookFields,
  createGmailWebhookInvalidEnvelopeFields,
  createMailSyncQueueEnqueuedFields,
  createMailSyncWorkerFields,
} = await import("./sync/observability");
const { MailSyncRepository } = await import("./sync/prisma-mail-sync-repository");
const { createGmailSyncProvider: createRuntimeGmailSyncProvider } =
  await import("./sync/gmail-sync-provider");
const {
  MailSyncLockBusyError,
  MailSyncProcessor,
  processMailSyncEvent,
  SYNC_LEASE_SECONDS,
  SYNC_LOCK_TTL_MS,
} = await import("./sync/processor");
const { gmailThreadResponseSchema } = await import("./gmail-schemas");

// Derived from the service shape so the test contract cannot drift from it.
type TestMailSyncRepository = Pick<
  Context.Service.Shape<typeof MailSyncRepository>,
  "applyGmailThread"
>;

test("parses real-shaped Gmail Pub/Sub push notification", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(createRealShapedGmailPubSubEnvelope());

  assert.deepEqual(parsedEnvelope.gmailNotification, {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
  });
  assert.equal(parsedEnvelope.pubsubEnvelopeKind, "wrapped");
  assert.equal(parsedEnvelope.message.messageId, "2070443601311540");
});

test("parses snake_case Gmail Pub/Sub push notification metadata", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(
    createRealShapedSnakeCaseGmailPubSubEnvelope(),
  );

  assert.deepEqual(parsedEnvelope.gmailNotification, {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
  });
  assert.equal(parsedEnvelope.pubsubEnvelopeKind, "wrapped");
  assert.equal(parsedEnvelope.message.messageId, "2070443601311542");
  assert.equal(parsedEnvelope.message.publishTime, "2026-06-13T12:02:00.000Z");
});

test("parses numeric Gmail Pub/Sub history id as a string", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse({
    emailAddress: "demo-user@example.com",
    historyId: 9876543210,
  });

  assert.deepEqual(parsedEnvelope.gmailNotification, {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
  });
  assert.equal(parsedEnvelope.pubsubEnvelopeKind, "unwrapped");
});

test("parses unwrapped Gmail Pub/Sub push notification", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(
    createRealShapedUnwrappedGmailPubSubNotification(),
  );

  assert.deepEqual(parsedEnvelope.gmailNotification, {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
  });
  assert.equal(parsedEnvelope.pubsubEnvelopeKind, "unwrapped");
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

test("describes invalid Gmail Pub/Sub payload shape without leaking values", () => {
  const payload = {
    message: {
      data: Buffer.from(
        JSON.stringify({
          emailAddress: "demo-user@example.com",
          historyId: 9876543210,
        }),
        "utf8",
      ).toString("base64url"),
      message_id: "2070443601311542",
    },
    subscription: "projects/rapid-snowfall-498906-b9/subscriptions/gmail-demo-webhook",
  };

  const shape = getGmailPubSubPayloadShape(payload);

  assert.deepEqual(shape, {
    decodedDataKeys: ["emailAddress", "historyId"],
    decodedDataTypes: {
      emailAddress: "string",
      historyId: "number",
    },
    messageKeys: ["data", "message_id"],
    payloadKind: "object",
    topLevelKeys: ["message", "subscription"],
  });
  assert.equal(JSON.stringify(shape).includes("demo-user@example.com"), false);
});

test("creates Gmail webhook invalid-envelope fields with safe payload shape", () => {
  const fields = createGmailWebhookInvalidEnvelopeFields({
    payloadShape: {
      decodedDataKeys: ["emailAddress", "historyId"],
      decodedDataTypes: {
        emailAddress: "string",
        historyId: "number",
      },
      messageKeys: ["data", "message_id"],
      payloadKind: "object",
      topLevelKeys: ["message", "subscription"],
    },
  });

  assert.deepEqual(fields, {
    handler: "api.webhooks.gmail.POST",
    mailSync: {
      errorCode: "INVALID_GMAIL_PUBSUB_ENVELOPE",
      payloadShape: {
        decodedDataKeys: ["emailAddress", "historyId"],
        decodedDataTypes: {
          emailAddress: "string",
          historyId: "number",
        },
        messageKeys: ["data", "message_id"],
        payloadKind: "object",
        topLevelKeys: ["message", "subscription"],
      },
      provider: "GMAIL",
    },
    module: "mail",
    operation: "mail.sync.webhook.gmail",
    outcome: "error",
  });
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
      pubsubEnvelopeKind: "wrapped",
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

test("creates safe Gmail webhook fields for unwrapped Pub/Sub payload", () => {
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.parse(
    createRealShapedUnwrappedGmailPubSubNotification(),
  );

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
      pubsubEnvelopeKind: "unwrapped",
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
    errorCode: "P2002",
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
      errorCode: "P2002",
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

test("creates safe queue worker failure fields with event and error metadata", () => {
  const fields = createMailSyncWorkerFields({
    errorCode: "P2003",
    errorName: "PrismaClientKnownRequestError",
    event: {
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    metadata: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 4,
      messageId: "queue-message-id",
      region: "iad1",
      topicName: "mail-sync",
    },
    outcome: "failed",
  });

  assert.deepEqual(fields, {
    handler: "api.queues.mail-sync.POST",
    mailSync: {
      consumerGroup: "src_Sapp_Sapi_Squeues_Smail-sync_Sroute_Dts",
      deliveryCount: 4,
      errorCode: "P2003",
      errorName: "PrismaClientKnownRequestError",
      eventType: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
      mailAccountId: "mail-account-id",
      notificationHistoryId: "9876543210",
      queueMessageId: "queue-message-id",
      queueTopicName: "mail-sync",
      region: "iad1",
    },
    module: "mail",
    operation: "mail.sync.queue.worker",
    outcome: "failed",
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
          realtimeNotifier: createRealtimeNotifier(),
          repository,
          tokenProvider: createTokenProvider(),
        },
      ),
    MailSyncLockBusyError,
  );
});

test("MailSyncProcessor surfaces the raw catalog error from a failing repository service", async () => {
  const repositoryError = mailErrors.GMAIL_HISTORY_LIST_FAILED({
    cause: new Error("database unavailable"),
    internal: { mailAccountId: "mail-account-id" },
  });
  const unused = () => Effect.die(new Error("unused repository method"));
  const failingRepositoryLayer = Layer.succeed(
    MailSyncRepository,
    MailSyncRepository.of({
      acquireSyncLock: unused,
      applyGmailThread: unused,
      findGmailMailAccountsDueForWatchRenewal: unused,
      findRecentlyActiveGmailMailAccountByEmail: unused,
      getActiveMailAccountWithCursor: () => Effect.fail(repositoryError),
      getCachedMailboxData: unused,
      markGmailThreadDeleted: unused,
      markMailAccountAuthError: unused,
      markMailAccountNeedsResync: unused,
      markGmailMailboxActivity: unused,
      releaseSyncLock: unused,
      updateGmailWatch: unused,
      updateSyncCursor: unused,
      upsertGmailMailAccount: unused,
    }),
  );

  const error = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const processor = yield* MailSyncProcessor;
        return yield* Effect.flip(
          processor.processMailSyncEvent(
            {
              mailAccountId: "mail-account-id",
              type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
            },
            {
              gmailProvider: createGmailSyncProvider(),
              lockOwnerId: "queue-message-1",
              now: new Date("2026-06-13T12:00:00.000Z"),
              realtimeNotifier: createRealtimeNotifier(),
              tokenProvider: createTokenProvider(),
            },
          ),
        );
      }),
      MailSyncProcessor.layer.pipe(Layer.provide(failingRepositoryLayer)),
    ),
  );

  // The repository adapter must re-throw the raw catalog error, not a
  // FiberFailure wrapper, so queue worker logs keep the original error code.
  assert.ok(error instanceof EvlogError);
  assert.equal(error.code, mailErrors.GMAIL_HISTORY_LIST_FAILED.code);
});

test("renews Gmail watch without advancing the sync cursor", async () => {
  const mutableOperations: string[] = [];
  const repository = {
    ...createMailSyncRepository({ mutableOperations }),
    updateGmailWatch: async (input: {
      readonly mailAccountId: string;
      readonly watchExpiresAt: Date;
    }) => {
      assert.deepEqual(Object.keys(input).sort(), ["mailAccountId", "watchExpiresAt"]);
      mutableOperations.push(
        `update-watch:${input.mailAccountId}:${input.watchExpiresAt.toISOString()}`,
      );
    },
  };

  await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_RENEW_WATCH_REQUESTED",
    },
    {
      gmailProvider: createGmailSyncProvider(),
      lockOwnerId: "queue-message-1",
      now: new Date("2026-06-13T12:00:00.000Z"),
      realtimeNotifier: createRealtimeNotifier(),
      repository,
      tokenProvider: createTokenProvider({ mutableOperations }),
    },
  );

  assert.deepEqual(mutableOperations, [
    "get-token:user-id:google-account-id",
    "update-watch:mail-account-id:2026-05-28T20:26:40.000Z",
  ]);
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
      realtimeNotifier: {
        publishMailboxChanged: async (input) => {
          mutableOperations.push(
            `publish-mailbox-changed:${input.userId}:${input.mailAccountId}:${input.mailboxVersion}`,
          );
        },
      },
      repository,
      tokenProvider,
    },
  );

  assert.deepEqual(mutableOperations, [
    "acquire-lock:cursor-id",
    "get-token:user-id:google-account-id",
    "list-history:176001",
    "list-labels",
    "get-thread:thread-1",
    "apply-thread:thread-1:message-2",
    "update-cursor:176009",
    "publish-mailbox-changed:user-id:mail-account-id:176009",
    "release-lock:cursor-id",
  ]);
});

test("checkpoints one Gmail history page and requests a continuation", async () => {
  const mutableOperations: string[] = [];
  const repository = createMailSyncRepository({ mutableOperations });
  const gmailProvider = {
    ...createGmailSyncProvider({ mutableOperations }),
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
        historyId: "176999",
        nextPageToken: "next-page-token",
      };
    },
  };

  const result = await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    {
      gmailProvider,
      lockOwnerId: "queue-message-1",
      now: new Date("2026-06-13T12:00:00.000Z"),
      realtimeNotifier: {
        publishMailboxChanged: async (input) => {
          mutableOperations.push(`publish-mailbox-changed:${input.mailboxVersion}`);
        },
      },
      repository,
      tokenProvider: createTokenProvider({ mutableOperations }),
    },
  );

  assert.deepEqual(mutableOperations, [
    "acquire-lock:cursor-id",
    "get-token:user-id:google-account-id",
    "list-history:176001",
    "list-labels",
    "get-thread:thread-1",
    "apply-thread:thread-1:message-2",
    "update-cursor:176009",
    "publish-mailbox-changed:176009",
    "release-lock:cursor-id",
  ]);
  assert.deepEqual(result, {
    continuationEvent: {
      mailAccountId: "mail-account-id",
      notificationHistoryId: "176009",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
  });
});

test("marks unavailable Gmail history threads deleted and continues sync", async () => {
  const mutableOperations: string[] = [];
  const repository = {
    ...createMailSyncRepository({ mutableOperations }),
    markGmailThreadDeleted: async (input: {
      readonly mailAccountId: string;
      readonly threadId: string;
    }) => {
      mutableOperations.push(`mark-thread-deleted:${input.threadId}`);
    },
  };
  const gmailProvider = {
    ...createGmailSyncProvider({ mutableOperations }),
    getThread: async (_accessToken: string, threadId: string) => {
      mutableOperations.push(`get-thread:${threadId}`);
      return threadId === "deleted-thread" ? null : createRealShapedGmailThread();
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
            messagesDeleted: [
              {
                message: {
                  id: "deleted-message",
                  threadId: "deleted-thread",
                },
              },
            ],
          },
        ],
        historyId: "176009",
      };
    },
  };

  await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    {
      gmailProvider,
      lockOwnerId: "queue-message-1",
      now: new Date("2026-06-13T12:00:00.000Z"),
      realtimeNotifier: {
        publishMailboxChanged: async () => {
          mutableOperations.push("publish-mailbox-changed");
        },
      },
      repository,
      tokenProvider: createTokenProvider({ mutableOperations }),
    },
  );

  assert.deepEqual(mutableOperations, [
    "acquire-lock:cursor-id",
    "get-token:user-id:google-account-id",
    "list-history:176001",
    "list-labels",
    "get-thread:thread-1",
    "get-thread:deleted-thread",
    "apply-thread:thread-1:message-2",
    "mark-thread-deleted:deleted-thread",
    "update-cursor:176009",
    "publish-mailbox-changed",
    "release-lock:cursor-id",
  ]);
});

// Real observed Gmail 404 error envelope (same family for threads.get and history.list).
async function withGmailNotFoundFetch(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 404,
          message: "Requested entity was not found.",
          status: "NOT_FOUND",
        },
      }),
      { status: 404 },
    );

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("maps Gmail threads.get 404 to an unavailable sync thread", async () => {
  await withGmailNotFoundFetch(async () => {
    const gmailProvider = createRuntimeGmailSyncProvider("projects/demo-project/topics/gmail-demo");

    assert.equal(await gmailProvider.getThread("access-token", "deleted-thread"), null);
  });
});

test("maps Gmail history 404 to an expired history error", async () => {
  await withGmailNotFoundFetch(async () => {
    const gmailProvider = createRuntimeGmailSyncProvider("projects/demo-project/topics/gmail-demo");

    await assert.rejects(
      () => gmailProvider.listHistory("access-token", "expired-history-id"),
      (error: unknown) => hasMailErrorCode(error, mailErrors.GMAIL_HISTORY_EXPIRED.code),
    );
  });
});

test("keeps Gmail history 500 mapped to generic history list failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 500,
          message: "Backend Error",
          status: "INTERNAL",
        },
      }),
      { status: 500 },
    );

  try {
    const gmailProvider = createRuntimeGmailSyncProvider("projects/demo-project/topics/gmail-demo");

    await assert.rejects(
      () => gmailProvider.listHistory("access-token", "176001"),
      (error: unknown) => hasMailErrorCode(error, mailErrors.GMAIL_HISTORY_LIST_FAILED.code),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loads only one Gmail history page per provider call", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestCount += 1;
    requestedUrl = String(input);
    return Response.json({
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
      historyId: "176999",
      nextPageToken: requestCount === 1 ? "next-page-token" : undefined,
    });
  };

  try {
    const gmailProvider = createRuntimeGmailSyncProvider("projects/demo-project/topics/gmail-demo");

    assert.deepEqual(await gmailProvider.listHistory("access-token", "176001"), {
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
      historyId: "176999",
      nextPageToken: "next-page-token",
    });
    assert.equal(requestCount, 1);
    assert.equal(new URL(requestedUrl).searchParams.get("maxResults"), "5");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("processes changed Gmail threads with bounded concurrency", async () => {
  let activeThreadWrites = 0;
  let activeThreadReads = 0;
  let maxActiveThreadWrites = 0;
  let maxActiveThreadReads = 0;
  const repository = {
    ...createMailSyncRepository({}),
    applyGmailThread: async () => {
      activeThreadWrites += 1;
      maxActiveThreadWrites = Math.max(maxActiveThreadWrites, activeThreadWrites);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeThreadWrites -= 1;
    },
  };
  const gmailProvider = {
    ...createGmailSyncProvider(),
    getThread: async () => {
      activeThreadReads += 1;
      maxActiveThreadReads = Math.max(maxActiveThreadReads, activeThreadReads);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeThreadReads -= 1;
      return createRealShapedGmailThread();
    },
    listHistory: async () => ({
      history: [
        {
          messagesAdded: Array.from({ length: 6 }, (_, index) => ({
            message: {
              id: `message-${index}`,
              threadId: `thread-${index}`,
            },
          })),
        },
      ],
      historyId: "176009",
    }),
  };

  await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    {
      gmailProvider,
      lockOwnerId: "queue-message-1",
      now: new Date("2026-06-13T12:00:00.000Z"),
      realtimeNotifier: createRealtimeNotifier(),
      repository,
      tokenProvider: createTokenProvider(),
    },
  );

  assert.equal(maxActiveThreadReads, 5);
  assert.equal(maxActiveThreadWrites, 1);
});

test("uses serverless-safe Prisma transaction timeout for Gmail thread cache writes", async () => {
  const transactionOptions: unknown[] = [];
  const repositoryLayer = MailSyncRepository.layerWithClient(
    createPrismaClientForThreadApplyTest(transactionOptions) as unknown as PrismaClient,
  );

  await runWithMailSyncRepositoryLayer(repositoryLayer, (repository) =>
    repository.applyGmailThread({
      latestMessageId: "message-2",
      mailAccountId: "mail-account-id",
      thread: createRealShapedGmailThread(),
      threadId: "thread-1",
    }),
  );

  assert.deepEqual(transactionOptions, [{ timeout: 120000 }]);
});

test("marks mail account for resync when Gmail history cursor expired", async () => {
  const mutableOperations: string[] = [];
  const mutableLogs: unknown[] = [];
  const repository = createMailSyncRepository({ mutableOperations });
  const gmailProvider = {
    ...createGmailSyncProvider({ mutableOperations }),
    listHistory: async () => {
      mutableOperations.push("list-history:expired");
      throw mailErrors.GMAIL_HISTORY_EXPIRED({
        cause: new Error("Gmail users.history.list endpoint returned HTTP 404"),
        internal: {
          dependencyStatus: 404,
          startHistoryId: "176001",
          userId: "me",
        },
      });
    },
  };

  await processMailSyncEvent(
    {
      mailAccountId: "mail-account-id",
      type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
    },
    {
      gmailProvider,
      lockOwnerId: "queue-message-1",
      log: {
        info: (fields: unknown) => {
          mutableLogs.push(fields);
        },
      },
      now: new Date("2026-06-13T12:00:00.000Z"),
      realtimeNotifier: createRealtimeNotifier(),
      repository,
      tokenProvider: createTokenProvider({ mutableOperations }),
    },
  );

  assert.deepEqual(mutableOperations, [
    "acquire-lock:cursor-id",
    "get-token:user-id:google-account-id",
    "list-history:expired",
    "mark-resync:mail-account-id",
    "release-lock:cursor-id",
  ]);
  assert.equal(mutableLogs.length, 1);
});

test("sync writes Gmail label names and types from catalog with fallback on miss", async () => {
  const labelWrites: unknown[] = [];
  const repositoryLayer = MailSyncRepository.layerWithClient(
    createPrismaClientForThreadApplyTest([], labelWrites) as unknown as PrismaClient,
  );

  await runWithMailSyncRepositoryLayer(repositoryLayer, (repository) =>
    repository.applyGmailThread({
      labelCatalog: new Map([["IMPORTANT", { name: "IMPORTANT", type: "system" }]]),
      latestMessageId: "message-2",
      mailAccountId: "mail-account-id",
      thread: createRealShapedGmailThread(),
      threadId: "thread-1",
    }),
  );

  assert.deepEqual(labelWrites, [
    {
      createName: "INBOX",
      createType: "system",
      providerLabelId: "INBOX",
      updateName: "INBOX",
      updateType: "system",
    },
    {
      createName: "INBOX",
      createType: "system",
      providerLabelId: "INBOX",
      updateName: "INBOX",
      updateType: "system",
    },
    {
      createName: "UNREAD",
      createType: "system",
      providerLabelId: "UNREAD",
      updateName: "UNREAD",
      updateType: "system",
    },
    {
      createName: "IMPORTANT",
      createType: "system",
      providerLabelId: "IMPORTANT",
      updateName: "IMPORTANT",
      updateType: "system",
    },
  ]);
});

test("stores catalog-missing Gmail special labels like YELLOW_STAR as system", async () => {
  const labelWrites: unknown[] = [];
  const repositoryLayer = MailSyncRepository.layerWithClient(
    createPrismaClientForThreadApplyTest([], labelWrites) as unknown as PrismaClient,
  );

  // YELLOW_STAR appears in message labelIds but is never returned by labels.list,
  // so the catalog misses it. It must not be stored as a user label (chips would
  // render "yellow_star"); with a catalog in hand a miss is always "system".
  const thread = createRealShapedGmailThread();
  const starredThread = gmailThreadResponseSchema.parse({
    ...thread,
    messages: thread.messages.map((message, index) =>
      index === 0
        ? { ...message, labelIds: [...(message.labelIds ?? []), "YELLOW_STAR"] }
        : message,
    ),
  });

  await runWithMailSyncRepositoryLayer(repositoryLayer, (repository) =>
    repository.applyGmailThread({
      labelCatalog: new Map([["IMPORTANT", { name: "IMPORTANT", type: "system" }]]),
      latestMessageId: "message-2",
      mailAccountId: "mail-account-id",
      thread: starredThread,
      threadId: "thread-1",
    }),
  );

  const yellowStarWrites = labelWrites.filter(
    (write) => (write as { readonly providerLabelId: string }).providerLabelId === "YELLOW_STAR",
  );

  assert.deepEqual(yellowStarWrites, [
    {
      createName: "YELLOW_STAR",
      createType: "system",
      providerLabelId: "YELLOW_STAR",
      updateName: "YELLOW_STAR",
      updateType: "system",
    },
  ]);
});

test("keeps sync lock ttl derived from queue visibility lease", () => {
  assert.equal(SYNC_LOCK_TTL_MS, SYNC_LEASE_SECONDS * 1000);
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
    markGmailThreadDeleted: async (input: { readonly threadId: string }) => {
      mutableOperations.push(`mark-thread-deleted:${input.threadId}`);
    },
    markMailAccountNeedsResync: async (mailAccountId: string) => {
      mutableOperations.push(`mark-resync:${mailAccountId}`);
    },
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

async function runWithMailSyncRepositoryLayer<A, E>(
  layer: ReturnType<typeof MailSyncRepository.layerWithClient>,
  run: (repository: TestMailSyncRepository) => Effect.Effect<A, E>,
) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const repository = yield* MailSyncRepository;
        return yield* run(repository);
      }),
      layer,
    ),
  );
}

function createPrismaClientForThreadApplyTest(
  transactionOptions: unknown[],
  labelWrites: unknown[] = [],
) {
  const transactionClient = {
    mailLabel: {
      upsert: async (input: {
        readonly create: {
          readonly name: string;
          readonly providerLabelId: string;
          readonly type: string;
        };
        readonly update: {
          readonly name: string;
          readonly type: string;
        };
      }) => {
        labelWrites.push({
          createName: input.create.name,
          createType: input.create.type,
          providerLabelId: input.create.providerLabelId,
          updateName: input.update.name,
          updateType: input.update.type,
        });

        return {
          id: `mail-label-${input.create.providerLabelId}`,
        };
      },
    },
    mailMessage: {
      findUnique: async () => ({ id: "internal-message-2" }),
      upsert: async (input: { readonly create: { readonly providerMessageId: string } }) => ({
        id: `internal-${input.create.providerMessageId}`,
      }),
    },
    mailMessageLabel: {
      create: async () => ({}),
      deleteMany: async () => ({}),
    },
    mailThread: {
      update: async () => ({}),
      upsert: async () => ({ id: "mail-thread-id" }),
    },
  };

  return {
    $transaction: async (
      callback: (client: typeof transactionClient) => Promise<unknown>,
      options?: unknown,
    ) => {
      transactionOptions.push(options);
      return callback(transactionClient);
    },
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
    listLabels: async () => {
      mutableOperations.push("list-labels");
      return [
        {
          id: "IMPORTANT",
          name: "IMPORTANT",
          type: "system",
        },
      ];
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

function createRealtimeNotifier() {
  return {
    publishMailboxChanged: async () => {},
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

function hasMailErrorCode(error: unknown, code: string) {
  const errorCode = (error as { readonly code?: unknown }).code;
  return error instanceof Error && typeof errorCode === "string" && errorCode === code;
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

function createRealShapedSnakeCaseGmailPubSubEnvelope() {
  return {
    message: {
      data: Buffer.from(
        JSON.stringify({
          emailAddress: "demo-user@example.com",
          historyId: "9876543210",
        }),
        "utf8",
      ).toString("base64url"),
      message_id: "2070443601311542",
      publish_time: "2026-06-13T12:02:00.000Z",
    },
    subscription: "projects/rapid-snowfall-498906-b9/subscriptions/gmail-demo-webhook",
  };
}

function createRealShapedUnwrappedGmailPubSubNotification() {
  return {
    emailAddress: "demo-user@example.com",
    historyId: "9876543210",
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
