"use client";

import * as React from "react";
import { toast } from "sonner";

import type { MailFolder } from "@code-main/api/mail/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import {
  resetAutoMarkGuardForSelection,
  shouldAutoMarkThreadRead,
} from "@/features/mail/mutations/auto-mark-read";
import {
  createDraftIdLookup,
  getDraftThreadId,
  removeDraftFromList,
  type ListDraftsOutput,
} from "@/features/mail/mutations/draft-lookup";
import {
  getMailboxQueryKeyFolder,
  patchMailboxThreadRead,
  removeMailboxThread,
  type GetMailboxOutput,
} from "@/features/mail/mutations/mailbox-cache";
import {
  getCacheWriteWarning,
  getMutationErrorPresentation,
  shouldInvalidateAfterCacheWrite,
  shouldRefreshDraftQueriesAfterMutation,
} from "@/features/mail/mutations/mutation-result";
import { reconnectGoogleAccount } from "@/features/mail/mutations/reconnect-google";
import { orpc } from "@/shared/utils/orpc";

// Mail write-action envelopes resolve HTTP 200 with a status union, so a
// react-query onSuccess fires even for { status: "error" } — every hook below
// branches on result.status. onError additionally covers thrown transport
// errors through the same presentation mapping.
function showMailMutationError(errorCode: string) {
  const presentation = getMutationErrorPresentation(errorCode);

  if (presentation.kind === "reconnect") {
    toast.error(presentation.message, {
      action: {
        label: "Reconnect Google",
        onClick: () => void reconnectGoogleAccount(),
      },
    });
    return;
  }

  toast.error(presentation.message);
}

type MailboxCacheSnapshot = readonly (readonly [QueryKey, GetMailboxOutput | undefined])[];

function restoreMailboxEntries(
  queryClient: QueryClient,
  previousMailboxEntries: MailboxCacheSnapshot | undefined,
) {
  for (const [queryKey, cachedMailbox] of previousMailboxEntries ?? []) {
    queryClient.setQueryData(queryKey, cachedMailbox);
  }
}

function invalidateMailboxAndThread(queryClient: QueryClient, threadId: string) {
  void queryClient.invalidateQueries({ queryKey: orpc.mail.getMailbox.key() });
  void queryClient.invalidateQueries({
    queryKey: orpc.mail.getThread.key({ input: { threadId } }),
  });
}

export function useSetThreadReadMutation(
  options: { readonly suppressCacheWarning?: boolean } = {},
) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.setThreadRead.mutationOptions({
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: orpc.mail.getMailbox.key() });

        const previousMailboxEntries = queryClient.getQueriesData<GetMailboxOutput>({
          queryKey: orpc.mail.getMailbox.key(),
        });

        // Read state is folder-agnostic: patch the thread in every cached
        // mailbox list so switching folders shows the same optimistic state.
        queryClient.setQueriesData<GetMailboxOutput>(
          { queryKey: orpc.mail.getMailbox.key() },
          (cachedMailbox) => patchMailboxThreadRead(cachedMailbox, input.threadId, input.read),
        );

        return { previousMailboxEntries };
      },
      onError: (error, _input, context) => {
        restoreMailboxEntries(queryClient, context?.previousMailboxEntries);
        showMailMutationError(error.message);
      },
      onSuccess: (result, _input, context) => {
        if (result.status === "error") {
          restoreMailboxEntries(queryClient, context?.previousMailboxEntries);
          showMailMutationError(result.error);
          return;
        }

        // Gmail took the change but the cache write missed it: the optimistic
        // state may briefly revert on refetch, so say so instead of staying
        // silent.
        const cacheWarning = getCacheWriteWarning(result, {
          suppress: options.suppressCacheWarning,
        });
        if (cacheWarning) {
          toast.warning(cacheWarning);
        }
      },
      onSettled: (result, _error, input) => {
        if (shouldInvalidateAfterCacheWrite(result)) {
          invalidateMailboxAndThread(queryClient, input.threadId);
        }
      },
    }),
  );
}

