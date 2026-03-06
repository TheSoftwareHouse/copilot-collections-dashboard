# Convert "Add User" Form to a Modal Dialog - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.5 |
| Title | Convert "Add User" form to a modal dialog |
| Description | Replace the inline "Add New User" form card with a modal dialog in the user management view. The form has two fields (username and password) with client-side Zod validation and server-side error handling. The form markup and logic remain the same; only the container changes from an inline div to the shared Modal component. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Wrap the existing create-user form JSX inside the shared `Modal` component (built in Story 1.1) within `UserManagementPanel.tsx`. The approach follows the identical pattern established in Stories 1.2 (team) and 1.3 (department):

1. **Import `Modal`** from `@/components/shared/Modal`.
2. **Replace the inline form card** (`<div className="rounded-lg …">` wrapper + `<h2>Add New User</h2>`) with `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New User">`.
3. **Always render the "Add User" button** — currently it is hidden behind a ternary (`showCreateForm ? <form> : <button>`). After the change, the button is always visible and the modal overlays the page independently.
4. **Remove the duplicate heading** — the Modal component already renders the title as an `<h2>`, so the inline `<h2>Add New User</h2>` inside the form card is removed.
5. **No logic changes** — `showCreateForm`, `resetCreateForm`, `handleCreate`, validation (Zod `createUserSchema`), field error handling, server error handling, and API calls remain identical.

The key difference from Stories 1.2/1.3 is that this form has **two fields** (username + password) rather than one, and handles additional error types (409 duplicate username, 400 validation details, network errors). None of this logic changes — only the container.

```
Before:                              After:
┌─────────────────────┐              ┌─────────────────────┐
│ showCreateForm ?    │              │ [Add User] button   │  ← always visible
│   <div card>        │              │                     │
│     <h2>Add New…    │              │ <Modal              │
│     <form>          │              │   isOpen={showCreate}│
│       username      │              │   onClose={reset}   │
│       password      │              │   title="Add New…"> │
│       buttons       │              │   <form>            │
│     </form>         │              │     username        │
│   </div>            │              │     password        │
│ : <Add User button> │              │     buttons         │
└─────────────────────┘              │   </form>           │
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
- `UserManagementPanel` — `src/components/users/UserManagementPanel.tsx` — Full CRUD panel (603 lines) containing: inline create-user form (lines ~280–400) with `showCreateForm` state toggle, `resetCreateForm` helper, `handleCreate` submit handler, username + password inputs, Zod validation via `createUserSchema`, client-side field errors, server error handling (409/400/network), edit flow, delete flow with confirmation.
- `createUserSchema` — `src/lib/validations/user.ts` — Zod schema validating username (required, non-empty, max 255 chars) and password (required, non-empty).
- E2E tests — `e2e/user-management.spec.ts` — Existing tests: navigate and see user list, create new user, edit user, delete own account error, delete another user, deleted user cannot log in.
- E2E modal tests — `e2e/modal.spec.ts` — Generic modal behavior tests (overlay, Escape, focus trap, ARIA).
- Story 1.2 reference — `src/components/teams/TeamManagementPanel.tsx` — Team modal conversion already complete, serves as the pattern to follow.
- Story 1.3 reference — `src/components/departments/DepartmentManagementPanel.tsx` — Department modal conversion already complete, confirms the pattern.

### To Be Modified
- `UserManagementPanel` — `src/components/users/UserManagementPanel.tsx` — Import `Modal`, replace inline form `<div>` wrapper with `<Modal>`, remove duplicate `<h2>`, restructure the ternary so the "Add User" button is always rendered and the Modal is rendered separately.
- `e2e/user-management.spec.ts` — Update the "admin creates a new user" test to interact with the modal dialog (expect `role="dialog"`, form inside modal, modal closes on success). Add tests for validation errors inside the modal and modal dismiss behaviors.

### To Be Created
Nothing — all building blocks exist. This story only modifies existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Add User" button be disabled while the modal is open? | No. The Modal component already enforces single-modal via ModalProvider. If clicked again while open, it is a no-op since `showCreateForm` is already `true`. | ✅ Resolved |
| 2 | Should the create form reset when dismissed via Escape or overlay click? | Yes. Both paths call `resetCreateForm()` via the `onClose` callback, which clears the username, password, field errors, and server error. This matches the current Cancel button behavior. | ✅ Resolved |
| 3 | Does `resetCreateForm` need changes? | No. It already clears all form state (`createUsername`, `createPassword`, `createFieldErrors`, `createServerError`) and sets `showCreateForm(false)`. When called as `onClose`, Modal unmounts. | ✅ Resolved |
| 4 | Can the Story 1.2/1.3 pattern be followed exactly? | Yes. `UserManagementPanel` has the same inline form structure — ternary pattern, `showCreateForm` state, `resetCreateForm` helper, inline card wrapper, same CSS classes. The only difference is two form fields instead of one, which does not impact the container change. | ✅ Resolved |
| 5 | Should the edit-user form (inline in table row) also be converted to a modal? | No. The edit form is scoped to the current story's requirements which only cover the "Add User" (create) form. Edit form conversion is not part of this story. | ✅ Resolved |

## Implementation Plan

### Phase 1: Convert Inline Form to Modal

#### Task 1.1 - [MODIFY] Replace inline form card with Modal in UserManagementPanel
**Description**: In `src/components/users/UserManagementPanel.tsx`, import the shared `Modal` component, restructure the JSX so the "Add User" button is always visible, and wrap the existing form content inside `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New User">`. Remove the inline `<h2>Add New User</h2>` since the Modal component renders the title.

