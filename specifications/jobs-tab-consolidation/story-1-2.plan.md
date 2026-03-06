# Story 1.2 — Combine Month Recollection Status into Month Data Recollection Card — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Combine Month Recollection status into Month Data Recollection card |
| Description | Remove the standalone Month Recollection status card from the job status grid and integrate a lightweight status badge into the Month Data Recollection form, so administrators can see the last recollection result (success/failure) directly in the form without a separate card. |
| Priority | High |
| Related Research | `specifications/jobs-tab-consolidation/extracted-tasks.md`, `specifications/jobs-tab-consolidation/jira-tasks.md` |

## Proposed Solution

Simplify the month recollection UI by removing the full `JobCard` for month recollection and adding a `StatusBadge` directly into the `MonthRecollectionPanel` form header. The approach:

1. **Remove the Month Recollection `JobCard`** from `JobStatusPanel`'s default export. The `monthRecollection` field is dropped from the component's props interface and the third card is no longer rendered. This affects the Jobs tab only (the standalone `JobCard` disappears).
2. **Add a `lastJobStatus` prop** to `MonthRecollectionPanel`. When provided, render a `StatusBadge` (imported from `JobStatusPanel`) next to the "Month Data Recollection" heading. When `null`/`undefined`, no badge is shown (first run, no history).
3. **Track status locally after recollection**. After the user triggers a recollection and the API responds, update a local state variable so the badge immediately reflects the new success/failure status — without requiring a full page refresh.
4. **Wire the status** in `JobsTabContent`. Pass `data.monthRecollection?.status` to `MonthRecollectionPanel` so the badge shows the last known status on page load.

```
┌───────── Month Data Recollection (inside Jobs tab) ──────────┐
│                                                               │
│  Month Data Recollection  [Success]  ← StatusBadge            │
│  Re-fetch usage data from GitHub for every seat …             │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  [Month ▼]  [Year ▼]  [Recalculate Month]               │ │
│  │                                                          │ │
│  │  "Recollected 310 records for 15 users"  ← feedback msg  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  (No more standalone JobCard with timestamps / records)       │
└───────────────────────────────────────────────────────────────┘
```

This is intentionally minimal — Story 1.3 will later move this form into a modal. The prop-based approach keeps `MonthRecollectionPanel` decoupled so it works both inline (Jobs tab, current) and inside a modal (Seats tab, Story 1.3).

## Current Implementation Analysis

### Already Implemented
- `StatusBadge` component — `src/components/settings/JobStatusPanel.tsx` — Renders success/failure/running badges. Already exported.
- `JobCard` component — `src/components/settings/JobStatusPanel.tsx` — Full card with timestamps, records processed, error details. Already exported. Currently renders the Month Recollection card in the job status grid.
- `MonthRecollectionPanel` component — `src/components/settings/MonthRecollectionPanel.tsx` — Form with month/year selectors, "Recalculate Month" button, and inline success/error feedback messages. Accepts `onComplete` prop. Does NOT currently show a status badge from the last job execution.
- `JobsTabContent` component — `src/components/management/JobsTabContent.tsx` — Fetches `/api/job-status`, passes all three job types to `JobStatusPanel`, and renders `MonthRecollectionPanel` with `onComplete` callback.
- `JobStatusPanel` default export — `src/components/settings/JobStatusPanel.tsx` — Renders a 2-column grid of three `JobCard`s: Seat Sync, Usage Collection, Month Recollection.
- `/api/job-status` route — `src/app/api/job-status/route.ts` — Returns `monthRecollection` with `status`, `startedAt`, `completedAt`, `errorMessage`, `recordsProcessed`. No changes needed.
- `SeatJobStatusCards` component — `src/components/seats/SeatJobStatusCards.tsx` — Only renders Seat Sync and Usage Collection cards on the Seats tab. Does not render month recollection. No changes needed.

### To Be Modified
- `src/components/settings/JobStatusPanel.tsx` — Remove the Month Recollection `JobCard` from the default export. Remove `monthRecollection` from `JobStatusPanelProps`.
- `src/components/settings/MonthRecollectionPanel.tsx` — Add optional `lastJobStatus` prop. Import and render `StatusBadge` next to the heading. Track status locally after recollection completes.
- `src/components/management/JobsTabContent.tsx` — Pass `data.monthRecollection?.status` to `MonthRecollectionPanel` as the `lastJobStatus` prop.
- `e2e/job-status.spec.ts` — Update tests: change expected card count from 3 to 2, remove/update month recollection card assertions.
- `e2e/month-recollection.spec.ts` — Add tests verifying the status badge appears and updates.

