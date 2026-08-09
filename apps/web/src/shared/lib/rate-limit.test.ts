import assert from "node:assert/strict";
import test from "node:test";

import {
  createSlidingWindowRateLimiter,
  getHitTimesWithinWindow,
  getRateLimitKey,
  getRetryAfterSeconds,
  withRateLimit,
} from "@/shared/lib/rate-limit";

const windowMs = 5 * 60 * 1000;
const start = Date.parse("2026-08-09T12:00:00.000Z");

test("the window keeps hits newer than it and drops the ones that aged out", () => {
  const hitTimes = [start, start + 1_000, start + windowMs];

  assert.deepEqual(getHitTimesWithinWindow(hitTimes, start + windowMs, windowMs), [
    start + 1_000,
    start + windowMs,
  ]);
  assert.deepEqual(getHitTimesWithinWindow(hitTimes, start + 2 * windowMs, windowMs), []);
  assert.deepEqual(getHitTimesWithinWindow([], start, windowMs), []);
});

test("retry-after counts the seconds until the oldest hit leaves the window", () => {
  assert.equal(getRetryAfterSeconds([start], start, windowMs), 300);
  assert.equal(getRetryAfterSeconds([start, start + 1_000], start + 60_000, windowMs), 240);
  // A slot that is already free still reports a whole second so the header
  // never tells a client to retry immediately.
  assert.equal(getRetryAfterSeconds([start], start + windowMs, windowMs), 1);
  assert.equal(getRetryAfterSeconds([], start, windowMs), 0);
});

test("a key is allowed up to the limit inside one window and blocked after it", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 3, windowMs });
  const results = [0, 1, 2, 3].map((index) => limiter.check("1.2.3.4", start + index * 1_000));

  assert.deepEqual(
    results.map((result) => result.allowed),
    [true, true, true, false],
  );
  assert.deepEqual(
    results.flatMap((result) => (result.allowed ? [result.remaining] : [])),
    [2, 1, 0],
  );
  assert.deepEqual(
    results.flatMap((result) => (result.allowed ? [] : [result.retryAfterSeconds])),
    [297],
  );
});

test("the window slides, so a key is allowed again once its oldest hit ages out", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 2, windowMs });

  limiter.check("1.2.3.4", start);
  limiter.check("1.2.3.4", start + 60_000);

  assert.equal(limiter.check("1.2.3.4", start + 120_000).allowed, false);
  // The first hit has aged out here, the second has not.
  assert.equal(limiter.check("1.2.3.4", start + windowMs + 1).allowed, true);
  assert.equal(limiter.check("1.2.3.4", start + windowMs + 2).allowed, false);
});

test("each key gets its own window", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 1, windowMs });

  assert.equal(limiter.check("1.2.3.4", start).allowed, true);
  assert.equal(limiter.check("1.2.3.4", start + 1).allowed, false);
  assert.equal(limiter.check("5.6.7.8", start + 1).allowed, true);
});

test("the key is the last forwarded hop, so a spoofed first hop cannot mint a fresh bucket", () => {
  // A client that sends its own x-forwarded-for controls everything except
  // the entry our nearest trusted proxy appended last.
  assert.equal(
    getRateLimitKey(
      new Headers({ "x-forwarded-for": "attacker-controlled, 70.41.3.18, 150.172.238.178" }),
    ),
    "150.172.238.178",
  );
  assert.equal(getRateLimitKey(new Headers({ "x-forwarded-for": " 203.0.113.7 " })), "203.0.113.7");
  assert.equal(getRateLimitKey(new Headers({ "x-forwarded-for": "" })), "unknown-ip");
  assert.equal(getRateLimitKey(new Headers()), "unknown-ip");
});

test("withRateLimit calls onReject with the key and retry-after only when blocked", async () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 1, windowMs });
  const rejections: unknown[] = [];
  const wrapped = withRateLimit(() => Response.json({ ok: true }), limiter, {
    onReject: (rejection) => rejections.push(rejection),
  });

  const allowed = await wrapped(
    new Request("http://localhost/test", { headers: { "x-forwarded-for": "203.0.113.7" } }),
  );
  assert.equal(allowed.status, 200);
  assert.deepEqual(rejections, []);

  const blocked = await wrapped(
    new Request("http://localhost/test", { headers: { "x-forwarded-for": "203.0.113.7" } }),
  );
  assert.equal(blocked.status, 429);
  assert.deepEqual(rejections, [{ key: "203.0.113.7", retryAfterSeconds: 300 }]);
});

test("a flood of distinct active keys evicts the oldest instead of growing unbounded", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 3, windowMs });

  limiter.check("victim", start);
  limiter.check("victim", start + 1);

  for (let index = 0; index < 5_001; index += 1) {
    limiter.check(`flood-${index}`, start + 2);
  }

  // The sweep finds every bucket still active, so the hard bound evicts the
  // oldest-inserted keys — "victim" restarts with a fresh window rather than
  // the map keeping every flood key forever.
  const result = limiter.check("victim", start + 3);

  assert.equal(result.allowed, true);
  assert.equal(result.allowed === true && result.remaining, 2);
});
