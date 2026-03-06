# Modal Forms Refactor - Quality Review Report

## Review Summary

| Field | Value |
|---|---|
| Review Date | 2 March 2026 |
| Input Document | `extracted-tasks.md` (Gate 1 approved) |
| Total Suggestions | 4 |
| Accepted | 2 |
| Rejected | 2 |
| Stories Added | 0 |
| Stories Removed | 1 (Story 1.6) |
| Acceptance Criteria Added | 2 |

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| Dashboard Administrator | Epic 1 | Creates teams/departments, adds team members, backfills history, edits names |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated In |
|---|---|---|---|---|
| Team | Story 1.2 | Table (existing) | EditableTextCell (existing) | Out of scope |
| Department | Story 1.3 | Table (existing) | EditableTextCell (existing) | Out of scope |
| Team Membership | Story 1.4 | Table (existing) | Story 1.5 | Out of scope |
| User | Story 1.5 (modal) | Table (existing) | Edit form (existing inline) | Delete action (existing inline) |

### Relationships

- Stories 1.2–1.5 all depend on Story 1.1 (shared Modal component)
- Team and Department entities are independent of each other
- Team Membership belongs to a Team

## Suggestions

### S1: Body scroll lock when modal is open (ACCEPTED)

| Field | Value |
|---|---|
| Target | Epic 1 > Story 1.1: Create a reusable Modal component |
| Pass | H — Error State & Edge Case Coverage |
| Confidence | High |
| Action Type | ADD_ACCEPTANCE_CRITERION |
| Decision | **Accepted** |

**Rationale**: When a modal is open, the page behind should not scroll. Without scroll lock, users can accidentally scroll background content while interacting with the modal, which is disorienting.

**Applied change**: Added acceptance criterion to Story 1.1: "The page behind the modal does not scroll while the modal is open (body scroll lock is applied and removed on close)"

---

### S2: Single modal constraint (ACCEPTED)

| Field | Value |
|---|---|
| Target | Epic 1 > Story 1.1: Create a reusable Modal component |
| Pass | H — Error State & Edge Case Coverage |
| Confidence | Medium |
| Action Type | ADD_ACCEPTANCE_CRITERION |
| Decision | **Accepted** |

**Rationale**: While existing state toggles within each panel prevent multiple inline forms from showing simultaneously, a defensive safeguard ensures consistent modal behaviour.

**Applied change**: Added acceptance criterion to Story 1.1: "Only one modal can be open at a time; if a second modal is triggered, the first one closes before the new one opens"

---

### S3: Overlay click discards unsaved name changes (REJECTED — Story 1.6 removed)

| Field | Value |
|---|---|
| Target | Epic 1 > Story 1.6: Convert inline name editing to a modal dialog |
| Pass | H — Error State & Edge Case Coverage |
| Confidence | High |
| Action Type | ADD_ACCEPTANCE_CRITERION |
| Decision | **Rejected** |

**Rationale**: The suggestion addressed a behaviour difference between inline blur-to-save and modal overlay-click. However, the product owner clarified that EditableTextCell should remain as inline editable text — not be converted to modals at all. Story 1.6 was removed entirely.

**User feedback**: "EditableTextCell should keep an editable text cell. Those edit shouldn't be changed to modals"

---

### S4: Convert Edit User inline form to modal (REJECTED)

| Field | Value |
|---|---|
| Target | Epic 1 > NEW Story 1.6: Convert Edit User form to modal |
| Pass | A — Entity Lifecycle Completeness, H — Error State & Edge Case Coverage |
| Confidence | Medium |
| Action Type | NEW_STORY |
| Decision | **Rejected** |

**Rationale**: The Edit User form in UserManagementPanel.tsx is a multi-field inline form (username + password) that replaces the table row when editing — different from EditableTextCell (single-field click-to-edit). It uses the same inline pattern as the create forms being refactored.

**User feedback**: Product owner chose to keep the Edit User form inline. Added to assumptions and out-of-scope lists.

## Changes Applied to extracted-tasks.md

1. **Story 1.1**: Added 2 acceptance criteria (scroll lock, single-modal constraint)
2. **Story 1.5**: Added — Convert "Add User" form to a modal dialog
3. **Story 1.6**: Removed entirely (inline name editing stays as-is)
4. **Summary counts**: Updated from 6 stories to 5
5. **Assumptions**: Added assumption #5 confirming inline name editing remains unchanged
6. **Assumptions**: Added assumption #6 confirming Edit User inline form remains unchanged
7. **Out of scope**: Added "Inline name editing (EditableTextCell)" to out-of-scope list
8. **Out of scope**: Added "Inline Edit User form" to out-of-scope list
9. **Dependencies**: Removed Story 1.6 dependency row; added Story 1.5 dependency on Story 1.1

## Analysis Passes Summary

| Pass | Category | Findings |
|---|---|---|
| A | Entity Lifecycle Completeness | 0 — UI refactor only, no new entity lifecycle gaps |
| B | Cross-Feature State Validation | 0 — No cross-feature dependencies |
| C | Bulk Operation Idempotency | 0 — No bulk operations introduced |
| D | Actor Dashboard Completeness | 0 — Not applicable for UI refactor |
| E | Precondition Guards | 0 — Dependencies already captured |
| F | Third-Party Boundary Clarity | 0 — No third-party integrations |
| G | Platform Operations Perspective | 0 — Not applicable for UI refactor |
| H | Error State & Edge Case Coverage | 3 — Scroll lock, single-modal, overlay-click behaviour |
| I | Notification & Communication Gaps | 0 — No state changes affecting other actors |
| J | Domain-Specific Research | 0 — Standard modal dialog pattern |
