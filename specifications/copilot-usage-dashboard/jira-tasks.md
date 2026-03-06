# Copilot Usage Dashboard — Jira Tasks

---

## Epic 1: Application Configuration: First-Run Setup and Settings Management

**Jira Key**: —
**Priority**: Highest

**Description**:

h2. Overview

Enable administrators to configure the application on first run by selecting the GitHub API mode (organisation or enterprise) and providing connection details. Configuration is persisted in the database and can be updated later. Includes monitoring of background job status.

h2. Business Value

Without configuration, the system cannot connect to the correct GitHub API endpoints to fetch seat and usage data. This epic gates all downstream data collection and reporting functionality.

h2. Success Metrics

* Administrator completes first-run configuration and the system begins syncing data
* Configuration survives application restarts
* Admin can verify background jobs are running correctly

**Acceptance Criteria**:

(/) Administrator can complete first-run configuration and the system begins operating
(/) Configuration is stored persistently and survives application restarts
(/) Admin can view and update configuration after initial setup
(/) Admin can monitor background job status

**Labels**: `configuration`, `workshop-2026-02-27`

---

### Story 1.1: Admin can configure organisation or enterprise settings on first run

**Parent**: Application Configuration: First-Run Setup and Settings Management
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Application Configuration: First-Run Setup and Settings Management] epic. It enables the initial setup that gates all data collection.

h2. User Story

As an admin, I want to configure whether the application uses organisation or enterprise GitHub endpoints on first run so that the system connects to the correct data source.

h2. Requirements

# First-run setup screen is displayed when no configuration exists
# Admin can choose between organisation-level and enterprise-level endpoints
# Admin can provide the organisation or enterprise name
# Configuration is saved to the database after submission
# After saving, the system begins operating with the selected configuration

h2. Technical Notes

The system must support both GitHub organisation and enterprise API endpoints for seat and usage data. The endpoint choice determines which GitHub APIs are called.

**Acceptance Criteria**:

(/) First-run setup screen is displayed when no configuration exists
(/) Admin can choose between organisation-level and enterprise-level endpoints
(/) Admin can provide the organisation or enterprise name
(/) Configuration is saved to the database after submission
(/) After saving, the system begins operating with the selected configuration

**Labels**: `configuration`, `workshop-2026-02-27`

---

### Story 1.2: Admin can view and update application configuration

**Parent**: Application Configuration: First-Run Setup and Settings Management
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Application Configuration: First-Run Setup and Settings Management] epic. It allows administrators to adjust settings after the initial setup if the organisation structure changes.

h2. User Story

As an admin, I want to view and update the application configuration after initial setup so that I can adjust settings if the organisation structure changes.

h2. Requirements

# Admin can access a configuration settings page
# Current configuration values are displayed
# Admin can update the organisation/enterprise name and endpoint type
# Changes are saved to the database

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Admin can access a configuration settings page
(/) Current configuration values are displayed
(/) Admin can update the organisation/enterprise name and endpoint type
(/) Changes are saved to the database

**Labels**: `configuration`, `workshop-2026-02-27`

---

### Story 1.3: Admin can view sync and collection job status

**Parent**: Application Configuration: First-Run Setup and Settings Management
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Application Configuration: First-Run Setup and Settings Management] epic. It provides administrators with visibility into the health of background data collection processes.

h2. User Story

As an admin, I want to view the status of background sync and collection jobs so that I can verify the system is operating correctly.

h2. Requirements

# Admin can see when the last seat sync ran and whether it succeeded
# Admin can see when the last usage collection ran and whether it succeeded
# Error details are displayed if the last run failed

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Admin can see when the last seat sync ran and whether it succeeded
(/) Admin can see when the last usage collection ran and whether it succeeded
(/) Error details are displayed if the last run failed

**Labels**: `configuration`, `monitoring`, `workshop-2026-02-27`

---

## Epic 2: Authentication & User Management: Secure Access and Account Control

**Jira Key**: —
**Priority**: Highest

**Description**:

h2. Overview

Provide secure access to the application through username and password authentication. Administrators can manage which users have access to the dashboard by creating, editing, and removing user accounts.

h2. Business Value

Without authentication, the dashboard data — which includes organisation spending and individual usage — would be accessible to anyone. This epic protects sensitive data and enables access control.

h2. Success Metrics

* Users can log in securely with username and password
* Admins can control who has access to the application
* Inactive sessions are terminated automatically

**Acceptance Criteria**:

(/) Users can log in securely with username and password
(/) Admins can create, edit, and remove user accounts
(/) Removed users can no longer access the application
(/) Inactive sessions expire and redirect to login

**Labels**: `auth`, `workshop-2026-02-27`

---

### Story 2.1: User can log in with username and password

**Parent**: Authentication & User Management: Secure Access and Account Control
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Authentication & User Management: Secure Access and Account Control] epic. It enables users to securely access the application.

h2. User Story

As a user, I want to log in with my username and password so that I can access the Copilot usage dashboard securely.

h2. Requirements

# Login page is displayed when user is not authenticated
# User can enter username and password to log in
# Valid credentials grant access to the application
# Invalid credentials display a clear error message
# Authenticated session is maintained across page navigation
# Session expires after a period of inactivity and the user is redirected to the login page

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Login page is displayed when user is not authenticated
(/) User can enter username and password to log in
(/) Valid credentials grant access to the application
(/) Invalid credentials display a clear error message
(/) Authenticated session is maintained across page navigation
(/) Session expires after a period of inactivity and the user is redirected to the login page

**Labels**: `auth`, `workshop-2026-02-27`

---

### Story 2.2: Admin can manage application users

**Parent**: Authentication & User Management: Secure Access and Account Control
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Authentication & User Management: Secure Access and Account Control] epic. It gives administrators control over who can access the dashboard.

h2. User Story

As an admin, I want to create, edit, and remove user accounts so that I can control who has access to the dashboard.

h2. Requirements

# Admin can view a list of all application users
# Admin can create a new user with username and password
# Admin can edit an existing user's details
# Admin can remove a user account
# Removed users can no longer log in

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Admin can view a list of all application users
(/) Admin can create a new user with username and password
(/) Admin can edit an existing user's details
(/) Admin can remove a user account
(/) Removed users can no longer log in

**Labels**: `auth`, `workshop-2026-02-27`

---

## Epic 3: Copilot Seat Management: Seat Synchronisation and Directory

**Jira Key**: —
**Priority**: Highest

**Description**:

h2. Overview

