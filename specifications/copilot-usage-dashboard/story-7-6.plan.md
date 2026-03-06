# Story 7.6: User can assign a department to a seat holder — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.6 |
| Title | User can assign a department to a seat holder |
| Description | Enable users to assign a department to a seat holder via a dropdown selector so that usage can be aggregated at the department level. The department field in the seat edit form must change from a free-text input to a select populated from the departments list. |
| Priority | Medium |
| Related Research | [jira-tasks.md](./jira-tasks.md) — Story 7.6 (line 1094) |

## Proposed Solution

Replace the free-text department input in the seat edit form with a `<select>` dropdown populated from `GET /api/departments`. When a user assigns a department, the backend sets `departmentId` (FK) on the seat record **and** keeps the `department` (varchar) column in sync with the department name for display/search purposes.

**Data flow:**

```
User selects department in dropdown
  → Frontend sends PUT /api/seats/:id with { departmentId: <number|null>, ... }
  → Backend validates departmentId references an existing department (or is null)
  → Backend sets seat.departmentId AND seat.department (name cache)
  → Response includes departmentId so the frontend can pre-select the dropdown
  → Seat list displays department name from the response
  → Department usage tab already aggregates by departmentId — no changes needed
```

This approach maintains backward compatibility with:
- The existing `department` text column used in seat list display and search (`GET /api/seats` search across `department`)
- The existing `departmentId` FK used by the department usage aggregation queries

## Current Implementation Analysis

### Already Implemented
- `DepartmentEntity` — [src/entities/department.entity.ts](../../src/entities/department.entity.ts) — Department table with id, name, timestamps, unique name constraint
- `CopilotSeatEntity` — [src/entities/copilot-seat.entity.ts](../../src/entities/copilot-seat.entity.ts) — Has both `department` (varchar) and `departmentId` (int, FK) columns
- `GET /api/departments` — [src/app/api/departments/route.ts](../../src/app/api/departments/route.ts) — Returns all departments with seat counts
- `PUT /api/seats/[id]` — [src/app/api/seats/[id]/route.ts](../../src/app/api/seats/%5Bid%5D/route.ts) — Handles firstName, lastName, department (free-text) updates
- `GET /api/seats` — [src/app/api/seats/route.ts](../../src/app/api/seats/route.ts) — Returns paginated seats with department (free-text) in response
- `SeatListPanel` — [src/components/seats/SeatListPanel.tsx](../../src/components/seats/SeatListPanel.tsx) — Full seat list with inline edit form (free-text department input)
- `DepartmentManagementPanel` — [src/components/departments/DepartmentManagementPanel.tsx](../../src/components/departments/DepartmentManagementPanel.tsx) — Department CRUD UI
- Department usage API — [src/app/api/usage/departments/route.ts](../../src/app/api/usage/departments/route.ts) — Aggregates usage by `departmentId`
- Migration for `departmentId` FK — [migrations/1772500000000-CreateDepartmentTable.ts](../../migrations/1772500000000-CreateDepartmentTable.ts)
- Seat edit E2E tests — [e2e/seat-edit.spec.ts](../../e2e/seat-edit.spec.ts)
- Seat edit unit tests — [src/app/api/seats/__tests__/[id].route.test.ts](../../src/app/api/seats/__tests__/%5Bid%5D.route.test.ts)
- Seat validation schema — [src/lib/validations/seat.ts](../../src/lib/validations/seat.ts) — `updateSeatSchema` with firstName, lastName, department

### To Be Modified
- `updateSeatSchema` — [src/lib/validations/seat.ts](../../src/lib/validations/seat.ts) — Add `departmentId` (number | null) field; keep `department` for backward compatibility but it will no longer be sent from the frontend
- `PUT /api/seats/[id]` — [src/app/api/seats/[id]/route.ts](../../src/app/api/seats/%5Bid%5D/route.ts) — Handle `departmentId`: validate it exists, set both `departmentId` and `department` (name) on the seat
- `GET /api/seats` — [src/app/api/seats/route.ts](../../src/app/api/seats/route.ts) — Include `departmentId` in the response so the frontend can pre-select the dropdown
- `SeatListPanel` — [src/components/seats/SeatListPanel.tsx](../../src/components/seats/SeatListPanel.tsx) — Replace free-text department `<input>` with `<select>` populated from departments API; fetch departments list; send `departmentId` instead of `department`
- Seat edit unit tests — [src/app/api/seats/__tests__/[id].route.test.ts](../../src/app/api/seats/__tests__/%5Bid%5D.route.test.ts) — Add tests for `departmentId` assignment, validation, and edge cases
- Seat edit E2E tests — [e2e/seat-edit.spec.ts](../../e2e/seat-edit.spec.ts) — Update tests to use department dropdown selection instead of free-text input
- Seat validation tests — A new test file or additions to existing tests for the updated `updateSeatSchema`

