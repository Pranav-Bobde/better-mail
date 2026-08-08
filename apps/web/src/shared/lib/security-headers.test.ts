import assert from "node:assert/strict";
import test from "node:test";

import { createSecurityHeaders } from "@/shared/lib/security-headers";

test("the required security headers are configured", () => {
  const headers = new Map(createSecurityHeaders().map((header) => [header.key, header.value]));

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.match(headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
  assert.match(headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
});
