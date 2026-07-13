"use client";

import { type GetThreadOutput, type MailboxData } from "@code-main/api/mail/contracts";
import {
  CopilotChatConfigurationProvider,
  CopilotKitProvider,
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  Loader2,
  LogOut,
  MessagesSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@code-main/ui/components/button";
import { Input } from "@code-main/ui/components/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@code-main/ui/components/resizable";
import { Separator } from "@code-main/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@code-main/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@code-main/ui/components/tooltip";
import { cn } from "@code-main/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AccountSwitcher } from "@/features/mail/components/account-switcher";
import {
  AskAIPanel,
  DraftEmailPreviewCard,
  draftDecisionKey,
  type DraftEmailDecision,
} from "@/features/mail/components/ask-ai-panel";
import {
  createAiSearchQuery,
  createForwardBody,
  draftEmailParameters,
  emptyComposeState,
  filterEmailParameters,
  forwardEmailParameters,
  getClientMailSearchQuery,
  getAiMailView,
  getForwardSubject,
  type ComposeState,
  type DraftEmailInput,
  type EmailFilterInput,
  type ForwardEmailInput,
  type MailView,
} from "@/features/mail/components/mail-ai-tools";
import { mails, type Mail as MailItem } from "@/features/mail/components/mail-data";
import { MailDisplay } from "@/features/mail/components/mail-display";
import {
  createMailLayout,
  defaultMailLayout,
  mailPanelIds,
  type MailLayout,
} from "@/features/mail/components/mail-layout";
import { MailList } from "@/features/mail/components/mail-list";
import { MailLoading } from "@/features/mail/components/mail-loading";
import { createMailboxQueryOptions } from "@/features/mail/components/mailbox-query-options";
import { Nav, type NavLink } from "@/features/mail/components/nav";
import { useMailboxRealtimeInvalidation } from "@/features/mail/realtime/use-mailbox-realtime-invalidation";
import { ModeToggle } from "@/shared/components/mode-toggle";
import { authClient } from "@/shared/utils/auth-client";
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

const emptyCounts = {
  archive: 0,
  drafts: 0,
  forums: 0,
  inbox: 0,
  junk: 0,
  promotions: 0,
  sent: 0,
  shopping: 0,
  social: 0,
  trash: 0,
  unread: 0,
  updates: 0,
} satisfies MailboxCounts;

const copilotFetchBindingKey = "__codeMainCopilotFetchBound";

type WindowWithCopilotFetchBinding = Window &
  typeof globalThis & {
    [copilotFetchBindingKey]?: true;
  };

export function Mail({
  defaultCollapsed = false,
  defaultLayout = defaultMailLayout,
  navCollapsedSize = 4,
}: {
  readonly defaultCollapsed?: boolean;
  readonly defaultLayout?: MailLayout;
  readonly navCollapsedSize?: number;
}) {
  bindBrowserFetchForCopilotKit();

  const [threadId] = React.useState(() => `mail-${crypto.randomUUID()}`);

  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" useSingleEndpoint>
      <CopilotChatConfigurationProvider agentId="default" hasExplicitThreadId threadId={threadId}>
        <MailWorkspace
          defaultCollapsed={defaultCollapsed}
          defaultLayout={defaultLayout}
          navCollapsedSize={navCollapsedSize}
          threadId={threadId}
        />
      </CopilotChatConfigurationProvider>
    </CopilotKitProvider>
  );
}

function bindBrowserFetchForCopilotKit() {
  if (typeof window === "undefined") return;

  const browserWindow = window as WindowWithCopilotFetchBinding;
  if (browserWindow[copilotFetchBindingKey]) return;

  // CopilotKit's browser agent currently calls a detached fetch reference in Chrome.
  browserWindow.fetch = browserWindow.fetch.bind(browserWindow);
  browserWindow[copilotFetchBindingKey] = true;
}

