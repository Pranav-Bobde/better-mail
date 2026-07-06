import type { EvlogOrpcContext } from "evlog/orpc";
import type { NextRequest } from "next/server";

import type { MailSyncBroker } from "./mail/sync/broker";
import type { createPrismaMailSyncRepository } from "./mail/sync/prisma-mail-sync-repository";

export type AuthSession = {
  readonly session: {
    readonly expiresAt: Date;
    readonly id: string;
    readonly token: string;
    readonly userId: string;
  };
  readonly user: {
    readonly email: string;
    readonly emailVerified: boolean;
    readonly id: string;
    readonly image?: string | null;
    readonly name: string;
  };
};

export type GoogleAccessToken = {
  readonly accessToken: string;
  readonly scopes: readonly string[];
};

export type AuthContext = {
  readonly getGoogleAccessToken: (() => Promise<GoogleAccessToken>) | null;
  readonly mailSyncBroker?: MailSyncBroker | null;
  readonly mailSyncRepository?: ReturnType<typeof createPrismaMailSyncRepository> | null;
  readonly session: AuthSession | null;
};

const unauthenticatedContext = {
  getGoogleAccessToken: null,
  mailSyncBroker: null,
  mailSyncRepository: null,
  session: null,
} satisfies AuthContext;

export async function createContext(
  _req: NextRequest,
  authContext: AuthContext = unauthenticatedContext,
) {
  return {
    ...authContext,
  };
}

export type BaseContext = Awaited<ReturnType<typeof createContext>>;
export type Context = BaseContext & EvlogOrpcContext;

export async function createRpcContext(
  req: NextRequest,
  log: EvlogOrpcContext["log"],
  authContext?: AuthContext,
) {
  return {
    ...(await createContext(req, authContext)),
    log,
  } satisfies Context;
}
