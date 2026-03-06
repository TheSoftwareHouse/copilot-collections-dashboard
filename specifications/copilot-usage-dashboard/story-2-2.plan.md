# Story 2.2: Admin can manage application users — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 2.2 |
| Title | Admin can manage application users |
| Description | Enable administrators to create, edit, and remove user accounts so that they can control who has access to the Copilot usage dashboard. Includes a user management page with a list of all users and full CRUD operations. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Implement a user management page within the existing authenticated `(app)` route group at `/users`. The page provides a table listing all application users, a form for creating/editing users, and the ability to delete users. All operations are backed by new RESTful API routes under `/api/users` protected by the existing `requireAuth()` guard. The solution reuses the existing `User` entity, `hashPassword` utility, auth infrastructure, and UI patterns established in Story 2.1.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Next.js App                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                   (app) Route Group (auth-guarded)               │     │
│  │                                                                  │     │
│  │   /dashboard   /settings   /users (NEW)                         │     │
│  │                             │                                    │     │
│  │                   ┌─────────┴──────────┐                        │     │
│  │                   │  UsersPage (Server) │                        │     │
│  │                   │  └ UserManagement   │                        │     │
│  │                   │    Panel (Client)   │                        │     │
│  │                   └────────────────────┘                        │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                   API Routes (auth-guarded)                      │     │
│  │                                                                  │     │
│  │  GET    /api/users         → List all users                     │     │
│  │  POST   /api/users         → Create new user                   │     │
│  │  PUT    /api/users/[id]    → Update existing user               │     │
│  │  DELETE /api/users/[id]    → Delete user + cascade sessions     │     │
│  └──────────────────────────┬──────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────┐               │
│  │  PostgreSQL                                           │               │
│  │  ┌──────────────┐    FK ON DELETE CASCADE             │               │
│  │  │   app_user   │◀──────────────┐                    │               │
│  │  │ (existing)   │               │                    │               │
│  │  └──────────────┘    ┌──────────┴──┐                 │               │
│  │                      │   session    │                 │               │
│  │                      │ (existing)   │                 │               │
│  │                      └─────────────┘                  │               │
│  └──────────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No database schema changes**: The `app_user` table (from Story 2.1) already has all required fields — `id`, `username`, `passwordHash`, `createdAt`, `updatedAt`. No migrations needed.

2. **Session cascade on user deletion**: The existing `FK_session_userId` foreign key with `ON DELETE CASCADE` ensures that deleting a user automatically removes all their active sessions — satisfying the "removed users can no longer log in" requirement without additional session cleanup code.

3. **Self-deletion prevention**: The `DELETE /api/users/[id]` endpoint checks whether the authenticated user is attempting to delete their own account and returns `403` to prevent admin lockout.

4. **Password handling on edit**: When updating a user, `password` is optional. If omitted (or empty), the password remains unchanged. If provided, it's hashed with bcrypt before storage — consistent with the existing `hashPassword` utility.

5. **Dedicated `/users` page**: User management is placed at a dedicated `/users` route (inside the `(app)` route group) rather than embedding it in the settings page. This keeps the settings page focused on system configuration and job status, and the user management page focused on user CRUD. A new "Users" nav link is added to the NavBar.

6. **Client-managed state for CRUD**: The `UserManagementPanel` client component manages the full user list state, fetching from `GET /api/users` on mount and refreshing after each mutation. This follows the same client-side data management pattern used by `ConfigurationForm` and `LoginForm`.

7. **No role-based access control**: All authenticated users can manage other users. There's no admin/user role distinction in the current data model. Role-based access control is documented as an out-of-scope improvement.

### API Contracts

**GET /api/users**
| Status | Body |
|--------|------|
| 200 | `{ users: [{ id, username, createdAt, updatedAt }] }` |
| 401 | `{ error: "Authentication required" }` |

**POST /api/users**
| Status | Body |
|--------|------|
| 201 | `{ id, username, createdAt, updatedAt }` |
| 400 | `{ error: "Validation failed", details: { ... } }` |
| 401 | `{ error: "Authentication required" }` |
| 409 | `{ error: "Username already exists" }` |

**PUT /api/users/[id]**
| Status | Body |
|--------|------|
| 200 | `{ id, username, createdAt, updatedAt }` |
| 400 | `{ error: "Validation failed", details: { ... } }` |
| 401 | `{ error: "Authentication required" }` |
| 404 | `{ error: "User not found" }` |
| 409 | `{ error: "Username already exists" }` |

