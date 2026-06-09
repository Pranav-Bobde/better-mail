**Observability Core**
- Wide structured events = non-optional baseline.
- Follow `loggingsucks.com` spirit: useful events, not noisy strings.
- Evlog pillars first: structured errors, wide events, typed catalogs.

**Error/API Rule**
- Logs carry rich detail: `code`, `status`, `message`, `why`, `fix`, `internal`.
- API response stays safe/public.
- Known evlog catalog error may return `error.message`.
- Unknown/raw error must not expose `error.message`.
- Do not break FE contract with error object unless API contract updated.

**Fact-Based Error Rule**
- `message` = short safe label. It may be API-facing only for known catalog errors.
- `why` = observed fact only. No guessed root cause like "Qdrant is down" unless error proves it.
- `fix` = next concrete debug action. Do not prescribe unverified fixes like "restart service".
- `cause` = raw thrown `Error` when available; logs only, never API response.
- `internal` = machine/debug metadata: handler, dependency, dependency function, DB function, collection kind/name, bucket/prefix, provider operation.
- Include related identifiers/metadata for debugging: `agentId`, `userId`, `collectionName`, `bucketName`, `prefix`, `deletedCount`, `errorCount`, etc.
- Keep high-cardinality/debug values in event fields or per-call `internal`, not static catalog definitions.
- Good `why`: `qdrantService.deleteCollection threw while deleting properties collection during agent delete cleanup`.
- Good `fix`: `Check Qdrant deleteCollection error, collectionName, and service connectivity for this request`.
- Bad `why`: `Qdrant is down`.
- Bad `fix`: `Restart Qdrant`.

**SSOT Rule**
- `catalogs/errors.ts` owns structured error facts.
- `fields/wideEventFields.ts` owns context/state only.
- Do not duplicate `message/why/fix/status/internal` in field types.
- Searchable error pointer = small typed code like `auth.errorCode`.
- Prefer evlog catalog errors + predicates, not custom wrapper classes.

**Cross-Module Error Ownership Rule**
- Endpoint catalog owns an error when endpoint decides the business behavior: fail request, continue cleanup, return same status, or show safe message.
- Dependency/module catalog owns an error only when the dependency normalizes/rethrows a shared error used by many callers.
- If dependency error is handled inside endpoint, keep endpoint catalog code and put dependency details in fields/per-call `internal`.
- Example endpoint-owned: `agent.DELETE_AGENT_QDRANT_CLEANUP_FAILED` because `deleteAgent.ts` decides Qdrant cleanup failure should not block DB deletion.
- Example module-owned: `qdrant.COLLECTION_DELETE_FAILED` only if `qdrantService.deleteCollection` itself throws that shared catalog error for all callers.
- Endpoint-owned `why`: `qdrantService.deleteCollection threw while deleting properties collection during agent delete cleanup`.
- Module-owned `why`: `qdrantService.deleteCollection threw while deleting a Qdrant collection`.
- Prefer stable low-cardinality codes; do not create dynamic codes per collection/id/provider response.
- Store searchable dependency pointer in fields/internal: `dependency: "qdrant"`, `dependencyOperation: "deleteCollection"`, `collectionKind: "properties"`, `collectionName`.

**Async Call Error Rule**
- Every awaited DB/external call in an endpoint should have a narrow catalog error when that call can fail the request.
- Wrap each fatal async call near the call site, add `cause`, and include the exact operation in `internal` (`dbFunction`, `dependency`, `dependencyOperation`, ids, requested status, etc.).
- Top-level handler catch should pass through known `EvlogError`; only non-Evlog/raw surprises should use `*_UNHANDLED_ERROR`.
- `*_UNHANDLED_ERROR` is a last-resort safety net, not the normal catalog for expected DB/provider failures.
- Non-fatal cleanup side effects may return cleanup outcomes and emit warnings instead of throwing; keep request behavior unchanged.
- Example specific DB error: `GET_AGENTS_FIND_FAILED` with `why: "findAgents threw while reading agents for user"`.
- Example fallback error: `GET_AGENTS_UNHANDLED_ERROR` with `why: "Unhandled non-EvlogError reached getAgents top-level catch"`.

**Field/Layout Rule**
- Root request fields live global observability.
- Auth fields live middleware-owned observability.
- Endpoint fields/catalogs live near endpoint owner.
- Prefer `observability/<endpoint>/fields/*` + `catalogs/*`.
- `shared.ts` only for exact repeated shapes.
- Avoid central mega files like `whatsappService.ts`.

**Type Rule**
- Strict fields only: required canonical + explicit optional domain fields.
- No `[key: string]: unknown` escape hatch unless observed real need.
- Use union shapes Example: For auth success/denied/failed.
- Failures should carry cause/error context.
- Avoid `as` unless truly needed / official pattern.
- Avoid optionalization; use required/non-null context where middleware guarantees it.

**Auth/Logger Rule**
- `platformAuth` guarantees user; no redundant handler user check.
- Auth failures/logging belong in auth middleware, not endpoint handler.
- `log` required in Hono context.
- No `if (log)` route-by-route checks.

**Drain/Axiom Rule**
- Logs/analytics must never block API responses.
- Use `createDrainPipeline`.
- Graceful shutdown must flush.
- Config locked: `intervalMs=1000`, `batch.size=25`, `maxBufferSize=5000`.
- `onDropped` logs drop count/error via base logger fallback.
- Add deployment note: Dokploy/container stop grace = 30s.

**Infra/Env Rule**
- No implicit defaults in env validation.
- All binds/ports/URLs/secrets/drain choices explicit.
- `OBSERVABILITY_LOG_DRAIN=axiom` explicit in env examples.
- Axiom auth kind should not be over-modeled if only one valid mode.

**Process Rule**
- No auto-stage. No auto-commit. Wait review.
- Staged review = staged-only, subagents read-only, no autofix.
- Commit msg = dumb/action-focused, no file names.
- Use caveman format in chat/docs.
- External service logic must get mock/targeted runtime validation.

**Testing/Deps Rule**
- Use Bun scripts.
- Tests live in `tests/`.
- `test:unit` is explicit list, update it when adding tests.

**Provider/Deploy Rule**
- Local setup before prod.
- Prod docs should preserve two EC2 setup: app instance + services instance.
- Self-host via Dokploy when self-hosting.
- For traces/metrics, do research first; do not ship low-quality OTEL by vibes.
