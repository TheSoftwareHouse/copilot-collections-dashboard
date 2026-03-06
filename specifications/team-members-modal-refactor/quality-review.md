# Team Members Modal Refactor - Quality Review Report

## Review Summary

| Field | Value |
|---|---|
| Review Date | 3 March 2026 |
| Source Document | `extracted-tasks.md` (Gate 1 approved) |
| Total Suggestions | 2 |
| Accepted | 2 |
| Rejected | 0 |

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Dashboard Administrator | Epic 1 | View team members, add members, backfill history, remove members (retire/purge) |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Team Member (Snapshot) | Story 1.2 (add), Story 1.3 (backfill) | Story 1.1 | — | Story 1.1 (retire/purge) |
| Seat | — (existing) | Stories 1.2, 1.3 | — | — |
| Team | — (existing) | Story 1.1 (name displayed) | — | — |

### Relationships

- Team has many Team Member Snapshots (scoped by month/year)
- Team Member Snapshot references a Seat
- Seats are shared across teams (a seat can be in multiple teams)

## Analysis Passes

| Pass | Category | Findings |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 — All lifecycle operations covered (add, view, remove). This is a UI container change, no new entities. |
| B | Cross-Feature State Validation | 0 — Existing code already handles "no active seats" and "all seats assigned" edge cases. |
| C | Bulk Operation Idempotency | 0 — Backfill uses ON CONFLICT DO NOTHING. Add members filters already-assigned seats. No changes to API logic. |
| D | Actor Dashboard Completeness | 0 — No new dashboard capabilities, pure UX refactor. |
| E | Precondition Guards | 0 — No new feature dependencies introduced. |
| F | Third-Party Boundary Clarity | 0 — No third-party systems involved. |
| G | Platform Operations Perspective | 0 — Not applicable for UI container refactor. |
| H | Error State & Edge Case Coverage | 2 — Loading state and scroll behavior when form + member list are combined. |
| I | Notification & Communication Gaps | 0 — No cross-actor state changes. |
| J | Domain-Specific Research | 0 — Standard modal-with-inline-forms pattern, no domain-specific gaps. |

## Suggestions

### Suggestion QR-1 — ACCEPTED

| Field | Value |
|---|---|
| Target | Story 1.1: Open team members modal directly from team table row |
| Pass | H: Error State & Edge Case Coverage |
| Confidence | High |
| Action | ADD_ACCEPTANCE_CRITERION |

**Rationale**: Story 1.1 did not specify what the user sees while members are loading after the modal opens, nor what happens when the fetch fails. The current code shows "Loading members…" and has a retry path. These states should be preserved in the modal.

**Proposed criteria**:
- While members are loading, the modal displays a "Loading members…" message
- If the member fetch fails, a retry button is shown within the modal

**Decision**: Accepted. Applied to `extracted-tasks.md`.

### Suggestion QR-2 — ACCEPTED

| Field | Value |
|---|---|
| Target | Story 1.1: Open team members modal directly from team table row |
| Pass | H: Error State & Edge Case Coverage |
| Confidence | Medium |
| Action | ADD_ACCEPTANCE_CRITERION |

**Rationale**: When both a form (Add Members or Backfill) and the member list are visible simultaneously, the modal could become very tall. The scroll behavior should be explicitly defined to avoid ambiguity during implementation.

**Proposed criterion**:
- When a form is active above the member list, the entire modal body scrolls (form + member list together)

**Decision**: Accepted. Applied to `extracted-tasks.md`.

## Changes Applied to extracted-tasks.md

| Change | Story | Description |
|---|---|---|
| Added 3 acceptance criteria | Story 1.1 | Loading state, fetch error retry, and combined scroll behavior |

Total stories count unchanged (3). No new stories or epics added.
