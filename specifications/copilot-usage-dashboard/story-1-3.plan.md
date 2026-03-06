# Story 1.3: Admin can view sync and collection job status — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.3 |
| Title | Admin can view sync and collection job status |
| Description | Provide administrators with visibility into the health of background data collection processes. Admin can view when the last seat sync and usage collection jobs ran, whether they succeeded, and error details if they failed. |
| Priority | Medium |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Introduce a **JobExecution** entity to persist the outcome of every background job run, a **GET API endpoint** to retrieve the latest status per job type, and a **JobStatusPanel** UI component rendered on the existing settings page. This story creates the tracking infrastructure and read-only display; the actual sync and collection jobs (Stories 3.1 and 4.1) will write to this entity when they execute.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Next.js App                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  (app) Layout — config guard + NavBar                      │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │  /settings  (Server Component)                     │    │  │
│  │  │  ┌──────────────────┐  ┌────────────────────────┐  │    │  │
│  │  │  │ ConfigurationForm│  │ JobStatusPanel (new)    │  │    │  │
│  │  │  │ (existing, edit  │  │ - Seat Sync status      │  │    │  │
│  │  │  │  mode)           │  │ - Usage Collection      │  │    │  │
│  │  │  │                  │  │   status                │  │    │  │
│  │  │  │                  │  │ - Error details if       │  │    │  │
│  │  │  │                  │  │   last run failed       │  │    │  │
│  │  │  └──────────────────┘  └────────────────────────┘  │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  GET /api/job-status                                     │    │
│  │  Returns latest JobExecution per job type                 │    │
│  └───────────────────────────────┬──────────────────────────┘    │
│                                  │                               │
│                           ┌──────▼──────┐                        │
│                           │  PostgreSQL  │                        │
│                           │  job_execution│                       │
│                           │  table       │                        │
│                           └─────────────┘                        │
└──────────────────────────────────────────────────────────────────┘

