# Team Member Username Navigates to Seat Usage Page - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.1 |
| Title | Team member username navigates to seat usage page |
| Description | Make team member usernames in the team detail table clickable, navigating to the seat usage detail page while preserving month/year context. The full table row should be clickable, following existing table navigation patterns (SeatUsageTable, TeamUsageTable). |
| Priority | High |
| Related Research | `specifications/usage-member-navigation/extracted-tasks.md`, `specifications/usage-member-navigation/jira-tasks.md` |

## Proposed Solution

Add `month` and `year` as **optional** props to `TeamMemberTable`. When provided, wrap every cell's content in a Next.js `<Link>` pointing to `/usage/seats/${member.seatId}?month=${month}&year=${year}` and add `hover:bg-gray-50 cursor-pointer` to the `<tr>`. When omitted, render as plain text (current behaviour) — this preserves backward compatibility with `DepartmentDetailPanel` until Story 1.2 passes the props.

Update `TeamDetailPanel` to pass its current `month` and `year` state to `TeamMemberTable`.

```
Navigation flow:

/usage/teams/{teamId}?month=3&year=2026
  → TeamDetailPanel (has month=3, year=2026 in state)
    → TeamMemberTable (members, premiumRequestsPerSeat, month=3, year=2026)
      → click "alice-dev" row
        → /usage/seats/{seatId}?month=3&year=2026
```

The pattern replicates exactly what `SeatUsageTable` and `TeamUsageTable` already do: each `<td>` wraps its content in a `<Link className="block w-full">`, and the `<tr>` gets `hover:bg-gray-50 cursor-pointer`.

## Current Implementation Analysis

### Already Implemented
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — accepts `month` and `year` props, wraps every cell in `<Link href="/usage/seats/${seatId}?month=${month}&year=${year}">`, row has `hover:bg-gray-50 cursor-pointer`. This is the **primary reference pattern**.
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — identical Link-per-cell pattern for team overview rows navigating to team detail.
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — identical Link-per-cell pattern for department overview rows.
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — already has `month` and `year` state; currently passes `members` and `premiumRequestsPerSeat` to `TeamMemberTable`.
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — already used in `TeamMemberTable` for colour-coded usage indicators.
- `calcUsagePercent` — `src/lib/usage-helpers.ts` — already used in `TeamMemberTable` for percentage calculation.
- E2E test infrastructure — `e2e/team-usage.spec.ts` — existing test describe blocks for "Team Usage — Team Detail" with seed helpers, login, and navigation patterns.

### To Be Modified
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — add optional `month` and `year` props to interface; import `Link` from `next/link`; wrap each `<td>` content in `<Link>` when month/year are present; add `hover:bg-gray-50 cursor-pointer` to `<tr>` when navigable.
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — pass `month` and `year` to `<TeamMemberTable>`.

