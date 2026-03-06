# Department Member Chart Bars Navigate to Seat Usage Page - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.3 |
| Title | Department member chart bars navigate to seat usage page |
| Description | Make each bar in the department member usage chart clickable, navigating to the seat usage detail page for that member while preserving month/year context. The interaction follows the same pattern as the existing `DepartmentUsageChart` bar click behaviour. |
| Priority | High |
| Related Research | `specifications/usage-member-navigation/extracted-tasks.md`, `specifications/usage-member-navigation/jira-tasks.md` |

## Proposed Solution

Add an optional `onBarClick` callback prop to `DepartmentMemberChart` — identical in shape and wiring to `DepartmentUsageChart`'s existing `onBarClick` prop. When provided, the `<Bar>` component receives `cursor="pointer"` and an `onClick` handler that extracts the `seatId` from `sortedMembers[index]` and invokes the callback. When omitted, no pointer or click handler is added — current render-only behaviour is preserved.

`DepartmentDetailPanel` imports `useRouter` from `next/navigation` and wires the callback to `router.push(\`/usage/seats/${seatId}?month=${month}&year=${year}\`)`.

```
Interaction flow:

/usage/departments/{deptId}?month=3&year=2026
  → DepartmentDetailPanel (has month=3, year=2026 in state)
    → DepartmentMemberChart (members, premiumRequestsPerSeat, onBarClick)
      → user clicks bar for "alice-dev" (seatId=42)
        → onBarClick(42)
          → router.push("/usage/seats/42?month=3&year=2026")
```

### Reference pattern — `DepartmentUsageChart`

The `DepartmentUsageChart` component (`src/components/usage/DepartmentUsageChart.tsx`) demonstrates the exact pattern to replicate:

1. **Props**: `onBarClick?: (departmentId: number) => void`
2. **`<Bar>` props**: `cursor={onBarClick ? "pointer" : undefined}` and `onClick={(_data, index) => { if (onBarClick && departments[index]) { onBarClick(departments[index].departmentId) } }}`
3. **Parent wiring** (in `DepartmentUsagePanel`): `onBarClick={(departmentId) => router.push(\`/usage/departments/${departmentId}?month=${month}&year=${year}\`)}`

The only difference is the identifier: `DepartmentUsageChart` passes `departmentId`, while `DepartmentMemberChart` will pass `seatId`.

### Key implementation detail — sorted data index

`DepartmentMemberChart` sorts members by `totalRequests` ASC before rendering (`sortedMembers`). The Recharts `<Bar>` `onClick` callback receives `index` relative to the **rendered** data array, which is `sortedMembers`. Therefore, the click handler must reference `sortedMembers[index].seatId` — not `members[index].seatId`. The reference pattern `DepartmentUsageChart` does not sort its data, so this is a difference to be aware of.

## Current Implementation Analysis

### Already Implemented
- `DepartmentUsageChart` — `src/components/usage/DepartmentUsageChart.tsx` — existing `onBarClick` callback pattern on `<Bar>`. **This is the primary reference pattern.**
- `DepartmentUsagePanel` — `src/components/usage/DepartmentUsagePanel.tsx` — wires `onBarClick` to `router.push()` with month/year query params. Reference for how the parent connects the callback to navigation.
- `DepartmentMemberChart` — `src/components/usage/DepartmentMemberChart.tsx` — renders a horizontal `<BarChart>` of member usage with colour-coded `<Cell>` elements. Accepts `members` and `premiumRequestsPerSeat` props. Does **not** currently have any click handler or pointer cursor.
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — renders `<DepartmentMemberChart>` and `<TeamMemberTable>`. Already holds `month` and `year` state. Does **not** currently import `useRouter`.
- Seat detail page (`/usage/seats/[seatId]`) — already handles `month` and `year` query params. No changes needed on the target page.
- E2E test infrastructure — `e2e/department-usage.spec.ts` — existing `"Department Usage — Department Detail"` describe block with seed helpers, login, and navigation patterns. Includes an existing `"clicking a department member row navigates to seat usage page"` test (Story 1.2) that can be used as a seed/assertion reference.