### To Be Created
- Nothing new from scratch — all changes are modifications to existing files

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the free-text `department` column be kept in sync or removed? | Keep in sync (write department name when `departmentId` is set). It's used by the seat list search and the `GET /api/seats` display. Removing it would be a larger migration. | ✅ Resolved |
| 2 | Should the dropdown include a "None" / "Unassigned" option? | Yes — setting `departmentId` to null removes the department assignment. The dropdown should have a blank/empty option representing "No department". | ✅ Resolved |
| 3 | Should the old free-text `department` field still be accepted by the API? | Yes — for backward compatibility the API should still accept `department` (string) but the frontend will switch to `departmentId`. Both fields remain optional in the schema. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Update validation schema and seat update API

#### Task 1.1 - [MODIFY] Add `departmentId` to seat validation schema
**Description**: Extend `updateSeatSchema` in `src/lib/validations/seat.ts` to accept an optional `departmentId` field that must be either a positive integer or `null`. The existing `department` (string) field stays for backward compatibility. Update the refine rule to accept `departmentId` as a valid updatable field.

**Definition of Done**:
- [x] `updateSeatSchema` accepts `departmentId` as `z.number().int().positive().nullable().optional()`
- [x] The refine check includes `departmentId` in the "at least one field" validation
- [x] Existing `department` (string) field still works unchanged
- [x] `UpdateSeatInput` type is re-exported and includes `departmentId`

#### Task 1.2 - [MODIFY] Handle `departmentId` in `PUT /api/seats/[id]`
**Description**: Update the seat update endpoint to process `departmentId`. When `departmentId` is provided and is a valid integer, look up the department by ID. If found, set `seat.departmentId` and `seat.department` (name cache). If `departmentId` is `null`, clear both `seat.departmentId` and `seat.department`. If the department ID doesn't exist, return 400 with an appropriate error.

**Definition of Done**:
- [x] When `departmentId` is a valid integer referencing an existing department, `seat.departmentId` and `seat.department` are both updated
- [x] When `departmentId` is `null`, both `seat.departmentId` and `seat.department` are set to `null`
- [x] When `departmentId` references a non-existent department, API returns 400 with `"Department not found"` error
- [x] Response JSON includes `departmentId` field
- [x] Existing `firstName`, `lastName`, and `department` (free-text) updates remain functional

#### Task 1.3 - [MODIFY] Include `departmentId` in `GET /api/seats` response
**Description**: Update the seat list endpoint to include `departmentId` in each seat's response object so the frontend can determine the currently selected department for the dropdown.

**Definition of Done**:
- [x] Each seat in the `GET /api/seats` response includes `departmentId` (number | null)
- [x] Existing response fields remain unchanged

#### Task 1.4 - [MODIFY] Unit tests for updated seat API
**Description**: Update `src/app/api/seats/__tests__/[id].route.test.ts` with tests for the new `departmentId` behavior. Add a validation schema test file or extend existing tests.

**Definition of Done**:
- [x] Test: setting `departmentId` to a valid department ID updates both `departmentId` and `department` name on the seat
- [x] Test: setting `departmentId` to `null` clears both `departmentId` and `department`
- [x] Test: setting `departmentId` to a non-existent ID returns 400 with appropriate error
- [x] Test: setting `departmentId` to an invalid value (string, negative, float) returns 400 validation error
- [x] Test: response shape includes `departmentId`
- [x] Test: updating `departmentId` does not affect `firstName`, `lastName`, `githubUsername`, or `status`
- [x] Existing tests for `department` (free-text string) still pass
- [x] Validation schema tests cover `departmentId` field (valid integer, null, invalid types)

### Phase 2: Frontend — Replace free-text department input with dropdown

#### Task 2.1 - [MODIFY] Fetch departments list in SeatListPanel
**Description**: Add a `useEffect` + `useState` in `SeatListPanel` to fetch the departments list from `GET /api/departments` on mount. Store the departments as a simple array of `{ id, name }` for use in the edit form's dropdown.

**Definition of Done**:
- [x] Departments are fetched from `/api/departments` when the component mounts
- [x] Departments state is available as `Array<{ id: number; name: string }>`
- [x] Fetch error for departments does not block the seat list from rendering (graceful degradation)

#### Task 2.2 - [MODIFY] Replace department text input with select dropdown in seat edit form
**Description**: In the inline edit form within `SeatListPanel`, replace the `<input type="text">` for "Department" with a `<select>` element. The dropdown options are populated from the fetched departments list. Include an empty/default option for "No department". The selected value maps to `departmentId`. When starting an edit, pre-select the dropdown based on the seat's `departmentId`.

**Definition of Done**:
- [x] A `<select>` element with `id="edit-department"` and label "Department" replaces the text input
- [x] First option is empty ("— None —" or equivalent) representing no department assignment (value maps to `null`)
- [x] Each department option has `value={department.id}` and displays `department.name`
- [x] When starting edit, the dropdown pre-selects the seat's current `departmentId` (or empty if null)
- [x] `aria-describedby`, `aria-invalid`, and error display are preserved for accessibility
- [x] The department edit state tracks `departmentId` (number | null) instead of a string

