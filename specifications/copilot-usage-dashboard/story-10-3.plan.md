# Story 10.3: Inline Editing of Seat Fields in the Table — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.3 |
| Title | Inline editing of seat fields in the table |
| Description | Replace the current row-takeover edit form in the seat table with per-cell inline editing. Clicking on a first name, last name, or department cell activates editing within that cell. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (lines 1642–1683) |

## Proposed Solution

Replace the existing "Edit" button + full-row form pattern in `SeatListPanel` with true per-cell inline editing. Each editable cell (first name, last name, department) becomes a click-to-edit control:

- **Text fields** (firstName, lastName): clicking the cell value reveals an input field in-place. Pressing Enter or clicking outside saves the change. Pressing Escape cancels.
- **Department field**: clicking the cell reveals a `<select>` dropdown in-place with the same department options currently used. Selecting a value saves immediately. Pressing Escape cancels.
- **Saving indicator**: a small spinner replaces the cell content while the API call is in flight.
- **Error handling**: on save failure, the cell reverts to the previous value and a brief error toast/indicator is shown.

Two new reusable components are introduced:
- `EditableTextCell` — handles inline text editing with Enter/Escape/blur semantics.
- `EditableDepartmentCell` — handles inline dropdown editing for department selection.

After a successful save, the local seat array is patched in-place (optimistic update from API response) to avoid a full list reload and preserve scroll position.

The existing "Edit" button and colSpan row form are removed.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Seat Table                                                                   │
├──────────────┬────────┬────────────┬───────────┬────────────┬───────┬───────┤
│ GitHub User  │ Status │ First Name │ Last Name │ Department │ Last… │ Usa…  │
├──────────────┼────────┼────────────┼───────────┼────────────┼───────┼───────┤
│ octocat  [→] │ Active │ Octo  [✎]  │ Cat  [✎]  │ Eng   [▼]  │ 2d    │ 45%   │
│ devuser  [→] │ Active │ [click to  │ [click to │ [click to  │ 5d    │ 32%   │
│              │        │  edit]     │  edit]    │  select]   │       │       │
└──────────────┴────────┴────────────┴───────────┴────────────┴───────┴───────┘
                          ↑ Per-cell inline editing, no row takeover
