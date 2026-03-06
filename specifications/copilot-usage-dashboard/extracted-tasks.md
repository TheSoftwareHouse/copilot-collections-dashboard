# Copilot Usage Dashboard - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — requirements document |
| Participants | N/A |
| Source Materials | project.md (requirements document), user feature requests (2026-03-01) |
| Total Epics | 10 |
| Total Stories | 37 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Application Configuration | 3 | Critical |
| 2 | Authentication & User Management | 2 | Critical |
| 3 | Copilot Seat Management | 4 | Critical |
| 4 | Usage Data Collection | 2 | Critical |
| 5 | Dashboard | 2 | High |
| 6 | Usage Analytics | 3 | High |
| 7 | Team & Department Management | 6 | Medium |
| 8 | Unified Management Menu | 2 | High |
| 9 | Premium Request Usage Indicators | 6 | High |
| 10 | Navigation and Usability Improvements | 7 | High |

## Epic 1: Application Configuration

**Business Description**: Allow administrators to configure the application on first run by choosing whether the system operates at the organisation or enterprise level and providing the necessary GitHub connection details. Configuration is persisted so the system operates autonomously after initial setup.

**Success Criteria**:
- Administrator can complete first-run configuration and the system begins operating with the selected settings
- Configuration is stored persistently and survives application restarts

### Story 1.1: Admin can configure organisation or enterprise settings on first run

**User Story**: As an admin, I want to configure whether the application uses organisation or enterprise GitHub endpoints on first run so that the system connects to the correct data source.

**Acceptance Criteria**:
- [ ] First-run setup screen is displayed when no configuration exists
- [ ] Admin can choose between organisation-level and enterprise-level endpoints
- [ ] Admin can provide the organisation or enterprise name
- [ ] Configuration is saved to the database after submission
- [ ] After saving, the system begins operating with the selected configuration

**High-Level Technical Notes**: The system must support both GitHub organisation and enterprise API endpoints for seat and usage data. The endpoint choice determines which GitHub APIs are called.

**Priority**: Critical

### Story 1.2: Admin can view and update application configuration

**User Story**: As an admin, I want to view and update the application configuration after initial setup so that I can adjust settings if the organisation structure changes.

**Acceptance Criteria**:
- [ ] Admin can access a configuration settings page
- [ ] Current configuration values are displayed
- [ ] Admin can update the organisation/enterprise name and endpoint type
- [ ] Changes are saved to the database

**High-Level Technical Notes**: None

**Priority**: Medium

### Story 1.3: Admin can view sync and collection job status

**User Story**: As an admin, I want to view the status of background sync and collection jobs so that I can verify the system is operating correctly.

**Acceptance Criteria**:
- [ ] Admin can see when the last seat sync ran and whether it succeeded
- [ ] Admin can see when the last usage collection ran and whether it succeeded
- [ ] Error details are displayed if the last run failed

**High-Level Technical Notes**: None

**Priority**: Medium

## Epic 2: Authentication & User Management

**Business Description**: Provide secure access to the application through username and password authentication. Administrators can manage which users have access to the dashboard by creating, editing, and removing user accounts.

**Success Criteria**:
- Users can log in securely with username and password
- Admins can control who has access to the application

### Story 2.1: User can log in with username and password

**User Story**: As a user, I want to log in with my username and password so that I can access the Copilot usage dashboard securely.

**Acceptance Criteria**:
- [ ] Login page is displayed when user is not authenticated
- [ ] User can enter username and password to log in
- [ ] Valid credentials grant access to the application
- [ ] Invalid credentials display a clear error message
- [ ] Authenticated session is maintained across page navigation
- [ ] Session expires after a period of inactivity and the user is redirected to the login page

**High-Level Technical Notes**: None

**Priority**: Critical

### Story 2.2: Admin can manage application users

**User Story**: As an admin, I want to create, edit, and remove user accounts so that I can control who has access to the dashboard.

**Acceptance Criteria**:
- [ ] Admin can view a list of all application users
- [ ] Admin can create a new user with username and password
- [ ] Admin can edit an existing user's details
- [ ] Admin can remove a user account
- [ ] Removed users can no longer log in

**High-Level Technical Notes**: None

**Priority**: Critical

## Epic 3: Copilot Seat Management

**Business Description**: Synchronise GitHub Copilot seat assignments from the GitHub API on a daily basis. Seats are the foundational data entity — once imported, they are never removed from the application but are flagged with a status indicating whether they are active or unused. Users can enrich seat records with additional metadata.

