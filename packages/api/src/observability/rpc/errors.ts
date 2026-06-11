import { defineErrorCatalog } from "evlog";

export const rpcErrors = defineErrorCatalog("rpc", {
  PROCEDURE_NOT_FOUND: {
    status: 200,
    message: "RPC procedure not found",
    why: "No RPC procedure matched the requested RPC path",
    fix: "Check client procedure name and RPC route mapping for this request",
    internal: {
      module: "rpc",
    },
  },
  PROCEDURE_UNHANDLED_ERROR: {
    status: 200,
    message: "RPC procedure failed",
    why: "Unhandled non-catalog error reached the RPC procedure boundary",
    fix: "Check procedure name, request id, and server error cause for this request",
    internal: {
      module: "rpc",
    },
  },
} as const);

declare module "evlog" {
  interface RegisteredErrorCatalogs {
    rpc: typeof rpcErrors;
  }
}

export type RpcErrorCode = (typeof rpcErrors._codes)[number];