**DELETE /api/users/[id]**
| Status | Body |
|--------|------|
| 200 | `{ success: true }` |
| 401 | `{ error: "Authentication required" }` |
| 403 | `{ error: "Cannot delete your own account" }` |
| 404 | `{ error: "User not found" }` |

## Current Implementation Analysis

### Already Implemented
- `src/entities/user.entity.ts` — `User` interface and `UserEntity` EntitySchema with all needed columns (`id`, `username`, `passwordHash`, `createdAt`, `updatedAt`)
- `src/entities/session.entity.ts` — `Session` entity with `FK ON DELETE CASCADE` to `app_user` (cascade session cleanup on user deletion)
- `src/lib/auth.ts` — `hashPassword()`, `verifyPassword()`, `getSession()`, `SESSION_COOKIE_NAME` — reused in user management API routes
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused to protect all user management endpoints
- `src/lib/validations/login.ts` — Pattern reference for Zod validation schema construction
- `src/lib/db.ts` — Database connection singleton — reused in API route handlers
- `src/app/(app)/layout.tsx` — Auth guard in route group layout — already protects `/users` page automatically
- `src/test/db-helpers.ts` — `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()` — reused verbatim in new integration tests
- `e2e/helpers/auth.ts` — `seedTestUser()`, `loginViaApi()`, `clearAuthData()` — reused for E2E test setup
- `migrations/1772229363813-CreateAuthTables.ts` — Existing migration that created `app_user` and `session` tables — no new migrations needed

### To Be Modified
- `src/components/NavBar.tsx` — Add "Users" link to `navLinks` array so user management is accessible from navigation

### To Be Created
- `src/lib/validations/user.ts` — Zod schemas for create user (`createUserSchema`) and update user (`updateUserSchema`) input validation
- `src/app/api/users/route.ts` — API route handlers for `GET /api/users` (list) and `POST /api/users` (create)
- `src/app/api/users/[id]/route.ts` — API route handlers for `PUT /api/users/[id]` (update) and `DELETE /api/users/[id]` (delete)
- `src/components/users/UserManagementPanel.tsx` — Client component managing the full user list with create, edit, and delete operations
- `src/app/(app)/users/page.tsx` — Server component for the `/users` page, renders `UserManagementPanel`
- `src/lib/validations/__tests__/user.test.ts` — Unit tests for user validation schemas
- `src/app/api/users/__tests__/route.test.ts` — Integration tests for `GET /api/users` and `POST /api/users`
- `src/app/api/users/__tests__/[id].route.test.ts` — Integration tests for `PUT /api/users/[id]` and `DELETE /api/users/[id]`
- `e2e/user-management.spec.ts` — E2E tests for the full user management flow

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should admins be prevented from deleting their own account? | Yes — the `DELETE /api/users/[id]` endpoint returns `403` when the authenticated user's ID matches the target. This prevents accidental admin lockout. | ✅ Resolved |
| 2 | What user fields can be edited? | Username and password. Password is optional on edit — if omitted, the existing password is preserved. Username must remain unique. | ✅ Resolved |
| 3 | Is role-based access control needed for this story? | No — the current data model has no role field. All authenticated users can manage other users. Role-based access control is documented as an out-of-scope improvement. | ✅ Resolved |
| 4 | Where should the user management UI live? | At `/users` within the `(app)` route group, accessible via a new "Users" nav link. This keeps settings focused on system configuration and avoids overcrowding. | ✅ Resolved |
| 5 | Are new database migrations required? | No — the `app_user` table from Story 2.1 already has all required fields. Session cascade delete is already configured. | ✅ Resolved |

## Implementation Plan

### Phase 1: Validation Schemas

#### Task 1.1 - [CREATE] User management validation schemas
**Description**: Create Zod schemas for validating create-user and update-user input. Follow the same pattern as `src/lib/validations/login.ts` and `src/lib/validations/configuration.ts`.