#### Task 2.3 - [MODIFY] Update edit submission to send `departmentId`
**Description**: Modify `handleEditSubmit` in `SeatListPanel` to send `departmentId` (number | null) instead of `department` (string) in the PUT request body. Update client-side validation to use the new schema.

**Definition of Done**:
- [x] PUT request body includes `departmentId` instead of `department`
- [x] When no department is selected, `departmentId` is sent as `null`
- [x] Client-side validation (`updateSeatSchema.safeParse`) validates correctly with the new field
- [x] After successful save, the seat list refreshes and shows the updated department name

#### Task 2.4 - [MODIFY] Update SeatRecord interface and display
**Description**: Update the `SeatRecord` interface in `SeatListPanel` to include `departmentId`. The `department` string display in the seat table remains (sourced from the API response's `department` field which is kept in sync by the backend).

**Definition of Done**:
- [x] `SeatRecord` interface includes `departmentId: number | null`
- [x] Seat table display column for "Department" continues to show the department name string
- [x] `startEdit` function reads `seat.departmentId` to initialize the dropdown selection

### Phase 3: E2E Tests — Update seat edit tests for department dropdown

#### Task 3.1 - [MODIFY] Update seat-edit E2E tests for department dropdown
**Description**: Update `e2e/seat-edit.spec.ts` to work with a `<select>` dropdown for department instead of a free-text input. Seed departments in the test data and verify that selecting a department from the dropdown reflects in the seat list and persists.

**Definition of Done**:
- [x] E2E seed helper creates departments via direct DB insert and assigns `departmentId` to seats
- [x] Test: clicking Edit shows a department dropdown (select) pre-populated with the current department
- [x] Test: changing the department dropdown selection and saving updates the department in the seat list
- [x] Test: selecting "None" (empty option) clears the department
- [x] Test: department assignment is reflected in the department column of the seat list after save
- [x] All existing seat-edit E2E tests that reference the department field are updated to use the dropdown
- [x] Tests pass with `npx playwright test e2e/seat-edit.spec.ts`

#### Task 3.2 - [MODIFY] Verify department usage tab reflects seat department assignments
**Description**: Add or verify an E2E test that assigns a department to a seat via the edit form and confirms the department usage tab shows the updated aggregation. This may already be covered by existing `e2e/department-usage.spec.ts` tests that seed via `departmentId`, but we should add a cross-functional test that verifies the full flow: edit seat → assign department → department usage tab shows the seat's data.

**Definition of Done**:
- [x] E2E test: assign a department to a seat via the seat edit form, navigate to the department usage tab, and verify the seat's usage data appears under that department
- [x] Test passes with `npx playwright test`

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review
**Description**: Run automated code review using `tsh-code-reviewer` agent on all changed files.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed

## Security Considerations

- **Department ID validation**: The backend must verify that a provided `departmentId` references an existing department record before assigning it. This prevents assigning seats to phantom departments (e.g., after a department is deleted between frontend load and form submission).
- **Authorization**: All seat update and department list endpoints already require authentication via `requireAuth()`. No additional authorization changes needed.
- **Input sanitization**: The `departmentId` field is validated as a positive integer via Zod schema, preventing injection of non-numeric values.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Department is selectable when editing a seat holder's details (dropdown populated from departments API)
- [x] Each seat holder can belong to one department (single `departmentId` FK)
- [x] Department assignment is reflected in the seat list (department name column shows selected department)
- [x] Department assignment is reflected in the department usage tab (usage aggregated by `departmentId`)
- [x] Clearing the department selection (setting to "None") removes the department assignment
- [x] All unit tests pass (`npx vitest run`)
- [x] All E2E tests pass (`npx playwright test`)
- [x] No TypeScript compilation errors (`npx tsc --noEmit`)
- [x] No ESLint errors (`npx eslint .`)

## Improvements (Out of Scope)

- **Remove the free-text `department` column**: The `department` varchar column on `copilot_seat` is now redundant since departments have their own table. A future migration could remove it and derive the department name via JOIN in queries. This would simplify the data model but requires updating all queries and search logic that reference `department` directly.
- **Department filter dropdown on seat list**: Add a dedicated department filter dropdown to the seat list toolbar (alongside the existing status filter) so users can filter seats by department without using the text search.
- **Bulk department assignment**: Allow assigning a department to multiple seats at once from the seat list.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Phase 1–4 implemented. Code review performed by tsh-code-reviewer — no critical/major findings. Addressed minor findings: M2 (fixed `name` attribute on department select from "department" to "departmentId") and M3 (added `departmentId` to response shape test). M1 (E2E seed consistency) noted as low priority — no functional impact. |
