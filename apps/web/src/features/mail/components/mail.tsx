"use client";

import { type MailboxData } from "@code-main/api/mail/contracts";
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Input } from "@code-main/ui/components/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@code-main/ui/components/resizable";
import { Separator } from "@code-main/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@code-main/ui/components/tabs";
import { cn } from "@code-main/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AccountSwitcher } from "@/features/mail/components/account-switcher";
import { AskAIPanel } from "@/features/mail/components/ask-ai-panel";
import { mails, type Mail as MailItem } from "@/features/mail/components/mail-data";
import { MailDisplay } from "@/features/mail/components/mail-display";
import {
  createMailLayout,
  defaultMailLayout,
  mailPanelIds,
  type MailLayout,
} from "@/features/mail/components/mail-layout";
import { MailList } from "@/features/mail/components/mail-list";
import { Nav, type NavLink } from "@/features/mail/components/nav";
import { ModeToggle } from "@/shared/components/mode-toggle";
import { orpc } from "@/shared/utils/orpc";

type MailboxCounts = MailboxData["counts"];

const fallbackCounts = {
  archive: 0,
  drafts: 9,
  forums: 128,
  inbox: 128,
  junk: 23,
  promotions: 21,
  sent: 0,
  shopping: 8,
  social: 972,
  trash: 0,
  unread: mails.filter(isUnreadMail).length,
  updates: 342,
} satisfies MailboxCounts;

type MailView = "all" | "unread";

