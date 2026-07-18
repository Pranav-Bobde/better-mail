import { mailSyncQueueTopic, type MailSyncBroker } from "@code-main/api/mail/sync/broker";
import type { MailSyncEvent } from "@code-main/api/mail/sync/contracts";
import { DuplicateMessageError, send } from "@vercel/queue";

import { log } from "@/shared/lib/evlog";

const retentionSeconds = 7 * 24 * 60 * 60;
const mailSyncQueueDependencies = {
  send,
};

export const vercelMailSyncBroker = {
  enqueueMailSyncEvent: async (event: MailSyncEvent) => {
    const idempotencyKey = getMailSyncEventIdempotencyKey(event, new Date());

    try {
      const result = await mailSyncQueueDependencies.send(mailSyncQueueTopic, event, {
        idempotencyKey,
        retentionSeconds,
      });

      return {
        idempotencyKey,
        messageId: result.messageId,
        retentionSeconds,
        topicName: mailSyncQueueTopic,
      };
    } catch (error) {
      if (error instanceof DuplicateMessageError) {
        log.info({
          eventName: "mail_sync_enqueue_duplicate",
          eventType: event.type,
          idempotencyKey,
          mailAccountId: event.mailAccountId,
        });

        return {
          idempotencyKey,
          messageId: null,
          retentionSeconds,
          topicName: mailSyncQueueTopic,
        };
      }

      throw error;
    }
  },
} satisfies MailSyncBroker;

export function getMailSyncEventIdempotencyKey(event: MailSyncEvent, now: Date) {
  if (event.type === "GMAIL_INCREMENTAL_SYNC_REQUESTED") {
    return `${event.type}:${event.mailAccountId}:${event.notificationHistoryId ?? `t${Math.floor(now.getTime() / 60_000)}`}`;
  }

  return `${event.type}:${event.mailAccountId}`;
}

export function mockMailSyncQueueSendForTest(sendMock: typeof send) {
  mailSyncQueueDependencies.send = sendMock;

  return () => {
    mailSyncQueueDependencies.send = send;
  };
}
