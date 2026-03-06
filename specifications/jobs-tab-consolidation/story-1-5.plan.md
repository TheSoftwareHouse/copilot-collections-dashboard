# Story 1.5 — Reorder Management Tabs — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Reorder management tabs |
| Description | Change the management tab order to reflect usage frequency: Seats first (most used), Configuration last (one-time setup). Update the default active tab from Configuration to Seats. |
| Priority | High |
| Related Research | `specifications/jobs-tab-consolidation/extracted-tasks.md`, `specifications/jobs-tab-consolidation/jira-tasks.md` |

## Proposed Solution

Reorder the `TABS` array in `ManagementPageLayout.tsx` and change the `DEFAULT_TAB` constant. This is a minimal two-constant change in source code, with the rest being E2E test updates.

1. **Reorder `TABS` array** from `[configuration, departments, teams, users, seats]` to `[seats, departments, teams, users, configuration]`. Since tabs are rendered by iterating `TABS.map()`, the visual order changes automatically.

2. **Change `DEFAULT_TAB`** from `"configuration"` to `"seats"`. This affects three behaviors:
   - `resolveTab()` returns `"seats"` for invalid/missing tab params
   - The `useEffect` URL normalization sets `?tab=seats` when no tab param is present
   - `?tab=jobs` (and any other invalid value) now falls back to Seats instead of Configuration

3. **Update E2E tests** in `management-tabs.spec.ts` to expect Seats as the default tab instead of Configuration.

No changes are needed to the tabpanel rendering blocks — they use `activeTab === "..."` conditionals that are order-independent.

```
Before:
┌──────────────────────── Management Tab Bar ──────────────────────────┐
│ Configuration │ Departments │ Project Teams │ Users │ Seats          │
└──────────────────────────────────────────────────────────────────────┘
DEFAULT_TAB = "configuration"

After:
┌──────────────────────── Management Tab Bar ──────────────────────────┐
│ Seats │ Departments │ Project Teams │ Users │ Configuration          │
└──────────────────────────────────────────────────────────────────────┘
DEFAULT_TAB = "seats"
```

The NavBar links to `/management` without a `tab` parameter. The existing `useEffect` in `ManagementPageLayout` normalizes the URL by appending `?tab=<DEFAULT_TAB>` on arrival, so the NavBar link will automatically redirect to `?tab=seats` without any changes to NavBar.

## Current Implementation Analysis

### Already Implemented
- `TABS` array — `src/components/management/ManagementPageLayout.tsx` (line 14–20) — Defines tab IDs and labels. Currently ordered: configuration, departments, teams, users, seats.
- `DEFAULT_TAB` constant — `src/components/management/ManagementPageLayout.tsx` (line 25) — Currently set to `"configuration"`.
- `resolveTab()` function — `src/components/management/ManagementPageLayout.tsx` (line 27–32) — Validates tab param against `VALID_TAB_IDS`, falls back to `DEFAULT_TAB`. No logic change needed — it derives from the constants.
- `VALID_TAB_IDS` set — `src/components/management/ManagementPageLayout.tsx` (line 24) — Derived from `TABS.map()`. Picks up reordering automatically.
- `TabId` union type — `src/components/management/ManagementPageLayout.tsx` (line 22) — Derived from `TABS[number]["id"]`. Type remains the same after reordering.
- URL normalization `useEffect` — `src/components/management/ManagementPageLayout.tsx` (line 43–49) — Uses `DEFAULT_TAB`. Will automatically use `"seats"` after the constant change.
- NavBar — `src/components/NavBar.tsx` (line 10) — Links to `/management` without a tab param. No change needed.
- E2E tests for direct tab navigation — `e2e/management-tabs.spec.ts` — Tests for `?tab=departments`, `?tab=teams`, `?tab=users`, `?tab=seats` navigate explicitly and are unaffected by the default change.
- E2E tests in `e2e/configuration-settings.spec.ts` — All 7 occurrences explicitly navigate to `?tab=configuration`. Unaffected by default change.
- E2E tests in `e2e/azure-login.spec.ts` — Navigates to `/management` then clicks Users tab, or explicitly to `?tab=configuration`. Unaffected.

