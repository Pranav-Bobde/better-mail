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
  (Neon production/`main` branch). NEVER run destructive or schema-changing commands
  against it** — no `prisma db push`, no `prisma migrate dev`/`reset`, no
  `DELETE`/`DROP`/`TRUNCATE`, no seeds/backfills. Read-only inspection only.
- Env segregation (target state):
  - **dev** = default for local. `.env.local` `DATABASE_URL` → Neon `dev` branch.
    The prod URL must never live in `.env.local` or any repo file.
  - **staging** = Neon `staging` branch; `DATABASE_URL` set only in Vercel Preview env.
  - **prod** = Neon `main` branch; `DATABASE_URL` set only in Vercel Production env.
  - Non-DB vars may share values across envs for now; DB URLs must be segregated.
- Schema-change flow: author with `prisma migrate dev` against the **dev** branch →
  commit the migration → apply to staging/prod with `prisma migrate deploy`. NOTE:
  Vercel's build is `pnpm build` only — it does **not** run migrations. So `migrate
deploy` is currently a **manual** step against the staging/prod Neon branch (target
  it explicitly; the default `prisma.config.ts` loads `.env.local`/dev, so use a
  process-env `DATABASE_URL` or a no-dotenv config). No manual schema edits on staging/prod.

## E2E / computer-use testing

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
