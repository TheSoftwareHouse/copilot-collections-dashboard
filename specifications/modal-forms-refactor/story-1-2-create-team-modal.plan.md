# Convert "Create Team" Form to a Modal Dialog - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.2 |
| Title | Convert "Create Team" form to a modal dialog |
| Description | Replace the inline "Add New Team" form card with a modal dialog in the team management view. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Wrap the existing create-team form JSX inside the shared `Modal` component (built in Story 1.1) within `TeamManagementPanel.tsx`. The approach is minimal and surgical:

1. **Import `Modal`** from `@/components/shared/Modal`.
2. **Replace the inline form card** (`<div className="rounded-lg …">` wrapper + `<h2>Add New Team</h2>`) with `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Team">`.
3. **Always render the "Add Team" button** — currently it is hidden behind the ternary (`showCreateForm ? <form> : <button>`). After the change, the button is always visible and the modal overlays the page independently.
4. **Remove the duplicate heading** — the Modal component already renders the title as an `<h2>`, so the inline `<h2>Add New Team</h2>` inside the form card is removed.
5. **No logic changes** — `showCreateForm`, `resetCreateForm`, `handleCreate`, validation, error handling, and API calls remain identical.

```
Before:                              After:
┌─────────────────────┐              ┌─────────────────────┐
│ showCreateForm ?    │              │ [Add Team] button   │  ← always visible
│   <div card>        │              │                     │
│     <h2>Add New…    │              │ <Modal              │
│     <form>…</form>  │              │   isOpen={showCreate}│
│   </div>            │              │   onClose={reset}   │
│ : <Add Team button> │              │   title="Add New…"> │
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
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Full CRUD panel containing the inline create-team form (lines 227–296), `showCreateForm` state, `resetCreateForm` helper, `handleCreate` submit handler, and `createTeamSchema` validation.
- `createTeamSchema` — `src/lib/validations/team.ts` — Zod schema for team name validation.
- E2E tests — `e2e/team-management.spec.ts` — Existing tests for create, duplicate, delete, inline edit, and navigation.
- E2E modal tests — `e2e/modal.spec.ts` — Generic modal behavior tests (overlay, Escape, focus trap, ARIA).

### To Be Modified
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Import `Modal`, replace inline form `<div>` wrapper with `<Modal>`, remove duplicate `<h2>`, restructure the ternary so the "Add Team" button is always rendered and the Modal is rendered separately.
- `e2e/team-management.spec.ts` — Update the "can create a team" and "cannot create a team with a duplicate name" tests to interact with the modal dialog (expect `role="dialog"`, form inside modal, modal closes on success).

### To Be Created
Nothing — all building blocks exist. This story only modifies existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Add Team" button be disabled while the modal is open? | No. The Modal component already enforces single-modal via ModalProvider. If clicked again while open, it is a no-op since `showCreateForm` is already `true`. | ✅ Resolved |
| 2 | Should the create form reset when dismissed via Escape or overlay click? | Yes. Both paths call `resetCreateForm()` via the `onClose` callback, which clears the name input, field errors, and server error. This matches the current Cancel button behavior. | ✅ Resolved |
| 3 | Does `resetCreateForm` need changes? | No. It already clears all form state and sets `showCreateForm(false)`. When called as `onClose`, Modal unmounts, achieving the same effect. | ✅ Resolved |

## Implementation Plan

### Phase 1: Convert Inline Form to Modal

#### Task 1.1 - [MODIFY] Replace inline form card with Modal in TeamManagementPanel
**Description**: In `src/components/teams/TeamManagementPanel.tsx`, import the shared `Modal` component, restructure the JSX so the "Add Team" button is always visible, and wrap the existing form content inside `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Team">`. Remove the inline `<h2>Add New Team</h2>` since the Modal component renders the title.

