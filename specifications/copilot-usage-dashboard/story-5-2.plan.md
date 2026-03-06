# Story 5.2: User can filter dashboard by month — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 5.2 |
| Title | User can filter dashboard by month |
| Description | Add a month filter to the dashboard allowing users to switch between months and compare usage and spending across different time periods. The current month is selected by default. All months with available data are selectable. Selecting a month refreshes all dashboard metrics. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 5, Story 5.2) |

## Proposed Solution

Introduce a **`GET /api/dashboard/months`** endpoint that returns all `(month, year)` pairs for which a `dashboard_monthly_summary` row exists. On the frontend, add a **`MonthFilter`** component rendered on the dashboard page that presents these available months as a `<select>` dropdown, with the current month pre-selected. When the user selects a different month, the dashboard page re-renders `DashboardPanel` with the updated `month`/`year` props, which triggers a re-fetch of dashboard data from the existing `GET /api/dashboard?month=&year=` endpoint (already supports these parameters from Story 5.1).

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  DashboardPage (Server Component)                  │  │
│  │    └── DashboardWithFilter (Client Component)      │  │
│  │          ├── MonthFilter (selects month/year)      │  │
│  │          │     ↕ fetch GET /api/dashboard/months   │  │
│  │          └── DashboardPanel (existing, unchanged)  │  │
│  │                ↕ fetch GET /api/dashboard?m=&y=    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Next.js API Routes                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │  GET /api/dashboard/months  (NEW)                  │  │
│  │  ├── Auth check (requireAuth)                      │  │
│  │  └── SELECT DISTINCT month, year                   │  │
│  │       FROM dashboard_monthly_summary               │  │
│  │       ORDER BY year DESC, month DESC               │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  GET /api/dashboard  (EXISTING — no changes)       │  │
│  │  ├── Auth check                                    │  │
│  │  └── Read from dashboard_monthly_summary           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL                                              │
│  └── dashboard_monthly_summary (existing — no changes)   │
│       month, year, totalSeats, activeSeats, …            │
└──────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

1. **Available months from `dashboard_monthly_summary`**: The month filter only shows months that have pre-computed summary data. This naturally aligns with the acceptance criterion "all months with available data are selectable" — a month only appears in the dropdown once a sync job has run and produced data for it.

2. **New `GET /api/dashboard/months` endpoint**: Querying `SELECT DISTINCT month, year FROM dashboard_monthly_summary ORDER BY year DESC, month DESC` provides the list of available months. This is a lightweight query on a small table (one row per month). Separating it from the main dashboard data endpoint keeps responsibilities clear and avoids returning the full metrics payload just to discover which months are available.

3. **`DashboardWithFilter` wrapper component**: A new `"use client"` component that manages the selected `month`/`year` state. It fetches available months on mount, renders the `MonthFilter` dropdown, and passes the selected month/year as props to the existing `DashboardPanel`. This avoids modifying `DashboardPanel` itself, keeping changes minimal.

4. **Current month as default**: The wrapper initialises with the current UTC month/year. If the current month is not in the available months list (e.g., no data yet), it still defaults to the current month and `DashboardPanel` will show its existing empty state.

5. **`MonthFilter` as a presentational component**: Receives `availableMonths`, `selectedMonth`, `selectedYear`, and `onChange` callback as props. Renders a `<select>` element with `<option>` entries formatted as "Month YYYY" (e.g., "February 2026"). This keeps it simple, testable, and accessible.

6. **No database or entity changes**: The `dashboard_monthly_summary` table and `DashboardMonthlySummaryEntity` already contain all necessary data. The `GET /api/dashboard` route already supports `month` and `year` query parameters. The feature is purely additive.

7. **Sort order**: Available months are presented newest-first (descending by year then month), matching user expectations to see the most recent data at the top.

## Current Implementation Analysis

