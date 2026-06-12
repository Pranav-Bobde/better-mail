import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { logMailboxError, sendMailboxMessage } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import type { sendMailInputSchema } from "./constants";

export async function runSendMail(input: z.infer<typeof sendMailInputSchema>, context: Context) {
  try {
    const result = await sendMailboxMessage(input);

    context.log.set(createRpcSuccessFields("mail.send"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "send");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_SEND_MESSAGE_FAILED.code,
      status: "error" as const,
    };
  }
}
