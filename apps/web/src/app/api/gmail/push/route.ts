import { gmailPushOutputSchema } from "@code-main/api/mail/contracts";
import { mailErrors } from "@code-main/api/mail/errors";
import { handleGmailPushPayload, logMailboxError } from "@code-main/api/mail/mailbox-service";
import { NextRequest } from "next/server";

import { useLogger, withEvlog } from "@/shared/lib/evlog";

async function handleRequest(req: NextRequest) {
  const log = useLogger();

  try {
    const result = await handleGmailPushPayload(await readJsonBody(req), getEndpointToken(req));
    return Response.json(gmailPushOutputSchema.parse(result), { status: 200 });
  } catch (error) {
    const evlogError = logMailboxError(log, error, "push");
    const status = getPushRouteStatusCode(evlogError.code);

    return Response.json(
      {
        error: evlogError.code ?? mailErrors.GMAIL_PUBSUB_PUSH_INVALID.code,
        status: "error",
      },
      { status },
    );
  }
}

function getPushRouteStatusCode(errorCode: string | undefined) {
  switch (errorCode) {
    case mailErrors.GMAIL_PUBSUB_PUSH_INVALID.code:
      return 400;
    case mailErrors.GMAIL_STATE_WRITE_FAILED.code:
      return 503;
    default:
      return 500;
  }
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch (error) {
    throw mailErrors.GMAIL_PUBSUB_PUSH_INVALID({
      cause: getErrorCause(error),
      internal: {
        handler: "gmailPushRoute",
      },
    });
  }
}

function getEndpointToken(req: Request) {
  return new URL(req.url).searchParams.get("token");
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown Gmail push JSON parse failure");
}

export const POST = withEvlog(handleRequest);
