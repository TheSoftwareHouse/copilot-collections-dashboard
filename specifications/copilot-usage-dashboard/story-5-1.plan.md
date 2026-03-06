# Story 5.1: User can view general monthly usage metrics — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 5.1 |
| Title | User can view general monthly usage metrics |
| Description | Deliver the primary dashboard view showing key Copilot usage metrics for the current month: total seats, per-model usage, most/least active users, and total spending. Dashboard is the default landing page. An empty state is shown when no usage data is available. Metrics are pre-computed into a summary table during data synchronisation, so the dashboard reads are instant. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 5, Story 5.1) |

## Proposed Solution

Introduce a **`dashboard_monthly_summary`** table (TypeORM entity) that stores pre-aggregated dashboard metrics keyed by `(month, year)`. A `refreshDashboardMetrics(month, year)` function recalculates and upserts the summary row whenever data changes — called at the end of both the usage-collection and seat-sync jobs. The dashboard API route (`GET /api/dashboard`) becomes a simple read from this summary table, eliminating complex JSONB aggregation at request time.

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Sync Jobs (write path)                             │
│  ┌───────────────────────────────────────────────┐  │
│  │  executeSeatSync()                            │  │
│  │    └── on success → refreshDashboardMetrics() │  │
│  ├───────────────────────────────────────────────┤  │
│  │  executeUsageCollection()                     │  │
│  │    └── on success → refreshDashboardMetrics() │  │
│  └───────────────────────────────────────────────┘  │
│              │                                      │
│              ▼                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  refreshDashboardMetrics(month, year)         │  │
│  │    1. COUNT seats (total + active)            │  │
│  │    2. JSONB agg: per-model usage              │  │
│  │    3. JSONB agg: top 5 users by spending      │  │
│  │    4. JSONB agg: bottom 5 users by spending   │  │
│  │    5. SUM total spending                      │  │
│  │    6. UPSERT into dashboard_monthly_summary   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Browser (read path)                                │
│  ┌───────────────────────────────────────────────┐  │
│  │  DashboardPage (Server Component)             │  │
│  │    └── DashboardPanel (Client Component)      │  │
│  │          ├── Total Seats Card                 │  │
│  │          ├── Total Spending Card              │  │
│  │          ├── Model Usage Breakdown Table      │  │
│  │          ├── Most Active Users List           │  │
│  │          └── Least Active Users List          │  │
│  └───────────────────────────────────────────────┘  │
│           │ fetch GET /api/dashboard?month=2&year=2026│
└───────────┼─────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────┐
│  Next.js API Route: GET /api/dashboard              │
│  ├── Auth check (requireAuth)                       │
│  ├── Parse & validate month/year query params       │
│  └── SELECT * FROM dashboard_monthly_summary        │
│       WHERE month = $1 AND year = $2                │
└─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│  PostgreSQL                                         │
│  ├── dashboard_monthly_summary (pre-computed)       │
│  │     totalSeats, activeSeats, totalSpending,      │
│  │     modelUsage (JSONB), mostActiveUsers (JSONB), │
│  │     leastActiveUsers (JSONB)                     │
│  ├── copilot_seat (source for seat counts)          │
│  └── copilot_usage (source for JSONB aggregations)  │
└─────────────────────────────────────────────────────┘
```

### Key Technical Decisions

1. **Pre-computed summary table**: Instead of running expensive JSONB aggregation queries on every dashboard request, metrics are computed once during data sync and stored in `dashboard_monthly_summary`. The dashboard API performs a single `findOne()` — no raw SQL at read time.

2. **Recalculation triggers**: `refreshDashboardMetrics()` is called after successful completion of:
   - **`executeUsageCollection()`** — usage data changed, recalculate the current month.
   - **`executeSeatSync()`** — seat counts / statuses changed, recalculate the current month.

3. **Summary table schema** (`dashboard_monthly_summary`):
   - `id` — auto-increment primary key
   - `month` / `year` — `smallint`, with `UNIQUE(month, year)` constraint
   - `totalSeats` — `int`, snapshot of total seat count at recalculation time
   - `activeSeats` — `int`, snapshot of active seat count
   - `totalSpending` — `decimal(19,4)`, `SUM(grossAmount)` for the month
   - `modelUsage` — `jsonb`, array of `{ model, totalRequests, totalAmount }`
   - `mostActiveUsers` — `jsonb`, array of top 5 `{ githubUsername, firstName, lastName, totalAmount }`
   - `leastActiveUsers` — `jsonb`, array of bottom 5 `{ githubUsername, firstName, lastName, totalAmount }`
   - `createdAt` / `updatedAt` — standard timestamp columns

4. **JSONB aggregation in recalculation**: The heavy `jsonb_array_elements()` queries run inside `refreshDashboardMetrics()` using `dataSource.query()` with parameterized SQL. This cost is paid at sync time (background job) rather than at dashboard load time.

5. **Metric definitions**:
   - **Total seats**: count of all `copilot_seat` records (active + inactive shown separately).
   - **Per-model usage**: `SUM(grossQuantity)` and `SUM(grossAmount)` grouped by `model` from JSONB usage items for the month/year.
   - **Most active users**: Top 5 users by `SUM(grossAmount)` for the month/year.
   - **Least active users**: Bottom 5 users (with any usage) by `SUM(grossAmount)` for the month/year, ordered ascending.
   - **Total spending**: `SUM(grossAmount)` across all usage items for the month/year.

6. **Month selection**: Story 5.1 defaults to the current month. The API supports `month` and `year` query parameters for forward compatibility with Story 5.2 (month filter).

7. **Empty state**: When no summary row exists for the selected month/year, the API returns zero-value aggregates and the frontend renders an informative empty state message.

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-usage.entity.ts` — `CopilotUsageEntity` with `usageItems` JSONB, `seatId` FK, `day`/`month`/`year` columns, index on `(year, month)`
- `src/entities/copilot-seat.entity.ts` — `CopilotSeatEntity` with `githubUsername`, `firstName`, `lastName`, `status`, `department`
- `src/entities/enums.ts` — `SeatStatus.ACTIVE` / `SeatStatus.INACTIVE`
- `src/lib/db.ts` — `getDb()` singleton data source accessor
- `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` for API route authentication
- `src/lib/usage-collection.ts` — `executeUsageCollection()` orchestrates usage data sync (will be modified to trigger recalculation)
- `src/lib/seat-sync.ts` — `executeSeatSync()` orchestrates seat sync (will be modified to trigger recalculation)
- `src/app/(app)/layout.tsx` — App layout with config + session guards, redirects to `/setup` or `/login`
- `src/app/page.tsx` — Root page redirects to `/dashboard` (dashboard is already the default landing page)
- `src/app/(app)/dashboard/page.tsx` — Placeholder dashboard showing current configuration info
- `src/components/NavBar.tsx` — Navigation with active "Dashboard" link
- `src/test/db-helpers.ts` — `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()` test utilities
- `src/app/api/seats/route.ts` — Seat list API (reference pattern for building new API routes)
- `src/app/api/seats/__tests__/route.test.ts` — API route tests (reference pattern for test structure)