**Success Criteria**:
- All Copilot seat assignments from GitHub are reflected in the application
- Seats are synced daily without manual intervention
- Unused seats are clearly flagged for visibility

### Story 3.1: System syncs Copilot seats from GitHub API daily

**User Story**: As a system, I want to automatically fetch the list of Copilot seats from the GitHub API daily so that the application always has an up-to-date record of seat assignments.

**Acceptance Criteria**:
- [ ] System calls the appropriate GitHub API endpoint (organisation or enterprise) based on configuration
- [ ] All current seat assignments are imported into the application database
- [ ] New seats discovered during sync are added to the database
- [ ] Sync runs automatically on a daily schedule
- [ ] Sync results are logged for troubleshooting
- [ ] If the GitHub API returns an error, the sync logs the error and retries on the next scheduled run
- [ ] Existing seat data is not corrupted or lost when a sync fails
- [ ] Sync does not run if application configuration has not been completed; the skipped run is logged

**High-Level Technical Notes**: Depending on configuration, the system uses either organisation or enterprise GitHub endpoints to fetch seats.

**Priority**: Critical

### Story 3.2: System flags unused seats with appropriate status

**User Story**: As a system, I want to flag seats that are no longer active in GitHub as unused so that administrators can identify seats that may need attention.

**Acceptance Criteria**:
- [ ] Seats that are no longer returned by the GitHub API are marked as unused/inactive
- [ ] Seats are never deleted from the application database
- [ ] The status of each seat is clearly visible in the seat list
- [ ] Previously unused seats that reappear in the API are restored to active status

**High-Level Technical Notes**: None

**Priority**: Critical

### Story 3.3: User can view list of Copilot seats

**User Story**: As a user, I want to view a list of all Copilot seats with their GitHub username, status, first name, last name, and department so that I can see who has a seat and their details.

**Acceptance Criteria**:
- [ ] Seat list displays GitHub username, status (active/unused), first name, last name, and department for each seat
- [ ] Seat list is accessible from the main navigation
- [ ] List supports pagination or scrolling for large numbers of seats
- [ ] An informative empty state is shown when no seats have been synced yet

**High-Level Technical Notes**: None

**Priority**: High

### Story 3.4: User can edit seat holder's first name, last name, and department

**User Story**: As a user, I want to edit the first name, last name, and department of a seat holder so that I can enrich the seat data with information not available from GitHub.

**Acceptance Criteria**:
- [ ] User can edit first name, last name, and department fields on a seat record
- [ ] Changes are saved to the database
- [ ] Updated values are immediately reflected in the seat list
- [ ] Editing does not affect the GitHub username or seat status

**High-Level Technical Notes**: None

**Priority**: High

## Epic 4: Usage Data Collection

**Business Description**: Collect per-user Copilot premium request usage data from the GitHub billing API at regular intervals. This data is the foundation for all dashboard metrics and analytics views. Each usage record is unique per user, day, month, and year.

**Success Criteria**:
- Per-user usage data is collected for every active seat holder at the configured interval
- Data is stored with per-day granularity and is unique by user and date
- Usage data includes model-level breakdown (model name, quantity, cost)

### Story 4.1: System collects per-user usage from GitHub API on configured interval

**User Story**: As a system, I want to fetch premium request usage data for each active seat holder from the GitHub billing API at a regular interval so that the dashboard always has current usage data.

**Acceptance Criteria**:
- [ ] System calls the GitHub premium request usage API for each user with an active seat
- [ ] Usage data is fetched for each day since the last successful collection
- [ ] Data includes: product, SKU, model, unit type, price per unit, gross quantity, gross amount, discount quantity, discount amount, net quantity, net amount
- [ ] Collection runs automatically at the configured interval
- [ ] Collection results are logged for troubleshooting
- [ ] If the GitHub API returns an error for a specific user, the system logs the error and continues collecting data for remaining users
- [ ] Failed collections are retried on the next scheduled run

**High-Level Technical Notes**: API endpoint: `https://api.github.com/organizations/<org>/settings/billing/premium_request/usage?user=<username>&day=<day>&month=<month>&year=<year>`. Response includes per-model usage items.

**Priority**: Critical

### Story 4.2: Usage data is stored uniquely per user, day, month, and year

**User Story**: As a system, I want to store usage data uniquely by user, day, month, and year so that duplicate records are prevented and historical data is accurate.

**Acceptance Criteria**:
- [ ] Database enforces uniqueness on the combination of user, day, month, and year
- [ ] If data for a given user+date already exists, it is updated rather than duplicated
- [ ] All usage item details (per-model breakdowns) are preserved in the database
- [ ] Historical data is retained and accessible for any past date

