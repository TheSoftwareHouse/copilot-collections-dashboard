# Cross-Linking from Management to Usage Pages - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.2 |
| Title | Cross-linking from management to usage pages |
| Description | Enable quick navigation between management and usage views by making team names, department names, and seat holder usernames in the management section clickable links to their respective usage detail pages. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (lines 1601–1650) |

## Proposed Solution

Add Next.js `<Link>` components to the three management table panels (`TeamManagementPanel`, `DepartmentManagementPanel`, `SeatListPanel`) so that entity names in the **read-only (non-editing)** table rows navigate to the corresponding usage detail page for the current month.

**URL pattern**: Each link points to `/usage/<entity-type>/<id>` without explicit `month`/`year` query parameters. The usage detail pages already default to the current month when no query parameters are provided (confirmed in `usage/teams/[teamId]/page.tsx`, `usage/departments/[departmentId]/page.tsx`, and `usage/seats/[seatId]/page.tsx`), matching the acceptance criterion "Links navigate to the current month's usage page by default."

**Visual styling**: The linked entity names will use an underline-on-hover pattern consistent with how the existing usage tables render clickable names (blue text, hover underline). The `UsageStatusIndicator` dot will remain adjacent to the name but **outside** the link text to avoid confusion.

**Scope boundaries**:
- Only the **name cells** in the table are converted to links (not entire rows).
- Links are only rendered in **view mode** — when a row is in edit mode (inline edit form), the name is replaced by an input field and no link is shown.
- The existing edit/delete/members action buttons remain unchanged.

```
Navigation flow:

/management?tab=teams
  → click "Frontend Team"
  → /usage/teams/5        (defaults to current month)

/management?tab=departments
  → click "Engineering"
  → /usage/departments/3  (defaults to current month)

/management?tab=seats
  → click "alice-gh"
  → /usage/seats/42       (defaults to current month)
```

## Current Implementation Analysis

### Already Implemented
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Team management table with name, members, usage %, created, and actions columns. Team name rendered as plain `<span>` text inside a `<td>`.
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — Department management table with name, seats, usage %, created, and actions columns. Department name rendered as plain `<span>` text inside a `<td>`.
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — Seat list table with sortable columns including GitHub username. Username rendered as plain text inside a `<td>`.
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — Coloured dot indicator already displayed alongside entity names in all three management tables.
- Usage detail pages — `src/app/(app)/usage/teams/[teamId]/page.tsx`, `src/app/(app)/usage/departments/[departmentId]/page.tsx`, `src/app/(app)/usage/seats/[seatId]/page.tsx` — All exist and accept optional `?month=X&year=Y` params, defaulting to the current month.
- `TeamUsageTable` / `DepartmentUsageTable` / `SeatUsageTable` — Usage table components that already use `<Link>` from `next/link` with the pattern `href={/usage/<type>/<id>?month=${month}&year=${year}}` — serve as the reference pattern for link styling.
- `ManagementPageLayout` — `src/components/management/ManagementPageLayout.tsx` — Tab-based management page integrating all three panels.
- E2E tests — `e2e/team-management.spec.ts` (282 lines), `e2e/department-management.spec.ts` (300 lines), `e2e/seat-list.spec.ts` (237 lines) — Existing management e2e tests with DB seeding helpers.

### To Be Modified
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Wrap team name text in `<Link>` pointing to `/usage/teams/${team.id}` in view-mode rows.
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — Wrap department name text in `<Link>` pointing to `/usage/departments/${dept.id}` in view-mode rows.
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — Wrap GitHub username text in `<Link>` pointing to `/usage/seats/${seat.id}` in view-mode rows.

### To Be Created
- E2E test — `e2e/cross-linking.spec.ts` — End-to-end tests verifying that clicking a team name, department name, and seat username in management navigates to the correct usage detail page.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the link include explicit `?month=X&year=Y` for the current month? | No — the usage detail pages already default to the current month when params are omitted, keeping the URL cleaner. | ✅ Resolved |
| 2 | Should inactive seats also link to usage pages? | Yes — the seat detail page shows usage data regardless of status. All seats with an `id` should be linkable. | ✅ Resolved |
| 3 | Should the UsageStatusIndicator dot be inside or outside the link? | Outside — the dot is a visual indicator, not a clickable affordance. Keeping it outside the `<Link>` avoids a confusing click target. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add Cross-Links to Management Tables

#### Task 1.1 - [MODIFY] Add usage link to team names in TeamManagementPanel
**Description**: Import `Link` from `next/link` and wrap the team name text inside the name `<td>` with a `<Link>` component pointing to `/usage/teams/${team.id}`. Apply hover-underline styling (`hover:underline text-blue-600 hover:text-blue-800`) to indicate clickability. The `UsageStatusIndicator` remains outside the link. Only apply in view mode (not when `editingTeamId === team.id`).

**Definition of Done**:
- [x] `Link` from `next/link` is imported in `TeamManagementPanel.tsx`
- [x] Team name in view-mode rows is wrapped in `<Link href={`/usage/teams/${team.id}`}>`
- [x] Link text has `text-blue-600 hover:text-blue-800 hover:underline` classes
- [x] `UsageStatusIndicator` dot remains visible and adjacent to the link but is **not** wrapped inside the `<Link>`
- [x] Clicking the team name navigates to `/usage/teams/<teamId>` (current month default)
- [x] Edit mode rows are unchanged (no link when editing)
- [x] No TypeScript or lint errors