### To Be Modified
- `src/lib/usage-collection.ts` — Call `refreshDashboardMetrics()` after successful usage collection
- `src/lib/seat-sync.ts` — Call `refreshDashboardMetrics()` after successful seat sync
- `src/lib/data-source.ts` — Register `DashboardMonthlySummaryEntity` in the application data source
- `src/lib/data-source.cli.ts` — Register `DashboardMonthlySummaryEntity` in the CLI data source
- `src/test/db-helpers.ts` — Register `DashboardMonthlySummaryEntity` in test data source, add to `cleanDatabase()`
- `src/app/(app)/dashboard/page.tsx` — Replace placeholder content with the new `DashboardPanel` component

### To Be Created
- `src/entities/dashboard-monthly-summary.entity.ts` — TypeORM EntitySchema for the `dashboard_monthly_summary` table
- `migrations/<timestamp>-CreateDashboardMonthlySummary.ts` — Migration to create the summary table
- `src/lib/dashboard-metrics.ts` — `refreshDashboardMetrics(month, year)` function with aggregation queries and upsert logic
- `src/lib/__tests__/dashboard-metrics.test.ts` — Integration tests for the metrics recalculation function
- `src/app/api/dashboard/route.ts` — `GET /api/dashboard` API route reading from summary table
- `src/app/api/dashboard/__tests__/route.test.ts` — Integration tests for the dashboard API route
- `src/components/dashboard/DashboardPanel.tsx` — Client component fetching and displaying all dashboard metrics
- `e2e/dashboard.spec.ts` — E2E tests for the dashboard page

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What metric defines "most/least active"? | `SUM(grossAmount)` across all models for the month — represents total spending which aligns with the "current spending" metric. | ✅ Resolved |
| 2 | How many users in most/least active lists? | Top 5 and bottom 5, consistent with typical dashboard patterns. | ✅ Resolved |
| 3 | Should total seats include inactive seats? | Yes — show total count with active/inactive breakdown for full visibility. | ✅ Resolved |
| 4 | Should the month filter UI be included in this story? | No — Story 5.2 covers the month filter. Story 5.1 defaults to the current month. The API supports month/year params for forward compatibility. | ✅ Resolved |
| 5 | How should dashboard metrics be computed? | Pre-computed into a `dashboard_monthly_summary` TypeORM entity table, recalculated after each usage-collection and seat-sync job completes. | ✅ Resolved |
| 6 | Which months are recalculated on sync? | The current month (UTC) is recalculated after both sync jobs. Historical month recalculation can be added later if needed. | ✅ Resolved |

