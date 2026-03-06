# Per Seat Usage Drill-Down — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Per Seat Usage — Two-Level Master-Detail View |
| Description | Restructure the seat usage tab into a master-detail pattern. Level 1 shows a simplified aggregated table (total requests + gross spending per seat). Each row links to Level 2 — a per-user dashboard page showing net spending and total requests as cards, a daily usage bar chart for the month, and a per-model breakdown table. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Epic 6 / Story 6.1), [story-6-1.plan.md](./story-6-1.plan.md) |

## Proposed Solution

Restructure the existing seat usage view into a two-level master-detail pattern:

### Architecture

```
Level 1 — /usage (Seat tab, simplified)
┌──────────────────────────────────────────────────────────┐
│  [Seat*]  [Team]  [Department]     [Month Filter ▾]     │
├──────────────────────────────────────────────────────────┤
│  Username    │ Name    │ Dept   │ Requests │ Spending   │
│  alice-dev →│ Alice S │ Eng    │    450   │   $18.00   │
│  bob-dev   →│ Bob J   │ Design │    120   │    $4.80   │
│  ...        │         │        │          │            │
├──────────────────────────────────────────────────────────┤
│           ◀ Previous   Page 1 of 3   Next ▶            │
└──────────────────────────────────────────────────────────┘
       │  click row
       ▼
Level 2 — /usage/seats/[seatId]?month=M&year=Y
┌──────────────────────────────────────────────────────────┐
│  ← Back to Usage    alice-dev      [Month Filter ▾]     │
├──────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐                   │
│  │ Net Spending   │  │Total Requests │                   │
│  │ $5.50          │  │    450        │                   │
│  └───────────────┘  └───────────────┘                   │
├──────────────────────────────────────────────────────────┤
│  Daily Usage (recharts BarChart)                         │
│  ▐ ▐▐▐  ▐ ▐▐   ▐▐▐▐▐  ▐▐  ...  ▐▐ ▐                 │
│  1  2  3  4  5  6  ... ... 28 29 30                     │
├──────────────────────────────────────────────────────────┤
│  Model Breakdown                                         │
│  Model            │ Total Requests │ Gross   │ Net      │
│  Claude Sonnet 4.5│    300         │ $12.00  │ $3.50    │
│  GPT-4o           │    150         │  $6.00  │ $2.00    │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
Level 1:
GET /api/usage/seats?month=M&year=Y&page=P&pageSize=N  (existing, no changes)
  → SeatUsagePanel → SeatUsageTable (simplified columns, clickable rows)

Level 2:
GET /api/usage/seats/[seatId]?month=M&year=Y  (NEW)
  → SeatDetailPanel
     ├── Summary cards (net spending, total requests)
     ├── SeatDailyChart (recharts BarChart of daily requests)
     └── SeatModelTable (per-model spending + requests)
```

### New API Contract

```
GET /api/usage/seats/:seatId?month=2&year=2026

Response 200:
{
  "seat": {
    "seatId": 1,
    "githubUsername": "alice-dev",
    "firstName": "Alice",
    "lastName": "Smith",
    "department": "Engineering"
  },
  "summary": {
    "totalRequests": 450,
    "grossSpending": 18.00,
    "netSpending": 5.50
  },
  "dailyUsage": [
    { "day": 1, "totalRequests": 25, "grossAmount": 1.00 },
    { "day": 2, "totalRequests": 30, "grossAmount": 1.20 },
    ...
  ],
  "modelBreakdown": [
    {
      "model": "Claude Sonnet 4.5",
      "totalRequests": 300,
      "grossAmount": 12.00,
      "netAmount": 3.50
    }
  ],
  "month": 2,
  "year": 2026
}

Response 400: { "error": "Invalid seat ID" }
Response 404: { "error": "Seat not found" }
```

### New Dependency

- `recharts` — React charting library for the daily usage bar chart. Selected for its wide adoption (~23M weekly downloads), excellent React integration, minimal configuration, and responsive container support.

## Current Implementation Analysis

