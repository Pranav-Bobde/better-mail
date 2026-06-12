import type { EvlogOrpcContext } from "evlog/orpc";
import type { NextRequest } from "next/server";

export async function createContext(_req: NextRequest) {
  return {
    auth: null,
    session: null,
  };
}

export type BaseContext = Awaited<ReturnType<typeof createContext>>;
export type Context = BaseContext & EvlogOrpcContext;

export async function createRpcContext(req: NextRequest, log: EvlogOrpcContext["log"]) {
  return {
    ...(await createContext(req)),
    log,
  } satisfies Context;
}
