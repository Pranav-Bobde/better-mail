import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { sendMailInputSchema } from "./constants";

export async function runSendMail(input: z.infer<typeof sendMailInputSchema>, context: Context) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.sendMailboxMessage(input, context)),
    );

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