function MailWorkspace({
  defaultCollapsed,
  defaultLayout,
  navCollapsedSize,
  threadId,
}: {
  readonly defaultCollapsed: boolean;
  readonly defaultLayout: MailLayout;
  readonly navCollapsedSize: number;
  readonly threadId: string;
}) {
  useMailboxRealtimeInvalidation();

  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [selected, setSelected] = React.useState<MailItem["id"] | null>(mails[0].id);
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [view, setView] = React.useState<MailView>("all");
  const [compose, setCompose] = React.useState<ComposeState>(emptyComposeState);
  const [composeNotice, setComposeNotice] = React.useState("");
  const [activeDraft, setActiveDraft] = React.useState<DraftEmailInput | null>(null);
  const [draftDecisions, setDraftDecisions] = React.useState<Record<string, DraftEmailDecision>>(
    {},
  );
  const [pendingOpenSearchQuery, setPendingOpenSearchQuery] = React.useState<string | null>(null);
  const layout = createMailLayout(defaultLayout);
  const {
    errorMessage: mailboxErrorMessage,
    isFetching: isMailboxFetching,
    mailbox,
    isInitialLoading: isMailboxInitialLoading,
    refetchMailbox,
  } = useMailboxData(searchQuery, view);
  const sendMailMutation = useSendReplyMutation();
  const mailboxViewState = getMailboxViewState(mailbox, mailboxErrorMessage);
  const activeMails = mailboxViewState.activeMails;
  const clientSearchQuery = getClientMailSearchQuery(searchQuery, mailbox !== null);
  const searchFilteredMails = getSearchFilteredMails(activeMails, clientSearchQuery);
  const visibleMails = getVisibleMails(searchFilteredMails, view);
  const counts = mailboxViewState.counts;
  const primaryLinks = React.useMemo(() => createPrimaryLinks(counts), [counts]);
  const categoryLinks = React.useMemo(() => createCategoryLinks(counts), [counts]);
  const selectedMail = getSelectedMail(activeMails, selected);
  const { isLoading: isThreadLoading, messages: threadMessages } = useThreadMessages(selectedMail);
  const openCompose = React.useCallback(() => {
    setCompose({
      ...emptyComposeState,
      open: true,
    });
    setComposeNotice("");
  }, []);
  const closeCompose = React.useCallback(() => {
    setCompose(emptyComposeState);
    setComposeNotice("");
  }, []);
  const toggleAiPanel = React.useCallback(() => setIsAiOpen((value) => !value), []);
  const closeAiPanel = React.useCallback(() => setIsAiOpen(false), []);

  useSelectedMailSync(activeMails, selected, setSelected);
  usePendingOpenLatest(
    activeMails,
    mailbox,
    pendingOpenSearchQuery,
    searchQuery,
    setCompose,
    setPendingOpenSearchQuery,
    setSelected,
  );

  // Keep the search field in sync when the committed query changes from outside
  // the field (e.g. the AI applies a filter). Typing only updates searchInput.
  React.useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const appContext = React.useMemo(
    () => ({
      account: mailbox?.account ?? null,
      activeDraft,
      compose,
      counts,
      filters: {
        query: searchQuery,
        view,
      },
      selectedEmail: selectedMail ? createSelectedMailContext(selectedMail) : null,
      visibleEmails: visibleMails.map(createCompactMailContext),
    }),
    [activeDraft, compose, counts, mailbox?.account, searchQuery, selectedMail, view, visibleMails],
  );

  useAgentContext({
    description:
      "Current mail app state. Use selectedEmail only for selected/current/this email requests.",
    value: appContext,
  });

  // Opening a message must dismiss the compose form — otherwise the compose
  // panel stays mounted over the detail pane and the clicked email appears to do
  // nothing (it opens "behind" compose).
  const handleSelectMail = React.useCallback((id: MailItem["id"] | null) => {
    setSelected(id);
    setCompose(emptyComposeState);
    setComposeNotice("");
  }, []);

  const openDraftInCompose = React.useCallback(
    (draft: DraftEmailInput) => {
      setActiveDraft(draft);
      setCompose(createComposeStateFromDraft(draft, selectedMail));
      setComposeNotice("");
    },
    [selectedMail],
  );

  // A forward starts a brand-new thread to a new recipient: open compose with a
  // quoted "Fwd:" template and no reply/thread context.
  const forwardSelectedMail = React.useCallback(() => {
    if (!selectedMail) {
      return;
    }

    setActiveDraft(null);
    setCompose({
      body: createForwardBody(selectedMail),
      open: true,
      subject: getForwardSubject(selectedMail.subject),
      to: "",
    });
    setComposeNotice("");
  }, [selectedMail]);

  const sendDraft = React.useCallback(
    async (draft: DraftEmailInput) => {
      const nextCompose = createComposeStateFromDraft(draft, selectedMail);
      await sendMailMutation.mutateAsync({
        body: draft.body,
        inReplyTo: nextCompose.inReplyTo,
        subject: draft.subject,
        threadId: nextCompose.threadId,
        to: draft.to,
      });
      setActiveDraft(null);
      setCompose(emptyComposeState);
      setComposeNotice("");
    },
    [selectedMail, sendMailMutation],
  );

  const markDraftDecision = React.useCallback(
    (draft: DraftEmailInput, decision: DraftEmailDecision) => {
      setDraftDecisions((current) => ({
        ...current,
        [draftDecisionKey(draft)]: decision,
      }));
    },
    [],
  );

  const applyEmailFilters = React.useCallback((input: EmailFilterInput) => {
    const nextQuery = createAiSearchQuery(input);
    const nextView = getAiMailView(input);

    setSearchQuery(nextQuery);
    setView(nextView);
    setCompose(emptyComposeState);
    setComposeNotice("");

    if (input.openLatest) {
      setPendingOpenSearchQuery(nextQuery);
      return "I applied the filters and will open the latest matching email when results load.";
    }

    return nextQuery
      ? `I filtered the inbox with "${nextQuery}".`
      : `I switched the inbox to ${nextView}.`;
  }, []);

  useFrontendTool(
    {
      description: getDraftToolDescription(selectedMail),
      followUp: false,
      handler: async (input: DraftEmailInput) => {
        setActiveDraft(input);
        setIsAiOpen(true);
        return `draft_ready: Draft preview ready for ${input.to} with subject "${input.subject}". Awaiting user review.`;
      },
      name: "draftEmail",
      parameters: draftEmailParameters,
      render: (props) => (
        <DraftEmailPreviewCard
          {...props}
          draftDecisions={draftDecisions}
          onDecision={markDraftDecision}
          onOpenDraft={openDraftInCompose}
          onSendDraft={sendDraft}
        />
      ),
    },
    [draftDecisions, markDraftDecision, openDraftInCompose, selectedMail, sendDraft],
  );

  useFrontendTool(
    {
      description:
        "Apply Gmail search filters and update the main message list. Set openLatest when the user asks to open the latest/first matching email.",
      followUp: true,
      handler: async (input: EmailFilterInput) => applyEmailFilters(input),
      name: "filterEmail",
      parameters: filterEmailParameters,
      render: ({ status }) =>
        status === "complete" ? null : (
          <div className="my-1 flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
            Filtering mail...
          </div>
        ),
    },
    [applyEmailFilters],
  );

  useFrontendTool(
    {
      description: getForwardToolDescription(selectedMail),
      followUp: false,
      handler: async (input: ForwardEmailInput) => {
        if (!selectedMail) {
          return "no_selected_email: Ask the user to open the email they want to forward first.";
        }

        setIsAiOpen(true);
        return `forward_ready: Forward preview ready for ${input.to}. Awaiting user review.`;
      },
      name: "forwardEmail",
      parameters: forwardEmailParameters,
      render: (props) => (
        <DraftEmailPreviewCard
          {...props}
          args={createForwardDraftArgs(props.args, selectedMail)}
          draftDecisions={draftDecisions}
          kind="forward"
          onDecision={markDraftDecision}
          onOpenDraft={openDraftInCompose}
          onSendDraft={sendDraft}
        />
      ),
    },
    [draftDecisions, markDraftDecision, openDraftInCompose, selectedMail, sendDraft],
  );

  async function sendCurrentCompose() {
    const result = draftEmailParameters.safeParse(compose);

    if (!result.success) {
      setComposeNotice("To, Subject, and Body are required.");
      return;
    }

    try {
      await sendMailMutation.mutateAsync({
        body: result.data.body,
        inReplyTo: compose.inReplyTo,
        subject: result.data.subject,
        threadId: compose.threadId,
        to: result.data.to,
      });
      setActiveDraft(null);
      setCompose(emptyComposeState);
      setComposeNotice("");
    } catch {
      setComposeNotice("Email send failed. Check the toast for details.");
    }
  }

  // Show a clean loading state on first load instead of flashing demo/fallback
  // data before the real mailbox arrives.
  if (isMailboxInitialLoading) {
    return <MailLoading />;
  }

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      <ResizablePanelGroup
        className="h-full min-w-0 flex-1 items-stretch"
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
        <MailListPanel
          defaultSize={layout[mailPanelIds.list]}
          isAiOpen={isAiOpen}
          isMailboxFetching={isMailboxFetching}
          onOpenCompose={openCompose}
          onRefreshMailbox={refetchMailbox}
          onSearchInputChange={setSearchInput}
          onSearchQueryChange={setSearchQuery}
          onSelectMail={handleSelectMail}
          onToggleAiPanel={toggleAiPanel}
          onViewChange={setView}
          mailboxErrorMessage={mailboxViewState.blockingErrorMessage}
          searchFilteredMails={searchFilteredMails}
          searchInput={searchInput}
          selected={selected}
          view={view}
          visibleMails={visibleMails}
        />
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={toPercent(layout[mailPanelIds.detail])}
          id={mailPanelIds.detail}
          minSize="340px"
        >
          <MailDisplay
            compose={compose}
            composeNotice={composeNotice}
            isSending={sendMailMutation.isPending}
            isThreadLoading={isThreadLoading}
            mail={selectedMail}
            onCloseCompose={closeCompose}
            onComposeChange={setCompose}
            onForward={forwardSelectedMail}
            onSendCompose={() => void sendCurrentCompose()}
            onSendReply={(mail, body) => {
              sendMailMutation.mutate({
                body,
                subject: getReplySubject(mail.subject),
                threadId: mail.threadId,
                to: mail.email,
              });
            }}
            threadMessages={threadMessages}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <AskAIPanel isOpen={isAiOpen} onClose={closeAiPanel} threadId={threadId} />
    </div>
  );
}