**Definition of Done**:
- [x] File created at `src/lib/validations/user.ts`
- [x] `createUserSchema` validates `username` as a required, trimmed, non-empty string (max 255 chars) and `password` as a required, non-empty string
- [x] `updateUserSchema` validates `username` as an optional trimmed non-empty string (max 255 chars) and `password` as an optional non-empty string, with a refinement ensuring at least one field is provided
- [x] `CreateUserInput` and `UpdateUserInput` TypeScript types inferred from schemas and exported
- [x] Descriptive error messages for each validation rule consistent with existing schemas
- [x] File compiles without TypeScript errors

### Phase 2: API Routes

#### Task 2.1 - [CREATE] List and create users API route
**Description**: Create the `GET /api/users` and `POST /api/users` route handlers. Both require authentication via `requireAuth()`. GET returns all users (excluding `passwordHash`). POST validates input, hashes the password, creates the user, and handles duplicate username conflicts.

**Definition of Done**:
- [x] File created at `src/app/api/users/route.ts`
- [x] `GET` handler calls `requireAuth()` and returns `401` if unauthenticated
- [x] `GET` returns `200` with `{ users: [{ id, username, createdAt, updatedAt }] }` — `passwordHash` is never exposed
- [x] `POST` handler calls `requireAuth()` and returns `401` if unauthenticated
- [x] `POST` parses request body, validates with `createUserSchema`, and returns `400` with structured errors on validation failure
- [x] `POST` hashes the password using `hashPassword()` from `src/lib/auth.ts`
- [x] `POST` creates the user in the database and returns `201` with `{ id, username, createdAt, updatedAt }`
- [x] `POST` returns `409` with `{ error: "Username already exists" }` on unique constraint violation (pgcode `23505`)
- [x] `POST` returns `400` for malformed JSON body
- [x] File compiles without TypeScript errors

#### Task 2.2 - [CREATE] Update and delete user API route
**Description**: Create the `PUT /api/users/[id]` and `DELETE /api/users/[id]` route handlers using Next.js dynamic route segments. Both require authentication. PUT validates input and updates specified fields. DELETE removes the user (cascading session cleanup) with self-deletion protection.

**Definition of Done**:
- [x] File created at `src/app/api/users/[id]/route.ts`
- [x] `PUT` handler calls `requireAuth()` and returns `401` if unauthenticated
- [x] `PUT` parses `params.id` as a number, returns `400` for non-numeric IDs
- [x] `PUT` validates body with `updateUserSchema`, returns `400` on validation failure
- [x] `PUT` returns `404` if user with given ID does not exist
- [x] `PUT` updates only the provided fields — `username` directly, `password` by hashing with `hashPassword()`
- [x] `PUT` returns `409` with `{ error: "Username already exists" }` on unique constraint violation
- [x] `PUT` returns `200` with `{ id, username, createdAt, updatedAt }` on success
- [x] `DELETE` handler calls `requireAuth()` and returns `401` if unauthenticated
- [x] `DELETE` parses `params.id` as a number, returns `400` for non-numeric IDs
- [x] `DELETE` returns `403` with `{ error: "Cannot delete your own account" }` if the authenticated user's ID matches the target ID
- [x] `DELETE` returns `404` if user with given ID does not exist
- [x] `DELETE` removes the user from the database (sessions cascade-deleted via FK) and returns `200` with `{ success: true }`
- [x] File compiles without TypeScript errors

### Phase 3: UI — User Management Page

#### Task 3.1 - [CREATE] UserManagementPanel client component
**Description**: Build a client component that provides the full user management UI: a table listing users, inline form for creating/editing users, and delete functionality with confirmation. Follow the same Tailwind utility class patterns, accessible form patterns (`label`, `aria-describedby`, `aria-invalid`, `role="alert"`), and state management approach used in `ConfigurationForm.tsx` and `LoginForm.tsx`.

**Definition of Done**:
- [x] File created at `src/components/users/UserManagementPanel.tsx` as a `"use client"` component
- [x] On mount, fetches user list from `GET /api/users` and displays in a table with columns: Username, Created, Actions
- [x] "Add user" button above the table toggles a create form with `username` and `password` fields
- [x] Create form submits to `POST /api/users`; on `201` success, refreshes the user list and hides the form
- [x] Validation errors (400) display as field-level error messages; conflict errors (409) display as a server error message
- [x] Each table row has an "Edit" button that shows an edit form pre-filled with the user's username; password field is empty (optional)
- [x] Edit form submits to `PUT /api/users/[id]`; on `200` success, refreshes the user list and closes the edit form
- [x] Each table row has a "Delete" button that shows an inline confirmation ("Are you sure?") before sending `DELETE /api/users/[id]`
- [x] Self-deletion attempt (403) displays an error message; successful deletion refreshes the user list
- [x] Loading state displayed while fetching the user list
- [x] Error state displayed if fetching the user list fails
- [x] Empty state displayed when no users exist (unlikely but handled)
- [x] Component is accessible: proper `<label>` associations, `aria-describedby` for errors, `aria-invalid` on invalid fields, keyboard-navigable actions, `role="alert"` on error messages
- [x] Visual style consistent with existing components (Tailwind utility classes matching `ConfigurationForm`, `LoginForm`, `JobStatusPanel`)