## Implementation Plan

### Phase 1: Summary Table Entity and Migration

#### Task 1.1 - [CREATE] Dashboard monthly summary entity `src/entities/dashboard-monthly-summary.entity.ts`
**Description**: Create a TypeORM EntitySchema defining the `dashboard_monthly_summary` table that stores pre-aggregated dashboard metrics keyed by `(month, year)`.

**Definition of Done**:
- [ ] File `src/entities/dashboard-monthly-summary.entity.ts` is created
- [ ] `DashboardMonthlySummary` interface is exported with fields: `id`, `month`, `year`, `totalSeats`, `activeSeats`, `totalSpending`, `modelUsage`, `mostActiveUsers`, `leastActiveUsers`, `createdAt`, `updatedAt`
- [ ] `DashboardMonthlySummaryEntity` EntitySchema is exported with correct column types: `month`/`year` as `smallint`, `totalSeats`/`activeSeats` as `int`, `totalSpending` as `decimal(19,4)`, `modelUsage`/`mostActiveUsers`/`leastActiveUsers` as `jsonb`, standard `createdAt`/`updatedAt` as `timestamptz`
- [ ] Unique constraint `UQ_dashboard_monthly_summary_month_year` on `(month, year)` is defined
- [ ] Helper interfaces `ModelUsageEntry` and `UserSpendingEntry` are exported for the JSONB column shapes

#### Task 1.2 - [CREATE] Database migration for `dashboard_monthly_summary`
**Description**: Generate a TypeORM migration that creates the `dashboard_monthly_summary` table with all columns, unique constraint, and appropriate defaults.

**Definition of Done**:
- [ ] Migration file is created in the `migrations/` directory using `npm run typeorm:generate`
- [ ] Migration creates `dashboard_monthly_summary` table with all columns matching the entity
- [ ] Unique constraint `UQ_dashboard_monthly_summary_month_year` on `(month, year)` is included
- [ ] Migration runs successfully with `npm run typeorm:migrate`
- [ ] Migration can be reverted with `npm run typeorm:revert`

#### Task 1.3 - [MODIFY] Register entity in data sources and test helpers
**Description**: Add `DashboardMonthlySummaryEntity` to all data source configurations and update `cleanDatabase()` to clear the new table.

**Definition of Done**:
- [ ] `src/lib/data-source.ts` — `DashboardMonthlySummaryEntity` added to the `entities` array
- [ ] `src/lib/data-source.cli.ts` — `DashboardMonthlySummaryEntity` added to the `entities` array
- [ ] `src/test/db-helpers.ts` — `DashboardMonthlySummaryEntity` added to the test `entities` array
- [ ] `src/test/db-helpers.ts` — `cleanDatabase()` updated to clear the `dashboard_monthly_summary` table (add to the `TRUNCATE` statement or clear via repository)
- [ ] All existing tests continue to pass

### Phase 2: Metrics Recalculation Function

#### Task 2.1 - [CREATE] Dashboard metrics recalculation `src/lib/dashboard-metrics.ts`
**Description**: Create a function `refreshDashboardMetrics(month, year)` that runs aggregation queries against `copilot_seat` and `copilot_usage` tables and upserts the result into `dashboard_monthly_summary`. The function uses parameterized raw SQL for JSONB aggregation and TypeORM repository for seat counts and the final upsert.