**High-Level Technical Notes**: None

**Priority**: Critical

## Epic 5: Dashboard

**Business Description**: Provide a summary dashboard showing key Copilot usage metrics for a given month. This gives stakeholders a quick, high-level view of seat utilisation, spending, model usage distribution, and user activity rankings.

**Success Criteria**:
- Dashboard displays meaningful monthly summary metrics at a glance
- Users can switch between months to compare usage trends

### Story 5.1: User can view general monthly usage metrics

**User Story**: As a user, I want to see a dashboard with key Copilot usage metrics for a specific month so that I can understand overall adoption and spending at a glance.

**Acceptance Criteria**:
- [ ] Dashboard displays total number of seats
- [ ] Dashboard displays total usage per each model (e.g., Claude Haiku 4.5, Claude Sonnet 4.5)
- [ ] Dashboard displays most active users for the selected month
- [ ] Dashboard displays least active users for the selected month
- [ ] Dashboard displays current spending for the selected month
- [ ] Dashboard is the default landing page after login
- [ ] Dashboard displays an informative empty state when no usage data is available for the selected month

**High-Level Technical Notes**: None

**Priority**: High

### Story 5.2: User can filter dashboard by month

**User Story**: As a user, I want to filter the dashboard data by month so that I can compare usage and spending across different time periods.

**Acceptance Criteria**:
- [ ] Month filter is visible on the dashboard
- [ ] Selecting a different month refreshes all dashboard metrics for that month
- [ ] Current month is selected by default
- [ ] All months with available data are selectable

**High-Level Technical Notes**: None

**Priority**: High

## Epic 6: Usage Analytics

**Business Description**: Provide detailed usage analytics views organised in three tabs: Seat, Team, and Department. Each tab shows per-entity usage for a selected month, allowing users to drill down from individual seats to team and department level aggregations.

**Success Criteria**:
- Users can view detailed per-seat, per-team, and per-department usage for any month
- The default tab is Seat, with Team and Department tabs readily accessible
- Data is presented in a paginated, easy-to-navigate format

### Story 6.1: User can view per-seat usage for a specific month

**User Story**: As a user, I want to view usage data broken down by individual seat for a specific month so that I can identify individual consumption patterns.

**Acceptance Criteria**:
- [ ] Seat tab is the default active tab in the Usage section
- [ ] Per-seat usage is displayed for the selected month
- [ ] Each row shows the seat holder's usage metrics (models used, quantities, costs)
- [ ] Results are paginated
- [ ] Month filter allows switching between months
- [ ] An informative empty state is shown when no per-seat usage data exists for the selected month

**High-Level Technical Notes**: None

**Priority**: High

### Story 6.2: User can view per-team usage for a specific month

**User Story**: As a user, I want to view usage data aggregated by team for a specific month so that I can compare team-level consumption and identify trends.

**Acceptance Criteria**:
- [ ] Team tab shows a list of teams with aggregated usage for the selected month
- [ ] Each team entry shows team name and aggregated metrics (total usage, average per member, cost)
- [ ] User can drill into a team to see individual member usage
- [ ] Month filter allows switching between months
- [ ] An informative message is shown when no teams have been defined
- [ ] Teams with no members display zero usage, not an error

**High-Level Technical Notes**: None

**Priority**: High

### Story 6.3: User can view per-department usage for a specific month

**User Story**: As a user, I want to view usage data aggregated by department for a specific month so that I can compare department-level consumption.

**Acceptance Criteria**:
- [ ] Department tab shows a list of departments with aggregated usage for the selected month
- [ ] Each department entry shows department name and aggregated metrics (total usage, average per member, cost)
- [ ] User can drill into a department to see individual member usage
- [ ] Month filter allows switching between months
- [ ] An informative message is shown when no departments have been defined
- [ ] Departments with no assigned seats display zero usage, not an error

**High-Level Technical Notes**: None

**Priority**: High

## Epic 7: Team & Department Management

**Business Description**: Allow users to define teams and departments for organising seat holders. Teams consist of specific GitHub users (seats) and their composition may change monthly. The system tracks team composition per month to enable historical comparisons. Departments are simple named groupings.

**Success Criteria**:
- Users can create and manage teams and departments
- Team composition is tracked monthly to support historical usage analysis
- Average premium request usage per team is calculated based on team member data

### Story 7.1: User can define teams

**User Story**: As a user, I want to create teams with a name so that I can group seat holders for usage tracking purposes.

