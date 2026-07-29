- Global instructions: also read `/Users/pranavbobde/.codex/AGENTS.md`.

- Main app lives in `apps/web`; packages live in `packages/*`.
- Always refer to https://ui.shadcn.com/ for shadcn related changes.

- Folder rules: follow `refs/adv_folder_structure.md`.
  - `src/app` = routing/glue only.
  - `src/features/*` = domain-owned UI/server/database.
  - `src/shared/*` = reusable primitives only.
  - No cross-feature imports.
  - ESLint boundaries enforce this in `eslint.config.js`.

- Internal API rules: follow `refs/backend_api_spec.md`.
  - Internal app errors return 200 body `{ status: "error", error: string }`.
  - Non-2xx means infra/catastrophic failure only.
  - POST-only for internal data actions unless provider/framework endpoint needs otherwise.
  - **UI-coupled errors also need UI feedback.** 200 + error body + rich evlog stays the
    default. But when the failure is tied to an action the user just took and is watching —
    an optimistic patch that must roll back, a mutation that half-succeeded across two
    systems — logging alone is not enough: surface it, normally a toast. Never let an
    optimistic update silently revert with no explanation.
    Example: `setThreadRead` writes Gmail, then the local mirror. Gmail ok + mirror write
    failing after internal retries → return 200 ok (Gmail is source of truth, next sync
    heals it), log with full context, **and** toast that the change may briefly reappear.

- Logging rules: follow `refs/evlog_practices/`.
  - Use evlog wide structured events.
  - API response stays safe/public.
  - Logs carry rich operator context.
  - For now use filesystem drain, no Axiom.

- Code rules: follow `refs/code_practices/`.
  - Type-first TS.
  - Zod at boundaries.
  - Small explicit files.
  - Tests for external-service logic with real-shaped mock payloads.
  - Test/mock values for external services must come from real observed payload shapes, not invented shapes.

- Temporary docs/files created on demand during investigation or planning must go under `temp/`, not `refs/`. `refs/` is for durable project reference material only.

- Review docs: whenever presenting a plan, proposal, or anything the user needs to review, always produce it as an HTML doc (rendered artifact/page), not just chat text. Source file goes under `temp/` unless it is durable reference material.

- Commands:
  - `pnpm run dev:web`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run fmt`
  - `pnpm run fallow`
    - After audit, remove only `fallow-audit-base-cache-*` worktrees.
  - `pnpm run verify`

## Database & environments (Neon)

- Neon is the Postgres host. A Neon CLI (`neonctl`) is available for branch/env
  management — prefer it (read-first) over ad-hoc SQL.
- **Prod DB is `neondb @ ep-floral-tree-aokfe9q5-pooler.c-2.ap-southeast-1.aws.neon.tech`
  (Neon production branch). NEVER run destructive or schema-changing commands
  against it** — no `prisma db push`, no `prisma migrate dev`/`reset`, no
  `DELETE`/`DROP`/`TRUNCATE`, no seeds/backfills. Read-only inspection only.
- Neon project `orange-glitter-59574568`. Three branches:

  | Env     | Neon branch  | Branch id                     | Endpoint host               | `DATABASE_URL` lives in        |
  | ------- | ------------ | ----------------------------- | --------------------------- | ------------------------------ |
  | dev     | `dev`        | `br-ancient-sunset-aouim5vx`  | `ep-old-dawn-aou3woud`      | local `apps/web/.env.local`    |
  | staging | `staging`    | `br-small-resonance-aory694q` | `ep-delicate-band-aongl5fw` | Vercel **Preview** env only    |
  | prod    | `production` | `br-red-base-ao11zjtc`        | `ep-floral-tree-aokfe9q5`   | Vercel **Production** env only |

- **Verified state (2026-07-25):** segregation is done. Local `.env.local` `DATABASE_URL`
  points at the **dev** branch. The prod URL is not in `.env.local` or any repo file, and
  must never be. To confirm which branch a URL targets, match its endpoint host against
  the table above (`neonctl branches list --project-id orange-glitter-59574568`).
- **Where each environment lives:** local dev runs off `.env.local`; staging and prod are
  both Vercel deployments of the same project, separated by Vercel's Preview vs Production
  environments. **The only value that differs between the three today is `DATABASE_URL`**
  — every other var is shared. That will change as prod-only config lands (custom domain
  origins, redaction flags), so re-check rather than assuming parity.
- Env vars are required-by-default in `packages/env/src/server-schema.ts`. A var present in
  Preview but missing in Production **fails the production build**, not just the feature.
- Schema-change flow: author with `prisma migrate dev` against the **dev** branch →
  commit the migration → apply to staging/prod with `prisma migrate deploy`. NOTE:
  Vercel's build is `pnpm build` only — it does **not** run migrations. So `migrate
