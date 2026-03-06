# Modal Forms Refactor - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | 2 March 2026 |
| Participants | Product Owner, Development Team |
| Source Materials | Direct requirement from product owner, codebase analysis |
| Total Epics | 1 |
| Total Stories | 5 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Convert Inline Forms to Modal Dialogs | 5 | High |

## Epic 1: Convert Inline Forms to Modal Dialogs

**Business Description**: Currently, all create, add-member, backfill, and edit forms in the application are rendered as inline cards directly above or below their associated tables. This pushes content around, makes it harder to focus on the form being filled, and provides a poor visual experience. All these forms should be displayed as modal dialogs with a shaded (dimmed) backdrop overlay for better visibility and user focus.

**Success Criteria**:
- All create, edit, and add-member forms open as centered modal dialogs instead of inline cards
- When a modal is open, the page background is visually dimmed with a semi-transparent overlay
- Users can dismiss modals by clicking the Cancel button or pressing Escape
- All existing form functionality (validation, error messages, submit behaviour) continues to work identically inside the modal
- The modal pattern is consistent across all instances (same overlay style, same dismiss behaviour)

### Story 1.1: Create a reusable Modal component with backdrop overlay

**User Story**: As a developer, I want a shared, reusable modal component with a shaded backdrop so that all forms across the application can use a consistent modal pattern without duplicating overlay and layout code.

**Acceptance Criteria**:
- [ ] A reusable Modal component exists in the shared components directory
- [ ] The modal renders a semi-transparent dark overlay covering the full viewport when open
- [ ] The modal content is centered on screen (both vertically and horizontally)
- [ ] Pressing Escape closes the modal
- [ ] Clicking outside the modal content (on the overlay) closes the modal
- [ ] The modal traps focus within itself while open (keyboard tab does not move focus behind the overlay)
- [ ] The modal is accessible: uses `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` referencing the modal title
- [ ] The component accepts children (the form content) and an `onClose` callback
- [ ] The component accepts a `title` prop displayed as the modal header
- [ ] The page behind the modal does not scroll while the modal is open (body scroll lock is applied and removed on close)
- [ ] Only one modal can be open at a time; if a second modal is triggered, the first one closes before the new one opens

**Priority**: High

### Story 1.2: Convert "Create Team" form to a modal dialog

**User Story**: As a dashboard administrator, I want the "Add New Team" form to appear as a modal dialog with a shaded background so that I can focus on creating the team without the page content shifting around.

**Acceptance Criteria**:
- [ ] Clicking the "Add Team" button opens a modal dialog instead of showing an inline form card above the table
- [ ] The modal displays the same form fields (team name input), validation messages, and action buttons as the current inline form
- [ ] The shaded backdrop overlay is visible behind the modal
- [ ] Submitting the form successfully creates the team, closes the modal, and refreshes the team list
- [ ] Validation errors (empty name, duplicate name) display within the modal without closing it
- [ ] Pressing Cancel or Escape closes the modal without creating a team

**High-Level Technical Notes**: The create form is currently rendered inline in `TeamManagementPanel.tsx` behind a `showCreateForm` state toggle. The form markup and logic remain the same; only the container changes from an inline `<div>` to the shared Modal component.

**Priority**: High

### Story 1.3: Convert "Create Department" form to a modal dialog

**User Story**: As a dashboard administrator, I want the "Add New Department" form to appear as a modal dialog with a shaded background so that I can focus on creating the department without the page content shifting around.

**Acceptance Criteria**:
- [ ] Clicking the "Add Department" button opens a modal dialog instead of showing an inline form card above the table
- [ ] The modal displays the same form fields (department name input), validation messages, and action buttons as the current inline form
- [ ] The shaded backdrop overlay is visible behind the modal
- [ ] Submitting the form successfully creates the department, closes the modal, and refreshes the department list
- [ ] Validation errors (empty name, duplicate name) display within the modal without closing it
- [ ] Pressing Cancel or Escape closes the modal without creating a department

**High-Level Technical Notes**: The create form is currently rendered inline in `DepartmentManagementPanel.tsx` behind a `showCreateForm` state toggle. The form markup and logic remain the same; only the container changes from an inline `<div>` to the shared Modal component.

**Priority**: High

### Story 1.4: Convert "Add Members" and "Backfill History" flows to a single modal dialog with mode selection

**User Story**: As a dashboard administrator, I want a single "Members" modal dialog with two selectable modes — "Add Members" and "Backfill History" — so that I can perform both actions from one focused view without the page content shifting.

