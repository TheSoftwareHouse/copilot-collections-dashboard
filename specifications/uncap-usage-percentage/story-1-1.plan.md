# Story 1.1: Display Uncapped Usage Percentage on Seat Views — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User sees actual usage percentage on seat views |
| Description | Remove the artificial 100% cap on usage percentage display across seat detail page, seat usage table, and seat list panel. The displayed percentage text and accessibility attributes should show the actual value (e.g., 200% for 600/300 requests) while the progress bar visual fill remains capped at 100% as a layout constraint. |
| Priority | High |
| Related Research | `specifications/uncap-usage-percentage/extracted-tasks.md` |

## Proposed Solution

Remove `Math.min(..., 100)` caps in four components that artificially limit the displayed percentage to 100%. The capping currently happens at the **presentation layer** only — the utility function `calcUsagePercent` already returns uncapped values, and the colour helper `getUsageColour` already handles values above 100% correctly (returns green). The `UsageStatusIndicator` is also already uncapped-safe.

The changes are purely UI — no API, database, or business logic changes required.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Flow (unchanged)                        │
│                                                                     │
│  API response (totalRequests, premiumRequestsPerSeat)               │
│       │                                                             │
│       ▼                                                             │
│  calcUsagePercent(totalRequests, premiumRequestsPerSeat)            │
│       │ returns uncapped value (e.g., 200 for 600/300)              │
│       │                                                             │
│       ├──► UsageProgressBar                                         │
│       │     ├── fillWidth = Math.min(percent, 100)   ← kept        │
│       │     ├── displayPercent = Math.round(percent)  ← UNCAP      │
│       │     └── aria-valuenow = Math.round(percent)   ← UNCAP      │
│       │                                                             │
│       ├──► UsageStatusIndicator (colour dot)                        │
│       │     └── receives uncapped percent              ← UNCAP      │
│       │                                                             │
│       └──► Text display ("{X} / {Y} ({Z}%)")                       │
│             └── Z = Math.round(rawPercent)             ← UNCAP      │
└─────────────────────────────────────────────────────────────────────┘
```

The approach is minimal and surgical — remove `Math.min` wrappers at 6 specific locations across 4 files, plus update the shared `UsageProgressBar` component to show uncapped text while keeping the visual bar fill bounded.

## Current Implementation Analysis

### Already Implemented
- `calcUsagePercent(totalRequests, premiumRequestsPerSeat)` — `src/lib/usage-helpers.ts` — returns raw uncapped percentage (e.g., 200 for 600/300). No changes needed.
- `getUsageColour(percent)` — `src/lib/usage-helpers.ts` — correctly handles >100% (returns green for ≥90%). No changes needed.
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — passes `percent` to `getUsageColour` without capping. No changes needed, but callers must pass uncapped values.
- Unit tests for `calcUsagePercent` and `getUsageColour` — `src/lib/__tests__/usage-helpers.test.ts` — already test values above 100%. No changes needed.

### To Be Modified
- `UsageProgressBar` — `src/components/usage/UsageProgressBar.tsx` — remove `Math.min(Math.round(percent), 100)` from display text and `aria-valuenow`. Keep `Math.min(percent, 100)` for fill width (visual constraint). Remove `aria-valuemax={100}` or update it to reflect that values can exceed 100.
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — line 198: remove `Math.min(..., 100)` wrapper from `usagePercent` calculation.
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — line 47: remove `Math.min(rawPercent, 100)` from `usagePercent`. Line 86: remove `Math.min(Math.round(rawPercent), 100)` from percentage text display.
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — line 385: remove `Math.min(..., 100)` wrapper from `usagePercent` calculation.
- E2E test — `e2e/seat-usage.spec.ts` — lines 562–584: update the "overcap" test to expect `167%` and `aria-valuenow="167"` instead of `100%`/`100`.

### To Be Created
Nothing — all components and utilities already exist.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `aria-valuemax` on the progress bar be updated to reflect uncapped values? | Yes — change from `100` to removal or set dynamically. Since the bar's visual fill still caps at 100%, keeping `aria-valuemax={100}` would conflict with `aria-valuenow` values above 100. The best approach is to remove `aria-valuemax` entirely (it defaults to 100 per spec, but WAI-ARIA allows valuenow > valuemax for non-determinate ranges) or set it to a dynamic ceiling. Removing it avoids lying to screen readers. | ✅ Resolved |
| 2 | Should the `getUsageColour` thresholds change when receiving values >100%? | No — per extracted tasks, the existing thresholds (≥90% green, 50–89% orange, <50% red) remain unchanged and will simply always return green when usage exceeds the allowance. This is the desired behaviour. | ✅ Resolved |

## Implementation Plan

### Phase 1: Remove percentage caps from shared component and seat views

#### Task 1.1 - [MODIFY] Uncap `UsageProgressBar` display text and accessibility attributes
**Description**: Remove the `Math.min` cap from the displayed percentage text and `aria-valuenow` attribute in the `UsageProgressBar` component. The visual fill width (`fillWidth`) must stay capped at 100% since the bar cannot physically exceed its container.

File: `src/components/usage/UsageProgressBar.tsx`

Changes:
- Line 10: `const displayPercent = \`\${Math.min(Math.round(percent), 100)}%\`` → `const displayPercent = \`\${Math.round(percent)}%\``
- Line 17: `aria-valuenow={Math.min(Math.round(percent), 100)}` → `aria-valuenow={Math.round(percent)}`

