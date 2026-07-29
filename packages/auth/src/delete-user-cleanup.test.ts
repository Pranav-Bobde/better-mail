import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { createDeleteUserConfig, revokeGoogleGrantBestEffort } from "./delete-user-cleanup";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockRevokeResponse(status: number, body: unknown) {
  const requests: { url: string; body: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({ url: request.url, body: await request.text() });
    return Response.json(body, { status });
  };
  return requests;
}

function rejectFetch(reason: string) {
  globalThis.fetch = async () => {
    throw new Error(reason);
  };
}

test("createDeleteUserConfig enables self-serve deletion", () => {
  const config = createDeleteUserConfig(async () => null);

  assert.equal(config.enabled, true);
  assert.equal(typeof config.beforeDelete, "function");
});

test("beforeDelete revokes the Google grant for the deleted user", async () => {
  const requests = mockRevokeResponse(200, {});
  const requestedUserIds: string[] = [];
  const config = createDeleteUserConfig(async (userId) => {
    requestedUserIds.push(userId);
    return "google-access-token";
  });

  await config.beforeDelete({ id: "user-1" });

  assert.deepEqual(requestedUserIds, ["user-1"]);
  assert.equal(requests[0]?.url, "https://oauth2.googleapis.com/revoke");
  assert.equal(requests[0]?.body, "token=google-access-token");
});

test("beforeDelete completes without revoking when no Google token exists", async () => {
  rejectFetch("revoke should not run without a Google token");
  const config = createDeleteUserConfig(async () => null);

  await config.beforeDelete({ id: "user-1" });
});

test("beforeDelete completes when the token lookup throws", async () => {
  rejectFetch("revoke should not run when the token lookup throws");
  const config = createDeleteUserConfig(async () => {
    throw new Error("account not found");
  });

  await config.beforeDelete({ id: "user-1" });
});

test("beforeDelete completes when Google rejects the revoke", async () => {
  // Real-shaped Google revoke error payload.
  mockRevokeResponse(400, {
    error: "invalid_token",
    error_description: "Token expired or revoked",
  });
  const config = createDeleteUserConfig(async () => "expired-token");

  await config.beforeDelete({ id: "user-1" });
});

test("revokeGoogleGrantBestEffort reports the revoke outcome without throwing", async () => {
  mockRevokeResponse(200, {});
  assert.deepEqual(await revokeGoogleGrantBestEffort(async () => "tok", "user-1"), {
    revoked: true,
  });

  assert.deepEqual(await revokeGoogleGrantBestEffort(async () => null, "user-1"), {
    revoked: false,
    error: "No Google access token available.",
  });

  assert.deepEqual(
    await revokeGoogleGrantBestEffort(async () => {
      throw new Error("token lookup failed");
    }, "user-1"),
    { revoked: false, error: "token lookup failed" },
  );
});
