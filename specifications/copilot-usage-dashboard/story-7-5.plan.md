# User Can Define Departments - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.5 |
| Title | User can define departments |
| Description | Provide CRUD operations for department management — create, list, edit, and delete departments. Deleting a department clears the department assignment from all associated seats and the user is warned before deletion if seats are assigned. |
| Priority | Medium |
| Related Research | [jira-tasks.md](./jira-tasks.md) — Epic 7, Story 7.5 |

## Proposed Solution

Implement a full department management feature following the same architecture and patterns established by the existing team management feature (Story 7.1). The solution consists of:

1. **Backend API**: Two Next.js API route files (`/api/departments` for GET list + POST create, `/api/departments/[id]` for PUT update + DELETE) with Zod validation schemas.
2. **Frontend UI**: A `DepartmentManagementPanel` component (mirroring `TeamManagementPanel`) rendered on a new `/departments` page, accessible via a new navigation link.
3. **Data integrity**: Add a unique constraint on `department.name` to prevent duplicates (mirroring team pattern). The existing FK constraint (`ON DELETE SET NULL`) already handles clearing `departmentId` on associated seats when a department is deleted.
4. **Delete warning**: The GET list endpoint includes a `seatCount` per department. The frontend uses this count to display a warning dialog when the user attempts to delete a department with assigned seats.

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend                                                         │
│                                                                  │
│  NavBar ──► /departments page                                    │
│                  │                                               │
│          DepartmentManagementPanel                               │
│           (Create / List / Edit / Delete)                        │
│                  │                                               │
│        fetch("/api/departments")                                 │
│        fetch("/api/departments/:id")                             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Backend API Routes                                               │
│                                                                  │
│  GET  /api/departments     → list all departments + seatCount    │
│  POST /api/departments     → create new department               │
│  PUT  /api/departments/:id → update department name              │
│  DELETE /api/departments/:id → hard-delete department            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Database                                                         │
│                                                                  │
│  department (id, name, createdAt, updatedAt)                     │
│       ↑ FK: copilot_seat.departmentId ON DELETE SET NULL         │
│                                                                  │
│  + UQ constraint on department.name (new migration)              │
└──────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Hard delete** (not soft-delete) for departments — unlike teams, the department entity has no `deletedAt` column and the story does not require preserving deleted departments for historical tracking. Historical department-level usage is still accessible via the `copilot_seat.department` text field (legacy).
- **seatCount in GET response** — avoids an extra API call for the delete warning check. The count is calculated with a LEFT JOIN and GROUP BY in a single query.
- **Unique name constraint** — enforced at the database level via migration to prevent duplicate department names, consistent with team name uniqueness enforcement.

## Current Implementation Analysis

### Already Implemented
- `DepartmentEntity` — [src/entities/department.entity.ts](src/entities/department.entity.ts) — Entity schema with `id`, `name`, `createdAt`, `updatedAt`
- `CreateDepartmentTable` migration — [migrations/1772500000000-CreateDepartmentTable.ts](migrations/1772500000000-CreateDepartmentTable.ts) — Creates `department` table, adds `departmentId` FK to `copilot_seat` with ON DELETE SET NULL
- `CopilotSeatEntity.departmentId` — [src/entities/copilot-seat.entity.ts](src/entities/copilot-seat.entity.ts) — FK column linking seats to departments
- Department entity registered in data sources — [src/lib/data-source.ts](src/lib/data-source.ts) and [src/lib/data-source.cli.ts](src/lib/data-source.cli.ts)
- Department usage API routes — [src/app/api/usage/departments/route.ts](src/app/api/usage/departments/route.ts) and [src/app/api/usage/departments/[departmentId]/route.ts](src/app/api/usage/departments/%5BdepartmentId%5D/route.ts) — Read-only usage aggregation
- Department usage UI components — `DepartmentUsagePanel`, `DepartmentUsageTable`, `DepartmentUsageChart`, `DepartmentDetailPanel`, `DepartmentMemberChart` in [src/components/usage/](src/components/usage/)
- `requireAuth` and `isAuthFailure` utilities — [src/lib/api-auth.ts](src/lib/api-auth.ts) — Authentication middleware used by all API routes
- Test helpers — [src/test/db-helpers.ts](src/test/db-helpers.ts) — Shared test data source setup and cleanup
- E2E auth helpers — [e2e/helpers/auth.ts](e2e/helpers/auth.ts) — `seedTestUser` and `loginViaApi` for E2E tests