deploy` is currently a **manual** step against the staging/prod Neon branch (target
  it explicitly; the default `prisma.config.ts` loads `.env.local`/dev, so use a
  process-env `DATABASE_URL` or a no-dotenv config). No manual schema edits on staging/prod.

## Tooling access & approval

- **Vercel CLI is available and authenticated.** Reading env/deploy state (`vercel env ls`,
  `vercel ls`, `vercel inspect`, `vercel logs`) needs no approval. **Writing** env vars
  (`vercel env add`/`rm`), promoting, or redeploying requires the user's explicit approval
  first — present the exact command and target environment. **Production changes need a
  second, separate confirmation**, never bundled with a Preview change in the same ask.
- **Chrome profiles are available**, so browser-driven administration of connected services
  (Google Cloud Console, Vercel dashboard, Neon, Search Console, DNS, OpenRouter, LangSmith)
  is in scope. Same gate: **present the plan and the exact steps for review before acting**,
  one service at a time, and say what state each step changes. Read-only inspection and
  screenshotting to gather evidence is fine unprompted.
- These permissions do not loosen anything else: destructive/DDL DB rules, the "wait for
  confirmation before fixing" rule, and the commit/push rules all still apply.

## E2E / computer-use testing

- OAuth staging rule: Gmail API access is not domain-whitelisted; Google OAuth requires the exact redirect domain to be authorized in Google Cloud. Use the stable staging domain `better-mail-git-staging-pranavbobdes-projects.vercel.app` for OAuth E2E. Do not use random Vercel preview subdomains unless they are explicitly added to Google Cloud first.
- For real end-to-end verification that needs a live UI (browser / computer-use, e.g.
  Codex), you MAY use the user's own Gmail accounts **`bobdep31@gmail.com`** and
  **`nearl0407@gmail.com`** for testing. Use them to exercise real flows and to **create
  test scenarios that don't already exist** — e.g. send between the two accounts to build
  a multi-message thread, generate unread/labelled mail, etc.
- Sending between these two accounts to set up a test is allowed. Never act on other
  people's real mail, and avoid destructive actions (delete/archive/spam/label changes)
  on anything the user actually cares about — prefer created test messages.
- Staging/prod e2e recipe (stable alias, session handling, synthetic Pub/Sub webhook,
  Neon SQL probes): follow the established recipe from prior runs.

## Non-negotiable

1. Always refer to DESIGN.md while making any UI changes.
2. Always preserve existing behavior explicitly when fixing a bug; ensure any changes are intentional and documented.
3. If a fix requires a tradeoff that alters current logic, stop and ask first.
4. Present the impact clearly before changing behavior (what breaks, what improves, proposed default).
5. Env schema keys should be required by default; make env optional only when the product behavior explicitly supports that fallback.
6. Add new env vars as required by default; optional env needs a clear fallback reason in code/review notes and the user's approval.
7. After source code or runtime config changes, run `pnpm run typecheck`, `pnpm run lint`, `pnpm run fmt`, and `pnpm run fallow`; fix failures before review. These checks are not required for side documentation-only changes such as issue logs, plans, or refs notes.
8. Run `pnpm run verify` before final handoff when changes are commit-bound or review-bound.
9. Always wait for user confirmation before fixing any issue or staging changes.
10. For reproducible user-reported issues, do not present likely causes until all available/provided evidence sources have been used first, including exact user steps, app behavior, code paths, logs, database/platform state, and browser/devtools evidence where available.
11. Never run destructive or schema-changing DB commands (`db push`, `migrate dev`/`reset`, `DELETE`/`DROP`/`TRUNCATE`, seeds) against the prod Neon branch. Local dev targets the Neon `dev` branch; migrations reach staging/prod only via `migrate deploy` in CI/Vercel.
12. Before any DB write or DDL, confirm which Neon branch `DATABASE_URL` points to. If unsure, stop and ask.
