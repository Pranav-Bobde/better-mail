import { loadEnvConfig } from "@next/env";
import "@code-main/env/web";
import type { NextConfig } from "next";

// Load both .env.local and .env.development.local for postinstall scripts (like Prisma)
// to have access to DATABASE_URL in the v0 sandbox
loadEnvConfig(process.cwd());

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
