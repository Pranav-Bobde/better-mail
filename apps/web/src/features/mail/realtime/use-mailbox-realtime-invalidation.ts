"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { createMailboxChangedHandler } from "@/features/mail/components/mailbox-query-options";
import { ablyMailRealtimeSubscriber } from "@/features/mail/realtime/mail-realtime-client";
import { authClient } from "@/shared/utils/auth-client";
import { orpc } from "@/shared/utils/orpc";

export function useMailboxRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const invalidateMailbox = React.useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: orpc.mail.getMailbox.key(),
      }),
    [queryClient],
  );
  const handleMailboxChanged = React.useMemo(
    () => createMailboxChangedHandler(invalidateMailbox),
    [invalidateMailbox],
  );

  React.useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void ablyMailRealtimeSubscriber
      .onMailboxChanged({
        listener: handleMailboxChanged,
        userId,
      })
      .then((nextUnsubscribe) => {
        if (!active) {
          nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        if (active) {
          void invalidateMailbox();
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [handleMailboxChanged, invalidateMailbox, session?.user.id]);
}
