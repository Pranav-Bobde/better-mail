import { Effect } from "effect";
import type { z } from "zod";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";
import type { deleteDraftInputSchema } from "./constants";

export async function runDeleteDraft(
  input: z.infer<typeof deleteDraftInputSchema>,
  context: Context,
) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.deleteMailboxDraft(input, context)),
    );

    context.log.set(createRpcSuccessFields("mail.deleteDraft"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "deleteDraft");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_DELETE_DRAFT_FAILED.code,
      status: "error" as const,
    };
  }
}