### Already Implemented
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — data-fetching container for seat list; handles loading, error, empty, and pagination states
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — renders seat usage rows with: Username, Name, Department, Models, Total Requests, Gross Amount, Net Amount
- `Pagination` — `src/components/usage/Pagination.tsx` — reusable pagination with Previous/Next buttons and page indicator
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — tabbed layout (Seat/Team/Department) with MonthFilter
- `MonthFilter` — `src/components/dashboard/MonthFilter.tsx` — month/year selector dropdown, reused across dashboard and usage pages
- `GET /api/usage/seats` — `src/app/api/usage/seats/route.ts` — paginated per-seat usage aggregation with CTE-based SQL; returns `seatId`, `githubUsername`, `firstName`, `lastName`, `department`, `totalRequests`, `totalGrossAmount`, `totalNetAmount`, `models[]`
- `CopilotUsageEntity` — `src/entities/copilot-usage.entity.ts` — entity with `usageItems` JSONB containing per-model `grossQuantity`, `grossAmount`, `netAmount`, etc.
- `CopilotSeatEntity` — `src/entities/copilot-seat.entity.ts` — seat entity with `githubUsername`, `firstName`, `lastName`, `department`
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — authentication middleware for API routes
- Unit tests — `src/app/api/usage/seats/__tests__/route.test.ts` — 7 tests covering seat list API
- E2E tests — `e2e/seat-usage.spec.ts` — 7 tests covering seat usage tab (table, pagination, month filter, empty state)
- `formatCurrency` — `src/components/usage/SeatUsageTable.tsx` — local helper `$X.XX` formatter (also exists in `DashboardPanel.tsx`)

### To Be Modified
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — remove Models and Net Amount columns; make rows clickable with navigation links to detail page; accept `month`/`year` props for building URLs
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — pass `month`/`year` props to `SeatUsageTable`
- E2E tests — `e2e/seat-usage.spec.ts` — update assertions for simplified table columns; add drill-down navigation tests

### To Be Created
- `GET /api/usage/seats/[seatId]` — `src/app/api/usage/seats/[seatId]/route.ts` — seat detail API endpoint
- Unit tests — `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts` — unit tests for detail endpoint
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — data-fetching container for the seat detail dashboard
- `SeatDailyChart` — `src/components/usage/SeatDailyChart.tsx` — recharts-based daily usage bar chart
- `SeatModelTable` — `src/components/usage/SeatModelTable.tsx` — per-model breakdown table
- Page route — `src/app/(app)/usage/seats/[seatId]/page.tsx` — Next.js page for the seat detail view

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Which charting library for the daily usage chart? | `recharts` — most popular React charting library, good Next.js support | ✅ Resolved |
| 2 | How should drill-down navigation work? | Full page navigation: `/usage/seats/[seatId]?month=M&year=Y` with back link | ✅ Resolved |
| 3 | Should Level 1 table keep Models and Net Amount columns? | No — simplify to Username, Name, Department, Total Requests, Total Spending (Gross) | ✅ Resolved |
| 4 | Does adding `recharts` require any SSR configuration? | No — recharts components are client-side only; components using recharts already require `"use client"` directive | ✅ Resolved |
| 5 | Should the daily chart show gross amount or request count? | Total requests (grossQuantity) per the user's requirement: "chart showing his total usage daily" | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Seat Detail API

#### Task 1.1 - [CREATE] Seat Detail API Endpoint
**Description**: Create a new API route at `src/app/api/usage/seats/[seatId]/route.ts` that returns detailed usage data for a single seat in a specific month. The endpoint performs three SQL queries: (1) seat lookup from `copilot_seat`, (2) daily usage aggregation from `copilot_usage` grouped by day, (3) per-model breakdown grouped by model. All queries use parameterised SQL via `dataSource.query()` consistent with the existing seat list endpoint.

**Definition of Done**:
- [x] File `src/app/api/usage/seats/[seatId]/route.ts` exists with a `GET` handler
- [x] Route is protected by `requireAuth()` / `isAuthFailure()` — returns 401 for unauthenticated requests
- [x] `seatId` path parameter is parsed and validated as a positive integer; returns 400 `{ error: "Invalid seat ID" }` for non-numeric or negative values
- [x] `month` and `year` query params are parsed with the same defaults/validation as the list endpoint (defaults to current month/year, month 1–12, year ≥ 2020)
- [x] Seat is looked up from `copilot_seat WHERE id = seatId`; returns 404 `{ error: "Seat not found" }` if not found
- [x] Daily usage query aggregates `SUM(grossQuantity)`, `SUM(grossAmount)` from `copilot_usage` for the given seat/month/year, grouped by `day`, ordered by `day ASC`
- [x] Model breakdown query aggregates `SUM(grossQuantity)`, `SUM(grossAmount)`, `SUM(netAmount)` grouped by `item->>'model'`, ordered by `totalRequests DESC`
- [x] Summary totals (`totalRequests`, `grossSpending`, `netSpending`) are derived from SUM across all usage items for the seat/month/year
- [x] Response JSON matches the documented API contract (seat, summary, dailyUsage, modelBreakdown, month, year)
- [x] When no usage data exists for the seat/month/year, returns empty arrays for `dailyUsage` and `modelBreakdown` with zeroed summary, and still includes seat info
- [x] `export const dynamic = "force-dynamic"` is set (consistent with other API routes)
- [x] No TypeScript compilation errors

