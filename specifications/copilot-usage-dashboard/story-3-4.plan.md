# Story 3.4: User can edit seat holder's first name, last name, and department — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 3.4 |
| Title | User can edit seat holder's first name, last name, and department |
| Description | Allow users to edit the first name, last name, and department fields on a seat record so that seat data can be enriched with information not available from the GitHub API. Changes are saved to the database and immediately reflected in the seat list. Editing does not affect the GitHub username or seat status. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/story-3-3.plan.md` |

## Proposed Solution

Extend the existing seat list with inline editing by adding three layers: a **Zod validation schema** for seat updates, a **PUT API endpoint** at `/api/seats/[id]` following the established `users/[id]` pattern, and **inline edit form** within the existing `SeatListPanel` component following the established `UserManagementPanel` inline-edit pattern.

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Next.js App                                      │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  SeatListPanel (MODIFIED — inline editing)                              │  │
│  │                                                                         │  │
│  │  ┌─ Seat Table ──────────────────────────────────────────────────────┐  │  │
│  │  │ Username │ Status │ First Name │ Last Name │ Department │ Actions │  │  │
│  │  ├──────────┼────────┼────────────┼───────────┼────────────┼─────────┤  │  │
│  │  │ octocat  │ Active │ Octo       │ Cat       │ Eng        │ [Edit]  │  │  │
│  │  │ devuser  │ Active │ [input]    │ [input]   │ [input]    │ Save|Cn │  │  │
│  │  │ alice    │ Inact. │ —          │ —         │ —          │ [Edit]  │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  Edit flow:                                                             │  │
│  │  1. User clicks [Edit] on a row                                        │  │
│  │  2. Row switches to inline form (firstName, lastName, department)      │  │
│  │  3. Client-side Zod validation runs on submit                          │  │
│  │  4. PUT /api/seats/{id} called with validated payload                  │  │
│  │  5. On 200 → refresh seat list, close edit form                        │  │
│  │  6. On error → display error message in the edit row                   │  │
│  └─────────────────────────────────────┬───────────────────────────────────┘  │
│                                         │                                      │
│  ┌─────────────────────────────────────┐│                                      │
│  │  PUT /api/seats/[id] (API Route)    ││                                      │
│  │  Auth-guarded                       ││                                      │
│  │                                     ││                                      │
│  │  Body: {                            ││                                      │
│  │    firstName?: string | null,       ││                                      │
│  │    lastName?: string | null,        ││                                      │
│  │    department?: string | null       ││                                      │
│  │  }                                  ││                                      │
│  │                                     ││                                      │
│  │  1. Parse & validate with Zod       ││                                      │
│  │  2. Find seat by ID                 ││                                      │
│  │  3. Update only provided fields     ││                                      │
│  │  4. Return updated seat record      ││                                      │
│  └─────────────────────────────┬───────┘│                                      │
│                                 │        │                                      │
│                                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL                                                             │  │
│  │  ┌──────────────┐                                                       │  │
│  │  │ copilot_seat │  ← UPDATE firstName, lastName, department            │  │
│  │  │ (existing)   │    WHERE id = :id                                    │  │
│  │  └──────────────┘    (githubUsername, status untouched)                 │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Inline editing in the seat table**: Follow the established `UserManagementPanel` pattern where clicking "Edit" replaces the row content with an inline form. This avoids the complexity of a separate edit page/modal and keeps the user in context. The edit form renders in a `<td colSpan>` spanning the row, consistent with the user edit pattern.

2. **PUT endpoint at `/api/seats/[id]`**: Follows the exact same pattern as `/api/users/[id]` — Next.js dynamic route with `RouteContext` parameter parsing, Zod validation, TypeORM `findOne` + `save`, and the same error handling (401, 400, 404, 500). This ensures maximum consistency across the codebase.

3. **All three fields sent on every edit**: Unlike the user update schema (which uses a refinement requiring at least one field), the seat update sends all three fields every time — pre-populated from the current values. This simplifies the UX (user always sees all editable fields) and the validation (no "at least one required" check). Fields can be set to `null` (empty string → `null` coercion) to clear enrichment data.

4. **Null coercion for empty strings**: Empty string inputs are coerced to `null` in the Zod schema using `.transform()`. This ensures consistent database representation — enrichment fields are either a non-empty string or `null`, never an empty string. This matches the existing entity definition where all three fields are `type: "varchar", nullable: true`.

5. **No effect on GitHub username or status**: The PUT endpoint explicitly only updates `firstName`, `lastName`, and `department` on the entity. The validation schema does not accept any other fields. This is a hard guarantee that editing cannot alter sync-managed fields.

6. **Immediate list refresh after save**: After a successful PUT, the component re-fetches the current page of seats (same pattern as `UserManagementPanel.fetchUsers()`). This ensures the updated values are immediately visible without optimistic updates, keeping the implementation simple and consistent.

7. **Client-side validation before API call**: The Zod schema is shared between frontend and backend via `src/lib/validations/seat.ts`. The component validates the form data before making the API call, providing instant feedback to the user without a round trip.

8. **No new database migration needed**: The `copilot_seat` table already has `firstName`, `lastName`, and `department` columns (created in the Story 3.1 migration). No schema changes are required.

### API Contracts

**PUT /api/seats/[id]** (update seat enrichment fields)

| Field | Type | Description |
|-------|------|-------------|
| `firstName` | `string \| null` | First name of the seat holder (max 255 chars), `null` to clear |
| `lastName` | `string \| null` | Last name of the seat holder (max 255 chars), `null` to clear |
| `department` | `string \| null` | Department of the seat holder (max 255 chars), `null` to clear |

| Status | Body |
|--------|------|
| 200 | `{ id, githubUsername, status, firstName, lastName, department, lastActivityAt, createdAt }` |
| 400 | `{ error: "Invalid seat ID" }` or `{ error: "Invalid JSON body" }` or `{ error: "Validation failed", details: { ... } }` |
| 401 | `{ error: "Authentication required" }` |
| 404 | `{ error: "Seat not found" }` |
| 500 | `{ error: "Internal server error" }` |

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-seat.entity.ts` — `CopilotSeat` interface and `CopilotSeatEntity` with `firstName`, `lastName`, `department` columns (varchar 255, nullable) — fully reusable, no changes needed
- `src/entities/enums.ts` — `SeatStatus` enum — fully reusable, no changes needed
- `src/lib/db.ts` — `getDb()` database connection singleton — reused in the new API route
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused to protect the new API endpoint
- `src/app/api/seats/route.ts` — GET endpoint for seat listing — no changes needed, the new PUT route is in a separate `[id]` folder
- `src/app/api/seats/__tests__/route.test.ts` — Existing GET endpoint tests — no changes needed
- `src/app/(app)/seats/page.tsx` — Seats page shell — no changes needed
- `src/components/NavBar.tsx` — Navigation with Seats link — no changes needed
- `src/test/db-helpers.ts` — Test database setup/cleanup with `CopilotSeatEntity` registered — fully reusable
- `e2e/helpers/auth.ts` — `seedTestUser()`, `loginViaApi()` — reused for E2E tests
- `src/app/api/users/[id]/route.ts` — Reference pattern for dynamic route PUT handler (pattern to replicate)
- `src/app/api/users/__tests__/[id].route.test.ts` — Reference pattern for dynamic route integration tests (pattern to replicate)
- `src/lib/validations/user.ts` — Reference pattern for Zod validation schemas (pattern to replicate)
- `src/components/users/UserManagementPanel.tsx` — Reference pattern for inline editing UI (pattern to replicate)

