import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSessionForAuthAccess,
  isOwnerOnlyPrelaunchAuthUrl,
  mapGoogleProfileForAuthAccess,
  ownerOnlyProductionOrigin,
  ownerOnlyStagingOrigin,
  prelaunchOwnerEmail,
} from "./prelaunch-access";

const devAuthUrl = "http://localhost:4000";
const publicAuthUrl = "https://mail.example.com";

test("owner-only mode activates only for stable staging and production", () => {
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(ownerOnlyStagingOrigin), true);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(`${ownerOnlyStagingOrigin}/`), true);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(ownerOnlyProductionOrigin), true);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(`${ownerOnlyProductionOrigin}/`), true);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(devAuthUrl), false);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(publicAuthUrl), false);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(`${ownerOnlyStagingOrigin}.attacker.invalid`), false);
  assert.equal(isOwnerOnlyPrelaunchAuthUrl(`${ownerOnlyProductionOrigin}.attacker.invalid`), false);
});

test("staging Google OAuth accepts only the verified owner profile", () => {
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: prelaunchOwnerEmail,
      email_verified: true,
    }),
    {},
  );
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyStagingOrigin, {
      email: prelaunchOwnerEmail.toUpperCase(),
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
      email: prelaunchOwnerEmail,
      email_verified: false,
    }),
    { email: null },
  );
});

test("production Google OAuth accepts only the verified owner profile", () => {
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyProductionOrigin, {
      email: prelaunchOwnerEmail,
      email_verified: true,
    }),
    {},
  );
  assert.deepEqual(
    mapGoogleProfileForAuthAccess(ownerOnlyProductionOrigin, {
      email: "other@gmail.com",
      email_verified: true,
    }),
    { email: null },
  );
});

test("non-owner-only Google OAuth behavior remains unchanged", () => {
  const nonOwnerProfile = { email: "other@gmail.com", email_verified: false };

  assert.deepEqual(mapGoogleProfileForAuthAccess(devAuthUrl, nonOwnerProfile), {});
  assert.deepEqual(mapGoogleProfileForAuthAccess(publicAuthUrl, nonOwnerProfile), {});
});

test("staging and production sessions reject non-owner users but preserve other origins", () => {
  const ownerSession = { user: { email: prelaunchOwnerEmail }, session: { id: "owner-session" } };
  const publicSession = { user: { email: "other@gmail.com" }, session: { id: "public-session" } };

  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, ownerSession), ownerSession);
  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, publicSession), null);
  assert.equal(filterSessionForAuthAccess(ownerOnlyProductionOrigin, ownerSession), ownerSession);
  assert.equal(filterSessionForAuthAccess(ownerOnlyProductionOrigin, publicSession), null);
  assert.equal(filterSessionForAuthAccess(devAuthUrl, publicSession), publicSession);
  assert.equal(filterSessionForAuthAccess(publicAuthUrl, publicSession), publicSession);
  assert.equal(filterSessionForAuthAccess(ownerOnlyStagingOrigin, null), null);
});
