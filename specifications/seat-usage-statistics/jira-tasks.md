# Seat Usage Statistics and Rankings — Jira Tasks

---

## Epic: Seat Usage Statistics: Usage Distribution and Activity Rankings

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Enhance the seat usage page with summary statistics cards and seat activity rankings so that administrators can quickly understand overall usage distribution and identify outliers without scrolling through the full seat table.

h2. Business Value

Administrators currently need to scroll through paginated seat tables to understand usage patterns. This epic provides at-a-glance aggregate metrics (average, median, minimum, maximum usage) and highlights the most and least active seats, enabling faster decision-making about licence utilisation and team support.

h2. Success Metrics

* Administrators can see at-a-glance statistics about seat usage distribution for the selected month
* The most and least active seats are immediately visible without scrolling or sorting the table
* Statistics and rankings update when the selected month changes
```

**Acceptance Criteria**:
```
(/) Summary statistics cards (average, median, min, max usage) are displayed on the seat usage page
(/) Top 5 most active and top 5 least active seats are displayed as ranked lists
(/) All statistics and rankings update when the selected month changes
(/) Statistics remain global and are not affected by the search filter
```

**Labels**: `usage`, `dashboard`

---

### Story 1.1: Admin can view usage statistics cards on seat usage page

**Parent**: Seat Usage Statistics: Usage Distribution and Activity Rankings
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:
```
h2. Context

This story is part of the [Seat Usage Statistics: Usage Distribution and Activity Rankings] epic. It provides aggregate usage metrics so administrators can understand the overall distribution at a glance.

h2. User Story

As an administrator, I want to see summary cards showing average usage, median usage, minimum usage, and maximum usage across all seats so that I can quickly understand the overall usage distribution for the selected month.

h2. Requirements

# Display four summary cards above the seat table: Average Usage, Median Usage, Minimum Usage, and Maximum Usage
# Each card shows the usage percentage as the primary value (e.g., "72%")
# Usage percentage is calculated as total requests per seat divided by premium requests per seat allowance, then aggregated across all seats with usage data
# Cards follow the existing summary card design pattern used on the dashboard
# Cards update when the user changes the month filter
# When no usage data exists for the selected month, the cards show a no-data state
# The statistics cards are not affected by the search filter — they always reflect global stats for the selected month

h2. Technical Notes

The current seat usage API returns paginated per-seat data but does not include aggregated statistics. A new data source or endpoint enhancement will be needed to compute these statistics server-side.
```

**Acceptance Criteria**:
```
(/) Four summary cards are displayed above the seat table: Average Usage, Median Usage, Minimum Usage, and Maximum Usage
(/) Each card shows the usage percentage as the primary value
(/) Usage percentage is calculated as total requests per seat divided by premium requests per seat allowance multiplied by 100, then aggregated across all seats with usage data in the selected month
(/) The cards follow the existing summary card design pattern used on the dashboard
(/) The cards update when the user changes the month filter
(/) When no usage data exists for the selected month, the cards show a no-data state
(/) The statistics cards are not affected by the search filter — they always reflect global stats for the selected month
```

**Labels**: `usage`, `dashboard`

---

### Story 1.2: Admin can see top 5 most active seats

**Parent**: Seat Usage Statistics: Usage Distribution and Activity Rankings
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Seat Usage Statistics: Usage Distribution and Activity Rankings] epic. It highlights the heaviest Copilot users so administrators can quickly identify high-utilisation seats.

h2. User Story

As an administrator, I want to see a ranked list of the top 5 most active seats so that I can quickly identify the heaviest Copilot users for the selected month.

h2. Requirements

# Display a "Most Active Seats" section on the seat usage page showing the top 5 seats by usage
# Each entry shows the GitHub username, the member's display name, and their usage value
# The list is ordered from highest to lowest usage
# Each entry is clickable and navigates to the individual seat detail page
# The section updates when the user changes the month filter
# When fewer than 5 seats have usage data, only the available seats are shown
# When no usage data exists for the selected month, the section shows an appropriate empty state

h2. Technical Notes

No specific technical considerations discussed.
```

**Acceptance Criteria**:
```
(/) A "Most Active Seats" section is displayed on the seat usage page showing the top 5 seats by usage
(/) Each entry shows the seat's GitHub username and their usage value (requests or usage percentage)
(/) Each entry shows the member's display name alongside the GitHub username
(/) The list is ordered from highest to lowest usage
(/) Each entry is clickable and navigates to the individual seat detail page
(/) The section updates when the user changes the month filter
(/) When fewer than 5 seats have usage data, only the available seats are shown
(/) When no usage data exists for the selected month, the section shows an appropriate empty state
```

**Labels**: `usage`, `dashboard`

---

### Story 1.3: Admin can see top 5 least active seats

**Parent**: Seat Usage Statistics: Usage Distribution and Activity Rankings
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Seat Usage Statistics: Usage Distribution and Activity Rankings] epic. It highlights underutilised licences so administrators can identify seats that may need attention or reallocation.

h2. User Story

As an administrator, I want to see a ranked list of the top 5 least active seats so that I can quickly identify underutilised Copilot licences for the selected month.

h2. Requirements

# Display a "Least Active Seats" section on the seat usage page showing the bottom 5 seats by usage
# Each entry shows the GitHub username, the member's display name, and their usage value
# The list is ordered from lowest to highest usage
# Each entry is clickable and navigates to the individual seat detail page
# The section updates when the user changes the month filter
# When fewer than 5 seats have usage data, only the available seats are shown
# When no usage data exists for the selected month, the section shows an appropriate empty state

h2. Technical Notes

No specific technical considerations discussed.
```

**Acceptance Criteria**:
```
(/) A "Least Active Seats" section is displayed on the seat usage page showing the bottom 5 seats by usage
(/) Each entry shows the seat's GitHub username and their usage value (requests or usage percentage)
(/) Each entry shows the member's display name alongside the GitHub username
(/) The list is ordered from lowest to highest usage
(/) Each entry is clickable and navigates to the individual seat detail page
(/) The section updates when the user changes the month filter
(/) When fewer than 5 seats have usage data, only the available seats are shown
(/) When no usage data exists for the selected month, the section shows an appropriate empty state
```

**Labels**: `usage`, `dashboard`
