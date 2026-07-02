import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

for (const envFile of [".env.local", ".env.development.local"]) {
  dotenv.config({
    override: true,
    path: path.join("../../apps/web", envFile),
  });
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