### To Be Modified
- `DepartmentEntity` — [src/entities/department.entity.ts](src/entities/department.entity.ts) — Add unique index on `name` column
- `NavBar` — [src/components/NavBar.tsx](src/components/NavBar.tsx) — Add "Departments" navigation link

### To Be Created
- `src/lib/validations/department.ts` — Zod validation schemas for create/update department (mirror team.ts)
- `src/lib/validations/__tests__/department.test.ts` — Unit tests for validation schemas
- `src/app/api/departments/route.ts` — GET (list with seatCount) + POST (create) API route
- `src/app/api/departments/[id]/route.ts` — PUT (update name) + DELETE (hard delete) API route
- `src/app/api/departments/__tests__/route.test.ts` — Unit tests for GET/POST
- `src/app/api/departments/__tests__/[id].route.test.ts` — Unit tests for PUT/DELETE
- `src/components/departments/DepartmentManagementPanel.tsx` — Department CRUD UI component
- `src/app/(app)/departments/page.tsx` — Departments page wrapper
- `migrations/1772700000000-AddDepartmentNameUnique.ts` — Migration adding unique constraint on department.name
- `e2e/department-management.spec.ts` — E2E tests for department CRUD flows

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should department names be case-insensitively unique (e.g. "Engineering" vs "engineering")? | Case-sensitive uniqueness (matching team pattern). Two departments can differ only by casing. | ✅ Resolved |
| 2 | Should the seat count shown in delete warning include inactive/unused seats? | Yes — the FK relationship counts all seats with that `departmentId`, regardless of status. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Validation, Entity Update, and Migration

#### Task 1.1 - [CREATE] Department validation schemas
**Description**: Create Zod validation schemas for create and update department operations, following the exact same pattern as `src/lib/validations/team.ts`.

**Definition of Done**:
- [x] File `src/lib/validations/department.ts` exists with `createDepartmentSchema` and `updateDepartmentSchema` exported
- [x] Both schemas validate a required `name` string field that is trimmed, non-empty, and max 255 characters
- [x] Types `CreateDepartmentInput` and `UpdateDepartmentInput` are exported
- [x] Unit tests in `src/lib/validations/__tests__/department.test.ts` cover: valid input, empty name, whitespace-only name, name exceeding 255 characters, missing name field

#### Task 1.2 - [MODIFY] Add unique constraint to DepartmentEntity
**Description**: Add a unique index on the `name` column in the `DepartmentEntity` schema to enforce uniqueness at the database level.

**Definition of Done**:
- [x] `DepartmentEntity` in `src/entities/department.entity.ts` includes an `indices` array with a unique index named `UQ_department_name` on the `name` column
- [x] Entity schema compiles without errors

#### Task 1.3 - [CREATE] Migration for unique department name constraint
**Description**: Create a TypeORM migration that adds a unique constraint on `department.name`.

**Definition of Done**:
- [x] Migration file `migrations/1772700000000-AddDepartmentNameUnique.ts` exists
- [x] `up` method adds a unique index `UQ_department_name` on `department.name`
- [x] `down` method drops the `UQ_department_name` index
- [x] Migration runs successfully against the database

### Phase 2: Backend — CRUD API Routes and Unit Tests

#### Task 2.1 - [CREATE] Department list and create API route
**Description**: Create `src/app/api/departments/route.ts` handling GET (list all departments with seat count) and POST (create a department). Follow the patterns established in `src/app/api/teams/route.ts`.