Synchronise GitHub Copilot seat assignments from the GitHub API on a daily basis and provide a browsable directory of all seats. Seats are the foundational data entity — once imported, they are never removed but are flagged with a status indicating whether they are active or unused.

h2. Business Value

Accurate, up-to-date seat data is the foundation for all usage tracking and cost analysis. Without reliable seat synchronisation, the dashboard cannot report on individual or aggregate usage.

h2. Success Metrics

* All Copilot seat assignments from GitHub are reflected in the application
* Seats are synced daily without manual intervention
* Unused seats are clearly flagged for visibility
* Users can enrich seat records with names and department information

**Acceptance Criteria**:

(/) All Copilot seat assignments are synced from GitHub daily
(/) Unused seats are flagged, never deleted
(/) Seat directory is browsable with enrichment fields
(/) Sync handles API errors gracefully without data loss

**Labels**: `seats`, `integration`, `workshop-2026-02-27`

---

### Story 3.1: System syncs Copilot seats from GitHub API daily

**Parent**: Copilot Seat Management: Seat Synchronisation and Directory
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Large (13+)

**Description**:

h2. Context

This story is part of the [Copilot Seat Management: Seat Synchronisation and Directory] epic. It establishes the automated data pipeline that keeps seat records current.

h2. User Story

As a system, I want to automatically fetch the list of Copilot seats from the GitHub API daily so that the application always has an up-to-date record of seat assignments.

h2. Requirements

# System calls the appropriate GitHub API endpoint (organisation or enterprise) based on configuration
# All current seat assignments are imported into the application database
# New seats discovered during sync are added to the database
# Sync runs automatically on a daily schedule
# Sync results are logged for troubleshooting
# If the GitHub API returns an error, the sync logs the error and retries on the next scheduled run
# Existing seat data is not corrupted or lost when a sync fails
# Sync does not run if application configuration has not been completed; the skipped run is logged

h2. Technical Notes

Depending on configuration, the system uses either organisation or enterprise GitHub endpoints to fetch seats.

**Acceptance Criteria**:

(/) System calls the appropriate GitHub API endpoint based on configuration
(/) All current seat assignments are imported into the database
(/) New seats discovered during sync are added
(/) Sync runs automatically on a daily schedule
(/) Sync results are logged for troubleshooting
(/) If the GitHub API returns an error, the sync logs the error and retries on the next scheduled run
(/) Existing seat data is not corrupted or lost when a sync fails
(/) Sync does not run if application configuration has not been completed; the skipped run is logged

**Labels**: `seats`, `integration`, `backend`, `workshop-2026-02-27`

---

### Story 3.2: System flags unused seats with appropriate status

**Parent**: Copilot Seat Management: Seat Synchronisation and Directory
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Copilot Seat Management: Seat Synchronisation and Directory] epic. It ensures that seats no longer active in GitHub are clearly identified without losing historical data.

h2. User Story

As a system, I want to flag seats that are no longer active in GitHub as unused so that administrators can identify seats that may need attention.

h2. Requirements

# Seats that are no longer returned by the GitHub API are marked as unused/inactive
# Seats are never deleted from the application database
# The status of each seat is clearly visible in the seat list
# Previously unused seats that reappear in the API are restored to active status

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Seats no longer returned by the GitHub API are marked as unused/inactive
(/) Seats are never deleted from the database
(/) Status is clearly visible in the seat list
(/) Previously unused seats that reappear in the API are restored to active status

**Labels**: `seats`, `backend`, `workshop-2026-02-27`

---

### Story 3.3: User can view list of Copilot seats

**Parent**: Copilot Seat Management: Seat Synchronisation and Directory
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Copilot Seat Management: Seat Synchronisation and Directory] epic. It provides the browsable seat directory that serves as the reference for all user-related data.

h2. User Story

As a user, I want to view a list of all Copilot seats with their GitHub username, status, first name, last name, and department so that I can see who has a seat and their details.

h2. Requirements

# Seat list displays GitHub username, status (active/unused), first name, last name, and department for each seat
# Seat list is accessible from the main navigation
# List supports pagination or scrolling for large numbers of seats
# An informative empty state is shown when no seats have been synced yet

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Seat list displays GitHub username, status, first name, last name, and department
(/) Seat list is accessible from the main navigation
(/) List supports pagination or scrolling for large numbers of seats
(/) An informative empty state is shown when no seats have been synced yet

**Labels**: `seats`, `ui`, `workshop-2026-02-27`

---

### Story 3.4: User can edit seat holder's first name, last name, and department

**Parent**: Copilot Seat Management: Seat Synchronisation and Directory
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Copilot Seat Management: Seat Synchronisation and Directory] epic. It allows users to enrich seat records with metadata not available from the GitHub API.

h2. User Story

As a user, I want to edit the first name, last name, and department of a seat holder so that I can enrich the seat data with information not available from GitHub.

h2. Requirements

# User can edit first name, last name, and department fields on a seat record
# Changes are saved to the database
# Updated values are immediately reflected in the seat list
# Editing does not affect the GitHub username or seat status

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) User can edit first name, last name, and department on a seat record
(/) Changes are saved to the database
(/) Updated values are immediately reflected in the seat list
(/) Editing does not affect the GitHub username or seat status

**Labels**: `seats`, `ui`, `workshop-2026-02-27`

---

## Epic 4: Usage Data Collection: Automated Premium Request Tracking

**Jira Key**: —
**Priority**: Highest

**Description**:

h2. Overview

Collect per-user Copilot premium request usage data from the GitHub billing API at regular intervals. This data is the foundation for all dashboard metrics and analytics views. Each usage record is unique per user, day, month, and year.

h2. Business Value

Usage data drives all reporting, cost analysis, and team/department comparisons. Without automated collection, stakeholders would have no visibility into how Copilot is being used or what it costs.

h2. Success Metrics

* Per-user usage data is collected for every active seat holder at the configured interval
* Data is stored with per-day granularity and is unique by user and date
* Usage data includes model-level breakdown (model name, quantity, cost)

**Acceptance Criteria**:

(/) Usage data is collected automatically for all active seat holders
(/) Data is unique per user, day, month, and year
(/) Model-level breakdown is preserved
(/) Collection handles API errors gracefully without blocking other users

**Labels**: `usage`, `integration`, `workshop-2026-02-27`

---

### Story 4.1: System collects per-user usage from GitHub API on configured interval

**Parent**: Usage Data Collection: Automated Premium Request Tracking
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Large (13+)

**Description**:

h2. Context

