# Story 3.3: User can view list of Copilot seats — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 3.3 |
| Title | User can view list of Copilot seats |
| Description | Provide a browsable seat directory that displays all Copilot seats with their GitHub username, status (active/unused), first name, last name, and department. The list is accessible from the main navigation, supports server-side pagination for large datasets, and shows an informative empty state when no seats have been synced yet. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/story-3-1.plan.md`, `specifications/copilot-usage-dashboard/story-3-2.plan.md` |

## Proposed Solution

Implement a full-stack seat directory feature with three layers: a **paginated API endpoint** for querying seats from the database, a **Next.js page** under the authenticated app layout, and a **client component** for displaying the seat table with pagination controls and an empty state.

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Next.js App                                      │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  NavBar (MODIFIED)                                                      │  │
│  │  [Dashboard] [Seats ← NEW] [Users] [Settings] [Sign out]               │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  GET /seats  (Server Component Page)                                    │  │
│  │  └─ Renders <SeatListPanel />                                          │  │
│  └─────────────────────────────────────────────┬───────────────────────────┘  │
│                                                 │                              │
│  ┌─────────────────────────────────────────────┐│                              │
│  │  SeatListPanel (Client Component)           ││                              │
│  │  - Fetches GET /api/seats?page=N&pageSize=M ││                              │
│  │  - Renders seat table                       ││                              │
│  │  - Pagination controls (Prev / Next)        ││                              │
│  │  - Empty state when no seats exist          ││                              │
│  │  - Loading state                            ││                              │
│  │  - Error state                              ││                              │
│  └─────────────────────────────────────────────┘│                              │
│                                                 │                              │
│  ┌─────────────────────────────────────────────┐│                              │
│  │  GET /api/seats (API Route)                 ││                              │
│  │  Auth-guarded                               ││                              │
│  │  Query: ?page=1&pageSize=20&status=active   ││                              │
│  │                                             ││                              │
│  │  Response:                                  ││                              │
│  │  {                                          ││                              │
│  │    seats: SeatRecord[],                     ││                              │
│  │    total, page, pageSize, totalPages        ││                              │
│  │  }                                          ││                              │
│  └─────────────────────────────────┬───────────┘│                              │
│                                     │            │                              │
│                                     ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL                                                             │  │
│  │  ┌──────────────┐                                                       │  │
│  │  │ copilot_seat │  ← SELECT with ORDER BY, LIMIT, OFFSET              │  │
│  │  │ (existing)   │                                                       │  │
│  │  └──────────────┘                                                       │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Server-side pagination**: The API endpoint uses `LIMIT` / `OFFSET` pagination with TypeORM's `findAndCount()`. This is appropriate for the expected dataset size (tens to low-thousands of seats) and matches the simplicity of the existing codebase. No cursor-based pagination is needed.

2. **Default page size of 20**: Balances usability (table is not overwhelming) with network efficiency. The page size is configurable via query parameter but capped at 100 to prevent abuse.

3. **Sorting by `githubUsername ASC`**: Provides a stable, predictable default ordering. The GitHub username is the natural identifier for seats and alphabetical sorting is intuitive.

4. **Optional `status` query filter**: Allows filtering by `active` or `inactive` status. This is additive and not required by the acceptance criteria, but it directly supports the "status is clearly visible" requirement and is trivial to implement. If no filter is provided, all seats are returned.

5. **Client-side SeatListPanel component**: Follows the established pattern used by `UserManagementPanel` — a `"use client"` component that fetches data via the API, manages loading/error/empty states, and renders a table. This enables interactive pagination without full page reloads.

6. **Navigation placement**: The "Seats" link is added between "Dashboard" and "Users" in the NavBar, reflecting the data hierarchy (configuration → seats → users → settings).

7. **Status display as badge**: Active/Inactive status is displayed as a coloured badge (green for active, gray for inactive), consistent with the `StatusBadge` pattern already used in `JobStatusPanel`.

8. **Empty state design**: When no seats have been synced, a clear message instructs the user that seats will appear after the first sync runs, with context about the sync process. This avoids confusion for new installations.

9. **No SSR data fetching for the seat list**: The seat list is fetched client-side by `SeatListPanel` to keep the pattern consistent with the existing `UserManagementPanel`. This simplifies pagination state management and avoids hydration complexity.

### API Contracts

**GET /api/seats** (seat list with pagination)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 20 | Results per page (max 100) |
| `status` | string | — | Optional filter: `active` or `inactive` |

| Status | Body |
|--------|------|
| 200 | `{ seats: SeatRecord[], total: number, page: number, pageSize: number, totalPages: number }` |
| 401 | `{ error: "Authentication required" }` |

**SeatRecord shape:**
```json
{
  "id": 1,
  "githubUsername": "octocat",
  "status": "active",
  "firstName": "Octo",
  "lastName": "Cat",
  "department": "Engineering",
  "lastActivityAt": "2024-06-15T12:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-seat.entity.ts` — `CopilotSeat` interface and `CopilotSeatEntity` with all required fields (`githubUsername`, `status`, `firstName`, `lastName`, `department`) and index on `status`
- `src/entities/enums.ts` — `SeatStatus` enum with `ACTIVE` and `INACTIVE` values
- `src/lib/db.ts` — `getDb()` database connection singleton — reused in the new API route
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused to protect the new API endpoint
- `src/app/(app)/layout.tsx` — App layout with auth + config guards and NavBar — already protects all app routes including the new seats page
- `src/components/NavBar.tsx` — Navigation component with nav links array — to be extended
- `src/test/db-helpers.ts` — `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()` with `CopilotSeatEntity` already registered — fully reusable for tests
- `e2e/helpers/auth.ts` — `seedTestUser()`, `loginViaApi()`, `clearAuthData()` — reused for E2E test setup
- `src/components/settings/JobStatusPanel.tsx` — `StatusBadge` pattern for rendering status (reference for consistent styling)

### To Be Modified
- `src/components/NavBar.tsx` — Add `{ href: "/seats", label: "Seats" }` to the `navLinks` array between "Dashboard" and "Users"

### To Be Created
- `src/app/api/seats/route.ts` — `GET` endpoint for paginated seat listing with optional status filter
- `src/app/(app)/seats/page.tsx` — Server component page for the seat list, renders `SeatListPanel`
- `src/components/seats/SeatListPanel.tsx` — Client component displaying the seat table with pagination controls, loading/error/empty states
- `src/app/api/seats/__tests__/route.test.ts` — Integration tests for the seats API endpoint
- `e2e/seat-list.spec.ts` — E2E tests for the seat list feature

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the seat list support search/filtering by username? | Not required by acceptance criteria. Status filter is included as a lightweight addition. Search can be added as a future enhancement. | ✅ Resolved |
| 2 | Should pagination use cursor-based or offset-based approach? | Offset-based (`page` + `pageSize`) is appropriate for the expected dataset size and consistent with table-based UI. Cursor-based pagination adds complexity without benefit for this use case. | ✅ Resolved |
| 3 | Should the API return all CopilotSeat fields or a subset? | A subset — `id`, `githubUsername`, `status`, `firstName`, `lastName`, `department`, `lastActivityAt`, `createdAt`. Fields like `githubUserId`, `assignedAt`, `lastActivityEditor`, `planType`, `updatedAt` are omitted from the list view as they are not required by the acceptance criteria. | ✅ Resolved |
| 4 | How should the "Seats" nav item be positioned? | Between "Dashboard" and "Users" — this reflects the data hierarchy: overview → seat data → user management → settings. | ✅ Resolved |
| 5 | What should the empty state message say? | "No seats have been synced yet. Seats will appear here after the first sync completes. You can trigger a sync from the Settings page." This provides actionable guidance. | ✅ Resolved |

## Implementation Plan

### Phase 1: API Endpoint

#### Task 1.1 - [CREATE] Seats API route `src/app/api/seats/route.ts`
**Description**: Create a `GET` endpoint that returns a paginated list of Copilot seats from the database. The endpoint is auth-guarded, accepts `page`, `pageSize`, and optional `status` query parameters, and returns the seat list with pagination metadata. Query parameters are validated and clamped to safe ranges (`page` >= 1, `pageSize` 1–100).

**Definition of Done**:
- [x] File `src/app/api/seats/route.ts` exports a `GET` handler
- [x] Endpoint is auth-guarded using `requireAuth()` / `isAuthFailure()` pattern
- [x] Accepts query parameters: `page` (default 1), `pageSize` (default 20), `status` (optional, `active` or `inactive`)
- [x] Invalid `page` or `pageSize` values are clamped (not rejected) — `page` minimum 1, `pageSize` clamped to 1–100
- [x] Uses TypeORM `findAndCount()` on `CopilotSeatEntity` with `skip`, `take`, `order`, and optional `where` clause
- [x] Orders results by `githubUsername ASC`
- [x] Returns 200 with shape: `{ seats: SeatRecord[], total, page, pageSize, totalPages }`
- [x] Each `SeatRecord` contains: `id`, `githubUsername`, `status`, `firstName`, `lastName`, `department`, `lastActivityAt`, `createdAt`
- [x] Returns 401 for unauthenticated requests
- [x] Returns 500 with generic error message for unexpected errors (error logged to console)
- [x] File compiles without TypeScript errors

### Phase 2: Navigation Update

#### Task 2.1 - [MODIFY] Add "Seats" link to NavBar `src/components/NavBar.tsx`
**Description**: Add a new navigation link for the seats page to the `navLinks` array in the `NavBar` component. The link should appear between "Dashboard" and "Users".

**Definition of Done**:
- [x] `navLinks` array includes `{ href: "/seats", label: "Seats" }` at index 1 (between Dashboard and Users)
- [x] Active state highlighting works correctly when on `/seats`
- [x] File compiles without TypeScript errors

### Phase 3: Frontend — Seat List Page and Component

#### Task 3.1 - [CREATE] Seats page `src/app/(app)/seats/page.tsx`
**Description**: Create the server component page for the seat list. Follows the established pattern from the Users page (`src/app/(app)/users/page.tsx`) — a page shell with a heading, description, and the `SeatListPanel` client component.

**Definition of Done**:
- [x] File `src/app/(app)/seats/page.tsx` exists and exports a default component
- [x] Page metadata title is set to `"Seats — Copilot Dashboard"`
- [x] Page has `dynamic = "force-dynamic"` export (matching existing page pattern)
- [x] Renders a `<main>` with heading "Copilot Seats", description text, and the `<SeatListPanel />` component
- [x] Layout matches existing pages (max-w-5xl container, consistent spacing)
- [x] Page is accessible via `/seats` route (by virtue of Next.js file-based routing under the `(app)` layout group)
- [x] File compiles without TypeScript errors

#### Task 3.2 - [CREATE] SeatListPanel component `src/components/seats/SeatListPanel.tsx`
**Description**: Create a `"use client"` component that fetches the paginated seat list from `GET /api/seats` and renders a table with pagination controls. Includes loading, error, and empty states. Follows the established patterns from `UserManagementPanel` for data fetching and state management.

**Definition of Done**:
- [x] File `src/components/seats/SeatListPanel.tsx` exports a default client component
- [x] Component fetches data from `GET /api/seats?page={page}&pageSize={pageSize}` on mount and page changes
- [x] Loading state: displays a loading indicator while data is being fetched
- [x] Error state: displays an error message with a "Try again" button when the fetch fails
- [x] Empty state: when `total === 0`, displays an informative message: "No seats have been synced yet. Seats will appear here after the first sync completes. You can trigger a sync from the Settings page."
- [x] Data state: renders a `<table>` with columns: GitHub Username, Status, First Name, Last Name, Department, Last Active
- [x] Status column displays a coloured badge — green for "Active", gray for "Inactive" (consistent with `StatusBadge` in `JobStatusPanel`)
- [x] `lastActivityAt` is formatted as a relative time string (e.g., "3 days ago") with a full timestamp tooltip
- [x] Null enrichment fields (`firstName`, `lastName`, `department`) display as "—" (em dash)
- [x] Null `lastActivityAt` displays as "Never"
- [x] Pagination controls at the bottom: "Previous" and "Next" buttons with page indicator ("Page X of Y")
- [x] "Previous" button is disabled on page 1
- [x] "Next" button is disabled on the last page
- [x] Total seat count is displayed (e.g., "Showing 1–20 of 150 seats")
- [x] Table uses accessible `<th scope="col">` headers and `aria-label` on the table
- [x] Component uses `max-w-5xl` container to accommodate the wider table (seats have more columns than the user table)
- [x] File compiles without TypeScript errors

### Phase 4: Integration Tests

#### Task 4.1 - [CREATE] API route tests `src/app/api/seats/__tests__/route.test.ts`
**Description**: Create integration tests for the `GET /api/seats` endpoint. Tests use the existing test database infrastructure pattern (mock `@/lib/db`, mock `next/headers` for session cookies, seed data directly in the test database).

**Definition of Done**:
- [x] Test: returns 401 without session cookie
- [x] Test: returns 200 with empty seats array and `total: 0` when no seats exist
- [x] Test: returns 200 with seeded seats including correct fields (`id`, `githubUsername`, `status`, `firstName`, `lastName`, `department`, `lastActivityAt`, `createdAt`)
- [x] Test: does NOT return sensitive/internal fields (`githubUserId`, `assignedAt`, `lastActivityEditor`, `planType`, `updatedAt`)
- [x] Test: pagination defaults — page 1, pageSize 20 when no query params provided
- [x] Test: respects custom `page` and `pageSize` query parameters — seed 5 seats, request page=2 with pageSize=2, verify 2 seats returned with correct page metadata
- [x] Test: returns correct `totalPages` calculation (e.g., 5 total seats with pageSize=2 → totalPages=3)
- [x] Test: filters by `status=active` — seed both active and inactive seats, verify only active seats returned
- [x] Test: filters by `status=inactive` — seed both active and inactive seats, verify only inactive seats returned
- [x] Test: returns all seats when no status filter is provided
- [x] Test: clamps page below 1 to page 1
- [x] Test: clamps pageSize above 100 to 100
- [x] Test: orders results by githubUsername ASC
- [x] All tests pass
- [x] Database cleaned between tests for isolation
- [x] Follows the established test pattern from `src/app/api/users/__tests__/route.test.ts` (mock setup, session seeding, request construction)

### Phase 5: E2E Tests

#### Task 5.1 - [CREATE] E2E tests for seat list `e2e/seat-list.spec.ts`
**Description**: Create Playwright E2E tests that verify the seat list page is accessible, displays seat data correctly, handles pagination, and shows the empty state. Tests follow the established patterns from `e2e/user-management.spec.ts` (direct DB seeding, login via API, shared cleanup).

**Definition of Done**:
- [x] Test: user navigates to `/seats` and sees the heading "Copilot Seats"
- [x] Test: "Seats" navigation link is visible in the nav bar and navigates to `/seats`
- [x] Test: empty state is displayed when no seats exist — message about syncing is visible
- [x] Test: seat table displays seeded seat data — seed 2-3 seats directly in the database, verify GitHub usernames, status badges, first name, last name, and department are visible
- [x] Test: pagination controls work — seed enough seats (e.g., 25) to trigger multi-page display, verify "Next" navigates to page 2 and "Previous" returns to page 1
- [x] Test: inactive seat is displayed with correct status badge
- [x] All tests set up and tear down test data correctly (configuration + auth + seat records)
- [x] Tests pass in isolation and do not interfere with other test files

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All new and modified source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (TypeORM EntitySchema pattern, TypeScript strict mode, existing test patterns, Tailwind CSS styling)
- [x] Test coverage is adequate for the feature scope
- [x] Accessibility requirements met (semantic HTML, ARIA labels, keyboard navigation for pagination)

## Security Considerations

- **Authentication enforced on API route**: The `GET /api/seats` endpoint uses the existing `requireAuth()` / `isAuthFailure()` pattern. Unauthenticated requests receive a 401 response. No seat data is leaked to unauthenticated users.
- **No new write operations**: This story only introduces a read-only `GET` endpoint. No mutation of seat data occurs, reducing the attack surface.
- **Query parameter validation**: `page` and `pageSize` parameters are parsed as numbers and clamped to safe ranges. Invalid values are coerced, not rejected, preventing unexpected error responses. The `status` filter is validated against the `SeatStatus` enum values only.
- **No sensitive data in response**: The API response excludes internal fields (`githubUserId`, `assignedAt`, `lastActivityEditor`, `planType`) that are not needed by the UI. Only user-visible fields are returned.
- **Pagination limits**: `pageSize` is capped at 100 to prevent clients from requesting unbounded result sets that could cause memory or performance issues.
- **SQL injection protection**: All database queries use TypeORM's parameterised query builder / repository methods. No raw SQL is constructed with user input.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Seat list displays GitHub username, status (active/unused), first name, last name, and department for each seat (verified by integration test: seed seats with all fields, verify API response contains them; verified by E2E test: seat data visible in the table)
- [x] Seat list is accessible from the main navigation (verified by E2E test: "Seats" link visible in NavBar and navigates to `/seats`)
- [x] List supports pagination for large numbers of seats (verified by integration test: pagination metadata is correct; verified by E2E test: pagination controls navigate between pages)
- [x] An informative empty state is shown when no seats have been synced yet (verified by E2E test: empty state message visible when no seats exist)
- [x] Status is displayed as a coloured badge (active=green, inactive=gray) — consistent with existing `StatusBadge` pattern
- [x] Null enrichment fields display gracefully as "—" (em dash)
- [x] All new integration tests pass
- [x] All new E2E tests pass
- [x] All existing tests continue to pass (no regressions)
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Search/filter by username**: Add a text search input to filter seats by GitHub username. Not required by current acceptance criteria but useful for large organisations.
- **Sorting by column**: Allow clicking table headers to sort by different columns (status, department, last activity). Currently fixed to `githubUsername ASC`.
- **Export to CSV**: Allow downloading the seat list as a CSV file for reporting purposes.
- **Status filter UI**: Add filter buttons/dropdown in the UI to filter by active/inactive status. The API already supports the `status` query parameter — only the UI component is needed.
- **Responsive table design**: For mobile viewports, consider a card-based layout instead of a table. The current design targets desktop usage.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed — all 6 phases done. 145 unit/integration tests pass (13 new), 6 E2E tests pass. Code review: APPROVED with minor observations (M-01: formatRelativeTime duplication, M-02: no month/year handling in relative time). No critical or high-severity issues. |
