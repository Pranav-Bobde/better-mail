import assert from "node:assert/strict";
import test from "node:test";

import { serverEnvSchema } from "./server-schema";

const requiredEnv = {
  APP_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:4000",
  CORS_ORIGIN: "http://localhost:4000",
  DATABASE_URL: "postgresql://user:password@localhost:5432/test_db",
  GOOGLE_OAUTH_CLIENT_ID: "test-google-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-google-client-secret",
  OPENROUTER_API_KEY: "sk-or-v1-real-shaped-test",
  LANGSMITH_API_KEY: "lsv2_pt_real-shaped-test",
  LANGSMITH_TRACING: "true",
  LANGSMITH_PROJECT: "ai-email-client",
  OPENROUTER_MODEL: "openai/gpt-5.4-nano",
  COPILOTKIT_TELEMETRY_DISABLED: "true",
  NODE_ENV: "test",
} as const;

test("server env contract requires AI runtime values", () => {
  assert.deepEqual(serverEnvSchema.parse(requiredEnv), requiredEnv);

  const result = serverEnvSchema.safeParse({
    ...requiredEnv,
    OPENROUTER_API_KEY: "",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path.join("."), "OPENROUTER_API_KEY");
});

test("server env contract requires Google OAuth values", () => {
  const result = serverEnvSchema.safeParse({
    ...requiredEnv,
    GOOGLE_OAUTH_CLIENT_SECRET: "",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path.join("."), "GOOGLE_OAUTH_CLIENT_SECRET");
});

test("server env contract pins the only allowed OpenRouter model", () => {
  const result = serverEnvSchema.safeParse({
    ...requiredEnv,
    OPENROUTER_MODEL: "openai/gpt-5.4",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path.join("."), "OPENROUTER_MODEL");
});

test("server env contract requires Copilot telemetry opt-out value", () => {
  const result = serverEnvSchema.safeParse({
    ...requiredEnv,
    COPILOTKIT_TELEMETRY_DISABLED: "",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path.join("."), "COPILOTKIT_TELEMETRY_DISABLED");
});