**Definition of Done**:
- [x] `Modal` is imported from `@/components/shared/Modal`
- [x] The "Add Team" button is rendered unconditionally (no longer inside the `else` branch of a ternary)
- [x] The create form is wrapped in `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New Team">`
- [x] The inline heading `<h2>Add New Team</h2>` is removed from the form content (the Modal provides this via the `title` prop)
- [x] The form fields, validation messages, and action buttons render identically inside the modal as they did inline
- [x] `resetCreateForm` is called on Cancel click (unchanged), Escape press, and overlay click
- [x] No other component logic is changed (state variables, handlers, API calls, delete flow, edit flow, members flow)
- [x] The `FieldErrors` type, `createFieldErrors`, `createServerError`, `createName`, `isCreating` state, and `handleCreate` function remain as-is
- [x] The application compiles with no TypeScript errors (`npx tsc --noEmit`)
- [x] ESLint passes (`npm run lint`)

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update team creation E2E tests for modal behavior
**Description**: In `e2e/team-management.spec.ts`, update the "can create a team and it appears in the list" and "cannot create a team with a duplicate name" tests. After clicking "Add Team", assert that a modal dialog (`role="dialog"`) is visible. Interact with form elements inside the dialog scope. After successful creation, assert the dialog closes. For duplicate-name errors, assert the error displays inside the still-open dialog.

**Definition of Done**:
- [x] The "can create a team" test clicks "Add Team", asserts `page.getByRole('dialog')` is visible, fills the form within the dialog, submits, and asserts the dialog is no longer visible after success
- [x] The "cannot create a team with a duplicate name" test clicks "Add Team", asserts dialog is visible, fills the duplicate name, submits, and asserts the error message is visible inside the still-open dialog
- [x] Both tests assert the modal overlay (`data-testid="modal-overlay"`) is visible when the modal is open
- [x] The modal title "Add New Team" is verified in at least one test via `dialog.getByRole('heading', { name: /add new team/i })`
- [x] Existing tests that do not involve the create form continue to pass without changes
- [x] All E2E tests pass (`npm run test:e2e`)

#### Task 2.2 - [MODIFY] Add E2E test for modal dismiss via Escape and overlay click
**Description**: Add two new test cases in `e2e/team-management.spec.ts` that verify Escape key and overlay click dismiss the create-team modal without creating a team.

**Definition of Done**:
- [x] New test: "pressing Escape closes the create team modal without creating a team" — opens modal, fills some data, presses Escape, asserts dialog is gone, asserts no new team was created
- [x] New test: "clicking overlay closes the create team modal without creating a team" — opens modal, clicks overlay at edge position, asserts dialog is gone, asserts no new team was created
- [x] Both tests pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run automated code review on all files modified in this story.

**Definition of Done**:
- [x] `src/components/teams/TeamManagementPanel.tsx` modifications pass code review
- [x] `e2e/team-management.spec.ts` modifications pass code review
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

- [x] Clicking "Add Team" opens a modal dialog instead of an inline form card
- [x] The modal displays the team name input, validation messages, and Create/Cancel buttons
- [x] The shaded backdrop overlay is visible behind the modal
- [x] Successful creation closes the modal and refreshes the team list
- [x] Validation errors (empty name, duplicate name) display within the modal without closing it
- [x] Cancel or Escape closes the modal without creating a team
- [x] Clicking the overlay closes the modal without creating a team
- [x] Page content does not shift when the modal opens
- [x] All existing E2E tests pass
- [x] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Auto-focus the name input on modal open**: The Modal currently focuses the first focusable element, which may be the Close (×) button. Adding an `autoFocus` prop to the name `<input>` would provide a better UX by immediately placing the cursor in the field. This can be addressed as a follow-up enhancement.
- **Confirmation on dirty dismiss**: If a user has typed a name and presses Escape or clicks the overlay, the form resets without warning. A "discard changes?" prompt could be added but is explicitly out of scope per the epic requirements.
- **Shared CreateEntityModal wrapper**: Stories 1.2 (teams) and 1.3 (departments) follow an identical pattern. A shared `CreateEntityModal` component accepting a schema, API endpoint, and field config could reduce duplication. Recommended as a follow-up after both stories are implemented.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2 March 2026 | Initial plan created |
| 2 March 2026 | Implementation complete — Phase 1 (TeamManagementPanel modal conversion), Phase 2 (E2E test updates + 2 new dismiss tests), Phase 3 (code review). All 566 unit tests pass, all 193 E2E tests pass, zero lint/TS errors. |
| 2 March 2026 | Code review by `tsh-code-reviewer`: **APPROVED**. No blocking issues. Two non-blocking suggestions: (1) auto-focus name input on modal open (noted as out of scope), (2) stronger "no team created" assertion in dismiss tests (current approach adequate). |
