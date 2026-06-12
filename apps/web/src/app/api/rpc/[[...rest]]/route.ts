import { createRpcContext } from "@code-main/api/context";
import { rpcErrors, type RpcErrorCode } from "@code-main/api/observability/rpc/errors";
import {
  createRpcErrorFields,
  createRpcSuccessFields,
  type RpcWideEventFields,
} from "@code-main/api/observability/rpc/fields";
import {
  getRpcProcedureMetadata,
  type RpcProcedureMetadata,
} from "@code-main/api/observability/rpc/procedure";
import { appRouter } from "@code-main/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { EvlogError } from "evlog";
import { NextRequest } from "next/server";

import { identifyEvlogUser } from "@/shared/lib/evlog-auth";
import { useLogger, withEvlog } from "@/shared/lib/evlog";

const rpcHandler = new RPCHandler(appRouter);
const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

async function handleRequest(req: NextRequest) {
  await identifyEvlogUser(req);
  const log = useLogger<RpcWideEventFields>();

  try {
    const rpcResult = await rpcHandler.handle(req, {
      prefix: "/api/rpc",
      context: await createRpcContext(req, log),
    });
    if (rpcResult.response) return rpcResult.response;
  } catch (error) {
    return handleRpcError(req, getRpcProcedureMetadata(req), error);
  }

  return handleRpcError(req, getRpcProcedureMetadata(req), rpcErrors.PROCEDURE_NOT_FOUND());
}

async function handleApiReferenceRequest(req: NextRequest) {
  await identifyEvlogUser(req);
  const log = useLogger<RpcWideEventFields>();
  const apiResult = await apiHandler.handle(req, {
    prefix: "/api/rpc/api-reference",
    context: await createRpcContext(req, log),
  });
  if (apiResult.response) {
    log.set(createRpcSuccessFields("apiReference"));
    return apiResult.response;
  }

  return handleRpcError(req, getRpcProcedureMetadata(req), rpcErrors.PROCEDURE_NOT_FOUND());
}

function handleRpcError(req: Request, metadata: RpcProcedureMetadata, error: unknown) {
  const log = useLogger<RpcWideEventFields>();
  const evlogError = toRpcEvlogError(metadata, req, error);
  const errorCode = getRpcErrorCode(evlogError);

  log.set(createRpcErrorFields(metadata, errorCode, req));
  log.error(evlogError);

  return Response.json(
    {
      status: "error",
      error: errorCode,
    },
    { status: 200 },
  );
}

function toRpcEvlogError(metadata: RpcProcedureMetadata, req: Request, error: unknown) {
  if (error instanceof EvlogError) {
    return error;
  }

  return rpcErrors.PROCEDURE_UNHANDLED_ERROR({
    cause: getErrorCause(error),
    internal: {
      handler: metadata.handler,
      procedure: metadata.procedure,
      operation: metadata.operation,
      method: req.method,
      path: new URL(req.url).pathname,
    },
  });
}

function getRpcErrorCode(error: EvlogError): RpcErrorCode {
  if (isRpcErrorCode(error.code)) {
    return error.code;
  }

  return rpcErrors.PROCEDURE_UNHANDLED_ERROR.code;
}

function isRpcErrorCode(code: string | undefined): code is RpcErrorCode {
  return Boolean(code) && rpcErrors._codes.includes(code as RpcErrorCode);
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
}

export const GET = withEvlog(handleApiReferenceRequest);
export const POST = withEvlog(handleRequest);