### To Be Created
Nothing — all changes modify existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Where exactly should the status badge be placed in the MonthRecollectionPanel? | Next to the "Month Data Recollection" heading, inline on the right side. This mirrors how `JobCard` places the `StatusBadge` next to the card title. | ✅ Resolved |
| 2 | Should the badge show "No runs yet" when there is no previous execution? | No. When `lastJobStatus` is null/undefined, no badge is rendered at all. The absence of a badge implicitly means no history. This keeps the UI clean. | ✅ Resolved |
| 3 | After a recollection completes, should the badge show the new status immediately or wait for a re-fetch? | Immediately. The local state is updated based on the API response from the recollection trigger (`success` or `failure`). The `onComplete` callback still fires to let the parent re-fetch for overall consistency. | ✅ Resolved |
| 4 | Does `JobsTabContent` still need to pass `monthRecollection` to `JobStatusPanel`? | No. Since the Month Recollection card is removed from `JobStatusPanel`, the `monthRecollection` field is dropped from the props. `JobsTabContent` only passes `seatSync` and `usageCollection` to `JobStatusPanel`. | ✅ Resolved |

## Implementation Plan

### Phase 1: Remove Month Recollection Card from Job Status Grid

#### Task 1.1 - [MODIFY] Remove Month Recollection card from JobStatusPanel
**Description**: Update `src/components/settings/JobStatusPanel.tsx` to remove the `monthRecollection` field from the `JobStatusPanelProps` interface and remove the third `<JobCard title="Month Recollection" …>` from the rendered grid. The component will now only render Seat Sync and Usage Collection cards.

**Definition of Done**:
- [x] `monthRecollection` field is removed from the `JobStatusPanelProps` `data` interface
- [x] The Month Recollection `JobCard` is no longer rendered in `JobStatusPanel`
- [x] `JobStatusPanel` renders exactly 2 cards: Seat Sync and Usage Collection
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [MODIFY] Update JobsTabContent to match new JobStatusPanel props
**Description**: Update `src/components/management/JobsTabContent.tsx` to stop passing `monthRecollection` in the `data` prop to `JobStatusPanel`. The `monthRecollection` data is still fetched (needed for the badge in `MonthRecollectionPanel`) but no longer passed to `JobStatusPanel`.

**Definition of Done**:
- [x] `JobsTabContent` passes only `seatSync` and `usageCollection` to `JobStatusPanel`'s `data` prop
- [x] `monthRecollection` data is still fetched from the API (retained in state for use by `MonthRecollectionPanel`)
- [x] TypeScript compilation passes with no new errors

### Phase 2: Add Status Badge to Month Data Recollection Form

#### Task 2.1 - [MODIFY] Add lastJobStatus prop and StatusBadge to MonthRecollectionPanel
**Description**: Update `src/components/settings/MonthRecollectionPanel.tsx` to:
1. Accept an optional `lastJobStatus` prop (type `string | null`)
2. Import `StatusBadge` from `JobStatusPanel`
3. Render the `StatusBadge` next to the "Month Data Recollection" heading when `lastJobStatus` is provided
4. Track the status locally: initialize from `lastJobStatus` prop, update after recollection completes based on the API response's `status` field

The heading area changes from:
```
<h2>Month Data Recollection</h2>
```
to:
```
<div className="flex items-center gap-2">
  <h2>Month Data Recollection</h2>
  {displayStatus && <StatusBadge status={displayStatus} />}
</div>
```

The local `displayStatus` state is initialized from `lastJobStatus` and updated to `body.status` after a successful or failed recollection API call.

**Definition of Done**:
- [x] `MonthRecollectionPanel` accepts an optional `lastJobStatus` prop of type `string | null`
- [x] When `lastJobStatus` is provided, a `StatusBadge` is rendered next to the heading
- [x] When `lastJobStatus` is `null` or `undefined`, no badge is rendered
- [x] After a recollection completes (success or failure), the badge updates to reflect the new status
- [x] The existing inline success/error feedback messages continue to work as before
- [x] TypeScript compilation passes with no new errors

