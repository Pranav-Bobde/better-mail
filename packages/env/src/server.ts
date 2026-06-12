import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";

import { serverEnvSchema } from "./server-schema";

export const env = createEnv({
  server: serverEnvSchema.shape,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
