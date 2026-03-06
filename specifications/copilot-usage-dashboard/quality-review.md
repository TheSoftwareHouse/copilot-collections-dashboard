# Copilot Usage Dashboard — Quality Review Report

## Review Context

| Field | Value |
|---|---|
| Review Date | 27 February 2026 |
| Source Task List | `extracted-tasks.md` (Gate 1 approved) |
| Additional Sources | `project.md` (requirements document) |
| Epics Reviewed | 7 |
| Stories Reviewed | 21 |
| Total Suggestions | 14 |
| Accepted | 12 |
| Rejected | 2 |

---

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Admin | 1, 2 | Configure application, manage users |
| User | 3, 5, 6, 7 | View seats, view dashboard, view analytics, manage teams/departments |
| System | 3, 4 | Sync seats from GitHub, collect usage data from GitHub |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Configuration | 1.1 | 1.2 | 1.2 | — |
| Application User | 2.2 | 2.2 | 2.2 | 2.2 |
| Seat | 3.1 (sync) | 3.3 | 3.4 (metadata) | 3.2 (flagged unused, never deleted) |
| Usage Data | 4.1 | 5.1, 6.1, 6.2, 6.3 | 4.2 (upsert) | — |
| Team | 7.1 | 7.1 | 7.1 | 7.1 |
| Team Membership | 7.2 | 7.2 | 7.2 | 7.2 |
| Team Composition Snapshot | 7.4 | 7.4 | — (immutable) | — |
| Department | 7.5 | 7.5 | 7.5 | 7.5 |

### Key Relationships

- Seat belongs to Configuration (org/enterprise context determines API endpoint)
- Usage Data belongs to Seat (per-user, per-day)
- Team Membership links Seat to Team (many-to-many)
- Team Composition Snapshot records Team Membership at a point in time (monthly)
- Department is assigned to Seat (one-to-one)
- Dashboard metrics and Analytics views consume Usage Data
- Team usage view consumes Team Membership + Usage Data
- Department usage view consumes Department assignment + Usage Data

---

## Suggestions

### Epic 1: Application Configuration

#### S-11 · Medium · NEW_STORY

**Target**: Epic 1 (new story)

**Finding** (Pass G: Platform Operations Perspective):
No stories address the operator's ability to monitor background processes. There is no way to see when the last seat sync or usage collection ran, whether it succeeded, or how many records were processed.

**Proposed Change**:
Add new story under Epic 1:

### Story 1.3: Admin can view sync and collection job status

**User Story**: As an admin, I want to view the status of background sync and collection jobs so that I can verify the system is operating correctly.

**Acceptance Criteria**:
- [ ] Admin can see when the last seat sync ran and whether it succeeded
- [ ] Admin can see when the last usage collection ran and whether it succeeded
- [ ] Error details are displayed if the last run failed

**High-Level Technical Notes**: None

**Priority**: Medium

**Decision**: ✅ Accepted

---

### Epic 2: Authentication & User Management

#### S-10 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 2.1 — User can log in with username and password

**Finding** (Pass H: Error State and Edge Case Coverage):
No criteria for session timeout or expiration behavior. Users may remain logged in indefinitely if session management is not addressed.

**Proposed Change**:
Add to Story 2.1 acceptance criteria:
- [ ] Session expires after a period of inactivity and the user is redirected to the login page

**Decision**: ✅ Accepted

---

### Epic 3: Copilot Seat Management

#### S-07 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 3.1 — System syncs Copilot seats from GitHub API daily

**Finding** (Pass F: Third-Party Boundary Clarity):
No acceptance criteria for GitHub API failures — rate limiting, authentication errors, timeouts, or partial failures. The sync story only covers the happy path.

**Proposed Change**:
Add to Story 3.1 acceptance criteria:
- [ ] If the GitHub API returns an error, the sync logs the error and retries on the next scheduled run
- [ ] Existing seat data is not corrupted or lost when a sync fails

**Decision**: ✅ Accepted

---

