import { z } from "zod";

const gmailPubSubNotificationSchema = z.object({
  emailAddress: z.email(),
  historyId: z.string(),
});

const gmailPubSubWrappedPushEnvelopeSchema = z.object({
  message: z
    .object({
      attributes: z.record(z.string(), z.string()).optional(),
      data: z.string(),
      messageId: z.string().optional(),
      message_id: z.string().optional(),
      publishTime: z.string().optional(),
      publish_time: z.string().optional(),
    })
    .transform((message, context) => {
      const metadata = getPubSubMessageMetadata(message);

      if (!metadata) {
        context.addIssue({
          code: "custom",
          message: "Invalid Pub/Sub message metadata",
        });
        return z.NEVER;
      }

      return {
        attributes: message.attributes,
        data: message.data,
        ...metadata,
      };
    }),
  subscription: z.string(),
});

const normalizedWrappedGmailPubSubPushEnvelopeSchema =
  gmailPubSubWrappedPushEnvelopeSchema.transform((envelope, context) => {
    const decodedNotification = decodeGmailPubSubNotification(envelope.message.data);
    const parsedNotification = gmailPubSubNotificationSchema.safeParse(decodedNotification);

    if (!parsedNotification.success) {
      context.addIssue({
        code: "custom",
        message: "Invalid Gmail Pub/Sub notification payload",
      });
      return z.NEVER;
    }

    return {
      ...envelope,
      gmailNotification: parsedNotification.data,
      pubsubEnvelopeKind: "wrapped" as const,
    };
  });

const normalizedUnwrappedGmailPubSubPushEnvelopeSchema = gmailPubSubNotificationSchema.transform(
  (gmailNotification) => ({
    gmailNotification,
    pubsubEnvelopeKind: "unwrapped" as const,
  }),
);

export const gmailPubSubPushEnvelopeSchema = z.union([
  normalizedWrappedGmailPubSubPushEnvelopeSchema,
  normalizedUnwrappedGmailPubSubPushEnvelopeSchema,
]);

function decodeGmailPubSubNotification(data: string) {
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function getPubSubMessageMetadata(message: {
  readonly messageId?: string;
  readonly message_id?: string;
  readonly publishTime?: string;
  readonly publish_time?: string;
}) {
  const messageId = getFirstString(message.messageId, message.message_id);
  const publishTime = getFirstString(message.publishTime, message.publish_time);

  if (!messageId || !publishTime) {
    return null;
  }

  return { messageId, publishTime };
}

function getFirstString(primary: string | undefined, fallback: string | undefined) {
  if (primary) {
    return primary;
  }

  return fallback;
}

export const mailSyncEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    mailAccountId: z.string().min(1),
    type: z.literal("GMAIL_BOOTSTRAP_SYNC_REQUESTED"),
  }),
  z.strictObject({
    mailAccountId: z.string().min(1),
    notificationHistoryId: z.string().min(1).optional(),
    type: z.literal("GMAIL_INCREMENTAL_SYNC_REQUESTED"),
  }),
  z.strictObject({
    mailAccountId: z.string().min(1),
    type: z.literal("GMAIL_RENEW_WATCH_REQUESTED"),
  }),
]);

export type MailSyncEvent = z.infer<typeof mailSyncEventSchema>;
