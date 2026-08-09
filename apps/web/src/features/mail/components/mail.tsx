"use client";

import {
  type GetThreadOutput,
  type MailboxData,
  type MailFolder,
  mailFolderSchema,
} from "@code-main/api/mail/contracts";
import { formatMailBadgeCount } from "@code-main/api/mail/label-presentation";
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
  Sparkles,
  Trash2,
  UserPlus,
  Users2,
  UserX,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@code-main/ui/components/button";
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
import { demoWaitlistHref } from "@/features/mail/components/demo-banner";
import {
  AskAIPanel,
  DraftEmailPreviewCard,
  draftDecisionKey,
  type DraftEmailDecision,
} from "@/features/mail/components/ask-ai-panel";
import {
  claimDraftToolCall,
  createAiSearchQuery,
  createComposeStateFromDraft,
  createForwardBody,
  draftEmailParameters,
  emptyComposeState,
  filterEmailParameters,
  forwardEmailParameters,
  getClientMailSearchQuery,
  getAiMailView,
  getForwardSubject,
  getReplySubject,
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
import {
  createMailboxQueryOptions,
  getProviderSelectedMail,
  getThreadQueryId,
  shouldShowMailboxTransitionLoading,
} from "@/features/mail/components/mailbox-query-options";
import { refetchMailboxQuery } from "@/features/mail/components/mailbox-refetch";
import { Nav, type NavLink } from "@/features/mail/components/nav";
import {
  createComposeStateFromDraftMessage,
  createDraftInputFromCompose,
} from "@/features/mail/mutations/compose-draft-input";
import {
  getDeleteAccountErrorMessage,
  getDeleteAccountLabel,
} from "@/features/mail/mutations/delete-account";
import { setManualUnreadIntent } from "@/features/mail/mutations/auto-mark-read";
import { resolveDraftId } from "@/features/mail/mutations/draft-lookup";
import {
  getCacheWriteWarning,
  getMutationErrorPresentation,
  shouldInvalidateAfterCacheWrite,
} from "@/features/mail/mutations/mutation-result";
import { reconnectGoogleAccount } from "@/features/mail/mutations/reconnect-google";
import {
  useArchiveThreadMutation,
  useAutoMarkThreadRead,
  useCreateDraftMutation,
  useDeleteDraftMutation,
  useDraftIdLookup,
  useSetThreadReadMutation,
  useUpdateDraftMutation,
} from "@/features/mail/mutations/use-mail-mutations";
import { useIsDemoMode, useMailRpc } from "@/features/mail/demo/demo-mode";
import { MailboxRealtimeInvalidation } from "@/features/mail/realtime/use-mailbox-realtime-invalidation";
import { ModeToggle } from "@/shared/components/mode-toggle";
import { authClient } from "@/shared/utils/auth-client";
import { orpc } from "@/shared/utils/orpc";

type MailboxCounts = MailboxData["counts"];

const fallbackCounts = {
  drafts: 0,
  inboxUnread: 0,
} satisfies MailboxCounts;

const emptyCounts = {
  drafts: 0,
  inboxUnread: 0,
} satisfies MailboxCounts;

// Demo fixtures are a large, single-purpose payload, so the provider that pulls
// them in is a separate chunk fetched only on /demo. Client-only: the demo
// mailbox is browser module state, and there is nothing to render on the server
// before it exists. The mailbox skeleton covers the extra request.
const DemoProvider = dynamic(
  () =>
    import("@/features/mail/demo/demo-provider").then((demoProvider) => demoProvider.DemoProvider),
  {
    loading: () => <MailLoading />,
    ssr: false,
  },
);

const copilotFetchBindingKey = "__codeMainCopilotFetchBound";

type WindowWithCopilotFetchBinding = Window &
  typeof globalThis & {
    [copilotFetchBindingKey]?: true;
  };

export function Mail({
  defaultCollapsed = false,
  defaultLayout = defaultMailLayout,
  demoMode = false,
  navCollapsedSize = 4,
}: {
  readonly defaultCollapsed?: boolean;
  readonly defaultLayout?: MailLayout;
  readonly demoMode?: boolean;
  readonly navCollapsedSize?: number;
}) {
  bindBrowserFetchForCopilotKit();

  const [threadId] = React.useState(() => `mail-${crypto.randomUUID()}`);

  const workspace = (
    <>
      {/* Realtime needs a session, so the demo never mounts it. Mounted here
          rather than called inside MailWorkspace so its lifetime is unchanged
          for the real app, including while the mailbox is still loading. */}
      {demoMode ? null : <MailboxRealtimeInvalidation />}
      <CopilotKitProvider runtimeUrl={getCopilotRuntimeUrl(demoMode)} useSingleEndpoint>
        <CopilotChatConfigurationProvider agentId="default" hasExplicitThreadId threadId={threadId}>
          <MailWorkspace
            defaultCollapsed={defaultCollapsed}
            defaultLayout={defaultLayout}
            navCollapsedSize={navCollapsedSize}
            threadId={threadId}
          />
        </CopilotChatConfigurationProvider>
      </CopilotKitProvider>
    </>
  );

  if (!demoMode) {
    return workspace;
  }

  return <DemoProvider>{workspace}</DemoProvider>;
}

// The demo talks to a session-free copy of the same CopilotKit runtime.
function getCopilotRuntimeUrl(demoMode: boolean) {
  return demoMode ? "/api/copilotkit/demo" : "/api/copilotkit";
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
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [selected, setSelected] = React.useState<MailItem["id"] | null>(mails[0].id);
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [manualUnreadThreadIds, setManualUnreadThreadIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [view, setView] = React.useState<MailView>("all");
  const [compose, setCompose] = React.useState<ComposeState>(emptyComposeState);
  const [composeNotice, setComposeNotice] = React.useState("");
  const [activeDraft, setActiveDraft] = React.useState<DraftEmailInput | null>(null);
  const [draftDecisions, setDraftDecisions] = React.useState<Record<string, DraftEmailDecision>>(
    {},
  );
  const [pendingOpenSearchQuery, setPendingOpenSearchQuery] = React.useState<string | null>(null);
  // Tool-call ids whose handler side-effects already ran. CopilotKit v2 re-runs a
  // frontend-tool handler each time the tool re-registers, so this guards against
  // replayed setActiveDraft/setIsAiOpen re-opening the panel after a send.
  const handledDraftToolCalls = React.useRef(new Set<string>());
  const layout = createMailLayout(defaultLayout);

  // Folder selection is URL-driven (?folder=sent). The <Link> hrefs below carry
  // the folder param, so back/forward and cmd-click work; TanStack keys the
  // mailbox query per folder, so switching just changes the query key.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const folder = getFolderFromSearchParams(searchParams);
  const buildFolderHref = React.useCallback(
    (targetFolder: MailFolder) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("folder", targetFolder);
      const queryString = params.toString();
      // A UrlObject keeps the href valid under Next's typedRoutes without a cast
      // while preserving every existing search param verbatim.
      return { pathname, search: queryString ? `?${queryString}` : "" };
    },
    [pathname, searchParams],
  );

  useFolderChangeReset(folder, () => setSelected(null));

  const {
    errorMessage: mailboxErrorMessage,
    isFetching: isMailboxFetching,
    isTransitioning: isMailboxTransitioning,
    mailbox,
    isInitialLoading: isMailboxInitialLoading,
    refetchMailbox,
  } = useMailboxData(searchQuery, view, folder);
  const sendMailMutation = useSendReplyMutation();
  const setThreadReadMutation = useSetThreadReadMutation();
  const autoSetThreadReadMutation = useSetThreadReadMutation({ suppressCacheWarning: true });
  const archiveThreadMutation = useArchiveThreadMutation(folder);
  const createDraftMutation = useCreateDraftMutation();
  const updateDraftMutation = useUpdateDraftMutation();
  const deleteDraftMutation = useDeleteDraftMutation();
  const draftIdLookup = useDraftIdLookup(folder);
  // Gmail draft id being edited in compose; while set, "Save draft" updates
  // that draft instead of creating a new one.
  const [editingDraftId, setEditingDraftId] = React.useState<string | null>(null);
  const mailboxViewState = getMailboxViewState(mailbox, mailboxErrorMessage);
  const activeMails = mailboxViewState.activeMails;
  const clientSearchQuery = getClientMailSearchQuery(searchQuery, mailbox !== null);
  const searchFilteredMails = getSearchFilteredMails(activeMails, clientSearchQuery);
  const visibleMails = getVisibleMails(searchFilteredMails, view);
  const counts = mailboxViewState.counts;
  const primaryLinks = React.useMemo(
    () => createPrimaryLinks(counts, folder, buildFolderHref),
    [buildFolderHref, counts, folder],
  );
  const categoryLinks = React.useMemo(
    () => createCategoryLinks(folder, buildFolderHref),
    [buildFolderHref, folder],
  );
  const selectedMail = getSelectedMail(activeMails, selected);
  const providerSelectedMail = getProviderSelectedMail(mailbox !== null, selectedMail);
  const { isLoading: isThreadLoading, messages: threadMessages } = useThreadMessages(
    mailbox !== null,
    selectedMail,
  );
  const openCompose = React.useCallback(() => {
    setCompose({
      ...emptyComposeState,
      open: true,
    });
    setComposeNotice("");
    setEditingDraftId(null);
  }, []);
  const closeCompose = React.useCallback(() => {
    setCompose(emptyComposeState);
    setComposeNotice("");
    setEditingDraftId(null);
  }, []);
  const toggleAiPanel = React.useCallback(() => setIsAiOpen((value) => !value), []);
  const closeAiPanel = React.useCallback(() => setIsAiOpen(false), []);

  useSelectedMailSync(activeMails, selected, setSelected);
  // Opening an unread thread marks it read (new intentional behavior). Gated
  // on a real mailbox so the demo fallback list never fires Gmail mutations.
  useAutoMarkThreadRead(
    providerSelectedMail,
    autoSetThreadReadMutation.mutate,
    manualUnreadThreadIds,
  );
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
  const handleSelectMail = React.useCallback(
    (id: MailItem["id"] | null) => {
      const explicitlyOpenedThreadId = activeMails.find((mail) => mail.id === id)?.threadId;
      if (explicitlyOpenedThreadId) {
        setManualUnreadThreadIds((current) =>
          setManualUnreadIntent(current, explicitlyOpenedThreadId, false),
        );
      }
      setSelected(id);
      setCompose(emptyComposeState);
      setComposeNotice("");
      setEditingDraftId(null);
    },
    [activeMails],
  );

  const openDraftInCompose = React.useCallback(
    (draft: DraftEmailInput) => {
      setActiveDraft(draft);
      setCompose(createComposeStateFromDraft(draft, providerSelectedMail));
      setComposeNotice("");
      setEditingDraftId(null);
    },
    [providerSelectedMail],
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
    setEditingDraftId(null);
  }, [selectedMail]);

  const sendDraft = React.useCallback(
    async (draft: DraftEmailInput) => {
      const nextCompose = createComposeStateFromDraft(draft, providerSelectedMail);
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
    [providerSelectedMail, sendMailMutation],
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
      handler: async (input: DraftEmailInput, context) => {
        const result = `draft_ready: Draft preview ready for ${input.to} with subject "${input.subject}". Awaiting user review.`;

        // On replay, return the same result with no side-effects so the panel
        // never re-opens after the user has sent or dismissed the draft.
        if (!claimDraftToolCall(handledDraftToolCalls.current, context.toolCall.id)) {
          return result;
        }

        setActiveDraft(input);
        // Kept behind the replay guard rather than removed: the run loop can
        // deliver this tool call after the panel closed (the request keeps
        // streaming once the chat unmounts), so a first-time draft still opens
        // the panel to surface its preview.
        setIsAiOpen(true);
        return result;
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
      handler: async (input: ForwardEmailInput, context) => {
        if (!selectedMail) {
          return "no_selected_email: Ask the user to open the email they want to forward first.";
        }

        const result = `forward_ready: Forward preview ready for ${input.to}. Awaiting user review.`;

        // On replay, skip re-opening the panel and return the same result.
        if (!claimDraftToolCall(handledDraftToolCalls.current, context.toolCall.id)) {
          return result;
        }

        setIsAiOpen(true);
        return result;
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

  function toggleSelectedThreadRead() {
    if (!providerSelectedMail) {
      return;
    }

    const read = !providerSelectedMail.read;
    setManualUnreadThreadIds((current) =>
      setManualUnreadIntent(current, providerSelectedMail.threadId, !read),
    );
    setThreadReadMutation.mutate({
      read,
      threadId: providerSelectedMail.threadId,
    });
  }

  function archiveSelectedThread() {
    if (!providerSelectedMail) {
      return;
    }

    archiveThreadMutation.mutate({ threadId: providerSelectedMail.threadId });
  }

  function getSelectedDraftId() {
    if (!providerSelectedMail) {
      return null;
    }

    const draftId = resolveDraftId(draftIdLookup, providerSelectedMail);

    if (draftId === null) {
      toast.error("Could not find this draft. Refresh the mailbox and try again.");
    }

    return draftId;
  }

  // Drafts are low-value and restorable by re-saving, so deleting skips a
  // confirmation dialog.
  function deleteSelectedDraft() {
    const draftId = getSelectedDraftId();

    if (draftId === null || providerSelectedMail === null) {
      return;
    }

    deleteDraftMutation.mutate({ draftId, threadId: providerSelectedMail.threadId });
  }

  function editSelectedDraft() {
    if (!providerSelectedMail) {
      return;
    }

    const draftId = getSelectedDraftId();

    if (draftId === null) {
      return;
    }

    setActiveDraft(null);
    setEditingDraftId(draftId);
    setCompose(createComposeStateFromDraftMessage(providerSelectedMail));
    setComposeNotice("");
  }

  function saveCurrentDraft() {
    const draftInput = createDraftInputFromCompose(compose);

    if (editingDraftId !== null) {
      updateDraftMutation.mutate({ ...draftInput, draftId: editingDraftId });
      return;
    }

    createDraftMutation.mutate(draftInput);
  }

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
      // Record the terminal "sent" state before clearing the active draft so a
      // replayed preview card renders as sent and non-actionable.
      if (activeDraft) {
        markDraftDecision(activeDraft, "sent");
      }
      setActiveDraft(null);
      setCompose(emptyComposeState);
      setComposeNotice("");
      setEditingDraftId(null);
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
          account={getMailboxAccount(mailbox)}
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
          folderTitle={getFolderTitle(folder)}
          isAiOpen={isAiOpen}
          isMailboxFetching={isMailboxFetching}
          isMailboxTransitioning={isMailboxTransitioning}
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
            folder={folder}
            isSavingDraft={isDraftSavePending(createDraftMutation, updateDraftMutation)}
            isSending={sendMailMutation.isPending}
            isThreadLoading={isThreadLoading}
            mail={selectedMail}
            onArchiveThread={archiveSelectedThread}
            onCloseCompose={closeCompose}
            onComposeChange={setCompose}
            onDeleteDraft={deleteSelectedDraft}
            onEditDraft={editSelectedDraft}
            onForward={forwardSelectedMail}
            onSaveDraft={saveCurrentDraft}
            onSendCompose={() => void sendCurrentCompose()}
            onToggleThreadRead={toggleSelectedThreadRead}
            onSendReply={(mail, body) => {
              const providerReplyTarget = getProviderSelectedMail(mailbox !== null, mail);
              if (providerReplyTarget === null) {
                return;
              }

              sendMailMutation.mutate({
                body,
                subject: getReplySubject(providerReplyTarget.subject),
                threadId: providerReplyTarget.threadId,
                to: providerReplyTarget.email,
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
  folderTitle,
  isAiOpen,
  isMailboxFetching,
  isMailboxTransitioning,
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
  readonly folderTitle: string;
  readonly isAiOpen: boolean;
  readonly isMailboxFetching: boolean;
  readonly isMailboxTransitioning: boolean;
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
          folderTitle={folderTitle}
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
          <MailboxListContent
            errorMessage={mailboxErrorMessage}
            isTransitioning={isMailboxTransitioning}
            items={searchFilteredMails}
            onSelect={onSelectMail}
            selected={selected}
          />
        </TabsContent>
        <TabsContent className="m-0 min-h-0 flex-1" value="unread">
          <MailboxListContent
            errorMessage={mailboxErrorMessage}
            isTransitioning={isMailboxTransitioning}
            items={visibleMails}
            onSelect={onSelectMail}
            selected={selected}
          />
        </TabsContent>
      </Tabs>
    </ResizablePanel>
  );
}

function MailboxListContent({
  errorMessage,
  isTransitioning,
  items,
  onSelect,
  selected,
}: {
  readonly errorMessage: string | null;
  readonly isTransitioning: boolean;
  readonly items: readonly MailItem[];
  readonly onSelect: (id: MailItem["id"] | null) => void;
  readonly selected: MailItem["id"] | null;
}) {
  if (isTransitioning) {
    return <MailLoading />;
  }

  return errorMessage ? (
    <MailboxErrorState message={errorMessage} />
  ) : (
    <MailList items={items} onSelect={onSelect} selected={selected} />
  );
}

function MailboxErrorState({ message }: { readonly message: string }) {
  const presentation = getMutationErrorPresentation(message);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="grid max-w-xs gap-3 rounded-lg border bg-background p-4 text-center">
        <AlertCircle className="mx-auto size-5 text-muted-foreground" />
        <div className="grid gap-1">
          <p className="text-sm font-medium">{presentation.title}</p>
          <p className="text-xs text-muted-foreground">{presentation.message}</p>
        </div>
        {presentation.kind === "reconnect" ? <ReconnectGoogleButton /> : null}
      </div>
    </div>
  );
}

function ReconnectGoogleButton() {
  const [isPending, setIsPending] = React.useState(false);

  async function reconnect() {
    setIsPending(true);
    const started = await reconnectGoogleAccount();

    if (!started) {
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
  folderTitle,
  isAiOpen,
  isMailboxFetching,
  onOpenCompose,
  onRefreshMailbox,
  onToggleAiPanel,
}: {
  readonly folderTitle: string;
  readonly isAiOpen: boolean;
  readonly isMailboxFetching: boolean;
  readonly onOpenCompose: () => void;
  readonly onRefreshMailbox: () => void;
  readonly onToggleAiPanel: () => void;
}) {
  return (
    <div className="flex items-center px-4 py-2">
      <h1 className="text-xl font-bold">{folderTitle}</h1>
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
        <MailAccountActions isCollapsed={isCollapsed} />
      </div>
    </ResizablePanel>
  );
}

// The demo has no session to sign out of and no account to delete, so it swaps
// both auth actions for the single action it can offer.
function MailAccountActions({ isCollapsed }: { readonly isCollapsed: boolean }) {
  const isDemoMode = useIsDemoMode();

  if (isDemoMode) {
    return <MailWaitlistButton isCollapsed={isCollapsed} />;
  }

  return (
    <>
      <MailSignOutButton isCollapsed={isCollapsed} />
      <MailDeleteAccountButton isCollapsed={isCollapsed} />
    </>
  );
}

function MailWaitlistButton({ isCollapsed }: { readonly isCollapsed: boolean }) {
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              className={buttonVariants({ size: "icon", variant: "ghost" })}
              href={demoWaitlistHref}
            />
          }
        >
          <UserPlus className="size-4" />
          <span className="sr-only">Join the waitlist</span>
        </TooltipTrigger>
        <TooltipContent side="right">Join the waitlist</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "w-full justify-start gap-2 px-2 text-muted-foreground",
      )}
      href={demoWaitlistHref}
    >
      <UserPlus className="size-4" />
      <span className="text-sm">Join the waitlist</span>
    </Link>
  );
}

function MailSignOutButton({ isCollapsed }: { readonly isCollapsed: boolean }) {
  const [isPending, setIsPending] = React.useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
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

// Two-step inline confirm instead of a dialog: the first click arms the
// destructive state, blurring disarms it. Deletion cascades all synced mail
// data and best-effort revokes the Google grant server-side.
function MailDeleteAccountButton({ isCollapsed }: { readonly isCollapsed: boolean }) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const label = getDeleteAccountLabel(isConfirming);
  const confirmClassName = cn(isConfirming && "text-destructive hover:text-destructive");

  async function deleteAccount() {
    setIsPending(true);
    const { error } = await authClient.deleteUser();

    if (error) {
      toast.error(getDeleteAccountErrorMessage(error));
      setIsPending(false);
      setIsConfirming(false);
      return;
    }

    // Better Auth already removed the session and cleared its cookie; land on
    // the logged-out landing page.
    window.location.href = "/";
  }

  function handleClick() {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    void deleteAccount();
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className={confirmClassName}
              disabled={isPending}
              onBlur={() => setIsConfirming(false)}
              onClick={handleClick}
              size="icon"
              variant="ghost"
            />
          }
        >
          <UserX className="size-4" />
          <span className="sr-only">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      className={cn("w-full justify-start gap-2 px-2 text-muted-foreground", confirmClassName)}
      disabled={isPending}
      onBlur={() => setIsConfirming(false)}
      onClick={handleClick}
      variant="ghost"
    >
      <UserX className="size-4" />
      <span className="text-sm">{label}</span>
    </Button>
  );
}

function isUnreadMail(item: MailItem) {
  return !item.read;
}

function useMailboxData(searchQuery: string, view: MailView, folder: MailFolder) {
  const queryClient = useQueryClient();
  const mailRpc = useMailRpc();
  const mailboxQueryInput = { folder, searchQuery, view };
  const mailboxQuery = useQuery(
    mailRpc.getMailbox.queryOptions(createMailboxQueryOptions(mailboxQueryInput)),
  );

  const mailbox = mailboxQuery.data?.status === "ok" ? mailboxQuery.data.data : null;
  const errorMessage = getMailboxQueryErrorMessage(mailboxQuery.error, mailboxQuery.data);

  return {
    errorMessage,
    // True only for the very first load, before any response has arrived.
    isInitialLoading: mailboxQuery.isLoading,
    isFetching: mailboxQuery.isFetching,
    isTransitioning: shouldShowMailboxTransitionLoading(mailboxQuery),
    mailbox,
    refetchMailbox: () => {
      void refetchMailboxQuery(queryClient, mailboxQueryInput, "mailbox.refresh", mailRpc);
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

function useThreadMessages(hasMailbox: boolean, selectedMail: MailItem | null) {
  const mailRpc = useMailRpc();
  const threadId = getThreadQueryId(hasMailbox, selectedMail);
  const threadQuery = useQuery(
    mailRpc.getThread.queryOptions({
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
  const mailRpc = useMailRpc();

  return useMutation(
    mailRpc.send.mutationOptions({
      onError: (error) => {
        toast.error(`Error: ${error.message}`);
      },
      onSuccess: (result) => {
        if (result.status === "error") {
          const presentation = getMutationErrorPresentation(result.error);
          toast.error(presentation.message);
          return;
        }

        const cacheWarning = getCacheWriteWarning(result);
        if (cacheWarning) {
          toast.warning(cacheWarning);
          return;
        }

        toast.success("Email sent");
        if (shouldInvalidateAfterCacheWrite(result)) {
          queryClient.invalidateQueries({
            queryKey: orpc.mail.getMailbox.key(),
          });
        }
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

function getMailboxAccount(mailbox: MailboxData | null) {
  return mailbox?.account;
}

function isDraftSavePending(
  createDraftMutation: { readonly isPending: boolean },
  updateDraftMutation: { readonly isPending: boolean },
) {
  return createDraftMutation.isPending || updateDraftMutation.isPending;
}

function getSelectedMail(activeMails: readonly MailItem[], selected: string | null) {
  return activeMails.find((item) => item.id === selected) ?? null;
}

function createPrimaryLinks(
  counts: MailboxCounts,
  activeFolder: MailFolder,
  buildFolderHref: (folder: MailFolder) => NavLink["href"],
) {
  return [
    {
      title: "Inbox",
      label: formatMailBadgeCount(counts.inboxUnread, { cap: 99 }) ?? undefined,
      icon: Inbox,
      folder: "inbox",
      href: buildFolderHref("inbox"),
      variant: navVariant("inbox", activeFolder),
    },
    {
      title: "Drafts",
      label: formatMailBadgeCount(counts.drafts) ?? undefined,
      icon: File,
      folder: "drafts",
      href: buildFolderHref("drafts"),
      variant: navVariant("drafts", activeFolder),
    },
    {
      title: "Sent",
      icon: Send,
      folder: "sent",
      href: buildFolderHref("sent"),
      variant: navVariant("sent", activeFolder),
    },
    {
      title: "Junk",
      icon: ArchiveX,
      folder: "junk",
      href: buildFolderHref("junk"),
      variant: navVariant("junk", activeFolder),
    },
    {
      title: "Trash",
      icon: Trash2,
      folder: "trash",
      href: buildFolderHref("trash"),
      variant: navVariant("trash", activeFolder),
    },
    {
      title: "Archive",
      icon: Archive,
      folder: "archive",
      href: buildFolderHref("archive"),
      variant: navVariant("archive", activeFolder),
    },
  ] satisfies readonly NavLink[];
}

function createCategoryLinks(
  activeFolder: MailFolder,
  buildFolderHref: (folder: MailFolder) => NavLink["href"],
) {
  return [
    {
      title: "Social",
      icon: Users2,
      folder: "social",
      href: buildFolderHref("social"),
      variant: navVariant("social", activeFolder),
    },
    {
      title: "Updates",
      icon: AlertCircle,
      folder: "updates",
      href: buildFolderHref("updates"),
      variant: navVariant("updates", activeFolder),
    },
    {
      title: "Forums",
      icon: MessagesSquare,
      folder: "forums",
      href: buildFolderHref("forums"),
      variant: navVariant("forums", activeFolder),
    },
    {
      title: "Promotions",
      icon: Archive,
      folder: "promotions",
      href: buildFolderHref("promotions"),
      variant: navVariant("promotions", activeFolder),
    },
  ] satisfies readonly NavLink[];
}

// Drops stale state the moment the folder changes so the reading pane never
// shows a thread from the folder we just left. Deriving during render (no
// effect) avoids an extra refetch pass; the query key change drives the load.
function useFolderChangeReset(folder: MailFolder, onFolderChange: () => void) {
  const [previousFolder, setPreviousFolder] = React.useState(folder);

  if (folder !== previousFolder) {
    setPreviousFolder(folder);
    onFolderChange();
  }
}

function navVariant(folder: MailFolder, activeFolder: MailFolder) {
  return folder === activeFolder ? ("default" as const) : ("ghost" as const);
}

const defaultFolder = "inbox" satisfies MailFolder;

function getFolderFromSearchParams(searchParams: ReadonlyURLSearchParams) {
  const parsed = mailFolderSchema.safeParse(searchParams.get("folder"));
  return parsed.success ? parsed.data : defaultFolder;
}

const folderTitles = {
  archive: "Archive",
  drafts: "Drafts",
  forums: "Forums",
  inbox: "Inbox",
  junk: "Junk",
  promotions: "Promotions",
  sent: "Sent",
  social: "Social",
  trash: "Trash",
  updates: "Updates",
} satisfies Record<MailFolder, string>;

function getFolderTitle(folder: MailFolder) {
  return folderTitles[folder];
}

function toMailView(value: string): MailView {
  if (value === "unread") {
    return "unread";
  }

  return "all";
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
