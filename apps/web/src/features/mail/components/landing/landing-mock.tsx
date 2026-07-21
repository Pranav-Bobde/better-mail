"use client";

/*
 * Faithful, static replica of the real mail workspace for the landing hero.
 * It reuses the ACTUAL product components — `AccountSwitcher` and `Nav` from
 * the mail feature, plus the real shadcn primitives (Button, Badge, Avatar,
 * Input, Separator, Tabs) — and mirrors the exact markup/classes of
 * `mail-list.tsx` and `mail-display.tsx`. Dates are static labels (instead of
 * the live `formatDistanceToNow`) so the hero never depends on the wall clock.
 */

import {
  Archive,
  ArchiveX,
  Clock,
  File,
  Forward,
  Inbox,
  MessagesSquare,
  MoreVertical,
  Pencil,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback } from "@code-main/ui/components/avatar";
import { Badge } from "@code-main/ui/components/badge";
import { Button } from "@code-main/ui/components/button";
import { Input } from "@code-main/ui/components/input";
import { Separator } from "@code-main/ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@code-main/ui/components/tabs";

import { AccountSwitcher } from "@/features/mail/components/account-switcher";
import { Nav, type NavLink } from "@/features/mail/components/nav";

import { BrowserFrame } from "@/features/mail/components/landing/landing-kit";

const ACCENT = "#3b82f6";

const primaryLinks: readonly NavLink[] = [
  { title: "Inbox", label: "12", icon: Inbox, variant: "default" },
  { title: "Drafts", label: "4", icon: File, variant: "ghost" },
  { title: "Sent", label: "", icon: Send, variant: "ghost" },
  { title: "Junk", label: "23", icon: ArchiveX, variant: "ghost" },
  { title: "Trash", label: "", icon: Trash2, variant: "ghost" },
  { title: "Archive", label: "", icon: Archive, variant: "ghost" },
];

const categoryLinks: readonly NavLink[] = [
  { title: "Social", label: "972", icon: Users2, variant: "ghost" },
  { title: "Forums", label: "128", icon: MessagesSquare, variant: "ghost" },
  { title: "Shopping", label: "8", icon: ShoppingCart, variant: "ghost" },
];

type DemoMail = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly preview: string;
  readonly date: string;
  readonly read: boolean;
  readonly labels: readonly string[];
};

const demoMails: readonly DemoMail[] = [
  {
    id: "m1",
    name: "Marcus Lee",
    email: "marcus@harbor.co",
    subject: "Re: Lease — final signature",
    preview:
      "Attaching the signed copy. Let me know if you need anything else from our side before Friday.",
    date: "9:24 AM",
    read: false,
    labels: ["work", "important"],
  },
  {
    id: "m2",
    name: "Dana Okafor",
    email: "dana@okafor.io",
    subject: "Q3 vendor call",
    preview:
      "Can we push the vendor call to Thursday? Happy to work around your afternoon if that's easier.",
    date: "8:41 AM",
    read: false,
    labels: ["work"],
  },
  {
    id: "m3",
    name: "Figma",
    email: "team@figma.com",
    subject: "Your team's weekly digest",
    preview: "3 files edited, 2 comments waiting on you. Here's what moved this week.",
    date: "Tue",
    read: true,
    labels: ["updates"],
  },
  {
    id: "m4",
    name: "Stripe",
    email: "receipts@stripe.com",
    subject: "Payout of $4,120.00 sent",
    preview: "Expected in your account by Jul 18. View the full breakdown in your dashboard.",
    date: "Tue",
    read: true,
    labels: ["personal"],
  },
  {
    id: "m5",
    name: "Priya Nair",
    email: "priya@studio.design",
    subject: "notes from design sync",
    preview:
      "Dropped the recording and action items in the shared doc — tagged you on two of them.",
    date: "Mon",
    read: true,
    labels: ["work"],
  },
];

const SELECTED_ID = "m2";
const DRAFT =
  "Hi Dana — Thursday works well on my end. Let's lock 2pm; I'll send an invite with the vendor shortlist attached so we can dig in.";