**Acceptance Criteria**:
- [ ] User can create a new team by providing a name
- [ ] User can view a list of all teams
- [ ] User can edit a team's name
- [ ] User can delete a team
- [ ] Deleting a team removes its current member assignments
- [ ] Historical team composition snapshots and usage data are preserved after deletion

**High-Level Technical Notes**: None

**Priority**: Medium

### Story 7.2: User can assign seats to a team

**User Story**: As a user, I want to assign seat holders (GitHub users) to a team so that usage can be aggregated at the team level.

**Acceptance Criteria**:
- [ ] User can add one or more seats to a team
- [ ] User can remove seats from a team
- [ ] A seat can belong to one or more teams (not explicitly restricted)
- [ ] Current team membership is visible when viewing the team

**High-Level Technical Notes**: None

**Priority**: Medium

### Story 7.3: System calculates average premium request usage per team

**User Story**: As a user, I want to see the average Copilot premium request usage for a team based on its members' individual usage so that I can evaluate team-level efficiency.

**Acceptance Criteria**:
- [ ] Average premium request usage per team is calculated based on individual member data
- [ ] Average is displayed on the team detail view and team usage tab
- [ ] Calculation uses data from the selected month

**High-Level Technical Notes**: None

**Priority**: Medium

### Story 7.4: System tracks team composition per month

**User Story**: As a user, I want team composition changes to be tracked per month so that I can view historical team usage even when membership has changed over time.

**Acceptance Criteria**:
- [ ] Each month's team composition is stored as a snapshot
- [ ] Historical usage reflects the team composition at that point in time, not the current composition
- [ ] Changing team membership in the current month does not alter historical records
- [ ] User can view past team compositions by selecting a previous month

**High-Level Technical Notes**: Team composition may change monthly. The system needs to track composition separately per month to allow historical comparison.

**Priority**: Medium

### Story 7.5: User can define departments

**User Story**: As a user, I want to create departments with a name so that I can categorise seat holders by organisational unit.

**Acceptance Criteria**:
- [ ] User can create a new department by providing a name
- [ ] User can view a list of all departments
- [ ] User can edit a department's name
- [ ] User can delete a department
- [ ] Deleting a department clears the department assignment from all seats in that department
- [ ] User is warned before deleting a department that has seats assigned to it

**High-Level Technical Notes**: None

**Priority**: Medium

### Story 7.6: User can assign a department to a seat holder

**User Story**: As a user, I want to assign a department to a seat holder so that usage can be aggregated at the department level.

**Acceptance Criteria**:
- [ ] Department is selectable when editing a seat holder's details
- [ ] Each seat holder can belong to one department
- [ ] Department assignment is reflected in the seat list and department usage tab

**High-Level Technical Notes**: This connects to Story 3.4 where department is an editable field on the seat record.

**Priority**: Medium

### Story 7.7: System automatically carries team composition forward to the next month

**User Story**: As a user, I want the system to automatically carry the current month's team composition into the next month so that teams do not start each month empty and I do not have to manually re-add all members.

**Acceptance Criteria**:
- [ ] At the start of a new month, the system automatically copies the previous month's team composition snapshot for every active team
- [ ] The carry-forward only runs once per month transition (idempotent — running again does not create duplicates)
- [ ] Teams that were soft-deleted are excluded from carry-forward
- [ ] After carry-forward, the user can still add or remove members from the new month's snapshot as usual
- [ ] If the previous month had no snapshot for a team, no snapshot is created for the new month
- [ ] The carry-forward operation is logged as a job execution for monitoring

**High-Level Technical Notes**: Currently, team member snapshots are created per-month only when a user manually adds members. This story automates the month transition so teams retain their composition. The carry-forward should leverage the existing `team_member_snapshot` table and the `ON CONFLICT DO NOTHING` pattern for idempotency.

**Priority**: Medium

## Epic 8: Unified Management Menu

**Business Description**: Consolidate all management-related pages (Configuration, Departments, Project Teams, Jobs, Users, Seats) into a single "Management" navigation item with internal tabs. This simplifies the main navigation and provides a single entry point for all administrative functions.

**Success Criteria**:
- All management pages are accessible from a single Management section
- Main navigation is simplified to three items: Dashboard, Usage, Management
- Users can easily switch between management areas using tabs

### Story 8.1: Consolidate management pages under a tabbed Management section

**User Story**: As a user, I want all management pages (Configuration, Departments, Project Teams, Jobs, Users, Seats) to be accessible from a single Management section with tabs so that I can easily switch between management areas without navigating to separate pages.

