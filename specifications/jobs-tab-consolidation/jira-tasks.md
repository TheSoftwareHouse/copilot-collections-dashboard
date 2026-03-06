# Jobs Tab Consolidation into Seats — Jira Tasks

---

## Epic: Management Tabs Restructuring — Consolidate Jobs into Seats

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Simplify the management area by removing the separate Jobs tab and relocating all job-related features (Seat Sync, Usage Collection, Month Data Recollection) into the Seats tab. This reduces navigation complexity — users no longer need to switch between tabs to manage seats and trigger related background jobs.

h2. Business Value

Administrators currently need to switch between the Seats tab and the Jobs tab to manage seats and their associated background jobs. Consolidating these features into a single tab streamlines the workflow, reduces context switching, and makes the management area easier to navigate. The tab reordering puts the most-used tab (Seats) first and the least-used (Configuration) last.

h2. Success Metrics

* All job-related actions (Sync Now, Collect Now, Month Data Recollection) are accessible from the Seats tab
* The Jobs tab is fully removed from the management area
* Tabs appear in order: Seats, Departments, Project Teams, Users, Configuration
* Month Data Recollection is accessible via a modal triggered from the Seat Sync card
```

**Acceptance Criteria**:
```
(/) Seat Sync and Usage Collection cards with action buttons are displayed on the Seats tab
(/) Month Data Recollection is accessible as a modal from the Seat Sync card
(/) The Jobs tab is removed from the management area
(/) Tabs appear in the order: Seats, Departments, Project Teams, Users, Configuration
```

**Labels**: `management`, `ux`, `restructuring`

---

### Story 1.1: Move Seat Sync and Usage Collection cards to Seats tab

**Parent**: Management Tabs Restructuring — Consolidate Jobs into Seats
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:
```
h2. Context

This story is part of the [Management Tabs Restructuring — Consolidate Jobs into Seats] epic. It moves the Seat Sync and Usage Collection job status cards from the Jobs tab into the Seats tab, placing them below the search bar and filter controls.

h2. User Story

As an administrator, I want the Seat Sync and Usage Collection status cards and their action buttons to be located on the Seats tab so that I can manage seats and trigger related sync/collection jobs from a single view.

h2. Requirements

# The Seat Sync card (showing status, started time, completed time, records processed, and "Sync Now" button) is displayed on the Seats tab below the search bar / filter controls
# The Usage Collection card (showing status, started time, completed time, records processed, and "Collect Now" button) is displayed on the Seats tab alongside the Seat Sync card
# Both cards retain their existing functionality (triggering jobs, showing feedback messages, refreshing status)
# The cards are visually separated from the seat list table by appropriate spacing
# Job status data is fetched when the Seats tab loads
# If the job status API fails to load, the seat list still renders normally; the job status cards show an inline error state without blocking the seat table

h2. Technical Notes

The existing JobStatusPanel component contains the card layout and SyncNowButton / CollectNowButton components. These can be extracted and reused on the Seats tab. The job status API endpoint (/api/job-status) already provides seat sync and usage collection data.
```

**Acceptance Criteria**:
```
(/) The Seat Sync card is displayed on the Seats tab below the search bar
(/) The Seat Sync card shows status, started time, completed time, records processed, and a "Sync Now" button
(/) The Usage Collection card is displayed alongside the Seat Sync card
(/) The Usage Collection card shows status, started time, completed time, records processed, and a "Collect Now" button
(/) Both cards retain existing functionality (trigger jobs, show feedback, refresh status)
(/) Cards are visually separated from the seat list table
(/) Job status data is fetched when the Seats tab loads
(/) If the job status API fails, the seat list still renders normally; job cards show an inline error state
```

**Labels**: `management`, `ux`, `restructuring`

---

### Story 1.2: Combine Month Recollection status into Month Data Recollection card

**Parent**: Management Tabs Restructuring — Consolidate Jobs into Seats
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Management Tabs Restructuring — Consolidate Jobs into Seats] epic. It simplifies the month recollection UI by removing the standalone status card and integrating just the status badge into the Month Data Recollection form.

h2. User Story

As an administrator, I want the Month Recollection job status (success/failure indicator) to be displayed within the Month Data Recollection form so that I can see the last recollection result without a separate card.

h2. Requirements

# The standalone Month Recollection status card (previously showing full job details) is removed
# The Month Data Recollection form includes a status indicator showing the last recollection job result (success/failure badge)
# The status updates after a recollection is triggered and completes
# Only the status badge is shown — the full job details (started time, completed time, records processed) are no longer displayed for month recollection
```