**Acceptance Criteria**:
- [ ] A single trigger button (e.g., "Manage Members") opens one modal dialog
- [ ] The modal presents two selectable options: "Add Members" and "Backfill History", displayed as a mode selection section (similar to the current side-by-side button pattern)
- [ ] Selecting "Add Members" reveals the search input, seat checkbox list, and add action buttons within the modal
- [ ] Selecting "Backfill History" reveals the date range selectors, search input, seat checkbox list, and backfill action buttons within the modal
- [ ] Switching between modes resets the form state of the previously active mode
- [ ] The shaded backdrop overlay is visible behind the modal
- [ ] The scrollable seat list within the modal functions correctly (scrolls within the modal, not the page)
- [ ] In "Add Members" mode: submitting the selection adds members, closes the modal, and refreshes the member list
- [ ] In "Add Members" mode: error messages (add failure, load failure) display within the modal
- [ ] In "Backfill History" mode: date validation messages (start after end, future date) display within the modal
- [ ] In "Backfill History" mode: success and error messages display within the modal
- [ ] In "Backfill History" mode: submitting the form triggers the backfill, shows the result in the modal (success/error), and the member list refreshes
- [ ] Pressing Cancel or Escape closes the modal without performing any action

**High-Level Technical Notes**: The add-members and backfill flows are currently rendered as separate inline sections in `TeamMembersPanel.tsx` behind `showAddFlow` and `showBackfillFlow` state toggles with two separate trigger buttons. These should be consolidated into a single modal with an internal mode toggle, similar to the existing two-button pattern but wrapped inside the shared Modal component.

**Priority**: High

### Story 1.5: Convert "Add User" form to a modal dialog

**User Story**: As a dashboard administrator, I want the "Add New User" form to appear as a modal dialog with a shaded background so that I can focus on creating the user without the page content shifting around.

**Acceptance Criteria**:
- [ ] Clicking the "Add User" button opens a modal dialog instead of showing an inline form card above the table
- [ ] The modal displays the same form fields (username input, password input), validation messages, and action buttons as the current inline form
- [ ] The shaded backdrop overlay is visible behind the modal
- [ ] Submitting the form successfully creates the user, closes the modal, and refreshes the user list
- [ ] Validation errors (empty username, username too short, empty password, password too short, duplicate username) display within the modal without closing it
- [ ] Server errors (network errors, unexpected failures) display within the modal without closing it
- [ ] Pressing Cancel or Escape closes the modal without creating a user

**High-Level Technical Notes**: The create form is currently rendered inline in `UserManagementPanel.tsx` behind a `showCreateForm` state toggle. The form has two fields (username and password) with client-side Zod validation and server-side error handling. The form markup and logic remain the same; only the container changes from an inline `<div>` to the shared Modal component.

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.2 | Story 1.1 | Blocked by | Requires the shared Modal component |
| Story 1.3 | Story 1.1 | Blocked by | Requires the shared Modal component |
| Story 1.4 | Story 1.1 | Blocked by | Requires the shared Modal component |
| Story 1.5 | Story 1.1 | Blocked by | Requires the shared Modal component |


## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | The application does not currently have a reusable modal component, so one needs to be created | High | If one exists, Story 1.1 scope changes to extending the existing component |
| 2 | "Shaded background" means a standard semi-transparent dark overlay (e.g., black at 50% opacity) | High | Minor visual adjustment if a different style is desired |
| 3 | The delete confirmation prompts (currently inline "Are you sure?" text) are NOT included in this refactor since the user did not mention them | Medium | If desired, an additional story would be needed |
| 4 | The Backfill History success message should display inside the modal rather than outside after closing | Medium | The success message could also appear as a toast outside the modal |
| 5 | Inline name editing (EditableTextCell) remains as-is — not converted to modals | High | Confirmed by product owner during review |
| 6 | The Edit User inline form (multi-field form in table row) remains as-is — not converted to a modal | High | Confirmed by product owner during quality review |

## Out of Scope

- Delete confirmation dialogs (currently inline "Are you sure?" prompts in the table rows)
- Inline name editing (EditableTextCell) — remains as inline click-to-edit
- Inline Edit User form (multi-field form in table row) — remains as inline
- Any new form fields or functionality — this is purely a UI container change
- Mobile-specific modal behaviour (responsive design adjustments)
- Animation/transition effects for modal open/close
