import assert from "node:assert/strict";
import test from "node:test";

import {
  ownerOnlyProductionOrigin,
  ownerOnlyStagingOrigin,
} from "@code-main/auth/prelaunch-access";

import { isSignInPageEnabled } from "@/shared/lib/access";

test("sign-in page stays closed except on owner-only staging and production", () => {
  assert.equal(isSignInPageEnabled(ownerOnlyStagingOrigin), true);
  assert.equal(isSignInPageEnabled(ownerOnlyProductionOrigin), true);
  assert.equal(isSignInPageEnabled("http://localhost:4000"), false);
  assert.equal(isSignInPageEnabled("https://mail.example.com"), false);
});
