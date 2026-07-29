import path from "node:path";

import { defineConfig, env } from "prisma/config";

import { loadPrismaCliDatabaseEnv } from "./src/prisma-config-env";

// DATABASE_URL: an explicit process env value always wins; otherwise
// apps/web/.env.local supplies the Neon dev branch. NODE_ENV=test refuses the
// dotenv fallback and demands an explicit DATABASE_URL — see the helper.
loadPrismaCliDatabaseEnv();

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
