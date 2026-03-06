# Story 1.4 — Remove the Jobs Tab from Management Area — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Remove the Jobs tab from management area |
| Description | With all job features moved to the Seats tab (Stories 1.1–1.3), remove the Jobs tab entirely. Navigating to `?tab=jobs` must fall back to the default tab. Delete the `JobsTabContent` component and all E2E tests that target the now-removed Jobs tab. |
| Priority | High |
| Related Research | `specifications/jobs-tab-consolidation/extracted-tasks.md`, `specifications/jobs-tab-consolidation/jira-tasks.md` |

## Proposed Solution

Remove the Jobs tab from the management area by making three categories of changes:

1. **Remove the "Jobs" entry from `TABS` array** in `ManagementPageLayout.tsx` and delete the associated import, tabpanel block, and `JobsTabContent` reference. The existing `resolveTab()` function already falls back to `DEFAULT_TAB` ("configuration") for any unrecognized tab ID, so `?tab=jobs` will automatically redirect to the Configuration tab with no additional logic needed.

2. **Delete `JobsTabContent.tsx`** — the component is only imported by `ManagementPageLayout.tsx` and becomes dead code after Step 1. It contains a duplicated `serializeExecution` helper and a fetch for `/api/job-status` — both of which are already implemented in `SeatJobStatusCards.tsx`.

3. **Clean up E2E tests** that target `?tab=jobs`:
   - **Delete `e2e/job-status.spec.ts`** (4 tests) — all tests navigate to `?tab=jobs` and verify job status cards on the Jobs tab. These scenarios are already covered by "Job Status Cards on Seats Tab" tests in `e2e/seat-list.spec.ts` (4 tests).
   - **Delete `e2e/month-recollection.spec.ts`** (9 tests) — all tests navigate to `?tab=jobs` and verify the Month Recollection form. These scenarios are already covered by "Month Data Recollection Modal on Seats Tab" tests in `e2e/seat-list.spec.ts` (8 tests).
   - **Update `e2e/management-tabs.spec.ts`** — remove the Jobs tab section from the "clicking each tab" test, and replace the "navigating directly to ?tab=jobs" test with a test verifying `?tab=jobs` falls back to the default tab.

```
Before:
┌──────────────────────── Management Tab Bar ────────────────────────┐
│ Configuration │ Departments │ Project Teams │ Jobs │ Users │ Seats │
└────────────────────────────────────────────────────────────────────┘

After:
┌─────────────────────── Management Tab Bar ────────────────────┐
│ Configuration │ Departments │ Project Teams │ Users │ Seats   │
└───────────────────────────────────────────────────────────────┘

?tab=jobs → resolveTab("jobs") → not in VALID_TAB_IDS → DEFAULT_TAB ("configuration")
```

## Current Implementation Analysis

### Already Implemented
- `SeatJobStatusCards` component — `src/components/seats/SeatJobStatusCards.tsx` — Renders Seat Sync + Usage Collection cards with action buttons, "Select Month" modal with `MonthRecollectionPanel`, and independent `/api/job-status` fetching. This fully replaces the job-related features that were on the Jobs tab.
- `resolveTab()` function — `src/components/management/ManagementPageLayout.tsx` — Validates the `tab` query parameter against `VALID_TAB_IDS`. Returns `DEFAULT_TAB` ("configuration") for any unrecognized value. Once "jobs" is removed from `TABS`, `?tab=jobs` will naturally fall back.
- E2E coverage on Seats tab — `e2e/seat-list.spec.ts` — Contains "Job Status Cards on Seats Tab" (4 tests) and "Month Data Recollection Modal on Seats Tab" (8 tests) that cover the same scenarios as the Jobs-tab E2E tests being removed.

### To Be Modified
- `src/components/management/ManagementPageLayout.tsx` — Remove `{ id: "jobs", label: "Jobs" }` from `TABS` array, delete the `import JobsTabContent` statement, delete the `{activeTab === "jobs" && (...)}` tabpanel block.
- `e2e/management-tabs.spec.ts` — Remove the Jobs tab section from the "clicking each tab shows correct content" test. Replace the "navigating directly to ?tab=jobs shows Jobs tab active" test with a "navigating to ?tab=jobs falls back to default Configuration tab" test.

### To Be Deleted
- `src/components/management/JobsTabContent.tsx` — Dead code after removing the Jobs tab. Only imported by `ManagementPageLayout.tsx`.
- `e2e/job-status.spec.ts` — All 4 tests navigate to `?tab=jobs`. Equivalent coverage exists in `e2e/seat-list.spec.ts`.
- `e2e/month-recollection.spec.ts` — All 9 tests navigate to `?tab=jobs`. Equivalent coverage exists in `e2e/seat-list.spec.ts`.

