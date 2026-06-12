import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { logMailboxError, startMailboxWatch } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import type { startWatchInputSchema } from "./constants";

export async function runStartWatch(
  _input: z.infer<typeof startWatchInputSchema>,
  context: Context,
) {
  try {
    const result = await startMailboxWatch();

    context.log.set(createRpcSuccessFields("mail.startWatch"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "startWatch");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_WATCH_FAILED.code,
      status: "error" as const,
    };
  }
}