This story is part of the [Usage Data Collection: Automated Premium Request Tracking] epic. It establishes the automated pipeline that feeds all dashboard and analytics views.

h2. User Story

As a system, I want to fetch premium request usage data for each active seat holder from the GitHub billing API at a regular interval so that the dashboard always has current usage data.

h2. Requirements

# System calls the GitHub premium request usage API for each user with an active seat
# Usage data is fetched for each day since the last successful collection
# Data includes: product, SKU, model, unit type, price per unit, gross quantity, gross amount, discount quantity, discount amount, net quantity, net amount
# Collection runs automatically at the configured interval
# Collection results are logged for troubleshooting
# If the GitHub API returns an error for a specific user, the system logs the error and continues collecting data for remaining users
# Failed collections are retried on the next scheduled run

h2. Technical Notes

API endpoint: https://api.github.com/organizations/<org>/settings/billing/premium_request/usage?user=<username>&day=<day>&month=<month>&year=<year>. Response includes per-model usage items.

**Acceptance Criteria**:

(/) System calls the GitHub usage API for each active seat holder
(/) Usage data is fetched for each day since the last successful collection
(/) Data includes full model-level breakdown (product, SKU, model, quantities, amounts)
(/) Collection runs automatically at the configured interval
(/) Collection results are logged for troubleshooting
(/) If the API returns an error for a specific user, the system continues collecting for remaining users
(/) Failed collections are retried on the next scheduled run

**Labels**: `usage`, `integration`, `backend`, `workshop-2026-02-27`

---

### Story 4.2: Usage data is stored uniquely per user, day, month, and year

**Parent**: Usage Data Collection: Automated Premium Request Tracking
**Jira Key**: —
**Priority**: Highest
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Usage Data Collection: Automated Premium Request Tracking] epic. It ensures data integrity and prevents duplicate records in the usage database.

h2. User Story

As a system, I want to store usage data uniquely by user, day, month, and year so that duplicate records are prevented and historical data is accurate.

h2. Requirements

# Database enforces uniqueness on the combination of user, day, month, and year
# If data for a given user and date already exists, it is updated rather than duplicated
# All usage item details (per-model breakdowns) are preserved in the database
# Historical data is retained and accessible for any past date

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Database enforces uniqueness on user + day + month + year
(/) Existing data is updated (upsert), not duplicated
(/) All per-model breakdowns are preserved
(/) Historical data is retained and accessible

**Labels**: `usage`, `backend`, `workshop-2026-02-27`

---

## Epic 5: Dashboard: Monthly Usage Overview

**Jira Key**: —
**Priority**: High

**Description**:

h2. Overview

Provide a summary dashboard showing key Copilot usage metrics for a given month. This gives stakeholders a quick, high-level view of seat utilisation, spending, model usage distribution, and user activity rankings.

h2. Business Value

Stakeholders need a single view to understand overall Copilot adoption and spending without drilling into individual records. The dashboard enables quick decision-making about seat management and budget.

h2. Success Metrics

* Dashboard displays meaningful monthly summary metrics at a glance
* Users can switch between months to compare trends
* Dashboard is the default landing page after login

**Acceptance Criteria**:

(/) Dashboard shows total seats, per-model usage, top/bottom users, and spending
(/) Data is filterable by month
(/) Dashboard is the default landing page
(/) Empty state is shown when no data exists for selected month

**Labels**: `dashboard`, `ui`, `workshop-2026-02-27`

---

### Story 5.1: User can view general monthly usage metrics

**Parent**: Dashboard: Monthly Usage Overview
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Large (13+)

**Description**:

h2. Context

This story is part of the [Dashboard: Monthly Usage Overview] epic. It delivers the primary dashboard view that stakeholders will use daily.

h2. User Story

As a user, I want to see a dashboard with key Copilot usage metrics for a specific month so that I can understand overall adoption and spending at a glance.

h2. Requirements

# Dashboard displays total number of seats
# Dashboard displays total usage per each model (e.g., Claude Haiku 4.5, Claude Sonnet 4.5)
# Dashboard displays most active users for the selected month
# Dashboard displays least active users for the selected month
# Dashboard displays current spending for the selected month
# Dashboard is the default landing page after login
# Dashboard displays an informative empty state when no usage data is available for the selected month

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Dashboard displays total number of seats
(/) Dashboard displays total usage per each model
(/) Dashboard displays most active users for the selected month
(/) Dashboard displays least active users for the selected month
(/) Dashboard displays current spending for the selected month
(/) Dashboard is the default landing page after login
(/) Dashboard displays an informative empty state when no data is available for the selected month

**Labels**: `dashboard`, `ui`, `workshop-2026-02-27`

---

### Story 5.2: User can filter dashboard by month

**Parent**: Dashboard: Monthly Usage Overview
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Dashboard: Monthly Usage Overview] epic. It enables month-over-month comparison of usage trends.

h2. User Story

As a user, I want to filter the dashboard data by month so that I can compare usage and spending across different time periods.

h2. Requirements

# Month filter is visible on the dashboard
# Selecting a different month refreshes all dashboard metrics for that month
# Current month is selected by default
# All months with available data are selectable

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Month filter is visible on the dashboard
(/) Selecting a different month refreshes all metrics
(/) Current month is selected by default
(/) All months with available data are selectable

**Labels**: `dashboard`, `ui`, `workshop-2026-02-27`

---

## Epic 6: Usage Analytics: Seat, Team, and Department Breakdown

**Jira Key**: —
**Priority**: High

**Description**:

h2. Overview

Provide detailed usage analytics views organised in three tabs: Seat, Team, and Department. Each tab shows per-entity usage for a selected month, allowing users to drill down from individual seats to team and department level aggregations.

h2. Business Value

Beyond the high-level dashboard, stakeholders need to identify consumption patterns at the individual, team, and department level. This enables targeted optimisation of Copilot seat allocation and cost management.

h2. Success Metrics

* Users can view detailed per-seat, per-team, and per-department usage for any month
* The default tab is Seat, with Team and Department tabs readily accessible
* Data is presented in a paginated, easy-to-navigate format

**Acceptance Criteria**:

(/) Three-tab layout (Seat, Team, Department) with Seat as default
(/) Per-entity usage data displayed for selected month
(/) Drill-down from team/department to individual members
(/) Empty states handled for all tabs

**Labels**: `analytics`, `ui`, `workshop-2026-02-27`

---

### Story 6.1: User can view per-seat usage for a specific month

