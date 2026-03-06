# Jobs Tab Consolidation into Seats — Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirements |
| Participants | N/A |
| Source Materials | User requirements, codebase analysis (ManagementPageLayout, JobsTabContent, JobStatusPanel, MonthRecollectionPanel, SeatListPanel) |
| Total Epics | 1 |
| Total Stories | 5 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Management Tabs Restructuring — Consolidate Jobs into Seats | 5 | High |

## Epic 1: Management Tabs Restructuring — Consolidate Jobs into Seats

**Business Description**: Simplify the management area by removing the separate Jobs tab and relocating all job-related features (Seat Sync, Usage Collection, Month Data Recollection) into the Seats tab. This reduces navigation complexity — users no longer need to switch between tabs to manage seats and trigger related background jobs. The tab order is also updated to reflect the most common workflow: Seats first, Configuration last.

**Success Criteria**:
- All job-related actions (Sync Now, Collect Now, Month Data Recollection) are accessible from the Seats tab
- The Jobs tab is fully removed from the management area
- Management tabs appear in the new order: Seats → Departments → Project Teams → Users → Configuration
- Month Data Recollection is accessible via a modal triggered from the Seat Sync card

### Story 1.1: Move Seat Sync and Usage Collection cards to Seats tab

**User Story**: As an administrator, I want the Seat Sync and Usage Collection status cards and their action buttons to be located on the Seats tab so that I can manage seats and trigger related sync/collection jobs from a single view.

**Acceptance Criteria**:
- [ ] The Seat Sync card (showing status, started time, completed time, records processed, and "Sync Now" button) is displayed on the Seats tab below the search bar / filter controls
- [ ] The Usage Collection card (showing status, started time, completed time, records processed, and "Collect Now" button) is displayed on the Seats tab alongside the Seat Sync card
- [ ] Both cards retain their existing functionality (triggering jobs, showing feedback messages, refreshing status)
- [ ] The cards are visually separated from the seat list table by appropriate spacing
- [ ] Job status data is fetched when the Seats tab loads
- [ ] If the job status API fails to load, the seat list still renders normally; the job status cards show an inline error state without blocking the seat table

**Priority**: High

### Story 1.2: Combine Month Recollection status into Month Data Recollection card

**User Story**: As an administrator, I want the Month Recollection job status (success/failure indicator) to be displayed within the Month Data Recollection form so that I can see the last recollection result without a separate card.

**Acceptance Criteria**:
- [ ] The standalone Month Recollection status card (previously showing full job details) is removed
- [ ] The Month Data Recollection form includes a status indicator showing the last recollection job result (success/failure badge)
- [ ] The status updates after a recollection is triggered and completes
- [ ] Only the status badge is shown — the full job details (started time, completed time, records processed) are no longer displayed for month recollection

**Priority**: High

### Story 1.3: Open Month Data Recollection in a modal from Seat Sync card

**User Story**: As an administrator, I want to trigger Month Data Recollection by clicking a "Select Month" action on the Seat Sync card so that I can re-fetch historical data when needed without it taking up permanent screen space.

**Acceptance Criteria**:
- [ ] The Seat Sync card displays a "Select Month" button/link in addition to the "Sync Now" button
- [ ] Clicking "Select Month" opens a modal dialog
- [ ] The modal contains the Month Data Recollection form (month selector, year selector, recalculate button, and status indicator from Story 1.2)
- [ ] The modal can be closed by clicking outside it, pressing Escape, or clicking a close button
- [ ] After a successful recollection, the modal remains open showing the success status so the user can review the result
- [ ] The modal follows the existing application styling conventions

**Priority**: High

### Story 1.4: Remove the Jobs tab from management area

**User Story**: As an administrator, I want the Jobs tab to be removed from the management area so that navigation is simpler now that all job features are available on the Seats tab.

**Acceptance Criteria**:
- [ ] The "Jobs" tab is no longer visible in the management tab bar
- [ ] Navigating to `?tab=jobs` no longer renders any content (falls back to default tab)
- [ ] The Jobs tab content component is no longer used and can be cleaned up
- [ ] No broken links or references to the Jobs tab remain in the application

**Priority**: High

### Story 1.5: Reorder management tabs

**User Story**: As an administrator, I want the management tabs to appear in the order Seats → Departments → Project Teams → Users → Configuration so that the most frequently used tab (Seats) is first and Configuration (a one-time setup) is last.

**Acceptance Criteria**:
- [ ] Management tabs appear in the following order: Seats, Departments, Project Teams, Users, Configuration
- [ ] The default active tab when navigating to the management page is Seats
- [ ] All tab content continues to render correctly after reordering
- [ ] The URL parameter `?tab=seats` reflects the new default

**Priority**: High

## Dependencies

- Story 1.1 should be completed before Story 1.4 (job cards must be on Seats tab before removing Jobs tab)
- Story 1.2 should be completed before Story 1.3 (status must be integrated before building the modal)
- Story 1.3 depends on Story 1.1 (the "Select Month" button lives on the Seat Sync card which is on the Seats tab)
- Story 1.4 depends on Stories 1.1, 1.2, and 1.3 (all features must be migrated before removing the tab)
- Story 1.5 is independent and can be done at any point

## Assumptions

- The Seat Sync card's "Select Month" button is the only way to access Month Data Recollection; there is no standalone access point after the Jobs tab is removed.
- The existing modal component pattern in the application (if any) should be reused for the Month Data Recollection modal.
- The job status API endpoint (`/api/job-status`) continues to serve seat sync, usage collection, and month recollection status data to the Seats tab.

## Out of Scope

- Changes to the Dashboard or Usage pages
- Changes to the background job scheduling or execution logic
- Adding new job types or modifying existing job behaviour
- Changes to the API layer beyond what is needed to support the UI restructuring