**Definition of Done**:
- [ ] File `src/lib/dashboard-metrics.ts` is created and exports `refreshDashboardMetrics(month: number, year: number): Promise<void>`
- [ ] Seat counts: uses `seatRepository.count()` for total and `seatRepository.count({ where: { status: SeatStatus.ACTIVE } })` for active
- [ ] Per-model usage: parameterized raw SQL query using `jsonb_array_elements(cu."usageItems")` to `SUM` `grossQuantity` and `grossAmount` grouped by `model`, filtered by `month`/`year`, ordered by amount descending
- [ ] Most active users: parameterized raw SQL joining `copilot_usage` × `copilot_seat`, cross-joining `jsonb_array_elements()`, grouping by seat, ordering by `SUM(grossAmount) DESC`, `LIMIT 5`
- [ ] Least active users: same query as above but ordered `ASC`, `LIMIT 5`
- [ ] Total spending: parameterized raw SQL `SUM(grossAmount)` across all usage items for the month/year
- [ ] Upsert: uses TypeORM's `createQueryBuilder().insert().orUpdate()` on `(month, year)` conflict to insert or update all metric columns
- [ ] All raw SQL uses `$1`, `$2` parameterized placeholders — no string interpolation
- [ ] When no usage data exists, stores empty arrays for `modelUsage`/`mostActiveUsers`/`leastActiveUsers` and `0` for `totalSpending`
- [ ] Function logs a summary message on completion (e.g., "Dashboard metrics refreshed for 2/2026")
- [ ] Errors propagate to the caller (no silent swallowing) — sync jobs handle logging

#### Task 2.2 - [CREATE] Dashboard metrics integration tests `src/lib/__tests__/dashboard-metrics.test.ts`
**Description**: Create integration tests for the `refreshDashboardMetrics` function. Tests seed data into `copilot_seat` and `copilot_usage`, run the function, and verify the resulting `dashboard_monthly_summary` row contains correct aggregated values.

**Definition of Done**:
- [ ] File `src/lib/__tests__/dashboard-metrics.test.ts` is created
- [ ] Test setup uses `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()`
- [ ] Mocks `@/lib/db` to return the test data source
- [ ] Test: Correctly counts total seats and active seats (seeds mix of active/inactive)
- [ ] Test: Correctly aggregates per-model usage from JSONB usageItems (seeds usage with multiple models, verifies model names, totalRequests, totalAmount)
- [ ] Test: Correctly identifies top 5 most active users by spending (seeds >5 users with varying amounts)
- [ ] Test: Correctly identifies bottom 5 least active users (verifies ascending order)
- [ ] Test: Correctly calculates total spending across all usage items
- [ ] Test: Upsert works — calling `refreshDashboardMetrics()` twice for the same month/year updates the existing row rather than creating a duplicate
- [ ] Test: Stores empty arrays and zero spending when no usage data exists for the month/year
- [ ] Test: Different months produce separate summary rows (seeds data for month 1 and month 2, verifies independence)
- [ ] All tests pass with `npm run test`

#### Task 2.3 - [MODIFY] Trigger recalculation from usage collection `src/lib/usage-collection.ts`
**Description**: After successful usage collection completes, call `refreshDashboardMetrics()` for the current month/year to update the summary table.

**Definition of Done**:
- [ ] `src/lib/usage-collection.ts` imports `refreshDashboardMetrics` from `@/lib/dashboard-metrics`
- [ ] After the main collection loop completes successfully (before the final `return`), `refreshDashboardMetrics(today.month, today.year)` is called
- [ ] The recalculation call is wrapped in a `try/catch` — a failure to refresh metrics does not fail the overall usage collection job (logs a warning instead)
- [ ] Existing usage collection tests continue to pass (mock or stub `refreshDashboardMetrics` in existing test file)

#### Task 2.4 - [MODIFY] Trigger recalculation from seat sync `src/lib/seat-sync.ts`
**Description**: After successful seat sync completes, call `refreshDashboardMetrics()` for the current month/year to update seat counts in the summary table.

**Definition of Done**:
- [ ] `src/lib/seat-sync.ts` imports `refreshDashboardMetrics` from `@/lib/dashboard-metrics`
- [ ] After the successful transaction commit and job execution update, `refreshDashboardMetrics(currentMonth, currentYear)` is called where `currentMonth` and `currentYear` are derived from `new Date()` (UTC)
- [ ] The recalculation call is wrapped in a `try/catch` — a failure does not fail the overall seat sync job (logs a warning instead)
- [ ] Existing seat sync tests continue to pass (mock or stub `refreshDashboardMetrics` in existing test file)

### Phase 3: Dashboard API Route

