# Usage Search & Filtering — Jira Tasks

---

## Epic: Usage Analytics: Search & Filtering Across Usage Views

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Enable users to search and filter data across all usage analytics views — seat usage, team usage, department usage, and member lists on department and team detail pages. Currently these views display data without any search capability, requiring users to scroll through long lists to find specific entries.

h2. Business Value

As the number of seats, teams, and departments grows, locating a specific entry in usage analytics becomes time-consuming. Search and filtering lets users quickly find what they need, improving efficiency for managers reviewing individual or team performance.

h2. Success Metrics

* Users can find any seat, team, department, or member within seconds using a search input
* Search is consistent in appearance and behaviour across all usage views
* Search state is preserved in the URL for shareability
```

**Acceptance Criteria**:
```
(/) A search input is available on every usage analytics list (seat, team, department, and member detail views)
(/) Search results update in real time as the user types
(/) Search is case-insensitive
(/) Search state is preserved across page refreshes where applicable
```

**Labels**: `usage`, `search`, `ux`

---

### Story 1.1: User can search seats on the Seat Usage tab

**Parent**: Usage Analytics: Search & Filtering Across Usage Views
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:
```
h2. Context

This story is part of the [Usage Analytics: Search & Filtering Across Usage Views] epic. It adds search functionality to the seat usage tab, the most data-heavy view with paginated results.

h2. User Story

As a user, I want to search for a specific seat on the Seat Usage tab so that I can quickly find a particular person's usage data without scrolling through the full paginated list.

h2. Requirements

# A search input is displayed above the seat usage table
# The user can type a query to filter seats by GitHub username, first name, or last name
# Search results update as the user types (with a short debounce to avoid excessive requests)
# Pagination resets to page 1 when a search query is entered
# When the search query is cleared, the full seat list is restored
# An empty state message is shown when no seats match the search query
# Search matching is case-insensitive
# The search query is persisted in the URL as a query parameter so that bookmarking/sharing retains the filter context

h2. Technical Notes

The existing seat management page (SeatListPanel) implements a similar debounced search pattern with server-side filtering via the API. The same approach can be reused for the usage seat API endpoint.
```

**Acceptance Criteria**:
```
(/) A search input is displayed above the seat usage table
(/) Seats can be filtered by GitHub username, first name, or last name
(/) Search results update as the user types with debounced input
(/) Pagination resets to page 1 when a search query is entered
(/) Clearing the search query restores the full seat list
(/) An empty state message is displayed when no seats match the query
(/) Search matching is case-insensitive
(/) The search query is persisted in the URL as a query parameter
```

**Labels**: `usage`, `search`, `ux`

---

### Story 1.2: User can search teams on the Team Usage tab

**Parent**: Usage Analytics: Search & Filtering Across Usage Views
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Analytics: Search & Filtering Across Usage Views] epic. It adds search functionality to the team usage tab.

h2. User Story

As a user, I want to search for a specific team on the Team Usage tab so that I can quickly find a particular team's aggregated usage data.

h2. Requirements

# A search input is displayed above the team usage table
# The user can type a query to filter teams by team name
# Search results update as the user types (with a short debounce)
# When the search query is cleared, the full team list is restored
# An empty state message is shown when no teams match the search query
# Search matching is case-insensitive
# The search query is persisted in the URL as a query parameter

h2. Technical Notes

The team usage tab currently loads all teams in a single API call without pagination. Search filtering can be implemented client-side since the dataset is small, or server-side for consistency.
```

**Acceptance Criteria**:
```
(/) A search input is displayed above the team usage table
(/) Teams can be filtered by team name
(/) Search results update as the user types with debounced input
(/) Clearing the search query restores the full team list
(/) An empty state message is displayed when no teams match the query
(/) Search matching is case-insensitive
(/) The search query is persisted in the URL as a query parameter
```

**Labels**: `usage`, `search`, `ux`

---

### Story 1.3: User can search departments on the Department Usage tab