#### Task 1.2 - [CREATE] Unit Tests for Seat Detail Endpoint
**Description**: Create unit tests at `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts` following the exact patterns from the existing `src/app/api/usage/seats/__tests__/route.test.ts` (same test DB setup, auth mocking, `cleanDatabase` helper, `seedSeat`/`seedUsage` patterns).

**Definition of Done**:
- [x] Test file exists at `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts`
- [x] Test: returns 401 without session
- [x] Test: returns 400 for non-numeric seatId (e.g., "abc")
- [x] Test: returns 404 for non-existent seatId
- [x] Test: returns seat info with empty usage data when no usage exists for the month
- [x] Test: returns correct daily usage aggregation (seeds usage for multiple days, validates day-by-day totals)
- [x] Test: returns correct model breakdown (seeds usage with multiple models across multiple days, validates per-model totals)
- [x] Test: returns correct summary totals (totalRequests, grossSpending, netSpending)
- [x] Test: defaults to current month/year when query params are missing
- [x] All tests pass with `vitest run`

### Phase 2: Frontend — Level 1 Simplification

#### Task 2.1 - [MODIFY] Pass `month`/`year` to SeatUsageTable
**Description**: Update `SeatUsagePanel` to pass the current `month` and `year` props to `SeatUsageTable` so that clickable rows can construct proper navigation URLs including the month context.

**Definition of Done**:
- [x] `SeatUsagePanel` passes `month` and `year` props to `SeatUsageTable`
- [x] No TypeScript compilation errors

#### Task 2.2 - [MODIFY] Simplify SeatUsageTable and Add Drill-Down Links
**Description**: Modify `SeatUsageTable` to: (1) remove the "Models" and "Net Amount" columns, (2) rename "Gross Amount" column header to "Total Spending", (3) wrap each row in a Next.js `Link` that navigates to `/usage/seats/${seat.seatId}?month=${month}&year=${year}`, (4) add visual affordance for clickability (hover state, cursor pointer). Accept `month` and `year` as new props.