### Already Implemented
- `DashboardMonthlySummaryEntity` — `src/entities/dashboard-monthly-summary.entity.ts` — Pre-computed summary table with `(month, year)` unique constraint
- `GET /api/dashboard` — `src/app/api/dashboard/route.ts` — Already accepts `month` and `year` query params and returns data for the specified period
- `DashboardPanel` — `src/components/dashboard/DashboardPanel.tsx` — Client component accepting `month` and `year` props, fetches and displays all metrics
- Dashboard page — `src/app/(app)/dashboard/page.tsx` — Server component calculating current month/year server-side and passing to `DashboardPanel`
- Auth utilities — `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` for API route authentication
- Database access — `src/lib/db.ts` — `getDb()` for data source access
- API test patterns — `src/app/api/dashboard/__tests__/route.test.ts` — Test structure with `getTestDataSource()`, auth mocking, seeding helpers
- E2E test patterns — `e2e/dashboard.spec.ts` — Test structure with DB seeding via `pg`, auth via `loginViaApi`
- `MONTH_NAMES` array — defined in `DashboardPanel.tsx` — maps month index to name string

### To Be Modified
- `src/app/(app)/dashboard/page.tsx` — Replace direct `DashboardPanel` rendering with `DashboardWithFilter` wrapper that includes the month filter
- `src/components/dashboard/DashboardPanel.tsx` — Extract `MONTH_NAMES` to a shared constant (or inline in the new wrapper) so `MonthFilter` can use the same month name mapping

### To Be Created
- `src/app/api/dashboard/months/route.ts` — `GET /api/dashboard/months` endpoint returning available `(month, year)` pairs
- `src/app/api/dashboard/months/__tests__/route.test.ts` — Integration tests for the months endpoint
- `src/components/dashboard/MonthFilter.tsx` — Presentational select component for month/year selection
- `src/components/dashboard/DashboardWithFilter.tsx` — Client wrapper managing month state, combining `MonthFilter` + `DashboardPanel`
- `e2e/dashboard.spec.ts` — Additional E2E tests for month filter behaviour (extend existing file)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should months with no data still be selectable? | No — only months with a `dashboard_monthly_summary` row appear in the dropdown. If no data exists yet, the dropdown shows no options and the empty state is displayed for the current month. | ✅ Resolved |
| 2 | What UI control should be used for the month filter? | A native `<select>` dropdown — consistent with simplicity of the app (no third-party UI library used), accessible by default, works on all devices. | ✅ Resolved |
| 3 | Should the selected month persist in the URL? | No — the current codebase doesn't use URL-based state for dashboard filtering. The month filter state is maintained in the client component. Navigating away and back resets to the current month, which matches the default behaviour. | ✅ Resolved |
| 4 | What happens if the current month has no data? | The dropdown still defaults to the current month. `DashboardPanel` will display its existing empty state ("No usage data available for…"). The user can switch to a month that does have data. | ✅ Resolved |

## Implementation Plan

### Phase 1: Available Months API Endpoint

#### Task 1.1 - [CREATE] Available months API route `src/app/api/dashboard/months/route.ts`
**Description**: Create a `GET /api/dashboard/months` endpoint that queries `dashboard_monthly_summary` for all distinct `(month, year)` pairs and returns them sorted newest-first.

**Definition of Done**:
- [x] File `src/app/api/dashboard/months/route.ts` is created with a `GET` handler
- [x] Request is authenticated via `requireAuth()` / `isAuthFailure()` pattern matching `src/app/api/dashboard/route.ts`
- [x] Queries `DashboardMonthlySummaryEntity` using `summaryRepo.find({ select: ["month", "year"], order: { year: "DESC", month: "DESC" } })`
- [x] Returns JSON response: `{ months: [{ month: number, year: number }, ...] }`
- [x] Returns `{ months: [] }` when no summary rows exist
- [x] Errors are caught and return `{ error: "Internal server error" }` with status 500
- [x] `export const dynamic = "force-dynamic"` is set

