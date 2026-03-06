# Seat Usage Statistics and Rankings — Quality Review Report

## Review Context

| Field | Value |
|---|---|
| Review Date | 5 March 2026 |
| Source Task List | `extracted-tasks.md` (Gate 1 approved) |
| Additional Sources | Codebase analysis (SeatUsagePanel, DashboardPanel card pattern, usage API) |
| Epics Reviewed | 1 |
| Stories Reviewed | 3 |
| Total Suggestions | 3 |
| Accepted | 3 |
| Rejected | 0 |

---

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Administrator | 1 | Views seat usage statistics, identifies most/least active seats |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Seat Usage Statistics (computed) | — | Story 1.1 | — | — |
| Seat Rankings (computed) | — | Story 1.2, 1.3 | — | — |
| Copilot Seat (existing) | — | Story 1.2, 1.3 | — | — |
| Copilot Usage (existing) | — | Story 1.1, 1.2, 1.3 | — | — |

### Key Relationships

- Seat Usage Statistics are computed from Copilot Usage records aggregated across all Copilot Seats for a given month
- Seat Rankings are derived from per-seat Copilot Usage totals, referencing Copilot Seat for display information

---

## Suggestions

### Epic 1: Seat Usage Statistics and Rankings

#### S-01 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.1 — Display usage statistics cards on the seat usage page

**Finding** (Pass H: Error State and Edge Case Coverage):
The SeatUsagePanel currently has a search filter that narrows the seat table. When the search is active, the statistics cards could misleadingly change to reflect only filtered seats. Statistics should always represent the full dataset for the month.

**Proposed Change**:
Add to Story 1.1 acceptance criteria:
- [ ] The statistics cards are not affected by the search filter — they always reflect global stats for the selected month

**Decision**: ✅ Accepted

---

#### S-02 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.2 — Display top 5 most active seats

**Finding** (Pass D: Actor Dashboard Completeness):
The existing SeatUsageTable shows GitHub username, display name, and department for each seat. The ranking entries only mention GitHub username and usage value, omitting the display name which aids quick identification of team members.

**Proposed Change**:
Add to Story 1.2 acceptance criteria:
- [ ] Each entry shows the member's display name alongside the GitHub username

**Decision**: ✅ Accepted

---

#### S-03 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.3 — Display top 5 least active seats

**Finding** (Pass D: Actor Dashboard Completeness):
Same as S-02. Consistency between the most active and least active ranking sections requires showing display names in both.

**Proposed Change**:
Add to Story 1.3 acceptance criteria:
- [ ] Each entry shows the member's display name alongside the GitHub username

**Decision**: ✅ Accepted

---

## Applied Changes Summary

| # | Suggestion | Action | Target |
|---|---|---|---|
| S-01 | Stats cards unaffected by search filter | ADD_ACCEPTANCE_CRITERION | Story 1.1 |
| S-02 | Show display name in most active list | ADD_ACCEPTANCE_CRITERION | Story 1.2 |
| S-03 | Show display name in least active list | ADD_ACCEPTANCE_CRITERION | Story 1.3 |

**Updated Totals**: 1 epic (+0 new), 3 stories (+0 new, 3 modified)

## Rejected Suggestions

_None_
