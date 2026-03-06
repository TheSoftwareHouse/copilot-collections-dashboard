# Allowance Usage Percentage Dashboard Card — Jira Tasks

---

## Epic: Allowance Usage Percentage Dashboard Card

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Add a new summary card to the main dashboard that shows what percentage of the organization's included premium request allowance has been consumed in the selected month. The card includes a month-over-month trend indicator showing usage direction versus the previous month.

h2. Business Value

Administrators currently need to navigate to the Premium Requests detail panel and mentally calculate usage percentages to understand consumption patterns. A dedicated summary card with a percentage metric and trend arrow gives instant visibility into allowance consumption at a glance — making it easier to spot unexpected spikes or confirm usage is on track.

h2. Success Metrics

* A new summary card on the dashboard displays the percentage of included allowance used
* The card includes a month-over-month trend indicator showing usage direction vs the previous month
* Administrators can quickly assess whether usage is within expected bounds at a glance
```

**Acceptance Criteria**:
```
(/) A new summary card displays allowance usage percentage on the dashboard
(/) The card includes a month-over-month trend indicator
(/) The card uses color-coded thresholds to signal usage severity
```

**Labels**: `dashboard`, `metrics`, `premium-requests`

---

### Story 1.1: Display Allowance Usage Percentage card on dashboard

**Parent**: Allowance Usage Percentage Dashboard Card
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Allowance Usage Percentage Dashboard Card] epic. It adds a new summary card to the top grid on the dashboard that shows the percentage of included premium request allowance consumed.

h2. User Story

As an administrator, I want to see a summary card on the dashboard showing the percentage of included premium request allowance used so that I can immediately assess whether usage is on track without examining the detailed Premium Requests panel.

h2. Requirements

# A new "Allowance Used" card is displayed in the summary card grid alongside Total Seats, Total Spending, and Active Seats
# The card displays the usage percentage as the main metric value (e.g., "72%")
# The card displays the absolute values as supporting detail (e.g., "2,160 / 3,000 requests")
# The percentage is calculated as: included premium requests used \u00f7 included allowance \u00d7 100
# When the included allowance is zero (no active seats), the card displays "N/A" or "0%" without errors
# When no usage data exists for the selected month, the card shows a "No data" or "\u2014" state instead of 0%
# When usage exceeds the included allowance, the card displays values above 100% (e.g., "120%") without errors
# The percentage uses color-coded thresholds to signal usage severity (green when under 80%, amber between 80\u2013100%, red above 100%)
# The card updates when the user switches the month filter

h2. Technical Notes

The existing dashboard API already returns includedPremiumRequests and includedPremiumRequestsUsed. The percentage can be calculated from these values. The card follows the existing summary card pattern (rounded-lg border, same grid layout).
```

**Acceptance Criteria**:
```
(/) The "Allowance Used" card is displayed in the summary card grid alongside Total Seats, Total Spending, and Active Seats
(/) The card displays the usage percentage as the main metric value (e.g., "72%")
(/) The card displays absolute values as supporting detail (e.g., "2,160 / 3,000 requests")
(/) Percentage is calculated as: included premium requests used \u00f7 included allowance \u00d7 100
(/) When included allowance is zero, the card displays "N/A" or "0%" without errors
(/) When no usage data exists for the selected month, the card shows a "No data" or "\u2014" state
(/) When usage exceeds the allowance, the card displays values above 100% without errors
(/) The percentage uses color-coded thresholds (green < 80%, amber 80\u2013100%, red > 100%)
(/) The card updates when the user switches the month filter
```

**Labels**: `dashboard`, `metrics`, `premium-requests`

---

### Story 1.2: Add month-over-month trend indicator to Allowance Usage card

**Parent**: Allowance Usage Percentage Dashboard Card
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Allowance Usage Percentage Dashboard Card] epic. It enhances the Allowance Usage card from Story 1.1 with a trend indicator showing the direction of change compared to the previous month.

h2. User Story

As an administrator, I want the Allowance Usage card to show a trend indicator comparing the current month's usage percentage against the previous month so that I can quickly see whether premium request consumption is increasing or decreasing.

h2. Requirements

# The Allowance Usage card displays a trend indicator showing the direction of change vs the previous month (e.g., "\u2191 5%" or "\u2193 3%")
# The trend is calculated by comparing the current month's usage percentage against the previous month's usage percentage
# The API provides previous month's allowance usage data alongside the current month's response
# When no previous month data is available (e.g., first month of usage), no trend indicator is shown \u2014 a "No prior data" label or similar is displayed
# The trend indicator uses visual cues to distinguish increasing vs decreasing usage (e.g., directional arrow, color differentiation)
# "Previous month" correctly wraps across year boundaries (e.g., January 2026 compares against December 2025)

h2. Technical Notes

The DashboardMonthlySummary table already stores per-month data. The API needs to be enhanced to fetch the previous month's record alongside the current month and return the calculated trend data.
```

**Acceptance Criteria**:
```
(/) The card displays a trend indicator showing direction of change vs previous month (e.g., "\u2191 5%" or "\u2193 3%")
(/) Trend is calculated by comparing current vs previous month's usage percentage
(/) The API provides previous month's allowance usage data alongside current month's response
(/) When no previous month data is available, a "No prior data" label is shown instead of a trend
(/) The trend indicator uses visual cues (directional arrow, color) to distinguish increase vs decrease
(/) "Previous month" correctly wraps across year boundaries (e.g., Jan 2026 vs Dec 2025)
```

**Labels**: `dashboard`, `metrics`, `premium-requests`, `api`
