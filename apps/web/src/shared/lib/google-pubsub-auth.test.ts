import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { verifyGooglePubSubPushRequest } from "@/shared/lib/google-pubsub-auth";

const config = {
  audience: "https://example.com/api/webhooks/gmail",
  serviceAccountEmail: "gmail-push@example-project.iam.gserviceaccount.com",
};

test("Google Pub/Sub verification accepts only the configured identity", async () => {
  const verifyIdToken = mock.fn(async () => ({
    email: config.serviceAccountEmail,
    email_verified: true,
  }));
  const request = new Request(config.audience, {
    headers: { authorization: "Bearer signed-google-token" },
    method: "POST",
  });

  assert.equal(await verifyGooglePubSubPushRequest(request, config, verifyIdToken), true);
  assert.deepEqual(verifyIdToken.mock.calls[0]?.arguments, [
    "signed-google-token",
    config.audience,
  ]);
});

test("Google Pub/Sub verification rejects missing, invalid, or unexpected identities", async () => {
  const validClaims = {
    email: config.serviceAccountEmail,
    email_verified: true,
  };
  const missingTokenVerifier = mock.fn(async () => validClaims);

  assert.equal(
    await verifyGooglePubSubPushRequest(
      new Request(config.audience, { method: "POST" }),
      config,
      missingTokenVerifier,
    ),
    false,
  );
  assert.equal(missingTokenVerifier.mock.callCount(), 0);

  assert.equal(
    await verifyGooglePubSubPushRequest(
      new Request(config.audience, {
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
      config,
      async () => ({ ...validClaims, email: "attacker@example.com" }),
    ),
    false,
  );

  assert.equal(
    await verifyGooglePubSubPushRequest(
      new Request(config.audience, {
        headers: { authorization: "Bearer token" },
        method: "POST",
      }),
      config,
      async () => {
        throw new Error("bad signature");
      },
    ),
    false,
  );
});
