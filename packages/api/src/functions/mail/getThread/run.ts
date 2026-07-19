import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { getThreadInputSchema } from "./constants";

export async function runGetThread(input: z.infer<typeof getThreadInputSchema>, context: Context) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.getThreadData(input, context)),
    );

    context.log.set(createRpcSuccessFields("mail.getThread"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "getThread");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_GET_THREAD_FAILED.code,
      status: "error" as const,
    };
  }
}
