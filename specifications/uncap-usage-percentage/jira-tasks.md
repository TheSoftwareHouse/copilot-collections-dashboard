# Uncap Usage Percentage Display - Jira Tasks

---

## Epic: Usage Display: Show Actual Usage Percentage

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Remove the artificial 100% cap on usage percentage display across seat views, team member tables, department member tables, and dashboard user lists. Users need to see the actual percentage (e.g., 200% when 600/300 requests are consumed) to understand overage levels accurately.

h2. Business Value

Capping the displayed percentage at 100% hides how much users have exceeded their included premium request allowance. Showing the actual value enables stakeholders to make informed decisions about seat allocation, cost management, and identifying heavy overage users.

h2. Success Metrics

* All usage percentage values across specified views display the actual (uncapped) value
* Users exceeding their allowance see percentages above 100% (e.g., 200%, 350%)
* Visual progress bars remain functional (fill capped at 100%) while text shows actual values
```

**Acceptance Criteria**:
```
(/) Usage percentage is not artificially capped at 100% on any seat, team, or department view
(/) A user with 600 requests out of a 300 allowance sees "200%" displayed
(/) Progress bar visual fill does not exceed its container width
(/) Colour-coded indicators use the actual (uncapped) percentage for colour determination
(/) Screen reader users receive the same percentage value as sighted users
```

**Labels**: `usage-display`, `ui`

---

### Story 1.1: User sees actual usage percentage on seat views

**Parent**: Usage Display: Show Actual Usage Percentage
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Display: Show Actual Usage Percentage] epic. It removes the 100% usage percentage cap on all seat-related views so users can see how much each seat has exceeded their included allowance.

h2. User Story

As a dashboard user, I want to see the actual usage percentage on the seat details page and seat table so that I can understand how much each seat has exceeded (or stayed within) their included premium request allowance.

h2. Requirements

# Seat details page progress bar text shows actual percentage (e.g., "200%") when usage exceeds the allowance
# Seat details page progress bar fill width remains capped at 100% of the bar (visual constraint) but the displayed percentage text is uncapped
# Seat usage table "Usage" column shows actual percentage in the format "X / Y (Z%)" where Z is not capped
# Seat list table "Usage %" column shows actual percentage instead of capping at "100%"
# Colour-coded status indicator (dot) next to usernames uses the uncapped percentage for colour determination
# Progress bar accessibility attributes (aria-valuenow, aria-label) reflect the uncapped percentage value

h2. Technical Notes

The Math.min(..., 100) cap is applied in SeatDetailPanel, SeatUsageTable, and SeatListPanel components. The shared UsageProgressBar component also caps the display text and aria-valuenow/aria-label. The underlying calcUsagePercent helper already returns uncapped values.
```

**Acceptance Criteria**:
```
(/) Seat details page progress bar text shows actual percentage (e.g., "200%") when usage exceeds the allowance
(/) Seat details page progress bar fill width remains capped at 100% of the bar
(/) Seat usage table "Usage" column shows format "X / Y (Z%)" where Z is uncapped (e.g., "600 / 300 (200%)")
(/) Seat list table "Usage %" column shows actual percentage (e.g., "200%")
(/) Colour-coded status indicator uses the uncapped percentage for colour determination
(/) Progress bar accessibility attributes (aria-valuenow, aria-label) correctly reflect the uncapped percentage value
```

**Labels**: `usage-display`, `ui`

---

### Story 1.2: User sees actual usage percentage on team and department member tables

**Parent**: Usage Display: Show Actual Usage Percentage
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Display: Show Actual Usage Percentage] epic. It ensures that team member and department member tables display the same uncapped usage percentage as the seat views.

h2. User Story

As a dashboard user, I want to see the actual usage percentage on the team members table (team details) and department members table (department details) so that the usage display is consistent across all member-level views.

h2. Requirements

# Team members table on team detail page shows actual percentage in the "Usage" column (e.g., "600 / 300 (200%)")
# Department members table on department detail page shows actual percentage in the "Usage" column
# Colour-coded status indicator for team/department members uses the uncapped percentage
# Percentage display is consistent with the seat views from Story 1.1

h2. Technical Notes

The TeamMemberTable component is shared between team detail and department detail views. The Math.min(rawPercent, 100) cap needs to be removed in this component.
```

**Acceptance Criteria**:
```
(/) Team members table on team detail page shows actual percentage in "Usage" column (e.g., "600 / 300 (200%)")
(/) Department members table on department detail page shows actual percentage in "Usage" column
(/) Colour-coded status indicator for team/department members uses the uncapped percentage
(/) Percentage display is consistent with the seat views from Story 1.1
```

**Labels**: `usage-display`, `ui`

---

### Story 1.3: User sees actual usage percentage on Dashboard active/inactive user lists

**Parent**: Usage Display: Show Actual Usage Percentage
**Jira Key**: —
**Status**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Display: Show Actual Usage Percentage] epic. It extends the uncapped percentage display to the Dashboard's "Most Active Users" and "Least Active Users" lists for application-wide consistency.

h2. User Story

As a dashboard user, I want to see the actual usage percentage on the Dashboard's "Most Active Users" and "Least Active Users" lists so that the percentage display is consistent across the entire application.

h2. Requirements

# "Most Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
# "Least Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
# Percentage display is consistent with the seat and member views from Stories 1.1 and 1.2

h2. Technical Notes

The DashboardPanel.tsx applies Math.min(calcUsagePercent(...), 100) on lines 300 and 345 for most/least active user lists.
```

**Acceptance Criteria**:
```
(/) "Most Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
(/) "Least Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
(/) Percentage display is consistent with the seat and member views from Stories 1.1 and 1.2
```

**Labels**: `usage-display`, `ui`
