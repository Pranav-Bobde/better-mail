Internal API Specification: Performance-First Architecture

1. Internal API Philosophy

We explicitly reject the rigid adherence to 1990s-era REST standards for internal service-to-service and frontend-to-backend communication. Our philosophy prioritizes development velocity, cognitive simplicity, and execution performance over semantic purity.

* Public APIs (Stable): These are the "front door" for external consumers. They must remain stable, semantic, and REST-compliant to ensure predictability for unknown third-party developers.
* Private/Internal APIs (Agile): These are "unstable" by design—not in reliability, but in malleability. We reserve the right to rename endpoints, restructure payloads, and change namespaces instantly to meet product requirements without the overhead of legacy versioning.

The State Machine Rationale By collapsing all application-level responses into a single HTTP status code (200 OK), we simplify the client-side Finite State Machine (FSM). Instead of forcing the client to manage a complex web of HTTP states (400, 401, 403, 404, 500, etc.), the client manages exactly two states: Reached (200) or Catastrophic Failure (non-200). Logic for validation errors or authorization is handled uniformly within the response body, reducing decision fatigue for developers.

2. Communication Standards

Methodology: The POST-Only Requirement

All internal requests must use the POST method (excluding initial page loads).

* Body Preservation: We explicitly forbid GET for data requests because reverse proxies (Nginx) and edge layers (Cloudflare) frequently drop request bodies on GET calls. Using POST ensures payload integrity across our entire infrastructure.
* Semantic Noise Reduction: We eliminate meaningless debates over PATCH vs. PUT vs. DELETE. If a request is being made to the backend, it is a POST operation.

The 200 OK Invariant

The backend must return HTTP 200 OK if the server is reached and functional. Any non-200 code is an invariant violation indicating the request never reached our application logic.

Connectivity Troubleshooting Guide:

[ SUCCESSFUL REACH ]
Client -> [Cloudflare/Proxy] -> [Backend] -> Returns 200 OK
(Result: Body contains "ok" or "error". System is healthy.)

[ CATASTROPHIC FAILURE ]
Client -> [Cloudflare/Proxy] -X- [Backend]
(Result: Non-200 Status Code. Causes: SSL Expiry, Proxy Timeout,
 DNS Misconfiguration, or Backend Instance Death.)


3. Request & Response Specification

Common Request Payload

The backend uses a standardized envelope to locate and execute logic. The JSON body must contain:

* namespace: The logical category (e.g., public, internal, admin).
* functionName: The specific handler identifier.
* data: The payload object containing parameters.

Standardized Response Schema

All application-level results are encapsulated in the response body:

Field	Type	Description
status	String	Must be "ok" (success) or "error" (failure).
data	Object	The payload returned on success.
error	String	A descriptive error message (always a string).

4. Architecture & Code Organization

Namespace-to-Directory Mapping

To ensure the system is "AI-agent friendly" and logically isolated, the namespace and functionName fields map directly to our monorepo structure: api/functions/[namespace]/[functionName]/

The Two-File Invariant

Every endpoint directory must contain exactly two files to maintain strict context isolation:

1. constants.ts: Metadata, Zod schemas, and rate limit configurations.
2. run.ts: The execution handler logic.

Code Snippet: Schema Definition (constants.ts)

import { z } from 'zod';

export const inputSchema = z.object({
  userEmail: z.string().email(),
  username: z.string().min(3).max(20)
});

export const rateLimit = {
  max: 60,
  window: "1m"
};


Code Snippet: Handler Logic (run.ts)

export const handler = async (data: any, context: any) => {
  // Authorization check - throws a string error if it fails
  const auth = await authCheck(context.token);
  if (!auth.authorized) {
    return { status: "error", error: "UNAUTHORIZED_ACCESS" };
  }

  const user = await db.users.find(data.userEmail);
  return {
    status: "ok",
    data: { userId: user.id }
  };
};


5. Request Lifecycle

The execution chain is ordered specifically by computational cost. We validate the "cheapest" constraints first to protect downstream resources.

1. Rate Limit: IP-based check (Cheapest; prevents DDoS).
2. Input Validation: Schema parsing via Zod (Cheap; CPU-bound).
3. Auth Check: Token verification/Session lookup (Expensive; requires DB/Cache I/O).
4. Handler: Core business logic (Most expensive).
5. Output Validation: Ensures the response matches the contract.

Execution Flow: Rate Limit -> Validation -> Auth Check -> Handler -> Output Validation

6. Monitoring & Health Observability

Body-Based Monitoring

Because we use the "200 OK Invariant," standard HTTP-level monitoring is effectively binary. If a monitor detects a 5xx or 4xx, it is a high-priority alarm indicating the infrastructure is down.

Health Check Protocol

Actual system health (Database status, resource exhaustion) is monitored via a dedicated endpoint. This endpoint returns a 200 OK, but the monitoring tool must be configured to parse the JSON body for truth.

Mandatory Health Metrics:

* Database Uptime: Current connection pool status.
* CPU Load: Real-time instance processing telemetry.
* Memory Usage: Current heap consumption.

7. Architecture Invariants

These rules are non-negotiable for all developers and AI agents:

* POST Exclusivity: Do not use GET for internal data fetching. Bodies must be preserved.
* No Application Status Codes: Never return 4xx or 5xx for application-level issues (validation, auth failures, etc.). These are "errors," not "failures."
* String-Only Errors: Every error response must provide a string in the error field. No nested error objects.
* Strict Isolation: Every new function requires its own directory with constants.ts and run.ts. Do not share logic files between endpoints.
* Validation Order: Always validate input schemas before performing database-heavy authorization checks.
