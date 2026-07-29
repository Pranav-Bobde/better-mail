import assert from "node:assert/strict";
import test from "node:test";

import { revokeGoogleToken } from "./google-revoke";

test("revokeGoogleToken POSTs the token form-encoded to Google's revoke endpoint", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );

  const result = await revokeGoogleToken("ya29.a0AfB_test-access-token");

  assert.deepEqual(result, { revoked: true });
  assert.equal(fetchMock.mock.callCount(), 1);

  const firstCall = fetchMock.mock.calls[0];
  assert.ok(firstCall);
  const [url, init] = firstCall.arguments;
  assert.ok(init);
  assert.equal(url, "https://oauth2.googleapis.com/revoke");
  assert.equal(init.method, "POST");
  assert.equal(new Headers(init.headers).get("content-type"), "application/x-www-form-urlencoded");
  assert.equal(init.body, "token=ya29.a0AfB_test-access-token");
});

test("revokeGoogleToken surfaces Google's real-shaped revoke error body", async (t) => {
  // Real observed Google OAuth revoke error payload shape for an expired token.
  const googleErrorBody = {
    error: "invalid_token",
    error_description: "Token expired or revoked",
  };
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify(googleErrorBody), { status: 400 }),
  );

  const result = await revokeGoogleToken("ya29.a0AfB_expired-token");

  assert.deepEqual(result, { revoked: false, error: "invalid_token" });
});

test("revokeGoogleToken rejects an empty token without calling Google", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null));

  const result = await revokeGoogleToken("");

  assert.deepEqual(result, { revoked: false, error: "Missing Google OAuth token." });
  assert.equal(fetchMock.mock.callCount(), 0);
});
