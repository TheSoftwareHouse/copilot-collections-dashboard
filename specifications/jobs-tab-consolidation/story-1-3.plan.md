# Story 1.3 — Open Month Data Recollection in a Modal from Seat Sync Card — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Open Month Data Recollection in a modal from Seat Sync card |
| Description | Add a "Select Month" button to the Seat Sync card on the Seats tab that opens a modal containing the Month Data Recollection form (month selector, year selector, recalculate button, and status badge from Story 1.2). The modal stays open after a successful recollection so the user can review the result. |
| Priority | High |
| Related Research | `specifications/jobs-tab-consolidation/extracted-tasks.md`, `specifications/jobs-tab-consolidation/jira-tasks.md` |

## Proposed Solution

Wire the existing `Modal` component and `MonthRecollectionPanel` into the `SeatJobStatusCards` component on the Seats tab:

1. **Extend `SeatJobStatusCards`** to also parse `monthRecollection` from the `/api/job-status` response (currently ignored). This provides the `lastJobStatus` for the `MonthRecollectionPanel` status badge.
2. **Add a "Select Month" button** to the Seat Sync card's action slot, alongside the existing "Sync Now" button. The button uses a secondary (outline) style to visually differentiate it from the primary action.
3. **Add modal state** (`isModalOpen`) to `SeatJobStatusCards`. Clicking "Select Month" opens the modal; clicking outside, pressing Escape, or clicking the close button closes it.
4. **Render `MonthRecollectionPanel` inside `Modal`**. The modal title is "Month Data Recollection". To avoid a duplicated heading, add a `hideHeading` prop to `MonthRecollectionPanel` — when `true`, the component's built-in `<h2>` and description are suppressed, but the `StatusBadge` is still rendered above the form card.
5. **Pass month recollection status** from the fetched data to `MonthRecollectionPanel` as `lastJobStatus`. After a recollection completes, the `onComplete` callback triggers a silent job status re-fetch so the badge updates.
6. **Modal stays open after success** — the `onComplete` callback refetches data but does not close the modal, matching the acceptance criteria.