function MailListPanel({
  defaultSize,
  isAiOpen,
  isMailboxFetching,
  mailboxErrorMessage,
  onOpenCompose,
  onRefreshMailbox,
  onSearchInputChange,
  onSearchQueryChange,
  onSelectMail,
  onToggleAiPanel,
  onViewChange,
  searchFilteredMails,
  searchInput,
  selected,
  view,
  visibleMails,
}: {
  readonly defaultSize: number | undefined;
  readonly isAiOpen: boolean;
  readonly isMailboxFetching: boolean;
  readonly mailboxErrorMessage: string | null;
  readonly onOpenCompose: () => void;
  readonly onRefreshMailbox: () => void;
  readonly onSearchInputChange: (value: string) => void;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onSelectMail: (id: MailItem["id"] | null) => void;
  readonly onToggleAiPanel: () => void;
  readonly onViewChange: (view: MailView) => void;
  readonly searchFilteredMails: readonly MailItem[];
  readonly searchInput: string;
  readonly selected: MailItem["id"] | null;
  readonly view: MailView;
  readonly visibleMails: readonly MailItem[];
}) {
  return (
    <ResizablePanel defaultSize={toPercent(defaultSize ?? 32)} id={mailPanelIds.list} minSize="30%">
      <Tabs
        className="flex h-full min-h-0 flex-col"
        onValueChange={(value) => onViewChange(toMailView(value))}
        value={view}
      >
        <MailListHeader
          isAiOpen={isAiOpen}
          isMailboxFetching={isMailboxFetching}
          onOpenCompose={onOpenCompose}
          onRefreshMailbox={onRefreshMailbox}
          onToggleAiPanel={onToggleAiPanel}
        />
        <Separator />
        <MailSearchBox
          isMailboxFetching={isMailboxFetching}
          onSearchInputChange={onSearchInputChange}
          onSearchQueryChange={onSearchQueryChange}
          searchInput={searchInput}
        />
        <TabsContent className="m-0 min-h-0 flex-1" value="all">
          {mailboxErrorMessage ? (
            <MailboxErrorState message={mailboxErrorMessage} />
          ) : (
            <MailList items={searchFilteredMails} onSelect={onSelectMail} selected={selected} />
          )}
        </TabsContent>
        <TabsContent className="m-0 min-h-0 flex-1" value="unread">
          {mailboxErrorMessage ? (
            <MailboxErrorState message={mailboxErrorMessage} />
          ) : (
            <MailList items={visibleMails} onSelect={onSelectMail} selected={selected} />
          )}
        </TabsContent>
      </Tabs>
    </ResizablePanel>
  );
}