**Definition of Done**:
- [x] `SeatUsageTable` accepts `month: number` and `year: number` props
- [x] Table columns are: GitHub Username, Name, Department, Total Requests, Total Spending
- [x] "Models" column is removed
- [x] "Net Amount" column is removed
- [x] "Gross Amount" column header is renamed to "Total Spending"
- [x] Each row is wrapped in (or contains) a Next.js `Link` to `/usage/seats/${seat.seatId}?month=${month}&year=${year}`
- [x] Rows have `hover:bg-gray-50 cursor-pointer` visual feedback
- [x] `formatCurrency` helper is retained for the Total Spending column
- [x] No TypeScript compilation errors
- [x] Existing `SeatUsageEntry` interface from `SeatUsagePanel` remains compatible (no breaking changes to `models`, `totalNetAmount` fields — they simply aren't rendered)

### Phase 3: Frontend — Level 2 Seat Detail Page

#### Task 3.1 - [CREATE] Add `recharts` Dependency
**Description**: Install `recharts` as a production dependency. Verify it is added to `package.json`.

**Definition of Done**:
- [x] `recharts` is listed in `dependencies` in `package.json`
- [x] Package installs without errors
- [x] No version conflicts with existing dependencies (React 19, Next.js 16)

#### Task 3.2 - [CREATE] SeatModelTable Component
**Description**: Create a stateless presentational component that renders a table of per-model usage data. Columns: Model, Total Requests, Gross Amount, Net Amount. Follows the same table styling pattern as the existing `SeatUsageTable` (rounded border, gray-200 border, shadow-sm, header with gray-50 bg).

**Definition of Done**:
- [x] File `src/components/usage/SeatModelTable.tsx` exists
- [x] Component accepts `models: { model: string; totalRequests: number; grossAmount: number; netAmount: number }[]` prop
- [x] Renders a table with columns: Model, Total Requests, Gross Amount, Net Amount
- [x] Amounts formatted with `$X.XX` pattern using a local `formatCurrency` helper
- [x] Requests formatted with `.toLocaleString()`
- [x] Table styling matches existing tables (rounded-lg, border, shadow-sm, header bg-gray-50)
- [x] Handles empty `models` array gracefully (renders table with no body rows)
- [x] No TypeScript compilation errors

#### Task 3.3 - [CREATE] SeatDailyChart Component
**Description**: Create a client component that renders a recharts `BarChart` showing daily total requests for a month. X-axis: day numbers (1–N), Y-axis: total requests. Uses `ResponsiveContainer` for responsive width. The component receives the raw `dailyUsage` array and the number of days in the month, filling in missing days with 0 values for a complete axis.

**Definition of Done**:
- [x] File `src/components/usage/SeatDailyChart.tsx` exists with `"use client"` directive
- [x] Component accepts `dailyUsage: { day: number; totalRequests: number; grossAmount: number }[]` and `daysInMonth: number` props
- [x] Generates a full array of days 1 through `daysInMonth`, filling missing days with `totalRequests: 0`
- [x] Renders a recharts `BarChart` inside a `ResponsiveContainer` (height ~300px)
- [x] X-axis shows day numbers; Y-axis shows total requests
- [x] Bar color uses `#2563eb` (blue-600) to match the design system
- [x] `Tooltip` displays day number and total requests on hover
- [x] `CartesianGrid` with dashed stroke for visual clarity
- [x] Accessible: chart container has `role="img"` and an `aria-label` describing the chart content
- [x] No TypeScript compilation errors

#### Task 3.4 - [CREATE] SeatDetailPanel Component
**Description**: Create a client component that fetches data from `GET /api/usage/seats/[seatId]?month=M&year=Y` and renders the seat detail dashboard. Includes: back link to `/usage`, seat name/username header, month filter, summary cards (Net Spending, Total Requests), `SeatDailyChart`, and `SeatModelTable`. Manages loading, error, empty, and data states. Fetches available months from `GET /api/dashboard/months` for the month filter (reusing the same pattern as `UsagePageLayout`).

**Definition of Done**:
- [x] File `src/components/usage/SeatDetailPanel.tsx` exists with `"use client"` directive
- [x] Component accepts `seatId: number`, `initialMonth: number`, `initialYear: number` props
- [x] Fetches seat detail from `GET /api/usage/seats/${seatId}?month=${month}&year=${year}`
- [x] Fetches available months from `GET /api/dashboard/months` (same pattern as `UsagePageLayout`)
- [x] Renders a back link (`← Back to Usage`) that navigates to `/usage`
- [x] Displays seat username and full name in the header
- [x] Renders `MonthFilter` component allowing month switching (refetches data on change)
- [x] Renders two summary cards: "Net Spending" (formatted as currency) and "Total Requests" (formatted with `.toLocaleString()`)
- [x] Summary cards follow the same styling pattern as `DashboardPanel.tsx` cards (rounded-lg, border, shadow-sm, text-3xl bold value, text-sm label)
- [x] Renders `SeatDailyChart` with the `dailyUsage` data and computed `daysInMonth`
- [x] Renders `SeatModelTable` with the `modelBreakdown` data
- [x] Shows loading state: "Loading seat usage data…" centered with `role="status"`
- [x] Shows error state: red alert box with error message and `role="alert"`
- [x] Shows empty usage state when summary totals are zero: informative message indicating no usage data for the month
- [x] Computes `daysInMonth` using `new Date(year, month, 0).getDate()`
- [x] No TypeScript compilation errors

#### Task 3.5 - [CREATE] Seat Detail Page Route
**Description**: Create the Next.js page at `src/app/(app)/usage/seats/[seatId]/page.tsx`. This is a server component that reads the `seatId` from route params, parses `month`/`year` from search params (defaulting to current month/year), and renders the `SeatDetailPanel`.

**Definition of Done**:
- [x] File `src/app/(app)/usage/seats/[seatId]/page.tsx` exists
- [x] Page exports `metadata` with title "Seat Usage — Copilot Dashboard"
- [x] Page exports `dynamic = "force-dynamic"`
- [x] Reads `seatId` from `params` and parses it as a number
- [x] Reads `month` and `year` from `searchParams`, defaults to current month/year
- [x] Renders `SeatDetailPanel` with `seatId`, `initialMonth`, `initialYear` props
- [x] Page layout matches existing pages: centered max-w-5xl container, bg-gray-50, py-12 px-4
- [x] No TypeScript compilation errors

### Phase 4: Tests — E2E

#### Task 4.1 - [MODIFY] Update Seat Usage E2E Tests for Simplified Table
**Description**: Update existing E2E tests in `e2e/seat-usage.spec.ts` that assert on the Models column and Net Amount column, as those columns are now removed from Level 1. Update assertions for the new "Total Spending" column header.

**Definition of Done**:
- [x] Test "per-seat usage data is displayed in a table" no longer asserts on `$0.30` (net amount) as a separate column; instead asserts on `$4.00` as "Total Spending"
- [x] Test "model names are visible in seat rows" is removed or updated (models are no longer shown on Level 1)
- [x] All existing seat usage E2E tests pass with the simplified table

#### Task 4.2 - [CREATE] E2E Tests for Seat Detail Drill-Down
**Description**: Add new E2E tests in `e2e/seat-usage.spec.ts` covering the drill-down navigation and the Level 2 seat detail view. Seed usage data for a specific seat across multiple days and models, then verify all sections render correctly.

**Definition of Done**:
- [x] Test: clicking a seat row navigates to `/usage/seats/[seatId]`
- [x] Test: back link navigates back to `/usage`
- [x] Test: summary cards display net spending and total requests
- [x] Test: daily usage chart is visible (verifies the chart container is rendered with `role="img"`)
- [x] Test: model breakdown table displays per-model data with correct values
- [x] Test: month filter changes the displayed data (switch months, verify updated values)
- [x] Test: empty state is shown when seat has no usage data for the selected month
- [x] All E2E tests pass with `playwright test`

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by `tsh-code-reviewer` Agent
**Description**: Run the `tsh-code-reviewer` agent to review all changes from Phases 1–4, ensuring code quality, consistency with project patterns, and adherence to standards.

**Definition of Done**:
- [ ] Code review completed by `tsh-code-reviewer`
- [ ] All review findings addressed or documented
- [ ] No critical or high-severity issues remaining

## Security Considerations

- **Authentication**: The new `GET /api/usage/seats/[seatId]` endpoint is protected by `requireAuth()` / `isAuthFailure()`, consistent with all existing API routes. Unauthenticated requests receive 401.
- **Input validation**: The `seatId` path parameter is validated as a positive integer. Invalid values receive 400. Month and year query params are validated with the same logic as the existing seat list endpoint.
- **SQL injection**: All SQL queries use parameterised placeholders (`$1`, `$2`, etc.) via `dataSource.query()` — no string concatenation of user input into SQL.
- **Data exposure**: The endpoint only returns data already accessible through the existing seat list endpoint, aggregated differently. No new data types are exposed.
- **XSS**: All values are rendered through React's JSX auto-escaping. No `dangerouslySetInnerHTML` is used.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Level 1 seat list shows only: Username, Name, Department, Total Requests, Total Spending (Gross)
- [ ] Each seat row on Level 1 is clickable and navigates to the seat detail page
- [ ] Seat detail page displays the correct seat username and name
- [ ] Seat detail page shows Net Spending and Total Requests as summary cards
- [ ] Seat detail page shows a daily usage bar chart with one bar per day of the month
- [ ] Seat detail page shows a per-model breakdown table with model name, total requests, gross amount, and net amount
- [ ] Month filter on the seat detail page refetches and displays data for the newly selected month
- [ ] Back link on the seat detail page navigates to `/usage`
- [ ] Empty state is displayed on the seat detail page when no usage data exists for the selected month
- [ ] API endpoint returns 401 for unauthenticated requests
- [ ] API endpoint returns 400 for invalid seat IDs
- [ ] API endpoint returns 404 for non-existent seats
- [ ] All unit tests pass (`vitest run`)
- [ ] All E2E tests pass (`playwright test`)
- [ ] No TypeScript compilation errors
- [ ] No regressions in existing seat list, dashboard, or other feature tests

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- Add gross spending card alongside net spending on Level 2 for a complete cost picture
- Add daily spending (grossAmount) as a second series on the daily chart (dual-axis or stacked)
- Add ability to download/export per-seat usage data as CSV
- Add a "compared to average" indicator on the summary cards showing how this user compares to the organisation average
- Extract `formatCurrency` into a shared utility (`src/lib/format.ts`) to eliminate duplication across `SeatUsageTable`, `DashboardPanel`, `SeatModelTable`, and `SeatDetailPanel`
- Add skeleton loading states for cards and chart (instead of text-based "Loading…")
- Add sorting capability to the model breakdown table (by requests, amount)
- Consider pre-aggregating per-seat monthly summaries into a JSONB column or separate table for faster queries at scale

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
