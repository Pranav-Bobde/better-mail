"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { Pencil, Send, Sparkles, X } from "lucide-react";
import * as React from "react";

import { Button } from "@code-main/ui/components/button";
import { Separator } from "@code-main/ui/components/separator";
import { cn } from "@code-main/ui/lib/utils";

import type { DraftEmailInput } from "@/features/mail/components/mail-ai-tools";
import { draftEmailParameters } from "@/features/mail/components/mail-ai-tools";

export type DraftEmailDecision = "opened_in_compose" | "sent";

const aiPanelWidth = 360;

export function draftDecisionKey(draft: DraftEmailInput) {
  return `${draft.to}\n${draft.subject}\n${draft.body}`;
}

export function AskAIPanel({
  isOpen,
  onClose,
  threadId,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly threadId: string;
}) {
  const content = isOpen ? <AskAIPanelContent onClose={onClose} threadId={threadId} /> : null;

  return (
    <div
      aria-hidden={!isOpen}
      className={getAskAIPanelClassName(isOpen)}
      style={getAskAIPanelStyle(isOpen)}
    >
      {content}
    </div>
  );
}

function AskAIPanelContent({
  onClose,
  threadId,
}: {
  readonly onClose: () => void;
  readonly threadId: string;
}) {
  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Ask AI</span>
        <Button className="ml-auto size-7" onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
          <span className="sr-only">Close AI panel</span>
        </Button>
      </div>
      <Separator />
      <div className="mail-copilot-chat min-h-0 flex-1">
        <CopilotChat
          agentId="default"
          className="h-full"
          labels={{
            chatInputPlaceholder: "Ask AI to compose, search, filter, or open mail...",
            welcomeMessageText:
              "Ask me to summarize the current email, draft a reply, search mail, or show unread messages.",
          }}
          threadId={threadId}
        />
      </div>
    </>
  );
}

function getAskAIPanelClassName(isOpen: boolean) {
  return cn(
    "flex h-full flex-col border-l bg-background",
    isOpen ? "opacity-100" : "overflow-hidden opacity-0",
  );
}

function getAskAIPanelStyle(isOpen: boolean): React.CSSProperties {
  const width = isOpen ? aiPanelWidth : 0;

  return {
    flex: `0 0 ${width}px`,
    width,
  };
}