function MailboxErrorState({ message }: { readonly message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="grid max-w-xs gap-3 rounded-lg border bg-background p-4 text-center">
        <AlertCircle className="mx-auto size-5 text-muted-foreground" />
        <div className="grid gap-1">
          <p className="text-sm font-medium">Gmail needs reconnect</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        <ReconnectGoogleButton />
      </div>
    </div>
  );
}

function ReconnectGoogleButton() {
  const [isPending, setIsPending] = React.useState(false);

  async function reconnect() {
    setIsPending(true);
    const result = await authClient.signIn.social({
      callbackURL: "/",
      errorCallbackURL: "/login",
      provider: "google",
    });

    if (result.error) {
      toast.error(`Error: ${result.error.message ?? "Google reconnect failed."}`);
      setIsPending(false);
    }
  }

  return (
    <Button disabled={isPending} onClick={() => void reconnect()} size="sm">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      Reconnect Google
    </Button>
  );
}

function MailListHeader({
  isAiOpen,
  isMailboxFetching,
  onOpenCompose,
  onRefreshMailbox,
  onToggleAiPanel,
}: {
  readonly isAiOpen: boolean;
  readonly isMailboxFetching: boolean;
  readonly onOpenCompose: () => void;
  readonly onRefreshMailbox: () => void;
  readonly onToggleAiPanel: () => void;
}) {
  return (
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="ml-2 size-7"
              disabled={isMailboxFetching}
              onClick={onRefreshMailbox}
              size="icon"
              variant="ghost"
            />
          }
        >
          <RefreshCw className={cn("size-3.5", isMailboxFetching && "animate-spin")} />
          <span className="sr-only">Refresh mailbox</span>
        </TooltipTrigger>
        <TooltipContent>Refresh mailbox</TooltipContent>
      </Tooltip>
      <Button
        className="ml-2 h-7 gap-1.5 px-2.5 text-xs"
        onClick={onOpenCompose}
        size="sm"
        variant="outline"
      >
        <Pencil className="size-3.5" />
        Compose
      </Button>
      <Button
        className={cn("ml-2 h-7 gap-1.5 px-2.5 text-xs", isAiOpen && "bg-muted text-foreground")}
        onClick={onToggleAiPanel}
        size="sm"
        variant="outline"
      >
        <Sparkles className="size-3.5" />
        Ask AI
      </Button>
    </div>
  );
}

