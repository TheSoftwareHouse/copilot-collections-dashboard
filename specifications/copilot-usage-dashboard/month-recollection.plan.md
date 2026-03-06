# Month Recollection - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Full Month Usage Recollection from UI |
| Description | Allow users to select a specific month/year and trigger a full re-fetch of usage data from the GitHub API for every seat and every day of that month, with dashboard metrics recalculated afterwards. |
| Priority | Medium |
| Related Research | N/A |

## Proposed Solution

Add a "Month Recollection" feature that allows administrators to select a specific month/year from the Settings page and trigger a complete re-collection of usage data from the GitHub API. This operation fetches premium request usage for **every seat** (active and inactive) for **every day** of the selected month, upserts the data, and then refreshes the dashboard metrics summary for that month.

### Architecture Overview

```
┌─────────────────────────┐
│  Settings Page (UI)     │
│  MonthRecollectionPanel │
│  - Month/Year selector  │
│  - "Recalculate" button │
│  - Job status display   │
└──────────┬──────────────┘
           │ POST /api/jobs/month-recollection?month=X&year=Y
           ▼
┌─────────────────────────────────┐
│  API Route Handler              │
│  src/app/api/jobs/              │
│  month-recollection/route.ts    │
│  - Auth check                   │
│  - Validates params             │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  executeMonthRecollection()     │
│  src/lib/month-recollection.ts  │
│  - Concurrency guard (RUNNING)  │
│  - Fetches ALL seats            │
│  - Generates full date range    │
│  - Calls GitHub API per seat/day│
│  - Upserts copilot_usage rows   │
│  - Creates job_execution record │
└──────────┬──────────────────────┘
           │ on success
           ▼
┌─────────────────────────────────┐
│  refreshDashboardMetrics()      │
│  src/lib/dashboard-metrics.ts   │
│  (existing - no changes)        │
└─────────────────────────────────┘
```

### Key Design Decisions

1. **New `JobType` enum value**: `month_recollection` — requires a DB migration to alter the PostgreSQL enum.
2. **All seats included**: Both active and inactive seats are processed, since inactive seats may have had usage during the selected historical month.
3. **Concurrency guard**: Only one month recollection job can run at a time. The system checks for a `RUNNING` job of type `month_recollection` before starting a new one.
4. **Reuses existing patterns**: Follows the same `fetchPremiumRequestUsage` → upsert → `refreshDashboardMetrics` flow used by regular usage collection.
5. **Job metadata**: The `job_execution` record stores the target month/year in the `errorMessage` field is not ideal; instead, we store a summary in a structured log. The existing `recordsProcessed` column tracks total day-records upserted.
6. **UI placed on Settings page**: A new `MonthRecollectionPanel` component is added below the existing `JobStatusPanel`.

## Current Implementation Analysis

