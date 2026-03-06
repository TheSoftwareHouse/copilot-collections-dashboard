# Seat Usage Statistics and Rankings — Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirement |
| Participants | N/A |
| Source Materials | User requirement, codebase analysis (SeatUsagePanel, seat usage API, CopilotUsage entity, usage-helpers, DashboardPanel card pattern) |
| Total Epics | 1 |
| Total Stories | 3 (updated after quality review — 1 criterion added to 1.1, 1 to 1.2, 1 to 1.3) |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Seat Usage Statistics and Rankings | 3 | High |

## Epic 1: Seat Usage Statistics and Rankings

**Business Description**: Enhance the seat usage page with summary statistics cards and seat activity rankings so that administrators can quickly understand overall usage distribution and identify outliers without scrolling through the full seat table. The page will show aggregate usage metrics (average, median, minimum, maximum) and highlight the top 5 most active and top 5 least active seats.

**Success Criteria**:
- Administrators can see at-a-glance statistics about seat usage distribution for the selected month
- The most and least active seats are immediately visible without scrolling or sorting the table
- Statistics and rankings update when the selected month changes

### Story 1.1: Display usage statistics cards on the seat usage page

**User Story**: As an administrator, I want to see summary cards showing average usage, median usage, minimum usage, and maximum usage across all seats so that I can quickly understand the overall usage distribution for the selected month.

**Acceptance Criteria**:
- [ ] Four summary cards are displayed above the seat table: Average Usage, Median Usage, Minimum Usage, and Maximum Usage
- [ ] Each card shows the usage percentage as the primary value (e.g., "72%")
- [ ] Usage percentage is calculated as total requests ÷ premium requests per seat allowance × 100 for each seat, then aggregated (average, median, min, max) across all seats with usage data in the selected month
- [ ] The cards follow the existing summary card design pattern used on the dashboard (rounded border, shadow, heading + large value)
- [ ] The cards update when the user changes the month filter
- [ ] When no usage data exists for the selected month, the cards show a "—" or "No data" state
- [ ] The statistics cards are not affected by the search filter — they always reflect global stats for the selected month

**High-Level Technical Notes**: The current `/api/usage/seats` endpoint returns paginated per-seat data but does not include aggregated statistics. A new data source or endpoint enhancement will be needed to compute these statistics server-side.

**Priority**: High

### Story 1.2: Display top 5 most active seats on the seat usage page

**User Story**: As an administrator, I want to see a ranked list of the top 5 most active seats so that I can quickly identify the heaviest Copilot users for the selected month.

**Acceptance Criteria**:
- [ ] A "Most Active Seats" section is displayed on the seat usage page showing the top 5 seats by usage
- [ ] Each entry shows the seat's GitHub username and their usage value (requests or usage percentage)
- [ ] The list is ordered from highest to lowest usage
- [ ] Each entry shows the member's display name alongside the GitHub username
- [ ] Each entry is clickable and navigates to the individual seat detail page
- [ ] The section updates when the user changes the month filter
- [ ] When fewer than 5 seats have usage data, only the available seats are shown
- [ ] When no usage data exists for the selected month, the section shows an appropriate empty state

**High-Level Technical Notes**: None

**Priority**: High

### Story 1.3: Display top 5 least active seats on the seat usage page

**User Story**: As an administrator, I want to see a ranked list of the top 5 least active seats so that I can quickly identify underutilised Copilot licences for the selected month.

**Acceptance Criteria**:
- [ ] A "Least Active Seats" section is displayed on the seat usage page showing the bottom 5 seats by usage
- [ ] Each entry shows the seat's GitHub username and their usage value (requests or usage percentage)
- [ ] The list is ordered from lowest to highest usage
- [ ] Each entry shows the member's display name alongside the GitHub username
- [ ] Each entry is clickable and navigates to the individual seat detail page
- [ ] The section updates when the user changes the month filter
- [ ] When fewer than 5 seats have usage data, only the available seats are shown
- [ ] When no usage data exists for the selected month, the section shows an appropriate empty state

**High-Level Technical Notes**: None

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.2 | Story 1.1 | Related to | Both stories require the same aggregated usage data source; implementing them together is efficient |
| Story 1.3 | Story 1.1 | Related to | Same data source as Story 1.2 |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | "Usage" refers to the usage percentage (total requests ÷ premium requests per seat allowance × 100), consistent with how usage is displayed elsewhere in the app | High | If usage means something else (e.g., raw request count or spending), the card values and rankings change |
| 2 | Statistics are computed across all seats that have usage data for the selected month (not all assigned seats) | Medium | If seats with zero usage should be included, median and minimum values will be lower |
| 3 | The cards and rankings are displayed above the existing seat table, following the layout pattern of the dashboard summary cards | High | If the user wants a different layout (e.g., sidebar), the UI structure changes |
| 4 | The top/least active rankings use the same usage percentage metric as the statistics cards | High | If rankings should be based on raw request count instead, the ordering may differ |

## Out of Scope

Items explicitly excluded from this task breakdown:
- Trend indicators comparing usage statistics against previous months
- Configurable number of top/least active seats (fixed at 5)
- Export or download of statistics data
- Statistics for team or department usage tabs
