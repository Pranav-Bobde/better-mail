import { z } from "zod";

const mailViewValues = ["all", "unread"] as const;
const dateRangeValues = ["all", "last7Days", "last10Days", "thisWeek"] as const;
const dateRangeQueryByValue = {
  all: "",
  last10Days: "newer_than:10d",
  last7Days: "newer_than:7d",
  thisWeek: "newer_than:7d",
} satisfies Record<(typeof dateRangeValues)[number], string>;
const gmailSearchOperatorPattern =
  /(?:^|\s)(?:after|before|bcc|category|cc|from|has|in|is|label|newer|newer_than|older|older_than|subject|to):/i;

export const draftEmailParameters = z.object({
  to: z.email({ error: "Recipient email is required." }).describe("Recipient email address."),
  subject: z.string().trim().min(1, { error: "Subject is required." }).describe("Email subject."),
  body: z.string().trim().min(1, { error: "Body is required." }).describe("Complete email body."),
  responseText: z
    .string()
    .trim()
    .min(1, { error: "Response text cannot be empty." })
    .optional()
    .describe("Short message shown above the draft preview."),
});

export const filterEmailParameters = z.object({
  dateRange: z.enum(dateRangeValues).optional().describe("Date filter for Gmail search."),
  openLatest: z
    .boolean()
    .optional()
    .describe("Open the latest/first matching email after filtering."),
  query: z.string().optional().describe("Keyword or Gmail search query."),
  sender: z.string().optional().describe("Sender name or email."),
  view: z.enum(mailViewValues).optional().describe("All or unread inbox view."),
});

export const forwardEmailParameters = z.object({
  to: z
    .email({ error: "Recipient email is required." })
    .describe("Forward recipient email address."),
  note: z
    .string()
    .trim()
    .min(1, { error: "Note cannot be empty." })
    .optional()
    .describe("Optional note added above the forwarded message."),
});

export type DraftEmailInput = z.infer<typeof draftEmailParameters>;
export type EmailFilterInput = z.infer<typeof filterEmailParameters>;
export type ForwardEmailInput = z.infer<typeof forwardEmailParameters>;
type ForwardSource = {
  readonly date: string;
  readonly email: string;
  readonly name: string;
  readonly subject: string;
  readonly text: string;
};
type ReplySource = {
  readonly email: string;
  readonly id: string;
  readonly subject: string;
  readonly threadId: string;
};
export type MailView = (typeof mailViewValues)[number];
export type ComposeState = {
  readonly body: string;
  readonly inReplyTo?: string;
  readonly open: boolean;
  readonly subject: string;
  readonly threadId?: string;
  readonly to: string;
};

export const emptyComposeState = {
  body: "",
  open: false,
  subject: "",
  to: "",
} satisfies ComposeState;

export function createAiSearchQuery(input: EmailFilterInput) {
  return [
    formatSenderQuery(input.sender),
    formatDateRangeQuery(input.dateRange),
    input.query?.trim(),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function getAiMailView(input: EmailFilterInput): MailView {
  return input.view ?? "all";
}

export function getClientMailSearchQuery(searchQuery: string, hasServerMailbox: boolean) {
  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery || hasServerMailbox || gmailSearchOperatorPattern.test(normalizedQuery)) {
    return "";
  }

  return normalizedQuery;
}

function formatSenderQuery(sender: string | undefined) {
  const normalizedSender = sender?.trim();
  if (!normalizedSender) return "";

  return /\s/.test(normalizedSender) ? `from:"${normalizedSender}"` : `from:${normalizedSender}`;
}

function formatDateRangeQuery(dateRange: EmailFilterInput["dateRange"]) {
  return dateRange ? dateRangeQueryByValue[dateRange] : "";
}

export function getForwardSubject(subject: string) {
  return /^fwd:/i.test(subject.trim()) ? subject : `Fwd: ${subject}`;
}

export function createForwardBody(mail: ForwardSource, note?: string) {
  const forwardedBlock = [
    "---------- Forwarded message ---------",
    `From: ${mail.name} <${mail.email}>`,
    `Date: ${mail.date}`,
    `Subject: ${mail.subject}`,
    "",
    mail.text,
  ].join("\n");

  const trimmedNote = note?.trim();
  return trimmedNote ? `${trimmedNote}\n\n${forwardedBlock}` : forwardedBlock;
}

export function getReplySubject(subject: string) {
  if (subject.toLowerCase().startsWith("re:")) {
    return subject;
  }

  return `Re: ${subject}`;
}

export function createComposeStateFromDraft(
  draft: DraftEmailInput,
  selectedMail: ReplySource | null,
) {
  const replyContext = getReplyContext(draft, selectedMail);

  return {
    body: draft.body,
    inReplyTo: replyContext?.inReplyTo,
    open: true,
    // Route reply subjects through the idempotent single-Re guard so an AI draft
    // that already starts with "Re:" never turns into "Re: Re:".
    subject: replyContext ? getReplySubject(draft.subject) : draft.subject,
    threadId: replyContext?.threadId,
    to: draft.to,
  } satisfies ComposeState;
}

function getReplyContext(draft: DraftEmailInput, selectedMail: ReplySource | null) {
  if (!selectedMail) {
    return null;
  }

  if (draft.to !== selectedMail.email || !draft.subject.toLowerCase().startsWith("re:")) {
    return null;
  }

  return {
    inReplyTo: selectedMail.id,
    threadId: selectedMail.threadId,
  };
}

// CopilotKit v2 replays a frontend-tool handler whenever the tool re-registers
// (a fresh selectedMail identity or app-context object rebuilds the tool after a
// realtime refetch). Track handled tool-call ids so replays skip their
// side-effects. Returns true the first time an id is claimed and false on every
// replay.
export function claimDraftToolCall(handledKeys: Set<string>, key: string) {
  if (handledKeys.has(key)) {
    return false;
  }

  handledKeys.add(key);
  return true;
}
