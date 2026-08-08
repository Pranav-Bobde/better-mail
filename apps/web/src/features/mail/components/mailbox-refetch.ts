import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { getMailboxInputSchema, type MailFolder } from "@code-main/api/mail/contracts";
import type { RpcRequestTrigger } from "@code-main/api/observability/rpc/request-diagnostics";

import type { MailView } from "@/features/mail/components/mail-ai-tools";
import { createMailboxQueryOptions } from "@/features/mail/components/mailbox-query-options";
import { orpc } from "@/shared/utils/orpc";

type MailboxRequestTrigger = Extract<RpcRequestTrigger, `mailbox.${string}`>;

const mailboxQueryKeyStateSchema = z.object({
  input: getMailboxInputSchema,
});

export async function refetchMailboxQuery(
  queryClient: QueryClient,
  input: {
    readonly folder: MailFolder;
    readonly searchQuery: string;
    readonly view: MailView;
  },
  requestTrigger: MailboxRequestTrigger,
) {
  const queryOptions = orpc.mail.getMailbox.queryOptions(
    createMailboxQueryOptions(input, requestTrigger),
  );

  await queryClient.invalidateQueries({
    exact: true,
    queryKey: queryOptions.queryKey,
    refetchType: "none",
  });
  await queryClient.fetchQuery(queryOptions);
}

export async function refetchActiveMailboxQueries(
  queryClient: QueryClient,
  requestTrigger: MailboxRequestTrigger,
) {
  await queryClient.invalidateQueries({
    queryKey: orpc.mail.getMailbox.key(),
    refetchType: "none",
  });

  const activeMailboxQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: orpc.mail.getMailbox.key() })
    .filter((query) => query.isActive());

  await Promise.all(
    activeMailboxQueries.map(async (query) => {
      const input = getMailboxInputFromQueryKey(query.queryKey);
      if (input === null) {
        return;
      }

      await refetchMailboxQuery(
        queryClient,
        {
          folder: input.folder,
          searchQuery: input.query,
          view: input.view,
        },
        requestTrigger,
      );
    }),
  );
}

function getMailboxInputFromQueryKey(queryKey: readonly unknown[]) {
  const parsedState = mailboxQueryKeyStateSchema.safeParse(queryKey[1]);
  return parsedState.success ? parsedState.data.input : null;
}
