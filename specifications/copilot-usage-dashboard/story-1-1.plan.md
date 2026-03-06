# Story 1.1: Admin can configure organisation or enterprise settings on first run — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.1 |
| Title | Admin can configure organisation or enterprise settings on first run |
| Description | Enable the initial first-run setup that gates all data collection. Admin configures whether the application uses organisation or enterprise GitHub endpoints and provides the entity name. Configuration is persisted to the database and the system begins operating with the selected settings. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Build the first-run configuration flow as a full-stack feature using **Next.js App Router** (TypeScript), **TypeORM** with **PostgreSQL**, and **Zod** for validation. The application is deployed via **Docker Compose**.

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                     │
│  ┌───────────────┐     ┌──────────────────────────┐ │
│  │  /setup page   │────▶│ POST /api/configuration  │ │
│  │ (Server Comp.) │     │  (Route Handler)         │ │
│  │ + Client Form  │     │  - Zod validation        │ │
│  └───────────────┘     │  - TypeORM persistence   │ │
│         ▲               └────────────┬─────────────┘ │
│         │                            │               │
│  ┌──────┴────────┐                   ▼               │
│  │ Root Layout    │          ┌──────────────┐        │
│  │ (config check  │          │  PostgreSQL   │        │
│  │  + redirect)   │◀─────── │  Configuration│        │
│  └───────────────┘          │  table        │        │
│         │                    └──────────────┘        │
│         ▼                                            │
│  ┌───────────────┐                                   │
│  │  /dashboard    │                                   │
│  │  (placeholder) │                                   │
│  └───────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **ORM — TypeORM**: Mature ORM with decorator-based entity definitions, built-in migration support, and strong TypeScript integration. Provides repository pattern for clean data access.
2. **Validation — Zod**: Shared validation schemas between API routes and client-side forms. Native TypeScript type inference.
3. **Configuration singleton**: The `Configuration` table holds at most one row. POST endpoint returns 409 Conflict if configuration already exists. No delete endpoint.
4. **First-run detection**: Root layout (Server Component) queries the database for configuration existence. If absent, redirects to `/setup`. The `/setup` page itself checks and redirects to `/dashboard` if configuration already exists. This avoids Edge Runtime limitations of Next.js middleware (TypeORM requires Node.js runtime).
5. **GitHub token**: Provided via `GITHUB_TOKEN` environment variable — not stored in the database. More secure and follows 12-factor app principles for secrets.
6. **Route groups**: Use `(app)` route group for pages requiring configuration, keeping `/setup` outside so it's always accessible.

### Data Model

