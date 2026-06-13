import type { Context } from "../../../context";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { mailErrors } from "../../../mail/errors";
import { getMailboxData, logMailboxError } from "../../../mail/mailbox-service";
import type { getMailboxInputSchema } from "./constants";
import type { z } from "zod";

export async function runGetMailbox(
  input: z.infer<typeof getMailboxInputSchema>,
  context: Context,
) {
  try {
    const result = await getMailboxData(input, context);

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