**Definition of Done**:
- [x] `GET /api/departments` returns `{ departments: [...] }` ordered by name ascending
- [x] Each department in the response includes `id`, `name`, `seatCount`, `createdAt`, `updatedAt`
- [x] `seatCount` reflects the number of `copilot_seat` rows where `departmentId` matches the department
- [x] `POST /api/departments` accepts `{ name }`, validates with `createDepartmentSchema`, and returns 201 with the created department
- [x] POST returns 409 if a department with the same name already exists (unique constraint violation)
- [x] POST returns 400 with field-level validation errors for invalid input
- [x] Both endpoints return 401 if not authenticated (using `requireAuth`)

#### Task 2.2 - [CREATE] Department update and delete API route
**Description**: Create `src/app/api/departments/[id]/route.ts` handling PUT (rename) and DELETE (hard delete with FK cascading SET NULL). Follow the patterns established in `src/app/api/teams/[id]/route.ts`.

**Definition of Done**:
- [x] `PUT /api/departments/:id` accepts `{ name }`, validates with `updateDepartmentSchema`, and returns the updated department
- [x] PUT returns 400 for invalid ID or invalid body
- [x] PUT returns 404 if department does not exist
- [x] PUT returns 409 if the new name conflicts with an existing department
- [x] `DELETE /api/departments/:id` hard-deletes the department and returns `{ success: true }`
- [x] DELETE returns 400 for invalid ID
- [x] DELETE returns 404 if department does not exist
- [x] After DELETE, all `copilot_seat` rows that had the deleted `departmentId` have `departmentId` set to NULL (handled by FK ON DELETE SET NULL)
- [x] Both endpoints return 401 if not authenticated

#### Task 2.3 - [CREATE] Unit tests for department API routes
**Description**: Create comprehensive unit tests for both department API route files, following the patterns in `src/app/api/teams/__tests__/route.test.ts` and `src/app/api/teams/__tests__/[id].route.test.ts`.

**Definition of Done**:
- [x] `src/app/api/departments/__tests__/route.test.ts` covers: 401 without session, 200 with empty list, list ordered by name, includes seatCount per department, 201 for valid create, 400 for invalid body, 409 for duplicate name, 400 for missing JSON
- [x] `src/app/api/departments/__tests__/[id].route.test.ts` covers: 401 without session, 200 for valid rename, 400 for invalid ID, 400 for invalid body, 404 for non-existent department, 409 for duplicate name on rename, 200 for successful delete, 404 for deleting non-existent department, seats have `departmentId` set to NULL after delete
- [x] All tests pass with `vitest run`

### Phase 3: Frontend — Department Management UI

#### Task 3.1 - [CREATE] DepartmentManagementPanel component
**Description**: Create `src/components/departments/DepartmentManagementPanel.tsx`, a client component mirroring `TeamManagementPanel.tsx` that provides full CRUD UI for departments. Key difference: includes a seat count column and a warning message when deleting a department with assigned seats.

**Definition of Done**:
- [x] Component fetches departments from `GET /api/departments` on mount and displays them in a table with columns: Name, Seats, Created, Actions
- [x] "Add Department" button reveals a create form with a name input field and Create/Cancel buttons
- [x] Create form validates input client-side using `createDepartmentSchema` before submitting
- [x] Duplicate name error from the API (409) is displayed to the user
- [x] Each row has Edit and Delete action buttons
- [x] Edit button reveals an inline edit form pre-filled with the current name (same pattern as TeamManagementPanel)
- [x] Delete button shows a confirmation dialog; if `seatCount > 0`, the confirmation includes a warning: "This department has X seat(s) assigned. They will be unassigned."
- [x] Successful create, edit, and delete refresh the department list
- [x] Loading state shows "Loading departments…"
- [x] Fetch error shows an error message with a Retry button
- [x] Empty state shows "No departments found. Create one to get started."
- [x] Styling and CSS classes match the TeamManagementPanel pattern (Tailwind utility classes, same spacing, colors)