### To Be Modified
- `src/components/management/ManagementPageLayout.tsx` — Reorder `TABS` array entries (move `seats` to first position, `configuration` to last). Change `DEFAULT_TAB` from `"configuration"` to `"seats"`.
- `e2e/management-tabs.spec.ts` — Update 4 tests that reference Configuration as the default:
  1. "navigating to /management shows Configuration tab active by default" → expect Seats tab
  2. "clicking each tab" → update "back to default" section to click Seats (not Configuration)
  3. "navigating to /management?tab=jobs falls back to default Configuration tab" → expect Seats
  4. "invalid tab param defaults to Configuration tab" → expect Seats

### Not Changed
- Tabpanel rendering blocks in `ManagementPageLayout.tsx` — Conditional render using `activeTab === "..."` is order-independent
- `NavBar.tsx` — Links to `/management` without tab param; auto-redirects to new default
- `e2e/configuration-settings.spec.ts` — Explicitly navigates to `?tab=configuration`
- `e2e/azure-login.spec.ts` — Explicitly navigates to `?tab=configuration` or clicks specific tabs
- `e2e/first-run-setup.spec.ts` — No management tab references
- `e2e/dashboard.spec.ts` — No management tab references
- `e2e/seat-list.spec.ts` — Explicitly navigates to `?tab=seats`
- All API routes — No changes needed
- All other components — No changes needed

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| — | No open questions | This story is straightforward — it changes two constants and updates corresponding E2E assertions. | ✅ Resolved |

## Implementation Plan

### Phase 1: Reorder Tabs and Change Default

#### Task 1.1 - [MODIFY] Reorder TABS array and change DEFAULT_TAB in ManagementPageLayout
**Description**: Update `src/components/management/ManagementPageLayout.tsx`:
1. Reorder the `TABS` array so `seats` is the first entry and `configuration` is the last entry. The full order becomes: `seats`, `departments`, `teams`, `users`, `configuration`.
2. Change `DEFAULT_TAB` from `"configuration"` to `"seats"`.

No other changes are needed in this file. The `VALID_TAB_IDS` set, `TabId` type, `resolveTab()` function, URL normalization `useEffect`, `handleTabChange` callback, tab button rendering, and all tabpanel conditional blocks are all derived from these two constants and will work correctly after the change.

**Definition of Done**:
- [x] `TABS` array is ordered: seats, departments, teams, users, configuration
- [x] `DEFAULT_TAB` is `"seats"`
- [x] Tabs render visually in order: Seats, Departments, Project Teams, Users, Configuration
- [x] Navigating to `/management` (no tab param) shows Seats tab active
- [x] `?tab=seats` is set in the URL when no tab param is provided
- [x] TypeScript compilation passes with no errors

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update default-tab E2E tests in management-tabs.spec.ts
**Description**: Update `e2e/management-tabs.spec.ts` to reflect the new default tab (Seats instead of Configuration):

1. **"navigating to /management shows Configuration tab active by default"** test (line 34): Rename to "navigating to /management shows Seats tab active by default". Change assertions to expect `tab` with name `/seats/i` selected and `tabpanel` with name `/seats/i` visible.

2. **"clicking each tab shows correct content and updates URL"** test (lines 56–108): Update the final "back to default" section. Instead of clicking Configuration tab and asserting `?tab=configuration`, click Seats tab and assert `?tab=seats`. Since Seats is now the first tab and the test starts by clicking other tabs, clicking Seats at the end returns to the default. Reorder the tab-clicking sequence to match the new visual order: start from the second tab (Departments) through Configuration, then click back to Seats.

