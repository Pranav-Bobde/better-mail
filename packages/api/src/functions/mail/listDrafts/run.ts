import { Effect } from "effect";

import type { Context } from "../../../context";
import { mailErrors } from "../../../mail/errors";
import { MailboxService, logMailboxError } from "../../../mail/mailbox-service";
import { createRpcSuccessFields } from "../../../observability/rpc/fields";
import { runRequest } from "../../../runtime";

// listDrafts takes an empty input object at the wire boundary, so the handler
// only needs the request context.
export async function runListDrafts(context: Context) {
  try {
    const result = await runRequest(
      Effect.flatMap(MailboxService, (service) => service.listMailboxDrafts(context)),
    );

    context.log.set(createRpcSuccessFields("mail.listDrafts"));
    return result;
  } catch (error) {
    const evlogError = logMailboxError(context.log, error, "listDrafts");

    return {
      error: evlogError.code ?? mailErrors.GMAIL_LIST_DRAFTS_FAILED.code,
      status: "error" as const,
    };
  }
}
