# Capped Seat Usage Statistics — Quality Review Report

## Review Summary

| Field | Value |
|---|---|
| Review Date | 5 March 2026 |
| Input Document | `extracted-tasks.md` (1 epic, 1 story) |
| Analysis Passes Run | 10 / 10 |
| Total Suggestions | 0 |
| Accepted | 0 |
| Rejected | 0 |

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Administrator | Epic 1 | Views seat usage statistics on the seat usage page |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| CopilotUsage | (external — usage collection job) | Story 1.1 | — | — |
| CopilotSeat | (external — seat sync job) | Story 1.1 | — | — |
| Configuration | (external — settings page) | Story 1.1 (premiumRequestsPerSeat) | — | — |

### Relationships

- CopilotUsage belongs to CopilotSeat (via seatId)
- Configuration provides the premiumRequestsPerSeat allowance used to cap and compute usage percentage

## Analysis Pass Results

| Pass | Findings |
|---|---|
| A: Entity Lifecycle Completeness | 0 — calculation change, not entity management |
| B: Cross-Feature State Validation | 0 — zero-allowance case already handled in existing API |
| C: Bulk Operation Idempotency | 0 — no bulk operations involved |
| D: Actor Dashboard Completeness | 0 — statistics cards already exist; this changes calculation only |
| E: Precondition Guards | 0 — no new feature unlocking |
| F: Third-Party Boundary Clarity | 0 — no external systems |
| G: Platform Operations Perspective | 0 — admin dashboard already exists |
| H: Error State and Edge Case Coverage | 0 — zero usage and zero allowance edge cases covered by existing acceptance criteria and current API behaviour |
| I: Notification and Communication Gaps | 0 — no state changes affecting other actors |
| J: Domain-Specific Research | 0 — straightforward calculation adjustment |

## Suggestions

_No suggestions generated. The extracted task list is complete and well-scoped for this focused change._

## Changes Applied to extracted-tasks.md

_None — no suggestions were accepted (none were generated)._