export function Mail({
  defaultCollapsed = false,
  defaultLayout = defaultMailLayout,
  navCollapsedSize = 4,
}: {
  readonly defaultCollapsed?: boolean;
  readonly defaultLayout?: MailLayout;
  readonly navCollapsedSize?: number;
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [selected, setSelected] = React.useState<MailItem["id"] | null>(mails[0].id);
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [view, setView] = React.useState<MailView>("all");
  const layout = createMailLayout(defaultLayout);
  const mailbox = useMailboxData(searchQuery, view);
  const sendMailMutation = useSendReplyMutation();
  const activeMails = getActiveMails(mailbox);
  const searchFilteredMails = getSearchFilteredMails(activeMails, searchQuery);
  const visibleMails = getVisibleMails(searchFilteredMails, view);
  const counts = getMailboxCounts(mailbox);
  const primaryLinks = React.useMemo(() => createPrimaryLinks(counts), [counts]);
  const categoryLinks = React.useMemo(() => createCategoryLinks(counts), [counts]);
  const selectedMail = getSelectedMail(activeMails, selected);

  useSelectedMailSync(activeMails, selected, setSelected);

  return (
    <div className="flex h-full">
      <ResizablePanelGroup
        className="h-full flex-1 items-stretch"
        defaultLayout={layout}
        onLayoutChanged={persistMailLayout}
        orientation="horizontal"
      >
        <MailSidebarPanel
          account={mailbox?.account}
          defaultSize={layout[mailPanelIds.sidebar]}
          isCollapsed={isCollapsed}
          navCollapsedSize={navCollapsedSize}
          onCollapsedChange={setIsCollapsed}
          primaryLinks={primaryLinks}
          categoryLinks={categoryLinks}
        />
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={toPercent(layout[mailPanelIds.list])}
          id={mailPanelIds.list}
          minSize="30%"
        >
          <Tabs
            className="flex h-full min-h-0 flex-col"
            onValueChange={(value) => setView(toMailView(value))}
            value={view}
          >
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
              <button
                className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setIsAiOpen((v) => !v)}
                type="button"
              >
                <Sparkles className="size-3.5" />
                Ask AI
              </button>
            </div>
            <Separator />
            <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
                <Input
                  aria-label="Search mail"
                  className="pl-8"
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  placeholder="Search"
                  value={searchQuery}
                />
              </div>
            </div>
            <TabsContent className="m-0 min-h-0 flex-1" value="all">
              <MailList items={searchFilteredMails} onSelect={setSelected} selected={selected} />
            </TabsContent>
            <TabsContent className="m-0 min-h-0 flex-1" value="unread">
              <MailList items={visibleMails} onSelect={setSelected} selected={selected} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={toPercent(layout[mailPanelIds.detail])}
          id={mailPanelIds.detail}
          minSize="340px"
        >
          <MailDisplay
            isSending={sendMailMutation.isPending}
            mail={selectedMail}
            onSendReply={(mail, body) => {
              sendMailMutation.mutate({
                body,
                subject: getReplySubject(mail.subject),
                threadId: mail.threadId,
                to: mail.email,
              });
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <AskAIPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}

function MailSidebarPanel({
  account,
  categoryLinks,
  defaultSize,
  isCollapsed,
  navCollapsedSize,
  onCollapsedChange,
  primaryLinks,
}: {
  readonly account?: {
    readonly email: string;
    readonly label: string;
  };
  readonly categoryLinks: readonly NavLink[];
  readonly defaultSize: number | undefined;
  readonly isCollapsed: boolean;
  readonly navCollapsedSize: number;
  readonly onCollapsedChange: (isCollapsed: boolean) => void;
  readonly primaryLinks: readonly NavLink[];
}) {
  return (
    <ResizablePanel
      className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
      collapsedSize={toPercent(navCollapsedSize)}
      collapsible={true}
      defaultSize={toPercent(defaultSize ?? navCollapsedSize)}
      id={mailPanelIds.sidebar}
      maxSize="20%"
      minSize="15%"
      onResize={(size) => {
        onCollapsedChange(size.asPercentage <= navCollapsedSize + 0.5);
      }}
    >
      <div className={sidebarHeaderClassName(isCollapsed)}>
        <AccountSwitcher account={account} isCollapsed={isCollapsed} />
      </div>
      <Separator />
      <Nav isCollapsed={isCollapsed} links={primaryLinks} />
      <Separator />
      <Nav isCollapsed={isCollapsed} links={categoryLinks} />
      <div className="mt-auto flex justify-center p-2">
        <ModeToggle />
      </div>
    </ResizablePanel>
  );
}

function isUnreadMail(item: MailItem) {
  return !item.read;
}

function useMailboxData(searchQuery: string, view: MailView) {
  const mailboxQuery = useQuery(
    orpc.mail.getMailbox.queryOptions({
      input: {
        query: searchQuery,
        view,
      },
      meta: {
        silentError: true,
      },
      refetchInterval: (query) => (query.state.data?.status === "ok" ? 10_000 : false),
      retry: false,
      staleTime: 5_000,
    }),
  );

  return mailboxQuery.data?.status === "ok" ? mailboxQuery.data.data : null;
}

function useSendReplyMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.send.mutationOptions({
      onError: (error) => {
        toast.error(`Error: ${error.message}`);
      },
      onSuccess: () => {
        toast.success("Email sent");
        queryClient.invalidateQueries({
          queryKey: orpc.mail.getMailbox.key(),
        });
      },
    }),
  );
}

function useSelectedMailSync(
  activeMails: readonly MailItem[],
  selected: string | null,
  setSelected: (id: string | null) => void,
) {
  React.useEffect(() => {
    if (!activeMails.some((item) => item.id === selected)) {
      setSelected(activeMails[0]?.id ?? null);
    }
  }, [activeMails, selected, setSelected]);
}

function getActiveMails(mailbox: MailboxData | null) {
  return mailbox?.messages ?? mails;
}

function getVisibleMails(activeMails: readonly MailItem[], view: MailView) {
  return view === "unread" ? activeMails.filter(isUnreadMail) : activeMails;
}

function getSearchFilteredMails(activeMails: readonly MailItem[], searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return normalizedQuery
    ? activeMails.filter((mail) => getSearchableMailText(mail).includes(normalizedQuery))
    : activeMails;
}

function getSearchableMailText(mail: MailItem) {
  return [mail.name, mail.email, mail.subject, mail.text, ...mail.labels].join(" ").toLowerCase();
}

function getMailboxCounts(mailbox: MailboxData | null) {
  return mailbox?.counts ?? fallbackCounts;
}

function getSelectedMail(activeMails: readonly MailItem[], selected: string | null) {
  return activeMails.find((item) => item.id === selected) ?? null;
}

function createPrimaryLinks(counts: MailboxCounts) {
  return [
    { title: "Inbox", label: String(counts.inbox), icon: Inbox, variant: "default" },
    { title: "Drafts", label: String(counts.drafts), icon: File, variant: "ghost" },
    { title: "Sent", label: String(counts.sent), icon: Send, variant: "ghost" },
    { title: "Junk", label: String(counts.junk), icon: ArchiveX, variant: "ghost" },
    { title: "Trash", label: String(counts.trash), icon: Trash2, variant: "ghost" },
    { title: "Archive", label: String(counts.archive), icon: Archive, variant: "ghost" },
  ] satisfies readonly NavLink[];
}

function createCategoryLinks(counts: MailboxCounts) {
  return [
    { title: "Social", label: String(counts.social), icon: Users2, variant: "ghost" },
    { title: "Updates", label: String(counts.updates), icon: AlertCircle, variant: "ghost" },
    { title: "Forums", label: String(counts.forums), icon: MessagesSquare, variant: "ghost" },
    { title: "Shopping", label: String(counts.shopping), icon: ShoppingCart, variant: "ghost" },
    { title: "Promotions", label: String(counts.promotions), icon: Archive, variant: "ghost" },
  ] satisfies readonly NavLink[];
}

function toMailView(value: string): MailView {
  if (value === "unread") {
    return "unread";
  }

  return "all";
}

function getReplySubject(subject: string) {
  if (subject.toLowerCase().startsWith("re:")) {
    return subject;
  }

  return `Re: ${subject}`;
}

function persistMailLayout(sizes: MailLayout) {
  document.cookie = `react-resizable-panels:layout:mail=${encodeURIComponent(
    JSON.stringify(createMailLayout(sizes)),
  )}; path=/; SameSite=Lax`;
}

function sidebarHeaderClassName(isCollapsed: boolean) {
  return cn("flex h-[52px] items-center justify-center", !isCollapsed && "px-2");
}

function toPercent(size: number) {
  return `${size}%`;
}
