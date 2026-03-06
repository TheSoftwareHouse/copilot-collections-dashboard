# Fix Auto-Recalculate Stale Dashboard Metrics - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Fix: Auto-Recalculate Stale Dashboard Metrics on Startup + Admin Recalculate Button |
| Description | Dashboard still displays "$2,516.56 paid requests + $0.00 seat licenses" instead of "$8.56 paid requests + ~$2,508.00 seat licenses". The calculation code was fixed (see `fix-dashboard-metrics.plan.md`) and a manual recalculation endpoint was created (see `fix-stale-dashboard-spending.plan.md`), but stale data persists because no automatic mechanism triggers recalculation after deployment. |
| Priority | High (financial data displayed incorrectly) |
| Related Research | `specifications/copilot-usage-dashboard/fix-dashboard-metrics.plan.md`, `specifications/copilot-usage-dashboard/fix-stale-dashboard-spending.plan.md` |

## Proposed Solution

### Root Cause Analysis

The `dashboard_monthly_summary` table contains stale pre-computed data:

| Column | Current (Stale) | Expected (After Recalculation) |
|---|---|---|
| `totalSpending` | `$2,516.56` (`SUM(grossAmount)` — old formula) | `$2,516.56` (`SUM(netAmount) + activeSeats × $19` — same total, different derivation) |
| `seatBaseCost` | `$0.00` (migration default) | `$2,508.00` (`132 active × $19`) |

The `refreshDashboardMetrics()` code is **correct** — verified by unit tests and the recalculate endpoint tests. The issue is purely operational: the corrected code has never been executed against the production/development database for existing months.

The architectural gap: **there is no automatic mechanism to recalculate stale summary data after the aggregation logic changes**. The system relies on:
1. Scheduled jobs (seat-sync, usage-collection) that only recalculate the **current month** — and only after a successful job run
2. A manual `POST /api/dashboard/recalculate` endpoint — which requires explicit invocation

Neither fires automatically after a code deployment. Every future change to the metrics calculation logic would leave all existing summary rows stale until manually recalculated.

### Solution

Two complementary mechanisms to ensure stale data is always corrected:

1. **Automatic startup recalculation** — Add a startup hook in `instrumentation.ts` that detects stale `dashboard_monthly_summary` rows and recalculates them. This runs when the app (re)starts after a deployment, ensuring stale data is corrected without manual intervention.

2. **Admin recalculate button** — Add a "Recalculate Dashboard Metrics" button in the Settings page. This gives admins a visible, on-demand way to trigger recalculation without needing API tools.

### Stale Data Detection Heuristic

A summary row is considered stale when:
```
seatBaseCost = 0 AND activeSeats > 0
```

This catches all rows created before the `seatBaseCost` column was added (migration default = 0) and rows where the old calculation logic was used. It does not trigger for genuinely zero-cost months (0 active seats).

### Data Flow

```
App Startup (instrumentation.ts / register())
│
├── Delay 20s (let DB connections stabilize)
│
├── Query dashboard_monthly_summary:
│   SELECT DISTINCT month, year
│   WHERE "seatBaseCost" = 0 AND "activeSeats" > 0
│   └── returns: [(1, 2026), (2, 2026), ...]
│
├── If stale rows found:
│   ├── For each (month, year):
│   │   └── refreshDashboardMetrics(month, year)
│   │       ├── Recomputes: totalSpending = SUM(netAmount) + activeSeats × 19
│   │       ├── Recomputes: seatBaseCost = activeSeats × 19
│   │       └── Upserts into dashboard_monthly_summary
│   └── Log: "Recalculated N stale dashboard months"
│
└── If no stale rows: Skip silently


Settings Page — "Recalculate" Button
│
├── User clicks "Recalculate Dashboard Metrics"
│
├── POST /api/dashboard/recalculate  (existing endpoint)
│   └── refreshDashboardMetrics() for all months
│
└── Show success/error feedback in UI
```

## Current Implementation Analysis

### Already Implemented
- `src/lib/dashboard-metrics.ts` — `refreshDashboardMetrics(month, year)` with correct `netAmount`-based spending and `seatBaseCost` calculation — **REUSE as-is**
- `src/app/api/dashboard/recalculate/route.ts` — `POST` endpoint that recalculates all or specific months — **REUSE as-is**
- `src/app/api/dashboard/route.ts` — Dashboard GET endpoint returning `totalSpending`, `seatBaseCost` and derived metrics — **REUSE as-is**
- `src/components/dashboard/DashboardPanel.tsx` — Frontend component with spending breakdown display (`paid requests + seat licenses`) — **REUSE as-is**
- `src/entities/dashboard-monthly-summary.entity.ts` — Entity with `seatBaseCost` column — **REUSE as-is**
- `src/lib/__tests__/dashboard-metrics.test.ts` — Comprehensive unit tests for `refreshDashboardMetrics()` — **REUSE as-is**
- `src/app/api/dashboard/recalculate/__tests__/route.test.ts` — Integration tests for recalculate endpoint — **REUSE as-is**