**Parent**: Usage Analytics: Search & Filtering Across Usage Views
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Analytics: Search & Filtering Across Usage Views] epic. It adds search functionality to the department usage tab.

h2. User Story

As a user, I want to search for a specific department on the Department Usage tab so that I can quickly find a particular department's aggregated usage data.

h2. Requirements

# A search input is displayed above the department usage table
# The user can type a query to filter departments by department name
# Search results update as the user types (with a short debounce)
# When the search query is cleared, the full department list is restored
# The department usage chart updates to reflect the filtered results
# An empty state message is shown when no departments match the search query
# Search matching is case-insensitive
# The search query is persisted in the URL as a query parameter

h2. Technical Notes

The department usage tab currently loads all departments in a single API call without pagination. Similar to team search, filtering can be client-side or server-side.
```

**Acceptance Criteria**:
```
(/) A search input is displayed above the department usage table
(/) Departments can be filtered by department name
(/) Search results update as the user types with debounced input
(/) Clearing the search query restores the full department list
(/) The department usage chart updates to reflect the filtered results
(/) An empty state message is displayed when no departments match the query
(/) Search matching is case-insensitive
(/) The search query is persisted in the URL as a query parameter
```

**Labels**: `usage`, `search`, `ux`

---

### Story 1.4: User can search members on the Department Detail page

**Parent**: Usage Analytics: Search & Filtering Across Usage Views
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Analytics: Search & Filtering Across Usage Views] epic. It adds search functionality to the member list on the department detail page.

h2. User Story

As a user, I want to search for a specific member within a department's detail view so that I can quickly find an individual member's usage data in a large department.

h2. Requirements

# A search input is displayed above the member table on the department detail page
# The user can type a query to filter members by GitHub username, first name, or last name
# Search results update as the user types (with a short debounce)
# When the search query is cleared, the full member list is restored
# The member usage chart updates to reflect the filtered results (only matching members shown)
# An empty state message is shown when no members match the search query
# Search matching is case-insensitive

h2. Technical Notes

The department detail page loads all members in a single API call. Client-side filtering is appropriate since all member data is already fetched. The TeamMemberTable component is shared with the team detail page — changes should support both use cases.
```

**Acceptance Criteria**:
```
(/) A search input is displayed above the member table on the department detail page
(/) Members can be filtered by GitHub username, first name, or last name
(/) Search results update as the user types with debounced input
(/) Clearing the search query restores the full member list
(/) The member usage chart updates to reflect the filtered results
(/) An empty state message is displayed when no members match the query
(/) Search matching is case-insensitive
```

**Labels**: `usage`, `search`, `ux`

---

### Story 1.5: User can search members on the Team Detail page

**Parent**: Usage Analytics: Search & Filtering Across Usage Views
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Usage Analytics: Search & Filtering Across Usage Views] epic. It adds search functionality to the member list on the team detail page.

h2. User Story

As a user, I want to search for a specific member within a team's detail view so that I can quickly find an individual member's usage data in a large team.

h2. Requirements

# A search input is displayed above the member table on the team detail page
# The user can type a query to filter members by GitHub username, first name, or last name
# Search results update as the user types (with a short debounce)
# When the search query is cleared, the full member list is restored
# The member usage chart updates to reflect the filtered results (only matching members shown)
# An empty state message is shown when no members match the search query
# Search matching is case-insensitive

h2. Technical Notes

The team detail page uses the same TeamMemberTable component as the department detail page. The search implementation should be consistent across both detail pages.
```

**Acceptance Criteria**:
```
(/) A search input is displayed above the member table on the team detail page
(/) Members can be filtered by GitHub username, first name, or last name
(/) Search results update as the user types with debounced input
(/) Clearing the search query restores the full member list
(/) The member usage chart updates to reflect the filtered results
(/) An empty state message is displayed when no members match the query
(/) Search matching is case-insensitive
```

**Labels**: `usage`, `search`, `ux`