### Not Changed
- `src/components/settings/JobStatusPanel.tsx` — The default export (`JobStatusPanel`) is no longer imported anywhere after `JobsTabContent` is deleted, but the named exports (`JobCard`, `StatusBadge`, `SyncNowButton`, `CollectNowButton`, `JobExecutionData`) are still used by `SeatJobStatusCards` and `MonthRecollectionPanel`. The unused default export is harmless dead code and can be cleaned up separately — out of scope for this story.
- `src/components/settings/MonthRecollectionPanel.tsx` — No changes needed. Already supports `hideHeading` prop for modal usage.
- `src/components/seats/SeatJobStatusCards.tsx` — No changes needed. Already fully functional.
- `/api/job-status` route — No changes needed. Still serves `SeatJobStatusCards`.
- `/api/jobs/*` routes — No changes needed. Still serve action buttons and month recollection.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `e2e/job-status.spec.ts` be deleted or migrated to test on the Seats tab? | Deleted. The "Job Status Cards on Seats Tab" describe block in `e2e/seat-list.spec.ts` (4 tests) already covers the same scenarios: empty state, success status, failure status, and latest-execution-per-type. No migration needed. | ✅ Resolved |
| 2 | Should `e2e/month-recollection.spec.ts` be deleted or migrated? | Deleted. The "Month Data Recollection Modal on Seats Tab" block in `e2e/seat-list.spec.ts` (8 tests) covers form rendering, month/year selectors, status badges, success/failure flows, and modal interactions. The only scenario not duplicated is the API-mocked "already running" error, but this is an API-level guard tested adequately through the existing coverage. | ✅ Resolved |
| 3 | Should the `JobStatusPanel` default export be removed since it becomes unused? | No — out of scope. The default export is harmless dead code. Removing it would change the file's export structure and could be cleaned up in a future Story 1.5 or separate task. Keeping the change set minimal reduces risk. | ✅ Resolved |
| 4 | Does the `?tab=jobs` fallback need a dedicated E2E test? | Yes. Although `management-tabs.spec.ts` already has an "invalid tab param defaults to Configuration tab" test using `?tab=nonexistent`, the acceptance criteria specifically require verifying that `?tab=jobs` falls back to the default tab. A dedicated test for `?tab=jobs` documents this behavior explicitly. | ✅ Resolved |

## Implementation Plan

### Phase 1: Remove Jobs Tab from ManagementPageLayout

#### Task 1.1 - [MODIFY] Remove "Jobs" tab entry and tabpanel from ManagementPageLayout
**Description**: Update `src/components/management/ManagementPageLayout.tsx` to:
1. Delete the `import JobsTabContent from "@/components/management/JobsTabContent";` line.
2. Remove `{ id: "jobs", label: "Jobs" }` from the `TABS` array.
3. Delete the entire `{activeTab === "jobs" && (...)}` tabpanel block (lines 121–129).

After this change, the `TABS` array will contain 5 tabs: `configuration`, `departments`, `teams`, `users`, `seats`. The `TabId` union type will automatically exclude `"jobs"` since it derives from `TABS`. The `VALID_TAB_IDS` set will no longer contain `"jobs"`, so `resolveTab("jobs")` returns `"configuration"`.

**Definition of Done**:
- [x] `import JobsTabContent` is removed from ManagementPageLayout.tsx
- [x] "Jobs" entry is removed from `TABS` array — only 5 tabs remain
- [x] The `{activeTab === "jobs" && (...)}` tabpanel block is deleted
- [x] `?tab=jobs` falls back to the default "configuration" tab (verified by `resolveTab` logic)
- [x] TypeScript compilation passes with no errors

#### Task 1.2 - [DELETE] Remove JobsTabContent component
**Description**: Delete the file `src/components/management/JobsTabContent.tsx`. It is dead code — no longer imported anywhere after Task 1.1. The file contains ~105 lines including a duplicated `serializeExecution` helper, job status fetching logic, and rendering of `JobStatusPanel` + `MonthRecollectionPanel` — all of which are now handled by `SeatJobStatusCards` on the Seats tab.

**Definition of Done**:
- [x] `src/components/management/JobsTabContent.tsx` is deleted
- [x] No import references to `JobsTabContent` remain in the codebase
- [x] TypeScript compilation passes with no errors

### Phase 2: Clean Up E2E Tests

#### Task 2.1 - [DELETE] Remove job-status E2E tests
**Description**: Delete the file `e2e/job-status.spec.ts`. All 4 tests navigate to `?tab=jobs` and test job status cards on the Jobs tab. These scenarios are already covered by the "Job Status Cards on Seats Tab" describe block in `e2e/seat-list.spec.ts`:
- "No runs recorded yet" → covered by empty-state card test
- Success status with timestamp → covered by success badge test
- Failure status with error → covered by failure badge test
- Latest execution per type → covered by latest-execution test

**Definition of Done**:
- [x] `e2e/job-status.spec.ts` is deleted
- [x] No other test files import from or depend on `job-status.spec.ts`