#### S-12 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 3.1 — System syncs Copilot seats from GitHub API daily

**Finding** (Pass E: Precondition Guards):
Seat sync requires application configuration to exist. No criterion for what happens if sync triggers before configuration is complete.

**Proposed Change**:
Add to Story 3.1 acceptance criteria:
- [ ] Sync does not run if application configuration has not been completed; the skipped run is logged

**Decision**: ✅ Accepted

---

#### S-09 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 3.3 — User can view list of Copilot seats

**Finding** (Pass H: Error State and Edge Case Coverage):
No empty state defined for when no seats have been synced yet (e.g., first run before sync completes).

**Proposed Change**:
Add to Story 3.3 acceptance criteria:
- [ ] An informative empty state is shown when no seats have been synced yet

**Decision**: ✅ Accepted

---

### Epic 4: Usage Data Collection

#### S-08 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 4.1 — System collects per-user usage from GitHub API on configured interval

**Finding** (Pass F: Third-Party Boundary Clarity):
Same as seat sync — no criteria for API failures during usage collection. Additionally, usage collection iterates over multiple users, so partial failure handling is important.

**Proposed Change**:
Add to Story 4.1 acceptance criteria:
- [ ] If the GitHub API returns an error for a specific user, the system logs the error and continues collecting data for remaining users
- [ ] Failed collections are retried on the next scheduled run

**Decision**: ✅ Accepted

---

### Epic 5: Dashboard

#### S-01 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 5.1 — User can view general monthly usage metrics

**Finding** (Pass H: Error State and Edge Case Coverage):
The dashboard doesn't specify what the user sees when no usage data exists for the selected month (e.g., first run, or a month with no collection).

**Proposed Change**:
Add to Story 5.1 acceptance criteria:
- [ ] Dashboard displays an informative empty state when no usage data is available for the selected month

**Decision**: ✅ Accepted

---

### Epic 6: Usage Analytics

#### S-02 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 6.1 — User can view per-seat usage for a specific month

**Finding** (Pass H: Error State and Edge Case Coverage):
No empty state defined when no usage data exists for the selected month.

**Proposed Change**:
Add to Story 6.1 acceptance criteria:
- [ ] An informative empty state is shown when no per-seat usage data exists for the selected month

**Decision**: ✅ Accepted

---

#### S-03 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 6.2 — User can view per-team usage for a specific month

**Finding** (Pass B: Cross-Feature State Validation + Pass H: Error State and Edge Case Coverage):
The team tab depends on teams existing and having members. No criteria for when no teams exist or a team has no members.

**Proposed Change**:
Add to Story 6.2 acceptance criteria:
- [ ] An informative message is shown when no teams have been defined
- [ ] Teams with no members display zero usage, not an error

**Decision**: ✅ Accepted

---

#### S-04 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 6.3 — User can view per-department usage for a specific month

**Finding** (Pass B: Cross-Feature State Validation + Pass H: Error State and Edge Case Coverage):
The department tab depends on departments existing and seats being assigned. No criteria for empty states.

**Proposed Change**:
Add to Story 6.3 acceptance criteria:
- [ ] An informative message is shown when no departments have been defined
- [ ] Departments with no assigned seats display zero usage, not an error

**Decision**: ✅ Accepted

---

### Epic 7: Team & Department Management

#### S-05 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 7.1 — User can define teams

**Finding** (Pass B: Cross-Feature State Validation):
Deleting a team doesn't specify what happens to team members, historical composition snapshots, and team usage data.

**Proposed Change**:
Add to Story 7.1 acceptance criteria:
- [ ] Deleting a team removes its current member assignments
- [ ] Historical team composition snapshots and usage data are preserved after deletion

**Decision**: ✅ Accepted

---

#### S-06 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 7.5 — User can define departments

**Finding** (Pass B: Cross-Feature State Validation):
Deleting a department doesn't specify what happens to seats currently assigned to it.

**Proposed Change**:
Add to Story 7.5 acceptance criteria:
- [ ] Deleting a department clears the department assignment from all seats in that department
- [ ] User is warned before deleting a department that has seats assigned to it

