# Team Members Modal Refactor - Jira Tasks

---

## Epic: UI: Consolidate Team Members Management into a Single Modal

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Currently, managing team members requires a two-step process: clicking "Members" on a team row renders an inline panel below the table (replacing the table view), then clicking "Manage Members" opens a separate modal for adding members or backfilling history. This epic simplifies the flow into a single modal that opens directly when clicking "Members", containing the member list with action buttons and inline forms — all in one place.

h2. Business Value

The current two-step flow is unnecessarily complex. Administrators must navigate away from the team list to see members, then open a separate modal to perform actions. Consolidating everything into one modal keeps the team list visible, reduces navigation steps, and provides a more focused member management experience.

h2. Success Metrics

* Clicking "Members" on a team row opens a modal directly (no intermediate inline panel)
* The modal shows the member list table with "Add Members" and "Backfill History" buttons at the top
* Clicking "Add Members" or "Backfill History" shows the respective form inline at the top of the modal, above the member list
* The team table remains visible in the background (behind the modal overlay)
* All existing member management functionality (add, backfill, remove/retire/purge) works identically
* The "Manage Members" and "Back to Teams" buttons are removed
```

**Acceptance Criteria**:
```
(/) Clicking "Members" opens a modal directly (no inline panel)
(/) The modal shows the member list with action buttons at the top
(/) Add Members and Backfill History forms appear inline at the top of the modal
(/) The team table stays visible behind the modal overlay
(/) All existing member management functionality works identically inside the modal
(/) The "Manage Members" and "Back to Teams" buttons are removed
```

**Labels**: `ui`, `refactor`, `modal`, `team-management`

---

### Story 1.1: Open team members modal directly from team table row

**Parent**: UI: Consolidate Team Members Management into a Single Modal
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (3–5)

**Description**:
```
h2. Context

This story is part of the [UI: Consolidate Team Members Management into a Single Modal] epic. It replaces the inline TeamMembersPanel with a modal that opens directly from the team table row.

h2. User Story

As a dashboard administrator, I want clicking the "Members" button on a team row to open a modal dialog directly so that I can manage team members without navigating away from the team list.

h2. Requirements

# Clicking the "Members" button on a team row opens a modal dialog (using the existing shared Modal component)
# The modal title displays the team name (e.g., "Members of Engineering")
# The modal shows the current month/year label below the title
# The modal displays the members table with GitHub Username, Name, and Actions columns
# The member list is scrollable within the modal if it exceeds the available height
# Empty state ("This team has no members for {month}") is shown when the team has no members
# Member remove actions (retire/purge flow with confirmation steps) work within the modal
# While members are loading, the modal displays a "Loading members…" message (the modal opens immediately, content loads asynchronously)
# If the member fetch fails, a retry button is shown within the modal
# Error banners (remove error, fetch error) display within the modal
# The team table remains visible behind the modal overlay (no inline panel replaces it)
# When a form is active above the member list, the entire modal body scrolls (form + member list together) rather than having separate scroll areas
# The "Manage Members" button is removed (no longer needed)
# The "Back to Teams" button is removed (closing the modal returns to the team list)
# The modal can be closed via the modal's close mechanism (Escape key, clicking outside)

h2. Technical Notes

The current TeamMembersPanel renders inline below the team table when managingMembersTeam state is set. This needs to be refactored so that the same state triggers a modal instead. The inline panel's header, "Back to Teams" button, and "Manage Members" button become unnecessary since the modal handles open/close natively.
```

**Acceptance Criteria**:
```
(/) Clicking the "Members" button on a team row opens a modal dialog
(/) The modal title displays the team name (e.g., "Members of Engineering")
(/) The modal shows the current month/year label below the title
(/) The modal displays the members table with GitHub Username, Name, and Actions columns
(/) The member list is scrollable within the modal if it exceeds the available height
(/) Empty state is shown when the team has no members
(/) Member remove actions (retire/purge flow) work within the modal
(/) While members are loading, the modal displays "Loading members…"
(/) If the member fetch fails, a retry button is shown within the modal
(/) Error banners display within the modal
(/) The team table remains visible behind the modal overlay
(/) When a form is active above the member list, the entire modal body scrolls
(/) The "Manage Members" button is removed
(/) The "Back to Teams" button is removed
(/) The modal can be closed via Escape key or clicking outside
```

**Labels**: `ui`, `refactor`, `modal`, `team-management`

---

### Story 1.2: Show Add Members and Backfill History action buttons in the members modal

**Parent**: UI: Consolidate Team Members Management into a Single Modal
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (3–5)

**Description**:
```
h2. Context

This story is part of the [UI: Consolidate Team Members Management into a Single Modal] epic. It adds Add Members and Backfill History action buttons to the members modal and makes the Add Members form display inline at the top.

h2. User Story

As a dashboard administrator, I want "Add Members" and "Backfill History" buttons displayed at the top of the members modal so that I can access both actions directly without an extra step.

h2. Requirements

# "Add Members" and "Backfill History" buttons are visible at the top of the members modal, above the member list
# The buttons use a toggle pattern: clicking an active button deactivates it and hides the form
# Clicking "Add Members" shows the add members form inline at the top of the modal, between the buttons and the member list
# The add members form includes the search input and seat checkbox list (same as current)
# Submitting the add members form adds members, refreshes the member list, and hides the form
# Add members error messages display within the form area inside the modal
# The member list remains visible below the form at all times (the form does not replace the member list)
# Switching from one mode to another resets the previously active form's state
```

**Acceptance Criteria**:
```
(/) "Add Members" and "Backfill History" buttons are visible at the top of the members modal
(/) Buttons use a toggle pattern: clicking active button deactivates it
(/) Clicking "Add Members" shows the form inline between buttons and member list
(/) The add members form includes search input and seat checkbox list
(/) Submitting adds members, refreshes the list, and hides the form
(/) Error messages display within the form area
(/) The member list remains visible below the form at all times
(/) Switching modes resets the previously active form's state
```

**Labels**: `ui`, `refactor`, `modal`, `team-management`

---

### Story 1.3: Show Backfill History form inline in the members modal

**Parent**: UI: Consolidate Team Members Management into a Single Modal
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (3–5)

**Description**:
```
h2. Context

This story is part of the [UI: Consolidate Team Members Management into a Single Modal] epic. It makes the Backfill History form display inline at the top of the members modal.

h2. User Story

As a dashboard administrator, I want the "Backfill History" form to appear inline at the top of the members modal so that I can backfill historical data without leaving the member list context.

h2. Requirements

# Clicking "Backfill History" shows the backfill form inline at the top of the modal, between the buttons and the member list
# The backfill form includes date range selectors (start/end month and year), search input, and seat checkbox list (same as current)
# Date validation messages (start after end, future date) display within the form area
# Success messages ("Added X snapshots across Y months") display within the form area
# Error messages display within the form area
# Submitting the form triggers the backfill, shows the result, and refreshes the member list below
# The backfill form does not close automatically on success (the user can perform multiple backfills)
# The member list remains visible below the form at all times
```

**Acceptance Criteria**:
```
(/) Clicking "Backfill History" shows the form inline between buttons and member list
(/) The backfill form includes date range selectors, search input, and seat checkbox list
(/) Date validation messages display within the form area
(/) Success messages display within the form area
(/) Error messages display within the form area
(/) Submitting triggers the backfill, shows the result, and refreshes the member list
(/) The backfill form does not close automatically on success
(/) The member list remains visible below the form at all times
```

**Labels**: `ui`, `refactor`, `modal`, `team-management`
