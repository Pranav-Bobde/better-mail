import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { updateDraftInputSchema } from "./constants";

export async function runUpdateDraft(
  input: z.infer<typeof updateDraftInputSchema>,
  context: Context,
) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.updateMailboxDraft(input, context)),
    );

    context.log.set(createRpcSuccessFields("mail.updateDraft"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "updateDraft");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_UPDATE_DRAFT_FAILED.code,
      status: "error" as const,
    };
  }
}
