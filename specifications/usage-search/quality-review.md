# Usage Search & Filtering - Quality Review Report

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| User (dashboard user) | Epic 1 | Search/filter seats, teams, departments, and members on usage views |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Seat Usage | — | Story 1.1 | — | — |
| Team Usage | — | Story 1.2 | — | — |
| Department Usage | — | Story 1.3 | — | — |
| Department Members | — | Story 1.4 | — | — |
| Team Members | — | Story 1.5 | — | — |

### Relationships

- Seat Usage data feeds into Department Members (via department assignment) and Team Members (via team membership snapshots)
- Department and Team Usage are aggregations of individual Seat Usage data

## Analysis Passes Summary

| Pass | Category | Findings |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 — Epic is read-only (search/filter) |
| B | Cross-Feature State Validation | 0 — Search consumes existing, already-loaded data |
| C | Bulk Operation Idempotency | 0 — No bulk operations |
| D | Actor Dashboard Completeness | 0 — Narrow feature, not a dashboard gap |
| E | Precondition Guards | 0 — Existing panels already handle empty state before rendering tables |
| F | Third-Party Boundary Clarity | 0 — No third-party integrations |
| G | Platform Operations Perspective | 0 — UX enhancement, not platform ops |
| H | Error State & Edge Case Coverage | 3 findings |
| I | Notification & Communication Gaps | 0 — No state changes affecting other actors |
| J | Domain-Specific Research | 0 — Standard search UX pattern |

## Suggestions

### Suggestion 1: Case-insensitive search matching

| Field | Value |
|---|---|
| Pass | H — Error State & Edge Case Coverage |
| Confidence | High |
| Action | ADD_ACCEPTANCE_CRITERION |
| Target | Stories 1.1, 1.2, 1.3, 1.4, 1.5 |
| Decision | **Accepted** |

**Rationale**: None of the stories specify case sensitivity. Users naturally expect search to be case-insensitive — typing "johndoe" should match "JohnDoe".

**Proposed change**: Add to each story's acceptance criteria:
- [ ] Search matching is case-insensitive

### Suggestion 2: Chart update on Team Detail page

| Field | Value |
|---|---|
| Pass | H — Error State & Edge Case Coverage |
| Confidence | High |
| Action | ADD_ACCEPTANCE_CRITERION |
| Target | Story 1.5 |
| Decision | **Accepted** |

**Rationale**: Story 1.4 (Department Detail) specifies that the member chart updates with filtered results, but Story 1.5 (Team Detail) did not. Team detail also has a member chart and should behave consistently.

**Proposed change**: Add to Story 1.5's acceptance criteria:
- [ ] The member usage chart updates to reflect the filtered results (only matching members shown)

### Suggestion 3: URL persistence of search query

| Field | Value |
|---|---|
| Pass | H — Error State & Edge Case Coverage |
| Confidence | Medium |
| Action | ADD_ACCEPTANCE_CRITERION |
| Target | Stories 1.1, 1.2, 1.3 |
| Decision | **Accepted** |

**Rationale**: The usage page already persists tab, month, and year in URL query params. The search query should follow the same pattern so that refreshing the page or sharing a link retains the search context.

**Proposed change**: Add to Stories 1.1, 1.2, 1.3 acceptance criteria:
- [ ] The search query is persisted in the URL as a query parameter

## Changes Applied to extracted-tasks.md

| Change | Target | Type |
|---|---|---|
| Added "Search matching is case-insensitive" criterion | Stories 1.1, 1.2, 1.3, 1.4, 1.5 | ADD_ACCEPTANCE_CRITERION |
| Added "The member usage chart updates to reflect filtered results" criterion | Story 1.5 | ADD_ACCEPTANCE_CRITERION |
| Added "Search query is persisted in URL as a query parameter" criterion | Stories 1.1, 1.2, 1.3 | ADD_ACCEPTANCE_CRITERION |
