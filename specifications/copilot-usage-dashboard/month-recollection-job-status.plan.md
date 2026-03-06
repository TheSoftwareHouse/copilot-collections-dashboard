# Month Recollection Job Status Display - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Show Month Recollection Job Status on Jobs Tab |
| Description | Display the latest month recollection job execution status in the Background Job Status section (JobStatusPanel), matching the same status card pattern used for Seat Sync and Usage Collection. |
| Priority | Medium |
| Related Research | N/A |

## Proposed Solution

Extend the existing job status infrastructure to include `month_recollection` as a visible job type in the Background Job Status panel. Currently, the `MonthRecollectionPanel` only shows an inline success/error message after triggering a recollection, but there is no persistent status card showing the last run's status, timestamps, records processed, or error details — unlike Seat Sync and Usage Collection which have dedicated `JobCard` components.

The change threads the `monthRecollection` job execution data through three layers:

```
┌──────────────────────────────────────────────────┐
│  GET /api/job-status                             │
│  Currently returns: seatSync,                    │
│    usageCollection, teamCarryForward             │
│  ───► ADD: monthRecollection                     │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  JobsTabContent.tsx                              │
│  Fetches /api/job-status, passes to              │
│  JobStatusPanel                                  │
│  ───► ADD: monthRecollection to                  │
│       JobStatusResponse + serialization          │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  JobStatusPanel.tsx                              │
│  Renders JobCard for each job type               │
│  Currently: Seat Sync, Usage Collection          │
│  ───► ADD: Month Recollection JobCard            │
│       (same pattern: StatusBadge, timestamps,    │
│        records processed, error details)         │
└──────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No new components**: Reuses the existing `JobCard` component inside `JobStatusPanel` — the same card layout used for Seat Sync and Usage Collection.
2. **No "trigger" button on the status card**: The `MonthRecollectionPanel` already provides the trigger UI with month/year selectors. The status card is read-only, showing the last run info.
3. **Grid layout adjustment**: The current grid uses `sm:grid-cols-2` for 2 cards. With 3 cards, it should use `sm:grid-cols-2 lg:grid-cols-3` or keep 2-column layout. Given that a 4th card (Team Carry Forward) may follow later, keeping `sm:grid-cols-2` (2×2 grid) is the pragmatic choice.
4. **API backwards-compatible**: The `monthRecollection` field is added as an optional nullable field in the response, matching the pattern of existing fields.
5. **Refresh after trigger**: After the `MonthRecollectionPanel` triggers a recollection and it completes, the `JobStatusPanel` should reflect the updated status. The `MonthRecollectionPanel` currently doesn't call `router.refresh()` — this needs to be added to trigger a re-fetch of job status data by `JobsTabContent`.

## Current Implementation Analysis

### Already Implemented
- `GET /api/job-status` — [src/app/api/job-status/route.ts](src/app/api/job-status/route.ts) — Returns latest job execution per type. Already queries `SEAT_SYNC`, `USAGE_COLLECTION`, `TEAM_CARRY_FORWARD` but NOT `MONTH_RECOLLECTION`.
- `JobStatusPanel` — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — Renders `JobCard` components for `seatSync` and `usageCollection`. Exports `JobExecutionData` interface.
- `JobCard` (internal) — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — Reusable card component showing status badge, timestamps, records processed, and error details.
- `StatusBadge` (internal) — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — Renders colored badge for success/failure/running.
- `JobsTabContent` — [src/components/management/JobsTabContent.tsx](src/components/management/JobsTabContent.tsx) — Fetches `/api/job-status`, serializes response, passes data to `JobStatusPanel`. Currently only handles `seatSync` and `usageCollection`.
- `MonthRecollectionPanel` — [src/components/settings/MonthRecollectionPanel.tsx](src/components/settings/MonthRecollectionPanel.tsx) — Trigger UI for month recollection with month/year selectors. Shows inline success/error message but no persistent status card.
- `JobType.MONTH_RECOLLECTION` — [src/entities/enums.ts](src/entities/enums.ts) — Enum value already exists.
- `JobExecutionEntity` — [src/entities/job-execution.entity.ts](src/entities/job-execution.entity.ts) — Entity tracks all job types.
- Unit tests for `GET /api/job-status` — [src/app/api/job-status/__tests__/route.test.ts](src/app/api/job-status/__tests__/route.test.ts) — Tests for seatSync, usageCollection, teamCarryForward.
- E2E tests for job status — [e2e/job-status.spec.ts](e2e/job-status.spec.ts) — Tests job status display on the Jobs tab.

### To Be Modified
- `GET /api/job-status` — [src/app/api/job-status/route.ts](src/app/api/job-status/route.ts) — Add `MONTH_RECOLLECTION` to the queried job types and include `monthRecollection` in the response.
- `JobStatusPanel` — [src/components/settings/JobStatusPanel.tsx](src/components/settings/JobStatusPanel.tsx) — Add `monthRecollection` to `JobStatusPanelProps` data interface and render a third `JobCard`.
- `JobsTabContent` — [src/components/management/JobsTabContent.tsx](src/components/management/JobsTabContent.tsx) — Add `monthRecollection` to `JobStatusResponse` interface and serialize it from the API response.
- `MonthRecollectionPanel` — [src/components/settings/MonthRecollectionPanel.tsx](src/components/settings/MonthRecollectionPanel.tsx) — Add callback prop to notify parent when recollection completes, enabling `JobsTabContent` to re-fetch status data.
- Unit tests for `GET /api/job-status` — [src/app/api/job-status/__tests__/route.test.ts](src/app/api/job-status/__tests__/route.test.ts) — Add tests for `monthRecollection` field.
- E2E tests for job status — [e2e/job-status.spec.ts](e2e/job-status.spec.ts) — Add test for month recollection status card display.

### To Be Created
Nothing. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the month recollection card have a trigger button (like Sync Now / Collect Now)? | No. The `MonthRecollectionPanel` already provides the trigger with month/year selectors. The status card is read-only. | ✅ Resolved |
| 2 | Should the grid layout change from 2 to 3 columns? | Keep `sm:grid-cols-2` for a 2×2 grid. With 3 cards, the third wraps to a new row, which is acceptable. | ✅ Resolved |
| 3 | How should the status card refresh after a recollection is triggered? | `MonthRecollectionPanel` accepts an `onComplete` callback. `JobsTabContent` re-fetches `/api/job-status` when called. | ✅ Resolved |

## Implementation Plan

### Phase 1: API Layer

#### Task 1.1 - [MODIFY] Add `monthRecollection` to `GET /api/job-status` response
**Description**: Update the job status API route to also query for the latest `MONTH_RECOLLECTION` job execution and include it as `monthRecollection` in the JSON response. Follow the exact same pattern used for `seatSync`, `usageCollection`, and `teamCarryForward`.

**Definition of Done**:
- [x] `JobType.MONTH_RECOLLECTION` added to the `Promise.all` query array in `src/app/api/job-status/route.ts`
- [x] Response includes `monthRecollection` field with the same shape: `{ id, jobType, status, startedAt, completedAt, errorMessage, recordsProcessed }` or `null`
- [x] No TypeScript compilation errors
- [x] Existing tests still pass

#### Task 1.2 - [MODIFY] Add unit tests for `monthRecollection` in job-status route
**Description**: Add test cases to `src/app/api/job-status/__tests__/route.test.ts` verifying that the `monthRecollection` field is returned correctly — null when no executions exist, populated with the latest execution when one exists, and correctly included when all 4 job types have executions.

**Definition of Done**:
- [x] Test: `monthRecollection` is `null` when no month recollection executions exist (update existing "all null" test)
- [x] Test: returns latest month recollection execution when one exists
- [x] Test: returns all four job types populated when executions exist for all (update existing "all three" test)
- [x] All tests pass with `npm run test`

---

### Phase 2: Frontend Data Layer

#### Task 2.1 - [MODIFY] Update `JobStatusPanelProps` to include `monthRecollection`
**Description**: Add `monthRecollection: JobExecutionData | null` to the `JobStatusPanelProps.data` interface, and render a "Month Recollection" `JobCard` in the grid alongside the existing cards.

**Definition of Done**:
- [x] `JobStatusPanelProps.data` interface includes `monthRecollection: JobExecutionData | null`
- [x] A `JobCard` with title "Month Recollection" renders in the grid, using the same `JobCard` component as Seat Sync and Usage Collection
- [x] Card displays status badge, started/completed timestamps, records processed, and error details (when present)
- [x] No action button on the Month Recollection card (the trigger UI is in `MonthRecollectionPanel`)
- [x] No TypeScript compilation errors

#### Task 2.2 - [MODIFY] Update `JobsTabContent` to pass `monthRecollection` data
**Description**: Update `JobsTabContent` to include `monthRecollection` in its `JobStatusResponse` interface, serialize it from the API response, and pass it through to `JobStatusPanel`. Also wire up a re-fetch mechanism so that when `MonthRecollectionPanel` completes a job, the status data is refreshed.

**Definition of Done**:
- [x] `JobStatusResponse` interface includes `monthRecollection: JobExecutionData | null`
- [x] `serializeExecution` is called for `json.monthRecollection` from the API response
- [x] `monthRecollection` data is passed to `JobStatusPanel` via props
- [x] A `fetchJobStatus` function is exposed or a callback is passed to `MonthRecollectionPanel` so that it can trigger a data re-fetch on completion
- [x] No TypeScript compilation errors

#### Task 2.3 - [MODIFY] Add `onComplete` callback to `MonthRecollectionPanel`
**Description**: Add an optional `onComplete` callback prop to `MonthRecollectionPanel`. When a recollection finishes (success or failure), invoke the callback so that the parent `JobsTabContent` can re-fetch the job status data to update the status card.

**Definition of Done**:
- [x] `MonthRecollectionPanel` accepts an optional `onComplete?: () => void` prop
- [x] Callback is invoked after the recollection API call completes (both success and failure)
- [x] `JobsTabContent` passes a re-fetch function as `onComplete` to `MonthRecollectionPanel`
- [x] After triggering a recollection, the Month Recollection status card in `JobStatusPanel` reflects the updated status
- [x] No TypeScript compilation errors

---

### Phase 3: E2E Testing

#### Task 3.1 - [MODIFY] Add E2E test for month recollection status card display
**Description**: Add a test case to `e2e/job-status.spec.ts` that seeds a `month_recollection` job execution record and verifies that the "Month Recollection" status card is displayed on the Jobs tab with the correct status badge, records processed count, and error details.

**Definition of Done**:
- [x] Test: seeds a successful `month_recollection` job execution and verifies the "Month Recollection" card shows "Success" badge and records processed count
- [x] Test: seeds a failed `month_recollection` job execution and verifies the card shows "Failed" badge and error message
- [x] Tests pass with `npm run test:e2e`

---

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review by `tsh-code-reviewer`
**Description**: Run a full code review of all modified files using the `tsh-code-reviewer` agent. Verify code quality, consistency with existing patterns, and test coverage.

**Definition of Done**:
- [x] All modified files reviewed
- [x] No critical or high-severity issues found
- [x] Code follows existing project patterns and conventions
- [x] All feedback addressed

## Security Considerations

- **No new endpoints or authentication changes**: All modifications are to existing authenticated endpoints and components. The `GET /api/job-status` route already requires authentication via `requireAuth()`.
- **No new data exposure**: The `monthRecollection` field exposes the same job execution metadata (status, timestamps, records processed, error message) that is already exposed for other job types. No sensitive data is added.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The Background Job Status section on the Jobs tab shows a "Month Recollection" status card
- [x] The card displays "No runs recorded yet" when no month recollection has been executed
- [x] The card displays a Success/Failed/Running status badge matching the latest month recollection job
- [x] The card displays started/completed timestamps with relative time formatting
- [x] The card displays the number of records processed
- [x] The card displays error details when the last run failed (with the same red error box)
- [x] After triggering a recollection via `MonthRecollectionPanel`, the status card updates to reflect the result
- [x] The `GET /api/job-status` response includes `monthRecollection` field
- [x] All existing unit tests continue to pass
- [x] New unit tests for `monthRecollection` in the API route pass
- [x] E2E tests for month recollection status card pass
- [x] No TypeScript compilation errors

## Improvements (Out of Scope)

- **Team Carry Forward status card**: The API already returns `teamCarryForward` but the `JobStatusPanel` does not render a card for it. This could be added in a similar manner.
- **Auto-refresh or polling**: The job status cards show point-in-time data. Auto-refresh or WebSocket-based updates could keep them live without manual page reload.
- **Job history list**: Only the latest execution per type is shown. A job history list could show all past runs.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation completed: all 4 phases done. Code review performed by tsh-code-reviewer — APPROVED. M1 (loading flash on re-fetch) fixed with silent refresh parameter. L1 (missing null assertion) fixed. L2 (response mapping duplication) noted as pre-existing, not addressed. 559 unit tests + 6 E2E tests pass. |
