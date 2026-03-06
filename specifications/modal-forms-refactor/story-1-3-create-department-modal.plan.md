````markdown
# Convert "Create Department" Form to a Modal Dialog - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.3 |
| Title | Convert "Create Department" form to a modal dialog |
| Description | Replace the inline "Add New Department" form card with a modal dialog in the department management view. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Wrap the existing create-department form JSX inside the shared `Modal` component (built in Story 1.1) within `DepartmentManagementPanel.tsx`. The approach is identical to the pattern established in Story 1.2 (team modal conversion):

1. **Import `Modal`** from `@/components/shared/Modal`.
2. **Replace the inline form card** (`<div className="rounded-lg …">` wrapper + `<h2>Add New Department</h2>`) with `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Department">`.
3. **Always render the "Add Department" button** — currently it is hidden behind a ternary (`showCreateForm ? <form> : <button>`). After the change, the button is always visible and the modal overlays the page independently.
4. **Remove the duplicate heading** — the Modal component already renders the title as an `<h2>`, so the inline `<h2>Add New Department</h2>` inside the form card is removed.
5. **No logic changes** — `showCreateForm`, `resetCreateForm`, `handleCreate`, validation, error handling, and API calls remain identical.

```
Before:                              After:
┌─────────────────────┐              ┌─────────────────────┐
│ showCreateForm ?    │              │ [Add Department] btn│  ← always visible
│   <div card>        │              │                     │
│     <h2>Add New…    │              │ <Modal              │
│     <form>…</form>  │              │   isOpen={showCreate}│
│   </div>            │              │   onClose={reset}   │
│ : <Add Dept button> │              │   title="Add New…"> │
└─────────────────────┘              │   <form>…</form>    │
                                     │ </Modal>            │
                                     └─────────────────────┘
```

**Modal dismissal mapping:**
- Cancel button → calls `resetCreateForm()` (same as today)
- Escape key → Modal's built-in handler calls `onClose` → `resetCreateForm()`
- Overlay click → Modal's built-in handler calls `onClose` → `resetCreateForm()`

## Current Implementation Analysis

### Already Implemented
- `Modal` — `src/components/shared/Modal.tsx` — Reusable modal with backdrop, focus trap, Escape/overlay-click dismiss, portal rendering, `aria-modal`, and `aria-labelledby`. Created in Story 1.1.
- `ModalProvider` — `src/components/shared/ModalProvider.tsx` — Context for single-modal enforcement. Mounted in root layout via `Providers.tsx`. Created in Story 1.1.
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — Full CRUD panel containing the inline create-department form (lines 212–279), `showCreateForm` state, `resetCreateForm` helper, `handleCreate` submit handler, and `createDepartmentSchema` validation.
- `createDepartmentSchema` — `src/lib/validations/department.ts` — Zod schema for department name validation.
- E2E tests — `e2e/department-management.spec.ts` — Existing tests for create, duplicate name, delete, inline edit, navigation, and usage display.
- E2E modal tests — `e2e/modal.spec.ts` — Generic modal behavior tests (overlay, Escape, focus trap, ARIA).
- Story 1.2 reference — `src/components/teams/TeamManagementPanel.tsx` — The team modal conversion is already complete and serves as the exact pattern to follow.

### To Be Modified
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — Import `Modal`, replace inline form `<div>` wrapper with `<Modal>`, remove duplicate `<h2>`, restructure the ternary so the "Add Department" button is always rendered and the Modal is rendered separately.
- `e2e/department-management.spec.ts` — Update the "can create a department" and "cannot create a department with a duplicate name" tests to interact with the modal dialog (expect `role="dialog"`, form inside modal, modal closes on success).

