# Team Members Modal Refactor - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | 3 March 2026 |
| Participants | Product Owner, Development Team |
| Source Materials | Direct requirement from product owner, codebase analysis |
| Total Epics | 1 |
| Total Stories | 3 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Consolidate Team Members Management into a Single Modal | 3 | High |

## Epic 1: Consolidate Team Members Management into a Single Modal

**Business Description**: Currently, managing team members requires a two-step process: first clicking "Members" on a team row renders an inline panel below the table (replacing the table view), then clicking "Manage Members" opens a separate modal for adding members or backfilling history. This should be simplified into a single modal that opens directly when clicking "Members", containing the member list with action buttons and inline forms — all in one place.

**Success Criteria**:
- Clicking "Members" on a team row opens a modal directly (no intermediate inline panel)
- The modal shows the member list table with "Add Members" and "Backfill History" buttons at the top
- Clicking "Add Members" or "Backfill History" shows the respective form inline at the top of the modal, above the member list
- The team table remains visible in the background (behind the modal overlay) instead of being replaced by the inline panel
- All existing member management functionality (add, backfill, remove/retire/purge) continues to work identically
- The "Manage Members" button and "Back to Teams" button are no longer needed and are removed

### Story 1.1: Open team members modal directly from team table row

**User Story**: As a dashboard administrator, I want clicking the "Members" button on a team row to open a modal dialog directly so that I can manage team members without navigating away from the team list.

**Acceptance Criteria**:
- [ ] Clicking the "Members" button on a team row opens a modal dialog (using the existing shared Modal component)
- [ ] The modal title displays the team name (e.g., "Members of Engineering")
- [ ] The modal shows the current month/year label below the title
- [ ] The modal displays the members table with GitHub Username, Name, and Actions columns
- [ ] The member list is scrollable within the modal if it exceeds the available height
- [ ] Empty state ("This team has no members for {month}") is shown when the team has no members
- [ ] Member remove actions (retire/purge flow with confirmation steps) work within the modal
- [ ] While members are loading, the modal displays a "Loading members…" message (the modal opens immediately, content loads asynchronously)
- [ ] If the member fetch fails, a retry button is shown within the modal
- [ ] Error banners (remove error, fetch error) display within the modal
- [ ] The team table remains visible behind the modal overlay (no inline panel replaces it)
- [ ] When a form is active above the member list, the entire modal body scrolls (form + member list together) rather than having separate scroll areas
- [ ] The "Manage Members" button is removed (no longer needed)
- [ ] The "Back to Teams" button is removed (closing the modal returns to the team list)
- [ ] The modal can be closed via the modal's close mechanism (Escape key, clicking outside)

**High-Level Technical Notes**: The current `TeamMembersPanel` renders inline below the team table when `managingMembersTeam` state is set. This needs to be refactored so that the same state triggers a modal instead. The inline panel's header, "Back to Teams" button, and "Manage Members" button become unnecessary since the modal handles open/close natively.

**Priority**: High

### Story 1.2: Show Add Members and Backfill History action buttons in the members modal

**User Story**: As a dashboard administrator, I want "Add Members" and "Backfill History" buttons displayed at the top of the members modal so that I can access both actions directly without an extra step.

**Acceptance Criteria**:
- [ ] "Add Members" and "Backfill History" buttons are visible at the top of the members modal, above the member list
- [ ] The buttons use a toggle pattern: clicking an active button deactivates it and hides the form
- [ ] Clicking "Add Members" shows the add members form inline at the top of the modal, between the buttons and the member list
- [ ] The add members form includes the search input and seat checkbox list (same as current)
- [ ] Submitting the add members form adds members, refreshes the member list, and hides the form
- [ ] Add members error messages display within the form area inside the modal
- [ ] The member list remains visible below the form at all times (the form does not replace the member list)
- [ ] Switching from one mode to another resets the previously active form's state

**Priority**: High

### Story 1.3: Show Backfill History form inline in the members modal

**User Story**: As a dashboard administrator, I want the "Backfill History" form to appear inline at the top of the members modal so that I can backfill historical data without leaving the member list context.

**Acceptance Criteria**:
- [ ] Clicking "Backfill History" shows the backfill form inline at the top of the modal, between the buttons and the member list
- [ ] The backfill form includes date range selectors (start/end month and year), search input, and seat checkbox list (same as current)
- [ ] Date validation messages (start after end, future date) display within the form area
- [ ] Success messages ("Added X snapshots across Y months") display within the form area
- [ ] Error messages display within the form area
- [ ] Submitting the form triggers the backfill, shows the result, and refreshes the member list below
- [ ] The backfill form does not close automatically on success (the user can perform multiple backfills)
- [ ] The member list remains visible below the form at all times

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.2 | Story 1.1 | Blocked by | Requires the members modal to exist before adding action buttons and forms |
| Story 1.3 | Story 1.1 | Blocked by | Requires the members modal to exist before adding the backfill form |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | The existing shared Modal component (from the previous modal-forms-refactor) is sufficient for this use case without modification | High | May need to extend the Modal component for larger content or different sizing |
| 2 | The member list should always remain visible below the form (forms do not replace the member list) | High | If the forms should replace the member list, the layout logic changes |
| 3 | The E2E tests in `team-members.spec.ts` will need updates but that is handled as part of each story's implementation, not as a separate story | Medium | If E2E test updates are substantial, a separate story may be needed |
| 4 | The backfill form does NOT auto-close on success (user may want to do multiple backfills) | Medium | Could add a "Done" button to close the form if auto-close is preferred |
| 5 | The retire/purge member removal flow (inline confirmation in the table row) remains unchanged — it just happens inside the modal now | High | Minor adjustment if the removal flow should also change |

## Out of Scope

- Changing the add members or backfill history form functionality (fields, validation, API calls)
- Changing the retire/purge member removal flow
- Restyling the members table or form components
- Adding new member management features (e.g., bulk remove)
- Mobile-specific modal sizing or responsive adjustments
