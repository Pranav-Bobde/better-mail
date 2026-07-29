import { z } from "zod";

import type { ComposeState } from "@/features/mail/components/mail-ai-tools";

const draftRecipientSchema = z.email();

// Drafts may be saved before a recipient or subject exists; the wire contract
// keeps `to` a strict email when present, so a blank or partial recipient is
// omitted instead of failing validation mid-typing.
export function createDraftInputFromCompose(compose: ComposeState) {
  return {
    body: compose.body,
    ...(compose.inReplyTo ? { inReplyTo: compose.inReplyTo } : {}),
    ...(compose.subject.trim() ? { subject: compose.subject } : {}),
    ...(compose.threadId ? { threadId: compose.threadId } : {}),
    ...getDraftRecipientField(compose.to),
  };
}

function getDraftRecipientField(to: string) {
  const trimmedTo = to.trim();

  return draftRecipientSchema.safeParse(trimmedTo).success ? { to: trimmedTo } : {};
}

export function hasDraftContent(compose: ComposeState) {
  return [compose.to, compose.subject, compose.body].some((value) => value.trim().length > 0);
}

// A drafts-folder mailbox row only carries the From identity (the user), the
// subject, and the plain-text body — the recipient must be re-entered.
export function createComposeStateFromDraftMessage(draftMessage: {
  readonly subject: string;
  readonly text: string;
}) {
  return {
    body: draftMessage.text,
    open: true,
    subject: draftMessage.subject,
    to: "",
  } satisfies ComposeState;
}
