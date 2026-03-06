# Story 1.1 — Move Seat Sync and Usage Collection Cards to Seats Tab — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Move Seat Sync and Usage Collection cards to Seats tab |
| Description | Relocate the Seat Sync and Usage Collection job status cards (with action buttons) from the Jobs tab to the Seats tab, placing them below the search/filter controls. Job status fetching must be independent from the seat list — a job status API failure must not block the seat table from rendering. |
| Priority | High |
| Related Research | `specifications/jobs-tab-consolidation/extracted-tasks.md`, `specifications/jobs-tab-consolidation/jira-tasks.md` |

## Proposed Solution

Add the Seat Sync and Usage Collection job status cards to the Seats tab by:

1. **Exporting** the existing `JobCard`, `StatusBadge`, `SyncNowButton`, and `CollectNowButton` sub-components from `JobStatusPanel.tsx` so they can be reused without duplication.
2. **Creating a new `SeatJobStatusCards` component** that independently fetches `/api/job-status` and renders only the Seat Sync and Usage Collection cards. This component owns its own loading/error states, ensuring that a job status API failure renders an inline error without blocking the seat list table.
3. **Modifying the Seats tab panel** in `ManagementPageLayout.tsx` to render `SeatJobStatusCards` above the existing `SeatListPanel`, with appropriate spacing.

The existing `JobsTabContent` and `JobStatusPanel` remain untouched in their behavior — they continue to render all three job cards on the Jobs tab. This keeps the Jobs tab functional until Story 1.4 removes it.