export function useArchiveThreadMutation(folder: MailFolder) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.archiveThread.mutationOptions({
      onMutate: async (input) => {
        // Archive clears the INBOX label; the thread must keep showing in
        // Sent/labels/etc., so only inbox lists are optimistically pruned —
        // and only while the user is looking at the inbox.
        if (folder !== "inbox") {
          return { previousMailboxEntries: undefined };
        }

        await queryClient.cancelQueries({ queryKey: orpc.mail.getMailbox.key() });

        const previousMailboxEntries = queryClient
          .getQueriesData<GetMailboxOutput>({ queryKey: orpc.mail.getMailbox.key() })
          .filter(([queryKey]) => getMailboxQueryKeyFolder(queryKey) === "inbox");

        for (const [queryKey, cachedMailbox] of previousMailboxEntries) {
          queryClient.setQueryData(queryKey, removeMailboxThread(cachedMailbox, input.threadId));
        }

        return { previousMailboxEntries };
      },
      onError: (error, _input, context) => {
        restoreMailboxEntries(queryClient, context?.previousMailboxEntries);
        showMailMutationError(error.message);
      },
      onSuccess: (result, _input, context) => {
        if (result.status === "error") {
          restoreMailboxEntries(queryClient, context?.previousMailboxEntries);
          showMailMutationError(result.error);
          return;
        }

        // The archive reached Gmail either way; when the cache write missed
        // it, the warning replaces the plain success toast so the user knows
        // the thread may briefly pop back into the inbox.
        const cacheWarning = getCacheWriteWarning(result);
        if (cacheWarning) {
          toast.warning(cacheWarning);
          return;
        }

        toast.success("Conversation archived");
      },
      onSettled: (result, _error, input) => {
        if (shouldInvalidateAfterCacheWrite(result)) {
          invalidateMailboxAndThread(queryClient, input.threadId);
        }
      },
    }),
  );
}

// Auto-mark an opened unread thread as read. The ref prevents rollback loops;
// manualUnreadThreadIds preserve explicit unread toggles until user intent
// explicitly clears them.
export function useAutoMarkThreadRead(
  selectedThread: { readonly read: boolean; readonly threadId: string } | null,
  setThreadRead: (input: { readonly read: boolean; readonly threadId: string }) => void,
  manualUnreadThreadIds: ReadonlySet<string> = new Set(),
) {
  const lastAutoMarkedThreadIdRef = React.useRef<string | null>(null);
  const previousSelectedThreadIdRef = React.useRef<string | null>(null);
  const selectedThreadId = selectedThread?.threadId ?? null;
  const isSelectedThreadUnread = selectedThread !== null && !selectedThread.read;

  React.useEffect(() => {
    lastAutoMarkedThreadIdRef.current = resetAutoMarkGuardForSelection(
      selectedThreadId,
      previousSelectedThreadIdRef.current,
      lastAutoMarkedThreadIdRef.current,
    );
    previousSelectedThreadIdRef.current = selectedThreadId;

    if (selectedThreadId === null || !isSelectedThreadUnread) {
      return;
    }

    const selectedUnreadThread = { read: false, threadId: selectedThreadId };
    if (
      !shouldAutoMarkThreadRead(
        selectedUnreadThread,
        lastAutoMarkedThreadIdRef.current,
        manualUnreadThreadIds,
      )
    ) {
      return;
    }

    lastAutoMarkedThreadIdRef.current = selectedThreadId;
    setThreadRead({ read: true, threadId: selectedThreadId });
  }, [isSelectedThreadUnread, manualUnreadThreadIds, selectedThreadId, setThreadRead]);
}

function invalidateMailboxAndDrafts(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: orpc.mail.getMailbox.key() });
  void queryClient.invalidateQueries({ queryKey: orpc.mail.listDrafts.key() });
}