The specific changes are:
1. Add `import Modal from "@/components/shared/Modal";` to the imports.
2. Replace the ternary block (`showCreateForm ? <div card>…</div> : <button>`) with two siblings:
   - The "Add User" `<button>` rendered unconditionally.
   - A `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New User">` containing the form content (server error alert, `<form>` with username input, password input, field errors, and action buttons).
3. Remove the inline `<h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>` since the Modal provides the title via its `title` prop.
4. Remove the outer `<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">` wrapper since the Modal provides its own container styling.

**Definition of Done**:
- [x] `Modal` is imported from `@/components/shared/Modal`
- [x] The "Add User" button is rendered unconditionally (no longer inside the `else` branch of a ternary)
- [x] The create form is wrapped in `<Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New User">`
- [x] The inline heading `<h2>Add New User</h2>` is removed from the form content (the Modal provides this via the `title` prop)
- [x] The inline card wrapper `<div className="rounded-lg …">` is removed (the Modal provides its own container)
- [x] The form fields (username, password), validation messages, and action buttons render identically inside the modal as they did inline
- [x] `resetCreateForm` is called on Cancel click (unchanged), Escape press, and overlay click
- [x] No other component logic is changed (state variables, handlers, API calls, delete flow, edit flow)
- [x] The `FieldErrors` type, `createFieldErrors`, `createServerError`, `createUsername`, `createPassword`, `isCreating` state, and `handleCreate` function remain as-is
- [x] The application compiles with no TypeScript errors (`npx tsc --noEmit`)
- [x] ESLint passes (`npm run lint`)

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update user creation E2E test for modal behavior
**Description**: In `e2e/user-management.spec.ts`, update the "admin creates a new user and it appears in the list" test. After clicking "Add User", assert that a modal dialog (`role="dialog"`) is visible. Interact with form elements inside the dialog scope. After successful creation, assert the dialog closes. Follow the exact same pattern used in `e2e/team-management.spec.ts` and `e2e/department-management.spec.ts`.

- Locate the dialog via `page.getByRole("dialog")`
- Assert overlay visibility via `page.getByTestId("modal-overlay")`
- Assert modal title via `dialog.getByRole("heading", { name: /add new user/i })`
- Scope form interactions to the dialog locator (e.g., `dialog.getByLabel(…)`, `dialog.getByRole("button", …)`)
- Assert dialog closes on success: `await expect(dialog).not.toBeVisible()`

**Definition of Done**:
- [x] The "admin creates a new user" test clicks "Add User", asserts `page.getByRole('dialog')` is visible, fills the form within the dialog, submits, and asserts the dialog is no longer visible after success
- [x] The test asserts the modal overlay (`data-testid="modal-overlay"`) is visible when the modal is open
- [x] The modal title "Add New User" is verified via `dialog.getByRole('heading', { name: /add new user/i })`
- [x] Form interactions (username, password, Create User button) are scoped to the dialog locator
- [x] Existing tests that do not involve the create form continue to pass without changes
- [x] All E2E tests pass (`npm run test:e2e`)

#### Task 2.2 - [CREATE] Add E2E test for validation and server errors inside the modal
**Description**: Add a new test case in `e2e/user-management.spec.ts` that verifies validation errors (empty username, empty password) and server errors (duplicate username) display inside the modal dialog without closing it.

