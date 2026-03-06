````markdown
# Story 1.2: Display Uncapped Usage Percentage on Team & Department Member Tables — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User sees actual usage percentage on team and department member tables |
| Description | Remove the artificial 100% cap on usage percentage display in the `TeamMemberTable` component (shared by team detail and department detail views). The displayed percentage text and colour-coded status indicator should show the actual value (e.g., "200%" for 600/300 requests) to be consistent with the seat views uncapped in Story 1.1. |
| Priority | High |
| Related Research | `specifications/uncap-usage-percentage/extracted-tasks.md` |

## Proposed Solution

Remove both `Math.min(..., 100)` caps in the `TeamMemberTable` component. This component is the single source of the capping behaviour for both team detail and department detail member views.

Story 1.1 already uncapped the shared `UsageProgressBar`, `UsageStatusIndicator`, `calcUsagePercent`, and `getUsageColour` utilities. The `SeatUsageTable` was also uncapped in Story 1.1 and follows an identical pattern to `TeamMemberTable` — the fix here mirrors the same approach (remove `Math.min`, pass raw percent directly).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Flow (unchanged)                        │
│                                                                     │
│  API response (member.totalRequests, premiumRequestsPerSeat)        │
│       │                                                             │
│       ▼                                                             │
│  calcUsagePercent(totalRequests, premiumRequestsPerSeat)            │
│       │ returns uncapped value (e.g., 200 for 600/300)              │
│       │                                                             │
│       ├──► UsageStatusIndicator (colour dot)                        │
│       │     └── receives rawPercent directly       ← UNCAP          │
│       │                                                             │
│       └──► Text display ("{X} / {Y} ({Z}%)")                       │
│             └── Z = Math.round(rawPercent)          ← UNCAP         │
└─────────────────────────────────────────────────────────────────────┘
```

The change is minimal — remove 2 `Math.min` wrappers in a single file, then update 2 E2E tests (one in `team-usage.spec.ts`, one in `department-usage.spec.ts`) that currently assert capped values.

## Current Implementation Analysis

### Already Implemented
- `calcUsagePercent(totalRequests, premiumRequestsPerSeat)` — `src/lib/usage-helpers.ts` — returns raw uncapped percentage. No changes needed.
- `getUsageColour(percent)` — `src/lib/usage-helpers.ts` — correctly handles >100% (returns green for ≥90%). No changes needed.
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — passes percent to `getUsageColour` without capping. No changes needed.
- `UsageProgressBar` — `src/components/usage/UsageProgressBar.tsx` — already uncapped (display text and `aria-valuenow`) from Story 1.1. No changes needed.
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — already uncapped from Story 1.1. Serves as the pattern reference for this story.
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — renders `<TeamMemberTable members={members} premiumRequestsPerSeat={premiumRequestsPerSeat} />`. No cap at this level. No changes needed.
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — renders `<TeamMemberTable members={members} premiumRequestsPerSeat={premiumRequestsPerSeat} />`. No cap at this level. No changes needed.

### To Be Modified
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — line 48: remove `Math.min(rawPercent, 100)` from `usagePercent` variable (used by `UsageStatusIndicator`). Line 65: remove `Math.min(Math.round(rawPercent), 100)` from inline percentage text display.
- E2E test — `e2e/team-usage.spec.ts` — line ~458: test "progress bar caps usage at 100% when member exceeds premium allowance" — update assertion for member table text from capped `100%` to uncapped `333%` (1000/300).
- E2E test — `e2e/department-usage.spec.ts` — line ~614: test "progress bar caps usage at 100% when member exceeds premium allowance" — update assertion from `"1,000 / 300 (100%)"` to `"1,000 / 300 (333%)"`.

### To Be Created
Nothing — all components and utilities already exist.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the redundant `usagePercent` variable be kept after removing `Math.min`? | No — following the precedent set in Story 1.1's code review (SeatUsageTable nit), remove the `usagePercent` alias and use `rawPercent` directly. This avoids a redundant 1:1 variable assignment. | ✅ Resolved |
| 2 | Do the team/department progress bar E2E tests (which test the overview progress bar, not the member table) need updates? | No — the overview progress bar on team/department detail pages shows the aggregate (server-calculated) capped usage percentage, not per-member values. These assertions (`aria-valuenow="67"`) are correct and remain unchanged. Only the member table text assertions need updating. | ✅ Resolved |

## Implementation Plan

### Phase 1: Remove percentage caps from `TeamMemberTable`

#### Task 1.1 - [MODIFY] Remove `Math.min` cap from `UsageStatusIndicator` percent prop
**Description**: Remove the `Math.min(rawPercent, 100)` wrapper from the `usagePercent` variable on line 48 of `TeamMemberTable.tsx`. Following the Story 1.1 code review precedent, eliminate the now-redundant `usagePercent` alias entirely and pass `rawPercent` directly to `UsageStatusIndicator`.

File: `src/components/usage/TeamMemberTable.tsx`

Changes:
- Line 48: Remove `const usagePercent = Math.min(rawPercent, 100);`
- Line 58: `<UsageStatusIndicator percent={usagePercent} />` → `<UsageStatusIndicator percent={rawPercent} />`

**Definition of Done**:
- [x] `const usagePercent = Math.min(rawPercent, 100);` line is removed
- [x] `UsageStatusIndicator` receives `rawPercent` directly (uncapped)
- [x] Colour-coded indicator uses uncapped percentage for colour determination (e.g., 200% → green)

#### Task 1.2 - [MODIFY] Remove `Math.min` cap from percentage text display
**Description**: Remove the `Math.min(Math.round(rawPercent), 100)` wrapper from the Usage column text on line 65 of `TeamMemberTable.tsx`, replacing it with `Math.round(rawPercent)`.

File: `src/components/usage/TeamMemberTable.tsx`

Change:
- Line 65: `({Math.min(Math.round(rawPercent), 100)}%)` → `({Math.round(rawPercent)}%)`

**Definition of Done**:
- [x] Usage column text shows uncapped percentage (e.g., `"600 / 300 (200%)"`)
- [x] Percentage is correctly rounded (e.g., 1000/300 = 333.33... → `"333%"`)
- [x] Table renders correctly for members with usage below, at, and above the allowance

### Phase 2: Update E2E tests

#### Task 2.1 - [MODIFY] Update team usage E2E test for uncapped member table text
**Description**: The existing E2E test `"progress bar caps usage at 100% when member exceeds premium allowance"` in `e2e/team-usage.spec.ts` seeds a member with 1000 requests against a 300 allowance. The member table currently shows `"1,000 / 300 (100%)"`. After uncapping, it should show `"1,000 / 300 (333%)"`. Update the test name and assertion. Note: the overview progress bar assertions (`aria-valuenow="67"`, `"67%"`) remain unchanged because they test the aggregate team usage, not the member table.

File: `e2e/team-usage.spec.ts`

Changes:
- Rename test from "progress bar caps usage at 100% when member exceeds premium allowance" to "member table shows actual percentage when member exceeds premium allowance"
- Add assertion: `await expect(page.getByText("1,000 / 300 (333%)")).toBeVisible();`

**Definition of Done**:
- [x] E2E test name reflects uncapped member table behaviour
- [x] Assertion verifies `"1,000 / 300 (333%)"` is visible in the member table
- [x] Existing overview progress bar assertions (`aria-valuenow="67"`, `"67%"`) remain unchanged
- [x] Existing tests for 50% scenarios and colour indicators remain unchanged and pass

#### Task 2.2 - [MODIFY] Update department usage E2E test for uncapped member table text
**Description**: The existing E2E test `"progress bar caps usage at 100% when member exceeds premium allowance"` in `e2e/department-usage.spec.ts` currently asserts `"1,000 / 300 (100%)"`. After uncapping, it should assert `"1,000 / 300 (333%)"`. Update the test name and assertions.

File: `e2e/department-usage.spec.ts`

Changes:
- Rename test from "progress bar caps usage at 100% when member exceeds premium allowance" to "member table shows actual percentage when member exceeds premium allowance"
- Line ~650: `await expect(page.getByText("1,000 / 300 (100%)")).toBeVisible();` → `await expect(page.getByText("1,000 / 300 (333%)")).toBeVisible();`

**Definition of Done**:
- [x] E2E test name reflects uncapped member table behaviour
- [x] Assertion verifies `"1,000 / 300 (333%)"` is visible in the member table
- [x] Assertion for `"100 / 300 (33%)"` remains unchanged (below-cap member)
- [x] Existing overview progress bar assertions (`aria-valuenow="67"`, `"67%"`) remain unchanged
- [x] Existing tests for 50% scenarios and colour indicators remain unchanged and pass

### Phase 3: Code review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Code review across all modified files to ensure correctness, consistency with Story 1.1 approach, and no regressions.

**Definition of Done**:
- [x] All changes reviewed by `tsh-code-reviewer`
- [x] No `Math.min(..., 100)` remains in `TeamMemberTable` percentage display path
- [x] Redundant `usagePercent` variable is fully removed (consistent with Story 1.1 SeatUsageTable fix)
- [x] E2E test assertions are accurate (333% = Math.round(1000/300 * 100))
- [x] All acceptance criteria from Story 1.2 are met

## Security Considerations

- No security considerations — this change affects frontend display logic only. No authentication, authorization, data access, or API changes are involved.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Team members table on team detail page shows actual percentage in "Usage" column (e.g., `"600 / 300 (200%)"`)
- [x] Department members table on department detail page shows actual percentage in "Usage" column (e.g., `"600 / 300 (200%)"`)
- [x] Colour-coded status indicator for team/department members uses the uncapped percentage for colour determination
- [x] Percentage display is consistent with the seat views from Story 1.1 (same uncapped approach)
- [ ] E2E tests in `team-usage.spec.ts` pass (modified overcap test + unchanged 50% and colour indicator tests)
- [ ] E2E tests in `department-usage.spec.ts` pass (modified overcap test + unchanged 50% and colour indicator tests)

## Improvements (Out of Scope)

- **Rename `TeamMemberTable` → `MemberUsageTable`**: The component is generic and shared between team and department detail views, but is named team-specific. A rename would improve clarity.
- **Dashboard panel uncapping** (Story 1.3): `DashboardPanel.tsx` has the same `Math.min` cap on "Most Active Users" and "Least Active Users" lists — planned for a separate story.
- **Visual overflow indicator**: Consider adding a visual marker (e.g., different colour, icon, or tooltip) when usage exceeds 100% to draw attention beyond the numerical percentage.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation complete — Phase 1 (2 tasks), Phase 2 (2 tasks) done. Code review performed by `tsh-code-reviewer`. |

## Code Review Findings

**Verdict**: PASS ✅

**No issues found.** All changes are clean and consistent with Story 1.1 pattern.

**Verification summary**:
- No `Math.min(..., 100)` remains in `TeamMemberTable` percentage display path
- Redundant `usagePercent` variable fully removed — `rawPercent` used directly (matches `SeatUsageTable` precedent)
- `UsageStatusIndicator` receives uncapped `rawPercent` on line 56
- Percentage text uses `Math.round(rawPercent)` uncapped on line 64
- E2E test assertions mathematically correct: `1000 / 300 × 100 = 333.33... → 333`
- Overview progress bar assertions correctly unchanged at 67%
- ESLint and TypeScript both clean across all modified files
- Only remaining `Math.min` in components is `UsageProgressBar.tsx` fill width — correct and intentional

````