**Decision**: ✅ Accepted

---

### New Epics

#### S-13 · Low · NEW_EPIC

**Finding** (Pass J: Domain-Specific Research):
In Copilot usage management tools, budget/spending limit features are common — setting budgets per team or department and alerting when approaching limits. This was not discussed in the requirements.

**Proposed Change**:
Add new Epic for Budget & Spending Management with stories for setting spending limits per team/department and threshold alerts.

**Decision**: ❌ Rejected — Out of scope for initial version

---

#### S-14 · Low · NEW_EPIC

**Finding** (Pass I: Notification and Communication Gaps):
No notification mechanism exists for events like seats becoming unused, spending anomalies, or sync failures. This was not discussed in the requirements.

**Proposed Change**:
Add new Epic for Notifications & Alerts with stories for email/in-app notifications.

**Decision**: ❌ Rejected — Out of scope; notifications were not mentioned in requirements

---

## Applied Changes Summary

| # | Suggestion | Action | Target |
|---|---|---|---|
| S-01 | Empty state for dashboard when no data | ADD_ACCEPTANCE_CRITERION | Story 5.1 |
| S-02 | Empty state for per-seat usage | ADD_ACCEPTANCE_CRITERION | Story 6.1 |
| S-03 | Empty states for team usage (no teams, no members) | ADD_ACCEPTANCE_CRITERION | Story 6.2 |
| S-04 | Empty states for department usage (no depts, no assignments) | ADD_ACCEPTANCE_CRITERION | Story 6.3 |
| S-05 | Cascading behavior when deleting a team | ADD_ACCEPTANCE_CRITERION | Story 7.1 |
| S-06 | Cascading behavior when deleting a department | ADD_ACCEPTANCE_CRITERION | Story 7.5 |
| S-07 | GitHub API error handling for seat sync | ADD_ACCEPTANCE_CRITERION | Story 3.1 |
| S-08 | GitHub API error handling for usage collection | ADD_ACCEPTANCE_CRITERION | Story 4.1 |
| S-09 | Empty state for seat list before first sync | ADD_ACCEPTANCE_CRITERION | Story 3.3 |
| S-10 | Session timeout behavior | ADD_ACCEPTANCE_CRITERION | Story 2.1 |
| S-11 | Admin can view sync/collection job status | NEW_STORY | Story 1.3 (new) |
| S-12 | Precondition guard — sync skips if no config | ADD_ACCEPTANCE_CRITERION | Story 3.1 |

**Updated Totals**: 7 epics (+0 new), 22 stories (+1 new, 10 modified)

## Rejected Suggestions

| # | Suggestion | Confidence | Reason |
|---|---|---|---|
| S-13 | Budget & Spending Management epic | Low | Out of scope for initial version |
| S-14 | Notifications & Alerts epic | Low | Out of scope; not mentioned in requirements |

---

# Quality Review — Epics 8–10 (2026-03-01 Feature Requests)

## Review Scope

This addendum covers the newly extracted Epics 8, 9, and 10 added based on user feature requests dated 2026-03-01. Epics 1–7 were previously approved and are not re-reviewed.

## Analysis Passes Executed

| Pass | Category | Findings Count |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 |
| B | Cross-Feature State Validation | 1 |
| C | Bulk Operation Idempotency | 0 |
| D | Actor Dashboard Completeness | 0 |
| E | Precondition Guards | 1 |
| F | Third-Party Boundary Clarity | 0 |
| G | Platform Operations Perspective | 0 |
| H | Error State & Edge Case Coverage | 3 |
| I | Notification & Communication Gaps | 0 |
| J | Domain-Specific Research | 0 |

## Accepted Suggestions

### S-15: Story 9.4 — >100% colour indicator + colour correction (High, Pass H)
User corrected colour scheme: **red (0–50%), orange (50–90%), green (90–100%+)**. Added >100% handling as green.