### To Be Created
- E2E test case in `e2e/team-usage.spec.ts` — "clicking a team member row navigates to seat usage page" — verifies navigation and URL includes correct seatId, month, year.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `month`/`year` props be required or optional on `TeamMemberTable`? | Optional. This preserves backward compatibility with `DepartmentDetailPanel` (which doesn't pass them until Story 1.2). When omitted, links are not rendered — current plain-text behaviour is preserved. | ✅ Resolved |
| 2 | Should the entire row be clickable or only the username cell? | The entire row should be clickable (AC: "The full table row is clickable"). This matches the existing patterns in `SeatUsageTable` and `TeamUsageTable` where every cell wraps its content in a `<Link className="block w-full">`. | ✅ Resolved |
| 3 | Does the target seat detail page (`/usage/seats/[seatId]`) already handle `month`/`year` query params? | Yes. The seat detail page already parses `month` and `year` from searchParams and passes them to `SeatDetailPanel`. No changes needed. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add navigation support to TeamMemberTable

#### Task 1.1 - [MODIFY] Add optional `month` and `year` props to `TeamMemberTable`

**Description**: Extend the `TeamMemberTableProps` interface with optional `month?: number` and `year?: number` properties. Import `Link` from `next/link`. When both `month` and `year` are provided, compute a boolean `navigable` flag. Use this flag to conditionally:
1. Add `hover:bg-gray-50 cursor-pointer` classes to each `<tr>`.
2. Wrap the content of every `<td>` in a `<Link href="/usage/seats/${member.seatId}?month=${month}&year=${year}" className="block w-full">`.

When `navigable` is `false`, render current plain-text behaviour unchanged.

File: `src/components/usage/TeamMemberTable.tsx`

**Definition of Done**:
- [x] `TeamMemberTableProps` interface includes `month?: number` and `year?: number`
- [x] `Link` imported from `next/link`
- [x] When `month` and `year` are provided: each `<tr>` has `hover:bg-gray-50 cursor-pointer` classes
- [x] When `month` and `year` are provided: all four `<td>` cells wrap content in `<Link href="/usage/seats/${member.seatId}?month=${month}&year=${year}" className="block w-full">`
- [x] When `month` or `year` is omitted: table renders as plain text (no Link, no hover/cursor styles) — no visual regression
- [x] Link pattern matches `SeatUsageTable` exactly (same `className="block w-full"` on Link, same `hover:bg-gray-50 cursor-pointer` on `<tr>`)
- [x] No TypeScript errors

#### Task 1.2 - [MODIFY] Pass `month` and `year` from `TeamDetailPanel` to `TeamMemberTable`

**Description**: In `TeamDetailPanel`, update the `<TeamMemberTable>` invocation to pass the component's `month` and `year` state values as props.

File: `src/components/usage/TeamDetailPanel.tsx`

**Definition of Done**:
- [x] `<TeamMemberTable>` in `TeamDetailPanel` receives `month={month}` and `year={year}` props
- [x] No TypeScript errors
- [x] Changing the month filter on the team detail page updates the URLs in the member table links

### Phase 2: E2E Testing

#### Task 2.1 - [CREATE] E2E test: clicking a team member row navigates to seat usage page

**Description**: Add a new test case inside the existing `"Team Usage — Team Detail"` describe block in `e2e/team-usage.spec.ts`. The test should:
1. Seed a team with one member and usage data for the current month.
2. Navigate to the team detail page.
3. Click the member username link in the member table.
4. Assert the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`.

Follow the existing test patterns (use `seedSeat`, `seedTeam`, `seedMemberSnapshot`, `seedUsage`, `loginViaApi`, `makeUsageItem`).

File: `e2e/team-usage.spec.ts`

**Definition of Done**:
- [x] Test is added inside the `"Team Usage — Team Detail"` describe block
- [x] Test seeds a team with at least one member with usage data
- [x] Test navigates to team detail page with `month` and `year` query params
- [x] Test clicks on the member username link within the member table
- [x] Test asserts the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`
- [x] Test follows existing patterns (seed helpers, `loginViaApi`, Playwright locator conventions)
- [ ] Test passes when run against the seeded test database

### Phase 3: Code Review

#### Task 3.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Run the `tsh-code-reviewer` agent against the changed files to verify code quality, consistency with existing patterns, and adherence to project conventions.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer`
- [x] All review findings addressed or documented

## Security Considerations

- **No new security surface**: This change adds client-side navigation links between existing authenticated pages. No new API endpoints, data exposure, or input handling is introduced.
- **URL construction uses seatId from trusted API response**: The `member.seatId` comes from the server API response (not user input), mitigating URL injection risk. `month` and `year` are numeric state values controlled by the component.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each GitHub username in the team members table is a clickable link
- [x] Clicking a username navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [x] The current month and year context is preserved in the navigation
- [x] The link is visually consistent with existing clickable elements in usage tables (`SeatUsageTable`, `TeamUsageTable`)
- [x] The full table row is clickable (consistent with existing table navigation patterns)
- [x] `DepartmentDetailPanel` continues to render `TeamMemberTable` without errors (backward compatibility — no month/year passed yet)
- [x] E2E test passes: clicking a team member navigates to seat usage page with correct URL

## Improvements (Out of Scope)

- **Rename `TeamMemberTable` → `MemberUsageTable`**: The component is generic and shared between team and department detail views but has a team-specific name. A rename would improve clarity. (Previously noted in Story 6.3 and Story 1.2 plan.)
- **Extract shared `formatCurrency` utility**: `formatCurrency` is duplicated across `TeamMemberTable`, `SeatUsageTable`, `TeamUsageTable`, `TeamDetailPanel`, and other components. Extract to `src/lib/format.ts`.
- **Add breadcrumb "back" navigation from seat page to originating team/department**: When navigating from a team member to a seat page, a "back to team" breadcrumb would improve UX. Out of scope per the extracted tasks.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation completed — Phase 1 (TeamMemberTable + TeamDetailPanel), Phase 2 (E2E test) |
| 2026-03-03 | Code review by `tsh-code-reviewer`: **ACCEPTED**. No critical/major findings. 2 nits noted (pre-existing, out of scope): missing `aria-label` on `<table>` and clickable area not covering full `<td>` padding — both consistent with `SeatUsageTable` reference pattern. 1 positive observation: pre-computed `href` variable reduces repetition vs reference pattern. |
