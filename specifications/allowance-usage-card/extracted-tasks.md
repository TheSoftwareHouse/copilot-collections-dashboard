# Allowance Usage Percentage Dashboard Card — Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirement |
| Participants | N/A |
| Source Materials | User requirement, codebase analysis (DashboardPanel, dashboard API, DashboardMonthlySummary entity, premium allowance calculation) |
| Total Epics | 1 |
| Total Stories | 2 (updated after quality review — 3 criteria added to 1.1, 1 to 1.2) |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Allowance Usage Percentage Dashboard Card | 2 | High |

## Epic 1: Allowance Usage Percentage Dashboard Card

**Business Description**: Add a new summary card to the main dashboard that shows what percentage of the organization's included premium request allowance has been consumed in the selected month. The card also displays a trend indicator comparing usage against the previous month, giving administrators instant visibility into consumption patterns without navigating to the Premium Requests detail panel.

**Success Criteria**:
- A new summary card on the dashboard displays the percentage of included allowance used
- The card includes a month-over-month trend indicator showing usage direction vs the previous month
- Administrators can quickly assess whether usage is within expected bounds at a glance

### Story 1.1: Display Allowance Usage Percentage card on dashboard

**User Story**: As an administrator, I want to see a summary card on the dashboard showing the percentage of included premium request allowance used so that I can immediately assess whether usage is on track without examining the detailed Premium Requests panel.

**Acceptance Criteria**:
- [ ] A new "Allowance Used" card is displayed in the summary card grid alongside Total Seats, Total Spending, and Active Seats
- [ ] The card displays the usage percentage as the main metric value (e.g., "72%")
- [ ] The card displays the absolute values as supporting detail (e.g., "2,160 / 3,000 requests")
- [ ] The percentage is calculated as: included premium requests used ÷ included allowance × 100
- [ ] When the included allowance is zero (no active seats), the card displays "N/A" or "0%" without errors
- [ ] When no usage data exists for the selected month, the card shows a "No data" or "—" state instead of 0%
- [ ] When usage exceeds the included allowance, the card displays values above 100% (e.g., "120%") without errors
- [ ] The percentage uses color-coded thresholds to signal usage severity (green when under 80%, amber between 80–100%, red above 100%)
- [ ] The card updates when the user switches the month filter

**Priority**: High

### Story 1.2: Add month-over-month trend indicator to Allowance Usage card

**User Story**: As an administrator, I want the Allowance Usage card to show a trend indicator comparing the current month's usage percentage against the previous month so that I can quickly see whether premium request consumption is increasing or decreasing.

**Acceptance Criteria**:
- [ ] The Allowance Usage card displays a trend indicator showing the direction of change vs the previous month (e.g., "↑ 5%" or "↓ 3%")
- [ ] The trend is calculated by comparing the current month's usage percentage against the previous month's usage percentage
- [ ] The API provides previous month's allowance usage data alongside the current month's response
- [ ] When no previous month data is available (e.g., first month of usage), no trend indicator is shown — a "No prior data" label or similar is displayed
- [ ] The trend indicator uses visual cues to distinguish increasing vs decreasing usage (e.g., directional arrow, color differentiation)
- [ ] "Previous month" correctly wraps across year boundaries (e.g., January 2026 compares against December 2025)

**Priority**: High

## Dependencies

- Story 1.2 depends on Story 1.1 (the base card must exist before adding trend)
- Story 1.2 requires an API enhancement to return previous month comparison data

## Assumptions

- The percentage card uses the same included allowance calculation already in the system (`activeSeats × premiumRequestsPerSeat`)
- The card follows the existing summary card styling (rounded-lg border, same grid layout)
- "Previous month" means the calendar month immediately before the selected month (not the previous available data month)

## Out of Scope

- Configurable trend periods (e.g., comparing against 3 months ago)
- Trend indicators on other existing dashboard cards
- Alert thresholds or notifications when usage exceeds a certain percentage