**Parent**: Usage Analytics: Seat, Team, and Department Breakdown
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Usage Analytics: Seat, Team, and Department Breakdown] epic. The Seat tab provides the most granular view of individual usage.

h2. User Story

As a user, I want to view usage data broken down by individual seat for a specific month so that I can identify individual consumption patterns.

h2. Requirements

# Seat tab is the default active tab in the Usage section
# Per-seat usage is displayed for the selected month
# Each row shows the seat holder's usage metrics (models used, quantities, costs)
# Results are paginated
# Month filter allows switching between months
# An informative empty state is shown when no per-seat usage data exists for the selected month

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Seat tab is the default active tab in the Usage section
(/) Per-seat usage is displayed for the selected month
(/) Each row shows usage metrics (models, quantities, costs)
(/) Results are paginated
(/) Month filter allows switching between months
(/) An informative empty state is shown when no data exists for the selected month

**Labels**: `analytics`, `ui`, `workshop-2026-02-27`

---

### Story 6.2: User can view per-team usage for a specific month

**Parent**: Usage Analytics: Seat, Team, and Department Breakdown
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Usage Analytics: Seat, Team, and Department Breakdown] epic. The Team tab provides aggregated usage at the team level with drill-down capability.

h2. User Story

As a user, I want to view usage data aggregated by team for a specific month so that I can compare team-level consumption and identify trends.

h2. Requirements

# Team tab shows a list of teams with aggregated usage for the selected month
# Each team entry shows team name and aggregated metrics (total usage, average per member, cost)
# User can drill into a team to see individual member usage
# Month filter allows switching between months
# An informative message is shown when no teams have been defined
# Teams with no members display zero usage, not an error

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Team tab shows teams with aggregated usage for the selected month
(/) Each team shows name, total usage, average per member, and cost
(/) User can drill into a team to see individual member usage
(/) Month filter allows switching between months
(/) An informative message is shown when no teams have been defined
(/) Teams with no members display zero usage, not an error

**Labels**: `analytics`, `ui`, `workshop-2026-02-27`

---

### Story 6.3: User can view per-department usage for a specific month

**Parent**: Usage Analytics: Seat, Team, and Department Breakdown
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Usage Analytics: Seat, Team, and Department Breakdown] epic. The Department tab provides aggregated usage at the organisational unit level.

h2. User Story

As a user, I want to view usage data aggregated by department for a specific month so that I can compare department-level consumption.

h2. Requirements

# Department tab shows a list of departments with aggregated usage for the selected month
# Each department entry shows department name and aggregated metrics (total usage, average per member, cost)
# User can drill into a department to see individual member usage
# Month filter allows switching between months
# An informative message is shown when no departments have been defined
# Departments with no assigned seats display zero usage, not an error

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Department tab shows departments with aggregated usage for the selected month
(/) Each department shows name, total usage, average per member, and cost
(/) User can drill into a department to see individual member usage
(/) Month filter allows switching between months
(/) An informative message is shown when no departments have been defined
(/) Departments with no assigned seats display zero usage, not an error

**Labels**: `analytics`, `ui`, `workshop-2026-02-27`

---

## Epic 7: Team & Department Management: Organisational Grouping and Historical Tracking

**Jira Key**: —
**Priority**: Medium

**Description**:

h2. Overview

Allow users to define teams and departments for organising seat holders. Teams consist of specific GitHub users (seats) and their composition may change monthly. The system tracks team composition per month to enable historical comparisons. Departments are simple named groupings assigned to individual seats.

h2. Business Value

Grouping seats into teams and departments enables aggregated usage analysis at organisational levels. Monthly composition tracking ensures historical reports remain accurate even as team membership evolves.

h2. Success Metrics

* Users can create and manage teams and departments
* Team composition is tracked monthly for historical accuracy
* Average premium request usage per team is calculated from member data
* Department assignment enriches seat data for reporting

**Acceptance Criteria**:

(/) Teams and departments can be created, viewed, edited, and deleted
(/) Seats can be assigned to teams and departments
(/) Team composition is tracked monthly for historical comparison
(/) Deletion of teams/departments handles cascading effects correctly

**Labels**: `teams`, `departments`, `workshop-2026-02-27`

---

### Story 7.1: User can define teams

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It provides the basic CRUD operations for team management.

h2. User Story

As a user, I want to create teams with a name so that I can group seat holders for usage tracking purposes.

h2. Requirements

# User can create a new team by providing a name
# User can view a list of all teams
# User can edit a team's name
# User can delete a team
# Deleting a team removes its current member assignments
# Historical team composition snapshots and usage data are preserved after deletion

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) User can create a new team by providing a name
(/) User can view a list of all teams
(/) User can edit a team's name
(/) User can delete a team
(/) Deleting a team removes its current member assignments
(/) Historical team composition snapshots and usage data are preserved after deletion

**Labels**: `teams`, `ui`, `workshop-2026-02-27`

---

### Story 7.2: User can assign seats to a team

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It enables the composition of teams from individual seat holders.

h2. User Story

As a user, I want to assign seat holders (GitHub users) to a team so that usage can be aggregated at the team level.

h2. Requirements

# User can add one or more seats to a team
# User can remove seats from a team
# A seat can belong to one or more teams (not explicitly restricted)
# Current team membership is visible when viewing the team

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) User can add one or more seats to a team
(/) User can remove seats from a team
(/) A seat can belong to one or more teams
(/) Current team membership is visible when viewing the team

**Labels**: `teams`, `ui`, `workshop-2026-02-27`

---

### Story 7.3: System calculates average premium request usage per team

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It provides the key metric for evaluating team-level Copilot efficiency.

h2. User Story

As a user, I want to see the average Copilot premium request usage for a team based on its members' individual usage so that I can evaluate team-level efficiency.

h2. Requirements

# Average premium request usage per team is calculated based on individual member data
# Average is displayed on the team detail view and team usage tab
# Calculation uses data from the selected month

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Average premium request usage per team is calculated from individual member data
(/) Average is displayed on team detail view and team usage tab
(/) Calculation uses data from the selected month

**Labels**: `teams`, `analytics`, `workshop-2026-02-27`

---

### Story 7.4: System tracks team composition per month

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It ensures historical accuracy by preserving team composition snapshots.

h2. User Story

As a user, I want team composition changes to be tracked per month so that I can view historical team usage even when membership has changed over time.

h2. Requirements

# Each month's team composition is stored as a snapshot
# Historical usage reflects the team composition at that point in time, not the current composition
# Changing team membership in the current month does not alter historical records
# User can view past team compositions by selecting a previous month

