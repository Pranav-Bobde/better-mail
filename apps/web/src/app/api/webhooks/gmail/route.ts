import {
  getGmailPubSubPayloadShape,
  gmailPubSubPushEnvelopeSchema,
} from "@code-main/api/mail/sync/contracts";
import {
  createGmailWebhookFields,
  createGmailWebhookInvalidEnvelopeFields,
  type MailSyncWideEventFields,
} from "@code-main/api/mail/sync/observability";
import { createPrismaMailSyncRepository } from "@code-main/api/mail/sync/prisma-mail-sync-repository";

import { useLogger, withEvlog } from "@/shared/lib/evlog";
import { vercelMailSyncBroker } from "@/shared/lib/mail-sync-queue";

const activeMailboxWindowMs = 24 * 60 * 60 * 1000;

async function handleGmailWebhook(request: Request) {
  const log = useLogger<MailSyncWideEventFields>();
  const payload = await request.json();
  const parsedEnvelope = gmailPubSubPushEnvelopeSchema.safeParse(payload);

  if (!parsedEnvelope.success) {
    log.set(
      createGmailWebhookInvalidEnvelopeFields({
        payloadShape: getGmailPubSubPayloadShape(payload),
      }),
    );

    return Response.json({
      status: "error",
      error: "INVALID_GMAIL_PUBSUB_ENVELOPE",
    });
  }

  const repository = createPrismaMailSyncRepository();
  const mailAccount = await repository.findRecentlyActiveGmailMailAccountByEmail({
    activeSince: new Date(Date.now() - activeMailboxWindowMs),
    email: parsedEnvelope.data.gmailNotification.emailAddress,
  });

  if (!mailAccount) {
    log.set(
      createGmailWebhookFields({
        envelope: parsedEnvelope.data,
      }),
    );

    return Response.json({
      status: "ok",
      data: {
        enqueued: false,
      },
    });
  }

  const queueResult = await vercelMailSyncBroker.enqueueMailSyncEvent({
    mailAccountId: mailAccount.id,
    notificationHistoryId: parsedEnvelope.data.gmailNotification.historyId,
    type: "GMAIL_INCREMENTAL_SYNC_REQUESTED",
  });

  log.set(
    createGmailWebhookFields({
      envelope: parsedEnvelope.data,
      mailAccountId: mailAccount.id,
      queueMessageId: queueResult.messageId,
      queueTopicName: queueResult.topicName,
    }),
  );

  return Response.json({
    status: "ok",
    data: {
      enqueued: true,
    },
  });
}

export const POST = withEvlog(handleGmailWebhook);
