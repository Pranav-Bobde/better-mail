import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import {
  MailboxService,
  logMailboxError,
  requireMailMutationAuthContext,
} from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { setThreadReadInputSchema } from "./constants";

export async function runSetThreadRead(
  input: z.infer<typeof setThreadReadInputSchema>,
  context: Context,
) {
  try {
    // Read-state writes must reach the local cache too, so the narrowed
    // context makes the mail sync repository a required dependency here.
    const mutationContext = requireMailMutationAuthContext(context);
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) =>
        service.setMailboxThreadReadState(input, mutationContext),
      ),
    );

    context.log.set(createRpcSuccessFields("mail.setThreadRead"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "setThreadRead");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_MODIFY_THREAD_FAILED.code,
      status: "error" as const,
    };
  }
}