#### Task 3.1 - [CREATE] Dashboard API route `src/app/api/dashboard/route.ts`
**Description**: Create a `GET /api/dashboard` endpoint that reads pre-computed metrics from the `dashboard_monthly_summary` table. The route accepts optional `month` and `year` query parameters (defaulting to the current month/year), authenticates the request, and returns the stored summary or an empty-state response.

**Definition of Done**:
- [ ] File `src/app/api/dashboard/route.ts` is created with a `GET` handler
- [ ] Request is authenticated via `requireAuth()` / `isAuthFailure()` pattern (matching `src/app/api/seats/route.ts`)
- [ ] `month` and `year` query parameters are parsed and validated (integers, month 1–12, year ≥ 2020); defaults to current month/year when omitted or invalid
- [ ] Reads from `dashboard_monthly_summary` using `summaryRepo.findOne({ where: { month, year } })`
- [ ] When a summary row exists, returns: `{ totalSeats, activeSeats, modelUsage, mostActiveUsers, leastActiveUsers, totalSpending, month, year }`
- [ ] When no summary row exists (empty state), returns: `{ totalSeats: 0, activeSeats: 0, modelUsage: [], mostActiveUsers: [], leastActiveUsers: [], totalSpending: 0, month, year }`
- [ ] Errors are caught and return `{ error: "Internal server error" }` with status 500

#### Task 3.2 - [CREATE] Dashboard API integration tests `src/app/api/dashboard/__tests__/route.test.ts`
**Description**: Create integration tests for the dashboard API route. Since the route is a simple read, tests seed data directly into `dashboard_monthly_summary` and verify the response.

**Definition of Done**:
- [ ] File `src/app/api/dashboard/__tests__/route.test.ts` is created
- [ ] Test setup uses `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()`
- [ ] Mocks `@/lib/db` and `next/headers` following pattern in `src/app/api/seats/__tests__/route.test.ts`
- [ ] Test: Returns 401 when not authenticated
- [ ] Test: Returns default (current) month/year when no query params provided
- [ ] Test: Returns stored summary data when a row exists for the requested month/year (seeds a `dashboard_monthly_summary` row directly)
- [ ] Test: Returns empty-state response (zeros and empty arrays) when no row exists for the requested month/year
- [ ] Test: Handles explicit `month` and `year` query parameters correctly (seeds rows for different months, verifies correct one is returned)
- [ ] Test: Returns valid response structure with all expected fields
- [ ] All tests pass with `npm run test`

### Phase 4: Frontend Dashboard Panel

#### Task 4.1 - [CREATE] Dashboard panel component `src/components/dashboard/DashboardPanel.tsx`
**Description**: Create a client-side component that fetches data from `GET /api/dashboard` for the current month and renders all dashboard metrics. The component handles loading, error, and empty states.

**Definition of Done**:
- [ ] File `src/components/dashboard/DashboardPanel.tsx` is created as a `"use client"` component
- [ ] Component accepts `month` and `year` as props (numbers)
- [ ] On mount, fetches `GET /api/dashboard?month={month}&year={year}`
- [ ] Displays loading state while data is being fetched
- [ ] Displays error state if the API request fails
- [ ] **Total Seats Card**: Shows total seats count with active/inactive breakdown (e.g., "42 total · 38 active")
- [ ] **Total Spending Card**: Shows total spending formatted as currency (e.g., "$1,234.56")
- [ ] **Model Usage Table**: Lists each model with its total requests (`grossQuantity`) and total cost (`grossAmount`), sorted by cost descending
- [ ] **Most Active Users**: Lists top 5 users with GitHub username, full name (if available), and total spending
- [ ] **Least Active Users**: Lists bottom 5 users with GitHub username, full name (if available), and total spending
- [ ] **Empty State**: When no usage data exists, shows an informative message (e.g., "No usage data available for [Month Year]. Data will appear after the usage collection job runs.")
- [ ] Component uses Tailwind CSS classes consistent with existing components (`SeatListPanel.tsx`, current dashboard page)
- [ ] All text content uses accessible semantic HTML (headings, lists, tables with proper markup)
- [ ] Currency values are formatted to 2 decimal places with `$` prefix

#### Task 4.2 - [MODIFY] Update dashboard page `src/app/(app)/dashboard/page.tsx`
**Description**: Replace the placeholder dashboard content with the new `DashboardPanel` component. The server component determines the current month/year and passes it as props.

