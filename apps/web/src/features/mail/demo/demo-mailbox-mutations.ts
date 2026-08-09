import type {
  createDraftInputSchema,
  deleteDraftInputSchema,
  sendMailInputSchema,
  setThreadReadInputSchema,
  updateDraftInputSchema,
} from "@code-main/api/mail/contracts";
import type { z } from "zod";

import type { DemoMessage, DemoProviderLabelId } from "@/features/mail/demo/demo-data";
import { demoAccountEmail, demoAccountName } from "@/features/mail/demo/demo-data";
import type { DemoMailboxState } from "@/features/mail/demo/demo-mailbox-state";

const demoSnippetLength = 120;

type SendDemoMessageInput = z.infer<typeof sendMailInputSchema>;
type SetDemoThreadReadInput = z.infer<typeof setThreadReadInputSchema>;
type CreateDemoDraftInput = z.infer<typeof createDraftInputSchema>;
type UpdateDemoDraftInput = z.infer<typeof updateDraftInputSchema>;
type DeleteDemoDraftInput = z.infer<typeof deleteDraftInputSchema>;

// Gmail's threads.modify applies the label change to every message in the
// thread, which is why the read flag is rewritten across the whole thread.
export function markDemoThreadRead(state: DemoMailboxState, input: SetDemoThreadReadInput) {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.threadId === input.threadId
        ? withDemoProviderLabel(message, "UNREAD", input.read === false)
        : message,
    ),
  } satisfies DemoMailboxState;
}

export function archiveDemoThread(state: DemoMailboxState, input: { readonly threadId: string }) {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.threadId === input.threadId
        ? withDemoProviderLabel(message, "INBOX", false)
        : message,
    ),
  } satisfies DemoMailboxState;
}

export function sendDemoMessage(
  state: DemoMailboxState,
  input: SendDemoMessageInput,
  sentAt: string,
) {
  const threadId = input.threadId ?? `demo-thread-new-${state.nextSequence}`;
  const message = createDemoOutgoingMessage({
    body: input.body,
    date: sentAt,
    id: `demo-msg-new-${state.nextSequence}`,
    providerLabels: ["SENT"],
    subject: input.subject,
    threadId,
    to: input.to,
  });

  return {
    messageId: message.id,
    state: {
      ...state,
      messages: [...state.messages, message],
      nextSequence: state.nextSequence + 1,
    },
    threadId,
  };
}

export function createDemoDraft(
  state: DemoMailboxState,
  input: CreateDemoDraftInput,
  savedAt: string,
) {
  const threadId = input.threadId ?? `demo-thread-new-${state.nextSequence}`;
  const message = createDemoOutgoingMessage({
    body: input.body,
    date: savedAt,
    id: `demo-msg-new-${state.nextSequence}`,
    providerLabels: ["DRAFT"],
    subject: input.subject ?? "",
    threadId,
    to: input.to,
  });
  const draft = {
    draftId: `demo-draft-new-${state.nextSequence}`,
    messageId: message.id,
    threadId,
  };

  return {
    draft,
    state: {
      ...state,
      drafts: [...state.drafts, draft],
      messages: [...state.messages, message],
      nextSequence: state.nextSequence + 1,
    },
  };
}

// Gmail replaces the underlying message when a draft is updated, so the draft
// id survives while the message id changes — the same is true here.
export function updateDemoDraft(
  state: DemoMailboxState,
  input: UpdateDemoDraftInput,
  savedAt: string,
) {
  const previousDraft = state.drafts.find((draft) => draft.draftId === input.draftId);

  if (previousDraft === undefined) {
    return { found: false, state } as const;
  }

  const threadId = input.threadId ?? previousDraft.threadId;
  const message = createDemoOutgoingMessage({
    body: input.body,
    date: savedAt,
    id: `demo-msg-new-${state.nextSequence}`,
    providerLabels: ["DRAFT"],
    subject: input.subject ?? "",
    threadId,
    to: input.to,
  });
  const draft = {
    draftId: previousDraft.draftId,
    messageId: message.id,
    threadId,
  };

  return {
    draft,
    found: true,
    state: {
      ...state,
      drafts: state.drafts.map((candidate) =>
        candidate.draftId === draft.draftId ? draft : candidate,
      ),
      messages: [
        ...state.messages.filter((candidate) => candidate.id !== previousDraft.messageId),
        message,
      ],
      nextSequence: state.nextSequence + 1,
    },
  } as const;
}

// Deleting a draft that is already gone is a success in the real service, so
// the caller's thread id is used as the fallback in the result.
export function deleteDemoDraft(state: DemoMailboxState, input: DeleteDemoDraftInput) {
  const deletedDraft = state.drafts.find((draft) => draft.draftId === input.draftId);

  return {
    state: {
      ...state,
      drafts: state.drafts.filter((draft) => draft.draftId !== input.draftId),
      messages: state.messages.filter((message) => message.id !== deletedDraft?.messageId),
    },
    threadId: deletedDraft?.threadId ?? input.threadId,
  };
}

function createDemoOutgoingMessage(input: {
  readonly body: string;
  readonly date: string;
  readonly id: string;
  readonly providerLabels: readonly DemoProviderLabelId[];
  readonly subject: string;
  readonly threadId: string;
  readonly to?: string;
}) {
  return {
    date: input.date,
    email: demoAccountEmail,
    id: input.id,
    name: demoAccountName,
    providerLabels: input.providerLabels,
    snippet: createDemoSnippet(input.body),
    subject: input.subject,
    text: input.body,
    threadId: input.threadId,
    ...(input.to ? { to: input.to } : {}),
  } satisfies DemoMessage;
}

function createDemoSnippet(body: string) {
  const singleLineBody = body.replaceAll(/\s+/g, " ").trim();

  return singleLineBody.length > demoSnippetLength
    ? `${singleLineBody.slice(0, demoSnippetLength).trimEnd()}…`
    : singleLineBody;
}

function withDemoProviderLabel(
  message: DemoMessage,
  labelId: DemoProviderLabelId,
  present: boolean,
) {
  const hasLabel = message.providerLabels.includes(labelId);

  if (hasLabel === present) {
    return message;
  }

  return {
    ...message,
    providerLabels: present
      ? [...message.providerLabels, labelId]
      : message.providerLabels.filter((candidate) => candidate !== labelId),
  } satisfies DemoMessage;
}