export function useCreateDraftMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.createDraft.mutationOptions({
      onError: (error) => {
        showMailMutationError(error.message);
      },
      onSuccess: (result) => {
        if (result.status === "error") {
          showMailMutationError(result.error);
          return;
        }

        const cacheWarning = getCacheWriteWarning(result);
        if (cacheWarning) {
          toast.warning(cacheWarning);
        } else {
          toast.success("Draft saved");
        }

        if (shouldRefreshDraftQueriesAfterMutation(result)) {
          invalidateMailboxAndDrafts(queryClient);
        }
      },
    }),
  );
}

export function useUpdateDraftMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.updateDraft.mutationOptions({
      onError: (error) => {
        showMailMutationError(error.message);
      },
      onSuccess: (result) => {
        if (result.status === "error") {
          showMailMutationError(result.error);
          return;
        }

        const cacheWarning = getCacheWriteWarning(result);
        if (cacheWarning) {
          toast.warning(cacheWarning);
        } else {
          toast.success("Draft saved");
        }

        if (shouldRefreshDraftQueriesAfterMutation(result)) {
          invalidateMailboxAndDrafts(queryClient);
        }
      },
    }),
  );
}

// Must match the key @orpc/tanstack-query generates for the listDrafts query
// below ([path, { input: {}, type: "query" }]).
const listDraftsQueryKey = orpc.mail.listDrafts.key({ input: {}, type: "query" });

export function useDeleteDraftMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.mail.deleteDraft.mutationOptions({
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: orpc.mail.getMailbox.key() });
        await queryClient.cancelQueries({ queryKey: orpc.mail.listDrafts.key() });

        const previousDraftList = queryClient.getQueryData<ListDraftsOutput>(listDraftsQueryKey);
        const draftThreadId = getDraftThreadId(previousDraftList, input.draftId);

        const previousMailboxEntries = queryClient
          .getQueriesData<GetMailboxOutput>({ queryKey: orpc.mail.getMailbox.key() })
          .filter(([queryKey]) => getMailboxQueryKeyFolder(queryKey) === "drafts");

        queryClient.setQueryData(
          listDraftsQueryKey,
          removeDraftFromList(previousDraftList, input.draftId),
        );

        if (draftThreadId !== null) {
          for (const [queryKey, cachedMailbox] of previousMailboxEntries) {
            queryClient.setQueryData(queryKey, removeMailboxThread(cachedMailbox, draftThreadId));
          }
        }

        return { previousDraftList, previousMailboxEntries };
      },
      onError: (error, _input, context) => {
        restoreDraftCaches(queryClient, context);
        showMailMutationError(error.message);
      },
      onSuccess: (result, _input, context) => {
        if (result.status === "error") {
          restoreDraftCaches(queryClient, context);
          showMailMutationError(result.error);
          return;
        }

        const cacheWarning = getCacheWriteWarning(result);
        if (cacheWarning) {
          toast.warning(cacheWarning);
          return;
        }

        toast.success("Draft deleted");
      },
      onSettled: (result) => {
        if (shouldInvalidateAfterCacheWrite(result)) {
          invalidateMailboxAndDrafts(queryClient);
        }
      },
    }),
  );
}

function restoreDraftCaches(
  queryClient: QueryClient,
  context:
    | {
        readonly previousDraftList: ListDraftsOutput | undefined;
        readonly previousMailboxEntries: MailboxCacheSnapshot;
      }
    | undefined,
) {
  if (!context) {
    return;
  }

  if (context.previousDraftList !== undefined) {
    queryClient.setQueryData(listDraftsQueryKey, context.previousDraftList);
  }

  restoreMailboxEntries(queryClient, context.previousMailboxEntries);
}

// messageId/threadId → draftId lookup for the Drafts folder, fed by
// mail.listDrafts. Only fetched while the user is in the Drafts folder.
export function useDraftIdLookup(folder: MailFolder) {
  const draftListQuery = useQuery(
    orpc.mail.listDrafts.queryOptions({
      enabled: folder === "drafts",
      input: {},
      meta: {
        silentError: true,
      },
      retry: false,
      staleTime: 5_000,
    }),
  );

  const drafts = draftListQuery.data?.status === "ok" ? draftListQuery.data.data.drafts : [];
  return createDraftIdLookup(drafts);
}
