# AI Email Client

AI-assisted email client built with Next.js, Gmail APIs, Google OAuth, CopilotKit, oRPC, Prisma, Neon/PostgreSQL, and LangSmith.

## How To Setup

Install dependencies:

```bash
pnpm install
```

Create `apps/web/.env.local`:

```bash
APP_URL="http://localhost:4000"
BETTER_AUTH_SECRET="at-least-32-characters-secret-value"
BETTER_AUTH_URL="http://localhost:4000"
CORS_ORIGIN="http://localhost:4000"
DATABASE_URL="postgresql://user:password@host:5432/db"

GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."

OPENROUTER_API_KEY="..."
LANGCHAIN_API_KEY="..."
LANGCHAIN_PROJECT="ai-email-client"
```

Set the Google OAuth callback URL in GCP:

```text
http://localhost:4000/api/auth/callback/google
```

Prepare the database:

```bash
pnpm run db:generate
pnpm run db:push
```

Run the app:

```bash
pnpm run dev:web
```

Open:

```text
http://localhost:4000
```

Verify before handoff:

```bash
pnpm run verify
```

## Architecture Decisions And Tradeoffs

Main factors:

- Time
- Assignment scope
- Demo reliability

Stack choices:

- **Next.js + React/TS**: to get a quick start with a fullstack TypeScript app with easy deployment.
- **NeonDB + Prisma**: to get a managed Postgres with typed DB access.
- **Better Auth**: to get simple Google OAuth, session, and token handling.
- **CopilotKit + AI SDK**: since CopilotKit uses Vercel AI SDK underneath, it was only natural to use it here.
- **LangSmith**: my go to for adding quick AI observability (plus AI-SDK has built-in LangSmith integration).
- **oRPC**: to get end-to-end type safety because both frontend and backend are TypeScript, plus OpenAPI documentation from the same contracts.
- **Turborepo monorepo**: to keep app code and shared packages in one workspace, while leaving room for future apps like React Native, Electron, workers, or extensions to reuse the same typed API, auth, DB, env, and shared logic. Turborepo keeps this practical with caching plus parallel/dependency-aware task running.

Tradeoffs:

- **Polling over real mailbox sync**: used normal refetching instead of Gmail Pub/Sub/history sync to keep scope small and spend time on the remaining assignment features.
- **Gmail-first provider implementation**: Gmail is implemented directly today; before adding Microsoft/other providers, the mail layer should move behind a provider adapter.
- **Functional prompts over deeply tuned prompts**: prompts are kept good enough for working demo flows, but they are not heavily evaluated or optimized.
- **Minimal email persistence**: the database is used for auth/session/token data; emails remain in the provider mailbox.

## What I Would Improve With More Time

- Improve prompts and add eval cases.
- Adopt a provider adapter/ports pattern for Gmail, Microsoft, and other mail providers.
- Add real mailbox sync using Gmail history/watch or provider-specific webhooks.
- Add OpenTelemetry traces around API calls, AI calls, and external providers.
- Add richer LangSmith datasets and regression checks.
- Use Effect for stronger production-grade error, context, and dependency handling.
- Add stronger E2E coverage for OAuth, mailbox load, AI draft, send, and forward flows.

## Project Structure

```text
code-main/
├── apps/
│   └── web/         # Next.js app
├── packages/
│   ├── api/         # oRPC API and mail/AI logic
│   ├── auth/        # Better Auth setup
│   ├── db/          # Prisma database setup
│   ├── env/         # Environment validation
│   └── ui/          # Shared shadcn/ui components and styles
```

## Useful Scripts

- `pnpm run dev:web`: start the web app on port 4000
- `pnpm run typecheck`: run TypeScript checks
- `pnpm run lint`: run lint checks
- `pnpm run fmt`: check formatting
- `pnpm run fallow`: run dead-code audit
- `pnpm run verify`: run full verification
- `pnpm run db:generate`: generate Prisma client
- `pnpm run db:push`: push Prisma schema to the database
- `pnpm run db:migrate`: run Prisma migrations
- `pnpm run db:studio`: open Prisma Studio