### To Be Modified
- `instrumentation.ts` — Add startup recalculation hook that detects stale `dashboard_monthly_summary` rows and recalculates them using `refreshDashboardMetrics()`. Follow the existing pattern of `SEAT_SYNC_RUN_ON_STARTUP` / `USAGE_COLLECTION_RUN_ON_STARTUP` — **ADD new section**
- `src/app/(app)/settings/page.tsx` — Add a "Recalculate Dashboard Metrics" section below the existing `JobStatusPanel` — **ADD new section**

### To Be Created
- `src/components/settings/RecalculateMetricsButton.tsx` — Client component with a button that calls `POST /api/dashboard/recalculate` and displays success/error feedback
- `e2e/configuration-settings.spec.ts` — Add test case for the recalculate button (extend existing settings E2E tests)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should startup recalculation run on every restart or only when stale data is detected? | Only when stale data is detected (`seatBaseCost = 0 AND activeSeats > 0`), to avoid unnecessary DB load on restarts with fresh data. | ✅ Resolved |
| 2 | Should recalculation be behind an env var like SEAT_SYNC_RUN_ON_STARTUP? | No, it should always run on startup when stale data is detected. Unlike seat-sync (which hits the GitHub API), recalculation only reads/writes local DB data and is fast. An env var would add configuration burden without meaningful benefit. | ✅ Resolved |
| 3 | Should the admin button recalculate all months or just the current month? | All months, using the existing `POST /api/dashboard/recalculate` endpoint without params. | ✅ Resolved |

## Implementation Plan

### Phase 1: Automatic Startup Recalculation

#### Task 1.1 - [MODIFY] Add Startup Recalculation Hook to `instrumentation.ts`
**Description**: Add a new section in the `register()` function that detects stale `dashboard_monthly_summary` rows (where `seatBaseCost = 0` and `activeSeats > 0`) and calls `refreshDashboardMetrics()` for each. This runs after a 20-second delay to let DB connections stabilize, following the same delay pattern as the existing startup hooks.

**File**: `instrumentation.ts`

**Implementation details**:
```typescript
// --- Dashboard Metrics Recalculation (stale data detection) ---
setTimeout(async () => {
  try {
    const { getDb } = await import("@/lib/db");
    const { refreshDashboardMetrics } = await import("@/lib/dashboard-metrics");
    const dataSource = await getDb();

    // Detect stale months: seatBaseCost=0 but activeSeats>0
    const staleMonths: { month: number; year: number }[] =
      await dataSource.query(
        `SELECT "month", "year" FROM dashboard_monthly_summary
         WHERE "seatBaseCost" = 0 AND "activeSeats" > 0`
      );

    if (staleMonths.length > 0) {
      console.log(
        `Detected ${staleMonths.length} stale dashboard month(s), recalculating...`
      );
      for (const { month, year } of staleMonths) {
        await refreshDashboardMetrics(month, year);
      }
      console.log(
        `Recalculated ${staleMonths.length} stale dashboard month(s)`
      );
    }
  } catch (error) {
    console.warn(
      "Startup dashboard recalculation failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}, 20_000);
```

**Patterns to follow**:
- Same delayed startup pattern as `SEAT_SYNC_RUN_ON_STARTUP` (10s) and `USAGE_COLLECTION_RUN_ON_STARTUP` (15s)
- Fire-and-forget: log warnings on failure, don't crash the app
- Dynamic imports to avoid bundling issues

**Definition of Done**:
- [ ] `instrumentation.ts` includes a new section titled "Dashboard Metrics Recalculation"
- [ ] On startup, queries `dashboard_monthly_summary` for rows where `seatBaseCost = 0 AND activeSeats > 0`
- [ ] For each stale month, calls `refreshDashboardMetrics(month, year)`
- [ ] Logs the number of stale months detected and recalculated
- [ ] Silently succeeds (no log) when no stale data exists
- [ ] Failures are logged as warnings but do not crash the application
- [ ] Runs after a 20-second delay

### Phase 2: Admin Recalculate Button in Settings

#### Task 2.1 - [CREATE] `RecalculateMetricsButton` Component
**Description**: Create a client component that renders a "Recalculate Dashboard Metrics" button. When clicked, it calls `POST /api/dashboard/recalculate` and displays success or error feedback. Shows a loading state during the request.