### Already Implemented
- `fetchPremiumRequestUsage()` — [src/lib/github-api.ts](src/lib/github-api.ts) — Fetches premium request usage for a single user/day from GitHub API
- `refreshDashboardMetrics(month, year)` — [src/lib/dashboard-metrics.ts](src/lib/dashboard-metrics.ts) — Aggregates copilot_usage data into dashboard_monthly_summary
- `POST /api/dashboard/recalculate` — [src/app/api/dashboard/recalculate/route.ts](src/app/api/dashboard/recalculate/route.ts) — Recalculates dashboard summary from existing data (no API fetching)
- `POST /api/jobs/usage-collection` — [src/app/api/jobs/usage-collection/route.ts](src/app/api/jobs/usage-collection/route.ts) — Triggers incremental usage collection (today only)
- `executeUsageCollection()` — [src/lib/usage-collection.ts](src/lib/usage-collection.ts) — Incremental collection from last stored date to today, active seats only
- `JobStatusPanel` — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — UI component showing job status with Sync Now / Collect Now buttons
- Settings page — [src/app/(app)/settings/page.tsx](src/app/(app)/settings/page.tsx) — Server component rendering config form + job status
- `JobType` enum — [src/entities/enums.ts](src/entities/enums.ts) — Currently has `seat_sync` and `usage_collection`
- `JobExecutionEntity` — [src/entities/job-execution.entity.ts](src/entities/job-execution.entity.ts) — Tracks job runs
- `CopilotUsageEntity` — [src/entities/copilot-usage.entity.ts](src/entities/copilot-usage.entity.ts) — Stores per-seat per-day usage data with upsert support
- `requireAuth()` / `isAuthFailure()` — [src/lib/api-auth.ts](src/lib/api-auth.ts) — Authentication guard for API routes
- Test helpers — [src/test/db-helpers.ts](src/test/db-helpers.ts) — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`

### To Be Modified
- `JobType` enum — [src/entities/enums.ts](src/entities/enums.ts) — Add `MONTH_RECOLLECTION = "month_recollection"` value
- Settings page — [src/app/(app)/settings/page.tsx](src/app/(app)/settings/page.tsx) — Add `MonthRecollectionPanel` below existing `JobStatusPanel`
- `JobStatusPanel` — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — Export the `JobExecutionData` interface and `StatusBadge` / `formatRelativeTime` helpers so they can be reused by the new panel (or extract to shared file)

### To Be Created
- `executeMonthRecollection(month, year)` — [src/lib/month-recollection.ts](src/lib/month-recollection.ts) — Core logic for full-month recollection
- `POST /api/jobs/month-recollection` — [src/app/api/jobs/month-recollection/route.ts](src/app/api/jobs/month-recollection/route.ts) — API route handler
- `MonthRecollectionPanel` — [src/components/settings/MonthRecollectionPanel.tsx](src/components/settings/MonthRecollectionPanel.tsx) — UI component with month/year picker and trigger button
- Database migration — [migrations/\<timestamp\>-AddMonthRecollectionJobType.ts](migrations/) — ALTER TYPE to add `month_recollection` to PostgreSQL enum
- Unit tests for `executeMonthRecollection` — [src/lib/__tests__/month-recollection.test.ts](src/lib/__tests__/month-recollection.test.ts)
- Unit tests for API route — [src/app/api/jobs/month-recollection/__tests__/route.test.ts](src/app/api/jobs/month-recollection/__tests__/route.test.ts)
- E2E test — [e2e/month-recollection.spec.ts](e2e/month-recollection.spec.ts)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Where should the UI be placed? | Settings page, new section below Job Status | ✅ Resolved |
| 2 | Should inactive seats be included? | Yes, all seats (active + inactive) | ✅ Resolved |
| 3 | Should concurrent recollection be prevented? | Yes, only one at a time | ✅ Resolved |

## Implementation Plan

### Phase 1: Database & Enum Changes

#### Task 1.1 - [MODIFY] Add `MONTH_RECOLLECTION` to `JobType` enum
**Description**: Add the new `month_recollection` value to the TypeScript `JobType` enum in the enums file.

**Definition of Done**:
- [x] `JobType.MONTH_RECOLLECTION = "month_recollection"` added to `src/entities/enums.ts`
- [x] No TypeScript compilation errors

#### Task 1.2 - [CREATE] Database migration for new enum value
**Description**: Create a TypeORM migration that adds `'month_recollection'` to the PostgreSQL `job_execution_jobtype_enum` type. The migration should use `ALTER TYPE ... ADD VALUE` syntax.

**Definition of Done**:
- [x] New migration file created in `migrations/` directory
- [x] Migration `up()` adds `'month_recollection'` to `job_execution_jobtype_enum`
- [x] Migration `down()` handles rollback (note: PostgreSQL does not support `DROP VALUE` from enums — document this or use a rename/recreate strategy)
- [x] Migration runs successfully with `npm run typeorm:migrate`

---

### Phase 2: Backend Core Logic

#### Task 2.1 - [CREATE] `executeMonthRecollection()` function
**Description**: Create `src/lib/month-recollection.ts` with the core recollection logic. This function:
1. Validates configuration exists
2. Checks for a RUNNING `month_recollection` job (concurrency guard)
3. Creates a new `job_execution` record with status RUNNING
4. Fetches ALL seats (active + inactive) from the database
5. Generates the full date range for the specified month (day 1 through last day)
6. For each seat, iterates each day and calls `fetchPremiumRequestUsage()`
7. Upserts results into `copilot_usage` table (same pattern as `executeUsageCollection`)
8. Updates the job execution to SUCCESS or FAILURE
9. On success, calls `refreshDashboardMetrics(month, year)`
10. Returns a result object with job status, records processed, users processed/errored

The function should follow the same patterns established in `src/lib/usage-collection.ts` and `src/lib/seat-sync.ts`:
- Same error handling (truncated error messages)
- Same job execution lifecycle (RUNNING → SUCCESS/FAILURE)
- Same upsert pattern for copilot_usage

**Definition of Done**:
- [x] `src/lib/month-recollection.ts` created
- [x] `MonthRecollectionResult` interface exported
- [x] Function validates configuration existence and returns `{ skipped: true, reason: "no_configuration" }` when missing
- [x] Function checks for RUNNING job and returns `{ skipped: true, reason: "already_running" }` when concurrent
- [x] Function creates a RUNNING job execution record of type `MONTH_RECOLLECTION`
- [x] Function fetches ALL seats (no status filter)
- [x] Function generates correct date range for the full month (handles varying month lengths, leap years)
- [x] Function calls `fetchPremiumRequestUsage` for each seat × day combination
- [x] Function upserts usage data using the same `orUpdate` pattern as existing collection
- [x] Function tracks per-user errors without aborting the entire job
- [x] Job execution updated to SUCCESS (or FAILURE if all users errored)
- [x] `refreshDashboardMetrics(month, year)` called on success
- [x] Error messages truncated to 2000 chars (same limit as existing jobs)
- [x] No TypeScript compilation errors

#### Task 2.2 - [CREATE] Unit tests for `executeMonthRecollection()`
**Description**: Create comprehensive unit tests in `src/lib/__tests__/month-recollection.test.ts` following the same patterns as `usage-collection.test.ts` (mocking `getDb`, `fetchPremiumRequestUsage`, `refreshDashboardMetrics`; using the test database).

**Definition of Done**:
- [x] Test file created at `src/lib/__tests__/month-recollection.test.ts`
- [x] Test: skips when no configuration exists
- [x] Test: skips when a RUNNING month_recollection job already exists
- [x] Test: processes all seats (active + inactive) for every day of the target month
- [x] Test: correctly generates date range for months with 28, 29, 30, and 31 days
- [x] Test: upserts usage data (inserts new records, updates existing records)
- [x] Test: creates job execution record with correct type and transitions to SUCCESS
- [x] Test: handles per-user API errors gracefully (continues with other seats)
- [x] Test: transitions to FAILURE when all users error
- [x] Test: calls `refreshDashboardMetrics` on success
- [x] Test: does not call `refreshDashboardMetrics` on failure
- [x] All tests pass with `npm run test`

---

### Phase 3: API Route

#### Task 3.1 - [CREATE] `POST /api/jobs/month-recollection` route
**Description**: Create `src/app/api/jobs/month-recollection/route.ts` as a Next.js API route handler. It requires authentication, validates `month` and `year` query parameters, calls `executeMonthRecollection()`, and returns the result.

The route should follow the same patterns as `src/app/api/jobs/usage-collection/route.ts`:
- Use `requireAuth()` / `isAuthFailure()` for authentication
- Return 409 when configuration is missing
- Return 409 when a recollection is already running
- Return 400 for invalid month/year parameters
- Return the job result on success

**Definition of Done**:
- [x] `src/app/api/jobs/month-recollection/route.ts` created
- [x] Route requires authentication (returns 401 if not authenticated)
- [x] Route validates `month` (1-12) and `year` (≥ 2020) query parameters, returns 400 on invalid
- [x] Route returns 409 with descriptive message when configuration is missing
- [x] Route returns 409 with descriptive message when a recollection is already running
- [x] Route returns JSON with `jobExecutionId`, `status`, `recordsProcessed`, `usersProcessed`, `usersErrored`, `errorMessage`
- [x] Route handles unexpected errors with 500 response
- [x] No TypeScript compilation errors

#### Task 3.2 - [CREATE] Unit tests for API route
**Description**: Create unit tests in `src/app/api/jobs/month-recollection/__tests__/route.test.ts` following the same patterns as the existing route tests (mocking auth, testing parameter validation, testing response codes).

**Definition of Done**:
- [x] Test file created at `src/app/api/jobs/month-recollection/__tests__/route.test.ts`
- [x] Test: returns 401 when not authenticated
- [x] Test: returns 400 when month is missing or invalid
- [x] Test: returns 400 when year is missing or invalid
- [x] Test: returns 409 when configuration is missing
- [x] Test: returns 409 when already running
- [x] Test: returns 200 with job result on success
- [x] Test: returns 500 on unexpected error
- [x] All tests pass with `npm run test`

---

### Phase 4: Frontend UI

#### Task 4.1 - [CREATE] `MonthRecollectionPanel` component
**Description**: Create `src/components/settings/MonthRecollectionPanel.tsx` — a client component that provides:
1. A month selector dropdown (January–December)
2. A year selector dropdown (2020 through current year)
3. A "Recalculate Month" button that POSTs to `/api/jobs/month-recollection?month=X&year=Y`
4. Loading state with spinner while the job runs
5. Success/error message display after completion
6. The button is disabled while a recollection is in progress

The component should default to the current month/year. It should follow the same UI patterns (Tailwind classes, button styles, status messages) as the existing `SyncNowButton` and `CollectNowButton` in `JobStatusPanel.tsx`.

**Definition of Done**:
- [x] `src/components/settings/MonthRecollectionPanel.tsx` created
- [x] Component is a `"use client"` component
- [x] Month dropdown renders all 12 months (January–December), defaults to current month
- [x] Year dropdown renders years from 2020 to current year, defaults to current year
- [x] "Recalculate Month" button triggers POST to `/api/jobs/month-recollection?month=X&year=Y`
- [x] Button shows spinner and "Recalculating…" text while request is in flight
- [x] Button is disabled during the request
- [x] Success message shows records processed and users count
- [x] Error messages display appropriately (409 for already running, 409 for no config, network errors)
- [x] 401 response shows "Session expired" message
- [x] Component uses the same Tailwind styling patterns as existing settings components
- [x] Accessible: button has proper `aria-label`, status messages use `role="status"` or `role="alert"`
- [x] No TypeScript compilation errors

#### Task 4.2 - [MODIFY] Settings page integration
**Description**: Update `src/app/(app)/settings/page.tsx` to render the new `MonthRecollectionPanel` component below the existing `JobStatusPanel`.

**Definition of Done**:
- [x] `MonthRecollectionPanel` imported in `src/app/(app)/settings/page.tsx`
- [x] Component rendered below the `JobStatusPanel` section
- [x] Page renders without errors
- [x] No TypeScript compilation errors

---

### Phase 5: E2E Testing

#### Task 5.1 - [CREATE] E2E test for month recollection
**Description**: Create `e2e/month-recollection.spec.ts` with Playwright tests verifying the feature end-to-end. Follow the same patterns as `e2e/job-status.spec.ts` (database seeding via pg client, login via helper, DOM assertions).

**Definition of Done**:
- [x] E2E test file created at `e2e/month-recollection.spec.ts`
- [x] Test: month and year selectors are visible on Settings page
- [x] Test: "Recalculate Month" button is visible
- [x] Test: Clicking the button with valid month/year triggers the recollection (mock or use actual API based on test environment)
- [x] Test: Shows success message after completion
- [x] Test: Shows error message when configuration is missing
- [x] Tests pass with `npm run test:e2e`

---

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code review by `tsh-code-reviewer`
**Description**: Run a full code review of all created and modified files using the `tsh-code-reviewer` agent. Verify code quality, consistency with existing patterns, security considerations, and test coverage.

**Definition of Done**:
- [x] All new and modified files reviewed
- [x] No critical or high-severity issues found
- [x] Code follows existing project patterns and conventions
- [x] All feedback addressed

## Security Considerations

- **Authentication required**: The `POST /api/jobs/month-recollection` endpoint requires authentication via `requireAuth()`, same as all other job endpoints.
- **Input validation**: Month (1-12) and year (≥ 2020) parameters are validated server-side before processing. Invalid values return 400.
- **Rate limiting through concurrency guard**: Only one recollection job can run at a time, preventing abuse or accidental duplicate runs that would hammer the GitHub API.
- **GitHub API token protection**: The `GITHUB_TOKEN` is read from environment variables and never exposed to the client. API calls are made server-side only.
- **Error message sanitization**: Error messages are truncated to 2000 characters before storage, preventing potential log injection or storage overflow.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User can navigate to the Settings page and see the month recollection section
- [x] User can select a month and year from dropdown selectors
- [x] User can click "Recalculate Month" to trigger a full data recollection for the selected month
- [x] The system fetches usage data for ALL seats (active and inactive) for every day of the selected month
- [x] Usage data is correctly upserted (new data inserted, existing data updated)
- [x] Dashboard metrics are refreshed for the target month after successful recollection
- [x] A job execution record is created and tracks the recollection status
- [x] The UI shows loading state while the recollection is in progress
- [x] The UI shows success/error messages after completion
- [x] Concurrent recollection attempts are blocked with a descriptive error message
- [x] The feature requires authentication (unauthenticated requests return 401)
- [x] Invalid month/year parameters return 400 with descriptive error
- [x] All unit tests pass (`npm run test`)
- [x] All E2E tests pass (`npm run test:e2e`)

## Improvements (Out of Scope)

- **Progress tracking**: Real-time progress indicator showing how many seats/days have been processed (would require WebSocket or polling endpoint).
- **Job history UI**: Display a list of past recollection jobs with their results (currently only the latest job per type is shown).
- **Selective seat recollection**: Allow recollecting data for specific seats rather than all seats.
- **Queue-based processing**: Move the recollection to a background job queue (e.g., BullMQ) for better resilience and scalability instead of running synchronously in the API request.
- **GitHub API rate limit handling**: Add retry logic with exponential backoff when hitting GitHub API rate limits during recollection.
- **Store target month/year on job record**: Add `targetMonth` and `targetYear` columns to `job_execution` to explicitly track which month was being recollected.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed: all 6 phases done. Code review findings addressed (H1: TOCTOU race fixed with transactional lock, H2: stale job threshold added, M1: future month validation added, M4: zero-seats metrics refresh added, L3: role="alert" for errors). 27 unit tests + 5 E2E tests pass. |
