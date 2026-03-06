# Capped Seat Usage Statistics — Jira Tasks

---

## Epic: Seat Usage Statistics: Use Capped Allowance for Average and Median

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

The seat usage statistics cards (Average Usage, Median Usage, Minimum Usage, Maximum Usage) on the seat usage page currently calculate average and median values using each seat's total premium requests — including any overage beyond the included allowance. This inflates the aggregate metrics and misrepresents how effectively the included allowance is being consumed across the organisation.

h2. Business Value

Administrators need the average and median statistics to reflect actual consumption of the included allowance, not total consumption including overages. By capping each seat's contribution at the included allowance before aggregating, the average and median provide a meaningful picture of allowance utilisation. Minimum and maximum remain uncapped so administrators can still see the full range of individual seat usage.

h2. Success Metrics

* Average and median usage statistics reflect capped (included allowance) consumption
* A seat that consumed 600 out of 300 included requests contributes 100% (not 200%) to the average and median
* Minimum and maximum usage statistics remain uncapped for full-range visibility
* Capping approach is consistent with team and department usage calculations
```

**Acceptance Criteria**:
```
(/) Average and median seat usage statistics are computed using capped premium request values
(/) Minimum and maximum seat usage statistics continue to use uncapped values
(/) The capping approach is consistent with team and department usage percentage calculations
```

**Labels**: `usage`, `dashboard`

---

### Story 1.1: Admin sees capped average and median on seat usage statistics cards

**Parent**: Seat Usage Statistics: Use Capped Allowance for Average and Median
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Seat Usage Statistics: Use Capped Allowance for Average and Median] epic. It changes how the average and median seat usage statistics are calculated so they reflect included allowance consumption rather than total consumption.

h2. User Story

As an administrator, I want the average and median usage statistics on the seat usage page to be calculated using capped premium request usage (limited to the included allowance per seat) so that these aggregate statistics accurately reflect how much of the included allowance is being consumed rather than being inflated by individual overages.

h2. Requirements

# Average Usage is calculated by capping each seat's total requests at the included allowance before averaging
# Median Usage is calculated by capping each seat's total requests at the included allowance before computing the median
# Minimum Usage continues to use uncapped total requests (unchanged behaviour)
# Maximum Usage continues to use uncapped total requests (unchanged behaviour)
# A seat whose total requests exceed the included allowance contributes exactly 100% to the average and median
# The capping approach is consistent with the existing capped usage calculation used for teams and departments
# Existing tests are updated to validate the capped calculation behaviour for average and median
# When no usage data exists for the selected month, the cards continue to show a no-data state

h2. Technical Notes

The current seat stats API uses total_requests / premiumRequestsPerSeat * 100 per seat for all four statistics. The fix involves applying LEAST(total_requests, premiumRequestsPerSeat) before dividing for the average and median aggregations only, while keeping min and max on the uncapped total. This capping pattern is already used in the team and department usage APIs.
```

**Acceptance Criteria**:
```
(/) Average Usage is calculated by capping each seat's total requests at the included allowance before averaging
(/) Median Usage is calculated by capping each seat's total requests at the included allowance before computing the median
(/) Minimum Usage continues to use uncapped total requests (unchanged behaviour)
(/) Maximum Usage continues to use uncapped total requests (unchanged behaviour)
(/) A seat whose total requests exceed the included allowance contributes exactly 100% to the average and median calculations
(/) The capping approach is consistent with the existing capped usage calculation used for teams and departments
(/) Existing tests are updated to validate the capped calculation behaviour for average and median
(/) When no usage data exists for the selected month, the cards continue to show a no-data state
```

**Labels**: `usage`, `dashboard`
