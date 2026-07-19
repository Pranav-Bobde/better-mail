import { auth } from "@code-main/auth";

import { useLogger, withEvlog } from "@/shared/lib/evlog";
import { createMailboxRealtimeTokenRequest } from "@/shared/lib/mail-realtime-runtime";
import { createMailboxRealtimeAuthResponse } from "@/shared/lib/mail-realtime-server";

type MailRealtimeAuthFields = {
  readonly module: "mail";
  readonly operation: "mail.realtime.auth";
  readonly outcome: "authenticated" | "unauthenticated";
};

async function handleMailboxRealtimeAuth(request: Request) {
  const log = useLogger<MailRealtimeAuthFields>();
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  log.set({
    module: "mail",
    operation: "mail.realtime.auth",
    outcome: session ? "authenticated" : "unauthenticated",
  });

  return createMailboxRealtimeAuthResponse(
    session?.user.id ?? null,
    createMailboxRealtimeTokenRequest,
  );
}

export const POST = withEvlog(handleMailboxRealtimeAuth);
