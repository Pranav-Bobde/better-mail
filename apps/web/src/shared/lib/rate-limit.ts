type RouteHandler = (request: Request) => Response | Promise<Response>;

// Missing x-forwarded-for means the caller reached us without going through the
// edge proxy. One shared bucket is deliberate: it throttles rather than lets an
// unattributable caller through unlimited.
const sharedRateLimitKey = "unknown-ip";

// A spoofed x-forwarded-for mints a new bucket per request, so keys are swept
// once the map grows past this. Not a security boundary, just a memory bound.
const maxTrackedRateLimitKeys = 5_000;

// Best-effort by design: the window lives in one server instance's memory, so
// it is not durable and not shared across instances — a restart or a second
// lambda starts from an empty window. The real spend cap on the public demo is
// the OpenRouter key's limit; this only blunts a trivial flood from one IP.
export function createSlidingWindowRateLimiter(config: {
  readonly limit: number;
  readonly windowMs: number;
}) {
  const hitTimesByKey = new Map<string, readonly number[]>();

  return {
    check: (key: string, now: number) => {
      if (hitTimesByKey.size > maxTrackedRateLimitKeys) {
        dropExpiredRateLimitKeys(hitTimesByKey, now, config.windowMs);
        dropOldestRateLimitKeys(hitTimesByKey, maxTrackedRateLimitKeys);
      }

      const hitTimes = getHitTimesWithinWindow(hitTimesByKey.get(key) ?? [], now, config.windowMs);

      if (hitTimes.length >= config.limit) {
        hitTimesByKey.set(key, hitTimes);

        return {
          allowed: false as const,
          retryAfterSeconds: getRetryAfterSeconds(hitTimes, now, config.windowMs),
        };
      }

      hitTimesByKey.set(key, [...hitTimes, now]);

      return {
        allowed: true as const,
        remaining: config.limit - hitTimes.length - 1,
      };
    },
  };
}

export type RateLimitRejection = {
  readonly key: string;
  readonly retryAfterSeconds: number;
};

// shared/lib stays dependency-free (no evlog import here, see
// refs/adv_folder_structure.md): callers that want the rejection logged pass
// their own hook rather than this module reaching out to a logger itself.
export function withRateLimit(
  handler: RouteHandler,
  limiter: ReturnType<typeof createSlidingWindowRateLimiter>,
  options?: { readonly onReject?: (rejection: RateLimitRejection) => void },
) {
  return async (request: Request) => {
    const key = getRateLimitKey(request.headers);
    const result = limiter.check(key, Date.now());

    if (result.allowed === false) {
      options?.onReject?.({ key, retryAfterSeconds: result.retryAfterSeconds });

      return Response.json(
        { error: "Too many requests. Try again in a few minutes." },
        {
          headers: { "retry-after": String(result.retryAfterSeconds) },
          status: 429,
        },
      );
    }

    return handler(request);
  };
}

// Proxies APPEND to x-forwarded-for, they never rewrite earlier hops. A client
// can send its own x-forwarded-for and put anything it wants in the first
// slot, so the first hop is attacker-controlled and must never key the
// bucket. The LAST hop is the address our nearest trusted proxy recorded for
// the connection it received — the client cannot forge that entry, only
// append after it, which shifts it left, not off the end.
export function getRateLimitKey(headers: Headers) {
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  const lastHop = hops[hops.length - 1]?.trim() ?? "";

  return lastHop.length === 0 ? sharedRateLimitKey : lastHop;
}

export function getHitTimesWithinWindow(
  hitTimes: readonly number[],
  now: number,
  windowMs: number,
) {
  return hitTimes.filter((hitTime) => hitTime > now - windowMs);
}

// The window frees a slot when its oldest hit falls out of it.
export function getRetryAfterSeconds(hitTimes: readonly number[], now: number, windowMs: number) {
  const oldestHitTime = hitTimes[0];

  if (oldestHitTime === undefined) {
    return 0;
  }

  return Math.max(1, Math.ceil((oldestHitTime + windowMs - now) / 1000));
}

function dropExpiredRateLimitKeys(
  hitTimesByKey: Map<string, readonly number[]>,
  now: number,
  windowMs: number,
) {
  for (const [key, hitTimes] of hitTimesByKey) {
    if (getHitTimesWithinWindow(hitTimes, now, windowMs).length === 0) {
      hitTimesByKey.delete(key);
    }
  }
}

// Hard memory bound: when a flood of distinct keys is still active after the
// expiry sweep, evict in insertion order (the map's iteration order), which
// approximates oldest-first. Evicted callers get a fresh window — acceptable
// for a best-effort limiter, unbounded growth is not.
function dropOldestRateLimitKeys(hitTimesByKey: Map<string, readonly number[]>, maxKeys: number) {
  for (const key of hitTimesByKey.keys()) {
    if (hitTimesByKey.size <= maxKeys) {
      return;
    }

    hitTimesByKey.delete(key);
  }
}
