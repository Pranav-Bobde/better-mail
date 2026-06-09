# Implementation Plan

Baby-step plan. Logs first. One endpoint first. Axiom drain next.

## Phase 0: Notes + Alignment

Status: done.

Target files:

- `evlog_migration/MAIN.md`
- `evlog_migration/api-responses-vs-logs.md`
- `evlog_migration/naming-and-catalogs.md`
- `evlog_migration/pino-and-evlog.md`

Output:

- locked decisions captured
- no app behavior changed
- no prod touched

## Phase 1: Local Evlog Proof

Goal:

- show evlog works locally for `GET /api/agents`
- prove structured errors, wide events, typed catalogs
- keep Pino untouched for old code

Target files:

- `package.json` - add `evlog`
- `src/observability/wide-events/evlogConfig.ts` - local evlog config
- `src/observability/wide-events/catalogs/agent.ts` - typed error/event catalog
- `src/observability/wide-events/fields/agent.ts` - typed fields for agent events
- `src/handlers/agentHandlers/getAgents.ts` - pilot endpoint only
- `tests/observability/wide-events/agentCatalog.test.ts` - catalog/type output tests
- `tests/handlers/agentHandlers/getAgentsEvlog.test.ts` - endpoint event/error proof

Success event shape:

```json
{
  "operation": "agent.get_agents",
  "module": "agent",
  "handler": "getAgents",
  "outcome": "success",
  "user": { "id": "user_x" },
  "agents": { "count": 2 }
}
```

Error event shape:

```json
{
  "operation": "agent.get_agents",
  "module": "agent",
  "handler": "getAgents",
  "outcome": "error",
  "error": {
    "code": "agent.GET_AGENTS_FAILED",
    "message": "Failed to fetch agents",
    "why": "findAgents threw while reading agents for user",
    "fix": "Check DB connectivity and Prisma error code",
    "internal": {
      "dbFunction": "findAgents"
    }
  }
}
```

API response shape:

```json
{
  "success": false,
  "error": {
    "code": "agent.GET_AGENTS_FAILED",
    "message": "Failed to fetch agents"
  }
}
```

Acceptance:

- one wide event emitted per `GET /api/agents` request
- success event has agent count
- error event has `why` + `fix`
- API response has no `why`, `internal`, stack, DB details
- no `phone_hash`
- Pino still works elsewhere

Verification:

```sh
bun run type-check
bun test tests/observability/wide-events/agentCatalog.test.ts
bun test tests/handlers/agentHandlers/getAgentsEvlog.test.ts
```

Local smoke:

```sh
NODE_ENV=development bun --env-file=.env.development src/main.ts
curl -H "Authorization: Bearer <local-token>" http://localhost:3000/api/agents
```

## Phase 2: Axiom Proof

Goal:

- same `GET /api/agents` event visible/searchable in Axiom

Target files:

- `configs/envValidation.ts` - explicit Axiom env contract
- `src/observability/wide-events/evlogConfig.ts` - Axiom drain config
- `.env.*.example` - non-secret Axiom env names only

Acceptance:

- Axiom dataset receives events
- event searchable by `operation = agent.get_agents`
- error searchable by `error.code = agent.GET_AGENTS_FAILED`
- no secrets/PII in stored event
- stream/query proof copied into notes

Verification:

```sh
bun test tests/handlers/agentHandlers/getAgentsEvlog.test.ts
curl http://localhost:3000/api/agents
```

## Phase 3: Full Agent Module

Goal:

- migrate agent module only after Phase 1 + Phase 2 pass

Target handlers:

- `getAgents.ts`
- `getAgentById.ts`
- `createAgent.ts`
- `updateAgent.ts`
- `updateAgentStatus.ts`
- `deleteAgent.ts`

Event names:

```txt
agent.get_agents
agent.get_agent
agent.create_agent
agent.update_agent
agent.update_agent_status
agent.delete_agent
```

Error codes:

```txt
agent.GET_AGENTS_FAILED
agent.GET_AGENT_FAILED
agent.CREATE_AGENT_FAILED
agent.UPDATE_AGENT_FAILED
agent.UPDATE_AGENT_STATUS_FAILED
agent.DELETE_AGENT_FAILED
```

Acceptance:

- one wide event per request
- module-specific business fields present
- API response stays safe
- no broad app middleware yet unless needed
- no traces yet

## Not Now

- traces
- full app migration
- worker/job migration
- self-hosted observability stack
- frontend/session replay
- global logger rewrite

## Risks

- Hono evlog typing may need `AppContext` merge.
- Bun compatibility must be proven locally.
- Existing Pino pretty/file logging may hide JSON quality in old code.
- Auth smoke may need local token.

## Decision Gates

Phase 1 -> Phase 2:

- local log output good
- tests pass
- user approves shape

Phase 2 -> Phase 3:

- Axiom query proof good
- no PII leak
- user approves drain/setup

Phase 3 -> prod plan:

- full agent module local proof good
- deploy runbook written
- rollback path written