**Definition of Done**:
- [ ] `src/app/(app)/dashboard/page.tsx` imports and renders `DashboardPanel` instead of the placeholder configuration display
- [ ] Current month and year are determined server-side and passed as props to `DashboardPanel`
- [ ] Page title and description are updated to reflect the dashboard purpose (e.g., "Monthly Usage Overview")
- [ ] Page layout follows the pattern established in `src/app/(app)/seats/page.tsx` (max-width container, heading, description, component)
- [ ] The `metadata` export and `dynamic = "force-dynamic"` are preserved

### Phase 5: E2E Tests

#### Task 5.1 - [CREATE] Dashboard E2E tests `e2e/dashboard.spec.ts`
**Description**: Create Playwright E2E tests verifying the dashboard page displays correctly with seeded data and shows an empty state when no data exists. Tests seed pre-computed summary data directly into `dashboard_monthly_summary`.

**Definition of Done**:
- [ ] File `e2e/dashboard.spec.ts` is created following the pattern in `e2e/seat-list.spec.ts`
- [ ] Test setup seeds configuration, auth user, and pre-computed `dashboard_monthly_summary` row via direct database queries
- [ ] Test cleanup clears all seeded data in `beforeEach`
- [ ] Test: Dashboard is the landing page — navigating to `/` redirects to `/dashboard`
- [ ] Test: Dashboard displays total seats count
- [ ] Test: Dashboard displays per-model usage (model names and amounts visible)
- [ ] Test: Dashboard displays most active users list
- [ ] Test: Dashboard displays least active users list
- [ ] Test: Dashboard displays total spending
- [ ] Test: Dashboard displays empty state when no summary data exists for the current month
- [ ] All E2E tests pass with `npm run test:e2e`

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, adherence to project conventions, and completeness against acceptance criteria.

**Definition of Done**:
- [ ] All new code reviewed by `tsh-code-reviewer` agent
- [ ] No critical or high-severity issues remain unresolved
- [ ] Entity follows existing TypeORM EntitySchema patterns
- [ ] Migration is correct and reversible
- [ ] Aggregation queries are parameterized (no injection risk)
- [ ] Sync job modifications are defensive (try/catch around recalculation)
- [ ] API route follows existing patterns (auth, error handling, response shape)
- [ ] Frontend component follows existing patterns (Tailwind, accessibility, loading/error states)
- [ ] Tests adequately cover all acceptance criteria
- [ ] All tests (unit + E2E) pass

## Security Considerations

- **Authentication**: The dashboard API route uses `requireAuth()` / `isAuthFailure()` to enforce authentication, consistent with all other API routes. Unauthenticated requests receive a 401 response.
- **SQL Injection Prevention**: All raw SQL queries in `refreshDashboardMetrics()` use parameterized queries (`$1`, `$2` placeholders). No user input is interpolated into SQL strings. The API route itself performs no raw SQL.
- **Input Validation**: `month` and `year` query parameters in the API route are validated as integers within expected ranges before use. Invalid values fall back to current month/year.
- **Data Exposure**: The API only returns aggregated metrics and public seat metadata (username, name). No sensitive data (passwords, tokens, session IDs) is exposed.
- **Summary table integrity**: The unique constraint on `(month, year)` prevents duplicate rows. The upsert pattern ensures idempotent recalculation.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Dashboard displays total number of seats
- [ ] Dashboard displays total usage per each model
- [ ] Dashboard displays most active users for the selected month
- [ ] Dashboard displays least active users for the selected month
- [ ] Dashboard displays current spending for the selected month
- [ ] Dashboard is the default landing page after login
- [ ] Dashboard displays an informative empty state when no data is available for the selected month

## Improvements (Out of Scope)

- **Month filter dropdown (Story 5.2)**: The API supports month/year parameters, but the frontend currently defaults to the current month. The interactive month selector is planned for Story 5.2.
- **Historical month recalculation**: Currently, only the current month is recalculated on sync. A management endpoint or CLI command to recalculate arbitrary months could be added for backfill scenarios.
- **Real-time updates**: The dashboard shows a point-in-time snapshot. WebSocket or polling-based auto-refresh could be added for near-real-time monitoring.
- **Export functionality**: Stakeholders may want to export dashboard metrics as CSV/PDF for reporting purposes.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Revised architecture: replaced on-the-fly JSONB aggregation with pre-computed `dashboard_monthly_summary` TypeORM entity table, recalculated during sync jobs |
