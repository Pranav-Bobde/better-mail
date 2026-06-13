import { z } from "zod";

export const serverEnvSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CORS_ORIGIN: z.url(),
  DATABASE_URL: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  LANGSMITH_API_KEY: z.string().min(1),
  LANGSMITH_TRACING: z.literal("true"),
  LANGSMITH_PROJECT: z.string().min(1),
  OPENROUTER_MODEL: z.literal("openai/gpt-5.4-nano"),
  COPILOTKIT_TELEMETRY_DISABLED: z.literal("true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