h2. Technical Notes

Team composition may change monthly. The system needs to track composition separately per month to allow historical comparison.

**Acceptance Criteria**:

(/) Each month's team composition is stored as a snapshot
(/) Historical usage reflects the composition at that point in time
(/) Current membership changes do not alter historical records
(/) User can view past team compositions by selecting a previous month

**Labels**: `teams`, `backend`, `workshop-2026-02-27`

---

### Story 7.5: User can define departments

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It provides the basic CRUD operations for department management.

h2. User Story

As a user, I want to create departments with a name so that I can categorise seat holders by organisational unit.

h2. Requirements

# User can create a new department by providing a name
# User can view a list of all departments
# User can edit a department's name
# User can delete a department
# Deleting a department clears the department assignment from all seats in that department
# User is warned before deleting a department that has seats assigned to it

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) User can create a new department by providing a name
(/) User can view a list of all departments
(/) User can edit a department's name
(/) User can delete a department
(/) Deleting a department clears the department assignment from all seats
(/) User is warned before deleting a department with assigned seats

**Labels**: `departments`, `ui`, `workshop-2026-02-27`

---

### Story 7.6: User can assign a department to a seat holder

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It connects the department entity to individual seat holders for aggregated reporting.

h2. User Story

As a user, I want to assign a department to a seat holder so that usage can be aggregated at the department level.

h2. Requirements

# Department is selectable when editing a seat holder's details
# Each seat holder can belong to one department
# Department assignment is reflected in the seat list and department usage tab

h2. Technical Notes

This connects to Story 3.4 where department is an editable field on the seat record.

**Acceptance Criteria**:

(/) Department is selectable when editing a seat holder's details
(/) Each seat holder can belong to one department
(/) Department assignment is reflected in the seat list and department usage tab

**Labels**: `departments`, `seats`, `ui`, `workshop-2026-02-27`

---

### Story 7.7: System automatically carries team composition forward to the next month

**Parent**: Team & Department Management: Organisational Grouping and Historical Tracking
**Jira Key**: —
**Priority**: Medium
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Team & Department Management: Organisational Grouping and Historical Tracking] epic. It automates the month transition for team composition so that teams retain their membership without manual re-entry each month.

h2. User Story

As a user, I want the system to automatically carry the current month's team composition into the next month so that teams do not start each month empty and I do not have to manually re-add all members.

h2. Requirements

# At the start of a new month, the system automatically copies the previous month's team composition snapshot for every active team
# The carry-forward only runs once per month transition (idempotent — running again does not create duplicates)
# Teams that were soft-deleted are excluded from carry-forward
# After carry-forward, the user can still add or remove members from the new month's snapshot as usual
# If the previous month had no snapshot for a team, no snapshot is created for the new month
# The carry-forward operation is logged as a job execution for monitoring

h2. Technical Notes

Currently, team member snapshots are created per-month only when a user manually adds members. This story automates the month transition so teams retain their composition. The carry-forward should leverage the existing team_member_snapshot table and the ON CONFLICT DO NOTHING pattern for idempotency.

**Acceptance Criteria**:

(/) At the start of a new month, the system copies the previous month's team composition snapshot for every active team
(/) The carry-forward is idempotent — running again does not create duplicates
(/) Soft-deleted teams are excluded from carry-forward
(/) Users can still add or remove members from the new month's snapshot after carry-forward
(/) If the previous month had no snapshot for a team, no snapshot is created for the new month
(/) The carry-forward operation is logged as a job execution for monitoring

**Labels**: `teams`, `backend`, `workshop-2026-03-01`

---

## Epic 8: Unified Management Menu: Consolidated Administration Interface

**Jira Key**: —
**Priority**: High

**Description**:

h2. Overview

Consolidate all management-related pages (Configuration, Departments, Project Teams, Jobs, Users, Seats) into a single "Management" navigation item with internal tabs. This simplifies the main navigation and provides a single entry point for all administrative functions.

h2. Business Value

Currently, management pages are spread across multiple top-level navigation items, cluttering the navigation bar. Consolidating them into a single section with tabs improves the user experience and makes it easier to switch between management areas.

h2. Success Metrics

* All management pages are accessible from a single Management section
* Main navigation is simplified to three items: Dashboard, Usage, Management
* Users can easily switch between management areas using tabs

**Acceptance Criteria**:

(/) All management pages accessible from a single Management section with tabs
(/) Main navigation simplified to Dashboard, Usage, Management
(/) Tab state preserved in URL for shareability

**Labels**: `navigation`, `ui`, `workshop-2026-03-01`

---

### Story 8.1: Consolidate management pages under a tabbed Management section

**Parent**: Unified Management Menu: Consolidated Administration Interface
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Large (13+)

**Description**:

h2. Context

This story is part of the [Unified Management Menu: Consolidated Administration Interface] epic. It restructures the management area into a single tabbed interface.

h2. User Story

As a user, I want all management pages (Configuration, Departments, Project Teams, Jobs, Users, Seats) to be accessible from a single Management section with tabs so that I can easily switch between management areas without navigating to separate pages.

h2. Requirements

# Management section contains tabs: Configuration, Departments, Project Teams, Jobs, Users, Seats
# Each tab displays the corresponding management content
# Active tab is visually indicated
# Tab state is preserved in the URL for shareability and bookmarking
# Current functionality of each management page is preserved within its tab
# The default tab when first navigating to Management is Configuration; if the user navigates away and returns, the last-used tab is restored via URL state

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Management section contains tabs: Configuration, Departments, Project Teams, Jobs, Users, Seats
(/) Each tab displays the corresponding management content
(/) Active tab is visually indicated
(/) Tab state is preserved in the URL for shareability and bookmarking
(/) Current functionality of each management page is preserved within its tab
(/) The default tab when first navigating to Management is Configuration; last-used tab is restored via URL state

**Labels**: `navigation`, `ui`, `workshop-2026-03-01`

---

### Story 8.2: Simplify main navigation to three items

**Parent**: Unified Management Menu: Consolidated Administration Interface
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Unified Management Menu: Consolidated Administration Interface] epic. It simplifies the top-level navigation bar.

h2. User Story

As a user, I want the main navigation to show only Dashboard, Usage, and Management so that the navigation bar is clean and uncluttered.

h2. Requirements

