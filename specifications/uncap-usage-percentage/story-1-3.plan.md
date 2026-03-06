# Story 1.3: Display Uncapped Usage Percentage on Dashboard Active/Inactive User Lists — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User sees actual usage percentage on Dashboard active/inactive user lists |
| Description | Remove the artificial 100% cap on usage percentage in the `DashboardPanel` component's "Most Active Users" and "Least Active Users" lists. The colour-coded `UsageStatusIndicator` should receive the actual (uncapped) value for colour determination, consistent with the seat and member views uncapped in Stories 1.1 and 1.2. |
| Priority | Medium |
| Related Research | `specifications/uncap-usage-percentage/extracted-tasks.md` |

## Proposed Solution

Remove both `Math.min(..., 100)` caps in the `DashboardPanel` component. These caps wrap the `usagePercent` variable that is passed exclusively to `UsageStatusIndicator` for colour determination in both user lists.

Stories 1.1 and 1.2 already uncapped all shared utilities (`UsageProgressBar`, `UsageStatusIndicator`, `calcUsagePercent`, `getUsageColour`) and the seat/team/department member views. The `DashboardPanel` is the **last remaining location** where the percentage is artificially capped.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Flow (unchanged)                        │
│                                                                     │
│  API response (user.totalRequests, data.premiumRequestsPerSeat)     │
│       │                                                             │
│       ▼                                                             │
│  calcUsagePercent(totalRequests, premiumRequestsPerSeat)            │
│       │ returns uncapped value (e.g., 167 for 500/300)              │
│       │                                                             │
│       └──► UsageStatusIndicator (colour dot)                        │
│             └── receives raw uncapped percent       ← UNCAP         │
│                  (was: Math.min(percent, 100))                      │
└─────────────────────────────────────────────────────────────────────┘
```

The change is minimal — remove 2 `Math.min` wrappers in a single file (lines 300 and 345), then eliminate the redundant `usagePercent` alias (consistent with the Story 1.2 code review precedent).

**Important note**: Unlike Stories 1.1 and 1.2, the dashboard user lists do **not** display the percentage as text — the percentage is only used internally for `UsageStatusIndicator` colour determination. Since `getUsageColour` returns green ("High usage") for any value ≥ 90%, and capped values were already ≥ 100%, the visual output does not change for overcap users. However, the change is needed for **correctness and consistency**: the indicator must receive the actual uncapped value so that colour determination uses the real percentage.

## Current Implementation Analysis

### Already Implemented
- `calcUsagePercent(totalRequests, premiumRequestsPerSeat)` — `src/lib/usage-helpers.ts` — returns raw uncapped percentage. No changes needed.
- `getUsageColour(percent)` — `src/lib/usage-helpers.ts` — correctly handles >100% (returns green for ≥90%). No changes needed.
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — passes percent to `getUsageColour` without capping. No changes needed.
- `UsageProgressBar` — `src/components/usage/UsageProgressBar.tsx` — already uncapped (display text and `aria-valuenow`) from Story 1.1. Not used in `DashboardPanel`.
- `SeatDetailPanel`, `SeatUsageTable`, `SeatListPanel` — already uncapped from Story 1.1. No changes needed.
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — already uncapped from Story 1.2. No changes needed.
- Dashboard API route — `src/app/api/dashboard/route.ts` — returns `premiumRequestsPerSeat` from configuration. No changes needed.

### To Be Modified
- `DashboardPanel` — `src/components/dashboard/DashboardPanel.tsx` — line 300: remove `Math.min(..., 100)` from `usagePercent` in "Most Active Users" map callback. Line 345: remove `Math.min(..., 100)` from `usagePercent` in "Least Active Users" map callback. Eliminate the intermediate `usagePercent` variable in both locations (pass `calcUsagePercent(...)` directly to `UsageStatusIndicator`), consistent with Story 1.2 precedent.
- E2E test — `e2e/dashboard.spec.ts` — add a new test that verifies overcap users on the dashboard have the correct `UsageStatusIndicator` aria-label ("High usage") with seed data where `totalRequests > premiumRequestsPerSeat`. The existing tests (`"dashboard displays most active users"` and `"dashboard displays least active users"`) only check indicator visibility — they don't verify colour/label for overcap scenarios.

### To Be Created
Nothing — all components and utilities already exist.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the redundant `usagePercent` variable be kept after removing `Math.min`? | No — following the precedent set in Story 1.2 (and Story 1.1's code review nit for SeatUsageTable), eliminate the alias and pass `calcUsagePercent(...)` directly to `UsageStatusIndicator`. | ✅ Resolved |
| 2 | Does the visual output actually change after this uncapping? | No — for the current colour thresholds, `getUsageColour(100)` and `getUsageColour(167)` both return green ("High usage"). The change is for correctness and consistency, and future-proofs against threshold changes. | ✅ Resolved |
| 3 | Do existing E2E tests need modification? | No — existing tests assert indicator visibility only (`getByRole("img", { name: /usage/i })`), not specific colour or percentage values. They pass regardless of capping. A new test should be added to explicitly verify overcap indicator behaviour. | ✅ Resolved |

## Implementation Plan

### Phase 1: Remove percentage caps from `DashboardPanel`

#### Task 1.1 - [MODIFY] Remove `Math.min` cap and `usagePercent` alias from "Most Active Users" list
**Description**: Remove the `Math.min(calcUsagePercent(...), 100)` wrapper from line 300 of `DashboardPanel.tsx` in the "Most Active Users" `.map()` callback. Eliminate the intermediate `usagePercent` variable and pass `calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat)` directly to `UsageStatusIndicator`, consistent with the Story 1.2 approach.

File: `src/components/dashboard/DashboardPanel.tsx`

Changes:
- Line 300: Remove `const usagePercent = Math.min(calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat), 100);`
- Line 309: `<UsageStatusIndicator percent={usagePercent} />` → `<UsageStatusIndicator percent={calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat)} />`

**Definition of Done**:
- [x] `const usagePercent = Math.min(...)` line is removed from "Most Active Users" callback
- [x] `UsageStatusIndicator` receives `calcUsagePercent(...)` directly (uncapped)
- [x] Colour-coded indicator uses uncapped percentage for colour determination
- [x] No TypeScript or ESLint errors

#### Task 1.2 - [MODIFY] Remove `Math.min` cap and `usagePercent` alias from "Least Active Users" list
**Description**: Remove the `Math.min(calcUsagePercent(...), 100)` wrapper from line 345 of `DashboardPanel.tsx` in the "Least Active Users" `.map()` callback. Eliminate the intermediate `usagePercent` variable and pass `calcUsagePercent(...)` directly, mirroring the change in Task 1.1.

File: `src/components/dashboard/DashboardPanel.tsx`

Changes:
- Line 345: Remove `const usagePercent = Math.min(calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat), 100);`
- Line 354: `<UsageStatusIndicator percent={usagePercent} />` → `<UsageStatusIndicator percent={calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat)} />`

**Definition of Done**:
- [x] `const usagePercent = Math.min(...)` line is removed from "Least Active Users" callback
- [x] `UsageStatusIndicator` receives `calcUsagePercent(...)` directly (uncapped)
- [x] Colour-coded indicator uses uncapped percentage for colour determination
- [x] No TypeScript or ESLint errors

### Phase 2: Add E2E test for dashboard overcap indicator

#### Task 2.1 - [MODIFY] Add E2E test verifying overcap user indicator on dashboard
**Description**: Add a new E2E test in `e2e/dashboard.spec.ts` that seeds a dashboard summary where a "Most Active User" has `totalRequests` exceeding the configured `premiumRequestsPerSeat` (default 300). The test should verify that the `UsageStatusIndicator` for that user has `aria-label="High usage"`, confirming the uncapped percentage (> 100%) correctly resolves to the "High usage" colour. This documents the expected uncapped behaviour and guards against future regressions.

The existing seed data already includes `top-user-1` with 500 requests (167% of 300 allowance), so the default `seedDashboardSummary()` can be reused.

File: `e2e/dashboard.spec.ts`

Changes:
- Add new test: `"overcap user on most active list has correct usage indicator"` that seeds data, navigates to dashboard, locates the "Most Active Users" card, and asserts that the first `UsageStatusIndicator` has `aria-label="High usage"`.

**Definition of Done**:
- [x] New test `"overcap user on most active list has correct usage indicator"` is added
- [x] Test seeds dashboard with user whose requests exceed allowance (500 / 300 = 167%)
- [x] Test asserts `aria-label="High usage"` on the indicator next to the overcap user
- [x] Existing dashboard E2E tests remain unchanged and pass

### Phase 3: Code review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Code review across all modified files to ensure correctness, consistency with Stories 1.1 and 1.2 approach, and no regressions.

**Definition of Done**:
- [x] All changes reviewed by `tsh-code-reviewer`
- [x] No `Math.min(..., 100)` remains in `DashboardPanel` percentage calculation paths
- [x] Redundant `usagePercent` variable is fully removed in both user list callbacks
- [x] No `Math.min(..., 100)` remains anywhere in the codebase for usage percentage display (cross-check all components)
- [x] All acceptance criteria from Story 1.3 are met

## Security Considerations

- No security considerations — this change affects frontend display logic only. No authentication, authorization, data access, or API changes are involved.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] "Most Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator (i.e., `UsageStatusIndicator` receives uncapped value from `calcUsagePercent`)
- [x] "Least Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
- [x] Percentage display is consistent with the seat and member views from Stories 1.1 and 1.2 (no `Math.min(..., 100)` capping anywhere in the frontend)
- [x] Existing dashboard E2E tests pass without modification
- [x] New E2E test verifying overcap indicator behaviour passes
- [x] No `Math.min(..., 100)` remains in any usage percentage display path across the entire codebase

## Improvements (Out of Scope)

- **Display percentage text on dashboard user lists**: Currently the dashboard only shows a colour indicator, request count, and spending — it does not display the percentage as text (e.g., "167%"). Adding percentage text to the dashboard user lists would improve information density and consistency with seat/team/department views.
- **Visual overflow indicator**: Consider adding a visual marker (e.g., different colour, icon, badge, or tooltip) when a user's usage exceeds 100% to draw attention beyond the colour indicator alone.
- **Refactor duplicate map callbacks**: The "Most Active Users" and "Least Active Users" rendering blocks in `DashboardPanel.tsx` are nearly identical. Consider extracting a shared `UserListCard` component to reduce duplication.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation complete — Phase 1 (2 tasks), Phase 2 (1 task) done. Code review performed by `tsh-code-reviewer`. |

## Code Review Findings

**Verdict**: PASS ✅

**No issues found.** All changes are correct, minimal, and consistent with Stories 1.1 and 1.2.

**Verification summary**:
- No `Math.min(..., 100)` remains in `DashboardPanel` percentage calculation paths
- Redundant `usagePercent` variable fully removed — `calcUsagePercent(...)` passed directly to `UsageStatusIndicator` in both callbacks
- Cross-checked all `src/**/*.tsx` files — only remaining `Math.min` is `UsageProgressBar.tsx` fill width (intentional)
- E2E test assertion mathematically correct: `500 / 300 × 100 = 166.67` → `getUsageColour(166.67)` → "High usage"
- ESLint and TypeScript both clean across all modified files
- All acceptance criteria met