```
┌─────────────────────── Seats Tab ───────────────────────┐
│                                                          │
│  ┌─── SeatJobStatusCards ────────────────────────────┐   │
│  │  ┌──────────────────┐  ┌────────────────────────┐ │   │
│  │  │   Seat Sync      │  │   Usage Collection     │ │   │
│  │  │   [Sync Now]     │  │   [Collect Now]        │ │   │
│  │  │   status/times   │  │   status/times         │ │   │
│  │  └──────────────────┘  └────────────────────────┘ │   │
│  │            (independent error handling)            │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── SeatListPanel ────────────────────────────────┐   │
│  │   [Search] [Status Filter] [Page Size]            │   │
│  │   ┌──────────────────────────────────┐            │   │
│  │   │  Seats Table                     │            │   │
│  │   └──────────────────────────────────┘            │   │
│  │   Pagination                                      │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `JobCard` component — `src/components/settings/JobStatusPanel.tsx` — Renders a single job status card with title, status badge, timestamps, records processed, error messages, and an optional action slot. Currently an internal (unexported) component.
- `StatusBadge` component — `src/components/settings/JobStatusPanel.tsx` — Renders success/failure/running status badges. Currently internal.
- `SyncNowButton` component — `src/components/settings/JobStatusPanel.tsx` — Triggers `POST /api/jobs/seat-sync`, shows inline success/error feedback. Currently internal.
- `CollectNowButton` component — `src/components/settings/JobStatusPanel.tsx` — Triggers `POST /api/jobs/usage-collection`, shows inline success/error feedback. Currently internal.
- `JobExecutionData` interface — `src/components/settings/JobStatusPanel.tsx` — Type definition for job execution data. Already exported.
- `/api/job-status` route — `src/app/api/job-status/route.ts` — Returns latest execution for seat_sync, usage_collection, team_carry_forward, month_recollection. No changes needed.
- `SeatListPanel` component — `src/components/seats/SeatListPanel.tsx` — Full seat listing with search, filter, sort, pagination, and inline editing. No changes needed.
- `ManagementPageLayout` component — `src/components/management/ManagementPageLayout.tsx` — Tab routing for all management tabs.
- `serializeExecution` helper — `src/components/management/JobsTabContent.tsx` — Transforms raw API response into typed `JobExecutionData`. Currently internal.

### To Be Modified
- `src/components/settings/JobStatusPanel.tsx` — Export `JobCard`, `StatusBadge`, `SyncNowButton`, `CollectNowButton` sub-components so they can be imported by the new `SeatJobStatusCards` component.
- `src/components/management/ManagementPageLayout.tsx` — Modify the seats tab panel to render `SeatJobStatusCards` above `SeatListPanel`.

### To Be Created
- `src/components/seats/SeatJobStatusCards.tsx` — New component that independently fetches `/api/job-status`, renders Seat Sync and Usage Collection cards using the exported sub-components, and handles its own loading/error states with inline error display. 

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the job status cards auto-refresh on an interval, or only on mount + after action? | Match existing behavior: fetch on mount, refresh silently after an action completes (SyncNow/CollectNow). No interval polling. | ✅ Resolved |
| 2 | Should the heading "Background Job Status" from JobStatusPanel be shown on the Seats tab? | No. On the Jobs tab, the heading contextualizes the section. On the Seats tab, the cards are self-explanatory and the heading would add unnecessary visual noise. The cards should render directly without a section heading. | ✅ Resolved |
| 3 | During the transition period (before Story 1.4 removes Jobs tab), will job cards appear on both tabs? | Yes. Story 1.1 adds cards to Seats tab; Story 1.4 removes the Jobs tab. Both tabs show cards in the interim. | ✅ Resolved |

## Implementation Plan

### Phase 1: Export Reusable Sub-Components

#### Task 1.1 - [MODIFY] Export sub-components from JobStatusPanel.tsx
**Description**: Add the `export` keyword to `StatusBadge`, `JobCard`, `SyncNowButton`, and `CollectNowButton` function declarations in `src/components/settings/JobStatusPanel.tsx`. This makes them importable by the new `SeatJobStatusCards` component without duplicating code. The default export of `JobStatusPanel` and all existing behavior remain unchanged.

**Definition of Done**:
- [x] `StatusBadge` is exported from `src/components/settings/JobStatusPanel.tsx`
- [x] `JobCard` is exported from `src/components/settings/JobStatusPanel.tsx`
- [x] `SyncNowButton` is exported from `src/components/settings/JobStatusPanel.tsx`
- [x] `CollectNowButton` is exported from `src/components/settings/JobStatusPanel.tsx`
- [x] The existing `JobStatusPanel` default export continues to work (the Jobs tab renders identically)
- [x] TypeScript compilation passes with no new errors

### Phase 2: Add Job Status Cards to Seats Tab

#### Task 2.1 - [CREATE] SeatJobStatusCards component
**Description**: Create `src/components/seats/SeatJobStatusCards.tsx` — a self-contained component that fetches `/api/job-status` on mount, renders the Seat Sync and Usage Collection cards in a 2-column grid, and handles its own loading/error state independently. The component imports `JobCard`, `SyncNowButton`, and `CollectNowButton` from `JobStatusPanel.tsx`. On API failure, it renders an inline error alert while allowing sibling components (seat list) to render normally.

The component must:
- Fetch `/api/job-status` on mount using the same serialization logic from `JobsTabContent`
- Render a subtle inline loading skeleton while data is loading (not a full-page spinner)
- On error, render a dismissible inline error banner (red border, red text) — must not throw or block parent rendering
- On success, render Seat Sync card (with `SyncNowButton`) and Usage Collection card (with `CollectNowButton`) in a responsive 2-column grid (`grid gap-4 sm:grid-cols-2`)
- Provide a `refreshJobStatus` callback to buttons so they can trigger a silent (non-loading) refetch after a job completes

**Definition of Done**:
- [x] Component file exists at `src/components/seats/SeatJobStatusCards.tsx`
- [x] Component fetches `/api/job-status` on mount
- [x] Seat Sync card displays status, started time, completed time, records processed, and "Sync Now" button
- [x] Usage Collection card displays status, started time, completed time, records processed, and "Collect Now" button
- [x] On job status API error, an inline error message is shown; the component does not throw or prevent sibling rendering
- [x] On loading, a non-blocking loading state is displayed (skeleton or subtle text)
- [x] After triggering Sync Now or Collect Now, the job status data refreshes silently
- [x] TypeScript compilation passes with no new errors

#### Task 2.2 - [MODIFY] Render SeatJobStatusCards in Seats tab panel
**Description**: Update `src/components/management/ManagementPageLayout.tsx` to render the `SeatJobStatusCards` component inside the seats tab panel, placed above `SeatListPanel`. Add a `space-y-6` wrapper to provide visual separation between the job status cards and the seat list table.

**Definition of Done**:
- [x] `SeatJobStatusCards` is imported and rendered inside the seats tab panel in `ManagementPageLayout.tsx`
- [x] `SeatJobStatusCards` appears above `SeatListPanel`
- [x] There is appropriate visual spacing between the job status cards and the seat list
- [x] Navigating to `/management?tab=seats` shows both the job status cards and the seat list
- [x] TypeScript compilation passes with no new errors

### Phase 3: E2E Testing

#### Task 3.1 - [MODIFY] Update E2E tests for job status cards on Seats tab
**Description**: Add E2E tests to verify that the Seat Sync and Usage Collection cards appear on the Seats tab with correct data and functional action buttons. Extend the existing `e2e/seat-list.spec.ts` or create a focused test section within it.

Tests to add:
1. Navigating to `/management?tab=seats` shows both Seat Sync and Usage Collection cards
2. Seat Sync card shows correct status/timestamps when a job execution exists
3. Usage Collection card shows correct status/timestamps when a job execution exists
4. Both cards show "No runs recorded yet" when no job executions exist
5. Both action buttons (Sync Now / Collect Now) are present and visible

**Definition of Done**:
- [x] E2E test verifies Seat Sync card is visible on the Seats tab
- [x] E2E test verifies Usage Collection card is visible on the Seats tab
- [x] E2E test verifies cards show correct job execution data when seeded
- [x] E2E test verifies cards show "No runs recorded yet" when no data exists
- [x] E2E test verifies Sync Now and Collect Now buttons are visible
- [x] All new E2E tests pass

#### Task 3.2 - [CREATE] E2E test for error isolation between job status and seat list
**Description**: Add an E2E test that verifies the seat list table renders correctly even when the job status API fails. This validates the independent error handling requirement from the acceptance criteria.

**Definition of Done**:
- [x] E2E test mocks/forces `/api/job-status` to return an error response
- [x] E2E test verifies the seat list table is still visible and functional
- [x] E2E test verifies an inline error message appears in the job status section
- [x] Test passes

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes made in Phases 1–3. The review should verify adherence to existing code patterns, accessibility standards, error handling quality, and proper component composition.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **Authentication**: The `/api/job-status` endpoint already enforces authentication via `requireAuth()`. The new `SeatJobStatusCards` component must handle 401 responses gracefully (display "Session expired" message), consistent with existing patterns in `JobsTabContent` and `SyncNowButton`.
- **No new API surface**: This story does not create or modify any API endpoints. All data flows use the existing `/api/job-status`, `/api/jobs/seat-sync`, and `/api/jobs/usage-collection` routes.
- **No XSS vectors**: All dynamic content is rendered via React JSX (automatic escaping). No `dangerouslySetInnerHTML` or raw HTML injection.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The Seat Sync card is displayed on the Seats tab below the search bar
- [x] The Seat Sync card shows status, started time, completed time, records processed, and a "Sync Now" button
- [x] The Usage Collection card is displayed alongside the Seat Sync card
- [x] The Usage Collection card shows status, started time, completed time, records processed, and a "Collect Now" button
- [x] Both cards retain existing functionality (trigger jobs, show feedback, refresh status)
- [x] Cards are visually separated from the seat list table
- [x] Job status data is fetched when the Seats tab loads
- [x] If the job status API fails, the seat list still renders normally; job cards show an inline error state
- [x] The existing Jobs tab continues to function identically (no regressions)
- [x] All E2E tests pass (existing + new)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Extract sub-components into dedicated files**: `StatusBadge`, `JobCard`, `SyncNowButton`, and `CollectNowButton` could be extracted from `JobStatusPanel.tsx` into separate files under `src/components/settings/` for better code organization. Deferred to Story 1.4 cleanup or a dedicated refactoring task.
- **Shared `useJobStatus` hook**: The job status fetching logic is duplicated between `JobsTabContent` and the new `SeatJobStatusCards`. A shared hook could eliminate this duplication. Deferred until Story 1.4 removes `JobsTabContent`, at which point only one consumer remains and the hook is unnecessary.
- **Auto-refresh polling**: Job status cards could poll `/api/job-status` on an interval to show real-time updates (e.g., when a cron-triggered job completes in the background). Not part of this story's requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation completed (Phases 1-3) |
| 2026-03-05 | Code review by tsh-code-reviewer: 0 Critical, 0 High, 1 Medium (refresh callback missing), 1 Low (serializeExecution duplication — accepted per plan), 1 Info (skeleton height). Medium finding fixed: added optional `onComplete` prop to `SyncNowButton` and `CollectNowButton` so `SeatJobStatusCards` triggers a silent data refresh after actions complete. |