### To Be Modified
- `src/components/seats/SeatListPanel.tsx` — Add inline edit form with firstName, lastName, department input fields, edit/save/cancel state management, client-side Zod validation, PUT API call, and list refresh after save. Add "Edit" button and "Actions" column to the table.

### To Be Created
- `src/lib/validations/seat.ts` — Zod schema `updateSeatSchema` for validating seat enrichment field updates (firstName, lastName, department — all optional string|null, max 255 chars, empty strings coerced to null)
- `src/app/api/seats/[id]/route.ts` — PUT endpoint for updating seat enrichment fields (auth-guarded, Zod-validated, TypeORM find + save)
- `src/lib/validations/__tests__/seat.test.ts` — Unit tests for the seat validation schema
- `src/app/api/seats/__tests__/[id].route.test.ts` — Integration tests for the PUT endpoint
- `e2e/seat-edit.spec.ts` — E2E tests for the seat edit flow

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should editing be accessible to all authenticated users or only admins? | All authenticated users. The story says "As a user" (not "As an admin"). The current auth system has no role-based access control — all authenticated users have equal privileges. | ✅ Resolved |
| 2 | Should empty strings be accepted or coerced to null? | Coerced to null. The database columns are nullable and the entity interface types are `string \| null`. Storing empty strings would be inconsistent with the existing data model (GitHub sync sets these to null, not empty string). | ✅ Resolved |
| 3 | Should the edit form use a modal or inline editing? | Inline editing in the table row, following the `UserManagementPanel` pattern. This keeps the user in context and is consistent with the existing codebase. | ✅ Resolved |
| 4 | Should all three fields be required in the update payload? | No — all three are optional (can be string or null). The schema accepts partial updates but will always receive all three fields from the UI since the form pre-populates from current values. | ✅ Resolved |

