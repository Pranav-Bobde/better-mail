import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { getMailboxInputSchema } from "./constants";

export async function runGetMailbox(
  input: z.infer<typeof getMailboxInputSchema>,
  context: Context,
) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.getMailboxData(input, context)),
    );

    context.log.set(createRpcSuccessFields("mail.getMailbox"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "getMailbox");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_LIST_MESSAGES_FAILED.code,
      status: "error" as const,
    };
  }
}
