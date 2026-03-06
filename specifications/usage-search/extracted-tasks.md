# Usage Search & Filtering - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirements |
| Participants | N/A |
| Source Materials | User feature requests, codebase analysis (usage components, API routes, existing SeatListPanel search pattern) |
| Total Epics | 1 |
| Total Stories | 5 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Usage Search & Filtering | 5 | High |

## Epic 1: Usage Search & Filtering

**Business Description**: Enable users to quickly find specific entries across all usage analytics views. Currently the usage tabs (Seat, Team, Department) and detail pages display data without any search capability, requiring users to scroll through long lists. Adding search will make it faster to locate specific seats, teams, departments, and members.

**Success Criteria**:
- Users can search and filter data on every usage analytics list (seat usage, team usage, department usage, and member lists on department/team detail pages)
- Search results update in real time as the user types
- Search is intuitive and consistent in appearance and behaviour across all usage views

### Story 1.1: User can search seats on the Seat Usage tab

**User Story**: As a user, I want to search for a specific seat on the Seat Usage tab so that I can quickly find a particular person's usage data without scrolling through the full paginated list.

**Acceptance Criteria**:
- [ ] A search input is displayed above the seat usage table
- [ ] The user can type a query to filter seats by GitHub username, first name, or last name
- [ ] Search results update as the user types (with a short debounce to avoid excessive requests)
- [ ] Pagination resets to page 1 when a search query is entered
- [ ] When the search query is cleared, the full seat list is restored
- [ ] An empty state message is shown when no seats match the search query
- [ ] Search matching is case-insensitive
- [ ] The search query is persisted in the URL as a query parameter so that bookmarking/sharing retains the filter context

**High-Level Technical Notes**: The existing SeatListPanel (seat management page) already implements a similar debounced search pattern with server-side filtering via the API. The same approach can be reused for the usage seat API endpoint.

**Priority**: High

### Story 1.2: User can search teams on the Team Usage tab

**User Story**: As a user, I want to search for a specific team on the Team Usage tab so that I can quickly find a particular team's aggregated usage data.

**Acceptance Criteria**:
- [ ] A search input is displayed above the team usage table
- [ ] The user can type a query to filter teams by team name
- [ ] Search results update as the user types (with a short debounce)
- [ ] When the search query is cleared, the full team list is restored
- [ ] An empty state message is shown when no teams match the search query
- [ ] Search matching is case-insensitive
- [ ] The search query is persisted in the URL as a query parameter

**High-Level Technical Notes**: The team usage tab currently loads all teams in a single API call without pagination. Search filtering can be implemented client-side since the dataset is small (all teams are fetched at once), or server-side for consistency with other tabs.

**Priority**: High

### Story 1.3: User can search departments on the Department Usage tab

**User Story**: As a user, I want to search for a specific department on the Department Usage tab so that I can quickly find a particular department's aggregated usage data.

**Acceptance Criteria**:
- [ ] A search input is displayed above the department usage table
- [ ] The user can type a query to filter departments by department name
- [ ] Search results update as the user types (with a short debounce)
- [ ] When the search query is cleared, the full department list is restored
- [ ] The department usage chart updates to reflect the filtered results
- [ ] An empty state message is shown when no departments match the search query
- [ ] Search matching is case-insensitive
- [ ] The search query is persisted in the URL as a query parameter

**High-Level Technical Notes**: The department usage tab currently loads all departments in a single API call without pagination. Similar to team search, filtering can be client-side or server-side.

**Priority**: High

### Story 1.4: User can search members on the Department Detail page

**User Story**: As a user, I want to search for a specific member within a department's detail view so that I can quickly find an individual member's usage data in a large department.

**Acceptance Criteria**:
- [ ] A search input is displayed above the member table on the department detail page
- [ ] The user can type a query to filter members by GitHub username, first name, or last name
- [ ] Search results update as the user types (with a short debounce)
- [ ] When the search query is cleared, the full member list is restored
- [ ] The member usage chart updates to reflect the filtered results (only matching members shown)
- [ ] An empty state message is shown when no members match the search query
- [ ] Search matching is case-insensitive

**High-Level Technical Notes**: The department detail page loads all members in a single API call. Client-side filtering is appropriate since all member data is already fetched. The TeamMemberTable component is shared with team detail — changes should support both use cases.

**Priority**: High

### Story 1.5: User can search members on the Team Detail page

**User Story**: As a user, I want to search for a specific member within a team's detail view so that I can quickly find an individual member's usage data in a large team.

**Acceptance Criteria**:
- [ ] A search input is displayed above the member table on the team detail page
- [ ] The user can type a query to filter members by GitHub username, first name, or last name
- [ ] Search results update as the user types (with a short debounce)
- [ ] When the search query is cleared, the full member list is restored
- [ ] An empty state message is shown when no members match the search query
- [ ] The member usage chart updates to reflect the filtered results (only matching members shown)
- [ ] Search matching is case-insensitive

**High-Level Technical Notes**: The team detail page uses the same TeamMemberTable component as the department detail page. The search implementation should be consistent across both detail pages.

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.4 | Story 1.5 | Related to | Both use the shared TeamMemberTable component; search filtering should be implemented consistently |
| Story 1.5 | Story 1.4 | Related to | Both use the shared TeamMemberTable component; search filtering should be implemented consistently |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | Search on the seat usage tab will be server-side (API query parameter) since data is paginated | High | If client-side is preferred, the pagination logic and API would need restructuring |
| 2 | Search on team and department usage tabs can be client-side since all data is already loaded in a single API call | Medium | If datasets grow large enough to require server-side pagination + search, the API will need to be extended |
| 3 | The search input design and behaviour should match the existing pattern used on the seat management page (debounced text input, 300ms delay) | High | If a different UX pattern is desired, additional design work is needed |

## Out of Scope

Items explicitly excluded from this task breakdown:
- Adding pagination to team and department usage tabs (not requested; search alone addresses the discoverability need)
- Advanced filtering (e.g., filter by usage percentage range, filter by spending thresholds)
- Sorting controls on usage tabs (not part of the search request)
- Exporting filtered search results

## Open Questions for Stakeholders

| # | Question | Context | Impact |
|---|----------|---------|--------|
| 1 | Should the search on team/department tabs be client-side or server-side? | Currently all teams and departments are loaded at once. Client-side is simpler but server-side is more consistent. | Affects implementation approach and API changes needed |
