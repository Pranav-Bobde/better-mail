import assert from "node:assert/strict";

import { test } from "vitest";

import { openRouterRoutingOptions } from "./mail-assistant";

test("openrouter routing pins privacy-first provider options for Gmail content", () => {
  assert.deepEqual(openRouterRoutingOptions.openrouter.provider, {
    allow_fallbacks: true,
    data_collection: "deny",
    sort: "latency",
    zdr: true,
  });
});