#### Task 3.2 - [CREATE] Users page
**Description**: Create the `/users` page as a server component within the `(app)` route group. The page is automatically protected by the auth guard in `(app)/layout.tsx`.

**Definition of Done**:
- [x] File created at `src/app/(app)/users/page.tsx` as a Server Component
- [x] Page renders a heading "User Management", descriptive text, and the `UserManagementPanel` component
- [x] Page exports metadata with `title: "Users — Copilot Dashboard"`
- [x] Page exports `dynamic = "force-dynamic"` to ensure fresh data
- [x] Page is accessible at `/users` when authenticated
- [x] Page redirects to `/login` when unauthenticated (inherited from `(app)/layout.tsx` guard)
- [x] Visual layout consistent with other pages (`min-h-screen bg-gray-50`, centred max-width container)

#### Task 3.3 - [MODIFY] NavBar — Add Users link
**Description**: Add a "Users" navigation link to the NavBar component so user management is accessible from the main navigation.

**Definition of Done**:
- [x] `navLinks` array in `src/components/NavBar.tsx` includes `{ href: "/users", label: "Users" }`
- [x] "Users" link follows the same active-state styling as existing links (blue underline when active)
- [x] Link is positioned between "Dashboard" and "Settings" (or after "Settings" — consistent ordering)
- [x] No regressions in existing navigation behaviour

### Phase 4: Testing

#### Task 4.1 - [CREATE] User validation unit tests
**Description**: Unit tests for the `createUserSchema` and `updateUserSchema` Zod schemas.

**Definition of Done**:
- [x] Test file at `src/lib/validations/__tests__/user.test.ts`
- [x] `createUserSchema` tests: valid input accepted, empty username rejected, empty password rejected, oversized username rejected (>255 chars), whitespace-only username rejected
- [x] `updateUserSchema` tests: valid input with only username accepted, valid input with only password accepted, valid input with both accepted, empty object rejected (at least one field required), empty username string rejected, empty password string rejected
- [x] All tests pass

#### Task 4.2 - [CREATE] Users list and create API integration tests
**Description**: Integration tests for `GET /api/users` and `POST /api/users` using a test database, following the same mock pattern as `configuration/route.test.ts`.

**Definition of Done**:
- [x] Test file at `src/app/api/users/__tests__/route.test.ts`
- [x] Mocks `@/lib/db` and `next/headers` (same approach as `configuration/route.test.ts`)
- [x] `GET` tests: returns 401 without session, returns 200 with empty user list, returns 200 with seeded users (passwordHash not exposed)
- [x] `POST` tests: returns 401 without session, returns 201 for valid input with hashed password stored, returns 400 for validation errors (missing fields, empty strings), returns 400 for malformed JSON, returns 409 for duplicate username
- [x] Database cleaned between tests for isolation
- [x] All tests pass

#### Task 4.3 - [CREATE] User update and delete API integration tests
**Description**: Integration tests for `PUT /api/users/[id]` and `DELETE /api/users/[id]`.

**Definition of Done**:
- [x] Test file at `src/app/api/users/__tests__/[id].route.test.ts`
- [x] `PUT` tests: returns 401 without session, returns 200 when updating username only, returns 200 when updating password only, returns 200 when updating both, returns 400 for validation errors, returns 400 for non-numeric ID, returns 404 for non-existent user, returns 409 for duplicate username
- [x] `DELETE` tests: returns 401 without session, returns 200 on successful deletion, returns 403 when trying to delete own account, returns 400 for non-numeric ID, returns 404 for non-existent user
- [x] Database cleaned between tests for isolation
- [x] All tests pass
- Note: cascade session deletion tested via E2E tests (test DB uses `synchronize: true` without FK migration cascades)

