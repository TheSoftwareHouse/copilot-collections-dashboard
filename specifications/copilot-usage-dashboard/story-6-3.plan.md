# Story 6.3 — Per-Department Usage for a Specific Month — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 6.3 |
| Title | User can view per-department usage for a specific month |
| Description | Implement the Department tab in the Usage Analytics section. The tab shows a horizontal bar chart of all departments' included premium request usage % (ordered least → highest), followed by a summary table with department name, average requests per member, and usage %. Clicking a department drills down to a detail page showing a member usage bar chart (each member's requests relative to the 300 included allowance) and a member table with username, colour indicator, total usage, and % usage — matching the Team tab's member indicators. Handles empty states for no departments defined and departments with no assigned seats. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Epic 6 / Story 6.3), [story-6-2.plan.md](./story-6-2.plan.md) |

## Proposed Solution

Replace the placeholder content in the Department tab of the existing `/usage` page with a fully functional department usage analytics panel. The design is chart-first for both the overview and the drill-down:

1. **Department overview** — a horizontal bar chart visualising each department's % usage of its included premium request allowance (`totalRequests / (memberCount × 300) × 100`), ordered from lowest to highest, plus a summary table.
2. **Department detail** — a member bar chart showing each member's usage relative to the 300 included premium requests (same concept applied per-member), plus a member table with colour indicators (reusing the Team tab's colour logic).

