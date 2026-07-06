import assert from "node:assert/strict";
import { test } from "node:test";

import { createConsoleDrain, getEvlogDrainMode } from "@/shared/lib/evlog";

test("uses filesystem evlog drain outside production runtimes", () => {
  assert.equal(getEvlogDrainMode({}), "fs");
  assert.equal(getEvlogDrainMode({ NODE_ENV: "development" }), "fs");
});

test("uses console evlog drain on Vercel and production runtimes", () => {
  assert.equal(getEvlogDrainMode({ VERCEL: "1" }), "console");
  assert.equal(getEvlogDrainMode({ VERCEL_ENV: "preview" }), "console");
  assert.equal(getEvlogDrainMode({ NODE_ENV: "production" }), "console");
});

test("console evlog drain writes structured events to stdout", async () => {
  const messages: unknown[] = [];
  const originalLog = console.log;

  console.log = (message?: unknown) => {
    messages.push(message);
  };

  try {
    await createConsoleDrain()({
      event: {
        environment: "test",
        level: "info",
        operation: "mail.sync.queue.worker",
        outcome: "processed",
        service: "code-main-web",
        timestamp: "2026-07-06T00:00:00.000Z",
      },
    });
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(messages, [
    JSON.stringify({
      environment: "test",
      level: "info",
      operation: "mail.sync.queue.worker",
      outcome: "processed",
      service: "code-main-web",
      timestamp: "2026-07-06T00:00:00.000Z",
    }),
  ]);
});
