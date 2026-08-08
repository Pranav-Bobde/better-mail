import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { hasBearerSecret, withBearerSecretAuth, withSessionAuth } from "@/shared/lib/request-auth";

test("bearer secret verification fails closed", () => {
  assert.equal(hasBearerSecret(new Headers(), undefined), false);
  assert.equal(
    hasBearerSecret(new Headers({ authorization: "Bearer expected-secret" }), undefined),
    false,
  );
  assert.equal(
    hasBearerSecret(new Headers({ authorization: "Bearer wrong-secret" }), "expected-secret"),
    false,
  );
  assert.equal(
    hasBearerSecret(new Headers({ authorization: "Bearer expected-secret" }), "expected-secret"),
    true,
  );
});

test("bearer wrapper rejects before invoking the protected handler", async () => {
  const handler = mock.fn(async () => Response.json({ ok: true }));
  const protectedHandler = withBearerSecretAuth(handler, () => "expected-secret");

  const response = await protectedHandler(new Request("https://example.com/api/cron"));

  assert.equal(response.status, 401);
  assert.equal(handler.mock.callCount(), 0);
});

test("session wrapper rejects anonymous requests and delegates authenticated requests", async () => {
  const handler = mock.fn(async () => Response.json({ ok: true }));
  const getSession = mock.fn(async () => null as { readonly user: { readonly id: string } } | null);
  const protectedHandler = withSessionAuth(handler, getSession);
  const request = new Request("https://example.com/api/copilotkit", { method: "POST" });

  assert.equal((await protectedHandler(request)).status, 401);
  assert.equal(handler.mock.callCount(), 0);

  getSession.mock.mockImplementation(async () => ({ user: { id: "user-1" } }));

  assert.equal((await protectedHandler(request)).status, 200);
  assert.equal(handler.mock.callCount(), 1);
});