# Main navigation displays exactly three items: Dashboard, Usage, Management
# Previous individual links (Teams, Departments, Settings, Users, Seats) are removed from the top-level navigation
# Management link navigates to the tabbed Management section
# Active state highlights correctly for all three sections

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Main navigation displays exactly three items: Dashboard, Usage, Management
(/) Previous individual links (Teams, Departments, Settings, Users, Seats) are removed from the top-level navigation
(/) Management link navigates to the tabbed Management section
(/) Active state highlights correctly for all three sections

**Labels**: `navigation`, `ui`, `workshop-2026-03-01`

---

## Epic 9: Premium Request Usage Indicators: Utilisation Metrics and Visual Status

**Jira Key**: —
**Priority**: High

**Description**:

h2. Overview

Add percentage-based premium request usage indicators and colour-coded status squares to all tables (seats, teams, departments) across the application. The indicators provide at-a-glance visibility into how much of the allowed premium request allocation each entity has consumed, with consistent colour thresholds throughout the app.

h2. Business Value

Without usage percentage indicators, users must mentally calculate utilisation for each entity. Colour-coded indicators enable instant identification of under-utilised seats, teams, and departments, supporting data-driven decisions about Copilot allocation.

h2. Success Metrics

* Every seat, team, and department table shows a usage percentage column
* A colour-coded square indicator is displayed next to every entity name
* Colour thresholds (red/orange/green) are consistent across the entire application
* Premium request allowance is configurable
* Individual usage detail pages show a prominent progress bar at the top

**Acceptance Criteria**:

(/) Usage percentage displayed on all seat, team, and department tables
(/) Colour-coded square indicators next to entity names with consistent thresholds
(/) Premium request allowance is configurable (default 300)
(/) Indicators update when the selected month changes
(/) Individual detail pages display a colour-coded progress bar at the top

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.1: Show premium request usage percentage on seat tables

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It adds individual-level usage percentage to all seat-related tables.

h2. User Story

As a user, I want to see what percentage of the allowed premium requests each individual seat holder has used so that I can quickly identify who is under- or over-utilising their allocation.

h2. Requirements

# Each seat row in all seat-related tables displays a usage percentage column
# Percentage is calculated as (seat holder's total premium requests for the month) / configurable allowance (default 300)
# Percentage is shown on: seat management table, per-seat usage table, team member detail table, department member detail table
# When usage data is not available, the percentage displays as 0% or N/A
# The premium request allowance per seat (currently 300) is defined as a configurable value in the application settings so it can be adjusted if the limit changes

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Each seat row in all seat-related tables displays a usage percentage column
(/) Percentage is calculated as (total premium requests) / configurable allowance (default 300)
(/) Percentage is shown on: seat management, per-seat usage, team member detail, department member detail tables
(/) When usage data is not available, the percentage displays as 0% or N/A
(/) Premium request allowance per seat is configurable in application settings (default 300)

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.2: Show premium request usage percentage on team tables

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It adds team-level usage percentage to team-related tables.

h2. User Story

As a user, I want to see what percentage of the team's total allowed premium requests has been used so that I can compare team-level efficiency at a glance.

h2. Requirements

# Each team row in team-related tables displays a usage percentage
# Percentage is calculated as (sum of all team members' premium requests) / (number of team members x configurable allowance)
# Percentage is shown on: team management table, team usage analytics table
# Teams with no members display 0%

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Each team row in team-related tables displays a usage percentage
(/) Percentage is calculated as (sum of all members' requests) / (number of members x configurable allowance)
(/) Percentage is shown on team management table and team usage analytics table
(/) Teams with no members display 0%

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.3: Show premium request usage percentage on department tables

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It adds department-level usage percentage to department-related tables.

h2. User Story

As a user, I want to see what percentage of the department's total allowed premium requests has been used so that I can compare department-level consumption.

h2. Requirements

# Each department row in department-related tables displays a usage percentage
# Percentage is calculated as (sum of all department members' premium requests) / (number of department members x configurable allowance)
# Percentage is shown on: department management table, department usage analytics table
# Departments with no members display 0%

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Each department row in department-related tables displays a usage percentage
(/) Percentage is calculated as (sum of all members' requests) / (number of members x configurable allowance)
(/) Percentage is shown on department management table and department usage analytics table
(/) Departments with no members display 0%

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.4: Colour-coded usage status indicator across the app

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It adds visual colour-coded status indicators next to every entity name across the application.

h2. User Story

As a user, I want to see a small colour-coded square indicator next to every username, team name, and department name based on their current premium request usage percentage so that I can visually assess utilisation at a glance.

h2. Requirements

# A small square indicator is displayed to the left of entity names (usernames, team names, department names)
# Colour thresholds are consistent across the entire application: red (0–50%), orange (50–90%), green (90–100%)
# Indicator appears everywhere an entity name is shown: seat tables, team tables, department tables, usage analytics, dashboard most/least active users
# Any existing usage indicators in the app are updated to match these consistent thresholds
# Indicator colour updates when the selected month changes
# When usage exceeds 100%, the indicator displays as green (same as the 90–100% bracket)

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) A small square indicator is displayed to the left of entity names (usernames, team names, department names)
(/) Colour thresholds: red (0–50%), orange (50–90%), green (90–100%)
(/) Indicator appears on all tables and views where entity names are shown
(/) Any existing usage indicators updated to match these thresholds
(/) Indicator colour updates when the selected month changes
(/) Usage exceeding 100% displays as green

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.5: Colour-coded usage progress bar on individual usage detail pages

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It adds a prominent progress bar at the top of each individual usage detail page for immediate utilisation visibility.

h2. User Story

As a user, I want to see a prominent colour-coded progress bar showing the premium request usage percentage at the very top of each individual usage detail page (specific team, department, or person) so that I can immediately understand the entity's utilisation level when drilling into their details.

h2. Requirements

# A progress bar showing the usage percentage is displayed at the top of every individual usage detail page (team detail, department detail, seat/person detail)
# The progress bar uses the same colour thresholds as the rest of the app: red (0–50%), orange (50–90%), green (90–100%+)
# The bar fills proportionally to the usage percentage
# The exact percentage value is displayed as text alongside or within the bar
# The bar updates when the selected month changes
# When usage data is not available, the bar displays 0% with appropriate styling

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) A progress bar showing usage percentage is displayed at the top of every individual usage detail page
(/) Progress bar uses the same colour thresholds: red (0–50%), orange (50–90%), green (90–100%+)
(/) The bar fills proportionally to the usage percentage
(/) The exact percentage value is displayed as text alongside or within the bar
(/) The bar updates when the selected month changes
(/) When usage data is not available, the bar displays 0% with appropriate styling

**Labels**: `analytics`, `ui`, `workshop-2026-03-01`

