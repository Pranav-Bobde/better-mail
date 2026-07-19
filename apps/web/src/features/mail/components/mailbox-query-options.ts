import { keepPreviousData } from "@tanstack/react-query";

import { mailboxChangedEventSchema } from "@code-main/api/mail/realtime/contracts";

import type { MailView } from "@/features/mail/components/mail-ai-tools";

export function createMailboxQueryOptions(input: {
  readonly searchQuery: string;
  readonly view: MailView;
}) {
  return {
    input: {
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

export function createMailboxChangedHandler(invalidateMailbox: () => Promise<void>) {
  return async (rawEvent: unknown) => {
    const event = mailboxChangedEventSchema.safeParse(rawEvent);
    if (!event.success) {
      return;
    }

    await invalidateMailbox();
  };
}
