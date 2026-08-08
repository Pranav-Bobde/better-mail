import { z } from "zod";

const mailViewSchema = z.enum(["all", "unread"]);
const mailHeaderValueSchema = z
  .string()
  .min(1)
  .max(998)
  .refine((value) => !value.includes("\r") && !value.includes("\n"), {
    message: "Mail header values cannot contain line breaks",
  });
export const mailFolderSchema = z.enum([
  "inbox",
  "drafts",
  "sent",
  "junk",
  "trash",
  "archive",
  "social",
  "updates",
  "forums",
  "promotions",
]);

export const getMailboxInputSchema = z.object({
  folder: mailFolderSchema.default("inbox"),
  query: z.string().max(500),
  view: mailViewSchema,
});

export const sendMailInputSchema = z.object({
  body: z.string().min(1).max(20_000),
  inReplyTo: mailHeaderValueSchema.optional(),
  subject: z.string().min(1).max(500),
  threadId: z.string().min(1).optional(),
  to: z.email(),
});

export const getThreadInputSchema = z.object({
  threadId: z.string().min(1),
});

export const setThreadReadInputSchema = z.object({
  read: z.boolean(),
  threadId: z.string().min(1),
});

export const archiveThreadInputSchema = z.object({
  threadId: z.string().min(1),
});

// Drafts may be saved before a recipient or subject exists, so both stay
// optional here while the send contract keeps requiring them.
export const createDraftInputSchema = z.object({
  body: z.string().max(20_000),
  inReplyTo: mailHeaderValueSchema.optional(),
  subject: z.string().max(500).optional(),
  threadId: z.string().min(1).optional(),
  to: z.email().optional(),
});

export const updateDraftInputSchema = z.object({
  body: z.string().max(20_000),
  draftId: z.string().min(1),
  inReplyTo: mailHeaderValueSchema.optional(),
  subject: z.string().max(500).optional(),
  threadId: z.string().min(1).optional(),
  to: z.email().optional(),
});

export const deleteDraftInputSchema = z.object({
  draftId: z.string().min(1),
  threadId: z.string().min(1),
});

export const listDraftsInputSchema = z.object({});

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

export const mailboxCountsSchema = z.object({
  drafts: z.number(),
  inboxUnread: z.number(),
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

// Every mail procedure resolves HTTP 200 with this ok/error envelope; non-2xx
// stays reserved for infra failures per refs/backend_api_spec.md.
const createMailOutputSchema = <Data extends z.ZodType>(data: Data) =>
  z.discriminatedUnion("status", [
    z.object({
      data,
      status: z.literal("ok"),
    }),
    z.object({
      error: z.string(),
      status: z.literal("error"),
    }),
  ]);

const draftIdentityDataSchema = z.object({
  draftId: z.string(),
  messageId: z.string(),
  threadId: z.string(),
});

const draftMutationDataSchema = draftIdentityDataSchema.extend({
  cacheApplied: z.boolean(),
});

export const getMailboxOutputSchema = createMailOutputSchema(mailboxDataSchema);

export const sendMailOutputSchema = createMailOutputSchema(
  z.object({
    cacheApplied: z.boolean(),
    messageId: z.string(),
    threadId: z.string(),
  }),
);

// cacheApplied: false means Gmail accepted the change but the local cache
// could not be updated after internal retries — the UI must warn that the
// change may briefly reappear until the next sync heals the cache.
export const setThreadReadOutputSchema = createMailOutputSchema(
  z.object({
    cacheApplied: z.boolean(),
    read: z.boolean(),
    threadId: z.string(),
  }),
);

export const archiveThreadOutputSchema = createMailOutputSchema(
  z.object({
    cacheApplied: z.boolean(),
    threadId: z.string(),
  }),
);

export const createDraftOutputSchema = createMailOutputSchema(draftMutationDataSchema);

export const updateDraftOutputSchema = createMailOutputSchema(draftMutationDataSchema);

export const deleteDraftOutputSchema = createMailOutputSchema(
  z.object({
    cacheApplied: z.boolean(),
    draftId: z.string(),
    threadId: z.string(),
  }),
);

export const listDraftsOutputSchema = createMailOutputSchema(
  z.object({
    drafts: z.array(draftIdentityDataSchema),
  }),
);

export const getThreadOutputSchema = createMailOutputSchema(
  z.object({
    messages: z.array(mailMessageSchema),
  }),
);

export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailboxData = z.infer<typeof mailboxDataSchema>;
export type MailFolder = z.infer<typeof mailFolderSchema>;
export type GetThreadOutput = z.infer<typeof getThreadOutputSchema>;
