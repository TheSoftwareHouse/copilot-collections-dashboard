# Story 10.5: Inline Editing of Department Names in the Management Table — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.5 |
| Title | Inline editing of department names in the management table |
| Description | Replace the current row-takeover edit form in the department management table with per-cell inline editing. Clicking on a department name activates editing within that cell, allowing quick renaming without opening a separate form. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (lines 1732–1797), [extracted-tasks.md](./extracted-tasks.md) (lines 631+), [story-10-4.plan.md](./story-10-4.plan.md) (identical pattern for teams) |

## Proposed Solution

Replace the existing "Edit" button + full-row form pattern in `DepartmentManagementPanel` with true per-cell inline editing of the department name. This mirrors the exact pattern already implemented for teams in Story 10.4.

**Key changes:**

1. **Reuse `EditableTextCell` from shared location** — The component already lives in `src/components/shared/EditableTextCell.tsx` (moved there in Story 10.4). No relocation needed.

2. **Replace the department name `<Link>` with `EditableTextCell`** — Currently the department name is a Next.js `<Link>` that navigates to the department usage detail page (added in Story 10.2). With inline editing, clicking the name activates edit mode. A separate small navigation link icon (→) is added adjacent to the name so users can still navigate to the department usage detail page.

3. **Remove old row-takeover edit form** — All state and logic related to the current colSpan=5 edit form are removed: `editingDeptId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing` state variables; `startEdit`, `cancelEdit`, `handleEdit` functions; the edit form JSX; the "Edit" button from the Actions column; and the `updateDepartmentSchema` import.

4. **Add `updateDepartmentName` function** — A new function (wrapped in `useCallback`) calls `PUT /api/departments/${deptId}` with the updated name. On success, it patches the local `departments` state array in-place to avoid a full list reload. On error (409 duplicate, 400 validation, 404 not found, network failure), the Promise is rejected so the `EditableTextCell` reverts and flashes red.

5. **Empty name validation** — The `onSave` callback rejects immediately if the user clears the name to empty/null, preventing a pointless API call. The `EditableTextCell` reverts to the original value and flashes the error indicator.

6. **Duplicate name validation** — Handled server-side by the existing `PUT /api/departments/[id]` endpoint which returns 409 for duplicate names. The cell reverts and flashes the error indicator.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Department Management Table                                                  │
├────────────────────────────────┬───────┬─────────┬──────────┬───────────────┤
│ Name                           │ Seats │ Usage % │ Created  │ Actions       │
├────────────────────────────────┼───────┼─────────┼──────────┼───────────────┤
│ [●] Engineering [✎] →         │    5  │   72%   │ 1/15/26  │ Delete        │
│ [●] Research [✎]  →           │    3  │   45%   │ 1/20/26  │ Delete        │
└────────────────────────────────┴───────┴─────────┴──────────┴───────────────┘
               ↑                                                    ↑
  Click name = inline edit                               "Edit" button removed
  [→] = link to usage detail page
  [●] = UsageStatusIndicator
