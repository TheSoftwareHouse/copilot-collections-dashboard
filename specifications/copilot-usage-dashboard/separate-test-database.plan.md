# Separate Test Database - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Separate test database for E2E and integration tests |
| Description | E2E (Playwright) tests currently run against the main `copilot_dashboard` database, causing data wipes of development data. Tests should use a dedicated `copilot_dashboard_test` database so the main database is never affected by test runs. |
| Priority | High |
| Related Research | N/A (bug/infrastructure fix) |

## Proposed Solution

Introduce a dedicated test database (`copilot_dashboard_test`) that **all** tests (E2E and Vitest) use, completely isolating test activity from the main development database.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  PostgreSQL (docker-compose, single container)      │
│                                                     │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │  copilot_dashboard  │  │ copilot_dashboard_   │  │
│  │  (dev / production) │  │ test (all tests)     │  │
│  └─────────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
          ▲                          ▲
          │                          │
     npm run dev              ┌──────┴───────┐
     (main app)               │              │
                         Playwright     Vitest
                         (E2E tests)   (unit/integration)
```

**Key decisions:**

1. **Single Postgres container, two databases** — avoids extra resource usage; both databases live in the same Postgres instance managed by `docker-compose`.
2. **Docker init script** creates the test database on first container start.
3. **Playwright global setup** ensures the test database exists and runs migrations before any E2E test, covering setups where the init script hasn't run (existing volumes).
4. **Shared `e2e/helpers/db.ts`** centralises the duplicated `DB_URL` / `getClient()` pattern found in every E2E spec file, pointing to the test database.
5. **Playwright `webServer.env`** overrides `DATABASE_URL` so the Next.js dev server started by Playwright connects to the test database.
6. **Vitest is already isolated** — `src/test/setup.ts` already overrides `DATABASE_URL` to `copilot_dashboard_test`. No changes required to the Vitest pipeline.

## Current Implementation Analysis

### Already Implemented
- `src/test/setup.ts` — already sets `DATABASE_URL` to `copilot_dashboard_test` for Vitest runs
- `src/test/db-helpers.ts` — Vitest test data source with `synchronize: true`, `cleanDatabase()`, `destroyTestDataSource()`
- `src/lib/data-source.ts` — app data source reads `DATABASE_URL` from environment
- `src/lib/data-source.cli.ts` — TypeORM CLI data source with migrations support
- `docker-compose.yml` — single Postgres 16 container with volume
- `e2e/helpers/auth.ts` — E2E auth helpers (`seedTestUser`, `loginViaApi`, `clearAuthData`)

### To Be Modified
- `docker-compose.yml` — add init script volume mount and create `docker/init-test-db.sh` to auto-create the test database
- `playwright.config.ts` — add `webServer.env` to override `DATABASE_URL` for the test server; add `globalSetup` for database creation and migrations
- `e2e/helpers/auth.ts` — replace inline `DB_URL` / `getClient()` with import from the new shared `e2e/helpers/db.ts`
- `.env.example` — add `DATABASE_URL_TEST` placeholder
- All 18 E2E spec files — replace inline `DB_URL` / `getClient()` with import from the new shared `e2e/helpers/db.ts`:
  - `e2e/auth.spec.ts`
  - `e2e/configuration-settings.spec.ts`
  - `e2e/cross-linking.spec.ts`
  - `e2e/dashboard.spec.ts`
  - `e2e/department-management.spec.ts`
  - `e2e/department-usage.spec.ts`
  - `e2e/first-run-setup.spec.ts`
  - `e2e/job-status.spec.ts`
  - `e2e/management-tabs.spec.ts`
  - `e2e/month-recollection.spec.ts`
  - `e2e/seat-edit.spec.ts`
  - `e2e/seat-list-controls.spec.ts`
  - `e2e/seat-list.spec.ts`
  - `e2e/seat-usage.spec.ts`
  - `e2e/team-management.spec.ts`
  - `e2e/team-members.spec.ts`
  - `e2e/team-usage.spec.ts`
  - `e2e/user-management.spec.ts`

### To Be Created
- `docker/init-test-db.sh` — shell script mounted into Postgres to create the test database on first container start
- `e2e/helpers/db.ts` — shared database helper exporting `TEST_DB_URL` constant and `getClient()` function for all E2E tests
- `e2e/global-setup.ts` — Playwright global setup that ensures the test database exists and runs TypeORM migrations before any test

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should vitest and E2E share the same test database? | Yes — both should use `copilot_dashboard_test`. Vitest already does. E2E needs to switch. They don't run concurrently. | ✅ Resolved |
| 2 | Should the test DB use migrations or `synchronize: true`? | Migrations for E2E (realistic), `synchronize: true` is already used by Vitest and remains unchanged. | ✅ Resolved |
| 3 | Do existing docker volumes need manual recreation? | No — the Playwright global setup creates the DB if missing, so existing setups work without re-creating volumes. | ✅ Resolved |

## Implementation Plan

### Phase 1: Infrastructure — test database provisioning

#### Task 1.1 - [CREATE] Docker init script for test database
**Description**: Create a shell script that runs on first Postgres container start and creates the `copilot_dashboard_test` database alongside the main database. Mount it into the container via `docker-compose.yml`.

**Definition of Done**:
- [x] File `docker/init-test-db.sh` created with `CREATE DATABASE copilot_dashboard_test` logic
- [x] Script is idempotent (does not fail if the database already exists)
- [x] `docker-compose.yml` updated with a volume mount: `./docker/init-test-db.sh:/docker-entrypoint-initdb.d/init-test-db.sh`
- [ ] After a fresh `docker compose up`, both `copilot_dashboard` and `copilot_dashboard_test` databases exist

#### Task 1.2 - [MODIFY] Add `DATABASE_URL_TEST` to `.env.example`
**Description**: Document the test database connection string so new developers know it exists.

**Definition of Done**:
- [x] `.env.example` contains `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/copilot_dashboard_test` with a comment

### Phase 2: Playwright configuration — isolated test server

#### Task 2.1 - [CREATE] Playwright global setup script
**Description**: Create `e2e/global-setup.ts` that runs before all E2E tests. It connects to the default `postgres` database, creates `copilot_dashboard_test` if it doesn't exist, then runs TypeORM migrations against it.

**Definition of Done**:
- [x] File `e2e/global-setup.ts` created
- [x] Connects to the `postgres` default database and conditionally creates `copilot_dashboard_test`
- [x] Runs TypeORM migrations (using `AppDataSource` from `data-source.cli.ts` pattern) against the test database
- [x] Handles the case where the database already exists without error
- [x] Exports a default `async function globalSetup()` compatible with Playwright's `globalSetup` config

#### Task 2.2 - [MODIFY] Update Playwright config to use test database
**Description**: Configure `playwright.config.ts` to (a) pass `DATABASE_URL` pointing to the test database to the web server, and (b) register the global setup script.

**Definition of Done**:
- [x] `playwright.config.ts` has `globalSetup: './e2e/global-setup.ts'`
- [x] `webServer.env` includes `DATABASE_URL` set to `process.env.DATABASE_URL_TEST || 'postgres://postgres:postgres@localhost:5432/copilot_dashboard_test'`
- [x] The Next.js dev server started by Playwright connects to `copilot_dashboard_test` (verifiable by checking app behaviour during E2E run)

### Phase 3: Shared E2E database helper

#### Task 3.1 - [CREATE] Centralised E2E database helper
**Description**: Create `e2e/helpers/db.ts` exporting a `TEST_DB_URL` constant and a `getClient()` function. This eliminates the duplicated `DB_URL` + `getClient()` boilerplate found in all 18 E2E spec files and `e2e/helpers/auth.ts`.

**Definition of Done**:
- [x] File `e2e/helpers/db.ts` created
- [x] Exports `TEST_DB_URL` constant: `process.env.DATABASE_URL_TEST || 'postgres://postgres:postgres@localhost:5432/copilot_dashboard_test'`
- [x] Exports `async function getClient(): Promise<Client>` that creates and connects a `pg.Client` using `TEST_DB_URL`
- [x] Both exports are properly typed

#### Task 3.2 - [MODIFY] Update `e2e/helpers/auth.ts` to use shared helper
**Description**: Replace the inline `DB_URL` / `getClient()` in `e2e/helpers/auth.ts` with imports from `e2e/helpers/db.ts`.

**Definition of Done**:
- [x] `e2e/helpers/auth.ts` imports `getClient` from `./db`
- [x] Inline `DB_URL` constant removed from `e2e/helpers/auth.ts`
- [x] Inline `getClient()` function removed from `e2e/helpers/auth.ts`
- [x] `seedTestUser`, `loginViaApi`, and `clearAuthData` functions work identically

### Phase 4: Migrate all E2E spec files to shared helper

#### Task 4.1 - [MODIFY] Update all E2E spec files to use shared `getClient`
**Description**: In each of the 18 E2E spec files, replace the inline `DB_URL` constant and `getClient()` function with an import from `e2e/helpers/db.ts`. Also for the 2 spec files (`configuration-settings.spec.ts`, `first-run-setup.spec.ts`) that inline the connection string without a `DB_URL` constant, extract them as well.

Files to update (each follows the same pattern):
1. `e2e/auth.spec.ts`
2. `e2e/configuration-settings.spec.ts`
3. `e2e/cross-linking.spec.ts`
4. `e2e/dashboard.spec.ts`
5. `e2e/department-management.spec.ts`
6. `e2e/department-usage.spec.ts`
7. `e2e/first-run-setup.spec.ts`
8. `e2e/job-status.spec.ts`
9. `e2e/management-tabs.spec.ts`
10. `e2e/month-recollection.spec.ts`
11. `e2e/seat-edit.spec.ts`
12. `e2e/seat-list-controls.spec.ts`
13. `e2e/seat-list.spec.ts`
14. `e2e/seat-usage.spec.ts`
15. `e2e/team-management.spec.ts`
16. `e2e/team-members.spec.ts`
17. `e2e/team-usage.spec.ts`
18. `e2e/user-management.spec.ts`

**Definition of Done**:
- [x] No E2E spec file contains an inline `DB_URL` constant or hardcoded `copilot_dashboard` connection string
- [x] No E2E spec file contains an inline `getClient()` function definition
- [x] All E2E spec files import `getClient` from `./helpers/db` (or `../helpers/db` for spec files not in `e2e/`)
- [x] All E2E tests pass against the test database

### Phase 5: Verification and code review

#### Task 5.1 - [REUSE] Verify all tests pass on the test database
**Description**: Run the full E2E and Vitest test suites to confirm they use the test database and pass. Verify the main database (`copilot_dashboard`) is not affected.

**Definition of Done**:
- [x] `npx vitest run` passes (already using test DB — regression check)
- [x] `npx playwright test` passes with all tests using `copilot_dashboard_test`
- [ ] After running the full test suite, the main `copilot_dashboard` database retains any pre-existing development data (manual spot check)
- [x] No references to `copilot_dashboard` (without `_test` suffix) remain in any E2E file except documentation/comments

#### Task 5.2 - [REUSE] Code review by `tsh-code-reviewer`
**Description**: Final code review of all changes by the automated code reviewer agent.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed

### Code Review Findings

Review verdict: **Approved**. All findings addressed:

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Minor | `TEST_DB_URL` duplicated in 3 files | Refactored `global-setup.ts` and `playwright.config.ts` to import from `e2e/helpers/db.ts` |
| 2 | Minor | `execSync` with `stdio: "pipe"` hides migration output | Changed to `stdio: "inherit"` |
| 3 | Minor | No error wrapping on Postgres admin connection | Added try/catch with helpful error message |
| 4 | Suggestion | Schema reset logic is aggressive but justified | No change needed — reviewed and confirmed intentional |
| 5 | Suggestion | `.env.example` missing comment for `DATABASE_URL_TEST` | Added descriptive comment |
| 6 | Suggestion | No `globalTeardown` in Playwright config | Noted for future — not needed currently |

## Security Considerations

- **No credentials change**: The test database uses the same Postgres superuser credentials as the development database. This is acceptable for local development but should not be replicated in production or CI environments with shared infrastructure.
- **Init script permissions**: The `docker/init-test-db.sh` script must be executable (`chmod +x`) but contains no secrets — it only issues a `CREATE DATABASE` statement using the already-configured `POSTGRES_USER`.
- **No new network exposure**: The test database is inside the same Postgres container; no additional ports are opened.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] E2E tests (`npx playwright test`) run entirely against `copilot_dashboard_test`
- [x] Vitest tests (`npx vitest run`) continue to run against `copilot_dashboard_test` (no regression)
- [ ] Running E2E tests does not delete or modify any data in `copilot_dashboard`
- [ ] Fresh `docker compose up` (new volume) creates both databases
- [ ] Existing `docker compose up` (existing volume) still works — Playwright global setup creates the test database if missing
- [x] No inline `DB_URL` / `getClient()` boilerplate remains in individual E2E spec files
- [x] `e2e/helpers/db.ts` is the single source of truth for E2E database connectivity
- [x] TypeORM migrations run successfully against the test database before E2E tests execute

## Improvements (Out of Scope)

- **CI-specific Postgres service**: In CI, use a dedicated Postgres service per pipeline run with an ephemeral test database instead of relying on a long-lived container.
- **Parallel E2E test isolation**: Create a unique database per Playwright worker to enable `fullyParallel: true` without data conflicts.
- **Test data factories**: Replace the scattered inline `seedConfiguration()` / `seedDashboardSummary()` / etc. functions in each spec file with a shared factory pattern in `e2e/helpers/`.
- **Vitest migration alignment**: Switch Vitest from `synchronize: true` to running proper migrations for closer parity with production schema evolution.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation: global-setup.ts uses `execSync('npm run typeorm:migrate')` instead of direct DataSource import (module incompatibility with Playwright's runner). Added schema-reset logic to handle test DBs previously created by Vitest's `synchronize: true`. |
| 2026-03-02 | Code review completed by `tsh-code-reviewer`. Verdict: Approved. Addressed 3 minor findings (DRY `TEST_DB_URL`, `stdio: "inherit"`, connection error wrapping) and added `.env.example` comment. |
