# Story 6.2 — Per-Team Usage for a Specific Month — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 6.2 |
| Title | User can view per-team usage for a specific month |
| Description | Implement the Team tab in the Usage Analytics section. The tab shows teams with aggregated usage metrics (total usage, average per member, cost) for a selected month. Users can drill into a team to see individual member usage with a multi-line daily chart and a member table showing usage as % and number relative to 300 included premium requests, with per-member colour indicators. Handles empty states for no teams defined and teams with no members. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Epic 6 / Story 6.2), [story-6-1.plan.md](./story-6-1.plan.md) |

## Proposed Solution

Replace the placeholder content in the Team tab of the existing `/usage` page with a fully functional team usage analytics panel. This includes two new API endpoints, two frontend panels (list + drill-down), and a new page route for team detail.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      /usage (page)                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Seat]  [Team*]  [Department]  ← tabs             │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  TeamUsagePanel                                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Table: team name | members | total requests │  │  │
│  │  │  avg/member | total spending                 │  │  │
│  │  │  → click row → /usage/teams/[teamId]         │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              /usage/teams/[teamId] (detail)               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ← Back to Usage   │  MonthFilter                 │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Team: "Frontend Team" — 5 members                 │  │
│  │  Total Requests: 1,250 | Avg/Member: 250           │  │
│  │  Total Spending: $50.00                            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Daily Usage Chart (multi-line, one line/member)   │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  LineChart (recharts)                        │  │  │
│  │  │  X: day of month, Y: requests               │  │  │
│  │  │  Each member = a coloured line + legend      │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Members table:                                    │  │
│  │  🟢/🟠/🔴 username | name | usage (% & #/300) |  │  │
│  │  gross spending                                    │  │
│  │                                                    │  │
│  │  Colour indicator rules:                           │  │
│  │   0-50% of 300  → 🔴 red                          │  │
│  │  51-99% of 300  → 🟠 orange                       │  │
│  │  100%+ of 300   → 🟢 green                        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Team list**: `TeamUsagePanel` fetches `GET /api/usage/teams?month=M&year=Y` → API queries `team` joined with `team_member_snapshot` and `copilot_usage` to aggregate per-team metrics → renders `TeamUsageTable`
2. **Drill-down**: Clicking a team row navigates to `/usage/teams/[teamId]?month=M&year=Y` → `TeamDetailPanel` fetches `GET /api/usage/teams/[teamId]?month=M&year=Y` → API returns team info + per-member usage + daily usage per member → renders summary cards + multi-line daily chart (one line per member) + member table with usage as % of 300 and colour indicator

### API Contracts

**Teams List:**

```
GET /api/usage/teams?month=2&year=2026

Response 200:
{
  "teams": [
    {
      "teamId": 1,
      "teamName": "Frontend Team",
      "memberCount": 5,
      "totalRequests": 1250.5,
      "totalGrossAmount": 50.02,
      "averageRequestsPerMember": 250.1,
      "averageGrossAmountPerMember": 10.004
    }
  ],
  "total": 3,
  "month": 2,
  "year": 2026
}
```

**Team Detail:**

```
GET /api/usage/teams/1?month=2&year=2026

Response 200:
{
  "team": {
    "teamId": 1,
    "teamName": "Frontend Team",
    "memberCount": 5,
    "totalRequests": 1250.5,
    "totalGrossAmount": 50.02,
    "averageRequestsPerMember": 250.1,
    "averageGrossAmountPerMember": 10.004
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
  "dailyUsagePerMember": [
    {
      "seatId": 1,
      "githubUsername": "alice-dev",
      "days": [
        { "day": 1, "totalRequests": 25.5 },
        { "day": 2, "totalRequests": 18.0 }
      ]
    }
  ],
  "month": 2,
  "year": 2026
}
```

### Premium Requests Baseline Constant

The included premium requests per seat per month is **300**. This is used to compute usage percentage for each team member:
- `usagePercent = (totalRequests / 300) * 100`
- Colour indicator: **red** (0–50%), **orange** (51–99%), **green** (100%+)

This constant (`PREMIUM_REQUESTS_PER_SEAT = 300`) will be added to `src/lib/constants.ts`.

### Assumed Team Data Model (Prerequisite — Epic 7)

This plan assumes the following tables exist from Epic 7 stories (7.1, 7.2, 7.4):

```sql
-- team table (Story 7.1)
CREATE TABLE team (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- team_member_snapshot table (Stories 7.2, 7.4)
-- Tracks team composition per month for historical accuracy
CREATE TABLE team_member_snapshot (
    id SERIAL PRIMARY KEY,
    "teamId" INT NOT NULL REFERENCES team(id),
    "seatId" INT NOT NULL REFERENCES copilot_seat(id),
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "UQ_team_member_snapshot" UNIQUE ("teamId", "seatId", month, year)
);

CREATE INDEX "IDX_team_member_snapshot_team_month" ON team_member_snapshot("teamId", month, year);
CREATE INDEX "IDX_team_member_snapshot_seat" ON team_member_snapshot("seatId");
```

The entities `TeamEntity` and `TeamMemberSnapshotEntity` are assumed to exist in `src/entities/` and be registered in `data-source.ts` and `db-helpers.ts`.

## Current Implementation Analysis

### Already Implemented
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — three-tab layout with Seat/Team/Department tabs; Team tab currently renders placeholder
- `SeatUsagePanel` / `SeatUsageTable` / `Pagination` — `src/components/usage/` — pattern to follow for TeamUsagePanel
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — pattern to follow for TeamDetailPanel (back link, month filter, summary, chart, table)
- `SeatDailyChart` — `src/components/usage/SeatDailyChart.tsx` — recharts bar chart pattern to adapt for multi-line `TeamDailyChart` (uses `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`)
- `recharts` — `package.json` dependency — already available, supports `LineChart`, `Line`, `Legend` needed for multi-member daily chart
- `GET /api/usage/seats` — `src/app/api/usage/seats/route.ts` — reference for aggregation SQL with CTEs, parameterised queries, pagination pattern
- `GET /api/usage/seats/[seatId]` — `src/app/api/usage/seats/[seatId]/route.ts` — reference for drill-down API pattern (route context, param parsing, 404 handling)
- `/usage/seats/[seatId]` page — `src/app/(app)/usage/seats/[seatId]/page.tsx` — reference for drill-down page pattern (params + searchParams)
- `MonthFilter` — `src/components/dashboard/MonthFilter.tsx` — reusable month picker
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — authentication middleware
- `getDb()` — `src/lib/db.ts` — database connection helper
- `MONTH_NAMES` — `src/lib/constants.ts` — month name array
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`
- E2E auth helpers — `e2e/helpers/auth.ts` — `seedTestUser`, `loginViaApi`
- E2E seeding pattern — `e2e/seat-usage.spec.ts` — direct `pg.Client` queries for test data seeding

### To Be Modified
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — replace Team tab placeholder with `TeamUsagePanel` component
- `MONTH_NAMES` / `constants.ts` — `src/lib/constants.ts` — add `PREMIUM_REQUESTS_PER_SEAT = 300` constant
- `e2e/seat-usage.spec.ts` — update E2E test that asserts "Team usage analytics will be available in a future update" placeholder text (it will no longer appear)

### To Be Created
- `GET /api/usage/teams` — API route for aggregated per-team usage
- `GET /api/usage/teams/[teamId]` — API route for team detail with per-member usage
- `src/components/usage/TeamUsagePanel.tsx` — data-fetching container for team list
- `src/components/usage/TeamUsageTable.tsx` — presentational table for teams
- `src/components/usage/TeamDetailPanel.tsx` — data-fetching container for team drill-down
- `src/components/usage/TeamMemberTable.tsx` — presentational table for team members with usage %, colour indicator
- `src/components/usage/TeamDailyChart.tsx` — multi-line chart showing daily usage per team member
- `src/app/(app)/usage/teams/[teamId]/page.tsx` — team detail page
- `src/app/api/usage/teams/__tests__/route.test.ts` — integration tests for teams list API
- `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` — integration tests for team detail API
- `e2e/team-usage.spec.ts` — E2E tests for team usage analytics

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What is the assumed team data model from Epic 7? | `team` (id, name) + `team_member_snapshot` (teamId, seatId, month, year) with unique constraint. See "Assumed Team Data Model" section. | ✅ Resolved |
| 2 | Should the teams list be paginated? | No. Teams are organisational constructs and unlikely to exceed ~50 entries. The API returns all teams. Pagination can be added later if needed. | ✅ Resolved |
| 3 | How should the team drill-down work? | Navigates to `/usage/teams/[teamId]?month=M&year=Y` (same pattern as seat detail). Separate page with back link, month filter, and member table. | ✅ Resolved |
| 4 | What happens for teams with no members in a given month? | Show the team in the list with `memberCount: 0`, `totalRequests: 0`, `totalGrossAmount: 0`. Average per member shows as `0` (not division by zero error). | ✅ Resolved |
| 5 | What happens when no teams exist at all? | Show informative message: "No teams have been defined yet. Create teams in Team Management to see aggregated usage." | ✅ Resolved |
| 6 | Should the team detail show the same model breakdown as seat detail? | No. Keep it simple — show per-member totals (requests + spending). Model breakdown is available by navigating to the individual seat detail from the seat tab. | ✅ Resolved |
| 7 | How is usage percentage calculated for team members? | `usagePercent = (totalRequests / 300) * 100`. 300 is the number of included premium requests per seat per month in the Copilot license. | ✅ Resolved |
| 8 | What are the colour indicator thresholds for member usage? | 0–50% → red (low utilisation), 51–99% → orange (moderate), 100%+ → green (fully utilising included allowance). Rendered as a small coloured dot next to the username. | ✅ Resolved |
| 9 | What chart should appear on the team detail page? | A multi-line chart (recharts `LineChart`) with one line per team member, X-axis = day of month, Y-axis = total requests. Each line uses a distinct colour with a legend mapping username to colour. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Team Usage APIs

#### Task 1.1 — [CREATE] `GET /api/usage/teams` API route

**Description**: Create an API route that returns all teams with aggregated usage metrics for a given month/year. The query joins `team` with `team_member_snapshot` (for the selected month) and `copilot_usage` to compute per-team totals and averages.

Query strategy:
1. Fetch all teams with a LEFT JOIN to `team_member_snapshot` for the given month/year
2. For each team's members, aggregate their `copilot_usage` data using CTEs
3. Compute `memberCount`, `totalRequests`, `totalGrossAmount`, `averageRequestsPerMember`, `averageGrossAmountPerMember`
4. Teams with no members for the month return zero metrics (LEFT JOIN ensures they still appear)
5. Order by `teamName` ASC

SQL approach (single query with CTEs):
```sql
WITH team_members AS (
  SELECT tms."teamId", tms."seatId"
  FROM team_member_snapshot tms
  WHERE tms.month = $1 AND tms.year = $2
),
member_usage AS (
  SELECT
    tm."teamId",
    tm."seatId",
    COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS requests,
    COALESCE(SUM((item->>'grossAmount')::numeric), 0) AS "grossAmount"
  FROM team_members tm
  LEFT JOIN copilot_usage cu
    ON cu."seatId" = tm."seatId" AND cu.month = $1 AND cu.year = $2
  LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
  GROUP BY tm."teamId", tm."seatId"
),
team_aggregates AS (
  SELECT
    mu."teamId",
    COUNT(DISTINCT mu."seatId") AS "memberCount",
    COALESCE(SUM(mu.requests), 0) AS "totalRequests",
    COALESCE(SUM(mu."grossAmount"), 0) AS "totalGrossAmount"
  FROM member_usage mu
  GROUP BY mu."teamId"
)
SELECT
  t.id AS "teamId",
  t.name AS "teamName",
  COALESCE(ta."memberCount", 0)::int AS "memberCount",
  COALESCE(ta."totalRequests", 0) AS "totalRequests",
  COALESCE(ta."totalGrossAmount", 0) AS "totalGrossAmount"
FROM team t
LEFT JOIN team_aggregates ta ON ta."teamId" = t.id
ORDER BY t.name ASC
```

File: `src/app/api/usage/teams/route.ts`

**Definition of Done**:
- [x] Route file created at `src/app/api/usage/teams/route.ts`
- [x] Accepts query params: `month` (1-12), `year` (≥2020)
- [x] Returns 401 when not authenticated (uses `requireAuth`)
- [x] Invalid/missing `month`/`year` defaults to current month/year
- [x] Response shape: `{ teams: [...], total, month, year }`
- [x] Each team entry includes: `teamId`, `teamName`, `memberCount`, `totalRequests`, `totalGrossAmount`, `averageRequestsPerMember`, `averageGrossAmountPerMember`
- [x] Teams with no members for the month return zero metrics (not errors)
- [x] Average per member = 0 when `memberCount` is 0 (no division by zero)
- [x] All teams are returned (no pagination) ordered by `teamName` ASC
- [x] Empty result (no teams exist) returns `{ teams: [], total: 0, month, year }`
- [x] Returns 500 with `{ error: "Internal server error" }` on unexpected errors

#### Task 1.2 — [CREATE] `GET /api/usage/teams/[teamId]` API route

**Description**: Create an API route that returns detailed usage for a single team, including per-member usage breakdown. The query fetches the team entity, its member snapshot for the given month, and each member's aggregated usage.

Query strategy:
1. Validate `teamId` parameter (integer ≥ 1)
2. Look up team by ID — return 404 if not found
3. Fetch team members from `team_member_snapshot` for the month/year
4. For each member, aggregate `copilot_usage` data (total requests, gross amount)
5. Compute team-level summary (total, averages)
6. Order members by `totalRequests` DESC
7. Fetch daily usage per member (day-level aggregation) for the chart

Daily usage query strategy (additional CTE or separate query):
```sql
SELECT
  tms."seatId",
  cs."githubUsername",
  cu."day",
  COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS "totalRequests"
FROM team_member_snapshot tms
JOIN copilot_seat cs ON cs.id = tms."seatId"
LEFT JOIN copilot_usage cu
  ON cu."seatId" = tms."seatId" AND cu.month = $2 AND cu.year = $3
LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
WHERE tms."teamId" = $1 AND tms.month = $2 AND tms.year = $3
GROUP BY tms."seatId", cs."githubUsername", cu."day"
ORDER BY tms."seatId", cu."day"
```

File: `src/app/api/usage/teams/[teamId]/route.ts`

**Definition of Done**:
- [x] Route file created at `src/app/api/usage/teams/[teamId]/route.ts`
- [x] Accepts path param `teamId` and query params: `month` (1-12), `year` (≥2020)
- [x] Returns 401 when not authenticated (uses `requireAuth`)
- [x] Returns 400 for invalid `teamId` (non-integer, < 1)
- [x] Returns 404 when team not found (`{ error: "Team not found" }`)
- [x] Invalid/missing `month`/`year` defaults to current month/year
- [x] Response shape: `{ team: {...}, members: [...], dailyUsagePerMember: [...], month, year }`
- [x] Team object includes: `teamId`, `teamName`, `memberCount`, `totalRequests`, `totalGrossAmount`, `averageRequestsPerMember`, `averageGrossAmountPerMember`
- [x] Each member entry includes: `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `totalGrossAmount`
- [x] `dailyUsagePerMember` is an array of `{ seatId, githubUsername, days: [{ day, totalRequests }] }` — one entry per member with daily breakdown
- [x] Members ordered by `totalRequests` DESC
- [x] Team with no members for the month returns `members: []`, `dailyUsagePerMember: []` with zero aggregates
- [x] Returns 500 with `{ error: "Internal server error" }` on unexpected errors

#### Task 1.3 — [CREATE] Integration tests for `GET /api/usage/teams`

**Description**: Write integration tests following the established pattern from `src/app/api/usage/seats/__tests__/route.test.ts`. Use `getTestDataSource`, `cleanDatabase`, mock `@/lib/db` and `next/headers`. Seed `team`, `team_member_snapshot`, `copilot_seat`, and `copilot_usage` records.

File: `src/app/api/usage/teams/__tests__/route.test.ts`

**Definition of Done**:
- [x] Test file created at `src/app/api/usage/teams/__tests__/route.test.ts`
- [x] Test: returns 401 without session
- [x] Test: returns empty list when no teams exist
- [x] Test: returns teams with aggregated usage metrics
- [x] Test: team with no members for the month returns zero metrics
- [x] Test: team with members but no usage data returns zero totals with correct member count
- [x] Test: average per member calculated correctly (total / memberCount)
- [x] Test: defaults to current month/year when params are missing
- [x] Test: teams ordered by name ASC
- [x] All tests pass with `npm run test`

#### Task 1.4 — [CREATE] Integration tests for `GET /api/usage/teams/[teamId]`

**Description**: Write integration tests for the team detail endpoint. Follow the same established pattern. Test scenarios including valid team with members, team with no members, non-existent team, and invalid team ID.

File: `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts`

**Definition of Done**:
- [x] Test file created at `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts`
- [x] Test: returns 401 without session
- [x] Test: returns 400 for invalid teamId
- [x] Test: returns 404 for non-existent team
- [x] Test: returns team detail with per-member usage breakdown
- [x] Test: members are ordered by totalRequests DESC
- [x] Test: team with no members returns empty members array and zero aggregates
- [x] Test: team with members but no usage data returns members with zero totals
- [x] Test: dailyUsagePerMember returned with daily breakdown per member
- [x] Test: dailyUsagePerMember is empty array when team has no members
- [x] Test: defaults to current month/year when params are missing
- [x] All tests pass with `npm run test`

### Phase 2: Frontend — Team Usage Tab

#### Task 2.1 — [CREATE] `TeamUsagePanel` data-fetching component

**Description**: Client component that fetches team usage data from `GET /api/usage/teams` and passes it to `TeamUsageTable`. Manages loading, error, and empty states. Follows the exact same pattern as `SeatUsagePanel`.

File: `src/components/usage/TeamUsagePanel.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/TeamUsagePanel.tsx`
- [x] Fetches data from `/api/usage/teams?month=M&year=Y`
- [x] Displays loading state: "Loading team usage data…" (matches dashboard pattern)
- [x] Displays error state with red alert box on fetch failure
- [x] Displays empty state when no teams exist: "No teams have been defined yet. Create teams in Team Management to see aggregated usage."
- [x] Passes team data to `TeamUsageTable` for rendering
- [x] Re-fetches data when `month` or `year` changes
- [x] Cancelled fetch requests on unmount/re-render (matches existing pattern)

#### Task 2.2 — [CREATE] `TeamUsageTable` presentational component

**Description**: Stateless table component that renders team usage rows. Each row shows team name, member count, total requests, average requests per member, total spending. Rows are clickable links to the team detail page.

File: `src/components/usage/TeamUsageTable.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/TeamUsageTable.tsx`
- [x] Table columns: Team Name, Members, Total Requests, Avg Requests/Member, Total Spending
- [x] Each row is a clickable link to `/usage/teams/[teamId]?month=M&year=Y`
- [x] Monetary values formatted with `$` prefix and 2 decimal places
- [x] Request values formatted with `toLocaleString()` for thousands separators
- [x] Average values formatted to 1 decimal place
- [x] Teams with zero members show "0" for all metrics (not errors)
- [x] Table follows existing styling conventions (border, bg-white, shadow-sm, text-sm, hover:bg-gray-50 cursor-pointer)
- [x] Proper `<thead>` and `<tbody>` semantics

#### Task 2.3 — [MODIFY] Replace Team tab placeholder in `UsagePageLayout`

**Description**: Replace the placeholder content in the Team tab section of `UsagePageLayout` with the new `TeamUsagePanel` component. Pass `selectedMonth` and `selectedYear` as props.

File: `src/components/usage/UsagePageLayout.tsx`

**Definition of Done**:
- [x] Import `TeamUsagePanel` added to `UsagePageLayout.tsx`
- [x] Team tab renders `<TeamUsagePanel month={selectedMonth} year={selectedYear} />` instead of placeholder text
- [x] Tab panel retains `role="tabpanel"`, `id="tabpanel-team"`, `aria-labelledby="tab-team"` attributes
- [x] Switching to Team tab and changing the month filter updates the team data

### Phase 3: Frontend — Team Detail Drill-Down

#### Task 3.1 — [CREATE] Team detail page

**Description**: Create the `/usage/teams/[teamId]` route page. Server component that parses params and renders `TeamDetailPanel`. Follows the pattern from `src/app/(app)/usage/seats/[seatId]/page.tsx`.

File: `src/app/(app)/usage/teams/[teamId]/page.tsx`

**Definition of Done**:
- [x] Page file created at `src/app/(app)/usage/teams/[teamId]/page.tsx`
- [x] Page has metadata with title "Team Usage — Copilot Dashboard"
- [x] Uses `force-dynamic` export
- [x] Parses `teamId` from route params, `month`/`year` from search params
- [x] Passes parsed values to `TeamDetailPanel`
- [x] Follows same structure as seat detail page

#### Task 3.2 — [CREATE] `TeamDetailPanel` data-fetching component

**Description**: Client component that fetches team detail data from `GET /api/usage/teams/[teamId]` and renders the team summary, daily usage chart, member table, and month filter. Includes a back link to `/usage`. Follows the pattern from `SeatDetailPanel`.

Layout order (top to bottom):
1. Back link + Header (team name, member count) + MonthFilter
2. Summary cards (total requests, avg/member, total spending)
3. Daily usage line chart (`TeamDailyChart`) — one line per member
4. Member table (`TeamMemberTable`) — with usage % of 300 and colour indicator

File: `src/components/usage/TeamDetailPanel.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/TeamDetailPanel.tsx`
- [x] Displays "← Back to Usage" link to `/usage`
- [x] Fetches team detail from `/api/usage/teams/[teamId]?month=M&year=Y`
- [x] Shows `MonthFilter` for switching months (fetches available months from `/api/dashboard/months`)
- [x] Displays team summary: team name, member count, total requests, average per member, total spending
- [x] Renders `TeamDailyChart` above the member table with `dailyUsagePerMember` data
- [x] Renders `TeamMemberTable` with per-member usage data below the chart
- [x] Shows loading state, error state, and 404 state
- [x] Empty members state: "This team has no members for {Month Year}."
- [x] Re-fetches data when month/year changes
- [x] Cancelled fetch requests on unmount/re-render

#### Task 3.3 — [CREATE] `TeamDailyChart` multi-line chart component

**Description**: A multi-line chart (using recharts `LineChart`) that visualises daily premium request usage for each team member across the month. Each member is a separate line with a distinct colour. Includes a legend mapping usernames to line colours. Follows the `SeatDailyChart` pattern but extends it to multiple data series.

File: `src/components/usage/TeamDailyChart.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/TeamDailyChart.tsx`
- [x] Uses recharts `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer`
- [x] X-axis: day of month (1 to daysInMonth), Y-axis: total requests
- [x] One `<Line>` per team member, each with a distinct stroke colour
- [x] Legend displays GitHub username for each line colour
- [x] Days with no usage for a member show as 0 (continuous line, no gaps)
- [x] Chart fills missing days with zero values (same approach as `SeatDailyChart`)
- [x] Tooltip shows day number and each member's requests for that day
- [x] Chart height: 300px (matches `SeatDailyChart`), wrapped in `ResponsiveContainer`
- [x] Wrapped in a card container with heading "Daily Usage by Member"
- [x] Accessible via `role="img"` and `aria-label`
- [x] Handles edge case: no daily usage data → chart renders with flat zero lines

#### Task 3.4 — [CREATE] `TeamMemberTable` presentational component

**Description**: Stateless table component that renders individual team member usage rows. Each row shows a colour indicator based on usage %, the member's username, name, total usage (as both a percentage and a number relative to 300 included premium requests), and gross spending.

Usage percentage logic:
- `usagePercent = (totalRequests / 300) * 100`
- Colour indicator (small dot/circle next to username):
  - **Red** (`bg-red-500`): 0–50%
  - **Orange** (`bg-orange-500`): 51–99%
  - **Green** (`bg-green-500`): 100% and above
- Usage column format: `"150 / 300 (50%)"` or `"350 / 300 (117%)"`

File: `src/components/usage/TeamMemberTable.tsx`

**Definition of Done**:
- [x] Component file created at `src/components/usage/TeamMemberTable.tsx`
- [x] Table columns: GitHub Username (with colour indicator), Name, Usage (% and #/300), Gross Spending
- [x] Each row has a small coloured dot next to the GitHub username based on usage %:
  - 0–50% → red dot (`bg-red-500`)
  - 51–99% → orange dot (`bg-orange-500`)
  - 100%+ → green dot (`bg-green-500`)
- [x] Usage column shows both absolute number and percentage: `"{totalRequests} / 300 ({usagePercent}%)"`
- [x] Name column combines `firstName` and `lastName`, shows "—" when both are null
- [x] Monetary values formatted with `$` prefix and 2 decimal places
- [x] Request values in the usage column formatted with `toLocaleString()`
- [x] Percentage value rounded to nearest integer
- [x] Uses `PREMIUM_REQUESTS_PER_SEAT` constant from `src/lib/constants.ts` (not hardcoded 300)
- [x] Table follows existing styling conventions (matches `SeatUsageTable` appearance)
- [x] Proper `<thead>` and `<tbody>` semantics
- [x] Colour dot is accessible — includes `aria-label` describing the usage level (e.g., "Low usage", "Moderate usage", "High usage")

#### Task 3.5 — [MODIFY] Add `PREMIUM_REQUESTS_PER_SEAT` constant

**Description**: Add a new constant `PREMIUM_REQUESTS_PER_SEAT = 300` to the shared constants file. This represents the number of included premium requests per seat per month in the Copilot license and is used to calculate usage percentage in the team member table.

File: `src/lib/constants.ts`

**Definition of Done**:
- [x] `PREMIUM_REQUESTS_PER_SEAT` exported from `src/lib/constants.ts` with value `300`
- [x] Used by `TeamMemberTable` for usage percentage calculation
- [x] No hardcoded `300` values in component code

### Phase 4: E2E Tests

#### Task 4.1 — [CREATE] E2E tests for Team Usage tab

**Description**: Write Playwright E2E tests for the Team tab and team detail drill-down. Follow the established pattern from `e2e/seat-usage.spec.ts`. Seed team, team_member_snapshot, seat, and usage data via direct `pg.Client` queries.

File: `e2e/team-usage.spec.ts`

**Definition of Done**:
- [x] Test file created at `e2e/team-usage.spec.ts`
- [x] Test: Team tab shows teams with aggregated usage metrics
- [x] Test: informative message shown when no teams have been defined
- [x] Test: teams with no members display zero usage (not errors)
- [x] Test: clicking a team row navigates to team detail page
- [x] Test: team detail page shows team summary with member count, total requests, avg/member, spending
- [x] Test: team detail page shows daily usage line chart
- [x] Test: team detail page shows member table with usage as % and number (e.g., "150 / 300 (50%)")
- [x] Test: team member colour indicators are correct (red for low, orange for moderate, green for high usage)
- [x] Test: month filter works on team detail page
- [x] Test: back link navigates back to `/usage`
- [x] All E2E tests pass with `npm run test:e2e`

#### Task 4.2 — [MODIFY] Update existing E2E test for Team tab placeholder

**Description**: The existing E2E test in `e2e/seat-usage.spec.ts` asserts that the Team tab shows placeholder content ("Team usage analytics will be available in a future update"). This assertion must be updated or removed since the Team tab now renders actual content.

File: `e2e/seat-usage.spec.ts`

**Definition of Done**:
- [x] The test "Team and Department tabs show placeholder content" in `e2e/seat-usage.spec.ts` is updated
- [x] Team-specific placeholder assertion is removed or replaced with assertion that Team tab renders the teams panel (e.g., loading state or "No teams have been defined" message)
- [x] Department placeholder assertion remains unchanged
- [x] Existing E2E tests still pass with `npm run test:e2e`

### Phase 5: Code Review

#### Task 5.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Full code review of all changes in Phases 1–4 by the `tsh-code-reviewer` agent. Verify code quality, security, test coverage, accessibility, and adherence to established project patterns.

**Definition of Done**:
- [x] All new files reviewed for adherence to project patterns and conventions
- [x] SQL queries reviewed for performance (proper use of indexes, CTE approach, no N+1 queries)
- [x] Daily usage per member query reviewed — efficient aggregation, no N+1 per-member queries
- [x] LEFT JOIN strategy validated — teams with no members must appear with zero metrics
- [x] Average calculation reviewed — division by zero guarded when memberCount is 0
- [x] Usage percentage calculation reviewed — uses shared constant, no division by zero
- [x] API input validation reviewed (query param sanitization, teamId validation)
- [x] Authentication enforcement verified on all new endpoints
- [x] Accessibility review passed (tab panel roles maintained, table semantics, link labels)
- [x] Test coverage assessed — all acceptance criteria have corresponding tests
- [x] No code duplication introduced (reuse of MonthFilter, Pagination, auth helpers, test patterns confirmed)

## Security Considerations

- **Authentication enforcement**: Both `GET /api/usage/teams` and `GET /api/usage/teams/[teamId]` must use `requireAuth()`. Unauthenticated requests receive 401.
- **Input validation**: `teamId` path parameter is validated as a positive integer. Query parameters (`month`, `year`) are parsed with strict range checks. Invalid values fall back to safe defaults. All queries use parameterised statements — no SQL injection vectors.
- **No sensitive data exposure**: The API returns team names, member counts, usernames, names, and usage metrics. No passwords, tokens, or internal implementation details are exposed.
- **Path traversal protection**: The `teamId` parameter is parsed as an integer before use in queries, preventing path traversal or injection attacks.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Team tab shows teams with aggregated usage for the selected month
- [x] Each team shows name, total usage, average per member, and cost
- [x] User can drill into a team to see individual member usage
- [x] Team detail shows a multi-line daily usage chart (one line per member)
- [x] Team member table shows usage as % and number relative to 300 included premium requests
- [x] Colour indicator (red/orange/green) displayed next to each member's username based on usage %
- [x] Month filter allows switching between months
- [x] An informative message is shown when no teams have been defined
- [x] Teams with no members display zero usage, not an error
- [x] Integration tests pass for both API endpoints (`npm run test`)
- [x] E2E tests pass (`npm run test:e2e`)
- [x] Existing seat-usage E2E tests still pass after placeholder update
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No linting errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Sorting**: Allow sorting team list by different columns (name, members, requests, spending). Currently fixed to `teamName` ASC.
- **Team list pagination**: If the number of teams grows large, add pagination to the teams list API. Currently returns all teams.
- **CSV export**: Export team usage data for a given month.
- **Trend comparison**: Show month-over-month trend for team metrics (requires historical data queries).
- **Team member detail link**: From team detail, clicking a member row could navigate to the individual seat detail page (`/usage/seats/[seatId]?month=M&year=Y`).
- **Model breakdown per team**: Show which AI models the team uses most. Currently only totals are shown.
- **Configurable premium requests baseline**: The 300 premium requests per seat is currently a constant. If this value varies by plan type or organisation, it should be made configurable via the application settings.
- **Shared `formatCurrency` utility**: The `formatCurrency` function is duplicated in `SeatUsageTable`, `SeatDetailPanel`, and now the team components. Extract to `src/lib/formatters.ts`.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Updated: Added multi-line daily chart per member, usage % relative to 300 premium requests, colour indicators (red/orange/green), `PREMIUM_REQUESTS_PER_SEAT` constant, `TeamDailyChart` component, and `dailyUsagePerMember` API field |
| 2026-02-28 | Prerequisite: Created `TeamEntity`, `TeamMemberSnapshotEntity`, migration `1772400000000-CreateTeamTables`, registered in `data-source.ts` and `db-helpers.ts` (Epic 7 entities were missing) |
| 2026-02-28 | Code review completed: Added missing month filter E2E test, added `role="img"` to colour indicator dots, added team table cleanup to `seat-usage.spec.ts` `clearAll`, fixed strict mode violations in seat-usage E2E |