#### Task 1.2 - [CREATE] Available months API integration tests `src/app/api/dashboard/months/__tests__/route.test.ts`
**Description**: Create integration tests for the available months endpoint. Tests seed rows into `dashboard_monthly_summary` and verify the response.

**Definition of Done**:
- [x] File `src/app/api/dashboard/months/__tests__/route.test.ts` is created
- [x] Test setup uses `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()`
- [x] Mocks `@/lib/db` and `next/headers` following the pattern in `src/app/api/dashboard/__tests__/route.test.ts`
- [x] Test: Returns 401 when not authenticated
- [x] Test: Returns empty array when no summary rows exist
- [x] Test: Returns all available `(month, year)` pairs when summary rows exist (seeds 3 rows for different months, verifies all returned)
- [x] Test: Results are sorted newest-first (year DESC, month DESC)
- [x] Test: Response has expected structure `{ months: [{ month, year }] }`
- [x] All tests pass with `npm run test`

### Phase 2: Frontend Month Filter Components

#### Task 2.1 - [CREATE] MonthFilter component `src/components/dashboard/MonthFilter.tsx`
**Description**: Create a presentational component rendering a `<select>` dropdown for month selection. It displays available months formatted as "Month YYYY" (e.g., "February 2026") and calls an `onChange` handler with the selected month/year.

**Definition of Done**:
- [x] File `src/components/dashboard/MonthFilter.tsx` is created as a `"use client"` component
- [x] Component props: `availableMonths: { month: number; year: number }[]`, `selectedMonth: number`, `selectedYear: number`, `onChange: (month: number, year: number) => void`, `disabled?: boolean`
- [x] Renders a `<select>` element with `<option>` entries for each available month formatted as "Month YYYY" using month name mapping (e.g., "February 2026")
- [x] The `value` of each option encodes both month and year (e.g., `"2-2026"`)
- [x] The option matching `selectedMonth`/`selectedYear` is selected by default
- [x] If the current month is not in `availableMonths`, an additional "(current month)" option is included as the default so the user always sees the current period
- [x] When the user selects a different option, `onChange(month, year)` is called with the parsed values
- [x] The select is wrapped with a `<label>` for accessibility (label text: "Month")
- [x] Component uses Tailwind CSS classes consistent with existing form controls in the codebase (e.g., `SeatListPanel.tsx` select elements)
- [x] When `disabled` is true, the select is disabled (used during loading)

#### Task 2.2 - [CREATE] DashboardWithFilter wrapper `src/components/dashboard/DashboardWithFilter.tsx`
**Description**: Create a client component that manages the selected month/year state. It fetches available months from `GET /api/dashboard/months` on mount, renders `MonthFilter` and `DashboardPanel`, and updates `DashboardPanel` props when the user changes the month.

**Definition of Done**:
- [x] File `src/components/dashboard/DashboardWithFilter.tsx` is created as a `"use client"` component
- [x] Component accepts `initialMonth: number` and `initialYear: number` props (passed from the server component)
- [x] On mount, fetches `GET /api/dashboard/months` to get the list of available months
- [x] Manages `selectedMonth` and `selectedYear` state (defaults to `initialMonth` / `initialYear`)
- [x] Manages `availableMonths` state (defaults to empty array, populated after fetch)
- [x] Renders `MonthFilter` with the current state and available months; passes `disabled={true}` while loading
- [x] Renders `DashboardPanel` with the `selectedMonth` and `selectedYear` as `month`/`year` props
- [x] When the user selects a different month in `MonthFilter`, updates state and `DashboardPanel` re-fetches automatically (since it reacts to prop changes via `useEffect` dependency array)
- [x] Handles fetch error for available months gracefully — still renders `DashboardPanel` with the current month, logs error to console
- [x] Layout: `MonthFilter` is positioned above the `DashboardPanel` content, right-aligned to match common dashboard filter patterns

