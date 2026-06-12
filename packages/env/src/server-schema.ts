import { z } from "zod";

export const serverEnvSchema = z.object({
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
  OPENROUTER_API_KEY: z.string().min(1),
  LANGSMITH_API_KEY: z.string().min(1),
  LANGSMITH_TRACING: z.literal("true"),
  LANGSMITH_PROJECT: z.string().min(1),
  OPENROUTER_MODEL: z.literal("openai/gpt-5.4-nano"),
  COPILOTKIT_TELEMETRY_DISABLED: z.literal("true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