3. **"navigating to /management?tab=jobs falls back to default Configuration tab"** test (line 138): Rename to "navigating to /management?tab=jobs falls back to default Seats tab". Change assertions to expect `tab` with name `/seats/i` selected and `tabpanel` with name `/seats/i` visible.

4. **"invalid tab param defaults to Configuration tab"** test (line 181): Rename to "invalid tab param defaults to Seats tab". Change assertions to expect `tab` with name `/seats/i` selected and `tabpanel` with name `/seats/i` visible.

**Definition of Done**:
- [x] "navigating to /management" test expects Seats tab as default
- [x] "clicking each tab" test ends by returning to Seats tab (the default)
- [x] "?tab=jobs fallback" test expects Seats tab
- [x] "invalid tab param" test expects Seats tab
- [ ] All management-tabs E2E tests pass
- [x] Test names accurately describe the expected behavior

### Phase 3: Verification

#### Task 3.1 - [VERIFY] Run type checks and E2E tests
**Description**: Verify that all changes work correctly:
1. Run TypeScript compilation (`tsc --noEmit`) to verify no type errors.
2. Run ESLint to verify no lint warnings or errors.
3. Run all E2E tests related to management tabs and seats.

**Definition of Done**:
- [x] TypeScript compilation passes with no errors
- [x] ESLint reports no new warnings or errors
- [ ] `e2e/management-tabs.spec.ts` tests all pass
- [ ] `e2e/seat-list.spec.ts` tests all pass (no regressions from default tab change)
- [ ] `e2e/configuration-settings.spec.ts` tests all pass (explicit `?tab=configuration` navigation still works)

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a code review of all changes. The review should verify:
- Tab order matches requirements: Seats, Departments, Project Teams, Users, Configuration
- Default tab is Seats
- All E2E test assertions are updated consistently
- No other files or tests are broken by the default tab change

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **No new attack surface**: This story only reorders existing UI elements and changes a default selection. No new API endpoints, components, or data flows are introduced.
- **URL parameter handling**: The `resolveTab()` function already sanitizes the `tab` query parameter by validating against a whitelist (`VALID_TAB_IDS`). The whitelist contents are unchanged — only the fallback default changes from `"configuration"` to `"seats"`. Invalid values continue to be rejected and redirected to the default.
- **No authentication changes**: Tab reordering does not affect authentication or authorization.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Management tabs appear in order: Seats, Departments, Project Teams, Users, Configuration
- [x] The default active tab when navigating to `/management` is Seats
- [x] All tab content continues to render correctly after reordering
- [x] The URL parameter `?tab=seats` is set as the default when no tab param is provided
- [x] `?tab=jobs` falls back to Seats tab (not Configuration)
- [x] Invalid tab params fall back to Seats tab
- [x] Explicit navigation to `?tab=configuration` still works correctly
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors
- [ ] All E2E tests pass

## Improvements (Out of Scope)

- **Remove `JobStatusPanel` default export**: The `JobStatusPanel` default export became dead code after Story 1.4. Could be cleaned up in a separate task.
- **Keyboard navigation for tabs**: Arrow key navigation between tabs (WAI-ARIA tabs pattern) is not currently implemented. Could be added as a separate accessibility improvement.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation completed (Phases 1-3). TypeScript and ESLint pass cleanly. |
| 2026-03-05 | Code review by tsh-code-reviewer: 0 Critical, 0 High, 0 Medium, 0 Low, 3 Info. Verdict: Approved. Remaining action: run E2E suite against live environment. |
| 2026-03-05 | E2E run revealed 1 additional test in `e2e/configuration-settings.spec.ts` ("navigation bar is present with working links") that navigates to `/management` without explicit tab param and asserts Configuration is selected. Updated assertion to expect Seats (the new default). Not originally in plan because the test was categorized as "explicitly navigates to `?tab=configuration`" — but one test within the file navigates via NavBar link instead. |
