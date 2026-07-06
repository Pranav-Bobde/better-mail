import { mailSyncQueueTopic, type MailSyncBroker } from "@code-main/api/mail/sync/broker";
import type { MailSyncEvent } from "@code-main/api/mail/sync/contracts";
import { send } from "@vercel/queue";

const retentionSeconds = 7 * 24 * 60 * 60;

export const vercelMailSyncBroker = {
  enqueueMailSyncEvent: async (event: MailSyncEvent) => {
    const idempotencyKey = getMailSyncEventIdempotencyKey(event);
    const result = await send(mailSyncQueueTopic, event, {
      idempotencyKey,
      retentionSeconds,
    });

    return {
      idempotencyKey,
      messageId: result.messageId,
      retentionSeconds,
      topicName: mailSyncQueueTopic,
    };
  },
} satisfies MailSyncBroker;

function getMailSyncEventIdempotencyKey(event: MailSyncEvent) {
  if (event.type === "GMAIL_INCREMENTAL_SYNC_REQUESTED") {
    return `${event.type}:${event.mailAccountId}:${event.notificationHistoryId ?? "manual"}`;
  }

  return `${event.type}:${event.mailAccountId}`;
}
