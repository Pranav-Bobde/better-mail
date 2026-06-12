import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    APP_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    GMAIL_DEMO_USER: z.string().min(1),
    GMAIL_OAUTH_CLIENT_ID: z.string().min(1),
    GMAIL_OAUTH_CLIENT_SECRET: z.string().min(1),
    GMAIL_OAUTH_REFRESH_TOKEN: z.string().min(1),
    GMAIL_PUBSUB_TOPIC: z.string().min(1),
    GMAIL_PUBSUB_VERIFICATION_TOKEN: z.string().min(1),
    GMAIL_DEMO_STATE_FILE: z.string().min(1),
    GMAIL_WATCH_LABEL_IDS: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
