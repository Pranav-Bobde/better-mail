# Evlog Migration Main

Use caveman style in this folder: short, direct, no fluff.

## Goal

Migrate logs to evlog slowly. First prove 3 things on one endpoint:

- structured errors: `message`, `code`, `why`, `fix`, `link`, `internal`
- wide events: one rich event per request/job
- typed catalogs: stable typed error/event names

## Current Scope

Pilot endpoint:

- `GET /api/agents`
- file: `src/handlers/agentHandlers/getAgents.ts`
- local only first
- read-only DB smoke ok
- Axiom proof after local console/file proof works

## Locked Decisions

- Logs first. Traces later.
- Module-by-module rollout.
- Start with agent module, but only `getAgents` first.
- No `phone_hash`.
- Keep Pino for old untouched code during pilot.
- Do not pipe evlog through Pino.
- Use evlog where migrated code needs wide events, structured errors, typed catalogs.
- API response stays small/safe. Full debug context stays logs-only.

## Proposed Code Shape

```txt
src/observability/
  wide-events/
    catalogs/
      agent.ts
    fields/
      agent.ts
    apiResponsePolicy.ts
    evlogConfig.ts
```

## File Index

| File | Purpose |
| --- | --- |
| `MAIN.md` | High-level decisions, scope, file index. |
| `api-responses-vs-logs.md` | What API can show vs what logs can store. |
| `naming-and-catalogs.md` | Code/event naming rules. |
| `pino-and-evlog.md` | Coexistence/migration rule. |
| `implementation-plan.md` | Phase-wise starter implementation plan. |

## Next Proof

1. Add evlog dependency.
2. Add typed `agent` catalog.
3. Add wide event on `GET /api/agents`.
4. Add structured error path.
5. Run local request.
6. Show output: code + why + fix + one wide event.
7. Then Axiom stream/query proof.

## Deployment Reminder

- set Dokploy/container stop grace to 30 seconds before prod deploy
- reason: app needs time to flush queued Axiom logs on `SIGTERM`

## Sources

- evlog why: https://www.evlog.dev/start/why-evlog
- Hono integration: https://www.evlog.dev/integrate/frameworks/hono
- structured errors: https://www.evlog.dev/learn/structured-errors
- wide events: https://www.evlog.dev/learn/wide-events
- catalogs: https://www.evlog.dev/learn/catalogs
- typed fields: https://www.evlog.dev/learn/typed-fields
- best practices: https://www.evlog.dev/reference/best-practices
- evlog vs Pino: https://www.evlog.dev/reference/vs-other-loggers
- wide events article: https://loggingsucks.com/