**Acceptance Criteria**:
- [ ] Management section contains tabs: Configuration, Departments, Project Teams, Jobs, Users, Seats
- [ ] Each tab displays the corresponding management content
- [ ] Active tab is visually indicated
- [ ] Tab state is preserved in the URL for shareability and bookmarking
- [ ] Current functionality of each management page is preserved within its tab
- [ ] The default tab when first navigating to Management is Configuration; if the user navigates away and returns, the last-used tab is restored via URL state

**High-Level Technical Notes**: None

**Priority**: High

### Story 8.2: Simplify main navigation to three items

**User Story**: As a user, I want the main navigation to show only Dashboard, Usage, and Management so that the navigation bar is clean and uncluttered.

**Acceptance Criteria**:
- [ ] Main navigation displays exactly three items: Dashboard, Usage, Management
- [ ] Previous individual links (Teams, Departments, Settings, Users, Seats) are removed from the top-level navigation
- [ ] Management link navigates to the tabbed Management section
- [ ] Active state highlights correctly for all three sections

**High-Level Technical Notes**: None

**Priority**: High

## Epic 9: Premium Request Usage Indicators

**Business Description**: Add percentage-based premium request usage indicators and colour-coded status squares to all tables (seats, teams, departments) across the application. The indicators provide at-a-glance visibility into how much of the allowed premium request allocation each entity has consumed, with consistent colour thresholds throughout the app.

**Success Criteria**:
- Every seat, team, and department table shows a usage percentage column
- A colour-coded square indicator is displayed next to every entity name
- Colour thresholds are consistent across the entire application
- Individual usage detail pages show a prominent progress bar at the top

### Story 9.1: Show premium request usage percentage on seat tables

**User Story**: As a user, I want to see what percentage of the allowed 300 premium requests each individual seat holder has used so that I can quickly identify who is under- or over-utilising their allocation.

