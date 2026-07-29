import { createPrismaClient } from "@code-main/db";
import { env } from "@code-main/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { createDeleteUserConfig } from "./delete-user-cleanup";

// gmail.modify is Google's documented superset of the previous readonly+send
// pair (it does NOT include permanent delete) and unlocks thread label and
// draft mutations. Legacy readonly+send grants keep read/send working; only
// new mutation operations require a re-consent to this scope.
export const gmailOAuthScopes = ["https://www.googleapis.com/auth/gmail.modify"] as const;

type GoogleAccessTokenLookup = (userId: string) => Promise<string | null>;

export function createAuth() {
  const prisma = createPrismaClient();
  // Late-bound so the deleteUser hook can call back into the finished auth
  // instance without a circular type inference on `instance`.
  let lookupGoogleAccessToken: GoogleAccessTokenLookup = async () => null;

  const instance = betterAuth({
    account: {
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
    },
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    trustedOrigins: [env.CORS_ORIGIN],
    // The product is Google-OAuth-only; email/password would be an unused,
    // unverified-email auth surface. Kept explicitly disabled (and asserted in
    // index.test.ts) rather than omitted.
    emailAndPassword: {
      enabled: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders: {
      google: {
        accessType: "offline",
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        prompt: "select_account consent",
        scope: [...gmailOAuthScopes],
      },
    },
    user: {
      // Deletion runs on a fresh session only (Better Auth default freshness
      // window) and cascades all mail data via the Prisma schema's onDelete
      // rules. beforeDelete revokes the Google grant while the encrypted
      // account row still exists.
      deleteUser: createDeleteUserConfig((userId) => lookupGoogleAccessToken(userId)),
    },
    plugins: [nextCookies()],
  });

  lookupGoogleAccessToken = async (userId) => {
    const token = await instance.api.getAccessToken({
      body: { providerId: "google", userId },
    });

    return token.accessToken ?? null;
  };

  return instance;
}

export const auth = createAuth();
