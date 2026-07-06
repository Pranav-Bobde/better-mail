import { z } from "zod";

const gmailPubSubNotificationSchema = z.object({
  emailAddress: z.email(),
  historyId: z.string(),
});

export const gmailPubSubPushEnvelopeSchema = z
  .object({
    message: z.object({
      attributes: z.record(z.string(), z.string()).optional(),
      data: z.string(),
      messageId: z.string(),
      publishTime: z.string(),
    }),
    subscription: z.string(),
  })
  .transform((envelope, context) => {
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
    };
  });

function decodeGmailPubSubNotification(data: string) {
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
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
