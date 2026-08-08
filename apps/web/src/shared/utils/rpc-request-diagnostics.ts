import { z } from "zod";

const rpcClientRequestIdHeader = "x-better-mail-client-request-id";
const rpcRequestTriggerHeader = "x-better-mail-request-trigger";

const rpcRequestTriggerSchema = z.enum([
  "mailbox.load",
  "mailbox.realtime",
  "mailbox.refresh",
  "mailbox.search",
  "rpc.request",
]);

const rpcRequestContextSchema = z.object({
  requestTrigger: rpcRequestTriggerSchema,
});

export function createRpcRequestDiagnosticHeaders(input: {
  readonly context?: unknown;
  readonly createRequestId?: () => string;
  readonly input: unknown;
  readonly path: readonly string[];
}) {
  const createRequestId = input.createRequestId ?? (() => crypto.randomUUID());

  return {
    [rpcClientRequestIdHeader]: createRequestId(),
    [rpcRequestTriggerHeader]: getRpcRequestTrigger(input.path, input.context),
  };
}

function getRpcRequestTrigger(path: readonly string[], context: unknown) {
  if (path.join(".") !== "mail.getMailbox") {
    return "rpc.request" satisfies z.infer<typeof rpcRequestTriggerSchema>;
  }

  const parsedContext = rpcRequestContextSchema.safeParse(context);
  if (parsedContext.success) {
    return parsedContext.data.requestTrigger;
  }

  return "mailbox.load" satisfies z.infer<typeof rpcRequestTriggerSchema>;
}
