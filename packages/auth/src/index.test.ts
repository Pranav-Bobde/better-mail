import assert from "node:assert/strict";
import test from "node:test";

import { setRequiredTestEnv } from "@code-main/env/test-env";

// Must run before importing ./index, which validates the server env schema at
// module load — hence the dynamic import inside the test.
setRequiredTestEnv();

test("email/password auth is disabled; Google OAuth is the only sign-in surface", async () => {
  const { auth } = await import("./index");

  assert.equal(auth.options.emailAndPassword?.enabled, false);
  assert.ok(auth.options.socialProviders?.google);
});