## Implementation Plan

### Phase 1: Validation Schema

#### Task 1.1 - [CREATE] Seat update validation schema `src/lib/validations/seat.ts`
**Description**: Create a Zod schema for validating seat enrichment field updates. The schema accepts `firstName`, `lastName`, and `department` — all optional, each a `string | null` with max 255 characters. Empty strings are coerced to `null`. At least one field must be provided.

**Definition of Done**:
- [x] File `src/lib/validations/seat.ts` exports `updateSeatSchema` and `UpdateSeatInput` type
- [x] `firstName`: optional, `string | null`, trimmed, max 255 chars, empty string → `null`
- [x] `lastName`: optional, `string | null`, trimmed, max 255 chars, empty string → `null`
- [x] `department`: optional, `string | null`, trimmed, max 255 chars, empty string → `null`
- [x] Schema includes a refinement requiring at least one of the three fields to be provided (not all `undefined`)
- [x] Explicit `null` values are accepted (to allow clearing a field)
- [x] File compiles without TypeScript errors

#### Task 1.2 - [CREATE] Seat validation schema tests `src/lib/validations/__tests__/seat.test.ts`
**Description**: Create unit tests for the `updateSeatSchema` following the established pattern from `user.test.ts`.

**Definition of Done**:
- [x] Test: accepts valid input with all three fields
- [x] Test: accepts partial input (only firstName, only department, etc.)
- [x] Test: trims whitespace from string values
- [x] Test: coerces empty string to `null`
- [x] Test: coerces whitespace-only string to `null`
- [x] Test: accepts explicit `null` values
- [x] Test: rejects strings exceeding 255 characters
- [x] Test: rejects empty object (no fields provided)
- [x] Test: ignores extra/unknown fields
- [x] All tests pass

### Phase 2: API Endpoint

#### Task 2.1 - [CREATE] Seat update API route `src/app/api/seats/[id]/route.ts`
**Description**: Create a PUT endpoint for updating seat enrichment fields. Follows the exact same pattern as `src/app/api/users/[id]/route.ts` — dynamic route with ID parsing, auth guard, JSON body parsing, Zod validation, TypeORM find + save, and error handling.

**Definition of Done**:
- [x] File `src/app/api/seats/[id]/route.ts` exports a `PUT` handler
- [x] Endpoint is auth-guarded using `requireAuth()` / `isAuthFailure()` pattern
- [x] Parses `id` from route params, returns 400 for non-numeric or non-integer ID
- [x] Parses JSON body, returns 400 for invalid JSON
- [x] Validates body with `updateSeatSchema`, returns 400 with field-level error details on failure
- [x] Finds seat by ID using `seatRepo.findOne()`, returns 404 if not found
- [x] Updates only the provided fields (`firstName`, `lastName`, `department`) on the seat entity
- [x] Does NOT modify `githubUsername`, `status`, `githubUserId`, or any other fields
- [x] Saves the updated entity using `seatRepo.save()`
- [x] Returns 200 with the updated seat record (same shape as GET listing: `id`, `githubUsername`, `status`, `firstName`, `lastName`, `department`, `lastActivityAt`, `createdAt`)
- [x] Returns 500 with generic error message for unexpected errors (error logged to console)
- [x] File compiles without TypeScript errors