### To Be Created
Nothing — all building blocks exist. This story only modifies existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Add Department" button be disabled while the modal is open? | No. The Modal component already enforces single-modal via ModalProvider. If clicked again while open, it is a no-op since `showCreateForm` is already `true`. | ✅ Resolved |
| 2 | Should the create form reset when dismissed via Escape or overlay click? | Yes. Both paths call `resetCreateForm()` via the `onClose` callback, which clears the name input, field errors, and server error. This matches the current Cancel button behavior. | ✅ Resolved |
| 3 | Does `resetCreateForm` need changes? | No. It already clears all form state and sets `showCreateForm(false)`. When called as `onClose`, Modal unmounts, achieving the same effect. | ✅ Resolved |
| 4 | Can the Story 1.2 (team modal) pattern be followed exactly? | Yes. `DepartmentManagementPanel` has an identical inline form structure to `TeamManagementPanel` — same ternary pattern, same state variables (`showCreateForm`, `resetCreateForm`), same form layout. The conversion is a 1:1 mirror of Story 1.2. | ✅ Resolved |

## Implementation Plan

### Phase 1: Convert Inline Form to Modal

#### Task 1.1 - [MODIFY] Replace inline form card with Modal in DepartmentManagementPanel
**Description**: In `src/components/departments/DepartmentManagementPanel.tsx`, import the shared `Modal` component, restructure the JSX so the "Add Department" button is always visible, and wrap the existing form content inside `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Department">`. Remove the inline `<h2>Add New Department</h2>` since the Modal component renders the title.

The specific changes are:
1. Add `import Modal from "@/components/shared/Modal";` to the imports.
2. Replace the ternary block (`showCreateForm ? <div card>…</div> : <button>`) with two siblings:
   - The "Add Department" `<button>` rendered unconditionally.
   - A `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Department">` containing the form content (server error alert, `<form>` with name input, field errors, and action buttons).
3. Remove the inline `<h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Department</h2>` since the Modal provides the title via its `title` prop.
4. Remove the outer `<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">` wrapper since the Modal provides its own container styling.

**Definition of Done**:
- [x] `Modal` is imported from `@/components/shared/Modal`
- [x] The "Add Department" button is rendered unconditionally (no longer inside the `else` branch of a ternary)
- [x] The create form is wrapped in `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Department">`
- [x] The inline heading `<h2>Add New Department</h2>` is removed from the form content (the Modal provides this via the `title` prop)
- [x] The inline card wrapper `<div className="rounded-lg …">` is removed (the Modal provides its own container)
- [x] The form fields, validation messages, and action buttons render identically inside the modal as they did inline
- [x] `resetCreateForm` is called on Cancel click (unchanged), Escape press, and overlay click
- [x] No other component logic is changed (state variables, handlers, API calls, delete flow, edit flow)
- [x] The `FieldErrors` type, `createFieldErrors`, `createServerError`, `createName`, `isCreating` state, and `handleCreate` function remain as-is
- [x] The application compiles with no TypeScript errors (`npx tsc --noEmit`)
- [x] ESLint passes (`npm run lint`)

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update department creation E2E tests for modal behavior
**Description**: In `e2e/department-management.spec.ts`, update the "can create a department and it appears in the list" and "cannot create a department with a duplicate name" tests. After clicking "Add Department", assert that a modal dialog (`role="dialog"`) is visible. Interact with form elements inside the dialog scope. After successful creation, assert the dialog closes. For duplicate-name errors, assert the error displays inside the still-open dialog.

Follow the exact same pattern used in `e2e/team-management.spec.ts` (Story 1.2):
- Locate the dialog via `page.getByRole("dialog")`
- Assert overlay visibility via `page.getByTestId("modal-overlay")`
- Assert modal title via `dialog.getByRole("heading", { name: /add new department/i })`
- Scope form interactions to the dialog locator (e.g., `dialog.getByLabel(…)`, `dialog.getByRole("button", …)`)
- Assert dialog closes on success: `await expect(dialog).not.toBeVisible()`
- Assert dialog stays open on error: `await expect(dialog).toBeVisible()`