function MailSearchBox({
  isMailboxFetching,
  onSearchInputChange,
  onSearchQueryChange,
  searchInput,
}: {
  readonly isMailboxFetching: boolean;
  readonly onSearchInputChange: (value: string) => void;
  readonly onSearchQueryChange: (value: string) => void;
  readonly searchInput: string;
}) {
  return (
    <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative">
        <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
        <Input
          aria-label="Search mail"
          className="pl-8"
          onChange={(event) => onSearchInputChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearchQueryChange(searchInput.trim());
            }
          }}
          placeholder="Search mail"
          value={searchInput}
        />
        {isMailboxFetching ? (
          <Loader2 className="absolute top-2.5 right-2 size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
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
      <div className={cn("mt-auto grid gap-1 p-2", isCollapsed && "justify-center")}>
        <ModeToggle isCollapsed={isCollapsed} />
        <MailSignOutButton isCollapsed={isCollapsed} />
      </div>
    </ResizablePanel>
  );
}

function MailSignOutButton({ isCollapsed }: { readonly isCollapsed: boolean }) {
  const [isPending, setIsPending] = React.useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
    setIsPending(false);
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              disabled={isPending}
              onClick={() => void signOut()}
              size="icon"
              variant="ghost"
            />
          }
        >
          <LogOut className="size-4" />
          <span className="sr-only">Sign out</span>
        </TooltipTrigger>
        <TooltipContent side="right">Sign out</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      className="w-full justify-start gap-2 px-2 text-muted-foreground"
      disabled={isPending}
      onClick={() => void signOut()}
      variant="ghost"
    >
      <LogOut className="size-4" />
      <span className="text-sm">Sign out</span>
    </Button>
  );
}