Future writers (Stories 3.1, 4.1):
┌─────────────────────────┐
│  Seat Sync Job           │──▶ INSERT INTO job_execution
│  (Story 3.1)             │    (jobType=SEAT_SYNC, status, ...)
└─────────────────────────┘
┌─────────────────────────┐
│  Usage Collection Job    │──▶ INSERT INTO job_execution
│  (Story 4.1)             │    (jobType=USAGE_COLLECTION, status, ...)
└─────────────────────────┘
```

### Key Design Decisions

1. **Execution log (not singleton)**: Each job run creates a new `JobExecution` row rather than updating a single status row. This preserves execution history for debugging and future dashboard charts, while the API returns only the latest execution per job type.
2. **Enums for job type and status**: `JobType` (`SEAT_SYNC`, `USAGE_COLLECTION`) and `JobStatus` (`SUCCESS`, `FAILURE`, `RUNNING`) are defined as TypeScript enums and persisted as PostgreSQL enums. Adding new job types or statuses in the future requires a migration but provides type safety and database-level validation.
3. **Settings page integration**: The job status panel is placed on the existing `/settings` page below the configuration form, as both are operational/admin concerns under Epic 1. No new route is needed. This keeps the navigation simple and avoids a single-purpose page for two status cards.
4. **Server Component data fetching**: The settings page (Server Component) fetches job status data directly from the database via TypeORM — the same pattern used for configuration. The `JobStatusPanel` is a Client Component that receives pre-fetched data as props for display logic (relative time formatting, conditional rendering). No client-side API call is needed since data is loaded at page render time.
5. **Empty state handling**: When no job executions exist (before Stories 3.1/4.1 are implemented, or on first run), the UI displays "No runs recorded yet" for each job type — a clear, non-alarming empty state.
6. **`RUNNING` status**: Included for integrity — future job implementations will set `RUNNING` before starting and update to `SUCCESS`/`FAILURE` on completion. This story's UI handles the `RUNNING` state defensively, displaying an appropriate indicator.

### Data Model

```
┌────────────────────────────────────┐
│          JobExecution              │
├────────────────────────────────────┤
│ id               : Int (PK, auto) │
│ jobType          : Enum (SEAT_SYNC│
│                    USAGE_COLLECTION│
│ status           : Enum (SUCCESS, │
│                    FAILURE,        │
│                    RUNNING)        │
│ startedAt        : Timestamptz    │
│ completedAt      : Timestamptz?   │
│ errorMessage     : Text?          │
│ recordsProcessed : Int?           │
│ createdAt        : Timestamptz    │
└────────────────────────────────────┘
```

**Indexes**:
- Composite index on `(jobType, startedAt DESC)` for efficient "latest execution per job type" queries.

## Current Implementation Analysis

### Already Implemented
- `Configuration` entity — `src/entities/configuration.entity.ts` — TypeORM EntitySchema pattern used as the model for new entities
- `ApiMode` enum — `src/entities/enums.ts` — pattern for defining and exporting enums
- `GET /api/configuration` route — `src/app/api/configuration/route.ts` — pattern for API route handlers with error handling
- Database singleton (`getDb`) — `src/lib/db.ts` — connection management for use in new API routes
- `AppDataSource` — `src/lib/data-source.ts` — entity registration (new entity must be added here)
- CLI data source — `src/lib/data-source.cli.ts` — entity registration for migration CLI (new entity must be added here)
- Settings page — `src/app/(app)/settings/page.tsx` — target page for adding the job status panel
- NavBar — `src/components/NavBar.tsx` — existing navigation (no changes needed)
- Test infrastructure — `src/test/db-helpers.ts` — test data source and cleanup utilities (to extend with new entity)
- E2E patterns — `e2e/configuration-settings.spec.ts` — Playwright patterns with direct DB seeding via `pg` client
- Vitest setup — `vitest.config.ts`, `src/test/setup.ts` — existing test configuration

### To Be Modified
- `src/entities/enums.ts` — add `JobType` and `JobStatus` enums
- `src/lib/data-source.ts` — register `JobExecutionEntity` in entities array
- `src/lib/data-source.cli.ts` — register `JobExecutionEntity` in entities array
- `src/app/(app)/settings/page.tsx` — fetch latest job executions and render `JobStatusPanel` below configuration form
- `src/test/db-helpers.ts` — register `JobExecutionEntity` and extend `cleanDatabase` to clear the new table

### To Be Created
- `src/entities/job-execution.entity.ts` — TypeORM EntitySchema for `JobExecution`
- `migrations/<timestamp>-CreateJobExecution.ts` — database migration for the new table and enums
- `src/app/api/job-status/route.ts` — GET endpoint returning latest execution per job type
- `src/app/api/job-status/__tests__/route.test.ts` — integration tests for the API endpoint
- `src/components/settings/JobStatusPanel.tsx` — Client Component displaying job status cards
- `e2e/job-status.spec.ts` — E2E tests for job status display on settings page

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Where should job status be displayed — settings page or dedicated page? | Settings page — both are admin/operational concerns within Epic 1. Avoids a single-purpose page for two status cards. | ✅ Resolved |
| 2 | Should the UI auto-refresh to show live status updates? | No — page load is sufficient for this story. Admin can refresh the page manually. Auto-refresh or WebSocket push can be added later if needed. | ✅ Resolved |
| 3 | Should the API return only the latest execution or full history? | Latest per job type only. History is retained in the database for future use but not exposed yet. | ✅ Resolved |
| 4 | How should the UI handle times when no jobs have ever run? | Display "No runs recorded yet" with a neutral visual indicator (gray). This is the expected state before Stories 3.1/4.1 are implemented. | ✅ Resolved |
| 5 | Should we include a `recordsProcessed` field? | Yes — it's nullable and optional, useful for future stories (3.1, 4.1) to report how many seats/records were processed. No overhead for this story since the UI treats it as optional. | ✅ Resolved |

## Implementation Plan

### Phase 1: Database & Entity

#### Task 1.1 - [MODIFY] Add `JobType` and `JobStatus` enums to `src/entities/enums.ts`
**Description**: Extend the existing enums file with two new enums that define the types of background jobs and their possible execution statuses.

**Definition of Done**:
- [x] `JobType` enum added with values `SEAT_SYNC = "seat_sync"` and `USAGE_COLLECTION = "usage_collection"`
- [x] `JobStatus` enum added with values `SUCCESS = "success"`, `FAILURE = "failure"`, and `RUNNING = "running"`
- [x] Enums are exported alongside existing `ApiMode` enum
- [x] No changes to existing `ApiMode` enum

#### Task 1.2 - [CREATE] `JobExecution` entity at `src/entities/job-execution.entity.ts`
**Description**: Create a new TypeORM EntitySchema following the same pattern as `ConfigurationEntity`. The entity tracks each execution of a background job with its type, status, timestamps, error details, and records processed count.

**Definition of Done**:
- [x] Entity file created at `src/entities/job-execution.entity.ts` using `EntitySchema` pattern (consistent with `ConfigurationEntity`)
- [x] `JobExecution` TypeScript interface exported with fields: `id` (number), `jobType` (JobType), `status` (JobStatus), `startedAt` (Date), `completedAt` (Date | null), `errorMessage` (string | null), `recordsProcessed` (number | null), `createdAt` (Date)
- [x] Columns defined: `id` (PK, auto-increment), `jobType` (enum, not null), `status` (enum, not null), `startedAt` (timestamptz, not null), `completedAt` (timestamptz, nullable), `errorMessage` (text, nullable), `recordsProcessed` (int, nullable), `createdAt` (timestamptz, createDate)
- [x] Composite index defined on `(jobType, startedAt)` for efficient latest-per-type queries

#### Task 1.3 - [MODIFY] Register `JobExecutionEntity` in data sources
**Description**: Add the new entity to both the application data source and the CLI data source so TypeORM recognises it for queries and migrations.

**Definition of Done**:
- [x] `JobExecutionEntity` imported and added to the `entities` array in `src/lib/data-source.ts`
- [x] `JobExecutionEntity` imported and added to the `entities` array in `src/lib/data-source.cli.ts`
- [x] Application starts without errors (`npm run dev`)
- [x] TypeORM CLI commands recognise the new entity (`npm run typeorm -- schema:log -d src/lib/data-source.cli.ts`)

#### Task 1.4 - [CREATE] Database migration for `job_execution` table
**Description**: Generate a TypeORM migration that creates the `job_execution` table with the proper enum types and composite index.

**Definition of Done**:
- [x] Migration generated via `npm run typeorm:generate -- migrations/<timestamp>-CreateJobExecution`
- [x] Migration creates the `job_execution_jobtype_enum` PostgreSQL enum with values `seat_sync`, `usage_collection`
- [x] Migration creates the `job_execution_status_enum` PostgreSQL enum with values `success`, `failure`, `running`
- [x] Migration creates the `job_execution` table with all columns matching the entity definition
- [x] Migration includes a composite index on `(jobType, startedAt)`
- [x] Migration applies cleanly on a fresh database (`npm run typeorm:migrate`)
- [x] Migration reverts cleanly (`npm run typeorm:revert`)

### Phase 2: API Endpoint

#### Task 2.1 - [CREATE] GET `/api/job-status` route
**Description**: Create an API route handler that returns the latest job execution record for each job type. The endpoint performs two queries (one per job type) using `ORDER BY startedAt DESC LIMIT 1` and returns the results in a structured response.

**Definition of Done**:
- [x] Route handler created at `src/app/api/job-status/route.ts`
- [x] `GET` handler queries the `JobExecution` repository for the latest execution of each `JobType` (ordered by `startedAt DESC`, limit 1)
- [x] Returns `200` with JSON body: `{ seatSync: <JobExecution | null>, usageCollection: <JobExecution | null> }`
- [x] Each job execution object in the response includes: `id`, `jobType`, `status`, `startedAt`, `completedAt`, `errorMessage`, `recordsProcessed`
- [x] Returns `null` for a job type that has no executions (not an error — this is the expected initial state)
- [x] Internal errors return `500` with `{ error: "Internal server error" }`
- [x] Response uses consistent JSON structure with proper `Content-Type` header

### Phase 3: Settings Page UI

#### Task 3.1 - [CREATE] `JobStatusPanel` client component
**Description**: Build a client component that displays the status of each background job in a card-based layout. Each card shows the job name, last run time (relative, e.g., "2 hours ago"), status badge (colour-coded: green for success, red for failure, yellow for running, gray for no data), and error details (expandable) if the last run failed.

**Definition of Done**:
- [x] Component created at `src/components/settings/JobStatusPanel.tsx` as a `"use client"` component
- [x] Component accepts a `data` prop with type `{ seatSync: JobExecutionData | null; usageCollection: JobExecutionData | null }` where `JobExecutionData` contains: `status`, `startedAt`, `completedAt`, `errorMessage`, `recordsProcessed`
- [x] Renders two cards: "Seat Sync" and "Usage Collection"
- [x] Each card displays:
  - Job name as heading
  - Status badge: green "Success" / red "Failed" / yellow "Running" / gray "No runs yet"
  - Last run time formatted as relative time (e.g., "2 hours ago") with full timestamp as `title` attribute for tooltip
  - Completed at time (if available) formatted similarly
  - Records processed count (if available)
- [x] When status is `FAILURE`, the error message is displayed in a red-tinted detail section below the card summary
- [x] When no executions exist for a job type (`null`), the card shows "No runs recorded yet" with a neutral gray indicator
- [x] Component is accessible: uses semantic HTML (`<article>`, `<h3>`, `<dl>`/`<dt>`/`<dd>` or equivalent), status badges use `aria-label` for screen readers, colour is not the sole indicator of status (text labels accompany colours)
- [x] Component is responsive — cards stack vertically on narrow viewports and arrange side-by-side on wider viewports

#### Task 3.2 - [MODIFY] Integrate `JobStatusPanel` into settings page
**Description**: Update the settings page to fetch the latest job execution data from the database and render the `JobStatusPanel` below the existing configuration form.

**Definition of Done**:
- [x] `src/app/(app)/settings/page.tsx` imports `JobStatusPanel` and `JobExecutionEntity`
- [x] Settings page fetches the latest `JobExecution` per job type using the same TypeORM repository pattern (direct DB query in Server Component)
- [x] Fetched data is passed as props to `JobStatusPanel`
- [x] `JobStatusPanel` renders below the configuration form, visually separated with a heading (e.g., "Background Job Status")
- [x] Page layout remains responsive and the two sections (configuration form and job status) are clearly distinguished
- [x] When no configuration exists, the `(app)` layout guard redirects to `/setup` before the settings page renders (existing behaviour preserved)

### Phase 4: Testing

#### Task 4.1 - [MODIFY] Extend test helpers for `JobExecution` entity
**Description**: Update the test data source and cleanup utilities to include the `JobExecution` entity, ensuring that test isolation works correctly for the new table.

**Definition of Done**:
- [x] `src/test/db-helpers.ts` imports `JobExecutionEntity`
- [x] `JobExecutionEntity` added to the `entities` array in the test data source
- [x] `cleanDatabase` function extended to clear the `job_execution` table (in addition to `configuration`)
- [x] Existing tests continue to pass after the change

#### Task 4.2 - [CREATE] Integration tests for `GET /api/job-status`
**Description**: Write integration tests for the job status API endpoint using Vitest and the test data source. Tests follow the same pattern as the existing configuration API tests (mock `getDb`, use test data source, clean database between tests).

**Definition of Done**:
- [x] Test file created at `src/app/api/job-status/__tests__/route.test.ts`
- [x] Test: returns `200` with `{ seatSync: null, usageCollection: null }` when no job executions exist
- [x] Test: returns `200` with latest seat sync execution when multiple executions exist (verifies ordering by `startedAt DESC`)
- [x] Test: returns `200` with latest usage collection execution when multiple executions exist
- [x] Test: returns both job types populated when executions exist for both
- [x] Test: includes `errorMessage` in response when status is `FAILURE`
- [x] Test: `completedAt` and `recordsProcessed` are `null` when not set
- [x] Test: returns only the latest execution per type, not older ones
- [x] Database is cleaned between tests to ensure isolation
- [x] All tests pass

#### Task 4.3 - [CREATE] E2E tests for job status display
**Description**: Write Playwright E2E tests that verify the job status panel displays correctly on the settings page under different scenarios (no executions, successful executions, failed executions).

**Definition of Done**:
- [x] Test file created at `e2e/job-status.spec.ts`
- [x] Test setup: configuration seeded before each test (so settings page is accessible)
- [x] Test 1: Settings page shows "No runs recorded yet" for both job types when no executions exist
- [x] Test 2: Settings page shows success status with timestamp when a successful seat sync execution exists (seeded via direct DB insert)
- [x] Test 3: Settings page shows failure status with error message when a failed usage collection execution exists (seeded via direct DB insert)
- [x] Test 4: Settings page shows the latest execution per job type when multiple executions exist (both old success and recent failure seeded — UI shows the recent failure)
- [x] Database is cleaned before each test run
- [x] All E2E tests pass

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (naming, structure, formatting)
- [x] Test coverage is adequate for the feature scope

**Code Review Result**: APPROVED — No critical or major issues found.

**Minor Findings** (low-impact, acceptable as-is):
- M1: Duplicated serialization logic between API route and settings page — acceptable for two call sites, extract shared serializer if a third consumer appears.
- M2: `formatRelativeTime` doesn't handle months/years — acceptable given jobs should run frequently; consider `Intl.RelativeTimeFormat` in future.
- M3: E2E helper pattern inconsistency — new `getClient()` pattern is better than existing inline pattern; refactor existing files when next touched.

**Suggestions** (non-blocking):
- S1: Install `@types/pg` to resolve pre-existing TypeScript errors in E2E files.
- S2: Extract API response mapping helper for DRY in route.ts.
- S3: E2E `seedJobExecution` opens/closes connection per call — only relevant if E2E suite grows.
- S4: Consider adding E2E test for `RUNNING` status badge.

## Security Considerations

- **Read-only exposure**: The `GET /api/job-status` endpoint is read-only and returns operational metadata only. No sensitive data (tokens, credentials) is included in job execution records or API responses.
- **Error message sanitisation**: Error messages stored in `errorMessage` may originate from external APIs (GitHub). The UI renders error messages as text content (not `dangerouslySetInnerHTML`), preventing XSS. However, care should be taken when future stories write error messages to avoid storing raw stack traces that could leak internal implementation details.
- **No authentication (current state)**: Like the existing configuration endpoints, the job status endpoint is unauthenticated. Once authentication (Story 2.1) is implemented, this endpoint should be restricted to authenticated users.
- **SQL injection prevention**: TypeORM parameterised queries are used for all database access. No raw SQL with user input.
- **Input validation**: The GET endpoint has no user input to validate. No request body or query parameters are accepted.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Admin can see when the last seat sync ran and whether it succeeded
- [x] Admin can see when the last usage collection ran and whether it succeeded
- [x] Error details are displayed if the last run failed
- [x] Settings page displays job status panel below the configuration form
- [x] When no job executions exist, the UI shows "No runs recorded yet" (not an error state)
- [x] Status is communicated via both colour and text label (accessible)
- [x] Job status data is fetched from the database and displayed at page render time
- [x] `JobExecution` entity correctly stores job type, status, timestamps, and error message
- [x] API returns correct HTTP status codes (200, 500)
- [x] All existing Story 1.1 and 1.2 functionality continues to work
- [x] All unit/integration tests pass
- [x] All E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Auto-refresh / polling**: Periodically refresh job status on the settings page (e.g., every 30 seconds) to show updates without manual page reload.
- **Job execution history view**: A dedicated page or expandable section showing full execution history per job type with pagination.
- **Webhook / push notifications**: Notify admins via email or in-app notification when a job fails.
- **Manual job trigger**: Allow admins to trigger a sync or collection job manually from the settings page.
- **Retention policy**: Automatically purge old `JobExecution` records beyond a configurable retention window to prevent unbounded table growth.
- **Health check endpoint**: Expose job status in a `/api/health` endpoint for external monitoring systems (Prometheus, Datadog, etc.).
- **Duration display**: Calculate and display job execution duration (`completedAt - startedAt`) in the UI.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-27 | Initial plan created |
| 2026-02-27 | Implementation completed — all 5 phases done. 32 unit/integration tests pass (7 new), 12 E2E tests pass (4 new), clean build. Code review: APPROVED with 3 minor findings and 4 suggestions (all non-blocking). Infrastructure change: added `fileParallelism: false` to `vitest.config.ts` to prevent database conflicts between concurrent test files. |