```

**No backend API changes are required** — the existing `PUT /api/departments/[id]` endpoint already supports name updates with Zod validation, duplicate name detection (409), not-found handling (404), and authentication.

## Current Implementation Analysis

### Already Implemented
- `EditableTextCell` — [src/components/shared/EditableTextCell.tsx](../../src/components/shared/EditableTextCell.tsx) — Reusable inline text-editing component with Enter/Escape/blur save/cancel, loading spinner, and error flash. Created in Story 10.3, relocated to shared in Story 10.4.
- `PUT /api/departments/[id]` — [src/app/api/departments/[id]/route.ts](../../src/app/api/departments/%5Bid%5D/route.ts) — Supports name updates with Zod validation (`updateDepartmentSchema`), returns 409 for duplicate names, 404 for missing departments. Auth-protected via `requireAuth`.
- `updateDepartmentSchema` — [src/lib/validations/department.ts](../../src/lib/validations/department.ts) — Zod schema requiring non-empty string, max 255 chars, with trim.
- `UsageStatusIndicator` — [src/components/usage/UsageStatusIndicator.tsx](../../src/components/usage/UsageStatusIndicator.tsx) — Colour-coded dot indicator used in department rows.
- API route unit tests — [src/app/api/departments/__tests__/[id].route.test.ts](../../src/app/api/departments/__tests__/%5Bid%5D.route.test.ts) — Comprehensive PUT endpoint tests covering 401, 400, 404, 409, and 200 responses.
- E2E department management tests — [e2e/department-management.spec.ts](../../e2e/department-management.spec.ts) — Tests for create, edit (row-form pattern), delete, usage indicators, and seat count warning.
- Cross-linking test — [e2e/cross-linking.spec.ts](../../e2e/cross-linking.spec.ts) — "department name in management links to department usage page" test clicks `<Link>` with text "CrossLink Dept".
- `TeamManagementPanel` — [src/components/teams/TeamManagementPanel.tsx](../../src/components/teams/TeamManagementPanel.tsx) — Reference implementation of the identical inline-editing pattern (Story 10.4) to mirror.

### To Be Modified
- `DepartmentManagementPanel` — [src/components/departments/DepartmentManagementPanel.tsx](../../src/components/departments/DepartmentManagementPanel.tsx) — Remove row-takeover edit form; replace department name `<Link>` with `EditableTextCell` + separate navigation icon; remove "Edit" button from Actions column; add `updateDepartmentName` function with local state patching.
- `department-management.spec.ts` — [e2e/department-management.spec.ts](../../e2e/department-management.spec.ts) — Rewrite the "can edit a department name inline" test to use the new click-on-cell interaction pattern; add tests for escape-to-cancel, empty name prevention, and duplicate name prevention.
- `cross-linking.spec.ts` — [e2e/cross-linking.spec.ts](../../e2e/cross-linking.spec.ts) — Update the "department name in management links to department usage page" test to click the navigation icon (→) with `aria-label="View department usage"` instead of clicking the department name text link.

### To Be Created
_Nothing needs to be created from scratch. All required components and API endpoints already exist._

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | How should users navigate to the department usage detail page after the name becomes editable instead of a link? | Add a small link icon (→) adjacent to the department name in the same cell. Clicking the icon navigates to `/usage/departments/${dept.id}`. This separates the edit trigger (click name) from the navigate trigger (click icon). This is the same pattern used for teams in Story 10.4. | ✅ Resolved |
| 2 | Should the `FieldErrors` type alias be retained after removing the edit form? | Yes — it is still used by the create form (`createFieldErrors`). | ✅ Resolved |
| 3 | Should the `updateDepartmentSchema` import be kept? | No — the edit form was the only consumer of `updateDepartmentSchema`. The create form uses `createDepartmentSchema`. Validation for inline editing is handled server-side by the `PUT /api/departments/[id]` endpoint. | ✅ Resolved |
| 4 | Should the department PUT response include `seatCount` and `usagePercent` for local state patching? | No — the existing PUT response returns `{ id, name, createdAt, updatedAt }`. Since only `name` and `updatedAt` change during a rename, the local state patch updates only those two fields, retaining the existing `seatCount` and `usagePercent` values. No API change needed. | ✅ Resolved |

## Implementation Plan

### Phase 1: Replace Row-Takeover Edit with Inline Editing in DepartmentManagementPanel

#### Task 1.1 - [MODIFY] Remove old edit form state, logic, and JSX from DepartmentManagementPanel
**Description**: Remove all state variables and functions related to the row-takeover edit form from `DepartmentManagementPanel.tsx`. This includes: `editingDeptId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing` state variables; `startEdit`, `cancelEdit`, `handleEdit` functions; the `colSpan={5}` edit form row JSX block; the "Edit" button from the Actions column; and the `updateDepartmentSchema` import. Retain the `FieldErrors` type alias (still used by the create form), the `confirmDeleteId`/`deleteError`/`isDeleting` delete state, and the "Delete" button in the Actions column.

**Definition of Done**:
- [x] State variables removed: `editingDeptId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing`
- [x] Functions removed: `startEdit`, `cancelEdit`, `handleEdit`
- [x] The `colSpan={5}` edit form row JSX is removed
- [x] The "Edit" button is removed from the Actions column
- [x] The `updateDepartmentSchema` import is removed (only `createDepartmentSchema` retained)
- [x] `FieldErrors` type alias is retained (still used by create form)
- [x] "Delete" button and delete confirmation flow remain functional in the Actions column
- [x] The table renders without errors and all columns display correctly
- [x] No TypeScript compilation errors

#### Task 1.2 - [MODIFY] Replace department name link with EditableTextCell and separate navigation icon
**Description**: In the department table row (non-editing view), replace the `<Link>` wrapper on the department name with the `EditableTextCell` component. The `UsageStatusIndicator` remains before the name. A small link icon (→) is added after the `EditableTextCell` as a `<Link>` to `/usage/departments/${dept.id}` for navigation. Import `EditableTextCell` from `@/components/shared/EditableTextCell`. Add a `updateDepartmentName` async function (wrapped in `useCallback`) that: (1) rejects immediately if the new value is null (prevents saving empty names without an API call); (2) calls `PUT /api/departments/${deptId}` with `{ name: newValue }`; (3) on success (200), patches the matching entry in the local `departments` state array with the updated `name` and `updatedAt` from the response; (4) on error (409, 400, 404, network), rejects the Promise so the cell reverts.

**Definition of Done**:
- [x] `EditableTextCell` imported from `@/components/shared/EditableTextCell`
- [x] Department name column renders `<EditableTextCell>` with `value={dept.name}` and `ariaLabel={`Edit name for department ${dept.name}`}`
- [x] `onSave` callback rejects with an Error if new value is null (empty name prevention)
- [x] `onSave` callback calls `updateDepartmentName(dept.id, newValue)` for non-null values
- [x] `updateDepartmentName` function sends `PUT /api/departments/{deptId}` with `{ name }` payload
- [x] `updateDepartmentName` is wrapped in `useCallback` with empty dependency array
- [x] On 200 response, the local `departments` state is patched in-place (`name`, `updatedAt`) without full list reload
- [x] On 409/400/404/network error, the Promise is rejected so the cell reverts and flashes red
- [x] `UsageStatusIndicator` remains visible before the department name in each row
- [x] A small navigation `<Link>` icon (→) is added after the `EditableTextCell`, pointing to `/usage/departments/${dept.id}`, with `aria-label="View department usage"` and accessible styling
- [x] The `<Link>` import from `next/link` is retained for the navigation icon
- [x] All other columns (Seats, Usage %, Created, Actions) remain unchanged
- [x] Previously direct `<Link>` on department name text is fully removed

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Rewrite department edit E2E test for inline editing pattern
**Description**: Rewrite the existing "can edit a department name inline" test in `e2e/department-management.spec.ts` to use the new per-cell inline editing interaction. Instead of clicking an "Edit" button and filling a label-based form, the test should click directly on the department name text in the table cell, type into the inline input, and press Enter. Add additional tests for: (1) pressing Escape reverts to the original name; (2) clearing the name to empty and pressing Enter reverts (empty name prevention); (3) attempting to rename to a duplicate name reverts; (4) clicking outside (blur) saves the updated name.

**Definition of Done**:
- [x] Test: clicking on a department name cell activates an inline text input with the current name
- [x] Test: pressing Enter in the inline input saves the new name and exits edit mode — the updated name is visible in the table
- [x] Test: pressing Escape in the inline input reverts to the original name without saving
- [x] Test: clicking outside (blur) the inline input saves the new name
- [x] Test: clearing the name to empty and pressing Enter reverts to the original name (empty name prevented)
- [x] Test: renaming to a duplicate name (name of another existing department) reverts to the original name
- [x] All tests pass against the updated `DepartmentManagementPanel`
- [x] No references to the removed "Edit" button or row-form remain in the "edit" tests
- [x] Existing non-edit tests (create, delete, empty state, usage indicators, seat count warning) continue to pass

#### Task 2.2 - [MODIFY] Update cross-linking E2E test for department navigation icon
**Description**: Update the "department name in management links to department usage page" test in `e2e/cross-linking.spec.ts`. The test currently clicks the `<Link>` with text "CrossLink Dept" (the department name). After this change, department names are editable text, not links. Navigation is via the → icon with `aria-label="View department usage"`. Update the test to find the department row, then click the navigation link by `aria-label` instead of the department name text.

**Definition of Done**:
- [x] Test updated to locate the department row containing "CrossLink Dept" and click the `<Link>` with `aria-label="View department usage"` (the → icon)
- [x] Test still verifies navigation to `/usage/departments/${departmentId}`
- [x] No references to clicking `getByRole("link", { name: "CrossLink Dept" })` remain
- [x] All other cross-linking tests (team, seat) continue to pass unchanged

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated code review by tsh-code-reviewer agent
**Description**: Run a full code review of all changed files using the `tsh-code-reviewer` agent. The review should cover code quality, accessibility, consistency with project patterns (especially consistency with the identical team inline-editing pattern from Story 10.4), test coverage, and adherence to the acceptance criteria.

**Definition of Done**:
- [x] All changed files reviewed: `src/components/departments/DepartmentManagementPanel.tsx` (main changes), `e2e/department-management.spec.ts` (E2E test rewrite), `e2e/cross-linking.spec.ts` (navigation test update)
- [x] No critical or high-severity findings remain unresolved
- [x] Accessibility requirements verified (keyboard navigation, ARIA attributes, focus management)
- [x] Code follows existing project conventions (Tailwind styling, state management patterns, error handling)
- [x] Inline editing behaviour is consistent with the team inline editing pattern from Story 10.4

## Security Considerations

- **No new API endpoints**: Inline editing reuses the existing authenticated `PUT /api/departments/[id]` endpoint. No additional attack surface is introduced.
- **Input validation unchanged**: All input continues to be validated server-side by the Zod `updateDepartmentSchema` (non-empty, max 255 chars, trimmed). Client-side empty check is a UX convenience only.
- **Auth enforcement unchanged**: The `requireAuth` middleware on the PUT route ensures only authenticated users can modify department data.
- **Duplicate name protection unchanged**: The database unique constraint (`UQ_department_name`) and 409 response prevent duplicate department names.
- **No XSS risk increase**: React's JSX escaping handles all rendered values. No `dangerouslySetInnerHTML` is used.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking on a department name cell activates inline editing with a text input
- [x] Pressing Enter or clicking outside saves the updated name
- [x] Pressing Escape cancels the edit and reverts to the previous value
- [x] Validation prevents saving an empty name
- [x] Validation prevents saving a duplicate department name
- [x] A loading indicator is shown while saving
- [x] The updated name is immediately reflected in the table
- [x] Keyboard accessibility: editable department name cells are reachable via Tab, activatable via Enter/Space
- [x] Screen reader: editable cells have appropriate ARIA attributes (`role="button"`, `tabIndex`, `aria-label`)
- [x] Navigation to department usage detail page is preserved via the link icon (→)
- [x] All E2E tests in `department-management.spec.ts` pass
- [x] Cross-linking test in `cross-linking.spec.ts` passes with updated navigation pattern
- [x] No regressions in `seat-edit.spec.ts`, `team-management.spec.ts`, or `seat-list.spec.ts`

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Error message toast for duplicate names**: Currently the cell just flashes red when a duplicate name is rejected. A brief toast notification saying "Department name already exists" would provide clearer feedback. Same improvement identified for teams in Story 10.4.
- **Undo/toast after save**: After a successful rename, show a brief toast with "Undo" option for accidental edits.
- **Optimistic UI**: Show the new name immediately and revert on error, instead of showing a spinner during save.
- **Shared `updateEntityName` utility**: The `updateDepartmentName` and `updateTeamName` functions follow the exact same pattern (PUT + local state patch). A shared higher-order function or hook (e.g., `useInlineRename`) could be extracted to reduce duplication across `DepartmentManagementPanel` and `TeamManagementPanel`.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — all 3 phases done. Code review: 0 critical/high/medium, 3 info (I1: pre-existing Seats column style difference vs teams — no action; I2: inline onSave closure per render — same as team pattern, no perf impact; I3: no tooltip on → icon — optional polish, out of scope). Delete E2E test locator updated to use `{ name: "Delete", exact: true }` to avoid matching EditableTextCell aria-label containing "ToDelete". |