**Definition of Done**:
- [x] The "can create a department" test clicks "Add Department", asserts `page.getByRole('dialog')` is visible, fills the form within the dialog, submits, and asserts the dialog is no longer visible after success
- [x] The "cannot create a department with a duplicate name" test clicks "Add Department", asserts dialog is visible, fills the duplicate name, submits, and asserts the error message is visible inside the still-open dialog
- [x] Both tests assert the modal overlay (`data-testid="modal-overlay"`) is visible when the modal is open
- [x] The modal title "Add New Department" is verified in at least one test via `dialog.getByRole('heading', { name: /add new department/i })`
- [x] Existing tests that do not involve the create form continue to pass without changes
- [x] All E2E tests pass (`npm run test:e2e`)

#### Task 2.2 - [MODIFY] Add E2E tests for modal dismiss via Escape and overlay click
**Description**: Add two new test cases in `e2e/department-management.spec.ts` that verify Escape key and overlay click dismiss the create-department modal without creating a department. Mirror the dismiss tests from `e2e/team-management.spec.ts`.

**Definition of Done**:
- [x] New test: "pressing Escape closes the create department modal without creating a department" — opens modal, fills some data, presses Escape, asserts dialog is gone, asserts no new department was created
- [x] New test: "clicking overlay closes the create department modal without creating a department" — opens modal, clicks overlay at edge position, asserts dialog is gone, asserts no new department was created
- [x] Both tests pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run automated code review on all files modified in this story.

**Definition of Done**:
- [x] `src/components/departments/DepartmentManagementPanel.tsx` modifications pass code review
- [x] `e2e/department-management.spec.ts` modifications pass code review
- [x] No lint errors (`npm run lint`)
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] All existing unit tests continue to pass (`npm test`)
- [x] All E2E tests pass (`npm run test:e2e`)

## Security Considerations

- **No new attack surface**: This change is purely a UI container swap. No new API endpoints, data flows, or user inputs are introduced. The form content, validation, and server-side handling remain identical.
- **XSS via modal children**: The Modal renders React children (the form). Since React auto-escapes string content and no `dangerouslySetInnerHTML` is used, this is safe.
- **Focus trap prevents interaction leakage**: The Modal's built-in focus trap ensures keyboard users cannot tab out to page content behind the overlay, preventing accidental interactions.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking "Add Department" opens a modal dialog instead of an inline form card
- [x] The modal displays the department name input, validation messages, and Create/Cancel buttons
- [x] The shaded backdrop overlay is visible behind the modal
- [x] Successful creation closes the modal and refreshes the department list
- [x] Validation errors (empty name, duplicate name) display within the modal without closing it
- [x] Cancel or Escape closes the modal without creating a department
- [x] Clicking the overlay closes the modal without creating a department
- [x] Page content does not shift when the modal opens
- [x] All existing E2E tests pass
- [x] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Shared CreateEntityModal wrapper**: Stories 1.2 (teams) and 1.3 (departments) follow an identical pattern — a single-field name form inside a Modal. A shared `CreateEntityModal` component accepting a schema, API endpoint, entity label, and field config could eliminate duplication between `TeamManagementPanel` and `DepartmentManagementPanel`. Recommended as a follow-up after both stories are implemented.
- **Auto-focus the name input on modal open**: The Modal currently focuses the first focusable element, which may be the Close (×) button. Adding an `autoFocus` prop to the name `<input>` would provide a better UX by immediately placing the cursor in the field. This can be addressed as a follow-up enhancement.
- **Confirmation on dirty dismiss**: If a user has typed a name and presses Escape or clicks the overlay, the form resets without warning. A "discard changes?" prompt could be added but is explicitly out of scope per the epic requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
| 3 March 2026 | Implementation complete — Phase 1 (DepartmentManagementPanel modal conversion), Phase 2 (E2E test updates + 2 new dismiss tests), Phase 3 (code review). All 566 unit tests pass, zero lint/TS errors. |
| 3 March 2026 | Code review by `tsh-code-reviewer`: **APPROVED**. No blocking issues. Two observations (non-blocking): (1) shared CreateEntityModal wrapper for teams+departments deferred per plan, (2) auto-focus name input on modal open noted as out-of-scope improvement. |

````
