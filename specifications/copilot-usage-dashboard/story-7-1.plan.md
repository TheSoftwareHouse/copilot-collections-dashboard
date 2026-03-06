# Story 7.1: User Can Define Teams — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.1 |
| Title | User can define teams |
| Description | As a user, I want to create teams with a name so that I can group seat holders for usage tracking purposes. Includes full CRUD operations for team management with cascading delete behavior that preserves historical data. |
| Priority | Medium |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (line 893), `specifications/copilot-usage-dashboard/quality-review.md` (S-05) |

## Proposed Solution

Implement a full CRUD management interface for teams, consisting of:

1. **Backend**: REST API routes (`/api/teams`) for listing, creating, updating, and deleting teams. Follow the exact same conventions as the existing `/api/users` CRUD.
2. **Frontend**: A dedicated "Teams" page at `/teams` with a `TeamManagementPanel` component modelled after the existing `UserManagementPanel`.
3. **Soft Delete**: Add a `deletedAt` column to the `team` table. Deleting a team sets `deletedAt` (instead of physically removing the row) so that historical `team_member_snapshot` records and usage data remain intact. Current-month snapshots are removed on delete.
4. **Navigation**: Add a "Teams" link to the main navigation bar.
5. **Validation**: Zod schemas for create/update team input, consistent with the existing validation pattern.

### Delete Cascade Strategy

The existing `team_member_snapshot` FK constraint (`ON DELETE NO ACTION`) prevents physically deleting a `team` row when historical snapshots exist. The acceptance criteria require:
- Deleting a team removes its **current** member assignments.
- Historical team composition snapshots and usage data are **preserved**.

**Solution**: Soft-delete the team (`deletedAt = NOW()`). Before soft-deleting, delete `team_member_snapshot` entries for the current month/year only. Historical snapshots survive because the team row remains in the database. The list API filters to `deletedAt IS NULL`, and the existing usage queries (`/api/usage/teams`) continue to join on `team` for historical months where snapshots exist.

