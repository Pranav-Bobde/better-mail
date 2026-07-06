import type { z } from "zod";

import type {
  GmailPubSubPayloadShape,
  gmailPubSubPushEnvelopeSchema,
  MailSyncEvent,
} from "./contracts";

type GmailPubSubPushEnvelope = z.infer<typeof gmailPubSubPushEnvelopeSchema>;

export type MailSyncWideEventFields =
  | {
      readonly operation: "mail.sync.webhook.gmail";
      readonly module: "mail";
      readonly handler: "api.webhooks.gmail.POST";
      readonly outcome: "accepted" | "ignored";
      readonly mailSync: GmailWebhookFields;
    }
  | {
      readonly operation: "mail.sync.webhook.gmail";
      readonly module: "mail";
      readonly handler: "api.webhooks.gmail.POST";
      readonly outcome: "error";
      readonly mailSync: GmailWebhookErrorFields;
    }
  | {
      readonly operation: "mail.sync.queue.enqueue";
      readonly module: "mail";
      readonly handler: "vercel.queue.send";
      readonly outcome: "queued";
      readonly mailSync: MailSyncQueueEnqueuedFields;
    }
  | {
      readonly operation: "mail.sync.queue.worker";
      readonly module: "mail";
      readonly handler: "api.queues.mail-sync.POST";
      readonly outcome: "processed" | "retry" | "dropped" | "failed";
      readonly mailSync: MailSyncWorkerFields;
    };

type GmailWebhookFields = {
  readonly provider: "GMAIL";
  readonly pubsubEnvelopeKind: "wrapped" | "unwrapped";
  readonly pubsubMessageId?: string;
  readonly pubsubPublishTime?: string;
  readonly pubsubSubscription?: string;
  readonly notificationHistoryId: string;
  readonly enqueued: boolean;
  readonly mailAccountId?: string;
  readonly queueMessageId?: string | null;
  readonly queueTopicName?: string;
};

type GmailWebhookErrorFields = {
  readonly provider: "GMAIL";
  readonly errorCode: "INVALID_GMAIL_PUBSUB_ENVELOPE";
  readonly payloadShape?: GmailPubSubPayloadShape;
};

type MailSyncQueueEnqueuedFields = {
  readonly eventType: MailSyncEvent["type"];
  readonly idempotencyKey: string;
  readonly mailAccountId: string;
  readonly notificationHistoryId?: string;
  readonly queueMessageId: string | null;
  readonly queueTopicName: string;
  readonly retentionSeconds: number;
};

type MailSyncWorkerFields = {
  readonly consumerGroup: string;
  readonly deliveryCount: number;
  readonly queueMessageId: string;
  readonly queueTopicName: string;
  readonly region: string;
  readonly eventType?: MailSyncEvent["type"];
  readonly mailAccountId?: string;
  readonly notificationHistoryId?: string;
  readonly errorCode?: string;
  readonly errorName?: string;
  readonly retryAfterSeconds?: number;
};

type QueueMetadata = {
  readonly consumerGroup: string;
  readonly deliveryCount: number;
  readonly messageId: string;
  readonly region: string;
  readonly topicName: string;
};

export function createGmailWebhookFields(input: {
  readonly envelope: GmailPubSubPushEnvelope;
  readonly mailAccountId?: string;
  readonly queueMessageId?: string | null;
  readonly queueTopicName?: string;
}): MailSyncWideEventFields {
  return {
    handler: "api.webhooks.gmail.POST",
    mailSync: createGmailWebhookMailSyncFields(input),
    module: "mail",
    operation: "mail.sync.webhook.gmail",
    outcome: input.mailAccountId ? "accepted" : "ignored",
  };
}

export function createGmailWebhookInvalidEnvelopeFields(input?: {
  readonly payloadShape?: GmailPubSubPayloadShape;
}): MailSyncWideEventFields {
  return {
    handler: "api.webhooks.gmail.POST",
    mailSync: {
      errorCode: "INVALID_GMAIL_PUBSUB_ENVELOPE",
      ...(input?.payloadShape ? { payloadShape: input.payloadShape } : {}),
      provider: "GMAIL",
    },
    module: "mail",
    operation: "mail.sync.webhook.gmail",
    outcome: "error",
  };
}

export function createMailSyncQueueEnqueuedFields(input: {
  readonly event: MailSyncEvent;
  readonly idempotencyKey: string;
  readonly messageId: string | null;
  readonly retentionSeconds: number;
  readonly topicName: string;
}): MailSyncWideEventFields {
  return {
    handler: "vercel.queue.send",
    mailSync: {
      eventType: input.event.type,
      idempotencyKey: input.idempotencyKey,
      mailAccountId: input.event.mailAccountId,
      ...(input.event.type === "GMAIL_INCREMENTAL_SYNC_REQUESTED" &&
      input.event.notificationHistoryId
        ? { notificationHistoryId: input.event.notificationHistoryId }
        : {}),
      queueMessageId: input.messageId,
      retentionSeconds: input.retentionSeconds,
      queueTopicName: input.topicName,
    },
    module: "mail",
    operation: "mail.sync.queue.enqueue",
    outcome: "queued",
  };
}

