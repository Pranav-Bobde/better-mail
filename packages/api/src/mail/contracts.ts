import { z } from "zod";

const mailViewSchema = z.enum(["all", "unread"]);

export const getMailboxInputSchema = z.object({
  query: z.string().max(500),
  view: mailViewSchema,
});

export const sendMailInputSchema = z.object({
  body: z.string().min(1).max(20_000),
  inReplyTo: z.string().min(1).optional(),
  subject: z.string().min(1).max(500),
  threadId: z.string().min(1).optional(),
  to: z.email(),
});

export const getThreadInputSchema = z.object({
  threadId: z.string().min(1),
});

const mailMessageSchema = z.object({
  date: z.string(),
  email: z.email(),
  // Raw HTML body when the message has one; omitted for plain-text-only mail.
  html: z.string().optional(),
  id: z.string(),
  labels: z.array(z.string()),
  name: z.string(),
  read: z.boolean(),
  // Clean, plain-text preview from Gmail used for the message list.
  snippet: z.string().optional(),
  subject: z.string(),
  text: z.string(),
  threadId: z.string(),
});

const mailboxCountsSchema = z.object({
  archive: z.number(),
  drafts: z.number(),
  forums: z.number(),
  inbox: z.number(),
  junk: z.number(),
  promotions: z.number(),
  sent: z.number(),
  shopping: z.number(),
  social: z.number(),
  trash: z.number(),
  unread: z.number(),
  updates: z.number(),
});

const mailboxDataSchema = z.object({
  account: z.object({
    email: z.email(),
    label: z.string(),
  }),
  counts: mailboxCountsSchema,
  messages: z.array(mailMessageSchema),
  source: z.literal("gmail"),
});

export const getMailboxOutputSchema = z.discriminatedUnion("status", [
  z.object({
    data: mailboxDataSchema,
    status: z.literal("ok"),
  }),
  z.object({
    error: z.string(),
    status: z.literal("error"),
  }),
]);

export const sendMailOutputSchema = z.discriminatedUnion("status", [
  z.object({
    data: z.object({
      messageId: z.string(),
      threadId: z.string(),
    }),
    status: z.literal("ok"),
  }),
  z.object({
    error: z.string(),
    status: z.literal("error"),
  }),
]);

export const getThreadOutputSchema = z.discriminatedUnion("status", [
  z.object({
    data: z.object({
      messages: z.array(mailMessageSchema),
    }),
    status: z.literal("ok"),
  }),
  z.object({
    error: z.string(),
    status: z.literal("error"),
  }),
]);

export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailboxData = z.infer<typeof mailboxDataSchema>;
export type GetThreadOutput = z.infer<typeof getThreadOutputSchema>;