### S-16: Story 9.1 — Configurable premium request allowance (Medium, Pass E)
Made the 300 premium request limit a configurable value in application settings.

### S-17: Story 10.4 — Duplicate team name validation (Medium, Pass H)
Added "Validation prevents saving a duplicate team name" criterion.

### S-18: Story 8.1 — Default tab and tab memory (Medium, Pass B)
Added "Default tab is Configuration; last-used tab is restored via URL state" criterion.

## Not Presented (Below Threshold)

| # | Suggestion | Confidence | Reason |
|---|---|---|---|
| S-19 | Story 10.3: Concurrent edit handling | Low | Edge case unlikely for small-team internal tool |

## Updated Totals

| Metric | Value |
|---|---|
| Total Epics | 10 (+3 new) |
| Total Stories | 36 (+14 new) |
| Suggestions Presented | 7 |
| Suggestions Accepted | 7 |
| Suggestions Rejected | 0 |

---

## Quality Review — Stories 10.6 and 10.7 (1 March 2026)

### Context

Story 10.6 was replaced ("Historical team composition view with date range selection" → "Backfill historical team membership via date-range assignment") and Story 10.7 was added ("Two-mode member removal (purge vs retire)") based on user requirements. Quality review was run against the two new stories only.

### Suggestions

| ID | Target | Type | Confidence | Suggestion | Decision |
|---|---|---|---|---|---|
| S-20 | Story 10.6 | ADD_ACCEPTANCE_CRITERION | High | Add validation that start month ≤ end month | ✅ Accepted |
| S-21 | Story 10.7 | ADD_ACCEPTANCE_CRITERION | High | Purge confirmation shows impact scope (months affected) | ✅ Accepted |
| S-22 | Story 10.6 | ADD_ACCEPTANCE_CRITERION | Medium | Prevent backfilling to soft-deleted teams | ✅ Accepted |

### Changes Applied

- Story 10.6: Added 2 acceptance criteria (date range validation, soft-deleted team guard)
- Story 10.7: Added 1 acceptance criterion (purge impact preview in confirmation dialog)

---

## Quality Review — Story 9.6 (2 March 2026)

### Context

Story 9.6 was added to Epic 9: "Cap individual usage at premium request allowance in aggregate calculations". The user requires that when calculating usage percentages for teams, departments, and seat progress bars, each individual member's premium requests are capped at `premiumRequestsPerSeat` before aggregation. This prevents outliers from inflating the aggregate percentage (e.g., 1000 requests with a 300 cap contributes 300 to the team total for percentage calculation).

### Analysis Passes Executed

| Pass | Category | Findings Count |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 |
| B | Cross-Feature State Validation | 0 |
| C | Bulk Operation Idempotency | 0 |
| D | Actor Dashboard Completeness | 0 |
| E | Precondition Guards | 0 |
| F | Third-Party Boundary Clarity | 0 |
| G | Platform Operations Perspective | 0 |
| H | Error State & Edge Case Coverage | 2 |
| I | Notification & Communication Gaps | 0 |
| J | Domain-Specific Research | 0 |

### Suggestions

| ID | Target | Type | Confidence | Suggestion | Decision |
|---|---|---|---|---|---|
| S-23 | Story 9.6 | ADD_ACCEPTANCE_CRITERION | High | Clarify that `totalRequests` in team/department views shows raw (uncapped) totals; only the usage percentage and progress bar reflect the per-seat cap | ✅ Accepted — raw totals for transparency, capped percentage |
| S-24 | Story 9.6 | ADD_ACCEPTANCE_CRITERION | High | Clarify that individual seat progress bar caps at 100% maximum and the text label shows only the percentage (not raw count) | ✅ Accepted (modified — user specified text label shows only %) |

### Changes Applied

- Story 9.6: Added 2 acceptance criteria (raw totals in summary views, progress bar 100% cap with percentage-only label)
- Updated `extracted-tasks.md`: Total stories 36 → 37, Epic 9 story count 5 → 6, added dependency entry for Story 9.6