```
┌──────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│   Frontend   │────▶│  /api/teams (CRUD)    │────▶│  PostgreSQL           │
│  Teams Page  │     │  GET/POST/PUT/DELETE  │     │  team (soft-delete)   │
│  TeamMgmtPanel│    │  + Zod validation     │     │  team_member_snapshot │
└──────────────┘     └──────────────────────┘     └───────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `TeamEntity` — `src/entities/team.entity.ts` — Entity schema for `team` table (id, name, createdAt, updatedAt)
- `TeamMemberSnapshotEntity` — `src/entities/team-member-snapshot.entity.ts` — Snapshot entity with FK to team and copilot_seat
- Migration `1772400000000-CreateTeamTables` — `migrations/1772400000000-CreateTeamTables.ts` — Creates `team` and `team_member_snapshot` tables
- Data source registration — `src/lib/data-source.ts` — TeamEntity and TeamMemberSnapshotEntity registered
- Test data source — `src/test/db-helpers.ts` — Both entities registered, `cleanDatabase` handles team tables
- Team usage API — `src/app/api/usage/teams/route.ts` — GET endpoint for aggregated team usage (Story 6.2)
- Team usage UI — `src/components/usage/TeamUsagePanel.tsx`, `TeamUsageTable.tsx`, `TeamDetailPanel.tsx` — Usage display components (Story 6.2)
- Auth helpers — `src/lib/api-auth.ts` — `requireAuth` / `isAuthFailure` pattern used in all API routes
- User CRUD pattern — `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts` — Reference CRUD implementation
- User validation — `src/lib/validations/user.ts` — Zod schema pattern for create/update
- UserManagementPanel — `src/components/users/UserManagementPanel.tsx` — Reference CRUD UI component
- NavBar — `src/components/NavBar.tsx` — Main navigation component
- E2E auth helpers — `e2e/helpers/auth.ts` — `seedTestUser`, `loginViaApi`

### To Be Modified
- `TeamEntity` — `src/entities/team.entity.ts` — Add `deletedAt` column for soft-delete support
- `NavBar` — `src/components/NavBar.tsx` — Add "Teams" navigation link

### To Be Created
- Migration `AddTeamSoftDelete` — New migration adding `deletedAt` column to `team` table
- Team validation schemas — `src/lib/validations/team.ts` — Zod schemas for create/update
- Team list + create API — `src/app/api/teams/route.ts` — GET and POST handlers
- Team update + delete API — `src/app/api/teams/[id]/route.ts` — PUT and DELETE handlers
- Teams page — `src/app/(app)/teams/page.tsx` — Next.js page routing to management panel
- TeamManagementPanel — `src/components/teams/TeamManagementPanel.tsx` — CRUD UI component
- Unit tests (list/create) — `src/app/api/teams/__tests__/route.test.ts`
- Unit tests (update/delete) — `src/app/api/teams/__tests__/[id].route.test.ts`
- E2E tests — `e2e/team-management.spec.ts`

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should team names be unique? | Yes — enforce at DB level with a unique index on `(name) WHERE deletedAt IS NULL` to prevent duplicate active teams while allowing soft-deleted teams to have the same name. | ✅ Resolved |
| 2 | What constitutes "current" member assignments for delete? | Snapshot entries for the current calendar month and year (based on server time at the moment of deletion). | ✅ Resolved |
| 3 | Should deleted teams still appear in the usage/teams API for historical months? | Yes — the existing `/api/usage/teams` query joins on `team` unconditionally. Historical snapshots reference the soft-deleted team row, so historical data remains visible. | ✅ Resolved |
| 4 | How does the FK constraint on team_member_snapshot interact with team deletion? | FK has `ON DELETE NO ACTION`. Physical delete is not possible when snapshots exist. Soft-delete solves this — the team row remains, snapshots keep their FK intact. | ✅ Resolved |

## Implementation Plan

### Phase 1: Database Schema — Soft Delete Support

#### Task 1.1 — [MODIFY] Add `deletedAt` column to TeamEntity
**Description**: Update the `TeamEntity` schema in `src/entities/team.entity.ts` to include a nullable `deletedAt` timestamp column for soft-delete support.

**Definition of Done**:
- [x] `TeamEntity` in `src/entities/team.entity.ts` has a `deletedAt` column of type `timestamptz`, nullable, default `null`
- [x] `Team` interface includes `deletedAt: Date | null`
- [x] TypeScript compiles without errors

#### Task 1.2 — [CREATE] Migration to add `deletedAt` column and partial unique index
**Description**: Create a TypeORM migration that adds the `deletedAt` column to the `team` table and creates a partial unique index on `name` for active teams only (`WHERE "deletedAt" IS NULL`).

**Definition of Done**:
- [x] Migration file exists in `migrations/` with a timestamp-prefixed name and descriptive class name
- [x] `up()` adds `deletedAt` column (`TIMESTAMP WITH TIME ZONE DEFAULT NULL`) to `team` table
- [x] `up()` creates partial unique index `UQ_team_name_active` on `team(name) WHERE "deletedAt" IS NULL`
- [x] `down()` drops the index and column, fully reversible
- [x] Migration follows the naming convention of existing migrations (e.g., `1772600000000-AddTeamSoftDelete.ts`)

### Phase 2: Backend API — Team CRUD

#### Task 2.1 — [CREATE] Zod validation schemas for teams
**Description**: Create Zod validation schemas for creating and updating teams, following the pattern in `src/lib/validations/user.ts`.

**Definition of Done**:
- [x] File `src/lib/validations/team.ts` exists
- [x] `createTeamSchema` validates `name` as required, trimmed, non-empty, max 255 chars
- [x] `updateTeamSchema` validates `name` as required, trimmed, non-empty, max 255 chars
- [x] Types `CreateTeamInput` and `UpdateTeamInput` are exported
- [x] TypeScript compiles without errors

#### Task 2.2 — [CREATE] GET and POST `/api/teams` route
**Description**: Create the API route handling listing all active teams (GET) and creating a new team (POST). Follow the exact pattern from `src/app/api/users/route.ts`.

**Definition of Done**:
- [x] File `src/app/api/teams/route.ts` exists
- [x] `GET` returns `{ teams: [...] }` with all teams where `deletedAt IS NULL`, ordered by `name ASC`
- [x] Each team in the response includes `id`, `name`, `createdAt`, `updatedAt`
- [x] `GET` requires authentication (returns 401 without valid session)
- [x] `POST` creates a new team with the provided `name` after validation
- [x] `POST` returns 201 with the created team data
- [x] `POST` returns 400 for invalid/missing body
- [x] `POST` returns 409 if a team with the same name already exists (catches Postgres unique violation `23505`)
- [x] `POST` requires authentication
- [x] Internal errors return 500 with generic message

#### Task 2.3 — [CREATE] PUT and DELETE `/api/teams/[id]` route
**Description**: Create the API route handling updating a team name (PUT) and soft-deleting a team (DELETE). Follow the pattern from `src/app/api/users/[id]/route.ts`.

**Definition of Done**:
- [x] File `src/app/api/teams/[id]/route.ts` exists
- [x] `PUT` updates the team name after validation, returns updated team data
- [x] `PUT` returns 400 for invalid ID or invalid body
- [x] `PUT` returns 404 if team not found or is soft-deleted (`deletedAt IS NOT NULL`)
- [x] `PUT` returns 409 if the new name conflicts with an existing active team
- [x] `PUT` requires authentication
- [x] `DELETE` soft-deletes the team by setting `deletedAt = NOW()`
- [x] `DELETE` removes `team_member_snapshot` entries for the team in the current month/year before soft-deleting
- [x] `DELETE` returns 400 for invalid ID
- [x] `DELETE` returns 404 if team not found or already soft-deleted
- [x] `DELETE` requires authentication
- [x] Both operations use a transaction to ensure atomicity
- [x] Internal errors return 500 with generic message

#### Task 2.4 — [CREATE] Unit tests for GET/POST `/api/teams`
**Description**: Create unit tests for the team list and create endpoints, following the pattern in `src/app/api/users/__tests__/route.test.ts`.

**Definition of Done**:
- [x] File `src/app/api/teams/__tests__/route.test.ts` exists
- [x] Tests cover: GET returns empty list, GET returns active teams only (excludes soft-deleted), GET requires auth
- [x] Tests cover: POST creates team successfully, POST rejects empty name, POST rejects duplicate name, POST requires auth
- [x] Tests use `getTestDataSource`/`cleanDatabase`/`destroyTestDataSource` from `src/test/db-helpers.ts`
- [x] Tests mock `@/lib/db` and `next/headers` following the existing pattern
- [x] All tests pass

#### Task 2.5 — [CREATE] Unit tests for PUT/DELETE `/api/teams/[id]`
**Description**: Create unit tests for the team update and delete endpoints, following the pattern in `src/app/api/users/__tests__/[id].route.test.ts`.

**Definition of Done**:
- [x] File `src/app/api/teams/__tests__/[id].route.test.ts` exists
- [x] Tests cover: PUT updates team name, PUT rejects invalid ID, PUT returns 404 for soft-deleted team, PUT rejects duplicate name, PUT requires auth
- [x] Tests cover: DELETE soft-deletes team (sets deletedAt), DELETE removes current-month snapshots only, DELETE preserves historical snapshots, DELETE returns 404 for already-deleted team, DELETE requires auth
- [x] Tests verify the snapshot preservation behavior by seeding historical and current snapshots before delete
- [x] All tests pass

### Phase 3: Frontend — Team Management UI

#### Task 3.1 — [CREATE] Teams management page
**Description**: Create the Next.js page at `/teams` that renders the team management panel, following the pattern from `src/app/(app)/users/page.tsx`.

**Definition of Done**:
- [x] File `src/app/(app)/teams/page.tsx` exists
- [x] Page has metadata title "Teams — Copilot Dashboard"
- [x] Page uses `force-dynamic` export
- [x] Page renders a heading "Team Management", descriptive text, and the `TeamManagementPanel` component
- [x] Page follows the same layout structure as the users page

#### Task 3.2 — [CREATE] TeamManagementPanel component
**Description**: Create the team management panel component with full CRUD UI, modelled after `UserManagementPanel`. Supports listing teams, creating a new team (with name input), inline editing of team name, and deleting with confirmation.

**Definition of Done**:
- [x] File `src/components/teams/TeamManagementPanel.tsx` exists
- [x] Component is a client component (`"use client"`)
- [x] Fetches and displays list of teams from `GET /api/teams` on mount
- [x] Shows loading state while fetching
- [x] Shows error state with retry button on fetch failure
- [x] Shows empty state message when no teams exist
- [x] "Add Team" button reveals a create form with name input and client-side Zod validation
- [x] Create form submits to `POST /api/teams`, handles 201 (success), 400 (validation), 409 (duplicate name)
- [x] Each team row shows name, created date, and Edit/Delete action buttons
- [x] Edit mode shows inline form with name input, pre-filled with current name
- [x] Edit submits to `PUT /api/teams/[id]`, handles 200, 400, 404, 409
- [x] Delete shows confirmation prompt ("Are you sure?") before calling `DELETE /api/teams/[id]`
- [x] Delete handles 200, 404 responses
- [x] All form inputs have proper `label` elements, `aria-describedby` for errors, and `aria-invalid` attributes
- [x] Error messages use `role="alert"` for accessibility
- [x] Table has a `<caption className="sr-only">` for screen readers

#### Task 3.3 — [MODIFY] Add "Teams" link to navigation
**Description**: Add a "Teams" navigation link to the NavBar component between "Seats" and "Users".

**Definition of Done**:
- [x] `src/components/NavBar.tsx` includes `{ href: "/teams", label: "Teams" }` in the `navLinks` array
- [x] Link appears between "Seats" and "Users" in the navigation bar
- [x] Active state highlighting works correctly when on the `/teams` route

### Phase 4: End-to-End Tests

#### Task 4.1 — [CREATE] E2E tests for team management
**Description**: Create Playwright E2E tests covering the full team CRUD lifecycle, following the pattern in existing E2E specs (e.g., `e2e/user-management.spec.ts`).

**Definition of Done**:
- [x] File `e2e/team-management.spec.ts` exists
- [x] Tests seed required data (configuration, auth user) using direct DB queries via `pg` client
- [x] Tests clean up data in `beforeEach` to ensure isolation
- [x] Test: Can navigate to Teams page via navigation link
- [x] Test: Empty state is shown when no teams exist
- [x] Test: Can create a team with a name
- [x] Test: Created team appears in the list
- [x] Test: Cannot create a team with a duplicate name (error shown)
- [x] Test: Can edit a team's name inline
- [x] Test: Can delete a team with confirmation
- [x] Test: Deleted team disappears from the list
- [x] All E2E tests pass

### Phase 5: Code Review

#### Task 5.1 — [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run a full code review of all changes using the `tsh-code-reviewer` agent to verify code quality, consistency with existing patterns, security, and test coverage.

**Definition of Done**:
- [x] All new files reviewed for adherence to project conventions
- [x] API routes follow the same error handling patterns as existing routes
- [x] Validation schemas are consistent with existing Zod patterns
- [x] Frontend component follows the same structure and accessibility patterns as `UserManagementPanel`
- [x] All unit tests and E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint violations

## Security Considerations

- **Authentication**: All team API endpoints are protected by `requireAuth()`, consistent with the users API. Unauthenticated requests receive 401.
- **Input Validation**: All user input is validated server-side with Zod schemas before database operations. Team names are trimmed and length-limited (255 chars).
- **SQL Injection**: TypeORM parameterised queries prevent SQL injection. Raw queries (for snapshot deletion in DELETE) must use parameterised placeholders.
- **Unique Constraint**: The partial unique index on `name WHERE deletedAt IS NULL` prevents duplicate active team names at the database level, not just application level.
- **Integer ID Parsing**: All ID parameters are parsed and validated as integers before use, following the existing pattern in users API.
- **Error Information Disclosure**: Internal errors return generic "Internal server error" without stack traces or implementation details.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] User can create a new team by providing a name
- [ ] User can view a list of all teams
- [ ] User can edit a team's name
- [ ] User can delete a team
- [ ] Deleting a team removes its current member assignments (current-month snapshots deleted)
- [ ] Historical team composition snapshots and usage data are preserved after deletion (team soft-deleted, past snapshots remain)
- [ ] Team names must be unique among active teams
- [ ] All API endpoints require authentication
- [ ] All inputs are validated with Zod schemas (client-side and server-side)
- [ ] Duplicate team name returns 409 Conflict
- [ ] Unit tests cover all API endpoints and edge cases
- [ ] E2E tests cover the full CRUD lifecycle
- [ ] UI is accessible (proper labels, aria attributes, keyboard navigation)
- [ ] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Team member count in list**: Show the number of current members next to each team name. Depends on Story 7.2 (assign seats to team).
- **Search/filter teams**: If the number of teams grows large, add search or pagination to the team list.
- **Undo delete**: Since teams are soft-deleted, a future feature could allow restoring deleted teams.
- **Bulk operations**: Allow creating multiple teams at once or bulk renaming.
- **Team name format validation**: Enforce naming conventions (e.g., no special characters) if required by the organisation.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
