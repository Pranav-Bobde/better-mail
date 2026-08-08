import { z } from "zod";

import { rpcErrors } from "./errors";

const rpcClientRequestIdHeader = "x-better-mail-client-request-id";
const rpcRequestTriggerHeader = "x-better-mail-request-trigger";

const rpcRequestTriggerSchema = z.enum([
  "mailbox.load",
  "mailbox.realtime",
  "mailbox.refresh",
  "mailbox.search",
  "rpc.request",
]);

export type RpcRequestTrigger = z.infer<typeof rpcRequestTriggerSchema>;

const orpcValidationResponseSchema = z.object({
  json: z.object({
    code: z.literal("BAD_REQUEST"),
    data: z.object({
      issues: z.array(
        z.object({
          code: z.string(),
          path: z.array(z.union([z.string(), z.number()])),
        }),
      ),
    }),
  }),
});

export type RpcRequestDiagnostics = {
  readonly bodyBytes: number;
  readonly clientRequestId: string | null;
  readonly contentType: "application/json" | "other" | null;
  readonly trigger: RpcRequestTrigger | null;
  readonly validationIssues: readonly {
    readonly code: string;
    readonly path: readonly (number | string)[];
  }[];
};

type NormalizedRpcValidationResponse =
  | {
      readonly diagnostics: null;
      readonly response: Response;
    }
  | {
      readonly diagnostics: RpcRequestDiagnostics;
      readonly response: Response;
    };

export async function normalizeRpcValidationResponse(
  request: Request,
  response: Response,
): Promise<NormalizedRpcValidationResponse> {
  if (response.status !== 400) {
    return {
      diagnostics: null,
      response,
    };
  }

  const [bodyBytes, responseBody] = await Promise.all([
    request.arrayBuffer().then((body) => body.byteLength),
    response
      .clone()
      .json()
      .catch(() => null),
  ]);
  const validationResponse = orpcValidationResponseSchema.safeParse(responseBody);
  if (!validationResponse.success) {
    return {
      diagnostics: null,
      response,
    };
  }

  const clientRequestId = z.uuid().safeParse(request.headers.get(rpcClientRequestIdHeader));
  const trigger = rpcRequestTriggerSchema.safeParse(request.headers.get(rpcRequestTriggerHeader));

  return {
    diagnostics: {
      bodyBytes,
      clientRequestId: clientRequestId.success ? clientRequestId.data : null,
      contentType: getSafeContentType(request.headers.get("content-type")),
      trigger: trigger.success ? trigger.data : null,
      validationIssues: validationResponse.data.json.data.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
      })),
    } satisfies RpcRequestDiagnostics,
    response: Response.json(
      {
        error: rpcErrors.PROCEDURE_INPUT_INVALID.code,
        status: "error",
      },
      { status: 200 },
    ),
  };
}

function getSafeContentType(contentType: string | null) {
  if (contentType === null) {
    return null;
  }

  if (contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json") {
    return "application/json" as const;
  }

  return "other" as const;
}
