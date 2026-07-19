export function setRequiredTestEnv() {
  process.env.ABLY_API_KEY = "2COlaA.test-key:test-secret";
  process.env.APP_URL = "http://localhost:4000";
  process.env.BETTER_AUTH_SECRET = "test-secret-with-at-least-32-chars";
  process.env.BETTER_AUTH_URL = "http://localhost:4000";
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  process.env.CORS_ORIGIN = "http://localhost:4000";
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/test_db";
  process.env.GMAIL_PUBSUB_TOPIC_NAME = "projects/rapid-snowfall-498906-b9/topics/gmail-demo";
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-google-client-secret";
  process.env.LANGSMITH_API_KEY = "lsv2_pt_real-shaped-test";
  process.env.LANGSMITH_PROJECT = "ai-email-client";
  process.env.LANGSMITH_TRACING = "true";
  process.env.NODE_ENV = "test";
  process.env.OPENROUTER_API_KEY = "sk-or-v1-real-shaped-test";
  process.env.OPENROUTER_MODEL = "openai/gpt-5.4-nano";
}
