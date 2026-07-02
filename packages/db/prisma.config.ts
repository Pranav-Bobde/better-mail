import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first, then .env.development.local (v0 sandbox)
// to ensure DATABASE_URL is available during postinstall
dotenv.config({
  override: false,
  path: "../../apps/web/.env.local",
});

dotenv.config({
  override: true,
  path: "../../apps/web/.env.development.local",
});

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
