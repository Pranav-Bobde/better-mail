import path from "node:path";

import dotenv from "dotenv";

/**
 * Loads the Prisma CLI environment (prisma.config.ts) from apps/web dotenv files.
 *
 * DATABASE_URL resolution order (highest wins):
 * 1. An explicit `DATABASE_URL` already in the process environment — e.g.
 *    `DATABASE_URL=... prisma migrate deploy` — ALWAYS wins. (Before this
 *    helper existed, the dotenv `override: true` load clobbered it.)
 * 2. Otherwise apps/web/.env.local then .env.development.local (later file
 *    wins), which point local dev at the Neon dev branch.
 *
 * Test runs (NODE_ENV=test) never read the dotenv files: they must provide an
 * explicit DATABASE_URL or this throws, so a test can never silently fall
 * through to the Neon URL in .env.local.
 *
 * For every other variable the dotenv files still override the process
 * environment, exactly as before — only DATABASE_URL is special-cased.
 *
 * `envDir` is CWD-relative by default because the prisma CLI always runs from
 * packages/db (turbo -F @code-main/db); tests inject an absolute directory.
 */
export function loadPrismaCliDatabaseEnv(
  envDir: string = path.join("..", "..", "apps", "web"),
): void {
  const explicitDatabaseUrl = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === "test") {
    assertExplicitTestDatabaseUrl(explicitDatabaseUrl);
    return;
  }

  loadWebDotenvFiles(envDir);

  if (explicitDatabaseUrl) {
    process.env.DATABASE_URL = explicitDatabaseUrl;
  }
}

function assertExplicitTestDatabaseUrl(explicitDatabaseUrl: string | undefined): void {
  if (!explicitDatabaseUrl) {
    throw new Error(
      "NODE_ENV=test: refusing to read apps/web/.env.local (it points at the Neon dev branch). " +
        "Set DATABASE_URL explicitly for test runs.",
    );
  }
}

function loadWebDotenvFiles(envDir: string): void {
  for (const envFile of [".env.local", ".env.development.local"]) {
    dotenv.config({
      override: true,
      path: path.join(envDir, envFile),
    });
  }
}