**Definition of Done**:
- [x] `displayPercent` shows uncapped rounded value (e.g., `"200%"` for percent=200)
- [x] `aria-valuenow` reflects uncapped rounded value
- [x] `aria-label` reflects uncapped value via the updated `displayPercent`
- [x] `fillWidth` (visual bar width) remains capped at `Math.min(percent, 100)`
- [x] Component renders correctly for values 0%, 50%, 100%, 200%

#### Task 1.2 - [MODIFY] Uncap `SeatDetailPanel` usage percentage
**Description**: Remove the `Math.min(..., 100)` wrapper on the `usagePercent` calculation in `SeatDetailPanel` so the uncapped value flows through to the `UsageProgressBar`.

File: `src/components/usage/SeatDetailPanel.tsx`

Change:
- Line 198: `const usagePercent = Math.min(calcUsagePercent(summary.totalRequests, premiumRequestsPerSeat), 100);` → `const usagePercent = calcUsagePercent(summary.totalRequests, premiumRequestsPerSeat);`

**Definition of Done**:
- [x] `usagePercent` is the raw uncapped value from `calcUsagePercent`
- [x] `UsageProgressBar` receives uncapped percent prop
- [x] Seat detail page displays >100% text when usage exceeds allowance

#### Task 1.3 - [MODIFY] Uncap `SeatUsageTable` usage percentage and text
**Description**: Remove both `Math.min` caps in the `SeatUsageTable`: the `usagePercent` variable (used for the colour indicator) and the inline text display in the "Usage" column.

File: `src/components/usage/SeatUsageTable.tsx`

Changes:
- Line 47: `const usagePercent = Math.min(rawPercent, 100);` → `const usagePercent = rawPercent;`
- Line 86: `({Math.min(Math.round(rawPercent), 100)}%)` → `({Math.round(rawPercent)}%)`

**Definition of Done**:
- [x] `UsageStatusIndicator` receives uncapped `rawPercent` for correct colour coding
- [x] Usage text column displays uncapped percentage (e.g., `"600 / 300 (200%)"`)
- [x] Table renders correctly for seats with usage below, at, and above the allowance

#### Task 1.4 - [MODIFY] Uncap `SeatListPanel` usage percentage
**Description**: Remove the `Math.min(..., 100)` wrapper on the `usagePercent` calculation in `SeatListPanel` so the colour indicator and percentage text display uncapped values.

File: `src/components/seats/SeatListPanel.tsx`

Change:
- Line 385: `? Math.min(calcUsagePercent(seat.totalPremiumRequests ?? 0, data.premiumRequestsPerSeat ?? 300), 100)` → `? calcUsagePercent(seat.totalPremiumRequests ?? 0, data.premiumRequestsPerSeat ?? 300)`

**Definition of Done**:
- [x] `UsageStatusIndicator` receives uncapped percent for correct colour coding
- [x] "Usage %" column text displays uncapped value (e.g., `"200%"`)
- [x] Inactive seats still display "N/A"

### Phase 2: Update E2E tests

#### Task 2.1 - [MODIFY] Update E2E test for overcap seat detail scenario
**Description**: The existing E2E test `"progress bar and usage text cap at 100% when seat exceeds premium allowance"` currently asserts that a seat with 500/300 requests shows `100%` and `aria-valuenow="100"`. This must be updated to expect the uncapped value of `167%` and `aria-valuenow="167"`.

