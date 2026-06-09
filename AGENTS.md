- Global instructions: also read `/Users/pranavbobde/.codex/AGENTS.md`.

- Main app lives in `apps/web`; packages live in `packages/*`.

- Folder rules: follow `refs/adv_folder_structure.md`.
  - `src/app` = routing/glue only.
  - `src/features/*` = domain-owned UI/server/database.
  - `src/shared/*` = reusable primitives only.
  - No cross-feature imports.
  - ESLint boundaries enforce this in `eslint.config.js`.

- Internal API rules: follow `refs/backend_api_spec.md`.
  - Internal app errors return 200 body `{ status: "error", error: string }`.
  - Non-200 means infra/catastrophic failure only.
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

- Commands:
  - `pnpm run dev:web`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run fmt`
  - `pnpm run fallow`
  - `pnpm run verify`

## Non-negotiable

1. Always preserve existing behavior explicitly when fixing a bug; ensure any changes are intentional and documented.
2. If a fix requires a tradeoff that alters current logic, stop and ask first.
3. Present the impact clearly before changing behavior (what breaks, what improves, proposed default).
4. Env schema keys should be required by default; make env optional only when the product behavior explicitly supports that fallback.
5. Run the lint, typecheck, and fallow commands after making changes to verify the changes.
6. Always wait for user confirmation before fixing any issue or staging changes.
