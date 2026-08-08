import "@code-main/env/web";
import type { NextConfig } from "next";

import { createSecurityHeaders } from "./src/shared/lib/security-headers";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: createSecurityHeaders(),
    },
  ],
};

export default nextConfig;