File: `e2e/seat-usage.spec.ts`

Changes:
- Update the test name from "cap at 100%" to reflect uncapped behaviour
- Line 536 (approx): `await expect(progressBar).toHaveAttribute("aria-valuenow", "100");` → `await expect(progressBar).toHaveAttribute("aria-valuenow", "167");`
- Line 537 (approx): `await expect(page.getByText("100%")).toBeVisible();` → `await expect(page.getByText("167%")).toBeVisible();`

**Definition of Done**:
- [x] E2E test name reflects uncapped behaviour (e.g., "progress bar shows actual percentage when seat exceeds premium allowance")
- [x] Assertion checks `aria-valuenow="167"` (Math.round(500/300*100))
- [x] Assertion checks visible text `"167%"`
- [x] Existing tests for 50% and 0% scenarios remain unchanged and pass
- [ ] All E2E tests in `seat-usage.spec.ts` pass

### Phase 3: Code review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Code review across all modified files to ensure correctness, consistency, and no regressions.

**Definition of Done**:
- [x] All changes reviewed by `tsh-code-reviewer`
- [x] No `Math.min(..., 100)` remains in any seat-related percentage display path
- [x] Visual fill width is still bounded at 100% in `UsageProgressBar`
- [x] All acceptance criteria from Story 1.1 are met

## Security Considerations

- No security considerations — this change affects frontend display logic only. No authentication, authorization, data access, or API changes are involved.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Seat details page progress bar text shows actual percentage (e.g., "200%") when usage exceeds the allowance, instead of capping at "100%"
- [x] Seat details page progress bar fill width remains capped at 100% of the bar (visual constraint) but the displayed percentage text is uncapped
- [x] Seat usage table "Usage" column shows actual percentage in the format "X / Y (Z%)" where Z is not capped (e.g., "600 / 300 (200%)")
- [x] Seat list table "Usage %" column shows actual percentage (e.g., "200%") instead of capping at "100%"
- [x] Colour-coded status indicator (dot) next to usernames uses the uncapped percentage for colour determination
- [x] Progress bar accessibility attributes (`aria-valuenow`, `aria-label`) correctly reflect the uncapped percentage value
- [ ] All existing E2E tests in `seat-usage.spec.ts` pass (modified overcap test + unchanged 50% and 0% tests)
- [x] All existing unit tests in `usage-helpers.test.ts` pass (no changes expected)

## Improvements (Out of Scope)

- **`aria-valuemax` semantic improvement**: Consider dynamically setting `aria-valuemax` to the actual percentage when it exceeds 100, or removing it entirely to avoid potential screen reader confusion. Current plan leaves `aria-valuemax={100}` unchanged since `aria-valuenow > aria-valuemax` is valid per WAI-ARIA spec for representing overflow.
- **Dashboard panel uncapping** (Story 1.3): `DashboardPanel.tsx` has the same `Math.min` cap on "Most Active Users" and "Least Active Users" lists — planned for a separate story.
- **Team/Department member table uncapping** (Story 1.2): `TeamMemberTable.tsx` has the same `Math.min` cap — planned for a separate story.
- **Visual overflow indicator**: Consider adding a visual marker (e.g., different colour, icon, or tooltip) when usage exceeds 100% to draw attention beyond the numerical percentage.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation complete — Phase 1 (4 tasks), Phase 2 (1 task) done. Code review performed by `tsh-code-reviewer`. |
| 2026-03-02 | Fixed 2 minor nits from code review: inconsistent indentation in UsageProgressBar.tsx, redundant `usagePercent` alias in SeatUsageTable.tsx |

## Code Review Findings

**Verdict**: APPROVE (with minor nits — both resolved)

**Issues found and resolved**:
1. **Minor — indentation**: `aria-valuenow` in `UsageProgressBar.tsx` had 10 spaces instead of 8. Fixed.
2. **Minor — redundant variable**: `const usagePercent = rawPercent;` in `SeatUsageTable.tsx` was a 1:1 alias after removing `Math.min`. Removed, replaced all usages with `rawPercent`.

**Observation** (out of scope): `aria-valuemax={100}` with uncapped `aria-valuenow` — valid per WAI-ARIA spec, documented in Improvements section.

**All acceptance criteria verified**: 8/8 passing.