#### Task 2.2 - [DELETE] Remove month-recollection E2E tests
**Description**: Delete the file `e2e/month-recollection.spec.ts`. All 9 tests navigate to `?tab=jobs` and test the Month Recollection form on the Jobs tab. These scenarios are covered by the "Month Data Recollection Modal on Seats Tab" describe block in `e2e/seat-list.spec.ts`:
- Form rendering (selectors, button) → covered by modal form tests
- Month/year selector options → covered by modal selector tests
- Status badges (success/failure/none) → covered by modal status badge tests
- Status badge updates after recollection → covered by modal success/failure flow tests

**Definition of Done**:
- [x] `e2e/month-recollection.spec.ts` is deleted
- [x] No other test files import from or depend on `month-recollection.spec.ts`

#### Task 2.3 - [MODIFY] Update management-tabs E2E tests
**Description**: Update `e2e/management-tabs.spec.ts` to:
1. In the "clicking each tab shows correct content and updates URL" test, remove the Jobs tab section (the block that clicks the Jobs tab, asserts `?tab=jobs` URL, asserts `tab` selected, and asserts tabpanel visible — approximately 10 lines).
2. Replace the "navigating directly to /management?tab=jobs shows Jobs tab active" test with a new test: "navigating to /management?tab=jobs falls back to default Configuration tab". The new test navigates to `?tab=jobs` and asserts that the Configuration tab is selected and the Configuration tabpanel is visible — matching the behavior of the existing "invalid tab param defaults to Configuration tab" test.

**Definition of Done**:
- [x] The "clicking each tab" test no longer includes a Jobs tab section
- [x] The "navigating to ?tab=jobs" test verifies fallback to Configuration tab
- [x] All management-tabs E2E tests pass
- [x] The test count in management-tabs.spec.ts remains the same (test replaced, not removed)

### Phase 3: Verification

#### Task 3.1 - [VERIFY] Run full E2E and type checks
**Description**: Verify that all changes work correctly together:
1. Run TypeScript compilation (`tsc --noEmit`) to verify no type errors.
2. Run ESLint to verify no lint warnings or errors.
3. Run all E2E tests related to management tabs and seats to verify no regressions.

**Definition of Done**:
- [x] TypeScript compilation passes with no errors
- [x] ESLint reports no new warnings or errors
- [x] `e2e/management-tabs.spec.ts` tests all pass
- [x] `e2e/seat-list.spec.ts` tests all pass
- [x] No E2E tests reference `?tab=jobs` or `JobsTabContent`

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes. The review should verify:
- Complete removal of all Jobs tab references in source code
- Correct E2E test cleanup — no orphaned tests or missing coverage
- No regressions to remaining tabs (Configuration, Departments, Teams, Users, Seats)
- The `?tab=jobs` fallback behavior is correctly tested

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **No new attack surface**: This story only removes code — no new API endpoints, components, or data flows are introduced.
- **No authentication changes**: The removal of the Jobs tab does not affect authentication or authorization. The `/api/job-status` and `/api/jobs/*` endpoints remain protected by `requireAuth()` and continue to serve `SeatJobStatusCards` on the Seats tab.
- **URL parameter handling**: The `resolveTab()` function already sanitizes the `tab` query parameter by validating against a whitelist (`VALID_TAB_IDS`). Removing "jobs" from the set means `?tab=jobs` is treated identically to any other invalid value — it falls back to the default tab. No additional validation is needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The "Jobs" tab is no longer visible in the management tab bar
- [x] Navigating to `?tab=jobs` falls back to the default Configuration tab
- [x] The `JobsTabContent` component file is deleted
- [x] No imports or references to `JobsTabContent` remain in source code
- [x] No E2E tests navigate to `?tab=jobs` (all such tests deleted or updated)
- [x] The "Job Status Cards on Seats Tab" tests continue to pass (no regressions)
- [x] The "Month Data Recollection Modal on Seats Tab" tests continue to pass (no regressions)
- [x] The management-tabs E2E tests all pass (with updated Jobs tab test)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Remove `JobStatusPanel` default export**: After `JobsTabContent` is deleted, the `JobStatusPanel` default export becomes dead code (only named exports are used by `SeatJobStatusCards` and `MonthRecollectionPanel`). Removing the default export and its associated render function (~30 lines) would reduce dead code. Deferred to avoid changing the export structure of a shared file in this story.
- **Remove duplicated `serializeExecution` helper**: Both `SeatJobStatusCards` and the now-deleted `JobsTabContent` had this helper. After deletion, only one copy remains in `SeatJobStatusCards`. No action needed — the duplication is naturally resolved.
- **Tab reordering (Story 1.5)**: The next story will reorder tabs to put Seats first and Configuration last. Not part of this story.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation completed (Phases 1-3) |
| 2026-03-05 | Code review by tsh-code-reviewer: 0 Critical, 0 High, 0 Medium, 0 Low, 3 Info. Verdict: Approved. All E2E tests pass (8/8 management-tabs, 18/18 seat-list). |
