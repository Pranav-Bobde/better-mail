import type { RpcErrorCode } from "./errors";
import {
  createRpcProcedureMetadata,
  type RpcProcedureMetadata,
  type RpcProcedureName,
} from "./procedure";

export type RpcOperation = `rpc.${string}`;

export type RpcWideEventFields =
  | {
      readonly operation: RpcOperation;
      readonly module: "rpc";
      readonly handler: string;
      readonly procedure: RpcProcedureName;
      readonly outcome: "success";
      readonly health?: {
        readonly status: "ok";
      };
    }
  | {
      readonly operation: RpcOperation;
      readonly module: "rpc";
      readonly handler: string;
      readonly procedure: RpcProcedureName;
      readonly outcome: "error";
      readonly rpc: {
        readonly errorCode: RpcErrorCode;
        readonly method: string;
        readonly path: string;
      };
    };

export function createRpcSuccessFields(procedure: RpcProcedureName): RpcWideEventFields {
  const metadata = createRpcProcedureMetadata(procedure);

  return {
    ...metadata,
    outcome: "success",
  };
}

export function createRpcErrorFields(
  metadata: RpcProcedureMetadata,
  errorCode: RpcErrorCode,
  request: Request,
): RpcWideEventFields {
  return {
    ...metadata,
    outcome: "error",
    rpc: {
      errorCode,
      method: request.method,
      path: new URL(request.url).pathname,
    },
  };
}
