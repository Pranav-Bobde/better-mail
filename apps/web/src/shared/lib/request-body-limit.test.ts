import assert from "node:assert/strict";
import { test } from "node:test";

import { isBodyWithinLimit, withMaxBodyBytes } from "@/shared/lib/request-body-limit";

test("accepts a declared length at the limit", () => {
  assert.equal(isBodyWithinLimit("1000", 1000), true);
});

test("rejects a declared length over the limit", () => {
  assert.equal(isBodyWithinLimit("1001", 1000), false);
});

test("rejects a missing content-length instead of buffering", () => {
  assert.equal(isBodyWithinLimit(null, 1000), false);
});

test("rejects a malformed content-length", () => {
  assert.equal(isBodyWithinLimit("not-a-number", 1000), false);
  assert.equal(isBodyWithinLimit("-5", 1000), false);
  assert.equal(isBodyWithinLimit("1e3", 1000), false);
});

// Constructed Requests do not expose an auto-computed content-length, so the
// header is set explicitly the way a real client on the wire declares it.
test("wrapped handler returns 413 over the limit and passes through under it", async () => {
  const wrapped = withMaxBodyBytes(() => Response.json({ ok: true }), 10);

  const oversized = await wrapped(
    new Request("http://localhost/test", {
      body: "x".repeat(11),
      headers: { "content-length": "11", "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "Request body too large." });

  const allowed = await wrapped(
    new Request("http://localhost/test", {
      body: "ok",
      headers: { "content-length": "2", "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(allowed.status, 200);
});

test("wrapped handler returns 411 when content-length is missing", async () => {
  const wrapped = withMaxBodyBytes(() => Response.json({ ok: true }), 10);

  const response = await wrapped(new Request("http://localhost/test", { method: "POST" }));

  assert.equal(response.status, 411);
  assert.deepEqual(await response.json(), {
    error: "Request must declare a Content-Length.",
  });
});

test("onReject fires with the specific reason and is skipped when the body is allowed", async () => {
  const rejections: unknown[] = [];
  const wrapped = withMaxBodyBytes(() => Response.json({ ok: true }), 10, {
    onReject: (rejection) => rejections.push(rejection),
  });

  await wrapped(new Request("http://localhost/test", { method: "POST" }));
  await wrapped(
    new Request("http://localhost/test", {
      body: "x".repeat(11),
      headers: { "content-length": "11" },
      method: "POST",
    }),
  );
  await wrapped(
    new Request("http://localhost/test", {
      body: "ok",
      headers: { "content-length": "2" },
      method: "POST",
    }),
  );

  assert.deepEqual(rejections, [
    { reason: "length-required" },
    { declaredBytes: 11, reason: "too-large" },
  ]);
});