```
┌─────────────────────── Seats Tab ───────────────────────┐
│                                                          │
│  ┌─── SeatJobStatusCards ────────────────────────────┐   │
│  │  ┌──────────────────┐  ┌────────────────────────┐ │   │
│  │  │  Seat Sync       │  │  Usage Collection      │ │   │
│  │  │  [Sync Now]      │  │  [Collect Now]         │ │   │
│  │  │  [Select Month]  │  │  status/times          │ │   │
│  │  │  status/times    │  │                        │ │   │
│  │  └──────────────────┘  └────────────────────────┘ │   │
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

┌──────────── Modal (opened by "Select Month") ────────────┐
│  Month Data Recollection                            [×]   │
│  ─────────────────────────────────────────────────────    │
│  [Success]  ← StatusBadge                                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  [Month ▼]  [Year ▼]  [Recalculate Month]       │    │
│  │                                                  │    │
│  │  "Recollected 310 records for 15 users"          │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `Modal` component — `src/components/shared/Modal.tsx` — Full-featured modal with overlay click-to-close, Escape key, focus trap, ARIA attributes, body scroll lock, and `ModalProvider` integration. Accepts `isOpen`, `onClose`, `title`, `children`, `size` props. No changes needed.
- `ModalProvider` component — `src/components/shared/ModalProvider.tsx` — Ensures single-modal-at-a-time behavior. Already wired into the app layout. No changes needed.
- `MonthRecollectionPanel` component — `src/components/settings/MonthRecollectionPanel.tsx` — Form with month/year selectors, "Recalculate Month" button, inline success/error feedback, and `StatusBadge` integrated next to the heading (Story 1.2). Accepts `lastJobStatus` and `onComplete` props.
- `SeatJobStatusCards` component — `src/components/seats/SeatJobStatusCards.tsx` — Independently fetches `/api/job-status`, renders Seat Sync and Usage Collection cards with action buttons and error handling. The `monthRecollection` field from the API response is currently ignored.
- `JobCard` component — `src/components/settings/JobStatusPanel.tsx` — Renders a card with title, status badge, timestamps, records processed, and an optional `action` slot in the card header. Already exported.
- `SyncNowButton` component — `src/components/settings/JobStatusPanel.tsx` — Triggers seat sync with inline feedback and `onComplete` callback. Already exported.
- `/api/job-status` route — `src/app/api/job-status/route.ts` — Returns `monthRecollection` alongside `seatSync` and `usageCollection`. No changes needed.
- `/api/jobs/month-recollection` route — Handles month recollection POST requests with concurrency guards. No changes needed.

### To Be Modified
- `src/components/settings/MonthRecollectionPanel.tsx` — Add optional `hideHeading` prop. When `true`, suppress the `<h2>` heading and `<p>` description but keep the `StatusBadge` visible above the form card. This prevents a duplicate heading when rendered inside the Modal (which provides its own title).
- `src/components/seats/SeatJobStatusCards.tsx` — (1) Parse and store `monthRecollection` from the API response. (2) Add `isModalOpen` state. (3) Add a "Select Month" button to the Seat Sync card's action slot alongside `SyncNowButton`. (4) Render `Modal` + `MonthRecollectionPanel` with `hideHeading`, passing `lastJobStatus` and an `onComplete` that re-fetches job status silently.

### To Be Created
Nothing — all changes modify existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Select Month" button be styled as a primary or secondary action? | Secondary (outline/ghost style). "Sync Now" is the primary action on the Seat Sync card; "Select Month" is a supplementary action that opens a modal. A lighter style (e.g., `border border-gray-300 text-gray-700 hover:bg-gray-50`) differentiates the two actions visually. | ✅ Resolved |
| 2 | Should the modal auto-close after a successful recollection? | No. Per the acceptance criteria: "After a successful recollection, the modal remains open showing the success status so the user can review the result." | ✅ Resolved |
| 3 | How should the duplicate heading (Modal title vs. MonthRecollectionPanel h2) be handled? | Add a `hideHeading` prop to `MonthRecollectionPanel`. When `true`, the component skips its `<h2>` and description, rendering only the StatusBadge (if present) and the form card. The Modal title serves as the heading. This avoids two identical h2 elements and keeps the component reusable in both inline (Jobs tab) and modal (Seats tab) contexts. | ✅ Resolved |
| 4 | Should the "Select Month" button appear when the Seat Sync card has no execution data (empty state)? | Yes. Month Data Recollection is independent of whether a seat sync has run. The button should always be visible on the Seat Sync card regardless of execution state. This requires minor adjustment: the `action` slot is rendered in both the empty and populated states of `JobCard`. Reviewing `JobCard`, the `action` slot is already rendered in both states — no changes needed. | ✅ Resolved |
| 5 | What modal size should be used? | `default` (max-w-lg). The Month Data Recollection form contains two dropdowns and a button in a single row — it fits comfortably within the default modal width. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add `hideHeading` Prop to MonthRecollectionPanel

#### Task 1.1 - [MODIFY] Add `hideHeading` prop to MonthRecollectionPanel
**Description**: Update `src/components/settings/MonthRecollectionPanel.tsx` to accept an optional `hideHeading` boolean prop. When `true`, the component skips rendering its `<h2>` heading and `<p>` description paragraph. The `StatusBadge` is still rendered — placed in a standalone `<div>` above the form card when the heading is hidden. When `false` or `undefined`, the component renders identically to the current behavior (heading + badge inline + description).

The outer `<section aria-label="Month recollection">` wrapper is kept in both modes for accessibility and E2E test selectors.

**Definition of Done**:
- [x] `MonthRecollectionPanel` accepts an optional `hideHeading` prop of type `boolean`
- [x] When `hideHeading` is `true`, no `<h2>` heading or `<p>` description is rendered
- [x] When `hideHeading` is `true` and `displayStatus` exists, the `StatusBadge` is rendered above the form card
- [x] When `hideHeading` is `false` or `undefined`, the component renders identically to the current implementation
- [x] Existing behavior on the Jobs tab is unchanged (no regressions)
- [x] TypeScript compilation passes with no new errors

### Phase 2: Add "Select Month" Button and Modal to SeatJobStatusCards

#### Task 2.1 - [MODIFY] Extend SeatJobStatusCards to store monthRecollection data
**Description**: Update `src/components/seats/SeatJobStatusCards.tsx` to include `monthRecollection` in the `SeatJobStatusData` interface and parse it from the `/api/job-status` response. The `monthRecollection` data is already returned by the API but currently ignored by this component.

**Definition of Done**:
- [x] `SeatJobStatusData` interface includes `monthRecollection: JobExecutionData | null`
- [x] `fetchJobStatus` parses `json.monthRecollection` using `serializeExecution` and stores it in state
- [x] TypeScript compilation passes with no new errors

#### Task 2.2 - [MODIFY] Add "Select Month" button and modal to SeatJobStatusCards
**Description**: Update `src/components/seats/SeatJobStatusCards.tsx` to:
1. Add `isModalOpen` state (default `false`)
2. Add a "Select Month" button in the Seat Sync card's action slot, wrapped in a React Fragment alongside `SyncNowButton`. The button uses a secondary style (`rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50`) to differentiate from the primary "Sync Now" button.
3. Import and render the `Modal` component with `isOpen={isModalOpen}`, `onClose` toggling the state to `false`, and `title="Month Data Recollection"`.
4. Render `MonthRecollectionPanel` inside the Modal with `hideHeading={true}`, `lastJobStatus={data.monthRecollection?.status ?? null}`, and `onComplete` that triggers a silent job status re-fetch (but does NOT close the modal).
5. Import `Modal` from `@/components/shared/Modal` and `MonthRecollectionPanel` from `@/components/settings/MonthRecollectionPanel`.

**Definition of Done**:
- [x] A "Select Month" button is visible on the Seat Sync card alongside "Sync Now"
- [x] Clicking "Select Month" opens a modal dialog
- [x] The modal title is "Month Data Recollection"
- [x] The modal contains `MonthRecollectionPanel` with month/year selectors, recalculate button, and status badge
- [x] The modal receives `hideHeading={true}` so no duplicate heading is rendered
- [x] The modal can be closed by clicking outside, pressing Escape, or clicking the close button (all provided by `Modal` component)
- [x] After a successful recollection, the modal stays open showing the success status
- [x] After a recollection completes (success or failure), job status data is silently re-fetched
- [x] The "Select Month" button is visible even when the Seat Sync card has no execution data (empty state)
- [x] TypeScript compilation passes with no new errors

### Phase 3: E2E Testing

#### Task 3.1 - [MODIFY] Add E2E tests for "Select Month" button and modal on Seats tab
**Description**: Add E2E tests to `e2e/seat-list.spec.ts` within the "Job Status Cards on Seats Tab" describe block to verify Story 1.3 behavior.

Tests to add:
1. "Select Month" button is visible on the Seat Sync card
2. Clicking "Select Month" opens a modal with the title "Month Data Recollection"
3. The modal contains month/year selectors and "Recalculate Month" button
4. The modal can be closed by pressing Escape
5. The modal can be closed by clicking the overlay
6. The modal can be closed by clicking the close button

**Definition of Done**:
- [x] E2E test verifies "Select Month" button is visible on the Seat Sync card
- [x] E2E test verifies clicking "Select Month" opens a modal dialog
- [x] E2E test verifies modal title is "Month Data Recollection"
- [x] E2E test verifies modal contains month selector, year selector, and recalculate button
- [x] E2E test verifies modal closes on Escape key press
- [x] E2E test verifies modal closes on overlay click
- [x] E2E test verifies modal closes on close button click
- [x] All E2E tests pass

#### Task 3.2 - [MODIFY] Add E2E tests for month recollection within the modal
**Description**: Add E2E tests to `e2e/seat-list.spec.ts` that verify the Month Data Recollection form works correctly inside the modal:
1. When a successful month recollection execution exists, the status badge is visible inside the modal
2. After triggering a recollection that succeeds (via API mock), the modal stays open and shows the success status badge and success feedback message
3. After triggering a recollection that fails (via API mock), the modal stays open and shows a failure status badge and error feedback message

**Definition of Done**:
- [x] E2E test verifies status badge is displayed inside the modal when a successful `month_recollection` job execution is seeded
- [x] E2E test verifies modal stays open after a successful recollection and shows success status
- [x] E2E test verifies modal stays open after a failed recollection and shows failure status
- [x] All E2E tests pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes made in Phases 1–3. The review should verify adherence to existing code patterns, proper modal integration, accessibility (focus management, ARIA), correct prop threading, and that no regressions were introduced to the Jobs tab or existing Seats tab functionality.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **No new API surface**: This story does not create or modify any API endpoints. All data flows use the existing `/api/job-status` and `/api/jobs/month-recollection` routes, which enforce authentication via `requireAuth()`.
- **No XSS vectors**: All dynamic content (status text, feedback messages) is rendered via React JSX with automatic escaping. No `dangerouslySetInnerHTML` or raw HTML injection.
- **Authentication unchanged**: The `MonthRecollectionPanel` already handles 401 responses with a "Session expired" message. The same behavior applies when rendered inside the modal.
- **No client-side state leakage**: The modal does not store sensitive data. Month/year selections and feedback messages are transient UI state that resets when the component unmounts.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The Seat Sync card displays a "Select Month" button alongside "Sync Now"
- [x] Clicking "Select Month" opens a modal dialog
- [x] The modal contains the Month Data Recollection form with month/year selectors, recalculate button, and status badge
- [x] The modal can be closed by clicking outside, pressing Escape, or a close button
- [x] After successful recollection, the modal stays open showing the success status
- [x] The modal follows existing application styling conventions (uses `Modal` component from `src/components/shared/Modal.tsx`)
- [x] The Seat Sync card's "Sync Now" button continues to function correctly (no regressions)
- [x] The Usage Collection card continues to function correctly (no regressions)
- [x] The Jobs tab continues to function identically — `MonthRecollectionPanel` renders with heading and badge as before
- [x] All E2E tests pass (existing + new)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Extend `Modal` to accept JSX title**: Currently the `Modal` component's `title` prop is a `string`. Supporting JSX (e.g., `ReactNode`) would allow rendering the `StatusBadge` directly in the modal header next to the title, eliminating the need for the `hideHeading` prop on `MonthRecollectionPanel`. Deferred as it would change the shared Modal API and affect all existing usages.
- **Shared `useJobStatus` hook**: The job status fetching logic is duplicated between `JobsTabContent` and `SeatJobStatusCards`. A shared hook could eliminate this duplication. Deferred until Story 1.4 removes `JobsTabContent`, at which point only one consumer remains.
- **Auto-refresh polling for month recollection status**: The status badge inside the modal only updates after the user triggers a recollection. Background updates (e.g., from cron jobs) would not be reflected until the modal is reopened. Adding interval polling is not part of the acceptance criteria.
- **Persist modal state across tab switches**: If the user opens the modal, switches to another tab, and returns to Seats, the modal will be closed. Persisting open state is not required and would add unnecessary complexity.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation completed (Phases 1-3) |
| 2026-03-05 | Code review by tsh-code-reviewer: 0 Critical, 0 High, 0 Medium, 2 Low (inline props type — consistent with existing pattern; empty-state implicit E2E coverage — acceptable), 4 Info. Verdict: Approved. All E2E tests pass (18/18 seat-list, 9/9 month-recollection, 4/4 job-status). |
