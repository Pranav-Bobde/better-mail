import assert from "node:assert/strict";
import test from "node:test";

import { setRequiredTestEnv } from "@code-main/env/test-env";

import { ownerOnlyStagingOrigin } from "./prelaunch-access";

// Must run before importing ./index, which validates the server env schema at
// module load — hence the dynamic import inside the test.
setRequiredTestEnv();
process.env.BETTER_AUTH_URL = ownerOnlyStagingOrigin;

test("email/password auth is disabled; Google OAuth is the only sign-in surface", async () => {
  const { auth } = await import("./index");

  assert.equal(auth.options.emailAndPassword?.enabled, false);
  const socialProviders = auth.options.socialProviders;
  assert.ok(socialProviders);
  const googleProvider = socialProviders.google;
  assert.ok(googleProvider);

  const mapProfileToUser = googleProvider.mapProfileToUser;
  assert.ok(mapProfileToUser);
  assert.deepEqual(
    await mapProfileToUser({
      aud: "google-client-id",
      azp: "google-client-id",
      email: "other@gmail.com",
      email_verified: true,
      exp: 1_785_888_000,
      family_name: "User",
      given_name: "Other",
      iat: 1_785_884_400,
      iss: "https://accounts.google.com",
      locale: "en",
      name: "Other User",
      picture: "https://example.com/avatar.png",
      sub: "google-user-id",
    }),
    { email: null },
  );
});
