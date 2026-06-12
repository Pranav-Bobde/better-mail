import { format } from "date-fns";
import {
  Archive,
  ArchiveX,
  Clock,
  Forward,
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
import { Switch } from "@code-main/ui/components/switch";
import { Textarea } from "@code-main/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@code-main/ui/components/tooltip";

import type { ComposeState } from "@/features/mail/components/mail-ai-tools";
import type { Mail } from "@/features/mail/components/mail-data";

export function MailDisplay({
  compose,
  composeNotice,
  isSending,
  mail,
  onCloseCompose,
  onComposeChange,
  onSendCompose,
  onSendReply,
}: {
  readonly compose: ComposeState;
  readonly composeNotice: string;
  readonly isSending: boolean;
  readonly mail: Mail | null;
  readonly onCloseCompose: () => void;
  readonly onComposeChange: React.Dispatch<React.SetStateAction<ComposeState>>;
  readonly onSendCompose: () => void;
  readonly onSendReply: (mail: Mail, body: string) => void;
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
    <div className="flex h-full flex-col">
      <div className="flex items-center p-2">
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
          <ToolButton disabled={!mail} label="Forward">
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
        <SelectedMail isSending={isSending} mail={mail} onSendReply={onSendReply} />
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
        <div>
          <p className="text-sm font-semibold">New message</p>
          <p className="text-xs text-muted-foreground">Visible compose form</p>
        </div>
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
  children,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button disabled={disabled} size="icon" variant="ghost" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SelectedMail({
  isSending,
  mail,
  onSendReply,
}: {
  readonly isSending: boolean;
  readonly mail: Mail;
  readonly onSendReply: (mail: Mail, body: string) => void;
}) {
  const [replyBody, setReplyBody] = React.useState("");
  const canSend = replyBody.trim().length > 0 && !isSending;

  React.useEffect(() => {
    setReplyBody("");
  }, [mail.id]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4 text-sm">
          <Avatar>
            <AvatarFallback>
              {mail.name
                .split(" ")
                .map((chunk) => chunk[0])
                .join("")}
            </AvatarFallback>
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
      <div className="flex-1 whitespace-pre-wrap p-4 text-sm">{mail.text}</div>
      <Separator className="mt-auto" />
      <div className="p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (canSend) {
              onSendReply(mail, replyBody.trim());
              setReplyBody("");
            }
          }}
        >
          <div className="grid gap-4">
            <Textarea
              className="p-4"
              key={mail.id}
              onChange={(event) => setReplyBody(event.currentTarget.value)}
              placeholder={`Reply ${mail.name}...`}
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
    </div>
  );
}
