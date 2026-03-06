# Story 6.1 — Per-Seat Usage for a Specific Month — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 6.1 |
| Title | User can view per-seat usage for a specific month |
| Description | Provide a new Usage Analytics section with a tabbed layout (Seat/Team/Department). The Seat tab — default and only tab implemented in this story — shows per-seat usage for a selected month, including model breakdown, quantities, and costs. Results are paginated with a month filter. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Epic 6 / Story 6.1), [quality-review.md](./quality-review.md) (S-02) |

## Proposed Solution

Add a new `/usage` route (page + API) to the application. The page features a three-tab layout (Seat, Team, Department) with the **Seat** tab active by default. Team and Department tabs render placeholder content (implemented in Stories 6.2 and 6.3).

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    /usage (page)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │          MonthFilter (reused)                 │  │
│  ├───────────────────────────────────────────────┤  │
│  │  [Seat*]  [Team]  [Department]  ← tabs        │  │
│  ├───────────────────────────────────────────────┤  │
│  │  SeatUsagePanel                               │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │  Table: username | name | dept |         │ │  │
│  │  │  models | requests | gross | net         │ │  │
│  │  ├──────────────────────────────────────────┤ │  │
│  │  │  Pagination controls                     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. Page loads → fetches available months from `GET /api/dashboard/months` (reused)
2. `SeatUsagePanel` fetches `GET /api/usage/seats?month=M&year=Y&page=P&pageSize=N`
3. API queries `copilot_usage` table joined with `copilot_seat`, aggregates usage items per seat with per-model breakdown via CTEs, returns paginated JSON
4. Component renders a table with expandable/inline model details, pagination, and empty state

### API Contract

```
GET /api/usage/seats?month=2&year=2026&page=1&pageSize=20

Response 200:
{
  "seats": [
    {
      "seatId": 1,
      "githubUsername": "user1",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "totalRequests": 250.5,
      "totalGrossAmount": 10.02,
      "totalNetAmount": 0.0,
      "models": [
        { "model": "Claude Sonnet 4.5", "requests": 200.0, "grossAmount": 8.0, "netAmount": 0.0 },
        { "model": "Claude Haiku 4.5", "requests": 50.5, "grossAmount": 2.02, "netAmount": 0.0 }
      ]
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3,
  "month": 2,
  "year": 2026
}
```

## Current Implementation Analysis

### Already Implemented

