# Modal Forms Refactor - Jira Tasks

---

## Epic: UI: Convert Inline Forms to Modal Dialogs

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Replace all inline card-style forms (create team, create department, create user, add members, backfill history) with centered modal dialogs that include a semi-transparent backdrop overlay. The add-members and backfill-history flows are combined into a single modal with two selectable modes, mirroring the current side-by-side button pattern. This improves user focus and prevents page content from shifting when forms are opened.

h2. Business Value

Current inline forms push page content around and make it harder for administrators to focus on the task at hand. Modal dialogs with a dimmed backdrop provide a clear, focused interaction pattern that is consistent and familiar.

h2. Success Metrics

* All create forms open as modal dialogs with a shaded backdrop
* The add-members and backfill-history flows open as a single modal with mode selection
* Page content does not shift when a form is opened
* All existing form functionality (validation, error handling, submit behaviour) works identically inside modals
* The modal pattern is visually consistent across all instances
```

**Acceptance Criteria**:
```
(/) All create forms open as centered modal dialogs
(/) The add-members and backfill-history flows open as a single modal with two selectable modes
(/) A semi-transparent dark overlay covers the page behind every open modal
(/) Modals can be dismissed via Cancel button, Escape key, or overlay click
(/) All existing form validation and error handling continues to work inside modals
(/) The modal pattern is visually consistent across all form instances
```

**Labels**: `ui`, `refactor`, `modal`

---

### Story 1.1: Create a reusable Modal component with backdrop overlay

**Parent**: UI: Convert Inline Forms to Modal Dialogs
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1–3)

**Description**:
```
h2. Context

This story is part of the [UI: Convert Inline Forms to Modal Dialogs] epic. It creates the foundational shared Modal component that all other stories in this epic will use.

h2. User Story

As a developer, I want a shared, reusable modal component with a shaded backdrop so that all forms across the application can use a consistent modal pattern without duplicating overlay and layout code.

h2. Requirements

# A reusable Modal component exists in the shared components directory
# The modal renders a semi-transparent dark overlay covering the full viewport when open
# The modal content is centered on screen (both vertically and horizontally)
# Pressing Escape closes the modal
# Clicking outside the modal content (on the overlay) closes the modal
# The modal traps focus within itself while open (keyboard tab does not move focus behind the overlay)
# The modal is accessible: uses role="dialog", aria-modal="true", and aria-labelledby referencing the modal title
# The component accepts children (the form content) and an onClose callback
# The component accepts a title prop displayed as the modal header
# The page behind the modal does not scroll while the modal is open (body scroll lock is applied and removed on close)
# Only one modal can be open at a time; if a second modal is triggered, the first one closes before the new one opens
```

**Acceptance Criteria**:
```
(/) A reusable Modal component exists in the shared components directory
(/) The modal renders a semi-transparent dark overlay covering the full viewport when open
(/) The modal content is centered on screen (vertically and horizontally)
(/) Pressing Escape closes the modal
(/) Clicking outside the modal content (on the overlay) closes the modal
(/) The modal traps focus within itself while open
(/) The modal uses role="dialog", aria-modal="true", and aria-labelledby referencing the modal title
(/) The component accepts children and an onClose callback
(/) The component accepts a title prop displayed as the modal header
(/) The page behind the modal does not scroll while the modal is open
(/) Only one modal can be open at a time
```

**Labels**: `ui`, `refactor`, `modal`, `shared-component`

---

### Story 1.2: Convert "Create Team" form to a modal dialog

**Parent**: UI: Convert Inline Forms to Modal Dialogs
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1–3)

**Description**:
```
h2. Context

This story is part of the [UI: Convert Inline Forms to Modal Dialogs] epic. It replaces the inline "Add New Team" form card with a modal dialog in the team management view.

h2. User Story

As a dashboard administrator, I want the "Add New Team" form to appear as a modal dialog with a shaded background so that I can focus on creating the team without the page content shifting around.

h2. Requirements

# Clicking the "Add Team" button opens a modal dialog instead of showing an inline form card above the table
# The modal displays the same form fields (team name input), validation messages, and action buttons as the current inline form
# The shaded backdrop overlay is visible behind the modal
# Submitting the form successfully creates the team, closes the modal, and refreshes the team list
# Validation errors (empty name, duplicate name) display within the modal without closing it
# Pressing Cancel or Escape closes the modal without creating a team

h2. Technical Notes

The create form is currently rendered inline in TeamManagementPanel.tsx behind a showCreateForm state toggle. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component.
```

**Acceptance Criteria**:
```
(/) Clicking "Add Team" opens a modal dialog instead of an inline form card
(/) The modal displays the team name input, validation messages, and Create/Cancel buttons
(/) The shaded backdrop overlay is visible behind the modal
(/) Successful creation closes the modal and refreshes the team list
(/) Validation errors display within the modal without closing it
(/) Cancel or Escape closes the modal without creating a team
```

**Labels**: `ui`, `refactor`, `modal`

---

### Story 1.3: Convert "Create Department" form to a modal dialog

**Parent**: UI: Convert Inline Forms to Modal Dialogs
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1–3)

**Description**:
```
h2. Context

This story is part of the [UI: Convert Inline Forms to Modal Dialogs] epic. It replaces the inline "Add New Department" form card with a modal dialog in the department management view.

h2. User Story

As a dashboard administrator, I want the "Add New Department" form to appear as a modal dialog with a shaded background so that I can focus on creating the department without the page content shifting around.

h2. Requirements

