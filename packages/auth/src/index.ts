import { createPrismaClient } from "@code-main/db";
import { env } from "@code-main/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

export const gmailOAuthScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export function createAuth() {
  const prisma = createPrismaClient();

  return betterAuth({
    account: {
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
    },
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
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
    plugins: [nextCookies()],
  });
}

export const auth = createAuth();
