import type { MailSyncEvent } from "./contracts";

export const mailSyncQueueTopic = "mail-sync";

export type MailSyncEnqueueResult = {
  readonly idempotencyKey: string;
  readonly messageId: string | null;
  readonly retentionSeconds: number;
  readonly topicName: string;
};

export type MailSyncBroker = {
  readonly enqueueMailSyncEvent: (event: MailSyncEvent) => Promise<MailSyncEnqueueResult>;
};