#### Task 2.2 - [MODIFY] Pass month recollection status from JobsTabContent to MonthRecollectionPanel
**Description**: Update `src/components/management/JobsTabContent.tsx` to pass `data.monthRecollection?.status ?? null` as the `lastJobStatus` prop to `MonthRecollectionPanel`.

**Definition of Done**:
- [x] `MonthRecollectionPanel` receives `lastJobStatus={data.monthRecollection?.status ?? null}` in `JobsTabContent`
- [x] On the Jobs tab, the status badge shows the correct last job status on page load
- [x] After triggering a recollection and the parent re-fetches job status, the prop stays in sync
- [x] TypeScript compilation passes with no new errors

### Phase 3: Update E2E Tests

#### Task 3.1 - [MODIFY] Update job-status E2E tests for 2-card grid
**Description**: Update `e2e/job-status.spec.ts` to reflect that MonJob Recollection is no longer shown as a `JobCard` in the job status grid:
1. Change the "No runs recorded yet" count assertion from 3 to 2
2. Remove or update the two month recollection card tests ("shows success status for month recollection" and "shows failure status with error message for month recollection") — these cards no longer exist; the status is now a badge in the MonthRecollectionPanel form

**Definition of Done**:
- [x] "No runs recorded yet" count assertion updated from 3 to 2
- [x] Month recollection `JobCard` assertions removed (card no longer exists)
- [x] Seat Sync and Usage Collection card tests remain unchanged
- [x] All E2E tests in `job-status.spec.ts` pass

#### Task 3.2 - [MODIFY] Add status badge E2E tests to month-recollection spec
**Description**: Add E2E tests to `e2e/month-recollection.spec.ts` that verify:
1. When a successful month recollection execution exists, a success status badge is visible in the Month Data Recollection section
2. When a failed month recollection execution exists, a failure status badge is visible
3. When no month recollection execution exists, no status badge is shown in the heading area
4. After triggering a recollection that succeeds, the badge updates to show success

**Definition of Done**:
- [x] E2E test verifies success badge is displayed when a successful `month_recollection` job execution is seeded
- [x] E2E test verifies failure badge is displayed when a failed `month_recollection` job execution is seeded
- [x] E2E test verifies no badge is shown when no `month_recollection` execution exists
- [x] E2E test verifies badge updates after a recollection completes
- [x] All E2E tests in `month-recollection.spec.ts` pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes made in Phases 1–3. The review should verify adherence to existing code patterns, correct prop threading, `StatusBadge` reuse consistency, accessibility of the badge within the form heading, and that no regressions were introduced to the Jobs tab.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **No new API surface**: This story does not create or modify any API endpoints. The existing `/api/job-status` and `/api/jobs/month-recollection` routes are used unchanged.
- **No XSS vectors**: The `StatusBadge` renders status strings via React JSX (automatic escaping). The status values come from the database (`success`, `failure`, `running`) and are not user-controlled free text.
- **Authentication unchanged**: All API calls continue to use `requireAuth()`. No new unauthenticated paths are introduced.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The standalone Month Recollection status card is removed from the job status grid
- [x] The Month Data Recollection form displays a status badge showing the last job result (success/failure)
- [x] The status badge updates after a recollection completes
- [x] Full job details (started time, completed time, records processed) are no longer shown for month recollection
- [x] The Seat Sync and Usage Collection cards continue to render correctly (no regressions)
- [x] The Month Data Recollection form retains all existing functionality (month/year selectors, recalculate button, feedback messages)
- [x] All E2E tests pass (existing + updated)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Extract `MonthRecollectionPanel` status fetching into a hook**: Currently the status is passed as a prop from the parent. When Story 1.3 moves the form into a modal on the Seats tab, the status will need to come from `SeatJobStatusCards`'s fetch. A shared hook could centralize this, but the prop-based approach is sufficient for now and keeps the component simple.
- **Add loading skeleton for status badge**: The badge could show a small skeleton while job status data is loading. Since the form content already implies a functioning state, the badge simply not appearing during load is acceptable.
- **Animate badge transitions**: A subtle CSS transition when the badge changes from one status to another would improve UX, but is not required by the acceptance criteria.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation completed (Phases 1-3) |
| 2026-03-05 | Code review by tsh-code-reviewer: 0 Critical, 0 High, 0 Medium, 2 Low (displayStatus won't sync on prop change after mount — acceptable per current flow; duplicated seedJobExecution E2E helper — low priority), 3 Info. Verdict: Approved. All E2E tests pass (13/13). |
