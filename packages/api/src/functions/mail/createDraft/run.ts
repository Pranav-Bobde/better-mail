import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { createDraftInputSchema } from "./constants";

export async function runCreateDraft(
  input: z.infer<typeof createDraftInputSchema>,
  context: Context,
) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.createMailboxDraft(input, context)),
    );

    context.log.set(createRpcSuccessFields("mail.createDraft"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "createDraft");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_CREATE_DRAFT_FAILED.code,
      status: "error" as const,
    };
  }
}
