# Usage Member Navigation — Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Date | 2026-03-03 |
| Source | Direct requirements (no transcript) |
| Total Epics | 1 |
| Total Stories | 3 |
| Open Questions | 0 |

---

## Epics Overview

| # | Epic | Stories | Priority |
|---|---|---|---|
| 1 | Cross-Linking Member Navigation in Usage Pages | 3 | High |

---

## Epic 1: Cross-Linking Member Navigation in Usage Pages

**Description**: Enable users to navigate directly from team and department usage detail views to individual seat usage pages. Currently, member usernames in team and department detail tables are plain text, and the department member chart bars are not interactive. This epic adds clickable navigation to these elements, consistent with existing patterns (e.g., seat usage table already links usernames to seat detail, and department usage chart bars already navigate to department detail).

**Success Criteria**:
- Users can click on any member username in team or department detail views to navigate to that member's seat usage page
- Users can click on chart bars in the department member chart to navigate to the corresponding seat usage page
- Navigation preserves the current month/year context across page transitions

**Priority**: High

---

### Story 1.1: Team member username navigates to seat usage page

**User Story**: As a manager, I want to click on a team member's GitHub username in the team usage detail table so that I can quickly view that member's individual seat usage breakdown without manually searching for them.

**Acceptance Criteria**:
- [ ] Each GitHub username in the team members table is a clickable link
- [ ] Clicking a username navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [ ] The current month and year context is preserved in the navigation
- [ ] The link is visually consistent with existing clickable elements in usage tables (e.g., seat usage table)
- [ ] The full table row is clickable (consistent with existing table navigation patterns)

**Dependencies**: None

**Priority**: High

**High-level technical notes**: The `TeamMemberTable` component currently renders usernames as plain text. It needs to accept `month` and `year` props and wrap cells with `Link` components, following the same pattern used in `SeatUsageTable`.

---

### Story 1.2: Department member username navigates to seat usage page

**User Story**: As a manager, I want to click on a department member's GitHub username in the department usage detail table so that I can view that member's individual seat usage without leaving the department context.

**Acceptance Criteria**:
- [ ] Each GitHub username in the department members table is a clickable link
- [ ] Clicking a username navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [ ] The current month and year context is preserved in the navigation
- [ ] The link is visually consistent with existing clickable elements in usage tables

**Dependencies**: Story 1.1 (same underlying component — `TeamMemberTable` is reused in the department detail panel)

**Priority**: High

**High-level technical notes**: The department detail page reuses `TeamMemberTable`. Once Story 1.1 adds navigation to that component, the department detail page also needs to pass `month` and `year` props to enable the links.

---

### Story 1.3: Department member chart bars navigate to seat usage page

**User Story**: As a manager, I want to click on a bar in the department member usage chart so that I can navigate directly to that member's seat usage page, the same way I can click department bars in the departments overview chart.

**Acceptance Criteria**:
- [ ] Each bar in the department member chart is clickable
- [ ] Clicking a bar navigates to `/usage/seats/{seatId}?month={month}&year={year}`
- [ ] The cursor changes to a pointer when hovering over a bar (visual affordance)
- [ ] The current month and year context is preserved in the navigation
- [ ] The clickable behaviour follows the same pattern as the existing department usage chart

**Dependencies**: None

**Priority**: High

**High-level technical notes**: The `DepartmentMemberChart` component needs an `onBarClick` callback prop (same pattern as `DepartmentUsageChart`), and the `DepartmentDetailPanel` needs to wire it up with `router.push()`.

---

## Dependencies

| Dependency | From | To | Type |
|---|---|---|---|
| Same component | Story 1.2 | Story 1.1 | Blocked by |

*Story 1.1 and 1.2 share the same `TeamMemberTable` component. Story 1.1 adds the navigation capability; Story 1.2 ensures the department context passes the required props.*

---

## Assumptions

1. The seat usage detail page (`/usage/seats/[seatId]`) already exists and fully supports the `month` and `year` query parameters — no changes needed on the target page.
2. The existing navigation patterns (Link-wrapped table rows, onBarClick chart callbacks) are the intended UX approach — no new interaction paradigms are needed.

## Out of Scope

- Adding navigation from the team daily usage chart (stacked area chart) to individual seat pages
- Adding breadcrumb "back" navigation from the seat page to the originating team/department
- Changes to the seat detail page itself