### To Be Modified
- `DepartmentMemberChart` — `src/components/usage/DepartmentMemberChart.tsx` — add optional `onBarClick?: (seatId: number) => void` prop; add `cursor` and `onClick` to `<Bar>` component.
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — import `useRouter` from `next/navigation`; pass `onBarClick` callback to `<DepartmentMemberChart>` with `router.push()` navigation.

### To Be Created
- E2E test case in `e2e/department-usage.spec.ts` — "clicking a department member chart bar navigates to seat usage page" — verifies navigation via chart bar click.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `onBarClick` be required or optional on `DepartmentMemberChart`? | Optional. This matches the `DepartmentUsageChart` pattern and preserves backward compatibility. When omitted, no cursor or click handler is added. | ✅ Resolved |
| 2 | Does the `onClick` index on `<Bar>` correspond to the sorted or unsorted data array? | Recharts fires `onClick` with the index of the rendered data array. Since `DepartmentMemberChart` sorts members into `sortedMembers` before passing to `<BarChart data={sortedMembers}>`, the index maps to `sortedMembers`, not the original `members` prop. | ✅ Resolved |
| 3 | Is there an existing E2E pattern for testing Recharts bar clicks? | No. There are no existing E2E tests in the project that click on Recharts bar elements. Recharts renders bars as `<rect>` SVG elements inside the chart container. The E2E test will need to locate the chart via its `role="img"` container, find the SVG `rect` elements rendered by Recharts, and click the appropriate one. The text labels on the Y-axis (`githubUsername`) can be used to correlate bars to members. | ✅ Resolved |
| 4 | Does `DepartmentDetailPanel` already use `useRouter`? | No. It currently only uses `useState`, `useEffect`, and component imports. `useRouter` needs to be added. `DepartmentUsagePanel` already imports it — same pattern. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add `onBarClick` support to `DepartmentMemberChart`

#### Task 1.1 - [MODIFY] Add optional `onBarClick` callback prop to `DepartmentMemberChart`

**Description**: Extend the `DepartmentMemberChartProps` interface with an optional `onBarClick?: (seatId: number) => void` property. When provided, add `cursor="pointer"` and an `onClick` handler to the `<Bar>` component. The handler extracts the `seatId` from `sortedMembers[index]` and invokes the callback. When `onBarClick` is not provided, no cursor or click handler is added (current behaviour preserved).

File: `src/components/usage/DepartmentMemberChart.tsx`

**Definition of Done**:
- [x] `DepartmentMemberChartProps` interface includes `onBarClick?: (seatId: number) => void`
- [x] `onBarClick` is destructured from props
- [x] `<Bar>` component has `cursor={onBarClick ? "pointer" : undefined}`
- [x] `<Bar>` component has `onClick={(_data: unknown, index: number) => { if (onBarClick && sortedMembers[index]) { onBarClick(sortedMembers[index].seatId) } }}`
- [x] When `onBarClick` is omitted: chart renders exactly as before — no cursor change, no click handler
- [x] Pattern matches `DepartmentUsageChart` exactly (same prop name, same cursor/onClick pattern, same guard condition)
- [x] No TypeScript errors

#### Task 1.2 - [MODIFY] Wire `onBarClick` in `DepartmentDetailPanel` with `router.push()`

**Description**: In `DepartmentDetailPanel`, import `useRouter` from `next/navigation`. Call `const router = useRouter()` inside the component. Pass an `onBarClick` callback to `<DepartmentMemberChart>` that calls `router.push(\`/usage/seats/${seatId}?month=${month}&year=${year}\`)`. This mirrors exactly how `DepartmentUsagePanel` wires `DepartmentUsageChart`'s `onBarClick`.

File: `src/components/usage/DepartmentDetailPanel.tsx`

**Definition of Done**:
- [x] `useRouter` imported from `next/navigation`
- [x] `const router = useRouter()` called inside the component function
- [x] `<DepartmentMemberChart>` receives `onBarClick={(seatId) => router.push(\`/usage/seats/${seatId}?month=${month}&year=${year}\`)}`
- [x] Clicking a bar in the member chart navigates to the correct seat usage page with month/year query params
- [x] No TypeScript errors

### Phase 2: E2E Testing

#### Task 2.1 - [CREATE] E2E test: clicking a department member chart bar navigates to seat usage page

