import DOMPurify from "dompurify";
import { format } from "date-fns";
import {
  Archive,
  ArchiveX,
  ChevronDown,
  Clock,
  ExternalLink,
  Forward,
  MailX,
  MoreHorizontal,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@code-main/ui/components/avatar";
import { Button } from "@code-main/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@code-main/ui/components/dropdown-menu";
import { Input } from "@code-main/ui/components/input";
import { Label } from "@code-main/ui/components/label";
import { Separator } from "@code-main/ui/components/separator";
import { Skeleton } from "@code-main/ui/components/skeleton";
import { Switch } from "@code-main/ui/components/switch";
import { Textarea } from "@code-main/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@code-main/ui/components/tooltip";
import { cn } from "@code-main/ui/lib/utils";

import type { ComposeState } from "@/features/mail/components/mail-ai-tools";
import type { Mail } from "@/features/mail/components/mail-data";
import {
  cleanMailPreviewText,
  getBaseSubject,
  getInitials,
  splitQuotedReply,
} from "@/features/mail/components/mail-text";

export function MailDisplay({
  compose,
  composeNotice,
  isSending,
  isThreadLoading,
  mail,
  onCloseCompose,
  onComposeChange,
  onForward,
  onSendCompose,
  onSendReply,
  threadMessages,
}: {
  readonly compose: ComposeState;
  readonly composeNotice: string;
  readonly isSending: boolean;
  readonly isThreadLoading: boolean;
  readonly mail: Mail | null;
  readonly onCloseCompose: () => void;
  readonly onComposeChange: React.Dispatch<React.SetStateAction<ComposeState>>;
  readonly onForward: () => void;
  readonly onSendCompose: () => void;
  readonly onSendReply: (mail: Mail, body: string) => void;
  readonly threadMessages: readonly Mail[] | null;
}) {
  if (compose.open) {
    return (
      <ComposePanel
        compose={compose}
        isSending={isSending}
        notice={composeNotice}
        onChange={onComposeChange}
        onClose={onCloseCompose}
        onSend={onSendCompose}
      />
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center overflow-x-auto p-2">
        <div className="flex items-center gap-1">
          <ToolButton disabled={!mail} label="Archive">
            <Archive className="size-4" />
            <span className="sr-only">Archive</span>
          </ToolButton>
          <ToolButton disabled={!mail} label="Move to junk">
            <ArchiveX className="size-4" />
            <span className="sr-only">Move to junk</span>
          </ToolButton>
          <ToolButton disabled={!mail} label="Move to trash">
            <Trash2 className="size-4" />
            <span className="sr-only">Move to trash</span>
          </ToolButton>
          <Separator className="mx-0.5 h-6" orientation="vertical" />
          <ToolButton disabled={!mail} label="Snooze">
            <Clock className="size-4" />
            <span className="sr-only">Snooze</span>
          </ToolButton>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ToolButton disabled={!mail} label="Reply">
            <Reply className="size-4" />
            <span className="sr-only">Reply</span>
          </ToolButton>
          <ToolButton disabled={!mail} label="Reply all">
            <ReplyAll className="size-4" />
            <span className="sr-only">Reply all</span>
          </ToolButton>
          <ToolButton disabled={!mail} label="Forward" onClick={onForward}>
            <Forward className="size-4" />
            <span className="sr-only">Forward</span>
          </ToolButton>
        </div>
        <Separator className="mx-1 h-6" orientation="vertical" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button disabled={!mail} size="icon" variant="ghost" />}>
            <MoreVertical className="size-4" />
            <span className="sr-only">More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem>Star thread</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem>Mute thread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator />
      {mail ? (
        <SelectedMail
          isSending={isSending}
          isThreadLoading={isThreadLoading}
          mail={mail}
          onSendReply={onSendReply}
          threadMessages={threadMessages}
        />
      ) : (
        <div className="p-8 text-center text-muted-foreground">No message selected</div>
      )}
    </div>
  );
}

function ComposePanel({
  compose,
  isSending,
  notice,
  onChange,
  onClose,
  onSend,
}: {
  readonly compose: ComposeState;
  readonly isSending: boolean;
  readonly notice: string;
  readonly onChange: React.Dispatch<React.SetStateAction<ComposeState>>;
  readonly onClose: () => void;
  readonly onSend: () => void;
}) {
  const canSend = canSendCompose(compose, isSending);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <p className="text-sm font-semibold">New message</p>
        <Button className="ml-auto size-7" onClick={onClose} size="icon" variant="ghost">
          <X className="size-4" />
          <span className="sr-only">Close compose</span>
        </Button>
      </div>
      <Separator />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) {
            onSend();
          }
        }}
      >
        <div className="space-y-3 p-4">
          <Input
            aria-label="To"
            onChange={(event) => onChange((current) => ({ ...current, to: event.target.value }))}
            placeholder="To"
            value={compose.to}
          />
          <Input
            aria-label="Subject"
            onChange={(event) =>
              onChange((current) => ({ ...current, subject: event.target.value }))
            }
            placeholder="Subject"
            value={compose.subject}
          />
        </div>
        <Separator />
        <div className="min-h-0 flex-1 p-4">
          <Textarea
            aria-label="Email body"
            className="h-full min-h-[280px] resize-none p-4"
            onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
            placeholder="Write email"
            value={compose.body}
          />
        </div>
        {notice ? (
          <div className="border-t px-4 py-2 text-xs text-destructive">{notice}</div>
        ) : null}
        <div className="flex items-center border-t p-4">
          <Button className="ml-auto" disabled={!canSend} size="sm" type="submit">
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function canSendCompose(compose: ComposeState, isSending: boolean) {
  return (
    !isSending &&
    [compose.to, compose.subject, compose.body].every((value) => value.trim().length > 0)
  );
}

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button disabled={disabled} onClick={onClick} size="icon" variant="ghost" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SelectedMail({
  isSending,
  isThreadLoading,
  mail,
  onSendReply,
  threadMessages,
}: {
  readonly isSending: boolean;
  readonly isThreadLoading: boolean;
  readonly mail: Mail;
  readonly onSendReply: (mail: Mail, body: string) => void;
  readonly threadMessages: readonly Mail[] | null;
}) {
  // Wait for the conversation to load before committing to a layout, so opening
  // a thread doesn't flash the single-message view and snap to the thread view.
  if (isThreadLoading) {
    return <MailDetailSkeleton />;
  }

  const conversation = getConversation(threadMessages);
  // Gmail returns thread messages oldest-first, so the reply targets the last.
  const replyTarget = conversation?.at(-1) ?? mail;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversation ? (
        <MailThread messages={conversation} selectedId={mail.id} />
      ) : (
        <SingleMailBody mail={mail} />
      )}
      <Separator className="mt-auto" />
      <ThreadReplyForm
        isSending={isSending}
        onSendReply={onSendReply}
        replyTarget={replyTarget}
        resetKey={mail.id}
      />
    </div>
  );
}

