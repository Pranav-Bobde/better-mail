import { z } from "zod";

const gmailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const gmailMessageBodySchema = z.object({
  attachmentId: z.string().optional(),
  data: z.string().optional(),
  size: z.number().optional(),
});

const gmailMessagePartBaseSchema = z.object({
  body: gmailMessageBodySchema.optional(),
  filename: z.string().optional(),
  headers: z.array(gmailHeaderSchema).optional(),
  mimeType: z.string().optional(),
  partId: z.string().optional(),
});

const nestedGmailMessagePartSchema = gmailMessagePartBaseSchema.extend({
  parts: z.array(gmailMessagePartBaseSchema).optional(),
});

const gmailMessagePartSchema = gmailMessagePartBaseSchema.extend({
  parts: z.array(nestedGmailMessagePartSchema).optional(),
});

export const gmailTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  token_type: z.string(),
});

export const gmailProfileResponseSchema = z.object({
  emailAddress: z.string(),
  historyId: z.string().optional(),
  messagesTotal: z.number().optional(),
  threadsTotal: z.number().optional(),
});

export const gmailListMessagesResponseSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string(),
      }),
    )
    .optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export const gmailMessageResponseSchema = z.object({
  historyId: z.string().optional(),
  id: z.string(),
  internalDate: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  payload: gmailMessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
  snippet: z.string().optional(),
  threadId: z.string(),
});

export const gmailLabelsListResponseSchema = z.object({
  labels: z
    .array(
      z.object({
        id: z.string(),
        labelListVisibility: z.string().optional(),
        messageListVisibility: z.string().optional(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
});

export const gmailLabelResponseSchema = z.object({
  id: z.string(),
  labelListVisibility: z.string().optional(),
  messageListVisibility: z.string().optional(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  name: z.string(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
  type: z.string(),
});

export const gmailSendResponseSchema = z.object({
  id: z.string(),
  labelIds: z.array(z.string()).optional(),
  threadId: z.string(),
});

export const gmailWatchResponseSchema = z.object({
  expiration: z.string(),
  historyId: z.string(),
});

export const gmailPubSubPushSchema = z.object({
  message: z.object({
    attributes: z.record(z.string(), z.string()).optional(),
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
});

export const gmailPushDataSchema = z.object({
  emailAddress: z.string(),
  historyId: z.union([z.string(), z.number()]).transform((historyId) => String(historyId)),
});

export const gmailDemoStateSchema = z.object({
  emailAddress: z.string().optional(),
  historyId: z.string().optional(),
  updatedAt: z.string(),
  watchExpiration: z.string().optional(),
});

export type GmailLabel = z.infer<typeof gmailLabelResponseSchema>;
export type GmailMessage = z.infer<typeof gmailMessageResponseSchema>;
export type GmailMessagePart = z.infer<typeof gmailMessagePartSchema>;
