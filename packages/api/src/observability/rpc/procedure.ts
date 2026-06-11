export type RpcProcedureName = string;

export type RpcProcedureMetadata = {
  readonly operation: `rpc.${string}`;
  readonly module: "rpc";
  readonly handler: string;
  readonly procedure: RpcProcedureName;
};

const rpcPrefix = "/api/rpc";
const apiReferenceProcedure = "apiReference";
const unknownProcedure = "unknown";
const unknownProcedureHandler = "resolveRpcProcedure";

export function getRpcProcedureMetadata(request: Request): RpcProcedureMetadata {
  return createRpcProcedureMetadata(getRpcProcedureName(request));
}

export function createRpcProcedureMetadata(procedure: RpcProcedureName): RpcProcedureMetadata {
  const normalizedProcedure = procedure || unknownProcedure;

  return {
    operation: createRpcOperation(normalizedProcedure),
    module: "rpc",
    handler: getRpcHandlerName(normalizedProcedure),
    procedure: normalizedProcedure,
  };
}

function getRpcProcedureName(request: Request): RpcProcedureName {
  const path = new URL(request.url).pathname;

  if (path === `${rpcPrefix}/api-reference` || path.startsWith(`${rpcPrefix}/api-reference/`)) {
    return apiReferenceProcedure;
  }

  const procedurePath = path.slice(rpcPrefix.length).replace(/^\/+/, "");
  if (!procedurePath) {
    return unknownProcedure;
  }

  return procedurePath.split("/").filter(Boolean).join(".");
}

function getRpcHandlerName(procedure: RpcProcedureName) {
  if (procedure === unknownProcedure) {
    return unknownProcedureHandler;
  }

  return procedure.split(".").at(-1) ?? unknownProcedureHandler;
}

function createRpcOperation(procedure: RpcProcedureName): `rpc.${string}` {
  if (procedure === unknownProcedure) {
    return "rpc.unknown_procedure";
  }

  return `rpc.${procedure
    .split(".")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase())
    .join(".")}`;
}