function getBadgeVariant(label: string): React.ComponentProps<typeof Badge>["variant"] {
  if (label === "work") return "default";
  if (label === "personal") return "outline";
  return "secondary";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* Mirrors MailListItem from mail-list.tsx (same classes), static date. */
function DemoMailItem({ item, selected }: { item: DemoMail; selected: boolean }) {
  return (
    <div
      className={`flex w-full min-w-0 flex-col items-start gap-2 overflow-hidden rounded-lg border p-3 text-left text-sm transition-all ${
        selected ? "bg-muted" : "hover:bg-accent"
      }`}
    >
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex w-full items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate font-semibold">{item.name}</div>
            {!item.read && <span className="flex size-2 shrink-0 rounded-full bg-blue-600" />}
          </div>
          <div
            className={`ml-auto shrink-0 text-xs ${selected ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.date}
          </div>
        </div>
        <div className="line-clamp-1 w-full break-words text-xs font-medium">{item.subject}</div>
      </div>
      <div className="line-clamp-2 w-full break-words text-xs text-muted-foreground">
        {item.preview}
      </div>
      <div className="flex items-center gap-2">
        {item.labels.map((label) => (
          <Badge key={label} variant={getBadgeVariant(label)}>
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function useTypedDraft(animate: boolean) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!animate) {
      setN(DRAFT.length);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setN(DRAFT.length);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    let i = 0;
    const type = () => {
      i += 1;
      setN(i);
      if (i < DRAFT.length) {
        t = setTimeout(type, 24);
      } else {
        t = setTimeout(() => {
          i = 0;
          setN(0);
          t = setTimeout(type, 900);
        }, 3400);
      }
    };
    t = setTimeout(type, 900);
    return () => clearTimeout(t);
  }, [animate]);
  return DRAFT.slice(0, n);
}

/* Mirrors mail-display.tsx: toolbar + SingleMailBody, with an Ask AI draft card. */
function DetailPane({ animate }: { animate: boolean }) {
  const draft = useTypedDraft(animate);
  const mail = demoMails.find((m) => m.id === SELECTED_ID)!;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 items-center overflow-x-auto p-2">
        <div className="flex items-center gap-1">
          <ToolBtn>
            <Archive className="size-4" />
          </ToolBtn>
          <ToolBtn>
            <ArchiveX className="size-4" />
          </ToolBtn>
          <ToolBtn>
            <Trash2 className="size-4" />
          </ToolBtn>
          <Separator className="mx-0.5 h-6" orientation="vertical" />
          <ToolBtn>
            <Clock className="size-4" />
          </ToolBtn>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ToolBtn>
            <Reply className="size-4" />
          </ToolBtn>
          <ToolBtn>
            <ReplyAll className="size-4" />
          </ToolBtn>
          <ToolBtn>
            <Forward className="size-4" />
          </ToolBtn>
        </div>
        <Separator className="mx-1 h-6" orientation="vertical" />
        <Button size="icon" variant="ghost">
          <MoreVertical className="size-4" />
        </Button>
      </div>
      <Separator />
      {/* sender meta — mirrors SingleMailBody */}
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
        <div className="ml-auto text-xs text-muted-foreground">Tue, 4:02 PM</div>
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-hidden p-4 text-sm leading-relaxed">
        <p>Hi there,</p>
        <p className="mt-3">
          Can we push the vendor call to Thursday? Something came up on my Wednesday and I'd rather
          give this the time it needs. Happy to work around your afternoon.
        </p>
        <p className="mt-3">Thanks, Dana</p>
      </div>
      <Separator className="mt-auto" />
      {/* Ask AI drafting — in place of the reply box */}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" style={{ color: ACCENT }} />
          Ask AI · drafting a reply
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="min-h-[76px] text-sm leading-relaxed">
            {draft}
            <span
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse align-middle"
              style={{ backgroundColor: ACCENT }}
            />
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm">Send</Button>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children }: { children: React.ReactNode }) {
  return (
    <Button size="icon" variant="ghost">
      {children}
    </Button>
  );
}

export function MailAppReplica({ animate = true }: { animate?: boolean } = {}) {
  return (
    <BrowserFrame url="mail.new/inbox">
      {/* Keeps the real 20/32/48 pane proportions; scrolls inside the frame on
          narrow screens rather than the page body. */}
      <div className="overflow-x-auto">
        <div className="grid h-[560px] min-w-[900px] grid-cols-[minmax(0,20fr)_minmax(0,32fr)_minmax(0,48fr)] divide-x divide-border">
          {/* Sidebar — real AccountSwitcher + real Nav */}
          <div className="flex min-w-0 flex-col">
            <div className="flex h-[52px] items-center justify-center px-2">
              <AccountSwitcher isCollapsed={false} />
            </div>
            <Separator />
            <Nav isCollapsed={false} links={primaryLinks} />
            <Separator />
            <Nav isCollapsed={false} links={categoryLinks} />
          </div>

          {/* List — mirrors MailListHeader + MailSearchBox + MailList */}
          <div className="flex min-w-0 flex-col">
            <Tabs className="flex min-h-0 flex-1 flex-col" value="all">
              <div className="flex items-center px-4 py-2">
                <h1 className="text-xl font-bold">Inbox</h1>
                <TabsList className="ml-auto">
                  <TabsTrigger className="text-zinc-600 dark:text-zinc-200" value="all">
                    All mail
                  </TabsTrigger>
                  <TabsTrigger className="text-zinc-600 dark:text-zinc-200" value="unread">
                    Unread
                  </TabsTrigger>
                </TabsList>
                <Button className="ml-2 size-7" size="icon" variant="ghost">
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button className="size-7" size="icon" variant="ghost">
                  <Pencil className="size-3.5" />
                </Button>
              </div>
              <Separator />
              <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search mail" readOnly value="" />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2 p-4 pt-0">
                  {demoMails.map((item) => (
                    <DemoMailItem item={item} key={item.id} selected={item.id === SELECTED_ID} />
                  ))}
                </div>
              </div>
            </Tabs>
          </div>

          {/* Detail */}
          <DetailPane animate={animate} />
        </div>
      </div>
    </BrowserFrame>
  );
}