---

### Story 9.6: Cap individual usage at premium request allowance in aggregate calculations

**Parent**: Premium Request Usage Indicators: Utilisation Metrics and Visual Status
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Premium Request Usage Indicators: Utilisation Metrics and Visual Status] epic. It changes how usage percentages are calculated by capping each individual member's premium requests at the configured allowance before aggregation, preventing outliers from inflating team and department usage metrics.

h2. User Story

As a user, I want each individual's premium request usage to be capped at the configured allowance when calculating team, department, and seat usage percentages and progress bars so that the aggregate metrics reflect the included allowance utilisation rather than being inflated by outliers who exceed the cap.

h2. Requirements

# When calculating team usage percentage, each member's contribution is capped at premiumRequestsPerSeat (e.g., someone with 1000 requests and a 300 cap contributes 300 to the team total for percentage calculation)
# When calculating department usage percentage, each member's contribution is likewise capped at premiumRequestsPerSeat
# Individual seat usage percentage and progress bar are capped at 100%
# Example: Seat A = 1000 requests, Seat B = 100 requests, cap = 300 → usage = (300 + 100) / (2 × 300) = 67%, not 183%
# The cap value uses the existing configurable premiumRequestsPerSeat from application settings
# Capping applies everywhere usage % is shown: seat tables, team tables, department tables, detail page progress bars
# The totalRequests displayed in team and department summary views shows the raw (uncapped) total; only the usage percentage and progress bar reflect the per-seat cap
# On individual seat detail pages, the progress bar fills to 100% maximum and the text label shows only the percentage (capped at 100%)

h2. Technical Notes

Currently, team and department routes (e.g., /api/usage/teams, /api/usage/departments) sum raw grossQuantity per member with no cap. The change requires capping each member's per-seat contribution at premiumRequestsPerSeat before aggregating for percentage calculations. The calcUsagePercent helper in usage-helpers.ts and the progress bar component UsageProgressBar will need to enforce the cap. Raw totals continue to be displayed as-is for transparency.

**Acceptance Criteria**:

(/) When calculating team usage percentage, each member's contribution is capped at premiumRequestsPerSeat
(/) When calculating department usage percentage, each member's contribution is capped at premiumRequestsPerSeat
(/) Individual seat usage percentage and progress bar are capped at 100%
(/) Example: Seat A = 1000, Seat B = 100, cap = 300 → usage = (300 + 100) / (2 × 300) = 67%
(/) The cap uses the existing configurable premiumRequestsPerSeat from application settings
(/) Capping applies on: seat tables, team tables, department tables, detail page progress bars
(/) totalRequests in team/department views shows raw (uncapped) total; only % reflects the cap
(/) On individual seat detail pages, progress bar caps at 100% and text label shows only %

**Labels**: `analytics`, `backend`, `frontend`, `workshop-2026-03-02`

---

## Epic 10: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and Team Composition Management

**Jira Key**: —
**Priority**: High

**Description**:

h2. Overview

Improve navigation flow, editing experience, and team composition management across the application. This includes proper browser back behaviour for hierarchical views, cross-linking between management and usage pages, inline editing capabilities in tables, historical team membership backfill via date ranges, and two-mode member removal (purge vs retire).

h2. Business Value

Current navigation requires multiple clicks to move between related views (e.g., team management to team usage). Inline editing reduces friction for common data updates. Historical team membership backfill enables setting up accurate past data. Two-mode member removal gives users control over whether historical data is preserved or erased.

h2. Success Metrics

* Browser navigation behaves hierarchically within the Usage section
* Entity names are cross-linked to their usage pages from anywhere in the app
* Users can edit seat fields, team names, and department names directly in tables
* Historical team membership can be backfilled by specifying a date range for each member
* Members can be removed from a team in two modes: retire (keep history) or purge (erase all history)

**Acceptance Criteria**:

(/) Browser back from usage detail pages returns to the correct Usage tab
(/) Entity names link to their usage pages across the application
(/) Seat fields, team names, and department names are editable inline in tables
(/) Historical team membership can be backfilled via date-range assignment
(/) Two-mode member removal is available: retire (keep history) and purge (erase history)

**Labels**: `navigation`, `ui`, `usability`, `teams`, `workshop-2026-03-01`

---

### Story 10.1: Proper back navigation from usage detail pages

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History] epic. It fixes the browser back button behaviour for hierarchical usage views.

h2. User Story

As a user, I want the browser back button on a team or department usage detail page to return me to the Usage section instead of whatever page I was on before so that the navigation feels hierarchical and predictable.

h2. Requirements

# Clicking browser back from Usage > Team > [Selected Team] returns to Usage with the Team tab active
# Clicking browser back from Usage > Department > [Selected Department] returns to Usage with the Department tab active
# The month/year filter context is preserved when navigating back
# A visible breadcrumb or back link also enables this navigation without relying on the browser back button

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Browser back from Usage > Team > [Selected Team] returns to Usage with Team tab active
(/) Browser back from Usage > Department > [Selected Department] returns to Usage with Department tab active
(/) Month/year filter context is preserved when navigating back
(/) A visible breadcrumb or back link provides an alternative navigation path

**Labels**: `navigation`, `ui`, `workshop-2026-03-01`

---

### Story 10.2: Cross-linking from management to usage pages

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History] epic. It enables quick navigation between management and usage views.

h2. User Story

As a user, I want to click on a team or department name anywhere in the management section and be taken to their usage page so that I can quickly check usage without manually navigating to the Usage section.

h2. Requirements

# Team names in the team management table are clickable links to /usage/teams/[teamId]
# Department names in the department management table are clickable links to /usage/departments/[departmentId]
# Seat holder usernames in the seat table are clickable links to /usage/seats/[seatId]
# Links navigate to the usage page for the current month by default
# Visual styling indicates the name is a clickable link (e.g. underline on hover)

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Team names in team management link to /usage/teams/[teamId]
(/) Department names in department management link to /usage/departments/[departmentId]
(/) Seat holder usernames link to /usage/seats/[seatId]
(/) Links navigate to the current month's usage page by default
(/) Visual styling indicates names are clickable (e.g. underline on hover)

**Labels**: `navigation`, `ui`, `workshop-2026-03-01`

---

### Story 10.3: Inline editing of seat fields in the table

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History] epic. It replaces or supplements the existing seat edit form with inline editing directly in the table.

h2. User Story

As a user, I want to edit first name, last name, and department directly in the seat table by clicking on the field so that I can make quick changes without opening a separate edit form.

