# Allowance Usage Percentage Dashboard Card — Quality Review

## Review Summary

| Field | Value |
|---|---|
| Review Date | 5 March 2026 |
| Input Document | `extracted-tasks.md` (Gate 1 approved) |
| Total Suggestions | 4 |
| Accepted | 4 |
| Rejected | 0 |

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Administrator | Epic 1 | Views dashboard, monitors allowance usage, switches months |

### Entities

| Entity | Created In | Read In | Updated In | Deleted In |
|---|---|---|---|---|
| DashboardMonthlySummary | Background jobs (external) | Story 1.1, 1.2 | Background jobs (external) | — |
| Configuration (premiumRequestsPerSeat) | Existing setup | Story 1.1 (for allowance calc) | Config tab (existing) | — |

### Relationships

- Allowance Usage % depends on DashboardMonthlySummary (activeSeats, includedPremiumRequestsUsed) and Configuration (premiumRequestsPerSeat)
- Trend depends on two DashboardMonthlySummary rows (current month + previous month)

## Suggestions

### Suggestion #1 — [ACCEPTED]

| Field | Value |
|---|---|
| Target | Story 1.1: Display Allowance Usage Percentage card |
| Pass | B: Cross-Feature State Validation |
| Confidence | High |
| Action | ADD_ACCEPTANCE_CRITERION |
| Change | Add: "When no usage data exists for the selected month, the card shows a 'No data' or '—' state instead of 0%" |

### Suggestion #2 — [ACCEPTED]

| Field | Value |
|---|---|
| Target | Story 1.1: Display Allowance Usage Percentage card |
| Pass | H: Error State & Edge Case Coverage |
| Confidence | High |
| Action | ADD_ACCEPTANCE_CRITERION |
| Change | Add: "When usage exceeds the included allowance, the card displays values above 100% (e.g., '120%') without errors" |

### Suggestion #3 — [ACCEPTED]

| Field | Value |
|---|---|
| Target | Story 1.2: Add month-over-month trend indicator |
| Pass | H: Error State & Edge Case Coverage |
| Confidence | Medium |
| Action | ADD_ACCEPTANCE_CRITERION |
| Change | Add: "'Previous month' correctly wraps across year boundaries (e.g., January 2026 compares against December 2025)" |

### Suggestion #4 — [ACCEPTED]

| Field | Value |
|---|---|
| Target | Story 1.1: Display Allowance Usage Percentage card |
| Pass | J: Domain-Specific Research |
| Confidence | Low |
| Action | ADD_ACCEPTANCE_CRITERION |
| Change | Add: "The percentage uses color-coded thresholds to signal usage severity (green when under 80%, amber between 80–100%, red above 100%)" |

## Changes Applied to extracted-tasks.md

- **Story 1.1**: Added 3 acceptance criteria (no-data state, >100% handling, color-coded thresholds)
- **Story 1.2**: Added 1 acceptance criterion (year boundary wrapping)