export function createMailSyncWorkerFields(
  input:
    | {
        readonly event: MailSyncEvent;
        readonly metadata: QueueMetadata;
        readonly outcome: "processed";
      }
    | {
        readonly errorCode?: string;
        readonly errorName: string;
        readonly event: MailSyncEvent;
        readonly metadata: QueueMetadata;
        readonly outcome: "failed";
      }
    | {
        readonly errorCode?: string;
        readonly errorName: string;
        readonly metadata: QueueMetadata;
        readonly outcome: "retry" | "dropped";
        readonly retryAfterSeconds?: number;
      },
): MailSyncWideEventFields {
  return {
    handler: "api.queues.mail-sync.POST",
    mailSync:
      input.outcome === "processed"
        ? createProcessedWorkerFields(input.event, input.metadata)
        : input.outcome === "failed"
          ? createFailedWorkerFields(input)
          : createRetryWorkerFields(input),
    module: "mail",
    operation: "mail.sync.queue.worker",
    outcome: input.outcome,
  };
}

function createGmailWebhookMailSyncFields(input: {
  readonly envelope: GmailPubSubPushEnvelope;
  readonly mailAccountId?: string;
  readonly queueMessageId?: string | null;
  readonly queueTopicName?: string;
}): GmailWebhookFields {
  const fields = {
    notificationHistoryId: input.envelope.gmailNotification.historyId,
    provider: "GMAIL" as const,
    pubsubEnvelopeKind: input.envelope.pubsubEnvelopeKind,
    ...getPubSubEnvelopeFields(input.envelope),
  };

  if (!input.mailAccountId) {
    return {
      ...fields,
      enqueued: false,
    };
  }

  return {
    ...fields,
    enqueued: true,
    mailAccountId: input.mailAccountId,
    queueMessageId: input.queueMessageId ?? null,
    queueTopicName: input.queueTopicName,
  };
}

function getPubSubEnvelopeFields(envelope: GmailPubSubPushEnvelope) {
  if (envelope.pubsubEnvelopeKind === "unwrapped") {
    return {};
  }

  return {
    pubsubMessageId: envelope.message.messageId,
    pubsubPublishTime: envelope.message.publishTime,
    pubsubSubscription: envelope.subscription,
  };
}

function createProcessedWorkerFields(
  event: MailSyncEvent,
  metadata: QueueMetadata,
): MailSyncWorkerFields {
  return {
    ...createQueueMetadataFields(metadata),
    eventType: event.type,
    mailAccountId: event.mailAccountId,
    ...getNotificationHistoryFields(event),
  };
}

function createRetryWorkerFields(input: {
  readonly errorCode?: string;
  readonly errorName: string;
  readonly metadata: QueueMetadata;
  readonly retryAfterSeconds?: number;
}): MailSyncWorkerFields {
  return {
    ...createQueueMetadataFields(input.metadata),
    ...getErrorCodeFields(input.errorCode),
    errorName: input.errorName,
    ...getRetryAfterFields(input.retryAfterSeconds),
  };
}

function createFailedWorkerFields(input: {
  readonly errorCode?: string;
  readonly errorName: string;
  readonly event: MailSyncEvent;
  readonly metadata: QueueMetadata;
}): MailSyncWorkerFields {
  return {
    ...createQueueMetadataFields(input.metadata),
    eventType: input.event.type,
    mailAccountId: input.event.mailAccountId,
    ...getNotificationHistoryFields(input.event),
    ...getErrorCodeFields(input.errorCode),
    errorName: input.errorName,
  };
}

function createQueueMetadataFields(metadata: QueueMetadata) {
  return {
    consumerGroup: metadata.consumerGroup,
    deliveryCount: metadata.deliveryCount,
    queueMessageId: metadata.messageId,
    queueTopicName: metadata.topicName,
    region: metadata.region,
  };
}

function getErrorCodeFields(errorCode: string | undefined) {
  if (!errorCode) {
    return {};
  }

  return {
    errorCode,
  };
}

function getNotificationHistoryFields(event: MailSyncEvent) {
  if (event.type !== "GMAIL_INCREMENTAL_SYNC_REQUESTED" || !event.notificationHistoryId) {
    return {};
  }

  return {
    notificationHistoryId: event.notificationHistoryId,
  };
}

function getRetryAfterFields(retryAfterSeconds: number | undefined) {
  if (retryAfterSeconds === undefined) {
    return {};
  }

  return {
    retryAfterSeconds,
  };
}