#### Task 2.3 - [MODIFY] Update dashboard page `src/app/(app)/dashboard/page.tsx`
**Description**: Replace direct `DashboardPanel` rendering with the new `DashboardWithFilter` component.

**Definition of Done**:
- [x] `src/app/(app)/dashboard/page.tsx` imports `DashboardWithFilter` instead of `DashboardPanel`
- [x] `DashboardWithFilter` receives `initialMonth` and `initialYear` props derived from current UTC date (same logic as before)
- [x] The `metadata` export and `dynamic = "force-dynamic"` are preserved
- [x] Page heading and description remain unchanged
- [x] All existing dashboard functionality continues to work

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Dashboard E2E tests `e2e/dashboard.spec.ts`
**Description**: Extend existing E2E tests with month filter scenarios. Seed summary data for multiple months and verify that the filter appears, defaults to the current month, and switching months updates the displayed metrics.

**Definition of Done**:
- [x] `e2e/dashboard.spec.ts` is extended with additional tests for the month filter
- [x] Helper `seedDashboardSummary` is updated or a new helper is added to seed data for arbitrary months
- [x] Test: Month filter dropdown is visible on the dashboard
- [x] Test: Current month is selected by default in the dropdown
- [x] Test: Selecting a different month refreshes all dashboard metrics (seeds data for 2 months with different values, switches month, verifies displayed values change)
- [x] Test: All months with available data appear as options in the dropdown (seeds 3 months, verifies all 3 appear)
- [x] All E2E tests pass with `npm run test:e2e`

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, adherence to project conventions, and completeness against acceptance criteria.

**Definition of Done**:
- [x] All new code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] API route follows existing patterns (auth, error handling, response shape)
- [x] Frontend components follow existing patterns (Tailwind, accessibility, loading/error states)
- [x] `MonthFilter` is accessible (labelled `<select>`, keyboard navigable)
- [x] No unnecessary changes to existing `DashboardPanel` component
- [x] Tests adequately cover all acceptance criteria
- [x] All tests (unit + E2E) pass

## Security Considerations

- **Authentication**: The new `GET /api/dashboard/months` endpoint uses `requireAuth()` / `isAuthFailure()` to enforce authentication, consistent with all other API routes in the application. Unauthenticated requests receive a 401 response.
- **Data exposure**: The endpoint only returns `(month, year)` pairs — no sensitive data, no detailed metrics. It reveals only which months have collected data.
- **No user input in queries**: The available months endpoint accepts no query parameters and uses TypeORM repository methods (`find()`) — no risk of SQL injection.
- **Input validation on the existing dashboard route**: The existing `GET /api/dashboard` already validates `month` and `year` parameters. The frontend passes values selected from the dropdown, which are always valid (month 1-12, year ≥ 2020), but server-side validation is already in place as a defense-in-depth measure.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Month filter is visible on the dashboard
- [x] Selecting a different month refreshes all dashboard metrics for that month
- [x] Current month is selected by default
- [x] All months with available data are selectable

## Improvements (Out of Scope)

- **URL-based month state**: Encoding the selected month/year in the URL (e.g., `/dashboard?month=2&year=2026`) would allow bookmarking and direct linking to a specific month. Deferred as the codebase does not use URL-based state for any current filters.
- **Month range navigation**: Arrow buttons or previous/next month navigation for quick sequential browsing. Simple dropdown is sufficient for the current scope.
- **Auto-refresh on new data**: When a sync job completes and a new month becomes available, the dropdown could auto-update. Currently requires a page refresh.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation complete — Phases 1-3 done. 286 unit tests, 12 E2E tests pass. |
| 2026-02-28 | Code review by tsh-code-reviewer: Approved. Fixed M1 (extracted MONTH_NAMES to shared `src/lib/constants.ts`) and L1 (added `disabled:opacity-50` to MonthFilter select). |