#### Task 3.2 - [CREATE] Departments page
**Description**: Create `src/app/(app)/departments/page.tsx` as the page wrapper for the department management panel, following the same pattern as `src/app/(app)/teams/page.tsx`.

**Definition of Done**:
- [x] Page renders `DepartmentManagementPanel` component
- [x] Page has metadata title "Departments — Copilot Dashboard"
- [x] Page has `dynamic = "force-dynamic"` export
- [x] Heading reads "Department Management" with descriptive subtitle

#### Task 3.3 - [MODIFY] Add Departments link to NavBar
**Description**: Add a "Departments" navigation link to the NavBar component, positioned after "Teams" in the navigation order.

**Definition of Done**:
- [x] NavBar `navLinks` array includes `{ href: "/departments", label: "Departments" }` after the "Teams" entry
- [x] Link is visible in the navigation bar and highlights when active
- [x] Navigating to `/departments` renders the departments page

### Phase 4: E2E Tests

#### Task 4.1 - [CREATE] Department management E2E tests
**Description**: Create `e2e/department-management.spec.ts` covering the full department CRUD lifecycle, following the pattern in `e2e/team-management.spec.ts`.

**Definition of Done**:
- [x] Test navigates to departments page via navigation link
- [x] Test verifies empty state when no departments exist
- [x] Test creates a department and verifies it appears in the list
- [x] Test verifies duplicate name creation shows error
- [x] Test edits a department name inline and verifies the update
- [x] Test deletes a department with confirmation and verifies it disappears
- [x] Test verifies that deleting a department with assigned seats shows a seat count warning
- [x] Test verifies that after deleting a department, assigned seats have their department cleared
- [x] All tests use proper setup (seed configuration, seed auth user) and cleanup
- [x] All E2E tests pass with `playwright test`

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Automated code review
**Description**: Run a comprehensive code review using the `tsh-code-reviewer` agent to verify code quality, adherence to project patterns, and completeness.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All identified issues resolved
- [x] Final code passes linting (`eslint`), type checking, and all tests (`vitest run`)

## Security Considerations

- **Authentication**: All department CRUD API routes use `requireAuth` middleware to ensure only authenticated users can manage departments. This is consistent with the team management API pattern.
- **Input validation**: All user-provided input is validated server-side using Zod schemas before database operations. Input is trimmed and length-limited to prevent injection and storage abuse.
- **SQL injection prevention**: All database operations use TypeORM's parameterised queries, never raw string concatenation.
- **No sensitive data exposure**: Department records contain only names and timestamps — no PII or secrets. The API response shape is explicitly constructed (no entity pass-through).

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User can create a new department by providing a name
- [x] User can view a list of all departments
- [x] User can edit a department's name
- [x] User can delete a department
- [x] Deleting a department clears the department assignment from all seats in that department
- [x] User is warned before deleting a department that has seats assigned to it
- [x] Duplicate department names are rejected with a clear error message
- [x] All API endpoints require authentication (return 401 without session)
- [x] All unit tests pass (`vitest run`)
- [x] All E2E tests pass (`playwright test`)
- [x] No linting errors (`eslint`)

## Improvements (Out of Scope)

- **Migrate legacy `department` text field to `departmentId` FK**: The `copilot_seat` entity has both a `department` string column and a `departmentId` FK column. The text field is a legacy approach — ideally, only the FK should be used. This requires a data migration and updates to all consumers (Seat API, SeatListPanel, seat sync, etc.).
- **Department dropdown in seat edit form**: Story 7.6 covers assigning departments to seats via a dropdown (instead of the current free-text input). This is a separate story.
- **Bulk seat reassignment on department delete**: Instead of silently clearing departmentId, allow users to reassign seats to another department during deletion.
- **Department name case-insensitive uniqueness**: Currently uniqueness is case-sensitive. A case-insensitive unique index (e.g. `UNIQUE(LOWER(name))`) could prevent confusingly similar names.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation completed — all 5 phases done. Code review finding (MAJOR-1: non-transactional seat clearing in DELETE) resolved by wrapping in `dataSource.transaction()`. |