h2. Requirements

# Clicking on a first name, last name, or department cell in the seat table activates inline editing
# An input field appears in place for text fields (first name, last name)
# A dropdown appears for department selection
# Pressing Enter or clicking outside saves the change
# Pressing Escape cancels the edit and reverts to the previous value
# A loading/saving indicator is shown while the change is being persisted
# The existing separate edit form/button can be removed or kept as an alternative

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Clicking on a first name, last name, or department cell activates inline editing
(/) An input field appears in place for text fields (first name, last name)
(/) A dropdown appears for department selection
(/) Pressing Enter or clicking outside saves the change
(/) Pressing Escape cancels the edit and reverts to the previous value
(/) A loading/saving indicator is shown while saving
(/) The existing edit form/button can be removed or kept as an alternative

**Labels**: `seats`, `ui`, `workshop-2026-03-01`

---

### Story 10.4: Inline editing of team names in the management table

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History] epic. It enables quick renaming of teams directly in the table.

h2. User Story

As a user, I want to click on a team name in the team management table and edit it directly so that I can rename teams quickly without opening a separate form.

h2. Requirements

# Clicking on a team name cell activates inline editing with a text input
# Pressing Enter or clicking outside saves the updated name
# Pressing Escape cancels the edit and reverts to the previous value
# Validation prevents saving an empty name
# Validation prevents saving a duplicate team name
# A loading indicator is shown while saving
# The updated name is immediately reflected in the table

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Clicking on a team name cell activates inline editing with a text input
(/) Pressing Enter or clicking outside saves the updated name
(/) Pressing Escape cancels the edit and reverts to the previous value
(/) Validation prevents saving an empty name
(/) Validation prevents saving a duplicate team name
(/) A loading indicator is shown while saving
(/) The updated name is immediately reflected in the table

**Labels**: `teams`, `ui`, `workshop-2026-03-01`

---

### Story 10.5: Inline editing of department names in the management table

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and History] epic. It enables quick renaming of departments directly in the table.

h2. User Story

As a user, I want to click on a department name in the department management table and edit it directly so that I can rename departments quickly without opening a separate form.

h2. Requirements

# Clicking on a department name cell activates inline editing with a text input
# Pressing Enter or clicking outside saves the updated name
# Pressing Escape cancels the edit and reverts to the previous value
# Validation prevents saving an empty name or a duplicate department name
# A loading indicator is shown while saving
# The updated name is immediately reflected in the table

h2. Technical Notes

No specific technical considerations discussed.

**Acceptance Criteria**:

(/) Clicking on a department name cell activates inline editing with a text input
(/) Pressing Enter or clicking outside saves the updated name
(/) Pressing Escape cancels the edit and reverts to the previous value
(/) Validation prevents saving an empty name or a duplicate department name
(/) A loading indicator is shown while saving
(/) The updated name is immediately reflected in the table

**Labels**: `departments`, `ui`, `workshop-2026-03-01`

---

### Story 10.6: Backfill historical team membership via date-range assignment

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and Team Composition Management
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and Team Composition Management] epic. It enables setting up historical team composition data by assigning members for a range of past months.

h2. User Story

As a user, I want to select a person and specify a start/end month range to indicate when they were part of the team, so that the system creates snapshot entries for every month in that range and historical usage reflects accurate team composition.

h2. Requirements

# User can select a seat/person and specify a start month/year and end month/year
# System creates team_member_snapshot entries for every month in the specified range
# Months where the person already has a snapshot are skipped (idempotent)
# Validation prevents selecting future months beyond the current month
# Validation prevents submitting a date range where the start month/year is after the end month/year
# Backfill is not allowed for soft-deleted teams — the system returns an error if the team has been deleted
# Historical usage data reflects the backfilled composition immediately
# A success message indicates how many months were added

h2. Technical Notes

This extends the existing team_member_snapshot model (Story 7.4) by allowing writes for past months. Currently, the POST /api/teams/[id]/members endpoint restricts inserts to the current month only.

**Acceptance Criteria**:

(/) User can select a seat/person and specify a start month/year and end month/year
(/) System creates team_member_snapshot entries for every month in the specified range
(/) Months where the person already has a snapshot are skipped (idempotent)
(/) Validation prevents selecting future months beyond the current month
(/) Validation prevents submitting a date range where the start month/year is after the end month/year
(/) Backfill is not allowed for soft-deleted teams — the system returns an error if the team has been deleted
(/) Historical usage data reflects the backfilled composition immediately
(/) A success message indicates how many months were added

**Labels**: `teams`, `backend`, `ui`, `workshop-2026-03-01`

---

### Story 10.7: Two-mode member removal (purge vs retire)

**Parent**: Navigation and Usability Improvements: Cross-Linking, Inline Editing, and Team Composition Management
**Jira Key**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:

h2. Context

This story is part of the [Navigation and Usability Improvements: Cross-Linking, Inline Editing, and Team Composition Management] epic. It provides two distinct modes for removing a member from a team, each with different data retention behaviour.

h2. User Story

As a user, I want two options when removing a member from a team — retire (keep history) or purge (erase all history) — so that I can correctly manage team composition for different scenarios.

h2. Requirements

# Retire (default): Remove the member from the current month only. Historical snapshots are preserved. The person will not be carried forward by Story 7.7.
# Purge: Remove the member from ALL months (past and current). All team_member_snapshot entries for this person in this team are deleted. Usage data no longer includes this person for any month.
# The purge option requires explicit confirmation (e.g., a confirmation dialog) because it is destructive
# The purge confirmation dialog shows how many months of history will be affected (e.g., "This will remove Alice from 8 months of team history")
# The UI clearly explains the consequence of each option before the user confirms
# After removal, the team's member list and usage data are updated accordingly

h2. Technical Notes

The current DELETE /api/teams/[id]/members endpoint only removes from the current month (retire behaviour). A new "purge" mode needs to delete across ALL months for the specified seatIds.

**Acceptance Criteria**:

(/) Retire (default): Remove the member from the current month only. Historical snapshots are preserved. The person will not be carried forward by Story 7.7.
(/) Purge: Remove the member from ALL months. All team_member_snapshot entries for this person in this team are deleted.
(/) The purge option requires explicit confirmation dialog
(/) The purge confirmation dialog shows impact scope (number of months affected)
(/) The UI clearly explains the consequence of each option before the user confirms
(/) After removal, the team's member list and usage data are updated accordingly

**Labels**: `teams`, `backend`, `ui`, `workshop-2026-03-01`
