import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSessionForAuthAccess,
  isOwnerOnlyStagingAuthUrl,
  mapGoogleProfileForAuthAccess,
  ownerOnlyStagingOrigin,
  stagingOwnerEmail,
} from "./staging-access";

const devAuthUrl = "http://localhost:4000";
const productionAuthUrl = "https://mail.example.com";

test("owner-only mode activates only for the stable staging origin", () => {
  assert.equal(isOwnerOnlyStagingAuthUrl(ownerOnlyStagingOrigin), true);
  assert.equal(isOwnerOnlyStagingAuthUrl(`${ownerOnlyStagingOrigin}/`), true);
  assert.equal(isOwnerOnlyStagingAuthUrl(devAuthUrl), false);
  assert.equal(isOwnerOnlyStagingAuthUrl(productionAuthUrl), false);
  assert.equal(isOwnerOnlyStagingAuthUrl(`${ownerOnlyStagingOrigin}.attacker.invalid`), false);
});

test("staging Google OAuth accepts only the verified owner profile", () => {
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: stagingOwnerEmail,
      email_verified: true,
    }),
    {},
  );
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: stagingOwnerEmail.toUpperCase(),
      email_verified: true,
    }),
    {},
  );
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: "other@gmail.com",
      email_verified: true,
    }),
    { email: null },
  );
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: stagingOwnerEmail,
      email_verified: false,
    }),
    { email: null },
  );
});

test("non-staging Google OAuth behavior remains unchanged", () => {
  const nonOwnerProfile = { email: "other@gmail.com", email_verified: false };

  assert.deepEqual(mapGoogleProfileForAuthAccess(devAuthUrl, nonOwnerProfile), {});
  assert.deepEqual(mapGoogleProfileForAuthAccess(productionAuthUrl, nonOwnerProfile), {});
});

test("staging session access rejects non-owner users but preserves dev and production", () => {
  const ownerSession = { user: { email: stagingOwnerEmail }, session: { id: "owner-session" } };
  const publicSession = { user: { email: "other@gmail.com" }, session: { id: "public-session" } };

  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, ownerSession), ownerSession);
  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, publicSession), null);
  assert.equal(filterSessionForAuthAccess(devAuthUrl, publicSession), publicSession);
  assert.equal(filterSessionForAuthAccess(productionAuthUrl, publicSession), publicSession);
  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, null), null);
});
