# Usage Member Navigation — Jira Tasks

---

## Epic: Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Enable users to navigate directly from team and department usage detail views to individual seat usage pages. Member usernames in team and department tables become clickable links, and department member chart bars become interactive — all navigating to the corresponding seat usage detail page.

h2. Business Value

Currently, viewing an individual member's usage from a team or department context requires navigating back to the seat list and finding the member manually. This epic removes that friction, allowing managers to drill down from group views to individual seat usage with a single click, improving efficiency when reviewing team and department performance.

h2. Success Metrics

* Users can click any member username in team or department detail views and reach the seat usage page
* Users can click chart bars in the department member chart to navigate to seat usage
* Navigation preserves the current month/year context across page transitions
```

**Acceptance Criteria**:
```
(/) Users can navigate from team member table to individual seat usage page by clicking a username
(/) Users can navigate from department member table to individual seat usage page by clicking a username
(/) Users can navigate from department member chart to individual seat usage page by clicking a bar
(/) Month and year context is preserved in all navigation transitions
```

**Labels**: `usage`, `navigation`, `ux`

---

### Story 1.1: Team member username navigates to seat usage page

**Parent**: Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage] epic. It makes team member usernames clickable, enabling direct navigation to the seat usage detail page.

h2. User Story

As a manager, I want to click on a team member's GitHub username in the team usage detail table so that I can quickly view that member's individual seat usage breakdown without manually searching for them.

h2. Requirements

# Each GitHub username in the team members table is a clickable link
# Clicking a username navigates to the seat usage detail page for that member
# The current month and year context is preserved in the navigation URL
# The link styling is visually consistent with existing clickable elements in usage tables
# The full table row is clickable, following existing table navigation patterns

h2. Technical Notes

The TeamMemberTable component currently renders usernames as plain text. It needs to accept month and year props and wrap cells with Link components, following the same pattern used in SeatUsageTable.
```

**Acceptance Criteria**:
```
(/) Each GitHub username in the team members table is a clickable link
(/) Clicking a username navigates to /usage/seats/{seatId}?month={month}&year={year}
(/) The current month and year context is preserved in the navigation
(/) The link is visually consistent with existing clickable elements in usage tables
(/) The full table row is clickable (consistent with existing table navigation patterns)
```

**Labels**: `usage`, `navigation`, `ux`

---

### Story 1.2: Department member username navigates to seat usage page

**Parent**: Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage] epic. It ensures department member usernames are clickable in the department detail view, providing the same navigation experience as the team detail view.

h2. User Story

As a manager, I want to click on a department member's GitHub username in the department usage detail table so that I can view that member's individual seat usage without leaving the department context.

h2. Requirements

# Each GitHub username in the department members table is a clickable link
# Clicking a username navigates to the seat usage detail page for that member
# The current month and year context is preserved in the navigation URL
# The link styling is visually consistent with existing clickable elements in usage tables

h2. Technical Notes

The department detail page reuses TeamMemberTable. Once Story 1.1 adds navigation to that component, the department detail page needs to pass month and year props to enable the links. This story is blocked by Story 1.1.
```

**Acceptance Criteria**:
```
(/) Each GitHub username in the department members table is a clickable link
(/) Clicking a username navigates to /usage/seats/{seatId}?month={month}&year={year}
(/) The current month and year context is preserved in the navigation
(/) The link is visually consistent with existing clickable elements in usage tables
```

**Labels**: `usage`, `navigation`, `ux`

---

### Story 1.3: Department member chart bars navigate to seat usage page

**Parent**: Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Cross-Linking Member Navigation: Navigate from Team and Department Members to Seat Usage] epic. It makes the department member chart interactive, allowing users to click on a bar to navigate to that member's seat usage — the same interaction already available on the departments overview chart.

h2. User Story

As a manager, I want to click on a bar in the department member usage chart so that I can navigate directly to that member's seat usage page, the same way I can click department bars in the departments overview chart.

h2. Requirements

# Each bar in the department member chart is clickable
# Clicking a bar navigates to the seat usage detail page for that member
# The cursor changes to a pointer when hovering over a bar
# The current month and year context is preserved in the navigation URL
# The clickable behaviour follows the same pattern as the existing department usage chart

h2. Technical Notes

The DepartmentMemberChart component needs an onBarClick callback prop (same pattern as DepartmentUsageChart), and the DepartmentDetailPanel needs to wire it up with router.push().
```

**Acceptance Criteria**:
```
(/) Each bar in the department member chart is clickable
(/) Clicking a bar navigates to /usage/seats/{seatId}?month={month}&year={year}
(/) The cursor changes to a pointer when hovering over a bar (visual affordance)
(/) The current month and year context is preserved in the navigation
(/) The clickable behaviour follows the same pattern as the existing department usage chart
```

**Labels**: `usage`, `navigation`, `ux`