**Acceptance Criteria**:
- [ ] Each seat row in all seat-related tables displays a usage percentage column
- [ ] Percentage is calculated as (seat holder's total premium requests for the month) / configurable allowance (default 300)
- [ ] Percentage is shown on: seat management table, per-seat usage table, team member detail table, department member detail table
- [ ] When usage data is not available, the percentage displays as 0% or N/A
- [ ] The premium request allowance per seat (currently 300) is defined as a configurable value in the application settings so it can be adjusted if the limit changes

**High-Level Technical Notes**: None

**Priority**: High

### Story 9.2: Show premium request usage percentage on team tables

**User Story**: As a user, I want to see what percentage of the team's total allowed premium requests has been used so that I can compare team-level efficiency at a glance.

**Acceptance Criteria**:
- [ ] Each team row in team-related tables displays a usage percentage
- [ ] Percentage is calculated as (sum of all team members' premium requests) / (number of team members × 300)
- [ ] Percentage is shown on: team management table, team usage analytics table
- [ ] Teams with no members display 0%

**High-Level Technical Notes**: None

**Priority**: High

### Story 9.3: Show premium request usage percentage on department tables

**User Story**: As a user, I want to see what percentage of the department's total allowed premium requests has been used so that I can compare department-level consumption.

**Acceptance Criteria**:
- [ ] Each department row in department-related tables displays a usage percentage
- [ ] Percentage is calculated as (sum of all department members' premium requests) / (number of department members × 300)
- [ ] Percentage is shown on: department management table, department usage analytics table
- [ ] Departments with no members display 0%

**High-Level Technical Notes**: None

**Priority**: High

### Story 9.4: Colour-coded usage status indicator across the app

**User Story**: As a user, I want to see a small colour-coded square indicator next to every username, team name, and department name based on their current premium request usage percentage so that I can visually assess utilisation at a glance.

**Acceptance Criteria**:
- [ ] A small square indicator is displayed to the left of entity names (usernames, team names, department names)
- [ ] Colour thresholds are consistent across the entire application: red (0–50%), orange (50–90%), green (90–100%)
- [ ] Indicator appears everywhere an entity name is shown: seat tables, team tables, department tables, usage analytics, dashboard most/least active users
- [ ] Any existing usage indicators in the app are updated to match these consistent thresholds
- [ ] Indicator colour updates when the selected month changes
- [ ] When usage exceeds 100%, the indicator displays as green (same as the 90–100% bracket)

**High-Level Technical Notes**: None

**Priority**: High

### Story 9.5: Colour-coded usage progress bar on individual usage detail pages

**User Story**: As a user, I want to see a prominent colour-coded progress bar showing the premium request usage percentage at the very top of each individual usage detail page (specific team, department, or person) so that I can immediately understand the entity's utilisation level when drilling into their details.

**Acceptance Criteria**:
- [ ] A progress bar showing the usage percentage is displayed at the top of every individual usage detail page (team detail, department detail, seat/person detail)
- [ ] The progress bar uses the same colour thresholds as the rest of the app: red (0–50%), orange (50–90%), green (90–100%+)
- [ ] The bar fills proportionally to the usage percentage
- [ ] The exact percentage value is displayed as text alongside or within the bar
- [ ] The bar updates when the selected month changes
- [ ] When usage data is not available, the bar displays 0% with appropriate styling

**High-Level Technical Notes**: None

**Priority**: High

### Story 9.6: Cap individual usage at premium request allowance in aggregate calculations

**User Story**: As a user, I want each individual's premium request usage to be capped at the configured allowance when calculating team, department, and seat usage percentages and progress bars so that the aggregate metrics reflect the included allowance utilisation rather than being inflated by outliers who exceed the cap.

**Acceptance Criteria**:
- [ ] When calculating team usage percentage, each member's contribution is capped at premiumRequestsPerSeat (e.g., someone with 1000 requests and a 300 cap contributes 300 to the team total for percentage calculation)
- [ ] When calculating department usage percentage, each member's contribution is likewise capped at premiumRequestsPerSeat
- [ ] Individual seat usage percentage and progress bar are capped at 100%
- [ ] Example: Seat A = 1000 requests, Seat B = 100 requests, cap = 300 → usage = (300 + 100) / (2 × 300) = 67%, not 183%
- [ ] The cap value uses the existing configurable premiumRequestsPerSeat from application settings
- [ ] Capping applies everywhere usage % is shown: seat tables, team tables, department tables, detail page progress bars
- [ ] The totalRequests displayed in team and department summary views shows the raw (uncapped) total; only the usage percentage and progress bar reflect the per-seat cap
- [ ] On individual seat detail pages, the progress bar fills to 100% maximum and the text label shows only the percentage (capped at 100%)

**High-Level Technical Notes**: Currently, team and department routes (e.g., `/api/usage/teams`, `/api/usage/departments`) sum raw `grossQuantity` per member with no cap. The change requires capping each member's per-seat contribution at `premiumRequestsPerSeat` before aggregating for percentage calculations. The `calcUsagePercent` helper in `usage-helpers.ts` and the progress bar component `UsageProgressBar` will need to enforce the cap. Raw totals continue to be displayed as-is for transparency.

**Priority**: High

## Epic 10: Navigation and Usability Improvements

**Business Description**: Improve navigation flow and editing experience across the application. This includes proper browser back behaviour for hierarchical views, cross-linking between management and usage pages, inline editing capabilities in tables, historical team membership backfill via date ranges, and two-mode member removal (purge vs retire).

**Success Criteria**:
- Browser navigation behaves hierarchically within the Usage section
- Entity names are cross-linked to their usage pages from anywhere in the app
- Users can edit seat fields, team names, and department names directly in tables
- Historical team membership can be backfilled by specifying a date range for each member
- Members can be removed from a team in two modes: retire (keep history) or purge (erase all history)

### Story 10.1: Proper back navigation from usage detail pages

**User Story**: As a user, I want the browser back button on a team or department usage detail page to return me to the Usage section instead of whatever page I was on before so that the navigation feels hierarchical and predictable.

**Acceptance Criteria**:
- [ ] Clicking browser back from Usage > Team > [Selected Team] returns to Usage with the Team tab active
- [ ] Clicking browser back from Usage > Department > [Selected Department] returns to Usage with the Department tab active
- [ ] The month/year filter context is preserved when navigating back
- [ ] A visible breadcrumb or back link also enables this navigation without relying on the browser back button

**High-Level Technical Notes**: None

**Priority**: High

### Story 10.2: Cross-linking from management to usage pages

**User Story**: As a user, I want to click on a team or department name anywhere in the management section and be taken to their usage page so that I can quickly check usage without manually navigating to the Usage section.

**Acceptance Criteria**:
- [ ] Team names in the team management table are clickable links to /usage/teams/[teamId]
- [ ] Department names in the department management table are clickable links to /usage/departments/[departmentId]
- [ ] Seat holder usernames in the seat table are clickable links to /usage/seats/[seatId]
- [ ] Links navigate to the usage page for the current month by default
- [ ] Visual styling indicates the name is a clickable link (e.g. underline on hover)

**High-Level Technical Notes**: None

**Priority**: High

### Story 10.3: Inline editing of seat fields in the table

**User Story**: As a user, I want to edit first name, last name, and department directly in the seat table by clicking on the field so that I can make quick changes without opening a separate edit form.

**Acceptance Criteria**:
- [ ] Clicking on a first name, last name, or department cell in the seat table activates inline editing
- [ ] An input field appears in place for text fields (first name, last name)
- [ ] A dropdown appears for department selection
- [ ] Pressing Enter or clicking outside saves the change
- [ ] Pressing Escape cancels the edit and reverts to the previous value
- [ ] A loading/saving indicator is shown while the change is being persisted
- [ ] The existing separate edit form/button can be removed or kept as an alternative

**High-Level Technical Notes**: None

**Priority**: High

### Story 10.4: Inline editing of team names in the management table

**User Story**: As a user, I want to click on a team name in the team management table and edit it directly so that I can rename teams quickly without opening a separate form.

**Acceptance Criteria**:
- [ ] Clicking on a team name cell activates inline editing with a text input
- [ ] Pressing Enter or clicking outside saves the updated name
- [ ] Pressing Escape cancels the edit and reverts to the previous value
- [ ] Validation prevents saving an empty name
- [ ] Validation prevents saving a duplicate team name
- [ ] A loading indicator is shown while saving
- [ ] The updated name is immediately reflected in the table

**High-Level Technical Notes**: None

**Priority**: High

### Story 10.5: Inline editing of department names in the management table

**User Story**: As a user, I want to click on a department name in the department management table and edit it directly so that I can rename departments quickly without opening a separate form.

**Acceptance Criteria**:
- [ ] Clicking on a department name cell activates inline editing with a text input
- [ ] Pressing Enter or clicking outside saves the updated name
- [ ] Pressing Escape cancels the edit and reverts to the previous value
- [ ] Validation prevents saving an empty name or a duplicate department name
- [ ] A loading indicator is shown while saving
- [ ] The updated name is immediately reflected in the table

**High-Level Technical Notes**: None

**Priority**: High

### Story 10.6: Backfill historical team membership via date-range assignment

**User Story**: As a user, I want to select a person and specify a start/end month range to indicate when they were part of the team, so that the system creates snapshot entries for every month in that range and historical usage reflects accurate team composition.

**Acceptance Criteria**:
- [ ] User can select a seat/person and specify a start month/year and end month/year
- [ ] System creates team_member_snapshot entries for every month in the specified range
- [ ] Months where the person already has a snapshot are skipped (idempotent)
- [ ] Validation prevents selecting future months beyond the current month
- [ ] Validation prevents submitting a date range where the start month/year is after the end month/year
- [ ] Backfill is not allowed for soft-deleted teams — the system returns an error if the team has been deleted
- [ ] Historical usage data reflects the backfilled composition immediately
- [ ] A success message indicates how many months were added

**High-Level Technical Notes**: This extends the existing team_member_snapshot model (Story 7.4) by allowing writes for past months. Currently, the POST /api/teams/[id]/members endpoint restricts inserts to the current month only.

**Priority**: High

### Story 10.7: Two-mode member removal (purge vs retire)

**User Story**: As a user, I want two options when removing a member from a team — retire (keep history) or purge (erase all history) — so that I can correctly manage team composition for different scenarios.

**Acceptance Criteria**:
- [ ] Retire (default): Remove the member from the current month only. Historical snapshots are preserved. The person will not be carried forward by Story 7.7.
- [ ] Purge: Remove the member from ALL months (past and current). All team_member_snapshot entries for this person in this team are deleted. Usage data no longer includes this person for any month.
- [ ] The purge option requires explicit confirmation (e.g., a confirmation dialog) because it is destructive
- [ ] The purge confirmation dialog shows how many months of history will be affected (e.g., "This will remove Alice from 8 months of team history")
- [ ] The UI clearly explains the consequence of each option before the user confirms
- [ ] After removal, the team's member list and usage data are updated accordingly

**High-Level Technical Notes**: The current DELETE /api/teams/[id]/members endpoint only removes from the current month (retire behaviour). A new "purge" mode needs to delete across ALL months for the specified seatIds.

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Epic 3 (Seat Management) | Story 1.1 | Blocked by | Seat sync requires configuration to know which GitHub API endpoints to use |
| Epic 4 (Usage Data Collection) | Story 3.1 | Blocked by | Usage collection needs the list of active seats to know which users to fetch data for |
| Epic 5 (Dashboard) | Story 4.1 | Blocked by | Dashboard metrics are derived from collected usage data |
| Epic 6 (Usage Analytics) | Story 4.1 | Blocked by | Analytics views depend on usage data being available |
| Story 6.2 (Team usage) | Story 7.2 | Blocked by | Team usage view requires teams to have members assigned |
| Story 6.3 (Department usage) | Story 7.6 | Blocked by | Department usage view requires seats to have departments assigned |
| Story 7.3 (Team avg usage) | Story 4.1 | Blocked by | Team average calculation depends on individual usage data |
| Story 7.4 (Team composition tracking) | Story 7.2 | Blocked by | Composition tracking requires team membership to exist |
| Epic 8 (Unified Management Menu) | Epics 1, 2, 7 | Related to | Consolidates existing management pages into tabbed layout |
| Epic 9 (Usage Indicators) | Story 4.1 | Blocked by | Usage percentage calculations require collected usage data |
| Story 9.2 (Team usage %) | Story 7.2 | Blocked by | Team usage % requires team membership data |
| Story 9.3 (Dept usage %) | Story 7.6 | Blocked by | Department usage % requires department assignment data |
| Story 9.5 (Detail page progress bar) | Stories 9.1, 9.2, 9.3 | Related to | Uses the same usage % calculations and colour thresholds |
| Story 9.6 (Cap usage in aggregates) | Stories 9.1, 9.2, 9.3, 9.5 | Modifies | Changes percentage calculation logic to cap per-seat contributions |
| Story 10.1 (Back navigation) | Story 6.2, 6.3 | Related to | Improves navigation within existing usage detail pages |
| Story 10.2 (Cross-linking) | Epics 6, 7 | Related to | Links management entities to their corresponding usage pages |
| Story 10.3 (Inline seat editing) | Story 3.4 | Modifies | Replaces or supplements the existing edit form from Story 3.4 |
| Story 7.7 (Team composition carry-forward) | Story 7.4 | Blocked by | Carry-forward requires monthly composition snapshots to exist |
| Story 10.6 (Backfill historical membership) | Story 7.2 | Blocked by | Requires team member management to exist |
| Story 10.7 (Two-mode removal) | Story 7.2 | Blocked by | Extends existing member removal endpoint |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | A seat holder can belong to multiple teams but only one department | Medium | If seats can belong to multiple departments, the department usage view and data model need adjustment |
| 2 | The GitHub billing API endpoint shown in project.md is stable and available for all organisation types | Medium | If the API differs or requires additional authentication, the usage collection stories would need revision |
| 3 | "Users" of the dashboard application are separate from "seat holders" (GitHub Copilot users) — they are two distinct entities | High | If they are the same, the authentication and seat management epics would need to be combined |
| 4 | The daily seat sync and periodic usage collection are background server processes, not manually triggered | High | If manual triggering is required, additional stories for trigger UI would be needed |
| 5 | All users of the dashboard have the same view permissions — there are no role-based restrictions on what data is visible beyond admin user management | Medium | If role-based access is needed, additional stories for permissions would be required |
| 6 | Department assignment to a seat holder is the same field as the "department" editable in the seat list (Story 3.4 and 7.6 are connected) | High | If they are separate, the data model and stories need adjustment |

## Out of Scope

Items not covered in this task breakdown:
- Technical implementation details (technology stack, architecture, deployment) — to be determined by the architect
- GitHub API authentication setup and token management — assumed to be part of infrastructure/configuration
- Email notifications or alerts (e.g., for unused seats or budget thresholds) — not mentioned in requirements
- Export functionality (CSV, PDF reports) — not mentioned in requirements
- Multi-tenancy (supporting multiple organisations in a single deployment) — not mentioned in requirements
- Real-time usage updates — the system operates on interval-based collection

## Open Questions for Stakeholders

| # | Question | Context | Impact |
|---|----------|---------|--------|
| 1 | What is the configured interval for usage data collection? | The requirements say "specific interval" but don't specify the frequency | Affects system design and data freshness expectations |
| 2 | Can a seat holder belong to multiple teams simultaneously? | Requirements say seats are assigned to teams but don't clarify exclusivity | Affects team usage calculations and data model |
| 3 | Should the dashboard support different user roles with different permissions (e.g., viewer vs admin)? | Requirements mention admin can manage users but don't specify view-level permissions | Could require additional stories for role-based access control |
| 4 | What defines a seat as "unused" — is it based on the GitHub API not returning it, or based on zero usage activity? | Requirements say unused seats should be flagged but don't define the criteria | Affects the logic in Story 3.2 |
| 5 | ~~Should team composition snapshots be created automatically at month-end, or whenever a membership change is made?~~ **Resolved**: Snapshots are created on membership change (Story 7.4) AND automatically carried forward at month start (Story 7.7) | Requirements say composition is tracked per month — now addressed by both manual changes and automatic carry-forward | Resolved by Story 7.7 |