function isUnreadMail(item: MailItem) {
  return !item.read;
}

function useMailboxData(searchQuery: string, view: MailView) {
  const mailboxQuery = useQuery(
    orpc.mail.getMailbox.queryOptions(createMailboxQueryOptions({ searchQuery, view })),
  );

  const mailbox = mailboxQuery.data?.status === "ok" ? mailboxQuery.data.data : null;
  const errorMessage = getMailboxQueryErrorMessage(mailboxQuery.error, mailboxQuery.data);

  return {
    errorMessage,
    // True only for the very first load, before any response has arrived.
    isInitialLoading: mailboxQuery.isLoading,
    isFetching: mailboxQuery.isFetching,
    mailbox,
    refetchMailbox: () => {
      void mailboxQuery.refetch();
    },
  };
}

function getMailboxViewState(mailbox: MailboxData | null, errorMessage: string | null) {
  if (errorMessage !== null && mailbox === null) {
    return {
      activeMails: [],
      blockingErrorMessage: errorMessage,
      counts: emptyCounts,
    };
  }

  return {
    activeMails: getActiveMails(mailbox),
    blockingErrorMessage: null,
    counts: getMailboxCounts(mailbox),
  };
}

function getMailboxQueryErrorMessage(
  error: Error | null,
  data:
    | {
        readonly error: string;
        readonly status: "error";
      }
    | {
        readonly status: "ok";
      }
    | undefined,
) {
  if (error) {
    return error.message;
  }

  if (data?.status === "error") {
    return data.error;
  }

  return null;
}

function useThreadMessages(selectedMail: MailItem | null) {
  const threadId = selectedMail?.threadId ?? "";
  const threadQuery = useQuery(
    orpc.mail.getThread.queryOptions({
      enabled: threadId.length > 0,
      input: { threadId },
      meta: {
        silentError: true,
      },
      retry: false,
      staleTime: 5_000,
    }),
  );

  return {
    // Loading the conversation for a freshly selected message (cached threads
    // resolve instantly, so this is only true on a genuine fetch).
    isLoading: threadQuery.isLoading && threadId.length > 0,
    messages: getThreadMessages(threadQuery.data),
  };
}