**Definition of Done**:
- [x] New test: "validation errors display inside the create user modal" — opens modal, submits empty form, asserts validation error messages are visible inside the still-open dialog
- [x] The test also verifies duplicate username error: creates a user, opens modal again, attempts to create with same username, asserts 409 error message is visible inside the still-open dialog
- [x] Both scenarios assert the dialog remains open (`await expect(dialog).toBeVisible()`) after the error
- [x] The test passes

#### Task 2.3 - [CREATE] Add E2E tests for modal dismiss via Escape and overlay click
**Description**: Add two new test cases in `e2e/user-management.spec.ts` that verify Escape key and overlay click dismiss the create-user modal without creating a user. Mirror the dismiss tests from `e2e/team-management.spec.ts` and `e2e/department-management.spec.ts`.

**Definition of Done**:
- [x] New test: "pressing Escape closes the create user modal without creating a user" — opens modal, fills some data, presses Escape, asserts dialog is gone, asserts no new user was created
- [x] New test: "clicking overlay closes the create user modal without creating a user" — opens modal, clicks overlay at edge position, asserts dialog is gone, asserts no new user was created
- [x] Both tests pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run automated code review on all files modified in this story.

**Definition of Done**:
- [x] `src/components/users/UserManagementPanel.tsx` modifications pass code review
- [x] `e2e/user-management.spec.ts` modifications pass code review
- [x] No lint errors (`npm run lint`)
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] All existing unit tests continue to pass (`npm test`)
- [x] All E2E tests pass (`npm run test:e2e`)

## Security Considerations

- **No new attack surface**: This change is purely a UI container swap. No new API endpoints, data flows, or user inputs are introduced. The form content, validation (Zod client-side + server-side), and server-side handling remain identical.
- **Password field handling**: The password field continues to use `type="password"` and `autoComplete="new-password"`. No change in how credentials are transmitted (existing POST to `/api/users`). The Modal's portal rendering does not introduce any additional DOM exposure.
- **XSS via modal children**: The Modal renders React children (the form). Since React auto-escapes string content and no `dangerouslySetInnerHTML` is used, this is safe.
- **Focus trap prevents interaction leakage**: The Modal's built-in focus trap ensures keyboard users cannot tab out to page content behind the overlay, preventing accidental interactions with the user table while the create form is open.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking "Add User" opens a modal dialog instead of an inline form card
- [x] The modal displays the username input, password input, validation messages, and Create User/Cancel buttons
- [x] The shaded backdrop overlay is visible behind the modal
- [x] Successful creation closes the modal and refreshes the user list
- [x] Validation errors (empty username, empty password) display within the modal without closing it
- [x] Server errors (duplicate username, network errors) display within the modal without closing it
- [x] Cancel or Escape closes the modal without creating a user
- [x] Clicking the overlay closes the modal without creating a user
- [x] Page content does not shift when the modal opens
- [x] All existing E2E tests pass
- [x] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Convert edit-user inline form to a modal**: The edit form is currently rendered inline inside the table row. Converting it to a modal would provide the same focused interaction pattern. Out of scope for this story — can be a separate follow-up task.
- **Shared CreateEntityModal wrapper**: Stories 1.2 (teams), 1.3 (departments), and 1.5 (users) all follow the same pattern — form fields inside a Modal with validation and server error handling. A shared higher-order component or wrapper accepting a schema, API endpoint, and field config could reduce duplication. The user form has two fields whereas teams/departments have one, so the abstraction would need to support variable field configurations. Recommended as a follow-up after all create-form stories are complete.
- **Auto-focus the username input on modal open**: The Modal currently focuses the first focusable element, which may be the Close (×) button. Adding an `autoFocus` prop to the username `<input>` would provide a better UX by immediately placing the cursor in the field. This can be addressed as a follow-up enhancement.
- **Confirmation on dirty dismiss**: If a user has typed a username/password and presses Escape or clicks the overlay, the form resets without warning. A "discard changes?" prompt could be added but is explicitly out of scope per the epic requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
| 3 March 2026 | Implementation complete — Phase 1 (UserManagementPanel modal conversion), Phase 2 (E2E test updates: 1 modified + 3 new tests), Phase 3 (code review). All 566 unit tests pass, all 9 user-management E2E tests pass, zero TypeScript errors, zero ESLint errors. |
| 3 March 2026 | Code review by `tsh-code-reviewer`: **APPROVED**. No blocking issues. One non-blocking observation: pre-existing unused `clearAuthData` import in `e2e/user-management.spec.ts` (cosmetic, not introduced by this story). |
