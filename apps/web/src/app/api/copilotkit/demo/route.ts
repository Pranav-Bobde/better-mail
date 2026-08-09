import { createMailCopilotRuntimeHandler } from "@code-main/api/ai/mail-copilot-runtime";

import { log } from "@/shared/lib/evlog";
import { createSlidingWindowRateLimiter, withRateLimit } from "@/shared/lib/rate-limit";
import { withMaxBodyBytes } from "@/shared/lib/request-body-limit";

// Session-free twin of /api/copilotkit for the public demo. The runtime handler
// never reads a session: in single-route mode it dispatches on the request's
// JSON envelope, and the agent only executes the frontend tools the client sends
// with each run — so the demo needs no auth-shaped input to run the same agent.
// The handler's `basePath` ("/api/copilotkit") is a prefix check, which this
// nested route satisfies. This call constructs a runtime isolated from the
// authenticated route's, so a demo caller's threadId can never reach a
// signed-in user's in-flight run.
const handleMailCopilotRuntime = createMailCopilotRuntimeHandler();

// Unauthenticated by design, so a per-IP cap keeps one visitor from burning the
// demo's model budget. Generous enough for a real conversation; the limiter is
// best-effort only (per-instance memory, lost on restart, not shared across
// instances) and the durable cap remains the OpenRouter key's spend limit.
// This is a provider-protocol endpoint, not an internal action, so it answers
// over-limit with a plain 429 rather than the internal 200 error envelope; the
// CopilotKit client surfaces it as a chat error.
const demoCopilotRateLimiter = createSlidingWindowRateLimiter({
  limit: 20,
  windowMs: 5 * 60 * 1000,
});

// maxOutputTokens caps what a request can spend on output; this caps the input
// side. A real demo conversation (context + history + tools) stays well under
// 256KB — only hostile payloads trade in megabytes.
const maxDemoRequestBytes = 256 * 1024;

// Only rejections are logged here, on purpose — every allowed request already
// runs through the model runtime's own observability, so a wide event per
// request would just be noise on top of that.
const routeName = "api.copilotkit.demo.POST";

export const POST = withRateLimit(
  withMaxBodyBytes(handleMailCopilotRuntime, maxDemoRequestBytes, {
    onReject: (rejection) => {
      log.warn({
        eventName: "demo_copilot_body_limit_rejected",
        maxBodyBytes: maxDemoRequestBytes,
        reason: rejection.reason,
        route: routeName,
        ...(rejection.reason === "too-large" ? { declaredBytes: rejection.declaredBytes } : {}),
      });
    },
  }),
  demoCopilotRateLimiter,
  {
    onReject: (rejection) => {
      log.warn({
        eventName: "demo_copilot_rate_limited",
        rateLimitKey: rejection.key,
        retryAfterSeconds: rejection.retryAfterSeconds,
        route: routeName,
      });
    },
  },
);
