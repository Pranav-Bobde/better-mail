import { keepPreviousData } from "@tanstack/react-query";

import type { MailFolder } from "@code-main/api/mail/contracts";
import { mailboxChangedEventSchema } from "@code-main/api/mail/realtime/contracts";
import type { RpcRequestTrigger } from "@code-main/api/observability/rpc/request-diagnostics";

import type { MailView } from "@/features/mail/components/mail-ai-tools";

type MailboxRequestTrigger = Extract<RpcRequestTrigger, `mailbox.${string}`>;

export function createMailboxQueryOptions(
  input: {
    readonly folder: MailFolder;
    readonly searchQuery: string;
    readonly view: MailView;
  },
  requestTrigger: MailboxRequestTrigger = getInitialMailboxRequestTrigger(input.searchQuery),
) {
  return {
    context: {
      requestTrigger,
    },
    input: {
      folder: input.folder,
      query: input.searchQuery,
      view: input.view,
    },
    meta: {
      silentError: true,
    },
    // Keep previous real results visible while a new query loads so the list
    // never flashes back to fallback/demo data during search.
    placeholderData: keepPreviousData,
    refetchOnReconnect: "always" as const,
    refetchOnWindowFocus: "always" as const,
    retry: false,
    staleTime: 5_000,
  };
}

export function shouldShowMailboxTransitionLoading(input: {
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
}) {
  return input.isFetching && input.isPlaceholderData;
}

export function createMailboxChangedHandler(
  invalidateMailbox: (trigger: "mailbox.realtime") => Promise<void>,
) {
  return async (rawEvent: unknown) => {
    const event = mailboxChangedEventSchema.safeParse(rawEvent);
    if (!event.success) {
      return;
    }

    await invalidateMailbox("mailbox.realtime");
  };
}

function getInitialMailboxRequestTrigger(searchQuery: string): MailboxRequestTrigger {
  return searchQuery.length > 0 ? "mailbox.search" : "mailbox.load";
}