```
┌──────────────────────────────┐
│       Configuration          │
├──────────────────────────────┤
│ id         : Int (PK, auto)  │
│ apiMode    : Enum (ORG|ENT)  │
│ entityName : String          │
│ createdAt  : DateTime        │
│ updatedAt  : DateTime        │
└──────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- None — this is a greenfield project with no source code.

### To Be Modified
- None.

### To Be Created
- Next.js project scaffolding (App Router, TypeScript, Tailwind CSS)
- Docker Compose file with PostgreSQL service
- TypeORM setup with PostgreSQL connection and `Configuration` entity
- Database migration for `Configuration` table
- Zod validation schema for configuration input
- `GET /api/configuration` API route
- `POST /api/configuration` API route
- Root layout with configuration existence check and redirect logic
- `/setup` page with `ConfigurationForm` component
- `/dashboard` placeholder page
- Unit/integration tests for API routes
- E2E test for the complete first-run flow (Playwright)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | How is the GitHub API token provided? | Via `GITHUB_TOKEN` environment variable (not stored in DB for security) | ✅ Resolved |
| 2 | Where should the user be redirected after configuration? | To `/dashboard` (placeholder page until Dashboard epic is implemented) | ✅ Resolved |
| 3 | Should the setup page be accessible after initial configuration? | No — visiting `/setup` when config exists redirects to `/dashboard`. Editing is handled by Story 1.2 via a settings page. | ✅ Resolved |
| 4 | Is authentication required for the setup page? | No — first run has no users yet. Authentication (Story 2.1) is a separate epic. | ✅ Resolved |
| 5 | Should Next.js middleware or layout-level checks handle first-run redirect? | Layout-level redirect in a Server Component. Next.js middleware runs on Edge Runtime, which does not support TypeORM's Node.js-based database drivers. | ✅ Resolved |

## Implementation Plan

### Phase 1: Project Foundation & Database

#### Task 1.1 - [CREATE] Next.js Project Scaffolding
**Description**: Initialise a new Next.js project with TypeScript, App Router, and Tailwind CSS. Establish the base directory structure under `src/`.

**Definition of Done**:
- [x] Next.js project created with App Router and TypeScript enabled
- [x] Tailwind CSS installed and configured
- [x] ESLint configured with Next.js recommended rules
- [x] Directory structure established: `src/app/`, `src/lib/`, `src/components/`
- [x] `tsconfig.json` has path aliases configured (`@/` → `src/`)
- [x] Project builds (`next build`) and starts (`next dev`) without errors

#### Task 1.2 - [CREATE] Docker Compose for PostgreSQL
**Description**: Create a Docker Compose file that provisions a PostgreSQL instance for local development and self-hosted production deployment.

**Definition of Done**:
- [x] `docker-compose.yml` created with a `postgres` service (PostgreSQL 16)
- [x] Database name, user, and password configurable via environment variables
- [x] Volume mount configured for data persistence across container restarts
- [x] `.env.example` file created with all required environment variable placeholders (`DATABASE_URL`, `GITHUB_TOKEN`)
- [x] `.env` added to `.gitignore`
- [x] Running `docker compose up -d` starts PostgreSQL successfully and it accepts connections

#### Task 1.3 - [CREATE] TypeORM Setup & Configuration Entity
**Description**: Install and configure TypeORM with PostgreSQL. Define the `Configuration` entity and generate the initial database migration.

**Definition of Done**:
- [x] `typeorm`, `pg`, and `reflect-metadata` installed as dependencies
- [x] TypeORM data source configuration created at `src/lib/data-source.ts` using `DATABASE_URL` env var (parsed into host, port, username, password, database)
- [x] `ApiMode` enum defined as a TypeScript enum with values `ORGANISATION` and `ENTERPRISE`
- [x] `Configuration` entity created at `src/entities/configuration.entity.ts` with decorator-based column definitions: `id` (PrimaryGeneratedColumn), `apiMode` (enum column), `entityName` (varchar 255), `createdAt` (CreateDateColumn), `updatedAt` (UpdateDateColumn)
- [x] `tsconfig.json` updated to enable `experimentalDecorators` and `emitDecoratorMetadata`
- [x] Initial migration generated (`typeorm migration:generate`) and applies cleanly
- [x] Database connection singleton created at `src/lib/db.ts` that initialises the data source once and reuses it (prevents hot-reload connection exhaustion in Next.js dev mode)
- [x] `typeorm:migrate` and `typeorm:generate` scripts added to `package.json`

### Phase 2: Configuration API

#### Task 2.1 - [CREATE] Zod Validation Schema
**Description**: Create a Zod schema for validating configuration input. This schema will be shared between the API route (server-side validation) and the form component (client-side validation).

**Definition of Done**:
- [x] Schema file created at `src/lib/validations/configuration.ts`
- [x] `configurationSchema` validates `apiMode` as enum `"organisation"` or `"enterprise"` (lowercase strings matching UI values, mapped to TypeORM `ApiMode` enum on persistence)
- [x] `configurationSchema` validates `entityName` as a non-empty, trimmed string with max length 255
- [x] TypeScript type `ConfigurationInput` inferred from schema and exported
- [x] Schema includes descriptive error messages for each validation rule
- [x] Unit tests verify schema accepts valid input and rejects invalid input (empty entityName, invalid apiMode, oversized strings)

#### Task 2.2 - [CREATE] GET /api/configuration Route
**Description**: Create an API route handler that returns the current application configuration, or indicates that no configuration exists.

**Definition of Done**:
- [x] Route handler created at `src/app/api/configuration/route.ts`
- [x] `GET` handler queries the database for a configuration record using the TypeORM `Configuration` repository
- [x] Returns `200` with JSON body `{ apiMode, entityName, createdAt, updatedAt }` when configuration exists
- [x] Returns `404` with JSON body `{ error: "Configuration not found" }` when no configuration exists
- [x] Response uses consistent JSON structure with proper `Content-Type` header
- [x] Integration tests cover both configured and unconfigured states

#### Task 2.3 - [CREATE] POST /api/configuration Route
**Description**: Create an API route handler that creates the initial application configuration. Enforces singleton constraint — rejects requests if configuration already exists.

**Definition of Done**:
- [x] `POST` handler added to `src/app/api/configuration/route.ts`
- [x] Request body parsed and validated against Zod schema
- [x] Returns `400` with structured validation errors for invalid input
- [x] Returns `409 Conflict` with `{ error: "Configuration already exists" }` if a configuration record is already present
- [x] Returns `201` with the created configuration object on success
- [x] `apiMode` value mapped from lowercase input string to TypeORM `ApiMode` enum before persistence
- [x] Configuration record created in PostgreSQL via TypeORM repository
- [x] Uses a transaction or check-then-insert pattern to prevent race conditions on concurrent requests
- [x] Integration tests verify: successful creation, validation rejection, and conflict detection

### Phase 3: First-Run Setup UI

#### Task 3.1 - [CREATE] ConfigurationForm Client Component
**Description**: Build a client component that renders the configuration form with API mode selection and entity name input. Handles form submission, validation, loading states, and error display.

**Definition of Done**:
- [x] Component created at `src/components/setup/ConfigurationForm.tsx` as a `"use client"` component
- [x] Radio button group for selecting "Organisation" vs "Enterprise" with clear labels
- [x] Text input for the organisation or enterprise name with a label that updates based on selected mode (e.g., "Organisation name" / "Enterprise name")
- [x] Client-side validation using the shared Zod schema with inline error messages
- [x] Submit button with loading/disabled state during API call
- [x] On submit: sends POST request to `/api/configuration`
- [x] On success (201): redirects to `/dashboard` using `useRouter().push()`
- [x] On conflict (409): displays a message indicating configuration already exists and redirects to `/dashboard`
- [x] On validation error (400): displays server-side validation errors
- [x] On network/server error (5xx): displays a generic error message
- [x] Component is accessible: proper `<label>` associations, `aria-describedby` for errors, keyboard-navigable, focus management on error
- [x] Component unit tests verify rendering, validation display, and submit behaviour (with mocked fetch)

#### Task 3.2 - [CREATE] Setup Page
**Description**: Create the `/setup` page that displays the first-run configuration form. This page serves as the entry point when no configuration exists.

**Definition of Done**:
- [x] Page created at `src/app/setup/page.tsx` as a Server Component
- [x] Server-side check: if configuration already exists (TypeORM repository query), redirect to `/dashboard` using `redirect()` from `next/navigation`
- [x] Page renders a heading ("Welcome — First-Run Setup" or similar), a brief description explaining the purpose, and the `ConfigurationForm` component
- [x] Page is responsive (works on desktop and tablet viewports)
- [x] Page has appropriate `<title>` via metadata export

#### Task 3.3 - [CREATE] Dashboard Placeholder Page
**Description**: Create a minimal dashboard page that the user lands on after completing configuration. Shows a confirmation that the system is configured.

**Definition of Done**:
- [x] Page created at `src/app/(app)/dashboard/page.tsx` inside a `(app)` route group
- [x] Displays a heading confirming the system is configured
- [x] Shows the current configuration values (API mode and entity name) fetched server-side
- [x] Page has appropriate `<title>` via metadata export

#### Task 3.4 - [CREATE] App Layout with Configuration Guard
**Description**: Create a layout for the `(app)` route group that checks for configuration existence and redirects to `/setup` if no configuration is found. This ensures all application pages are protected behind the first-run setup.

**Definition of Done**:
- [x] Layout created at `src/app/(app)/layout.tsx` as a Server Component
- [x] Queries the database for configuration existence via TypeORM repository
- [x] If no configuration exists, calls `redirect('/setup')` from `next/navigation`
- [x] If configuration exists, renders `children` normally
- [x] API routes (`/api/*`) are outside the `(app)` route group and unaffected
- [x] `/setup` page is outside the `(app)` route group and always accessible
- [x] Verified: navigating to `/dashboard` with no configuration redirects to `/setup`
- [x] Verified: navigating to `/dashboard` with configuration renders the dashboard

### Phase 4: Testing

#### Task 4.1 - [CREATE] Test Infrastructure Setup
**Description**: Configure the testing frameworks for the project — Jest (or Vitest) for unit/integration tests and Playwright for E2E tests.

**Definition of Done**:
- [x] Unit/integration test runner installed and configured (Jest or Vitest with TypeScript support)
- [x] Test utilities set up for TypeORM (test database configuration, data source initialisation/teardown, cleanup between tests)
- [x] Playwright installed and configured with a `playwright.config.ts`
- [x] Test scripts added to `package.json`: `test`, `test:e2e`
- [x] A trivial smoke test passes in each framework to confirm setup

#### Task 4.2 - [CREATE] API Integration Tests
**Description**: Write integration tests for the configuration API endpoints using a test database.

**Definition of Done**:
- [x] Test file created at `src/app/api/configuration/__tests__/route.test.ts` (or equivalent)
- [x] `GET /api/configuration` — returns 404 when no configuration exists
- [x] `GET /api/configuration` — returns 200 with data when configuration exists
- [x] `POST /api/configuration` — returns 201 and persists valid configuration
- [x] `POST /api/configuration` — returns 400 for invalid input (empty entityName, invalid apiMode)
- [x] `POST /api/configuration` — returns 409 when configuration already exists
- [x] Database is cleaned between tests to ensure isolation
- [x] All tests pass

#### Task 4.3 - [CREATE] E2E Test for First-Run Flow
**Description**: Write a Playwright end-to-end test that exercises the complete first-run configuration flow from setup to dashboard.

**Definition of Done**:
- [x] Test file created at `e2e/first-run-setup.spec.ts`
- [x] Test 1: User visits `/` with no configuration → redirected to `/setup`
- [x] Test 2: User fills in the form (selects "Organisation", enters entity name) → submits → redirected to `/dashboard` showing correct config values
- [x] Test 3: User visits `/setup` after configuration exists → redirected to `/dashboard`
- [x] Test 4: User submits form with empty entity name → validation error displayed, no redirect
- [x] Database is reset before each test run
- [x] All E2E tests pass

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [ ] All source code reviewed by `tsh-code-reviewer` agent
- [ ] No critical or high-severity issues remain unresolved
- [ ] All review feedback addressed or documented as intentional design decisions
- [ ] Code follows project conventions (naming, structure, formatting)
- [ ] Test coverage is adequate for the feature scope

## Security Considerations

- **GitHub Token Security**: The `GITHUB_TOKEN` is stored exclusively as an environment variable, never persisted in the database or exposed to the client. The `.env` file is gitignored. `GITHUB_TOKEN` is not included in any API response or client-side bundle.
- **Input Validation**: All user input is validated server-side with Zod before database persistence. `entityName` is trimmed and length-constrained to prevent injection and overflow attacks. TypeORM's parameterised queries prevent SQL injection.
- **Singleton Enforcement**: The POST endpoint checks for existing configuration before insert, preventing accidental overwrites. A race-condition-safe pattern (e.g., unique constraint or transaction) is used.
- **No Authentication on Setup**: The setup page is intentionally unauthenticated since no application users exist at first run. This is an accepted trade-off — once authentication (Story 2.1) is implemented, the setup flow should be revisited to ensure only admins can reconfigure the system.
- **CSRF Protection**: Next.js API routes enforce same-origin requests via built-in header checks. The form submits to a same-origin API endpoint.
- **Content Security**: Response headers should include basic security headers (`X-Content-Type-Options`, `X-Frame-Options`). This can be configured in `next.config.js`.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] First-run setup screen is displayed when no configuration exists
- [x] Admin can choose between organisation-level and enterprise-level endpoints
- [x] Admin can provide the organisation or enterprise name
- [x] Configuration is saved to the database after submission
- [x] After saving, the system begins operating with the selected configuration (user redirected to dashboard, config values displayed)
- [x] Configuration persists across application restarts (verified by stopping and restarting the app)
- [x] Invalid input is rejected with clear, accessible error messages
- [x] Setup page redirects to dashboard if configuration already exists
- [x] Non-setup pages redirect to setup if no configuration exists
- [x] API returns correct HTTP status codes (200, 201, 400, 404, 409)
- [x] All unit/integration tests pass
- [x] All E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **GitHub Token in UI**: Allow admin to enter/update the GitHub token through the setup form instead of requiring an environment variable.
- **Configuration Encryption**: Encrypt sensitive configuration fields at rest in the database.
- **Multi-tenancy**: Support multiple organisation/enterprise configurations simultaneously.
- **GitHub App Authentication**: Use a GitHub App (with installation tokens) instead of a PAT for more granular permissions and automatic token rotation.
- **Audit Logging**: Log configuration creation and modification events with timestamps and actor identity.
- **Health Check Endpoint**: Add `/api/health` that verifies database connectivity and configuration status for monitoring.
- **Setup Wizard**: Multi-step wizard that also validates the GitHub token and org/enterprise name against the GitHub API before saving.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-27 | Initial plan created |
| 2026-02-27 | Replaced Prisma ORM with TypeORM per project requirements |
| 2026-02-27 | Switched from TypeORM decorator-based entities to EntitySchema pattern — Turbopack breaks decorator metadata across module boundaries |
| 2026-02-27 | Moved migrations/ directory outside src/ to prevent Turbopack from scanning/bundling migration files |
| 2026-02-27 | Added `serverExternalPackages: ["typeorm", "reflect-metadata", "pg"]` to next.config.ts for Turbopack compatibility |
