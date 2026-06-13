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

export type GmailLabel = z.infer<typeof gmailLabelResponseSchema>;
export type GmailMessage = z.infer<typeof gmailMessageResponseSchema>;
export type GmailMessagePart = z.infer<typeof gmailMessagePartSchema>;