This includes two new API endpoints, three new chart/table components, a data-fetching panel, a detail panel, and a new page route.

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      /usage (page)                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  [Seat]  [Team]  [Department*]  ← tabs              │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  DepartmentUsagePanel                               │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │  DepartmentUsageChart (horizontal BarChart)   │  │  │
│  │  │  Y: department names (sorted low→high usage)  │  │  │
│  │  │  X: % of included premium requests used       │  │  │
│  │  │      usagePercent = totalReqs /               │  │  │
│  │  │        (memberCount × 300) × 100              │  │  │
│  │  │  Reference line at 100%                       │  │  │
│  │  ├───────────────────────────────────────────────┤  │  │
│  │  │  DepartmentUsageTable                         │  │  │
│  │  │  dept name (link) | avg reqs/member | usage % │  │  │
│  │  │  → click name → /usage/departments/[deptId]   │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│        /usage/departments/[departmentId] (detail)         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ← Back to Usage   │  MonthFilter                  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  Department: "Engineering" — 8 members              │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  DepartmentMemberChart (horizontal BarChart)        │  │
│  │  Y: member usernames (sorted low→high usage)       │  │
│  │  X: total requests (capped at 300 for bar length)  │  │
│  │  Reference line at 300                              │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  Members table (reuse TeamMemberTable):             │  │
│  │  🟢/🟠/🔴 username | name | usage (#/300 & %) |   │  │
│  │  gross spending                                     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### Usage Percentage Formula

**Department-level** (overview chart + table):
```
includedAllowance = memberCount × PREMIUM_REQUESTS_PER_SEAT     (= memberCount × 300)
usagePercent      = memberCount > 0
                    ? (totalRequests / includedAllowance) × 100
                    : 0
```

- Departments with 0 members → 0%.
- Can exceed 100% when members use more than their included 300 requests each.
- The chart displays the bar proportionally; a reference line at 100% marks the included boundary.

**Member-level** (detail chart + table):
```
usagePercent = (totalRequests / PREMIUM_REQUESTS_PER_SEAT) × 100   (= totalRequests / 300 × 100)
```

- Same formula already used by `TeamMemberTable` and its colour indicators.
- The bar chart caps bar display length at 300 requests (`PREMIUM_REQUESTS_PER_SEAT`), with a reference line.

### Data Flow

1. **Department overview**: `DepartmentUsagePanel` fetches `GET /api/usage/departments?month=M&year=Y` → API queries `department` LEFT JOINed with `copilot_seat` (via `departmentId`) and `copilot_usage` to aggregate per-department metrics → renders `DepartmentUsageChart` (bar chart) + `DepartmentUsageTable` (summary table)
2. **Drill-down**: Clicking a department name in the table navigates to `/usage/departments/[departmentId]?month=M&year=Y` → `DepartmentDetailPanel` fetches `GET /api/usage/departments/[departmentId]?month=M&year=Y` → API returns department info + per-member usage → renders `DepartmentMemberChart` (member bar chart) + `TeamMemberTable` (member table with colour indicators)

### API Contracts

**Departments List:**

```
GET /api/usage/departments?month=2&year=2026

Response 200:
{
  "departments": [
    {
      "departmentId": 1,
      "departmentName": "Engineering",
      "memberCount": 8,
      "totalRequests": 2400.5,
      "totalGrossAmount": 96.02,
      "averageRequestsPerMember": 300.06,
      "usagePercent": 100.02
    }
  ],
  "total": 3,
  "month": 2,
  "year": 2026
}
```

**Department Detail:**

```
GET /api/usage/departments/1?month=2&year=2026

Response 200:
{
  "department": {
    "departmentId": 1,
    "departmentName": "Engineering",
    "memberCount": 8,
    "totalRequests": 2400.5,
    "totalGrossAmount": 96.02,
    "averageRequestsPerMember": 300.06,
    "usagePercent": 100.02
  },
  "members": [
    {
      "seatId": 1,
      "githubUsername": "alice-dev",
      "firstName": "Alice",
      "lastName": "Smith",
      "totalRequests": 300.0,
      "totalGrossAmount": 12.00
    }
  ],
  "month": 2,
  "year": 2026
}
```

### Key Difference from Team Model

Unlike teams (which use `team_member_snapshot` for per-month composition tracking), departments use a direct FK relationship: `copilot_seat.departmentId → department.id`. This means the **current** department assignment of a seat is used for usage aggregation across all months. Department membership is not tracked historically per month.

### Assumed Department Data Model (Prerequisite — Story 7.5 / 7.6)

This plan assumes the following table and schema changes exist from Stories 7.5 and 7.6:

```sql
-- department table (Story 7.5)
CREATE TABLE department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- copilot_seat modification (Story 7.6)
-- New FK column added to copilot_seat:
ALTER TABLE copilot_seat
    ADD COLUMN "departmentId" INT REFERENCES department(id) ON DELETE SET NULL;

CREATE INDEX "IDX_copilot_seat_department" ON copilot_seat("departmentId");
```

The entity `DepartmentEntity` is assumed to exist at `src/entities/department.entity.ts` and be registered in `data-source.ts` and `db-helpers.ts`. The `CopilotSeatEntity` is assumed to have the `departmentId` column defined.

## Current Implementation Analysis

### Already Implemented
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — three-tab layout with Seat/Team/Department tabs; Department tab currently renders placeholder
- `TeamUsagePanel` / `TeamUsageTable` — `src/components/usage/` — pattern to follow for `DepartmentUsagePanel` / `DepartmentUsageTable`
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — pattern to follow for `DepartmentDetailPanel` (back link, month filter, chart, table layout)
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — member table with usage % (# / 300) and colour indicators (red/orange/green); **can be reused directly** for department detail (interface is generic: `members: TeamMember[]`)
- `PREMIUM_REQUESTS_PER_SEAT` — `src/lib/constants.ts` — constant (300) used by `TeamMemberTable` and both new charts
- `recharts` — `package.json` dependency — already available; `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `ReferenceLine` used in new charts
- `SeatDailyChart` — `src/components/usage/SeatDailyChart.tsx` — existing `BarChart` pattern to follow for `DepartmentUsageChart` and `DepartmentMemberChart`
- `GET /api/usage/teams` — `src/app/api/usage/teams/route.ts` — reference for aggregation SQL with CTEs pattern
- `GET /api/usage/teams/[teamId]` — `src/app/api/usage/teams/[teamId]/route.ts` — reference for drill-down API pattern (route context, param parsing, 404 handling)
- `/usage/teams/[teamId]` page — `src/app/(app)/usage/teams/[teamId]/page.tsx` — reference for drill-down page pattern
- `MonthFilter` — `src/components/dashboard/MonthFilter.tsx` — reusable month picker
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — authentication middleware
- `getDb()` — `src/lib/db.ts` — database connection helper
- `MONTH_NAMES` — `src/lib/constants.ts` — month name array
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`
- E2E auth helpers — `e2e/helpers/auth.ts` — `seedTestUser`, `loginViaApi`
- E2E seeding pattern — `e2e/team-usage.spec.ts` — direct `pg.Client` queries for test data seeding

### To Be Modified
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — replace Department tab placeholder with `DepartmentUsagePanel` component
- `e2e/seat-usage.spec.ts` — update E2E test that asserts "Department usage analytics will be available in a future update" placeholder text (it will no longer appear)

### To Be Created
- `GET /api/usage/departments` — API route for aggregated per-department usage with `usagePercent`
- `GET /api/usage/departments/[departmentId]` — API route for department detail with per-member usage
- `src/components/usage/DepartmentUsagePanel.tsx` — data-fetching container for department overview (chart + table)
- `src/components/usage/DepartmentUsageChart.tsx` — horizontal bar chart showing department-level usage % (ordered least → highest)
- `src/components/usage/DepartmentUsageTable.tsx` — summary table: department name (link), avg requests/member, usage %
- `src/components/usage/DepartmentDetailPanel.tsx` — data-fetching container for department drill-down
- `src/components/usage/DepartmentMemberChart.tsx` — horizontal bar chart showing per-member usage relative to 300 included requests
- `src/app/(app)/usage/departments/[departmentId]/page.tsx` — department detail page
- `src/app/api/usage/departments/__tests__/route.test.ts` — integration tests for departments list API
- `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts` — integration tests for department detail API
- `e2e/department-usage.spec.ts` — E2E tests for department usage analytics

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What is the department data model for Story 6.3? | Assumes a `department` table (id, name) from Story 7.5 and a `departmentId` FK on `copilot_seat` from Story 7.6. This is a prerequisite — not implemented as part of this story. | ✅ Resolved |
| 2 | Should departments track monthly composition like teams? | No. Unlike teams (which use `team_member_snapshot`), department membership is based on the current `copilot_seat.departmentId` assignment. Historical department changes are not tracked. | ✅ Resolved |
| 3 | Should the departments list be paginated? | No. Departments are organisational constructs and unlikely to exceed ~20–30 entries. The API returns all departments. Pagination can be added later if needed. | ✅ Resolved |
| 4 | How should the department drill-down work? | Navigates to `/usage/departments/[departmentId]?month=M&year=Y` (same pattern as team detail). Separate page with back link, month filter, member bar chart, and member table. | ✅ Resolved |
| 5 | What happens for departments with no assigned seats? | Show the department in the list/chart with `memberCount: 0`, `usagePercent: 0`. Average per member shows as `0` (not division by zero error). | ✅ Resolved |
| 6 | What happens when no departments exist at all? | Show informative message: "No departments have been defined yet. Create departments in Settings to see aggregated usage." | ✅ Resolved |
| 7 | Can `TeamMemberTable` be reused for the department detail member table? | Yes. `TeamMemberTable` has a generic interface (`members[]` with `totalRequests`, colour indicators, % of 300) that is not team-specific. It can be reused directly. | ✅ Resolved |
| 8 | What chart type should the department overview use? | A horizontal bar chart (recharts `BarChart` with `layout="vertical"`) showing each department's usage % of its included premium request allowance. Ordered from least to highest. A `ReferenceLine` at 100% marks the included boundary. | ✅ Resolved |
| 9 | What chart type should the department detail use for members? | A horizontal bar chart showing each member's total requests, with the bar length representing usage relative to 300 included requests. A `ReferenceLine` at 300 marks the included boundary. Same concept as the overview chart but per-member. | ✅ Resolved |
| 10 | How is department `usagePercent` calculated? | `usagePercent = memberCount > 0 ? (totalRequests / (memberCount × 300)) × 100 : 0`. Can exceed 100% if members use more than their included 300 each. | ✅ Resolved |
| 11 | Does the department detail need daily usage per member (like teams)? | No. The department detail shows a usage bar chart (total per member) and a member table — no daily line chart. The API does not return `dailyUsagePerMember`. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Department Usage APIs

#### Task 1.1 — [CREATE] `GET /api/usage/departments` API route

**Description**: Create an API route that returns all departments with aggregated usage metrics for a given month/year. The query joins `department` with `copilot_seat` (via `departmentId`) and `copilot_usage` to compute per-department totals. The response includes `usagePercent` (department's % of its included premium-request allowance) and `averageRequestsPerMember`. Results are ordered by `usagePercent` ASC (least usage first) to match the chart ordering.

Query strategy (single query with CTEs):
```sql
WITH department_seats AS (
  SELECT cs."departmentId", cs.id AS "seatId"
  FROM copilot_seat cs
  WHERE cs."departmentId" IS NOT NULL
),
seat_usage AS (
  SELECT
    ds."departmentId",
    ds."seatId",
    COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS requests,
    COALESCE(SUM((item->>'grossAmount')::numeric), 0) AS "grossAmount"
  FROM department_seats ds
  LEFT JOIN copilot_usage cu
    ON cu."seatId" = ds."seatId" AND cu.month = $1 AND cu.year = $2
  LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
  GROUP BY ds."departmentId", ds."seatId"
),
dept_aggregates AS (
  SELECT
    su."departmentId",
    COUNT(DISTINCT su."seatId") AS "memberCount",
    COALESCE(SUM(su.requests), 0) AS "totalRequests",
    COALESCE(SUM(su."grossAmount"), 0) AS "totalGrossAmount"
  FROM seat_usage su
  GROUP BY su."departmentId"
)
SELECT
  d.id AS "departmentId",
  d.name AS "departmentName",
  COALESCE(da."memberCount", 0)::int AS "memberCount",
  COALESCE(da."totalRequests", 0) AS "totalRequests",
  COALESCE(da."totalGrossAmount", 0) AS "totalGrossAmount"
FROM department d
LEFT JOIN dept_aggregates da ON da."departmentId" = d.id
ORDER BY
  CASE WHEN COALESCE(da."memberCount", 0) = 0 THEN 0
       ELSE COALESCE(da."totalRequests", 0) / (COALESCE(da."memberCount", 0) * 300)
  END ASC
```

Post-query computation (TypeScript):
```typescript
const usagePercent = memberCount > 0
  ? (totalRequests / (memberCount * PREMIUM_REQUESTS_PER_SEAT)) * 100
  : 0;
const averageRequestsPerMember = memberCount > 0 ? totalRequests / memberCount : 0;
```

Key differences from the Team list API:
- Joins `copilot_seat.departmentId` directly instead of `team_member_snapshot`
- No month/year filter on the seat-department relationship (current assignment applies to all months)
- LEFT JOIN ensures departments with no assigned seats still appear with zero metrics
- Returns `usagePercent` instead of `averageGrossAmountPerMember`
- Ordered by `usagePercent` ASC (lowest → highest) to match chart display

File: `src/app/api/usage/departments/route.ts`

**Definition of Done**:
- [ ] Route file created at `src/app/api/usage/departments/route.ts`
- [ ] Accepts query params: `month` (1-12), `year` (≥2020)
- [ ] Returns 401 when not authenticated (uses `requireAuth`)
- [ ] Invalid/missing `month`/`year` defaults to current month/year
- [ ] Response shape: `{ departments: [...], total, month, year }`
- [ ] Each department entry includes: `departmentId`, `departmentName`, `memberCount`, `totalRequests`, `totalGrossAmount`, `averageRequestsPerMember`, `usagePercent`
- [ ] `usagePercent` computed as `(totalRequests / (memberCount × 300)) × 100`; 0 when memberCount is 0
- [ ] Departments with no assigned seats return zero metrics (not errors)
- [ ] All departments are returned (no pagination) ordered by `usagePercent` ASC
- [ ] Empty result (no departments exist) returns `{ departments: [], total: 0, month, year }`
- [ ] Returns 500 with `{ error: "Internal server error" }` on unexpected errors

#### Task 1.2 — [CREATE] `GET /api/usage/departments/[departmentId]` API route

**Description**: Create an API route that returns detailed usage for a single department, including per-member usage breakdown (no daily data — the department detail uses a member bar chart, not a daily line chart). The query fetches the department entity, its assigned seats (via `copilot_seat.departmentId`), and each member's aggregated usage.

Query strategy:
1. Validate `departmentId` parameter (integer ≥ 1)
2. Look up department by ID — return 404 if not found
3. Fetch seats from `copilot_seat` WHERE `departmentId` matches
4. For each seat, aggregate `copilot_usage` data (total requests, gross amount)
5. Compute department-level summary (total, averages, usagePercent)
6. Order members by `totalRequests` DESC

Per-member usage query:
```sql
SELECT
  cs.id AS "seatId",
  cs."githubUsername",
  cs."firstName",
  cs."lastName",
  COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS "totalRequests",
  COALESCE(SUM((item->>'grossAmount')::numeric), 0) AS "totalGrossAmount"
FROM copilot_seat cs
LEFT JOIN copilot_usage cu
  ON cu."seatId" = cs.id AND cu.month = $2 AND cu.year = $3
LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
WHERE cs."departmentId" = $1
GROUP BY cs.id, cs."githubUsername", cs."firstName", cs."lastName"
ORDER BY COALESCE(SUM((item->>'grossQuantity')::numeric), 0) DESC
```

File: `src/app/api/usage/departments/[departmentId]/route.ts`

**Definition of Done**:
- [ ] Route file created at `src/app/api/usage/departments/[departmentId]/route.ts`
- [ ] Accepts path param `departmentId` and query params: `month` (1-12), `year` (≥2020)
- [ ] Returns 401 when not authenticated (uses `requireAuth`)
- [ ] Returns 400 for invalid `departmentId` (non-integer, < 1)
- [ ] Returns 404 when department not found (`{ error: "Department not found" }`)
- [ ] Invalid/missing `month`/`year` defaults to current month/year
- [ ] Response shape: `{ department: {...}, members: [...], month, year }`
- [ ] Department object includes: `departmentId`, `departmentName`, `memberCount`, `totalRequests`, `totalGrossAmount`, `averageRequestsPerMember`, `usagePercent`
- [ ] Each member entry includes: `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `totalGrossAmount`
- [ ] Members ordered by `totalRequests` DESC
- [ ] Department with no assigned seats returns `members: []` with zero aggregates
- [ ] Returns 500 with `{ error: "Internal server error" }` on unexpected errors

#### Task 1.3 — [CREATE] Integration tests for `GET /api/usage/departments`

**Description**: Write integration tests following the established pattern from `src/app/api/usage/teams/__tests__/route.test.ts`. Use `getTestDataSource`, `cleanDatabase`, mock `@/lib/db` and `next/headers`. Seed `department`, `copilot_seat` (with `departmentId`), and `copilot_usage` records.

File: `src/app/api/usage/departments/__tests__/route.test.ts`

**Definition of Done**:
- [ ] Test file created at `src/app/api/usage/departments/__tests__/route.test.ts`
- [ ] Test: returns 401 without session
- [ ] Test: returns empty list when no departments exist
- [ ] Test: returns departments with aggregated usage metrics including `usagePercent`
- [ ] Test: `usagePercent` is correctly computed as `(totalRequests / (memberCount × 300)) × 100`
- [ ] Test: department with no assigned seats returns zero metrics and `usagePercent: 0`
- [ ] Test: department with assigned seats but no usage data for the month returns zero totals with correct member count
- [ ] Test: average per member calculated correctly (total / memberCount)
- [ ] Test: defaults to current month/year when params are missing
- [ ] Test: departments ordered by `usagePercent` ASC (lowest first)
- [ ] All tests pass with `npm run test`

#### Task 1.4 — [CREATE] Integration tests for `GET /api/usage/departments/[departmentId]`

**Description**: Write integration tests for the department detail endpoint. Follow the same established pattern. Test scenarios including valid department with members, department with no members, non-existent department, and invalid department ID.

File: `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts`

**Definition of Done**:
- [ ] Test file created at `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts`
- [ ] Test: returns 401 without session
- [ ] Test: returns 400 for invalid departmentId
- [ ] Test: returns 404 for non-existent department
- [ ] Test: returns department detail with per-member usage breakdown
- [ ] Test: department response includes `usagePercent`
- [ ] Test: members are ordered by totalRequests DESC
- [ ] Test: department with no assigned seats returns empty members array and zero aggregates
- [ ] Test: department with assigned seats but no usage data returns members with zero totals
- [ ] Test: defaults to current month/year when params are missing
- [ ] All tests pass with `npm run test`

### Phase 2: Frontend — Department Usage Tab (Overview)

#### Task 2.1 — [CREATE] `DepartmentUsageChart` horizontal bar chart

**Description**: A horizontal bar chart (recharts `BarChart` with `layout="vertical"`) that visualises each department's usage % of its included premium request allowance. Departments are ordered from least to highest usage (matching the API order). A `ReferenceLine` at 100% marks the boundary between included and paid usage. Bar colour reflects usage level — same thresholds as team member colours (red ≤ 50%, orange 51–99%, green ≥ 100%).

File: `src/components/usage/DepartmentUsageChart.tsx`

**Definition of Done**:
- [ ] Component file created at `src/components/usage/DepartmentUsageChart.tsx`
- [ ] Uses recharts `BarChart` with `layout="vertical"`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`
- [ ] Y-axis: department names, X-axis: usage % value
- [ ] Departments ordered from least to highest usage (data comes pre-sorted from API)
- [ ] `ReferenceLine` at `x={100}` with label "100% included" (dashed stroke)
- [ ] Bar colour per department: red (`#ef4444`) for 0–50%, orange (`#f97316`) for 51–99%, green (`#22c55e`) for 100%+ — using a custom `Cell` fill based on `usagePercent`
- [ ] Tooltip shows department name and exact usage %
- [ ] Chart height scales with number of departments (min 200px, ~40px per department)
- [ ] Wrapped in `ResponsiveContainer`
- [ ] Accessible via `role="img"` and descriptive `aria-label`
- [ ] Handles edge case: no departments → does not render (parent handles empty state)

#### Task 2.2 — [CREATE] `DepartmentUsageTable` presentational component

**Description**: A summary table below the chart. Each row shows department name (clickable link to drill-down), average requests per member, and usage %. The department name column links to the department detail page. The table is ordered by `usagePercent` ASC (matching the chart order).

File: `src/components/usage/DepartmentUsageTable.tsx`

**Definition of Done**:
- [ ] Component file created at `src/components/usage/DepartmentUsageTable.tsx`
- [ ] Table columns: Department Name (link), Avg Requests/Member, Usage %
- [ ] Department Name is a clickable link to `/usage/departments/[departmentId]?month=M&year=Y`
- [ ] Avg Requests/Member formatted to 1 decimal place with `toLocaleString()`
- [ ] Usage % formatted as integer with `%` suffix (e.g., "85%", "120%")
- [ ] Departments with zero members show "0" for avg requests and "0%" for usage
- [ ] Table follows existing styling conventions (border, bg-white, shadow-sm, text-sm, hover:bg-gray-50 cursor-pointer)
- [ ] Proper `<thead>` and `<tbody>` semantics

#### Task 2.3 — [CREATE] `DepartmentUsagePanel` data-fetching component

**Description**: Client component that fetches department usage data from `GET /api/usage/departments` and renders the `DepartmentUsageChart` on top followed by `DepartmentUsageTable` below. Manages loading, error, and empty states. Follows the pattern of `TeamUsagePanel`.

File: `src/components/usage/DepartmentUsagePanel.tsx`

**Definition of Done**:
- [ ] Component file created at `src/components/usage/DepartmentUsagePanel.tsx`
- [ ] Fetches data from `/api/usage/departments?month=M&year=Y`
- [ ] Displays loading state: "Loading department usage data…" (matches dashboard pattern)
- [ ] Displays error state with red alert box on fetch failure
- [ ] Displays empty state when no departments exist: "No departments have been defined yet. Create departments in Settings to see aggregated usage."
- [ ] Renders `DepartmentUsageChart` above `DepartmentUsageTable` when data is available
- [ ] Passes department data, month, and year to both child components
- [ ] Re-fetches data when `month` or `year` changes
- [ ] Cancelled fetch requests on unmount/re-render (matches existing pattern)

#### Task 2.4 — [MODIFY] Replace Department tab placeholder in `UsagePageLayout`

**Description**: Replace the placeholder content in the Department tab section of `UsagePageLayout` with the new `DepartmentUsagePanel` component. Pass `selectedMonth` and `selectedYear` as props.

File: `src/components/usage/UsagePageLayout.tsx`

**Definition of Done**:
- [ ] Import `DepartmentUsagePanel` added to `UsagePageLayout.tsx`
- [ ] Department tab renders `<DepartmentUsagePanel month={selectedMonth} year={selectedYear} />` instead of placeholder text
- [ ] Tab panel retains `role="tabpanel"`, `id="tabpanel-department"`, `aria-labelledby="tab-department"` attributes
- [ ] Switching to Department tab and changing the month filter updates the department data

### Phase 3: Frontend — Department Detail Drill-Down

#### Task 3.1 — [CREATE] Department detail page

**Description**: Create the `/usage/departments/[departmentId]` route page. Server component that parses params and renders `DepartmentDetailPanel`. Follows the pattern from `src/app/(app)/usage/teams/[teamId]/page.tsx`.

File: `src/app/(app)/usage/departments/[departmentId]/page.tsx`

**Definition of Done**:
- [ ] Page file created at `src/app/(app)/usage/departments/[departmentId]/page.tsx`
- [ ] Page has metadata with title "Department Usage — Copilot Dashboard"
- [ ] Uses `force-dynamic` export
- [ ] Parses `departmentId` from route params, `month`/`year` from search params
- [ ] Passes parsed values to `DepartmentDetailPanel`
- [ ] Follows same structure as team detail page

#### Task 3.2 — [CREATE] `DepartmentMemberChart` horizontal bar chart

**Description**: A horizontal bar chart (recharts `BarChart` with `layout="vertical"`) showing each department member's total premium requests for the month. Bar length represents usage relative to the 300 included requests per seat. A `ReferenceLine` at 300 marks the included boundary. Members are ordered from least to highest usage. Bar colour uses the same thresholds as `TeamMemberTable` colour indicators (red ≤ 50%, orange 51–99%, green ≥ 100% of 300).

File: `src/components/usage/DepartmentMemberChart.tsx`

**Definition of Done**:
- [ ] Component file created at `src/components/usage/DepartmentMemberChart.tsx`
- [ ] Uses recharts `BarChart` with `layout="vertical"`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`, `Cell`
- [ ] Y-axis: member GitHub usernames, X-axis: total requests
- [ ] Members ordered from least to highest usage (sorted client-side from API data which comes DESC)
- [ ] `ReferenceLine` at `x={300}` (`PREMIUM_REQUESTS_PER_SEAT`) with label "300 included" (dashed stroke)
- [ ] Bar colour per member: red (`#ef4444`) for 0–50% of 300, orange (`#f97316`) for 51–99%, green (`#22c55e`) for 100%+ — using a custom `Cell` fill
- [ ] Tooltip shows username and exact total requests
- [ ] Chart height scales with number of members (min 200px, ~40px per member)
- [ ] Wrapped in `ResponsiveContainer`
- [ ] Accessible via `role="img"` and descriptive `aria-label`
- [ ] Uses `PREMIUM_REQUESTS_PER_SEAT` constant from `src/lib/constants.ts` (not hardcoded 300)
- [ ] Handles edge case: no members → does not render (parent handles empty state)

#### Task 3.3 — [CREATE] `DepartmentDetailPanel` data-fetching component

**Description**: Client component that fetches department detail data from `GET /api/usage/departments/[departmentId]` and renders the department header, member bar chart, and member table. Includes a back link to `/usage` and a `MonthFilter`. Follows the layout pattern from `TeamDetailPanel` but with different chart content.

Reuses existing component:
- `TeamMemberTable` — for the member table with usage % and colour indicators (interface is fully generic)

Layout order (top to bottom):
1. Back link + Header (department name, member count) + MonthFilter
2. Member usage bar chart (`DepartmentMemberChart`) — one bar per member, relative to 300
3. Member table (`TeamMemberTable`) — with username, colour dot, usage (# / 300 (%)), gross spending

File: `src/components/usage/DepartmentDetailPanel.tsx`

**Definition of Done**:
- [ ] Component file created at `src/components/usage/DepartmentDetailPanel.tsx`
- [ ] Displays "← Back to Usage" link to `/usage`
- [ ] Fetches department detail from `/api/usage/departments/[departmentId]?month=M&year=Y`
- [ ] Shows `MonthFilter` for switching months (fetches available months from `/api/dashboard/months`)
- [ ] Displays header with department name and member count
- [ ] Renders `DepartmentMemberChart` above the member table with per-member usage data
- [ ] Renders `TeamMemberTable` with per-member usage data below the chart
- [ ] Shows loading state, error state, and 404 state
- [ ] Empty members state: "This department has no assigned seats."
- [ ] Re-fetches data when month/year changes
- [ ] Cancelled fetch requests on unmount/re-render

### Phase 4: E2E Tests

#### Task 4.1 — [CREATE] E2E tests for Department Usage tab and drill-down

**Description**: Write Playwright E2E tests for the Department tab (chart + table) and department detail drill-down (member chart + member table). Follow the established pattern from `e2e/team-usage.spec.ts`. Seed `department`, `copilot_seat` (with `departmentId`), and `copilot_usage` data via direct `pg.Client` queries.

File: `e2e/department-usage.spec.ts`

**Definition of Done**:
- [ ] Test file created at `e2e/department-usage.spec.ts`
- [ ] Test: Department tab shows department usage chart and table
- [ ] Test: departments are ordered from lowest to highest usage % in both chart and table
- [ ] Test: department table shows department name, avg requests/member, and usage %
- [ ] Test: informative message shown when no departments have been defined
- [ ] Test: departments with no assigned seats display 0% usage (not errors)
- [ ] Test: clicking a department name in the table navigates to department detail page
- [ ] Test: department detail page shows department name and member count
- [ ] Test: department detail page shows member usage bar chart
- [ ] Test: department detail page shows member table with usage as % and number (e.g., "150 / 300 (50%)")
- [ ] Test: department member colour indicators are correct (red for low, orange for moderate, green for high usage)
- [ ] Test: month filter works on department detail page
- [ ] Test: back link navigates back to `/usage`
- [ ] All E2E tests pass with `npm run test:e2e`

#### Task 4.2 — [MODIFY] Update existing E2E test for Department tab placeholder

**Description**: The existing E2E test in `e2e/seat-usage.spec.ts` (`"Team tab shows content and Department tab shows placeholder"`) asserts that the Department tab shows placeholder content ("Department usage analytics will be available in a future update"). This assertion must be updated since the Department tab now renders actual content.

File: `e2e/seat-usage.spec.ts`

**Definition of Done**:
- [ ] The test "Team tab shows content and Department tab shows placeholder" in `e2e/seat-usage.spec.ts` is updated
- [ ] Department-specific placeholder assertion is removed or replaced with assertion that Department tab renders the departments panel (e.g., loading state or "No departments have been defined" message)
- [ ] Test name is updated to reflect both tabs render content (e.g., "Team and Department tabs show content")
- [ ] Existing E2E tests still pass with `npm run test:e2e`

### Phase 5: Code Review

#### Task 5.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Full code review of all changes in Phases 1–4 by the `tsh-code-reviewer` agent. Verify code quality, security, test coverage, accessibility, and adherence to established project patterns.

**Definition of Done**:
- [ ] All new files reviewed for adherence to project patterns and conventions
- [ ] SQL queries reviewed for performance (proper use of indexes, CTE approach, no N+1 queries)
- [ ] LEFT JOIN strategy validated — departments with no assigned seats must appear with zero metrics
- [ ] `usagePercent` computation reviewed — division by zero guarded when memberCount is 0
- [ ] Usage % ordering verified — API returns ASC, chart renders accordingly
- [ ] Bar colour logic reviewed — matches team member colour thresholds (red ≤ 50%, orange 51–99%, green ≥ 100%)
- [ ] API input validation reviewed (query param sanitization, departmentId validation)
- [ ] Authentication enforcement verified on all new endpoints
- [ ] Accessibility review passed (tab panel roles maintained, table semantics, chart aria-labels)
- [ ] Reuse of `TeamMemberTable` confirmed appropriate for department detail member table
- [ ] Both charts reviewed for responsive sizing, reference lines, and tooltip formatting
- [ ] Test coverage assessed — all acceptance criteria have corresponding tests
- [ ] No code duplication introduced (reuse of MonthFilter, auth helpers, test patterns, colour constants confirmed)

## Security Considerations

- **Authentication enforcement**: Both `GET /api/usage/departments` and `GET /api/usage/departments/[departmentId]` must use `requireAuth()`. Unauthenticated requests receive 401.
- **Input validation**: `departmentId` path parameter is validated as a positive integer. Query parameters (`month`, `year`) are parsed with strict range checks. Invalid values fall back to safe defaults. All queries use parameterised statements — no SQL injection vectors.
- **No sensitive data exposure**: The API returns department names, member counts, usernames, names, and usage metrics. No passwords, tokens, or internal implementation details are exposed.
- **Path traversal protection**: The `departmentId` parameter is parsed as an integer before use in queries, preventing path traversal or injection attacks.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Department tab shows a horizontal bar chart of department usage % ordered from least to highest
- [ ] Department tab shows a summary table below the chart with department name, avg requests/member, and usage %
- [ ] Chart bar colours reflect usage level (red ≤ 50%, orange 51–99%, green ≥ 100%)
- [ ] Chart has a reference line at 100% marking the included allowance boundary
- [ ] Clicking a department name in the table navigates to the department detail page
- [ ] Department detail shows a member bar chart with each member's usage relative to 300 included requests
- [ ] Member chart has a reference line at 300 marking the included allowance
- [ ] Department detail shows a member table with username, colour indicator, usage (# / 300 (%)), and gross spending (reusing `TeamMemberTable`)
- [ ] Colour indicator (red/orange/green) displayed next to each member's username based on usage %
- [ ] Month filter allows switching between months on both overview and detail views
- [ ] An informative message is shown when no departments have been defined
- [ ] Departments with no assigned seats display 0% usage, not an error
- [ ] Integration tests pass for both API endpoints (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Existing seat-usage E2E tests still pass after placeholder update
- [ ] No TypeScript compilation errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Rename `TeamMemberTable` → `MemberUsageTable`**: The component is generic but named for teams. Rename and parameterise the `aria-label` to improve clarity for both team and department usage contexts.
- **Shared colour-threshold utility**: The bar colour logic (red/orange/green at 50%/100% thresholds) will be duplicated across `DepartmentUsageChart`, `DepartmentMemberChart`, and `TeamMemberTable`. Extract to `src/lib/usage-colours.ts`.
- **Shared `formatCurrency` utility**: `formatCurrency` is duplicated across multiple components. Extract to `src/lib/formatters.ts`.
- **Sorting**: Allow sorting department table by different columns (name, avg requests, usage %). Currently fixed to `usagePercent` ASC.
- **Department list pagination**: If the number of departments grows large, add pagination. Currently returns all departments.
- **CSV export**: Export department usage data for a given month.
- **Trend comparison**: Show month-over-month trend for department metrics (e.g., sparklines in the table).
- **Department member detail link**: From department detail, clicking a member row could navigate to the individual seat detail page (`/usage/seats/[seatId]?month=M&year=Y`).
- **Model breakdown per department**: Show which AI models the department uses most. Currently only totals are shown.
- **Historical department tracking**: Currently, department membership is based on the current `copilot_seat.departmentId` assignment. If historical accuracy is needed (a seat moved departments), a snapshot mechanism (similar to `team_member_snapshot`) would be required.
- **Configurable premium requests baseline**: The 300 premium requests per seat is a constant. If this varies by plan type, make it configurable via application settings.
- **Daily usage per member**: Add a daily line chart (like the team detail) as an expandable section on the department detail page for users who want day-level granularity.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Updated: Redesigned department panel with chart-first layout. Department overview now shows a horizontal bar chart of department usage % (ordered least → highest) plus a summary table (dept name, avg requests/member, usage %). Department detail now shows a member usage bar chart (per-member requests relative to 300 included) plus member table (reusing TeamMemberTable). Removed daily line chart and summary cards from detail view. Added DepartmentUsageChart and DepartmentMemberChart components. API response now includes `usagePercent` and removes `dailyUsagePerMember`. |