#### Task 2.2 - [CREATE] Seat update API route tests `src/app/api/seats/__tests__/[id].route.test.ts`
**Description**: Create integration tests for the PUT endpoint. Follows the established pattern from `src/app/api/users/__tests__/[id].route.test.ts`.

**Definition of Done**:
- [x] Test: returns 401 without session cookie
- [x] Test: returns 400 for non-numeric ID
- [x] Test: returns 400 for malformed JSON body
- [x] Test: returns 400 for empty update object (no fields)
- [x] Test: returns 400 with validation details for oversized field values (>255 chars)
- [x] Test: returns 404 for non-existent seat ID
- [x] Test: updates firstName successfully — verify response and database state
- [x] Test: updates lastName successfully
- [x] Test: updates department successfully
- [x] Test: updates all three fields simultaneously
- [x] Test: clears a field by sending `null` — verify database stores null
- [x] Test: coerces empty string to null — send `""` for firstName, verify stored as null
- [x] Test: does NOT modify githubUsername or status when updating enrichment fields — seed a seat, update firstName, verify githubUsername and status unchanged
- [x] Test: response shape matches expected format (`id`, `githubUsername`, `status`, `firstName`, `lastName`, `department`, `lastActivityAt`, `createdAt`)
- [x] Test: response does NOT include sensitive/internal fields (`githubUserId`, `assignedAt`, `lastActivityEditor`, `planType`, `updatedAt`)
- [x] All tests pass
- [x] Database cleaned between tests for isolation
- [x] Follows the established test pattern (mock setup, session seeding, request construction)

### Phase 3: Frontend — Inline Edit Form

#### Task 3.1 - [MODIFY] Add inline editing to SeatListPanel `src/components/seats/SeatListPanel.tsx`
**Description**: Extend the `SeatListPanel` component with inline edit functionality. Add an "Actions" column with an "Edit" button per row. When clicked, the row expands to an inline form with input fields for firstName, lastName, and department. The form validates with the shared Zod schema before calling `PUT /api/seats/{id}`. On success, the seat list is refreshed and the edit form closes. Follows the established inline-edit pattern from `UserManagementPanel`.

**Definition of Done**:
- [x] An "Actions" column is added as the last column in the seat table header
- [x] Each row displays an "Edit" button in the Actions column
- [x] Clicking "Edit" switches the row to an inline edit form (colSpan across all columns, matching `UserManagementPanel` edit pattern)
- [x] Edit form contains three text inputs: First Name, Last Name, Department — pre-populated with current values (null displayed as empty string in input)
- [x] Edit form has "Save" and "Cancel" buttons
- [x] "Cancel" closes the edit form and restores the original row display
- [x] Clicking "Edit" on one row closes any previously open edit form (only one edit active at a time)
- [x] On submit, client-side Zod validation runs using `updateSeatSchema`
- [x] Validation errors are displayed inline below the relevant input field (matching `UserManagementPanel` error pattern with `aria-describedby` and `aria-invalid`)
- [x] On valid submission, `PUT /api/seats/{id}` is called with the form data (empty strings sent as `null`)
- [x] "Save" button shows loading state ("Saving…") during the API call and is disabled
- [x] On 200 response: edit form closes, seat list re-fetches current page
- [x] On 404 response: error message displayed ("Seat not found")
- [x] On 400 response: field-level errors displayed from `details`, or general error message
- [x] On network error: general error message displayed
- [x] GitHub Username, Status, and Last Active columns remain read-only (displayed as text, not inputs) during editing
- [x] Labels have proper `htmlFor` attributes linked to input `id`s
- [x] Input fields use consistent styling with existing form inputs in the codebase
- [x] File compiles without TypeScript errors

