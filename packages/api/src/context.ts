import { auth } from "@code-main/auth";
import type { EvlogOrpcContext } from "evlog/orpc";
import type { NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    auth: null,
    session,
  };
}

export type BaseContext = Awaited<ReturnType<typeof createContext>>;
export type Context = BaseContext & Partial<EvlogOrpcContext>;