# Clicking the "Add Department" button opens a modal dialog instead of showing an inline form card above the table
# The modal displays the same form fields (department name input), validation messages, and action buttons as the current inline form
# The shaded backdrop overlay is visible behind the modal
# Submitting the form successfully creates the department, closes the modal, and refreshes the department list
# Validation errors (empty name, duplicate name) display within the modal without closing it
# Pressing Cancel or Escape closes the modal without creating a department

h2. Technical Notes

The create form is currently rendered inline in DepartmentManagementPanel.tsx behind a showCreateForm state toggle. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component.
```

**Acceptance Criteria**:
```
(/) Clicking "Add Department" opens a modal dialog instead of an inline form card
(/) The modal displays the department name input, validation messages, and Create/Cancel buttons
(/) The shaded backdrop overlay is visible behind the modal
(/) Successful creation closes the modal and refreshes the department list
(/) Validation errors display within the modal without closing it
(/) Cancel or Escape closes the modal without creating a department
```

**Labels**: `ui`, `refactor`, `modal`

---

### Story 1.5: Convert "Add User" form to a modal dialog

**Parent**: UI: Convert Inline Forms to Modal Dialogs
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1–3)

**Description**:
```
h2. Context

This story is part of the [UI: Convert Inline Forms to Modal Dialogs] epic. It replaces the inline "Add New User" form card with a modal dialog in the user management view.

h2. User Story

As a dashboard administrator, I want the "Add New User" form to appear as a modal dialog with a shaded background so that I can focus on creating the user without the page content shifting around.

h2. Requirements

# Clicking the "Add User" button opens a modal dialog instead of showing an inline form card above the table
# The modal displays the same form fields (username input, password input), validation messages, and action buttons as the current inline form
# The shaded backdrop overlay is visible behind the modal
# Submitting the form successfully creates the user, closes the modal, and refreshes the user list
# Validation errors (empty username, username too short, empty password, password too short, duplicate username) display within the modal without closing it
# Server errors (network errors, unexpected failures) display within the modal without closing it
# Pressing Cancel or Escape closes the modal without creating a user

h2. Technical Notes

The create form is currently rendered inline in UserManagementPanel.tsx behind a showCreateForm state toggle. The form has two fields (username and password) with client-side Zod validation and server-side error handling. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component.
```

**Acceptance Criteria**:
```
(/) Clicking "Add User" opens a modal dialog instead of an inline form card
(/) The modal displays the username input, password input, validation messages, and Create/Cancel buttons
(/) The shaded backdrop overlay is visible behind the modal
(/) Successful creation closes the modal and refreshes the user list
(/) Validation errors display within the modal without closing it
(/) Server errors display within the modal without closing it
(/) Cancel or Escape closes the modal without creating a user
```

**Labels**: `ui`, `refactor`, `modal`

---

### Story 1.4: Convert "Add Members" and "Backfill History" flows to a single modal dialog with mode selection

**Parent**: UI: Convert Inline Forms to Modal Dialogs
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (3–5)

**Description**:
```
h2. Context

This story is part of the [UI: Convert Inline Forms to Modal Dialogs] epic. It replaces the two separate inline "Add Members" and "Backfill History" form cards with a single modal dialog that offers both modes as selectable options, mirroring the current side-by-side button pattern but inside a focused modal view.

h2. User Story

As a dashboard administrator, I want a single "Members" modal dialog with two selectable modes — "Add Members" and "Backfill History" — so that I can perform both actions from one focused view without the page content shifting.

h2. Requirements

# A single trigger button opens one modal dialog for team member operations
# The modal presents two selectable options: "Add Members" and "Backfill History", displayed as a mode selection section (similar to the current side-by-side button pattern)
# Selecting "Add Members" reveals the search input, seat checkbox list, and add action buttons within the modal
# Selecting "Backfill History" reveals the date range selectors, search input, seat checkbox list, and backfill action buttons within the modal
# Switching between modes resets the form state of the previously active mode
# The shaded backdrop overlay is visible behind the modal
# The scrollable seat list within the modal functions correctly (scrolls within the modal, not the page)
# In "Add Members" mode: submitting the selection adds members, closes the modal, and refreshes the member list
# In "Add Members" mode: error messages (add failure, load failure) display within the modal
# In "Backfill History" mode: date validation messages (start after end, future date) display within the modal
# In "Backfill History" mode: success and error messages display within the modal
# In "Backfill History" mode: submitting the form triggers the backfill, shows the result in the modal, and the member list refreshes
# Pressing Cancel or Escape closes the modal without performing any action

h2. Technical Notes

The add-members and backfill flows are currently rendered as separate inline sections in TeamMembersPanel.tsx behind showAddFlow and showBackfillFlow state toggles with two separate trigger buttons. These should be consolidated into a single modal with an internal mode toggle, using the shared Modal component.
```

**Acceptance Criteria**:
```
(/) A single trigger button opens one modal dialog for team member operations
(/) The modal presents two selectable options: "Add Members" and "Backfill History" as a mode selection section
(/) Selecting "Add Members" reveals the search input, seat checkbox list, and Add/Cancel buttons
(/) Selecting "Backfill History" reveals the date range selectors, search input, seat checkbox list, and Backfill/Cancel buttons
(/) Switching between modes resets the form state of the previously active mode
(/) The shaded backdrop overlay is visible behind the modal
(/) The scrollable seat list scrolls within the modal container
(/) In "Add Members" mode: successful member addition closes the modal and refreshes the member list
(/) In "Add Members" mode: error messages display within the modal
(/) In "Backfill History" mode: date validation messages display within the modal
(/) In "Backfill History" mode: success and error messages display within the modal
(/) In "Backfill History" mode: submitting triggers the backfill and refreshes the member list
(/) Cancel or Escape closes the modal without performing any action
```

**Labels**: `ui`, `refactor`, `modal`