**Acceptance Criteria**:
```
(/) The standalone Month Recollection status card is removed
(/) The Month Data Recollection form displays a status badge showing the last job result (success/failure)
(/) The status badge updates after a recollection completes
(/) Full job details (started time, completed time, records processed) are no longer shown for month recollection
```

**Labels**: `management`, `ux`, `restructuring`

---

### Story 1.3: Open Month Data Recollection in a modal from Seat Sync card

**Parent**: Management Tabs Restructuring — Consolidate Jobs into Seats
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:
```
h2. Context

This story is part of the [Management Tabs Restructuring — Consolidate Jobs into Seats] epic. It makes the Month Data Recollection feature accessible from a "Select Month" button on the Seat Sync card, opening it in a modal instead of taking permanent screen space.

h2. User Story

As an administrator, I want to trigger Month Data Recollection by clicking a "Select Month" action on the Seat Sync card so that I can re-fetch historical data when needed without it taking up permanent screen space.

h2. Requirements

# The Seat Sync card displays a "Select Month" button/link in addition to the "Sync Now" button
# Clicking "Select Month" opens a modal dialog
# The modal contains the Month Data Recollection form (month selector, year selector, recalculate button, and status indicator from Story 1.2)
# The modal can be closed by clicking outside it, pressing Escape, or clicking a close button
# After a successful recollection, the modal remains open showing the success status so the user can review the result
# The modal follows the existing application styling conventions
```

**Acceptance Criteria**:
```
(/) The Seat Sync card displays a "Select Month" button alongside "Sync Now"
(/) Clicking "Select Month" opens a modal dialog
(/) The modal contains the Month Data Recollection form with month/year selectors, recalculate button, and status badge
(/) The modal can be closed by clicking outside, pressing Escape, or a close button
(/) After successful recollection, the modal stays open showing the success status
(/) The modal follows existing application styling conventions
```

**Labels**: `management`, `ux`, `restructuring`, `modal`

---

### Story 1.4: Remove the Jobs tab from management area

**Parent**: Management Tabs Restructuring — Consolidate Jobs into Seats
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Management Tabs Restructuring — Consolidate Jobs into Seats] epic. With all job features moved to the Seats tab (Stories 1.1–1.3), the Jobs tab is no longer needed and should be removed.

h2. User Story

As an administrator, I want the Jobs tab to be removed from the management area so that navigation is simpler now that all job features are available on the Seats tab.

h2. Requirements

# The "Jobs" tab is no longer visible in the management tab bar
# Navigating to ?tab=jobs no longer renders any content (falls back to default tab)
# The Jobs tab content component is no longer used and can be cleaned up
# No broken links or references to the Jobs tab remain in the application
```

**Acceptance Criteria**:
```
(/) The "Jobs" tab is not visible in the management tab bar
(/) URL ?tab=jobs falls back to the default tab
(/) JobsTabContent component is no longer rendered
(/) No broken links or references to the Jobs tab remain
```

**Labels**: `management`, `ux`, `restructuring`, `cleanup`

---

### Story 1.5: Reorder management tabs

**Parent**: Management Tabs Restructuring — Consolidate Jobs into Seats
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Management Tabs Restructuring — Consolidate Jobs into Seats] epic. It changes the tab order to reflect usage frequency: Seats first (most used), Configuration last (one-time setup).

h2. User Story

As an administrator, I want the management tabs to appear in the order Seats, Departments, Project Teams, Users, Configuration so that the most frequently used tab is first and the least-used is last.

h2. Requirements

# Management tabs appear in the following order: Seats, Departments, Project Teams, Users, Configuration
# The default active tab when navigating to the management page is Seats
# All tab content continues to render correctly after reordering
# The URL parameter ?tab=seats reflects the new default
```

**Acceptance Criteria**:
```
(/) Tabs appear in order: Seats, Departments, Project Teams, Users, Configuration
(/) The default active tab is Seats
(/) All tab content renders correctly after reordering
(/) URL parameter ?tab=seats is the default
```

**Labels**: `management`, `ux`, `restructuring`