function getThreadMessages(result: GetThreadOutput | undefined) {
  if (result?.status === "ok") {
    return result.data.messages;
  }

  return null;
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

function usePendingOpenLatest(
  activeMails: readonly MailItem[],
  mailbox: MailboxData | null,
  pendingOpenSearchQuery: string | null,
  searchQuery: string,
  setCompose: React.Dispatch<React.SetStateAction<ComposeState>>,
  setPendingOpenSearchQuery: React.Dispatch<React.SetStateAction<string | null>>,
  setSelected: (id: string | null) => void,
) {
  React.useEffect(() => {
    if (!shouldOpenPendingLatest(pendingOpenSearchQuery, searchQuery, mailbox)) {
      return;
    }

    const nextSelected = activeMails[0]?.id ?? null;
    setSelected(nextSelected);
    setCompose(emptyComposeState);
    setPendingOpenSearchQuery(null);
  }, [
    activeMails,
    mailbox,
    pendingOpenSearchQuery,
    searchQuery,
    setCompose,
    setPendingOpenSearchQuery,
    setSelected,
  ]);
}

function shouldOpenPendingLatest(
  pendingOpenSearchQuery: string | null,
  searchQuery: string,
  mailbox: MailboxData | null,
) {
  return (
    Boolean(mailbox) && pendingOpenSearchQuery !== null && pendingOpenSearchQuery === searchQuery
  );
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

function createCompactMailContext(mail: MailItem) {
  return {
    date: mail.date,
    email: mail.email,
    id: mail.id,
    labels: mail.labels,
    name: mail.name,
    read: mail.read,
    subject: mail.subject,
    threadId: mail.threadId,
  };
}

function createSelectedMailContext(mail: MailItem) {
  return {
    ...createCompactMailContext(mail),
    text: mail.text,
  };
}

function createComposeStateFromDraft(draft: DraftEmailInput, selectedMail: MailItem | null) {
  const replyContext = getReplyContext(draft, selectedMail);

  return {
    body: draft.body,
    inReplyTo: replyContext?.inReplyTo,
    open: true,
    subject: draft.subject,
    threadId: replyContext?.threadId,
    to: draft.to,
  } satisfies ComposeState;
}

function getDraftToolDescription(selectedMail: MailItem | null) {
  if (!selectedMail) {
    return "Draft an email and show a review preview in the Ask AI panel. Do not open the compose form or send — the user opens or sends from the preview.";
  }

  return `Draft an email and show a review preview in the Ask AI panel. Use selected email only when user says selected/current/this email. Selected email is "${selectedMail.subject}" from ${selectedMail.email}. Do not open the compose form or send — the user opens or sends from the preview.`;
}

function getForwardToolDescription(selectedMail: MailItem | null) {
  if (!selectedMail) {
    return "Forward the open email. If no email is open, ask the user to open the email they want to forward first.";
  }

  return `Forward the selected email to a new recipient and show a review preview in the Ask AI panel. The selected email is "${selectedMail.subject}" from ${selectedMail.email}; its content is quoted automatically. Do not send — the user opens or sends from the preview.`;
}

// Turn the forward tool args ({ to, note }) into a draft-preview shape by
// quoting the selected email, so the assistant reuses the same review card.
function createForwardDraftArgs(
  args: Partial<ForwardEmailInput>,
  selectedMail: MailItem | null,
): Partial<DraftEmailInput> {
  if (!selectedMail) {
    return { responseText: args.note, to: args.to };
  }

  return {
    body: createForwardBody(selectedMail, args.note),
    responseText: args.note,
    subject: getForwardSubject(selectedMail.subject),
    to: args.to,
  };
}

function getReplyContext(draft: DraftEmailInput, selectedMail: MailItem | null) {
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

function persistMailLayout(sizes: MailLayout) {
  document.cookie = `react-resizable-panels:layout:mail=${encodeURIComponent(
    JSON.stringify(createMailLayout(sizes)),
  )}; path=/; SameSite=Lax`;
}

function sidebarHeaderClassName(isCollapsed: boolean) {
  return cn("flex h-[52px] items-center", isCollapsed ? "justify-center" : "px-2");
}

function toPercent(size: number) {
  return `${size}%`;
}