export function DraftEmailPreviewCard({
  args,
  draftDecisions,
  onDecision,
  onOpenDraft,
  onSendDraft,
  status,
}: {
  readonly args: Partial<DraftEmailInput>;
  readonly draftDecisions: Readonly<Record<string, DraftEmailDecision>>;
  readonly onDecision: (draft: DraftEmailInput, decision: DraftEmailDecision) => void;
  readonly onOpenDraft: (draft: DraftEmailInput) => void;
  readonly onSendDraft: (draft: DraftEmailInput) => Promise<void>;
  readonly result?: string;
  readonly status: "inProgress" | "executing" | "complete";
}) {
  const [error, setError] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const preview = createDraftPreviewState(args, draftDecisions, status, isSending);

  function choose(action: DraftEmailDecision) {
    if (!preview.canChoose || !preview.validDraft) return;

    void runDraftDecision(action, preview.validDraft, {
      onDecision,
      onOpenDraft,
      onSendDraft,
      setError,
      setIsSending,
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not complete action.");
    });
  }

  return (
    <>
      <p className="my-2 text-sm leading-6 text-foreground">{preview.message}</p>
      <div className="my-3 overflow-hidden rounded-lg border bg-background text-sm shadow-sm">
        <div className="border-b px-4 py-3">
          <p className="font-semibold">Draft preview</p>
          <p className="mt-1 text-xs text-muted-foreground">{preview.statusText}</p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <DraftPreviewField label="To" value={preview.draft.to} />
          <DraftPreviewField label="Subject" value={preview.draft.subject} />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Body</p>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap leading-6">
              {preview.draft.body || "(pending)"}
            </p>
          </div>
          {preview.showValidationError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Draft needs a valid recipient, subject, and body.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button
            disabled={!preview.canChoose}
            onClick={() => void choose("opened_in_compose")}
            size="sm"
          >
            <Pencil className="size-4" />
            Open
          </Button>
          <Button
            disabled={!preview.canChoose}
            onClick={() => void choose("sent")}
            size="sm"
            variant="outline"
          >
            <Send className="size-4" />
            Send
          </Button>
        </div>
      </div>
    </>
  );
}

type DraftPreviewState = {
  readonly canChoose: boolean;
  readonly draft: DraftEmailInput;
  readonly message: string;
  readonly showValidationError: boolean;
  readonly statusText: string;
  readonly validDraft: DraftEmailInput | null;
};

type DraftDecisionHandlers = {
  readonly onDecision: (draft: DraftEmailInput, decision: DraftEmailDecision) => void;
  readonly onOpenDraft: (draft: DraftEmailInput) => void;
  readonly onSendDraft: (draft: DraftEmailInput) => Promise<void>;
  readonly setError: (error: string) => void;
  readonly setIsSending: (isSending: boolean) => void;
};

function createDraftPreviewState(
  args: Partial<DraftEmailInput>,
  draftDecisions: Readonly<Record<string, DraftEmailDecision>>,
  status: "inProgress" | "executing" | "complete",
  isSending: boolean,
): DraftPreviewState {
  const validDraft = getValidDraft(args);
  const decision = getDraftDecision(validDraft, draftDecisions);

  return {
    canChoose: canChooseDraft(status, validDraft, decision, isSending),
    draft: validDraft ?? createPendingDraft(args),
    message: getDraftPreviewMessage(validDraft),
    showValidationError: !validDraft && status !== "inProgress",
    statusText: getDraftStatusText(decision, status, validDraft?.to, isSending),
    validDraft,
  };
}

function getValidDraft(args: Partial<DraftEmailInput>) {
  const parsedDraft = draftEmailParameters.safeParse(args);

  return parsedDraft.success ? parsedDraft.data : null;
}

function createPendingDraft(args: Partial<DraftEmailInput>) {
  return {
    body: args.body ?? "",
    responseText: args.responseText,
    subject: args.subject ?? "",
    to: args.to ?? "",
  } satisfies DraftEmailInput;
}

function getDraftDecision(
  draft: DraftEmailInput | null,
  draftDecisions: Readonly<Record<string, DraftEmailDecision>>,
) {
  return draft ? (draftDecisions[draftDecisionKey(draft)] ?? null) : null;
}

function getDraftPreviewMessage(draft: DraftEmailInput | null) {
  if (!draft) return "Working on the draft preview.";

  return draft?.responseText ?? "I drafted this email. Review it before sending.";
}

function canChooseDraft(
  status: "inProgress" | "executing" | "complete",
  draft: DraftEmailInput | null,
  decision: DraftEmailDecision | null,
  isSending: boolean,
) {
  return status !== "inProgress" && Boolean(draft) && decision === null && !isSending;
}

async function runDraftDecision(
  action: DraftEmailDecision,
  draft: DraftEmailInput,
  handlers: DraftDecisionHandlers,
) {
  handlers.setError("");

  if (action === "opened_in_compose") {
    handlers.onOpenDraft(draft);
    handlers.onDecision(draft, action);
    return;
  }

  handlers.setIsSending(true);
  try {
    await handlers.onSendDraft(draft);
    handlers.onDecision(draft, action);
  } finally {
    handlers.setIsSending(false);
  }
}

function DraftPreviewField({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="break-words">{value || "(pending)"}</p>
    </div>
  );
}

const draftDecisionStatusText = {
  opened_in_compose: () => "Opened in compose form.",
  sent: (to: string | undefined) => `Sent through Gmail to ${to}.`,
} satisfies Record<DraftEmailDecision, (to: string | undefined) => string>;

const draftToolStatusText = {
  complete: "Review before sending.",
  executing: "Review before sending.",
  inProgress: "Preparing draft...",
} as const;

function getDraftStatusText(
  decision: DraftEmailDecision | null,
  status: "inProgress" | "executing" | "complete",
  to: string | undefined,
  isSending: boolean,
) {
  if (isSending) return "Sending through Gmail...";
  if (decision) return draftDecisionStatusText[decision](to);
  return draftToolStatusText[status];
}
