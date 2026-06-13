"use client";

import { CopilotChat, useAgent, UseAgentUpdate } from "@copilotkit/react-core/v2";
import { FileText, Inbox, Pencil, Reply, Search, Send, Sparkles, X } from "lucide-react";
import * as React from "react";

import { Button } from "@code-main/ui/components/button";
import { Separator } from "@code-main/ui/components/separator";
import { cn } from "@code-main/ui/lib/utils";

import type { DraftEmailInput } from "@/features/mail/components/mail-ai-tools";
import { draftEmailParameters } from "@/features/mail/components/mail-ai-tools";

export type DraftEmailDecision = "opened_in_compose" | "sent";
export type DraftPreviewKind = "forward" | "send";

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
      className={cn(
        "h-full shrink-0 overflow-hidden bg-background transition-[width] duration-300 ease-in-out",
        isOpen ? "border-l" : "pointer-events-none",
      )}
      style={{ width: isOpen ? aiPanelWidth : 0 }}
    >
      {/* Fixed-width inner so content does not reflow while the panel slides. */}
      <div className="flex h-full flex-col" style={{ width: aiPanelWidth }}>
        {content}
      </div>
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
  const chatRef = React.useRef<HTMLDivElement>(null);
  const { agent } = useAgent({
    agentId: "default",
    updates: [UseAgentUpdate.OnMessagesChanged],
  });
  const isEmpty = !agent || agent.messages.length === 0;

  const fillPrompt = React.useCallback((prompt: string) => {
    fillChatInput(chatRef.current, prompt);
  }, []);

  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-foreground" />
          <span className="text-sm font-semibold">Ask AI</span>
        </div>
        <Button className="ml-auto size-7" onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
          <span className="sr-only">Close AI panel</span>
        </Button>
      </div>
      <Separator />
      <div className="relative min-h-0 flex-1">
        <div className="mail-copilot-chat h-full" ref={chatRef}>
          <CopilotChat
            agentId="default"
            className="h-full"
            input={{ bottomAnchored: true }}
            labels={{
              chatInputPlaceholder: "Ask anything…",
            }}
            threadId={threadId}
          />
        </div>
        {isEmpty ? <AskAIEmptyState onPick={fillPrompt} /> : null}
      </div>
    </>
  );
}

const aiSuggestions = [
  {
    icon: FileText,
    label: "Summarize this email",
    prompt: "Summarize the selected email in a few bullet points.",
  },
  {
    icon: Reply,
    label: "Draft a reply",
    prompt: "Draft a reply to the selected email.",
  },
  {
    icon: Inbox,
    label: "Show unread mail",
    prompt: "Show my unread emails.",
  },
  {
    icon: Search,
    label: "Find emails from this week",
    prompt: "Find emails from this week.",
  },
] as const;

function AskAIEmptyState({ onPick }: { readonly onPick: (prompt: string) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-28 flex flex-col items-center justify-center px-5">
      <div className="pointer-events-auto w-full max-w-[300px]">
        <div className="mb-4 flex flex-col items-center gap-1.5 text-center">
          <div className="flex size-9 items-center justify-center rounded-full border bg-muted/50">
            <Sparkles className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">How can I help?</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {aiSuggestions.map((suggestion) => (
            <button
              className="flex items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              key={suggestion.label}
              onClick={() => onPick(suggestion.prompt)}
              type="button"
            >
              <suggestion.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{suggestion.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function fillChatInput(container: HTMLElement | null, text: string) {
  const textarea = container?.querySelector("textarea");
  if (!textarea) return;

  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

export function DraftEmailPreviewCard({
  args,
  draftDecisions,
  kind = "send",
  onDecision,
  onOpenDraft,
  onSendDraft,
  status,
}: {
  readonly args: Partial<DraftEmailInput>;
  readonly draftDecisions: Readonly<Record<string, DraftEmailDecision>>;
  readonly kind?: DraftPreviewKind;
  readonly onDecision: (draft: DraftEmailInput, decision: DraftEmailDecision) => void;
  readonly onOpenDraft: (draft: DraftEmailInput) => void;
  readonly onSendDraft: (draft: DraftEmailInput) => Promise<void>;
  readonly result?: string;
  readonly status: "inProgress" | "executing" | "complete";
}) {
  const [error, setError] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const preview = createDraftPreviewState(args, draftDecisions, status, isSending, kind);

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
      <p className="my-2 text-sm leading-relaxed text-foreground">{preview.message}</p>
      <div className="my-2 overflow-hidden rounded-lg border bg-muted/30 text-sm">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-xs font-medium text-foreground">Draft preview</p>
          <p className="text-xs text-muted-foreground">{preview.statusText}</p>
        </div>
        <div className="space-y-2.5 px-3 py-2.5">
          <DraftPreviewField label="To" value={preview.draft.to} />
          <DraftPreviewField label="Subject" value={preview.draft.subject} />
          <div>
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">Body</p>
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {preview.draft.body || "(pending)"}
            </p>
          </div>
          {preview.showValidationError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              Draft needs a valid recipient, subject, and body.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Button
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={!preview.canChoose}
            onClick={() => void choose("opened_in_compose")}
            size="sm"
          >
            <Pencil className="size-3.5" />
            Open
          </Button>
          <Button
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={!preview.canChoose}
            onClick={() => void choose("sent")}
            size="sm"
            variant="outline"
          >
            <Send className="size-3.5" />
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
  kind: DraftPreviewKind,
): DraftPreviewState {
  const validDraft = getValidDraft(args);
  const decision = getDraftDecision(validDraft, draftDecisions);
  const isReady = Boolean(validDraft);

  return {
    canChoose: canChooseDraft(status, isReady, decision, isSending),
    draft: validDraft ?? createPendingDraft(args),
    message: getDraftPreviewMessage(validDraft),
    showValidationError: !validDraft && status !== "inProgress",
    statusText: getDraftStatusText(decision, isReady, isSending, kind),
    validDraft,
  };
}

function canChooseDraft(
  status: "inProgress" | "executing" | "complete",
  isReady: boolean,
  decision: DraftEmailDecision | null,
  isSending: boolean,
) {
  return status !== "inProgress" && isReady && decision === null && !isSending;
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
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-xs text-foreground">{value || "(pending)"}</p>
    </div>
  );
}

const draftKindStatusLabels = {
  forward: { done: "Mail Forwarded", progress: "Forwarding…" },
  send: { done: "Mail Sent", progress: "Sending…" },
} satisfies Record<DraftPreviewKind, { done: string; progress: string }>;

function getDraftStatusText(
  decision: DraftEmailDecision | null,
  isReady: boolean,
  isSending: boolean,
  kind: DraftPreviewKind,
) {
  if (isSending) return draftKindStatusLabels[kind].progress;
  if (decision) return getDraftDecisionStatusText(decision, kind);
  return isReady ? "Review before sending" : "Preparing draft…";
}

function getDraftDecisionStatusText(decision: DraftEmailDecision, kind: DraftPreviewKind) {
  switch (decision) {
    case "sent":
      return draftKindStatusLabels[kind].done;
    case "opened_in_compose":
      return "Opened in compose";
    default:
      return decision satisfies never;
  }
}