#### Task 4.4 - [CREATE] User management E2E tests
**Description**: End-to-end tests for the full user management flow — viewing users, creating a new user, editing a user, deleting a user, and verifying that deleted users cannot log in.

**Definition of Done**:
- [x] Test file at `e2e/user-management.spec.ts`
- [x] Test setup seeds a configuration and logs in an admin user (reuses `e2e/helpers/auth.ts`)
- [x] Test: admin navigates to `/users` and sees the user list with at least their own account
- [x] Test: admin creates a new user → user appears in the list
- [x] Test: admin edits a user's username → updated username appears in the list
- [x] Test: admin attempts to delete their own account → error message displayed, account not deleted
- [x] Test: admin deletes another user → user disappears from the list
- [x] Test: deleted user cannot log in (attempt login with deleted credentials → 401/error)
- [x] All E2E tests pass

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (EntitySchema pattern, Zod validation, Tailwind styling, file naming)
- [x] Test coverage is adequate for the feature scope

## Security Considerations

- **Password never exposed in API responses**: `GET /api/users` and all mutation responses intentionally exclude `passwordHash`. Only `id`, `username`, `createdAt`, `updatedAt` are returned.
- **Password hashing**: New user passwords and updated passwords are hashed with bcryptjs (10 salt rounds) before storage — consistent with Story 2.1 implementation.
- **Self-deletion prevention**: `DELETE /api/users/[id]` returns `403` when the authenticated user attempts to delete their own account, preventing admin lockout.
- **Session cascade on deletion**: The existing `FK_session_userId ON DELETE CASCADE` ensures all sessions for a deleted user are automatically removed from the database — the deleted user is immediately logged out of all devices/browsers.
- **Auth-guarded endpoints**: All user management API routes require a valid session via `requireAuth()`. Unauthenticated requests receive `401` with no data leakage.
- **Auth-guarded UI**: The `/users` page is inside the `(app)` route group, protected by the layout-level session check.
- **Username uniqueness enforcement**: Both the database unique constraint and application-level error handling prevent duplicate usernames. The API returns `409` (not `500`) for conflicts.
- **Generic error messages**: Unique constraint violations return "Username already exists" rather than leaking database internals.
- **Input validation**: All user input is validated with Zod schemas before database operations — preventing injection, oversized inputs, and empty-string usernames.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Admin can view a list of all application users at `/users` (table with username, creation date, and action buttons)
- [x] Admin can create a new user with username and password (form with validation, user appears in list after creation)
- [x] Admin can edit an existing user's details — username and/or password (edit form with pre-filled username, optional password change)
- [x] Admin can remove a user account (delete button with confirmation, user removed from list)
- [x] Removed users can no longer log in (session cascade deletion, login attempt returns error)
- [x] Self-deletion is prevented with a clear error message
- [x] `passwordHash` is never exposed in any API response
- [x] All API endpoints return `401` for unauthenticated requests
- [x] "Users" link appears in the navigation bar
- [x] All new unit tests pass
- [x] All new integration tests pass
- [x] All new E2E tests pass
- [x] All existing tests continue to pass (no regressions)
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Role-based access control**: Add an `admin`/`user` role to the User entity to restrict user management to admins only. Currently all authenticated users can manage other users.
- **Password complexity requirements**: Enforce minimum password length, mixed case, numbers, or special characters when creating or updating users.
- **Audit logging**: Log all user management actions (create, edit, delete) with the acting user's identity and timestamp for security review.
- **Pagination**: Add pagination to the user list API and UI. Acceptable for the current expected scale (small number of dashboard users) but should be added if user counts grow.
- **Search/filter**: Add search capability to the user list for large installations.
- **Bulk operations**: Allow bulk user deletion or creation (e.g., CSV import).
- **User profile self-service**: Allow users to change their own password without full user management privileges.
- **Last-user deletion guard**: Prevent deletion of the last remaining user in the system (beyond self-deletion prevention). Currently low risk because self-deletion is blocked.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-27 | Initial plan created |
| 2026-02-28 | Implementation complete. All 5 phases done. Code review: APPROVED with 3 medium findings fixed (M1: edit form payload change detection, M2: table caption for a11y, M3: name attributes on inputs). Low findings (L1-L3) documented as acceptable. 105 unit/integration tests, 24 E2E tests — all passing. |
