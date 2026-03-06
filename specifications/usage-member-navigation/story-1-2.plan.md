````markdown
# Department Member Username Navigates to Seat Usage Page - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.2 |
| Title | Department member username navigates to seat usage page |
| Description | Pass `month` and `year` props from `DepartmentDetailPanel` to the reused `TeamMemberTable` component so that department member usernames become clickable links navigating to the seat usage detail page, preserving month/year context. |
| Priority | High |
| Related Research | `specifications/usage-member-navigation/extracted-tasks.md`, `specifications/usage-member-navigation/jira-tasks.md` |

## Proposed Solution

`TeamMemberTable` already supports optional `month` and `year` props (added in Story 1.1). When provided, it wraps every cell in a `<Link>` to `/usage/seats/${seatId}?month=${month}&year=${year}` and applies `hover:bg-gray-50 cursor-pointer` to rows. `DepartmentDetailPanel` already holds `month` and `year` in component state but does **not** pass them to `TeamMemberTable`.

The entire change is a single prop-threading modification: add `month={month} year={year}` to the `<TeamMemberTable>` invocation in `DepartmentDetailPanel`. This instantly enables clickable member navigation in the department detail view with no other code changes required.

```
Navigation flow:

/usage/departments/{deptId}?month=3&year=2026
  → DepartmentDetailPanel (has month=3, year=2026 in state)
    → TeamMemberTable (members, premiumRequestsPerSeat, month=3, year=2026)
      → click "alice-dev" row
        → /usage/seats/{seatId}?month=3&year=2026
```

## Current Implementation Analysis

### Already Implemented
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — already accepts optional `month?: number` and `year?: number` props; when both are provided, renders `<Link>` wrappers on all cells with `hover:bg-gray-50 cursor-pointer` on `<tr>` (implemented in Story 1.1).
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — already has `month` and `year` state; already passes `members` and `premiumRequestsPerSeat` to `TeamMemberTable`.
- Seat detail page (`/usage/seats/[seatId]`) — already handles `month` and `year` query params. No changes needed on the target page.
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — reference pattern for Link-per-cell navigation (used as template for Story 1.1).
- E2E test infrastructure — `e2e/department-usage.spec.ts` — existing test describe block `"Department Usage — Department Detail"` with seed helpers, login, and navigation patterns.
- E2E test reference — `e2e/team-usage.spec.ts` — "clicking a team member row navigates to seat usage page" test (Story 1.1) provides the exact navigation assertion pattern.

### To Be Modified
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — pass `month={month}` and `year={year}` to `<TeamMemberTable>` (line ~240). Currently rendered as: `<TeamMemberTable members={members} premiumRequestsPerSeat={premiumRequestsPerSeat} />`.

### To Be Created
- E2E test case in `e2e/department-usage.spec.ts` — "clicking a department member row navigates to seat usage page" — verifies navigation and URL includes correct seatId, month, year.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Does `TeamMemberTable` already support the required `month`/`year` props? | Yes. Story 1.1 added optional `month?: number` and `year?: number` props. When both are provided, all cells render as `<Link>` elements. When omitted, plain-text rendering is preserved. | ✅ Resolved |
| 2 | Does the target seat detail page handle `month`/`year` query params? | Yes. Already confirmed in Story 1.1 analysis. No changes needed. | ✅ Resolved |
| 3 | Should the full row be clickable in department context? | Yes. The `TeamMemberTable` already handles this: when `month`/`year` are provided, every `<td>` wraps content in `<Link className="block w-full">` and `<tr>` gets `hover:bg-gray-50 cursor-pointer`. This is consistent with `SeatUsageTable` and `TeamUsageTable`. | ✅ Resolved |

## Implementation Plan

### Phase 1: Pass month/year props to TeamMemberTable in DepartmentDetailPanel

#### Task 1.1 - [MODIFY] Pass `month` and `year` from `DepartmentDetailPanel` to `TeamMemberTable`

**Description**: In `DepartmentDetailPanel`, update the `<TeamMemberTable>` invocation to include the component's `month` and `year` state values as props. This is a one-line change that activates the navigation capability already built into `TeamMemberTable` by Story 1.1.

File: `src/components/usage/DepartmentDetailPanel.tsx`

**Definition of Done**:
- [x] `<TeamMemberTable>` in `DepartmentDetailPanel` receives `month={month}` and `year={year}` props
- [x] No TypeScript errors
- [x] Each member username in the department detail member table is rendered as a clickable `<Link>`
- [x] Clicking a member row navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [x] Changing the month filter updates the link URLs in the member table
- [x] Row hover style (`hover:bg-gray-50 cursor-pointer`) is applied to member rows

### Phase 2: E2E Testing

#### Task 2.1 - [CREATE] E2E test: clicking a department member row navigates to seat usage page

**Description**: Add a new test case inside the existing `"Department Usage — Department Detail"` describe block in `e2e/department-usage.spec.ts`. The test should:
1. Seed a department with one member and usage data for the current month.
2. Navigate to the department detail page with `month` and `year` query params.
3. Click the member username link in the member table.
4. Assert the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`.

Follow the existing test pattern from `e2e/team-usage.spec.ts` ("clicking a team member row navigates to seat usage page") and the seed helpers already present in `e2e/department-usage.spec.ts`.

File: `e2e/department-usage.spec.ts`

**Definition of Done**:
- [x] Test is added inside the `"Department Usage — Department Detail"` describe block
- [x] Test seeds a department with at least one member with usage data
- [x] Test navigates to department detail page with `month` and `year` query params
- [x] Test clicks on the member username link within the member table
- [x] Test asserts the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`
- [x] Test follows existing patterns (seed helpers, `loginViaApi`, Playwright locator conventions from `department-usage.spec.ts`)
- [x] Test passes when run against the seeded test database

### Phase 3: Code Review

#### Task 3.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Run the `tsh-code-reviewer` agent against the changed files to verify code quality, consistency with existing patterns, and adherence to project conventions.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer`
- [x] All review findings addressed or documented

## Security Considerations

- **No new security surface**: This change threads existing state values (`month`, `year`) to an already-navigable component. No new API endpoints, data exposure, or input handling is introduced.
- **URL parameters come from trusted sources**: `month` and `year` are numeric state values controlled by the component. `member.seatId` comes from the server API response, not user input.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each GitHub username in the department members table is a clickable link
- [x] Clicking a username navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [x] The current month and year context is preserved in the navigation
- [x] The link is visually consistent with existing clickable elements in usage tables (`SeatUsageTable`, `TeamUsageTable`, `TeamMemberTable` in team context)
- [x] Changing the month filter on the department detail page updates the member table link URLs
- [x] E2E test passes: clicking a department member navigates to seat usage page with correct URL

## Improvements (Out of Scope)

- **Rename `TeamMemberTable` → `MemberUsageTable`**: The component is now shared between team and department detail views but retains a team-specific name. A rename would improve clarity. (Also noted in Story 1.1 plan.)
- **Extract shared `formatCurrency` utility**: Duplicated across multiple components. Extract to `src/lib/format.ts`.
- **Add breadcrumb "back" navigation from seat page to originating department**: When navigating from a department member to a seat page, a "back to department" breadcrumb would improve UX. Out of scope per the extracted tasks.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation completed — Phase 1 (DepartmentDetailPanel prop threading), Phase 2 (E2E test) |
| 2026-03-03 | Code review by `tsh-code-reviewer`: **APPROVED**. No critical, major, or minor findings. Implementation is minimal (1 production line change), follows existing patterns exactly, and E2E test mirrors the Story 1.1 reference test. One outstanding item: E2E test needs to be run against the seeded test database before merge. |

````