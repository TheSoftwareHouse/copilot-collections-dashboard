> **This file is the project constitution.** Every rule below is a hard constraint — not a suggestion, not a guideline. Copilot must follow these rules in all interactions with this repository without exception. When in doubt, these instructions take precedence over general knowledge or external best practices.

# Architecture

Next.js 16 App Router application — a GitHub Copilot usage analytics dashboard with PostgreSQL backend. Standalone output mode for Docker deployment. No monorepo — single application.

Route group `(app)` wraps all authenticated pages with config + session checks.

```
src/
  app/           → Next.js App Router pages and API routes
    (app)/       → Route group for authenticated pages (layout checks config + session)
    api/         → REST API routes
  components/    → UI components organized by domain folder (usage/, dashboard/, teams/, shared/)
  entities/      → TypeORM EntitySchema definitions + TypeScript interfaces
  lib/           → Shared business logic and helpers
    hooks/       → Client-side React hooks
    validations/ → Zod schemas for request validation
    __tests__/   → Unit tests for lib modules
  test/          → Test infrastructure (setup, db-helpers)
migrations/      → TypeORM migration files (timestamped)
e2e/             → Playwright E2E tests
  helpers/       → E2E helper utilities (auth, db)
specifications/  → Feature specs, task plans, story plans
```

# Technology Stack

- TypeScript 5 (strict mode, path alias `@/*` → `./src/*`)
- Next.js 16.1.6 (App Router, standalone output)
- React 19.2.3 with Server Components
- Tailwind CSS 4 via `@tailwindcss/postcss`
- TypeORM 0.3.28 with EntitySchema pattern (NOT decorators)
- PostgreSQL 16 via `pg` 8.19
- Zod 4.3.6 for request validation
- Recharts 3.7.0 for charts
- arctic 3.7.0 for Azure Entra ID OAuth
- bcryptjs 3.0.3 for password hashing
- node-cron 4.2.1 for scheduled jobs
- Vitest 4.0.18 for unit/integration tests
- Playwright 1.58.2 for E2E tests
- ESLint 9 with eslint-config-next

# Coding Conventions

Rules not enforced by linters:

**Path aliases only** — use `@/` (maps to `src/`) for all imports. Never use relative imports across directories.

**No barrel files** — import directly from each module. No `index.ts` re-exports.

**Entity definition style** — always `EntitySchema<Interface>`, never decorators. Each entity file exports both the TypeScript interface and the EntitySchema:

```ts
// Preferred
export interface Team { id: number; name: string; }
export const TeamEntity = new EntitySchema<Team>({ name: "Team", tableName: "team", columns: { ... } });

// Avoided — never use decorators
@Entity() class Team { @PrimaryGeneratedColumn() id: number; }
```

**Database access** — always through `getDb()` from `@/lib/db`. Never import or construct DataSource directly in route handlers.

**Zod schema naming** — `create{Entity}Schema`, `update{Entity}Schema` in `src/lib/validations/`. Shared field schemas in `shared.ts`. Extract types with `z.infer<typeof schema>`.

**Type guard pattern** — use `result is Type` return types for discrimination: `isAuthFailure()`, `isValidationError()`, `isUniqueViolation()`.

**Custom error classes** — extend `Error` with `this.name = "ClassName"` in constructor. `NotFoundError` in `@/lib/errors`.

**Migration format** — `{timestamp}-{PascalCaseDescription}.ts` in `migrations/`. Raw SQL in `up()`/`down()`. Production uses `synchronize: false`.

# Error Handling

- API routes: single `try/catch` wrapping the entire handler body, `catch` delegates to `handleRouteError(error, "METHOD /api/path")`
- `handleRouteError` returns: `NotFoundError` → 404, unique violation → 409, generic → 500
- Error response format: `{ error: "message" }`, optionally `{ error, details }` for validation errors
- Never expose internal error details in production

# Testing Strategy

- **Integration tests (Vitest)**: API routes tested against real PostgreSQL test database — NOT mocked queries. Tests co-located in `__tests__/` folders next to source.
- **Component tests (Vitest)**: Minimal export-existence checks only (rendering tested via E2E). Environment is `node`, not jsdom.
- **E2E tests (Playwright)**: Full user flows in `e2e/` directory. Direct DB seeding via `pg.Client`, API-based login via `loginViaApi()`. **Always run both configs** — default (`npx playwright test`) for credentials-mode tests, then Azure (`npx playwright test --config playwright.azure.config.ts`) for Azure-mode tests. Both must pass.
- **Test data**: Each test file defines its own seed functions (`seedSeat()`, `seedUsage()`, etc.) — NOT shared across files.
- **`fileParallelism: false`** — tests run sequentially due to shared test database.

# Development Workflow

Use `npm run` for all tasks, not raw commands:

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npx vitest run` — run unit/integration tests
- `npx playwright test` — run E2E tests (credentials mode, excludes `azure-login.spec.ts`)
- `npx playwright test --config playwright.azure.config.ts` — run Azure-mode E2E tests (`azure-login.spec.ts` only)

**Docker**: `docker compose up` for local PostgreSQL. Multi-stage Dockerfile with `scripts/docker-entrypoint.sh` running migrations on startup.

**Migrations**: Create with TypeORM CLI, run via `scripts/run-migrations.ts`.

**Background jobs**: Configured in `instrumentation.ts` via node-cron. Job types: seat sync, usage collection, month recollection, team carry-forward. Use pessimistic locking via `acquireJobLock()`.
