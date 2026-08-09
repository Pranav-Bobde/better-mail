"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { createMailboxChangedHandler } from "@/features/mail/components/mailbox-query-options";
import { refetchActiveMailboxQueries } from "@/features/mail/components/mailbox-refetch";
import { ablyMailRealtimeSubscriber } from "@/features/mail/realtime/mail-realtime-client";
import { authClient } from "@/shared/utils/auth-client";

// Mount point for the subscription. Rendering it conditionally is how callers
// opt out (the public demo has no session, so it must not run the hook at all
// and must not fire the session lookup the hook depends on).
export function MailboxRealtimeInvalidation() {
  useMailboxRealtimeInvalidation();

  return null;
}

function useMailboxRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const invalidateMailbox = React.useCallback(
    (trigger: "mailbox.realtime") => refetchActiveMailboxQueries(queryClient, trigger),
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
          void invalidateMailbox("mailbox.realtime");
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [handleMailboxChanged, invalidateMailbox, session?.user.id]);
}