// Only treat it as a conversation when the thread actually has more than one
// message; single-message threads keep the original single-message layout.
function getConversation(threadMessages: readonly Mail[] | null) {
  if (threadMessages && threadMessages.length > 1) {
    return threadMessages;
  }

  return null;
}

function ThreadReplyForm({
  isSending,
  onSendReply,
  replyTarget,
  resetKey,
}: {
  readonly isSending: boolean;
  readonly onSendReply: (mail: Mail, body: string) => void;
  readonly replyTarget: Mail;
  readonly resetKey: string;
}) {
  const [replyBody, setReplyBody] = React.useState("");
  const canSend = replyBody.trim().length > 0 && !isSending;

  React.useEffect(() => {
    setReplyBody("");
  }, [resetKey]);

  return (
    <div className="p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (canSend) {
            onSendReply(replyTarget, replyBody.trim());
            setReplyBody("");
          }
        }}
      >
        <div className="grid gap-4">
          <Textarea
            className="p-4"
            key={resetKey}
            onChange={(event) => setReplyBody(event.currentTarget.value)}
            placeholder={`Reply ${replyTarget.name}...`}
            value={replyBody}
          />
          <div className="flex items-center">
            <Label className="flex items-center gap-2 text-xs font-normal" htmlFor="mute">
              <Switch aria-label="Mute thread" id="mute" /> Mute this thread
            </Label>
            <Button className="ml-auto" disabled={!canSend} size="sm" type="submit">
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MailDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="grid gap-2 pt-1">
            <Skeleton className="h-3.5 w-36 rounded-md" />
            <Skeleton className="h-3 w-52 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
        </div>
        <Skeleton className="ml-auto h-3 w-28 rounded-md" />
      </div>
      <Separator />
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-3 w-[92%] rounded-md" />
        <Skeleton className="h-3 w-[88%] rounded-md" />
        <Skeleton className="h-3 w-[95%] rounded-md" />
        <Skeleton className="h-3 w-[60%] rounded-md" />
        <Skeleton className="h-3 w-[78%] rounded-md" />
        <Skeleton className="h-3 w-[40%] rounded-md" />
      </div>
      <Separator className="mt-auto" />
      <div className="p-4">
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