**File**: `src/components/settings/RecalculateMetricsButton.tsx`

**Behaviour**:
- Default state: Button with text "Recalculate Dashboard Metrics"
- Loading state: Button disabled with "Recalculating…" text
- Success state: Green text showing "Recalculated N month(s) successfully" for 5 seconds, then resets
- Error state: Red text showing error message for 5 seconds, then resets

**Definition of Done**:
- [ ] Component renders a button styled consistently with existing Settings page UI
- [ ] Clicking the button sends `POST /api/dashboard/recalculate` with no query params
- [ ] Button shows loading state and is disabled during the request
- [ ] Success response shows the number of recalculated months
- [ ] Error response shows error message in red
- [ ] Feedback messages auto-dismiss after 5 seconds
- [ ] Component is a `"use client"` component (uses `useState`, `fetch`)

#### Task 2.2 - [MODIFY] Add Recalculate Section to Settings Page
**Description**: Add the `RecalculateMetricsButton` component to the Settings page, below the existing `JobStatusPanel` section.

**File**: `src/app/(app)/settings/page.tsx`

**Definition of Done**:
- [ ] Settings page imports and renders `RecalculateMetricsButton`
- [ ] Button appears below the Job Status section
- [ ] Section has a heading "Dashboard Metrics" and a brief description explaining what recalculation does
- [ ] TypeScript compiles without errors

### Phase 3: Tests

#### Task 3.1 - [MODIFY] Add E2E Test for Recalculate Button
**Description**: Add a test case to the existing settings E2E test file that verifies the recalculate button is visible and functional.

**File**: `e2e/configuration-settings.spec.ts`

**Test cases**:
1. Settings page displays "Recalculate Dashboard Metrics" button
2. Clicking the button shows loading state, then success feedback

**Definition of Done**:
- [ ] E2E test verifies the recalculate button is visible on the Settings page
- [ ] E2E test verifies clicking the button shows success feedback (seeds dashboard data first)
- [ ] All existing E2E tests continue to pass

#### Task 3.2 - [CREATE] Unit Test for RecalculateMetricsButton Component
**Description**: Create a simple unit/integration test that verifies the component renders correctly and handles API responses.

**File**: `src/components/settings/__tests__/RecalculateMetricsButton.test.tsx`

**Test cases**:
1. Renders the button with correct text
2. Shows loading state when clicked
3. Shows success message with month count on 200 response
4. Shows error message on non-200 response

**Definition of Done**:
- [ ] Test file is created with all 4 test cases
- [ ] Tests mock `fetch` and verify UI state transitions
- [ ] All tests pass (`npm run test`)

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated Code Review
**Description**: Run the `tsh-code-reviewer` agent to review all changes for correctness, consistency, and adherence to project standards.

**Definition of Done**:
- [ ] Code review completed by `tsh-code-reviewer` agent
- [ ] All review findings addressed

## Security Considerations

- **Startup recalculation**: Executes only server-side within `instrumentation.ts`. No user input involved. Uses the existing `refreshDashboardMetrics()` function which uses parameterized SQL queries.
- **Recalculate button**: The `POST /api/dashboard/recalculate` endpoint is already protected by `requireAuth()`. Only authenticated users can trigger recalculation.
- **No new attack surface**: No new endpoints created. The button invokes the existing recalculate endpoint.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] After app restart, stale dashboard months (with `seatBaseCost = 0` and `activeSeats > 0`) are automatically recalculated
- [ ] Dashboard displays correct spending breakdown: `$8.56 paid requests + $2,508.00 seat licenses` (approximate values based on actual data)
- [ ] Settings page shows a "Recalculate Dashboard Metrics" button
- [ ] Clicking the button recalculates all months and shows success feedback
- [ ] Startup recalculation logs clearly indicate how many months were recalculated
- [ ] Startup recalculation doesn't crash the app if the database is unavailable
- [ ] All unit tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run test:e2e`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Calculation versioning**: Add a `calculationVersion` column to `dashboard_monthly_summary` and increment it whenever the aggregation logic changes. Detect stale data by comparing stored version vs current code version, rather than relying on the `seatBaseCost = 0` heuristic.
- **Separate net premium spending column**: Store only `SUM(netAmount)` in the DB and derive `totalSpending = netPremiumSpending + activeSeats × 19` at API query time. This eliminates the class of stale-data bugs where `totalSpending` semantics change.
- **Month selector on dashboard**: Add a month/year picker to the dashboard UI so users can view historical months (currently hardcoded to current month).
- **Recalculation progress indicator**: Show a progress bar or count during recalculation for organizations with many months of data.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
