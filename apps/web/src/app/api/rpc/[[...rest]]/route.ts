import { createRpcContext, type AuthContext } from "@code-main/api/context";
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
import {
  normalizeRpcValidationResponse,
  type RpcRequestDiagnostics,
} from "@code-main/api/observability/rpc/request-diagnostics";
import { appRouter } from "@code-main/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { EvlogError } from "evlog";
import { NextRequest } from "next/server";
import { auth, getAuthorizedSession } from "@code-main/auth";
import { createPrismaMailSyncRepository } from "@code-main/api/mail/sync/prisma-mail-sync-repository";

import { identifyEvlogUser } from "@/shared/lib/evlog-auth";
import { useLogger, withEvlog } from "@/shared/lib/evlog";
import { vercelMailSyncBroker } from "@/shared/lib/mail-sync-queue";

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
  const requestForDiagnostics = req.clone();

  try {
    const authContext = await createRouteAuthContext(req);

    const rpcResult = await rpcHandler.handle(req, {
      prefix: "/api/rpc",
      context: await createRpcContext(req, log, authContext),
    });
    if (rpcResult.response) {
      const normalizedResult = await normalizeRpcValidationResponse(
        requestForDiagnostics,
        rpcResult.response,
      );
      if (normalizedResult.diagnostics) {
        logRpcValidationFailure(req, normalizedResult.diagnostics);
      }

      return normalizedResult.response;
    }
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

async function createRouteAuthContext(req: NextRequest): Promise<AuthContext> {
  const session = await getAuthorizedSession(req.headers);

  if (!session) {
    return {
      getGoogleAccessToken: null,
      session: null,
    };
  }

  return {
    getGoogleAccessToken: async () => {
      const token = await auth.api.getAccessToken({
        body: {
          providerId: "google",
        },
        headers: req.headers,
      });

      return {
        accessToken: token.accessToken,
        scopes: token.scopes,
      };
    },
    mailSyncBroker: vercelMailSyncBroker,
    mailSyncRepository: createPrismaMailSyncRepository(),
    session,
  };
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

function logRpcValidationFailure(req: Request, diagnostics: RpcRequestDiagnostics) {
  const metadata = getRpcProcedureMetadata(req);
  const log = useLogger<RpcWideEventFields>();
  const evlogError = rpcErrors.PROCEDURE_INPUT_INVALID({
    internal: {
      bodyBytes: diagnostics.bodyBytes,
      clientRequestId: diagnostics.clientRequestId,
      contentType: diagnostics.contentType,
      handler: metadata.handler,
      method: req.method,
      operation: metadata.operation,
      path: new URL(req.url).pathname,
      procedure: metadata.procedure,
      trigger: diagnostics.trigger,
      validationIssues: diagnostics.validationIssues,
    },
  });

  log.set(createRpcErrorFields(metadata, rpcErrors.PROCEDURE_INPUT_INVALID.code, req, diagnostics));
  log.error(evlogError);
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
