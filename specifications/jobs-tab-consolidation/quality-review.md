# Jobs Tab Consolidation — Quality Review Report

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Administrator | 1 | Manages seats, triggers sync/collection jobs, triggers month recollection, navigates management tabs |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Seat Sync Job | — (manual trigger in 1.1) | 1.1 (status card) | — | — |
| Usage Collection Job | — (manual trigger in 1.1) | 1.1 (status card) | — | — |
| Month Recollection Job | 1.3 (triggered via modal) | 1.2 (status badge), 1.3 (modal) | — | — |
| Management Tab Configuration | — | 1.5 (tab rendering) | 1.5 (reordering) | 1.4 (Jobs tab removed) |

### Relationships

- Seat Sync card hosts the "Select Month" trigger → opens Month Data Recollection modal (1.1 → 1.3)
- Month Recollection status feeds into Month Data Recollection form (1.2 consumed by 1.3)
- All job cards (1.1, 1.3) must be migrated before Jobs tab removal (1.4)

## Suggestions

### Suggestion 1 — Story 1.1: Independent job status error handling

| Field | Value |
|---|---|
| Target | Story 1.1: Move Seat Sync and Usage Collection cards to Seats tab |
| Pass | B (Cross-Feature State Validation) + H (Error State & Edge Case Coverage) |
| Confidence | High |
| Action Type | ADD_ACCEPTANCE_CRITERION |
| Decision | **Accepted** |

**Rationale**: Currently in `JobsTabContent`, a job status API failure blocks the entire tab (renders an error instead of all content). When these cards move to the Seats tab, the seat list is the primary content and should render independently. A job status failure should not prevent the user from viewing and managing seats.

**Proposed criterion**: "If the job status API fails to load, the seat list still renders normally; the job status cards show an inline error state without blocking the seat table."

## Analysis Passes Summary

| Pass | Category | Findings |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 — Job entities are read-only status displays, no CRUD lifecycle applies |
| B | Cross-Feature State Validation | 1 — Merged with Pass H into Suggestion 1 |
| C | Bulk Operation Idempotency | 0 — No bulk operations in this epic |
| D | Actor Dashboard Completeness | 0 — Restructuring epic, not a new dashboard |
| E | Precondition Guards | 0 — Month Data Recollection is independent of Seat Sync having run |
| F | Third-Party Boundary Clarity | 0 — No external system changes |
| G | Platform Operations Perspective | 0 — This is specifically an admin/operations UI |
| H | Error State & Edge Case Coverage | 1 — Merged with Pass B into Suggestion 1 |
| I | Notification & Communication Gaps | 0 — No notifications needed for UI restructuring |
| J | Domain-Specific Research | 0 — Internal tool, no domain-specific compliance concerns |

## Changes Applied

| # | Type | Target | Change |
|---|---|---|---|
| 1 | ADD_ACCEPTANCE_CRITERION | Story 1.1 | Added: "If the job status API fails to load, the seat list still renders normally; the job status cards show an inline error state without blocking the seat table" |