function SingleMailBody({ mail }: { readonly mail: Mail }) {
  return (
    <>
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4 text-sm">
          <Avatar>
            <AvatarFallback>{getInitials(mail.name)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="font-semibold">{mail.name}</div>
            <div className="line-clamp-1 text-xs">{mail.subject}</div>
            <div className="line-clamp-1 text-xs">
              <span className="font-medium">Reply-To:</span> {mail.email}
            </div>
          </div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {format(new Date(mail.date), "PPpp")}
        </div>
      </div>
      <Separator />
      <div className="min-h-0 flex-1">
        <EmailBody mail={mail} />
      </div>
    </>
  );
}

function MailThread({
  messages,
  selectedId,
}: {
  readonly messages: readonly Mail[];
  readonly selectedId: string;
}) {
  const latestMessage = messages.at(-1);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h2 className="line-clamp-1 text-sm font-semibold">
          {getBaseSubject(latestMessage?.subject ?? "")}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">{messages.length} messages</span>
      </div>
      <div className="flex flex-col gap-2 p-4 pt-0">
        {messages.map((message) => (
          <ThreadMessage
            // The newest message and the message the user opened start expanded.
            defaultExpanded={message.id === latestMessage?.id || message.id === selectedId}
            key={message.id}
            message={message}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadMessage({
  defaultExpanded,
  message,
}: {
  readonly defaultExpanded: boolean;
  readonly message: Mail;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">{getInitials(message.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{message.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {format(new Date(message.date), "PP")}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </div>
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {expanded ? message.email : getThreadPreview(message)}
          </span>
        </div>
      </button>
      {/* Animate height with a grid-rows 0fr→1fr transition so expand/collapse
          stays smooth while the body keeps its natural (auto) height. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <Separator />
          <ThreadMessageBody mail={message} />
        </div>
      </div>
    </div>
  );
}

function ThreadMessageBody({ mail }: { readonly mail: Mail }) {
  const html = mail.html?.trim();

  if (html) {
    return <ThreadEmailHtmlFrame html={html} />;
  }

  const bounce = parseBounceNotice(mail.text);

  if (bounce) {
    return <BounceNotice bounce={bounce} />;
  }

  return <ThreadPlainTextBody text={mail.text} />;
}

// Plain-text replies carry the quoted history inline. Show the fresh reply and
// tuck the quote behind a quiet Gmail-style "•••" toggle so long threads stay
// readable without hiding anything the reader might want.
function ThreadPlainTextBody({ text }: { readonly text: string }) {
  const { quoted, visible } = splitQuotedReply(text);
  const [showQuoted, setShowQuoted] = React.useState(false);

  return (
    <div className="p-4 text-sm">
      <div className="whitespace-pre-wrap">{visible}</div>
      {quoted ? (
        <div className="mt-2">
          <button
            aria-expanded={showQuoted}
            aria-label={showQuoted ? "Hide quoted text" : "Show quoted text"}
            className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setShowQuoted((value) => !value)}
            type="button"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {showQuoted ? (
            <div className="mt-2 border-l-2 pl-3 whitespace-pre-wrap text-muted-foreground">
              {quoted}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Thread messages stack in one scroll column, so the HTML frame auto-sizes to
// its content instead of filling a fixed pane like the single-message view.
function ThreadEmailHtmlFrame({ html }: { readonly html: string }) {
  const [srcDoc, setSrcDoc] = React.useState("");
  const [height, setHeight] = React.useState(200);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    setSrcDoc(buildEmailSrcDoc(html));
  }, [html]);

  const syncHeight = React.useCallback(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) {
      setHeight(body.scrollHeight + 8);
    }
  }, []);

  return (
    <iframe
      className="w-full bg-white"
      onLoad={syncHeight}
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      style={{ height }}
      title="Email content"
    />
  );
}

function getThreadPreview(mail: Mail) {
  const source = mail.snippet?.trim() ? mail.snippet : mail.text;
  return cleanMailPreviewText(source);
}

function EmailBody({ mail }: { readonly mail: Mail }) {
  const html = mail.html?.trim();

  if (html) {
    return <EmailHtmlFrame html={html} />;
  }

  // Delivery Status Notifications (bounces) carry no HTML — only a
  // machine-readable delivery-status report. Render a friendly card from it,
  // the way Gmail synthesizes its "Address not found" card.
  const bounce = parseBounceNotice(mail.text);

  if (bounce) {
    return <BounceNotice bounce={bounce} />;
  }

  return <div className="h-full overflow-y-auto p-4 text-sm whitespace-pre-wrap">{mail.text}</div>;
}

type BounceNoticeInfo = {
  readonly diagnostic: string;
  readonly learnMoreUrl: string | null;
  readonly reason: string;
  readonly recipient: string;
  readonly status: string;
  readonly title: string;
};

const bounceReasonByStatus: Readonly<Record<string, { title: string; reason: string }>> = {
  "5.1.1": {
    reason: "the address couldn’t be found or is unable to receive mail",
    title: "Address not found",
  },
  "5.1.3": {
    reason: "the address couldn’t be found or is unable to receive mail",
    title: "Address not found",
  },
  "5.2.1": {
    reason: "the mailbox is disabled or not accepting messages",
    title: "Mailbox unavailable",
  },
  "5.2.2": { reason: "the recipient’s mailbox is full", title: "Mailbox full" },
  "5.4.1": {
    reason: "the recipient’s server didn’t accept the message",
    title: "Address not found",
  },
};

function parseBounceNotice(text: string): BounceNoticeInfo | null {
  const recipient = getBounceRecipient(text);
  const status = getBounceStatus(text);

  if (!recipient || !status) {
    return null;
  }

  const diagnosticRaw = getBounceDiagnosticRaw(text);
  const descriptor = getBounceDescriptor(status);

  return {
    diagnostic: cleanBounceDiagnostic(diagnosticRaw),
    learnMoreUrl: getBounceLearnMoreUrl(diagnosticRaw),
    reason: descriptor.reason,
    recipient,
    status,
    title: descriptor.title,
  };
}

function getBounceRecipient(text: string) {
  return text.match(/Final-Recipient:\s*[^;\r\n]*;\s*([^\s\r\n]+)/i)?.[1];
}

function getBounceStatus(text: string) {
  return text.match(/Status:\s*([\d.]+)/i)?.[1];
}

function getBounceDiagnosticRaw(text: string) {
  return (
    text
      .match(/Diagnostic-Code:\s*[^;\r\n]*;\s*([\s\S]*?)(?:\r?\n[A-Za-z-]+:\s|$)/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function getBounceLearnMoreUrl(diagnosticRaw: string) {
  return diagnosticRaw.match(/https?:\/\/\S+/)?.[0] ?? null;
}

function cleanBounceDiagnostic(diagnosticRaw: string) {
  return diagnosticRaw
    .replace(/\s*For more information,?\s*go to\s*https?:\/\/\S+/i, "")
    .replace(/https?:\/\/\S+/, "")
    .trim();
}

function getBounceDescriptor(status: string) {
  return bounceReasonByStatus[status] ?? getDefaultBounceDescriptor(status);
}

function getDefaultBounceDescriptor(status: string) {
  if (status.startsWith("4")) {
    return { reason: "the server was temporarily unable to deliver it", title: "Delivery delayed" };
  }

  return { reason: "of a delivery error", title: "Message not delivered" };
}

function BounceNotice({ bounce }: { readonly bounce: BounceNoticeInfo }) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-500">
            <MailX className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{bounce.title}</p>
            <p className="text-sm text-muted-foreground">
              Your message wasn’t delivered to{" "}
              <span className="font-medium break-all text-foreground">{bounce.recipient}</span>{" "}
              because {bounce.reason}.
            </p>
          </div>
        </div>
        {bounce.diagnostic ? (
          <p className="mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            {bounce.diagnostic}
          </p>
        ) : null}
        {bounce.learnMoreUrl ? (
          <a
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            href={bounce.learnMoreUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            Learn more
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EmailHtmlFrame({ html }: { readonly html: string }) {
  const [srcDoc, setSrcDoc] = React.useState("");

  React.useEffect(() => {
    setSrcDoc(buildEmailSrcDoc(html));
  }, [html]);

  return (
    <iframe
      className="size-full bg-white"
      // No `allow-scripts`, so no script in the email can ever execute. With
      // scripts disabled, `allow-same-origin` is safe and is required for the
      // srcDoc document to render. Links open in a new tab.
      referrerPolicy="no-referrer"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      title="Email content"
    />
  );
}

const emailBaseStyles = `
  html, body { margin: 0; padding: 0; }
  body {
    padding: 16px;
    background: #ffffff;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100%; }
`;

function buildEmailSrcDoc(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "object", "embed", "form", "iframe"],
  });

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>${emailBaseStyles}</style></head><body>${clean}</body></html>`;
}