- `CopilotUsageEntity` — [src/entities/copilot-usage.entity.ts](../../src/entities/copilot-usage.entity.ts) — stores per-seat per-day usage with `usageItems` JSONB containing model-level breakdown
- `CopilotSeatEntity` — [src/entities/copilot-seat.entity.ts](../../src/entities/copilot-seat.entity.ts) — seat holder data including `githubUsername`, `firstName`, `lastName`, `department`
- `MonthFilter` component — [src/components/dashboard/MonthFilter.tsx](../../src/components/dashboard/MonthFilter.tsx) — reusable month picker, already works with `AvailableMonth[]`
- `GET /api/dashboard/months` — [src/app/api/dashboard/months/route.ts](../../src/app/api/dashboard/months/route.ts) — returns available months from `dashboard_monthly_summary`
- `requireAuth` / `isAuthFailure` — [src/lib/api-auth.ts](../../src/lib/api-auth.ts) — authentication middleware for API routes
- `getDb()` — [src/lib/db.ts](../../src/lib/db.ts) — database connection helper
- `MONTH_NAMES` — [src/lib/constants.ts](../../src/lib/constants.ts) — month name array
- Pagination pattern — [src/app/api/seats/route.ts](../../src/app/api/seats/route.ts) — `page`, `pageSize`, `findAndCount`, `totalPages` pattern
- Test infrastructure — [src/test/db-helpers.ts](../../src/test/db-helpers.ts) — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`
- E2E auth helpers — [e2e/helpers/auth.ts](../../e2e/helpers/auth.ts) — `seedTestUser`, `loginViaApi`
- E2E seeding pattern — [e2e/dashboard.spec.ts](../../e2e/dashboard.spec.ts) — direct `pg.Client` queries for test data seeding

### To Be Modified

- `NavBar` — [src/components/NavBar.tsx](../../src/components/NavBar.tsx) — add "Usage" link to the navigation links array

### To Be Created

- `GET /api/usage/seats` — API route for paginated per-seat usage aggregation
- `src/app/(app)/usage/page.tsx` — Usage Analytics page
- `src/components/usage/UsagePageLayout.tsx` — three-tab layout component (Seat, Team, Department)
- `src/components/usage/SeatUsagePanel.tsx` — data-fetching container for per-seat usage table
- `src/components/usage/SeatUsageTable.tsx` — presentational table component
- `src/components/usage/Pagination.tsx` — pagination controls component
- `src/app/api/usage/seats/__tests__/route.test.ts` — integration tests for the API
- `e2e/seat-usage.spec.ts` — E2E tests for the usage analytics page

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the available-months API also consider months present in `copilot_usage` (not just `dashboard_monthly_summary`)? | For this story, reuse existing `/api/dashboard/months`. If months appear in usage but not in summary, they won't be selectable. This is acceptable since usage collection always triggers a summary refresh. | ✅ Resolved |
| 2 | Should the Team and Department tabs render a placeholder or be hidden? | Render placeholder tabs with "Coming soon" or an informative message. This establishes the tab layout structure for Stories 6.2/6.3 without blocking this story. | ✅ Resolved |
| 3 | What is the default page size for per-seat usage? | 20 rows per page, consistent with typical analytics views. Max page size capped at 100. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Per-Seat Usage API

#### Task 1.1 — [CREATE] `GET /api/usage/seats` API route

**Description**: Create a new API route that aggregates per-seat usage data from the `copilot_usage` table for a given month/year. Join with `copilot_seat` to include user details. Aggregate `usageItems` JSONB per seat with per-model breakdown using CTEs. Return paginated results.

Query strategy (two queries):

1. **Count query** — `SELECT COUNT(DISTINCT cu."seatId") FROM copilot_usage cu WHERE cu.month = $1 AND cu.year = $2`
2. **Data query** with CTEs:
   - `seat_models` — aggregate `grossQuantity`, `grossAmount`, `netAmount` per seat per model
   - `seat_totals` — sum per-seat totals and build models JSONB array via `jsonb_agg`
   - Final SELECT joins with `copilot_seat` for user details, ordered by `totalRequests` DESC, with LIMIT/OFFSET

File: `src/app/api/usage/seats/route.ts`

**Definition of Done**:
- [x] Route file created at `src/app/api/usage/seats/route.ts`
- [x] Accepts query params: `month` (1-12), `year` (≥2020), `page` (≥1, default 1), `pageSize` (1-100, default 20)
- [x] Returns 401 when not authenticated (uses `requireAuth`)
- [x] Invalid/missing `month`/`year` defaults to current month/year
- [x] Invalid/missing `page`/`pageSize` defaults to 1/20 respectively
- [x] Response shape: `{ seats: [...], total, page, pageSize, totalPages, month, year }`
- [x] Each seat entry includes: `seatId`, `githubUsername`, `firstName`, `lastName`, `department`, `totalRequests`, `totalGrossAmount`, `totalNetAmount`, `models[]`
- [x] Each model entry includes: `model`, `requests`, `grossAmount`, `netAmount`
- [x] Seats are ordered by `totalRequests` DESC
- [x] Empty result returns `{ seats: [], total: 0, page: 1, pageSize: 20, totalPages: 1, month, year }`
- [x] Returns 500 with `{ error: "Internal server error" }` on unexpected errors

#### Task 1.2 — [CREATE] Integration tests for `GET /api/usage/seats`

**Description**: Write integration tests following the established test pattern (see `src/app/api/seats/__tests__/route.test.ts` and `src/app/api/dashboard/__tests__/route.test.ts`). Use `getTestDataSource`, `cleanDatabase`, mock `@/lib/db` and `next/headers`. Seed `copilot_seat` and `copilot_usage` records for test scenarios.

File: `src/app/api/usage/seats/__tests__/route.test.ts`

**Definition of Done**:
- [x] Test file created at `src/app/api/usage/seats/__tests__/route.test.ts`
- [x] Test: returns 401 without session
- [x] Test: returns empty state when no usage data exists for the month
- [x] Test: returns aggregated per-seat usage data with model breakdown
- [x] Test: pagination works correctly (page, pageSize, totalPages, total)
- [x] Test: defaults to current month/year when params are missing
- [x] Test: defaults to page 1, pageSize 20 when params are invalid
- [x] Test: caps pageSize at 100
- [x] Test: seats ordered by totalRequests DESC
- [x] Test: multiple models per seat are returned in the models array
- [x] All tests pass with `npm run test`

### Phase 2: Frontend — Usage Analytics Page

#### Task 2.1 — [MODIFY] Add "Usage" link to NavBar

**Description**: Add a new navigation entry for the Usage Analytics section in the `NavBar` component.

File: `src/components/NavBar.tsx`

**Definition of Done**:
- [x] "Usage" link added to `navLinks` array after "Dashboard" entry (position: `/dashboard`, `/usage`, `/seats`, …)
- [x] Link points to `/usage`
- [x] Active state styling works when on `/usage` route

#### Task 2.2 — [CREATE] Usage Analytics page

**Description**: Create the `/usage` route page. Server component that renders the page title, description, and the `UsagePageLayout` client component with initial month/year.

File: `src/app/(app)/usage/page.tsx`

**Definition of Done**:
- [x] Page file created at `src/app/(app)/usage/page.tsx`
- [x] Page has metadata with title "Usage Analytics — Copilot Dashboard"
- [x] Uses `force-dynamic` export
- [x] Passes current month/year to `UsagePageLayout`
- [x] Page structure follows existing pattern from `src/app/(app)/dashboard/page.tsx`

#### Task 2.3 — [CREATE] `UsagePageLayout` tabbed layout component

**Description**: Create a client component that manages tab state (Seat/Team/Department), the month filter, and renders the appropriate tab content. Fetches available months from `/api/dashboard/months`. Reuses the existing `MonthFilter` component.

File: `src/components/usage/UsagePageLayout.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/UsagePageLayout.tsx`
- [x] Three tabs rendered: "Seat" (default active), "Team", "Department"
- [x] Active tab has distinct visual styling (border-bottom, font weight, color)
- [x] Tab buttons use `role="tab"`, `aria-selected`, tab panel uses `role="tabpanel"` for accessibility
- [x] `MonthFilter` component is rendered and functional (fetches months from `/api/dashboard/months`)
- [x] Selecting "Seat" tab renders `SeatUsagePanel`
- [x] Selecting "Team" or "Department" tab renders placeholder message: "Team/Department usage analytics will be available in a future update."
- [x] Changing the month via filter updates the data in the active panel

#### Task 2.4 — [CREATE] `SeatUsagePanel` data-fetching component

**Description**: Client component responsible for fetching per-seat usage data from `GET /api/usage/seats` and passing it to the presentational `SeatUsageTable`. Manages loading, error, and empty states. Manages pagination state.

File: `src/components/usage/SeatUsagePanel.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/SeatUsagePanel.tsx`
- [x] Fetches data from `/api/usage/seats?month=M&year=Y&page=P&pageSize=20`
- [x] Displays loading state with "Loading usage data…" message (matches dashboard pattern)
- [x] Displays error state with red alert box on fetch failure (matches dashboard pattern)
- [x] Displays empty state: "No per-seat usage data available for {Month Year}. Data will appear after the usage collection job runs." when `total === 0`
- [x] Passes seat data to `SeatUsageTable` for rendering
- [x] Re-fetches data when `month`, `year`, or `page` changes
- [x] Cancelled fetch requests on unmount/re-render (matches dashboard pattern)

#### Task 2.5 — [CREATE] `SeatUsageTable` presentational component

**Description**: Stateless table component that renders per-seat usage rows. Each row shows username, name, department, total requests, gross amount, net amount. Model breakdown is shown as a comma-separated sub-line or secondary row beneath each seat entry.

File: `src/components/usage/SeatUsageTable.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/SeatUsageTable.tsx`
- [x] Table has columns: GitHub Username, Name, Department, Models, Total Requests, Gross Amount, Net Amount
- [x] Name column combines `firstName` and `lastName`, shows "—" when both are null
- [x] Department column shows "—" when null
- [x] Models column shows comma-separated model names (e.g., "Claude Sonnet 4.5, Claude Haiku 4.5")
- [x] Monetary values formatted with `$` prefix and 2 decimal places
- [x] Request values formatted with `toLocaleString()` for thousands separators
- [x] Table follows existing styling conventions (border, bg-white, shadow-sm, text-sm)
- [x] Table has proper `<thead>` and `<tbody>` semantics

#### Task 2.6 — [CREATE] `Pagination` component

**Description**: Reusable pagination controls component showing "Page X of Y" with Previous/Next buttons. Disables Previous on page 1 and Next on last page.

File: `src/components/usage/Pagination.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/Pagination.tsx`
- [x] Shows "Page {current} of {total}" text
- [x] "Previous" button disabled on page 1
- [x] "Next" button disabled on last page
- [x] Calls `onPageChange(page)` callback when buttons are clicked
- [x] Follows existing button styling (rounded-md, border, text-sm)
- [x] Accessible: buttons have clear labels

### Phase 3: E2E Tests

#### Task 3.1 — [CREATE] E2E tests for Usage Analytics — Seat tab

**Description**: Write Playwright E2E tests for the usage analytics page, following the established pattern in `e2e/dashboard.spec.ts`. Seed seat and usage data via direct `pg.Client` queries.

File: `e2e/seat-usage.spec.ts`

**Definition of Done**:
- [x] Test file created at `e2e/seat-usage.spec.ts`
- [x] Test: Usage link is visible in navigation and navigates to `/usage`
- [x] Test: Seat tab is active by default
- [x] Test: Per-seat usage data is displayed in a table format
- [x] Test: Model names are visible in seat rows
- [x] Test: Empty state is shown when no usage data exists for the selected month
- [x] Test: Month filter is functional and changes displayed data
- [x] Test: Pagination controls are visible and functional when data exceeds page size
- [x] Test: Team and Department tabs show placeholder content
- [x] All E2E tests pass with `npm run test:e2e`

### Phase 4: Code Review

#### Task 4.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Full code review of all changes in Phases 1–3 by the `tsh-code-reviewer` agent. Verify code quality, security, test coverage, accessibility, and adherence to established project patterns.

**Definition of Done**:
- [x] All new files reviewed for adherence to project patterns and conventions
- [x] SQL queries reviewed for performance (proper use of indexes, no N+1 queries)
- [x] API input validation reviewed (query param sanitization)
- [x] Authentication enforcement verified on all new endpoints
- [x] Accessibility review passed (ARIA roles on tabs, proper table semantics)
- [x] Test coverage assessed — all acceptance criteria have corresponding tests
- [x] No code duplication introduced (reuse of MonthFilter, auth helpers, test patterns confirmed)

## Security Considerations

- **Authentication enforcement**: The new `GET /api/usage/seats` endpoint must use `requireAuth()` — identical to all existing API routes. Unauthenticated requests receive 401.
- **Input validation**: Query parameters (`month`, `year`, `page`, `pageSize`) are parsed as integers with strict range checks. Invalid values fall back to safe defaults — no SQL injection vectors since parameterised queries are used exclusively.
- **No sensitive data exposure**: The API returns only seat holder GitHub usernames, names, departments, and usage metrics. No passwords, tokens, or internal IDs beyond seat IDs are exposed.
- **Rate limiting**: Not in scope for this story. The existing application does not implement rate limiting; this should be addressed as a cross-cutting concern at the infrastructure level.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Seat tab is the default active tab in the Usage section
- [x] Per-seat usage is displayed for the selected month
- [x] Each row shows usage metrics (models, quantities, costs)
- [x] Results are paginated
- [x] Month filter allows switching between months
- [x] An informative empty state is shown when no per-seat usage data exists for the selected month
- [x] Usage link appears in the main navigation
- [x] Team and Department tabs are visible but render placeholder content
- [x] Integration tests pass (`npm run test`)
- [x] E2E tests pass (`npm run test:e2e`)
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No linting errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Sorting**: Allow sorting per-seat usage by different columns (username, requests, cost). Currently fixed to `totalRequests DESC`.
- **Search/filter**: Add text search within the seat usage table (by username, name, or department).
- **Export**: CSV/Excel export of per-seat usage data for a given month.
- **Model details expansion**: Expandable rows showing per-model per-day breakdown instead of just monthly model aggregates.
- **Available months from usage data**: The months API currently queries `dashboard_monthly_summary`. If usage data exists for a month but the summary hasn't been recalculated yet, that month won't appear in the filter. Consider also querying `copilot_usage` for distinct months.
- **Shared Pagination component**: The `Pagination` component created here could be extracted to a shared location and reused by the seats list (which currently uses its own inline pagination logic).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation complete — all 4 phases done. Code review: APPROVE with 6 low-severity observations (CTE materialization, year upper bound, month-fetch duplication, arrow-key tabs, type location, E2E connection batching). No blocking issues. |