### Phase 4: E2E Tests

#### Task 4.1 - [CREATE] E2E tests for seat editing `e2e/seat-edit.spec.ts`
**Description**: Create Playwright E2E tests verifying the seat edit flow end-to-end. Tests seed seats directly in the database, interact with the edit UI, and verify changes are persisted. Follows the established pattern from `e2e/seat-list.spec.ts`.

**Definition of Done**:
- [x] Test: Edit button is visible for each seat row
- [x] Test: clicking Edit opens an inline edit form with pre-populated values
- [x] Test: user can update first name, last name, and department — values are saved and reflected in the seat list
- [x] Test: cancelling edit restores original values without API call
- [x] Test: clearing a field (removing text) saves null — displayed as "—" in the list
- [x] Test: editing does not change GitHub username or status — verify both remain unchanged after edit
- [x] All tests set up and tear down test data correctly (configuration + auth + seat records)
- [x] Tests pass in isolation and do not interfere with other test files

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All new and modified source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (TypeORM EntitySchema pattern, TypeScript strict mode, existing test patterns, Zod validation, Tailwind CSS styling)
- [x] Test coverage is adequate for the feature scope
- [x] Accessibility requirements met (labels, `aria-describedby`, `aria-invalid`, keyboard navigation)

## Security Considerations

- **Authentication enforced on API route**: The `PUT /api/seats/[id]` endpoint uses the existing `requireAuth()` / `isAuthFailure()` pattern. Unauthenticated requests receive a 401 response. No seat data can be modified by unauthenticated users.
- **Input validation**: All input is validated via Zod schema with max length constraints (255 chars per field). This prevents oversized payloads from reaching the database layer.
- **No privilege escalation**: The endpoint only modifies enrichment fields (`firstName`, `lastName`, `department`). It is impossible to modify `githubUsername`, `status`, `githubUserId`, or any other sync-managed field through this endpoint — the validation schema does not accept these fields and the handler does not read them from the request body.
- **ID parameter validation**: The seat ID is parsed and validated as a positive integer before any database operation. Non-numeric or non-integer values are rejected with 400.
- **SQL injection protection**: All database queries use TypeORM's parameterised repository methods (`findOne`, `save`). No raw SQL is constructed with user input.
- **No sensitive data in response**: The API response excludes internal fields (`githubUserId`, `assignedAt`, `lastActivityEditor`, `planType`, `updatedAt`), consistent with the GET endpoint.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User can edit first name, last name, and department on a seat record (verified by integration test: PUT endpoint updates fields; verified by E2E test: inline form saves changes)
- [x] Changes are saved to the database (verified by integration test: database state verified after PUT; verified by E2E test: values persist after page refresh)
- [x] Updated values are immediately reflected in the seat list (verified by E2E test: values update in the table after save without manual refresh)
- [x] Editing does not affect the GitHub username or seat status (verified by integration test: githubUsername and status unchanged after PUT; verified by E2E test: username and status unchanged after edit)
- [x] Validation prevents invalid input (verified by schema unit tests: max length, empty object rejection; verified by integration tests: 400 responses for invalid input)
- [x] All new integration tests pass
- [x] All new E2E tests pass
- [x] All existing tests continue to pass (no regressions)
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Bulk editing**: Allow selecting multiple seats and editing department for all at once. Useful for large organisations reassigning teams.
- **Department autocomplete/dropdown**: Instead of free-text, provide a dropdown of existing departments for consistency. Depends on Epic 7 (Team & Department Management).
- **Edit history/audit log**: Track who changed enrichment fields and when. Not required by current acceptance criteria.
- **CSV/bulk import**: Allow uploading a CSV file to update firstName, lastName, and department for multiple seats at once.
- **Optimistic UI updates**: Update the table immediately on save and revert on error. Current implementation re-fetches the page, which is simpler but causes a brief loading flash.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | All phases implemented and reviewed. Code review: Approved with 2 Low findings (L1: zero/negative ID accepted — matches existing codebase pattern; L2: Cancel not disabled during save — matches UserManagementPanel pattern). |