**Description**: Add a new test case inside the existing `"Department Usage — Department Detail"` describe block in `e2e/department-usage.spec.ts`. The test should:
1. Seed a department with one member and usage data for the current month.
2. Navigate to the department detail page with `month` and `year` query params.
3. Locate the chart container via `getByRole("img", { name: /department member usage chart/i })`.
4. Click the Recharts bar `<rect>` element inside the chart SVG.
5. Assert the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`.

Recharts renders each bar as an SVG `<rect>` element inside a `.recharts-bar-rectangle` group. The test should locate the clickable rectangle within the chart container and click it.

Follow the existing test patterns (use `seedDashboardSummary`, `seedDepartment`, `seedSeat`, `seedUsage`, `loginViaApi`, `makeUsageItem`).

File: `e2e/department-usage.spec.ts`

**Definition of Done**:
- [ ] Test is added inside the `"Department Usage — Department Detail"` describe block
- [ ] Test seeds a department with one member with usage data
- [ ] Test navigates to department detail page with `month` and `year` query params
- [ ] Test clicks on a bar element within the department member chart
- [ ] Test asserts the URL matches `/usage/seats/${seatId}?month=${currentMonth}&year=${currentYear}`
- [ ] Test follows existing patterns (seed helpers, `loginViaApi`, Playwright locator conventions from `department-usage.spec.ts`)
- [ ] Test passes when run against the seeded test database

### Phase 3: Code Review

#### Task 3.1 — [REUSE] Code review by `tsh-code-reviewer` agent

**Description**: Run the `tsh-code-reviewer` agent against the changed files to verify code quality, consistency with existing patterns, and adherence to project conventions.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer`
- [x] All review findings addressed or documented

## Security Considerations

- **No new security surface**: This change adds a client-side click handler on an existing chart component that triggers `router.push()` navigation between existing authenticated pages. No new API endpoints, data exposure, or input handling is introduced.
- **URL construction uses `seatId` from trusted API response**: The `member.seatId` comes from the server API response (not user input), mitigating URL injection risk. `month` and `year` are numeric state values controlled by the component.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each bar in the department member chart is clickable
- [x] Clicking a bar navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [x] The cursor changes to a pointer when hovering over a bar (visual affordance)
- [x] The current month and year context is preserved in the navigation
- [x] The clickable behaviour follows the same pattern as the existing department usage chart (`DepartmentUsageChart`)
- [x] When `onBarClick` is omitted from `DepartmentMemberChart`, chart renders without click behaviour (backward compatibility)
- [x] E2E test passes: clicking a department member chart bar navigates to seat usage page with correct URL

## Improvements (Out of Scope)

- **Extract shared bar click pattern**: Both `DepartmentUsageChart` and `DepartmentMemberChart` now implement the same `onBarClick` callback pattern with identical `cursor` and `onClick` wiring. A shared higher-order component or custom hook (`useBarClickNavigation`) could reduce duplication if more charts adopt this pattern.
- **Extract shared `getBarColor` utility**: The bar colour logic (red/orange/green at threshold values) is duplicated across `DepartmentUsageChart`, `DepartmentMemberChart`, and `TeamMemberTable`. Extract to `src/lib/usage-colours.ts`.
- **Add tooltip hint on hover**: When bars are clickable, update the Recharts `<Tooltip>` to include a "Click to view details" hint, improving discoverability of the navigation feature.
- **Keyboard accessibility for chart bars**: Recharts SVG bars are not keyboard-focusable. Adding keyboard navigation (Tab + Enter to activate bar click) would improve accessibility. This is a broader concern affecting `DepartmentUsageChart` as well.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation completed — Phase 1 (DepartmentMemberChart `onBarClick` prop + DepartmentDetailPanel wiring), Phase 2 (E2E test). Note: plan referenced `<rect>` elements but Recharts renders `<path>` — E2E test adapted accordingly. |
| 2026-03-03 | Code review by `tsh-code-reviewer`: **APPROVED**. No critical, major, or minor findings. 2 nits: (1) E2E CSS class selector for chart bars is the only viable approach since Recharts SVG elements lack ARIA roles; (2) plan Task 2.1 description mentions `<rect>` but actual DOM uses `<path>` — cosmetic doc deviation. All acceptance criteria verified met. |