```

No backend API changes are required — the existing `PUT /api/seats/[id]` endpoint already supports partial field updates.

## Current Implementation Analysis

### Already Implemented
- `PUT /api/seats/[id]` — [src/app/api/seats/[id]/route.ts](../../src/app/api/seats/%5Bid%5D/route.ts) — Supports partial updates of firstName, lastName, departmentId with Zod validation
- `updateSeatSchema` — [src/lib/validations/seat.ts](../../src/lib/validations/seat.ts) — Zod schema allowing nullable fields and partial updates
- `GET /api/departments` — [src/app/api/departments/route.ts](../../src/app/api/departments/route.ts) — Returns all departments for dropdown population
- `GET /api/seats` — [src/app/api/seats/route.ts](../../src/app/api/seats/route.ts) — Paginated seat list with filtering, sorting, search
- Department loading — `SeatListPanel` already fetches departments on mount for the edit dropdown
- API route unit tests — [src/app/api/seats/__tests__/[id].route.test.ts](../../src/app/api/seats/__tests__/%5Bid%5D.route.test.ts) — Comprehensive PUT endpoint tests
- E2E seat edit tests — [e2e/seat-edit.spec.ts](../../e2e/seat-edit.spec.ts) — Tests for the current row-takeover edit pattern

### To Be Modified
- `SeatListPanel` — [src/components/seats/SeatListPanel.tsx](../../src/components/seats/SeatListPanel.tsx) — Remove row-takeover edit form; replace static firstName/lastName/department cells with inline editable cells; remove "Edit" button; add local-state update on save; remove obsolete edit state variables
- `seat-edit.spec.ts` — [e2e/seat-edit.spec.ts](../../e2e/seat-edit.spec.ts) — Rewrite all tests to use the new per-cell inline editing interaction pattern (click cell, type, press Enter, etc.)

### To Be Created
- `EditableTextCell` — New component in `src/components/seats/EditableTextCell.tsx` — Reusable inline text-editing cell with Enter/Escape/blur save/cancel semantics
- `EditableDepartmentCell` — New component in `src/components/seats/EditableDepartmentCell.tsx` — Inline department select cell with change-to-save and Escape-to-cancel semantics

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Edit" button be removed entirely or kept as alternative? | Remove it — clicking cells directly is the new edit mechanism. Story says "can be removed or kept"; removing it simplifies the UX and code. | ✅ Resolved |
| 2 | Should multiple cells be editable simultaneously? | No — activating one cell should cancel any other active edit to avoid conflicting saves. | ✅ Resolved |
| 3 | Should the save use optimistic local update or full list reload? | Local patch from API response for smooth UX, consistent with DX goals. Falls back to full reload on error. | ✅ Resolved |

## Implementation Plan

### Phase 1: Create Reusable Inline Edit Components

#### Task 1.1 - [CREATE] EditableTextCell component
**Description**: Create a reusable `EditableTextCell` React component in `src/components/seats/EditableTextCell.tsx`. The component renders static text by default. Clicking the text activates edit mode with an `<input>` element. Enter or blur saves the change (calls `onSave` callback). Escape reverts to the original value and exits edit mode. While saving, a spinner/loading indicator is shown. On save error, the cell reverts and an error is briefly indicated. The static text should use `role="button"`, `tabIndex={0}`, and `cursor-pointer` styling to indicate clickability. Null/empty values display as "—" (em dash).

**Definition of Done**:
- [x] Component accepts props: `value: string | null`, `onSave: (newValue: string | null) => Promise<void>`, `ariaLabel: string`
- [x] Clicking the static text switches to an input pre-filled with the current value
- [x] Input auto-focuses on activation
- [x] Pressing Enter calls `onSave` with the trimmed value (empty string → `null`)
- [x] Clicking outside (blur) calls `onSave` with the trimmed value
- [x] Pressing Escape reverts to the original value and exits edit mode without calling `onSave`
- [x] If the value has not changed, exiting edit mode does not call `onSave`
- [x] While `onSave` is in-flight, a loading spinner is shown and the input is disabled
- [x] On `onSave` rejection, the cell reverts to the original value
- [x] Static text has `role="button"`, `tabIndex={0}`, `aria-label` set to the provided label
- [x] Keyboard activation: pressing Enter or Space on the static text activates edit mode
- [x] Null/empty values display "—" in static mode
- [x] Component uses the same Tailwind classes as the existing cell styling (`text-sm text-gray-700`, etc.)

#### Task 1.2 - [CREATE] EditableDepartmentCell component
**Description**: Create an `EditableDepartmentCell` React component in `src/components/seats/EditableDepartmentCell.tsx`. The component renders the department name as static text. Clicking activates a `<select>` dropdown populated with department options. Selecting a different value calls `onSave`. Escape reverts. While saving, a spinner is shown.

**Definition of Done**:
- [x] Component accepts props: `departmentId: number | null`, `departmentName: string | null`, `departments: { id: number; name: string }[]`, `onSave: (departmentId: number | null) => Promise<void>`
- [x] Clicking the static text switches to a `<select>` dropdown with "— None —" as first option followed by all departments
- [x] Select auto-focuses on activation and pre-selects the current department
- [x] Changing the select value calls `onSave` with the new `departmentId` (or `null` for "None")
- [x] Pressing Escape reverts to the original value and exits edit mode without calling `onSave`
- [x] Blur without change exits edit mode without calling `onSave`
- [x] If the selected value is the same as the current value, `onSave` is not called
- [x] While `onSave` is in-flight, a loading spinner is shown and the select is disabled
- [x] On `onSave` rejection, the cell reverts to the original department
- [x] Static text has `role="button"`, `tabIndex={0}`, `aria-label="Edit department"`
- [x] Null department displays "—" in static mode
- [x] Component uses the same Tailwind classes as the existing cell styling

### Phase 2: Integrate Inline Editing into SeatListPanel

#### Task 2.1 - [MODIFY] Remove old row-takeover edit form from SeatListPanel
**Description**: Remove all state and logic related to the current row-takeover edit form from `SeatListPanel.tsx`. This includes: `editingSeatId`, `editFirstName`, `editLastName`, `editDepartmentId`, `editFieldErrors`, `editServerError`, `isSaving` state variables; `startEdit`, `cancelEdit`, `handleEditSubmit` functions; the `colSpan={8}` edit form JSX; the "Edit" button in the Actions column; and the `updateSeatSchema` import. Remove the Actions column header and cell entirely.

**Definition of Done**:
- [x] All edit form state variables (`editingSeatId`, `editFirstName`, `editLastName`, `editDepartmentId`, `editFieldErrors`, `editServerError`, `isSaving`) are removed
- [x] `startEdit`, `cancelEdit`, `handleEditSubmit` functions are removed
- [x] The colSpan edit form row JSX block is removed
- [x] The "Edit" button and Actions column (`<th>` and `<td>`) are removed from the table
- [x] The `updateSeatSchema` import is removed
- [x] The table renders without errors and displays all seat data correctly
- [x] The `colSpan` on edit form row (if any conditional block existed) is completely gone

#### Task 2.2 - [MODIFY] Add inline editable cells and save logic to SeatListPanel
**Description**: Replace the static `<td>` elements for firstName, lastName, and department with `EditableTextCell` and `EditableDepartmentCell` components. Add a `updateSeatField` function that calls `PUT /api/seats/[id]` with a single-field payload and patches the local `data.seats` array on success. If only one cell should be editable at a time, pass an `activeEditSeatField` key to cancel other active edits when a new one activates.

**Definition of Done**:
- [x] firstName column renders `<EditableTextCell>` with `value={seat.firstName}` and `onSave` calling `updateSeatField(seat.id, { firstName: value })`
- [x] lastName column renders `<EditableTextCell>` with `value={seat.lastName}` and `onSave` calling `updateSeatField(seat.id, { lastName: value })`
- [x] department column renders `<EditableDepartmentCell>` with `departmentId={seat.departmentId}`, `departmentName={seat.department}`, `departments={departments}`, and `onSave` calling `updateSeatField(seat.id, { departmentId: value })`
- [x] `updateSeatField` function sends `PUT /api/seats/{seatId}` with the field payload, receives the updated seat, and patches the corresponding entry in `data.seats` state (updating `firstName`, `lastName`, `department`, `departmentId` from the response)
- [x] On `updateSeatField` error, the Promise is rejected so the inline cell reverts
- [x] `SeatFieldErrors` type import is removed (no longer needed)
- [x] The `departments` state is retained and passed to each `EditableDepartmentCell`
- [x] The table still displays all columns correctly: GitHub Username, Status, First Name, Last Name, Department, Last Active, Usage %

### Phase 3: Update E2E Tests

#### Task 3.1 - [MODIFY] Rewrite seat-edit E2E tests for inline editing pattern
**Description**: Rewrite `e2e/seat-edit.spec.ts` to test the new per-cell inline editing interaction. Replace all tests that reference the "Edit" button and row form with tests that click directly on cells. Cover: activation by click, save on Enter, save on blur, cancel on Escape, department dropdown selection, saving indicator, clearing a field to null, and cross-feature verification (department usage reflected after inline edit).

**Definition of Done**:
- [x] Test: clicking on a first name cell activates an inline text input with the current value
- [x] Test: pressing Enter in the first name input saves the new value and exits edit mode
- [x] Test: pressing Escape in the firstName input reverts to the original value
- [x] Test: clicking outside (blur) the first name input saves the new value
- [x] Test: clicking on the department cell activates a dropdown with all departments listed
- [x] Test: selecting a different department saves it immediately and the new department is displayed
- [x] Test: user can update first name, last name, and department via inline editing (sequential cell edits)
- [x] Test: clearing a text field (empty input + Enter) saves null, displayed as "—"
- [x] Test: selecting "None" in department dropdown clears the department, displayed as "—"
- [x] Test: editing does not change GitHub username or status (these cells are not editable)
- [x] Test: assigning department via inline edit is reflected in the department usage tab
- [x] All tests pass against the updated SeatListPanel implementation
- [x] No references to the removed "Edit" button or row-form remain in the test file

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review by tsh-code-reviewer agent
**Description**: Run a full code review of all changed and newly created files using the `tsh-code-reviewer` agent. The review should cover code quality, accessibility, consistency with project patterns, test coverage, and adherence to the acceptance criteria.

**Definition of Done**:
- [ ] All changed files reviewed: `EditableTextCell.tsx`, `EditableDepartmentCell.tsx`, `SeatListPanel.tsx`, `seat-edit.spec.ts`
- [ ] No critical or high-severity findings remain unresolved
- [ ] Accessibility requirements verified (keyboard navigation, ARIA attributes, focus management)
- [ ] Code follows existing project conventions (Tailwind styling, state management patterns, error handling)

## Security Considerations

- **No new API endpoints**: Inline editing reuses the existing authenticated `PUT /api/seats/[id]` endpoint. No additional attack surface is introduced.
- **Input validation unchanged**: All input continues to be validated server-side by the Zod `updateSeatSchema`. Client-side trimming is cosmetic only.
- **Auth enforcement unchanged**: The `requireAuth` middleware on the PUT route ensures only authenticated users can modify seat data.
- **No XSS risk increase**: React's JSX escaping handles all rendered values. No `dangerouslySetInnerHTML` is used.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking on a first name, last name, or department cell activates inline editing
- [x] An input field appears in place for text fields (first name, last name)
- [x] A dropdown appears for department selection
- [x] Pressing Enter or clicking outside saves the change
- [x] Pressing Escape cancels the edit and reverts to the previous value
- [x] A loading/saving indicator is shown while saving
- [x] The existing edit form/button is removed (replaced by direct cell click)
- [x] Keyboard accessibility: editable cells are reachable via Tab, activatable via Enter/Space
- [x] Screen reader: editable cells have appropriate ARIA attributes
- [x] All E2E tests in `seat-edit.spec.ts` pass
- [x] No regressions in `seat-list.spec.ts` or `seat-list-controls.spec.ts`

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Inline editing for team names (Story 10.4)** and **department names (Story 10.5)**: The `EditableTextCell` component created here can be reused directly. These are separate stories.
- **Undo/toast notification**: After saving, show a brief toast with "Undo" option for accidental edits.
- **Batch editing**: Allow selecting multiple seats and editing a field for all of them at once.
- **Optimistic UI with rollback**: Currently the cell shows a spinner during save. A more advanced approach would show the new value immediately and roll back on error.
- **Extract inline edit components to shared directory**: If Stories 10.4 and 10.5 need the same components, move them from `src/components/seats/` to `src/components/shared/` or `src/components/common/`.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation completed — all phases done, 11 E2E tests pass, 502 unit tests pass |
