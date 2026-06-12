# code-main

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Mailbox Demo Setup

The mail workspace uses Gmail credentials from environment and requires them for
mailbox flows to work.

Update your `apps/web/.env.local` file with your local environment values:

```bash
APP_URL="http://localhost:4000"
BETTER_AUTH_SECRET="at-least-32-characters-secret-value"
BETTER_AUTH_URL="http://localhost:4000"
CORS_ORIGIN="http://localhost:4000"
DATABASE_URL="postgresql://user:password@localhost:5432/your_db"
GMAIL_DEMO_STATE_FILE="/tmp/code-main-gmail-demo-state.json"

# Required Gmail mailbox credentials.
GMAIL_DEMO_USER="me"
GMAIL_OAUTH_CLIENT_ID="..."
GMAIL_OAUTH_CLIENT_SECRET="..."
GMAIL_OAUTH_REFRESH_TOKEN="..."

# Required for push config, set even if you only run list/send.
GMAIL_PUBSUB_TOPIC="projects/<project-id>/topics/<topic-id>"
GMAIL_PUBSUB_VERIFICATION_TOKEN="..."
GMAIL_WATCH_LABEL_IDS="INBOX"
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:4000](http://localhost:4000) in your browser to see the fullstack application.

### Optional Database Setup

This project keeps the Prisma/PostgreSQL scaffold for future features.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@code-main/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
code-main/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