#### Task 1.2 - [MODIFY] Add usage link to department names in DepartmentManagementPanel
**Description**: Import `Link` from `next/link` and wrap the department name text inside the name `<td>` with a `<Link>` component pointing to `/usage/departments/${dept.id}`. Apply the same hover-underline styling. Only apply in view mode.

**Definition of Done**:
- [x] `Link` from `next/link` is imported in `DepartmentManagementPanel.tsx`
- [x] Department name in view-mode rows is wrapped in `<Link href={`/usage/departments/${dept.id}`}>`
- [x] Link text has `text-blue-600 hover:text-blue-800 hover:underline` classes
- [x] `UsageStatusIndicator` dot remains visible and adjacent to the link but is **not** wrapped inside the `<Link>`
- [x] Clicking the department name navigates to `/usage/departments/<departmentId>` (current month default)
- [x] Edit mode rows are unchanged (no link when editing)
- [x] No TypeScript or lint errors

#### Task 1.3 - [MODIFY] Add usage link to GitHub usernames in SeatListPanel
**Description**: Import `Link` from `next/link` and wrap the GitHub username text inside the username `<td>` with a `<Link>` component pointing to `/usage/seats/${seat.id}`. Apply the same hover-underline styling. The `UsageStatusIndicator` displayed for active seats remains adjacent but outside the link. Only apply in view mode.

**Definition of Done**:
- [x] `Link` from `next/link` is imported in `SeatListPanel.tsx`
- [x] GitHub username in view-mode rows is wrapped in `<Link href={`/usage/seats/${seat.id}`}>`
- [x] Link text has `text-blue-600 hover:text-blue-800 hover:underline` classes
- [x] `UsageStatusIndicator` dot for active seats remains visible and adjacent but **not** inside the `<Link>`
- [x] Clicking the username navigates to `/usage/seats/<seatId>` (current month default)
- [x] Both active and inactive seats have clickable usernames
- [x] Edit mode rows are unchanged (no link when editing)
- [x] No TypeScript or lint errors

### Phase 2: E2E Testing

#### Task 2.1 - [CREATE] E2E tests for cross-linking from management to usage pages
**Description**: Create a new Playwright test file `e2e/cross-linking.spec.ts` that verifies navigation from each management table to the corresponding usage detail page. The tests should:
1. Seed a team, department, and seat via direct DB queries (following existing e2e helper patterns).
2. Navigate to `/management?tab=teams`, click the team name, and assert the URL is `/usage/teams/<id>`.
3. Navigate to `/management?tab=departments`, click the department name, and assert the URL is `/usage/departments/<id>`.
4. Navigate to `/management?tab=seats`, click the GitHub username, and assert the URL is `/usage/seats/<id>`.
5. Clean up seeded data after tests.

**Definition of Done**:
- [x] `e2e/cross-linking.spec.ts` exists with at least 3 test cases (one per entity type)
- [x] Tests seed required data (team, department, seat) directly via DB using the `pg` client pattern from existing e2e tests
- [x] Team name link test: navigates to `/management?tab=teams`, clicks team name, verifies URL contains `/usage/teams/<teamId>`
- [x] Department name link test: navigates to `/management?tab=departments`, clicks department name, verifies URL contains `/usage/departments/<departmentId>`
- [x] Seat username link test: navigates to `/management?tab=seats`, clicks GitHub username, verifies URL contains `/usage/seats/<seatId>`
- [x] Tests clean up seeded data in `afterAll` or `afterEach`
- [x] All tests pass against a running local instance

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by tsh-code-reviewer
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, accessibility, and consistency with existing patterns.

**Definition of Done**:
- [x] All changes reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] Link styling is consistent across all three panels
- [x] Accessibility attributes are verified (links have meaningful text, not "click here")

## Security Considerations

- **No new API endpoints** — This feature only adds client-side navigation links using Next.js `<Link>`. No new server-side routes or data flow is introduced.
- **No sensitive data exposure** — The team ID, department ID, and seat ID are already visible in the management table data fetched by the existing API endpoints. The usage detail pages are already behind authentication.
- **No XSS risk** — Link href values use numeric IDs from the API response, not user-generated text. Next.js `<Link>` properly encodes URLs.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Team names in team management link to `/usage/teams/[teamId]`
- [x] Department names in department management link to `/usage/departments/[departmentId]`
- [x] Seat holder usernames link to `/usage/seats/[seatId]`
- [x] Links navigate to the current month's usage page by default
- [x] Visual styling indicates names are clickable (blue text, underline on hover)
- [x] Existing edit/delete/members functionality in management tables is unaffected
- [x] E2E tests pass for all three cross-link navigation flows
- [x] No TypeScript or lint errors across all modified files

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Reverse cross-linking**: Add links from usage detail pages back to the management section (e.g., "Manage this team" button on the team usage page).
- **Tooltip on hover**: Show a brief tooltip like "View usage for March 2026" when hovering over the entity name link.
- **Link from team members panel**: The `TeamMembersPanel` (opened via "Members" button) shows seat holder names — these could also link to individual seat usage pages.
- **Link from department column in seat table**: The department name displayed in the seat table could link to `/usage/departments/<id>`, but `departmentId` is needed (it is available in the `SeatRecord` interface as `departmentId`).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — Phase 1 (3 files modified), Phase 2 (E2E tests created, 3/3 passing), Phase 3 (code review: APPROVED, 0 critical/high/medium issues, 1 low — intentional styling deviation from usage tables, 3 info observations) |
