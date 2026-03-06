# Capped Seat Usage Statistics — Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirement |
| Participants | N/A |
| Source Materials | User requirement, codebase analysis (SeatUsageStatsCards component, seat stats API, team/department capped usage pattern, get-premium-allowance, usage-helpers) |
| Total Epics | 1 |
| Total Stories | 1 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Use Capped Allowance for Seat Usage Statistics | 1 | High |

## Epic 1: Use Capped Allowance for Seat Usage Statistics

**Business Description**: The seat usage statistics cards (Average Usage, Median Usage, Minimum Usage, Maximum Usage) currently calculate their values using each seat's total premium requests — including any overage beyond the included allowance. This inflates the average and median, making it harder for administrators to understand how effectively the included allowance is being consumed across the organisation. The statistics should instead be calculated using capped premium requests (each seat's usage capped at the included allowance), consistent with how team and department usage percentages are already calculated elsewhere in the application.

**Success Criteria**:
- The average and median usage statistics on the seat usage page reflect capped (included allowance) consumption, not total consumption
- A seat that used 600 out of 300 included requests contributes 100% (not 200%) to the average and median calculations
- Minimum and maximum usage statistics continue to use uncapped values so administrators can still see the full range of actual consumption
- The capping approach is consistent with how team and department usage percentages are computed throughout the application

### Story 1.1: Calculate average and median seat usage statistics using capped premium requests

**User Story**: As an administrator, I want the average and median usage statistics on the seat usage page to be calculated using capped premium request usage (limited to the included allowance per seat) so that these aggregate statistics accurately reflect how much of the included allowance is being consumed rather than being inflated by individual overages.

**Acceptance Criteria**:
- [ ] Average Usage is calculated by capping each seat's total requests at the included allowance before averaging
- [ ] Median Usage is calculated by capping each seat's total requests at the included allowance before computing the median
- [ ] Minimum Usage continues to use uncapped total requests (unchanged behaviour)
- [ ] Maximum Usage continues to use uncapped total requests (unchanged behaviour)
- [ ] A seat whose total requests exceed the included allowance contributes a usage of exactly 100% to the average and median calculations
- [ ] The capping approach is consistent with the existing capped usage calculation used for teams and departments (i.e., `LEAST(total_requests, allowance)`)
- [ ] Existing tests are updated to validate the capped calculation behaviour for average and median
- [ ] When no usage data exists for the selected month, the cards continue to show "—"

**High-Level Technical Notes**: The current `/api/usage/seats/stats` endpoint uses `total_requests / premiumRequestsPerSeat * 100` per seat for all four statistics. The fix involves applying `LEAST(total_requests, premiumRequestsPerSeat)` before dividing for the average and median aggregations only, while keeping min and max on the uncapped total — a capping pattern already used in the team and department usage APIs.

**Priority**: High

## Dependencies

- None — this is a self-contained change to an existing feature

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | The capping applies only to average and median; min and max remain uncapped per user decision | High | N/A — confirmed at Gate 1 |
| 2 | The included allowance is `premiumRequestsPerSeat` as configured in the system settings | High | Different allowance source would require different calculation |
| 3 | The existing card display behaviour (rounding, "—" state) remains unchanged | High | Minor cosmetic adjustments if wrong |

## Out of Scope

- Changing how the individual seat detail page displays usage percentage (that page may intentionally show uncapped values)
- Changing team or department usage calculations (those already use capped values)
- Adding new statistics cards or visual indicators
