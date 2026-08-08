import assert from "node:assert/strict";
import test from "node:test";

import { ownerOnlyStagingOrigin } from "@code-main/auth/staging-access";

import { isSignInPageEnabled } from "@/shared/lib/access";

test("sign-in page stays closed except on owner-only staging", () => {
  assert.equal(isSignInPageEnabled(ownerOnlyStagingOrigin), true);
  assert.equal(isSignInPageEnabled("http://localhost:4000"), false);
  assert.equal(isSignInPageEnabled("https://mail.example.com"), false);
});
