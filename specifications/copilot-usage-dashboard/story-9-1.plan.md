# Show Premium Request Usage Percentage on Seat Tables - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.1 |
| Title | Show premium request usage percentage on seat tables |
| Description | Add a usage percentage column to all seat-related tables (seat management, per-seat usage, team member detail, department member detail) calculated as total premium requests / configurable allowance. Make the premium request allowance configurable in application settings. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 9, Story 9.1) |

## Proposed Solution

Add a configurable `premiumRequestsPerSeat` field to the `Configuration` entity (default 300) so the allowance can be adjusted from the Settings page. Replace all hardcoded `PREMIUM_REQUESTS_PER_SEAT` constant usages with the configurable value, passing it from API responses to frontend components.

**Data flow:**

```
Configuration table (premiumRequestsPerSeat)
  ↓ read by backend API routes
  ↓ included in API responses as `premiumRequestsPerSeat`
  ↓ frontend components use the value from API response for calculation
```

**Tables affected:**

| Table | Component | Current State | Change Needed |
|---|---|---|---|
| Seat management | `SeatListPanel.tsx` | No usage data displayed | Add usage % column (needs current-month usage aggregation via API) |
| Per-seat usage | `SeatUsageTable.tsx` | Shows totalRequests, totalSpending | Add usage % column |
| Team member detail | `TeamMemberTable.tsx` | Already has usage % with hardcoded 300 | Replace hardcoded constant with configurable prop |
| Department member detail | Reuses `TeamMemberTable.tsx` | Already has usage % with hardcoded 300 | Same as above — inherits fix from TeamMemberTable |

**Configuration approach:**

1. Add `premiumRequestsPerSeat` column to the `configuration` table with a database migration
2. Update the Configuration entity, validation schema, API routes (GET/PUT), and UI form
3. Backend API routes read the value from the Configuration table and include it in responses
4. Frontend receives the value via API responses instead of importing a hardcoded constant
5. Keep `PREMIUM_REQUESTS_PER_SEAT` in `constants.ts` as the **default fallback** only (used when configuration hasn't been loaded yet or for migration default)

## Current Implementation Analysis

### Already Implemented
- `PREMIUM_REQUESTS_PER_SEAT = 300` constant — `src/lib/constants.ts` — hardcoded default used across backend and frontend
- `TeamMemberTable` component — `src/components/usage/TeamMemberTable.tsx` — already displays usage percentage and colour-coded indicator per member, using the hardcoded constant
- `DepartmentMemberChart` component — `src/components/usage/DepartmentMemberChart.tsx` — uses the constant for reference line and colour coding
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — reuses `TeamMemberTable` for department member detail, so it already shows usage %
- Configuration entity — `src/entities/configuration.entity.ts` — singleton Configuration with `apiMode`, `entityName`
- Configuration API — `src/app/api/configuration/route.ts` — GET/POST/PUT for configuration CRUD
- Configuration validation — `src/lib/validations/configuration.ts` — Zod schema for `apiMode` and `entityName`
- ConfigurationForm — `src/components/setup/ConfigurationForm.tsx` — shared form for create and edit mode
- Department usage API — `src/app/api/usage/departments/route.ts` — uses `PREMIUM_REQUESTS_PER_SEAT` for department-level usage % calculation
- Department detail API — `src/app/api/usage/departments/[departmentId]/route.ts` — uses `PREMIUM_REQUESTS_PER_SEAT` for department detail usage % calculation
- Seat usage API — `src/app/api/usage/seats/route.ts` — returns per-seat usage data (totalRequests, models, spending) but no percentage
- Seats API — `src/app/api/seats/route.ts` — returns seat management data (no usage data)
- Configuration route tests — `src/app/api/configuration/__tests__/route.test.ts` — tests for GET/POST/PUT configuration endpoints

### To Be Modified
- `Configuration` entity — `src/entities/configuration.entity.ts` — add `premiumRequestsPerSeat` column (int, default 300)
- Configuration validation schema — `src/lib/validations/configuration.ts` — add optional `premiumRequestsPerSeat` field
- Configuration API (GET) — `src/app/api/configuration/route.ts` — return `premiumRequestsPerSeat` in response
- Configuration API (PUT) — `src/app/api/configuration/route.ts` — accept and persist `premiumRequestsPerSeat`
- Configuration API (POST) — `src/app/api/configuration/route.ts` — accept optional `premiumRequestsPerSeat` on first-run setup
- ConfigurationForm — `src/components/setup/ConfigurationForm.tsx` — add numeric input for premium requests per seat (only visible in edit mode)
- ConfigurationTabContent — `src/components/management/ConfigurationTabContent.tsx` — pass `premiumRequestsPerSeat` to ConfigurationForm
- Seat usage API — `src/app/api/usage/seats/route.ts` — add `premiumRequestsPerSeat` to response from configuration
- Seats API — `src/app/api/seats/route.ts` — add current-month usage aggregation and `premiumRequestsPerSeat` to response
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — add usage % column
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — pass `premiumRequestsPerSeat` from API response to table
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — accept `premiumRequestsPerSeat` as prop instead of importing constant
- `DepartmentMemberChart` — `src/components/usage/DepartmentMemberChart.tsx` — accept `premiumRequestsPerSeat` as prop instead of importing constant
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — pass `premiumRequestsPerSeat` to child components
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — add usage % column, fetch current-month usage
- Department usage API — `src/app/api/usage/departments/route.ts` — read `premiumRequestsPerSeat` from configuration instead of constant
- Department detail API — `src/app/api/usage/departments/[departmentId]/route.ts` — read `premiumRequestsPerSeat` from configuration instead of constant
- Team detail API (if it uses the constant) — check and update
- Configuration route tests — `src/app/api/configuration/__tests__/route.test.ts` — add tests for `premiumRequestsPerSeat` field
- Test db-helpers — `src/test/db-helpers.ts` — no changes needed (entity auto-syncs in tests)

### To Be Created
- Database migration — `migrations/` — add `premiumRequestsPerSeat` column to `configuration` table
- Helper function — `src/lib/get-premium-allowance.ts` — reusable function to read `premiumRequestsPerSeat` from configuration with fallback to default
- Unit tests for `get-premium-allowance` helper — `src/lib/__tests__/get-premium-allowance.test.ts`
- E2E test updates — `e2e/seat-usage.spec.ts` and `e2e/seat-list.spec.ts` — verify usage % column appears

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What month should the seat management table (SeatListPanel) show usage % for? | Current month (auto-detected, same as usage pages) | ✅ Resolved |
| 2 | Should the SeatListPanel usage % column be sortable? | No — the seat management table fetches seat data and usage separately; adding sort by usage % would require reworking the query. Out of scope for this story. | ✅ Resolved |
| 3 | Should N/A be shown for inactive seats or 0%? | 0% — per requirement "When usage data is not available, the percentage displays as 0% or N/A". Use "N/A" for inactive seats (no allocation) and "0%" for active seats with no usage data. | ✅ Resolved |

## Implementation Plan

### Phase 1: Database & Configuration Backend

#### Task 1.1 - [CREATE] Database migration for `premiumRequestsPerSeat` column
**Description**: Create a TypeORM migration to add a `premiumRequestsPerSeat` integer column (default 300, NOT NULL) to the `configuration` table. This persists the configurable allowance.

**Definition of Done**:
- [x] Migration file created in `migrations/` with proper timestamp naming
- [x] Migration adds `premiumRequestsPerSeat` column of type `integer` with default `300` and NOT NULL constraint
- [x] Migration is reversible (down drops the column)
- [x] Migration runs successfully against a fresh and existing database

#### Task 1.2 - [MODIFY] Update Configuration entity with `premiumRequestsPerSeat`
**Description**: Add the `premiumRequestsPerSeat` field to the Configuration interface and EntitySchema in `src/entities/configuration.entity.ts`.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` field added to `Configuration` interface as `number`
- [x] Column defined in EntitySchema with type `int`, default `300`
- [x] TypeScript compiles without errors

#### Task 1.3 - [MODIFY] Update configuration validation schema
**Description**: Add an optional `premiumRequestsPerSeat` field to the Zod validation schema in `src/lib/validations/configuration.ts`. The field should be a positive integer between 1 and 100000.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` field added to `configurationSchema` as optional positive integer
- [x] Validation rejects non-integer, zero, negative, and excessively large values
- [x] Existing tests for configuration validation still pass
- [x] New unit tests cover valid and invalid `premiumRequestsPerSeat` values

#### Task 1.4 - [MODIFY] Update Configuration API routes
**Description**: Update GET, POST, and PUT handlers in `src/app/api/configuration/route.ts` to include `premiumRequestsPerSeat` in responses and accept it in request bodies.

**Definition of Done**:
- [x] GET response includes `premiumRequestsPerSeat` field
- [x] POST accepts optional `premiumRequestsPerSeat` (defaults to 300 if not provided)
- [x] PUT accepts optional `premiumRequestsPerSeat` and updates it when provided
- [x] Existing configuration API tests still pass
- [x] New tests cover reading and updating `premiumRequestsPerSeat`

#### Task 1.5 - [CREATE] Reusable helper to read premium allowance from configuration
**Description**: Create a helper function `getPremiumAllowance()` in `src/lib/get-premium-allowance.ts` that reads `premiumRequestsPerSeat` from the Configuration table with a fallback to the `PREMIUM_REQUESTS_PER_SEAT` constant (300). This prevents duplicating configuration-read logic across API routes.

**Definition of Done**:
- [x] `getPremiumAllowance()` async function exported from `src/lib/get-premium-allowance.ts`
- [x] Returns `premiumRequestsPerSeat` from the configuration row if it exists
- [x] Falls back to `PREMIUM_REQUESTS_PER_SEAT` (300) if no configuration row or field is null
- [x] Unit tests in `src/lib/__tests__/get-premium-allowance.test.ts` cover: config exists with value, config missing, config with default value

### Phase 2: Backend API Updates — Include Usage Percentage Data

#### Task 2.1 - [MODIFY] Update seat usage API to include `premiumRequestsPerSeat`
**Description**: Modify `src/app/api/usage/seats/route.ts` to read the premium allowance from configuration and include it in the response payload so the frontend can compute percentage.

**Definition of Done**:
- [x] API response includes `premiumRequestsPerSeat` field at the top level
- [x] Value is read from configuration using `getPremiumAllowance()`
- [x] Existing response shape is preserved (backwards compatible — new field is additive)

#### Task 2.2 - [MODIFY] Update seats management API to include usage data
**Description**: Modify `src/app/api/seats/route.ts` to optionally aggregate current-month premium request totals per seat and include `premiumRequestsPerSeat` in the response. The usage data is computed for the current month/year and returned alongside each seat record.

**Definition of Done**:
- [x] Each seat record in the response includes `totalPremiumRequests` (number, default 0)
- [x] API response includes top-level `premiumRequestsPerSeat` field
- [x] Usage aggregation uses a LEFT JOIN on copilot_usage for the current month/year
- [x] Performance is acceptable (single query with LEFT JOIN, no N+1)
- [x] Seats with no usage data return `totalPremiumRequests: 0`
- [x] Existing seat list tests still pass (new fields are additive)

#### Task 2.3 - [MODIFY] Update department usage API to use configurable allowance
**Description**: Replace the imported `PREMIUM_REQUESTS_PER_SEAT` constant in `src/app/api/usage/departments/route.ts` with the value from `getPremiumAllowance()`. Include `premiumRequestsPerSeat` in the response.

**Definition of Done**:
- [x] `PREMIUM_REQUESTS_PER_SEAT` import replaced with `getPremiumAllowance()` call
- [x] Response includes `premiumRequestsPerSeat` field
- [x] Usage percentage calculation uses the configurable value
- [x] SQL query parameter updated to use the configurable value

#### Task 2.4 - [MODIFY] Update department detail API to use configurable allowance
**Description**: Replace the imported `PREMIUM_REQUESTS_PER_SEAT` constant in `src/app/api/usage/departments/[departmentId]/route.ts` with the value from `getPremiumAllowance()`. Include `premiumRequestsPerSeat` in the response.

**Definition of Done**:
- [x] `PREMIUM_REQUESTS_PER_SEAT` import replaced with `getPremiumAllowance()` call
- [x] Response includes `premiumRequestsPerSeat` field
- [x] Usage percentage calculation uses the configurable value

#### Task 2.5 - [MODIFY] Update team detail API to include `premiumRequestsPerSeat`
**Description**: Check and update the team detail API (`src/app/api/usage/teams/[teamId]/route.ts`) to include `premiumRequestsPerSeat` in the response so `TeamMemberTable` can use it.

**Definition of Done**:
- [x] Response includes `premiumRequestsPerSeat` field read from configuration
- [x] Value is sourced from `getPremiumAllowance()`

### Phase 3: Frontend — Usage Percentage on All Seat Tables

#### Task 3.1 - [MODIFY] Update `TeamMemberTable` to accept configurable allowance as prop
**Description**: Replace the hardcoded `PREMIUM_REQUESTS_PER_SEAT` import in `TeamMemberTable` with a `premiumRequestsPerSeat` prop. This makes the component driven by the configurable value from the API response.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` added to `TeamMemberTableProps` interface
- [x] Import of `PREMIUM_REQUESTS_PER_SEAT` from constants removed
- [x] Usage percentage calculated using the prop value
- [x] Display format unchanged: `{totalRequests} / {allowance} ({percent}%)`
- [x] Colour-coding logic unchanged (red ≤50%, orange 51-99%, green ≥100%)

#### Task 3.2 - [MODIFY] Update `DepartmentMemberChart` to accept configurable allowance as prop
**Description**: Replace the hardcoded `PREMIUM_REQUESTS_PER_SEAT` import in `DepartmentMemberChart` with a `premiumRequestsPerSeat` prop.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` added to component props
- [x] Import of `PREMIUM_REQUESTS_PER_SEAT` from constants removed
- [x] Reference line and colour calculation use the prop value
- [x] Label updated to show the actual configured value (e.g. "{value} included")

#### Task 3.3 - [MODIFY] Update `DepartmentDetailPanel` to pass configurable allowance
**Description**: Update `DepartmentDetailPanel` to extract `premiumRequestsPerSeat` from the API response and pass it down to `TeamMemberTable` and `DepartmentMemberChart`.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` extracted from department detail API response
- [x] Value passed as prop to `TeamMemberTable` and `DepartmentMemberChart`
- [x] Falls back to 300 if field is missing in the API response (backward compatibility)

#### Task 3.4 - [MODIFY] Update team detail panel to pass configurable allowance
**Description**: Update the team detail panel component to extract `premiumRequestsPerSeat` from the team detail API response and pass it to `TeamMemberTable`.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` extracted from team detail API response
- [x] Value passed as prop to `TeamMemberTable`
- [x] Falls back to 300 if field is missing

#### Task 3.5 - [MODIFY] Add usage percentage column to `SeatUsageTable`
**Description**: Add a "Usage %" column to the per-seat usage table. Display percentage as `{totalRequests} / {allowance} ({percent}%)` with the same colour-coded indicator dot used in `TeamMemberTable`.

**Definition of Done**:
- [x] New "Usage %" column added to the table header
- [x] Each row shows `{totalRequests} / {premiumRequestsPerSeat} ({Math.round(percent)}%)`
- [x] Colour-coded dot indicator (same `getUsageColour` logic as `TeamMemberTable`)
- [x] `premiumRequestsPerSeat` received as prop from `SeatUsagePanel`

#### Task 3.6 - [MODIFY] Update `SeatUsagePanel` to pass `premiumRequestsPerSeat` to table
**Description**: Extract `premiumRequestsPerSeat` from the seat usage API response and pass it to `SeatUsageTable`.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` extracted from API response
- [x] Passed as prop to `SeatUsageTable`
- [x] Falls back to 300 if field is missing

#### Task 3.7 - [MODIFY] Add usage percentage column to `SeatListPanel`
**Description**: Add a "Usage %" column to the seat management table displaying the current-month usage percentage for each seat. The value comes from the `totalPremiumRequests` field added to the seats API response.

**Definition of Done**:
- [x] New "Usage %" column added after the "Last Active" column
- [x] Displays `{percent}%` for active seats with data
- [x] Displays "N/A" for inactive seats
- [x] Displays "0%" for active seats with no usage data
- [x] `premiumRequestsPerSeat` from API response used for calculation
- [x] Column is NOT sortable (out of scope)
- [x] Edit form `colSpan` updated to account for the new column

### Phase 4: Configuration UI

#### Task 4.1 - [MODIFY] Update ConfigurationForm to include premium requests setting
**Description**: Add a numeric input for "Premium requests per seat" to the `ConfigurationForm` component (shown only in edit mode). First-run setup does not need this field — it uses the default (300).

**Definition of Done**:
- [x] Numeric input field for `premiumRequestsPerSeat` displayed in edit mode
- [x] Field has label "Premium requests per seat (monthly allowance)"
- [x] Field shows the current configured value
- [x] Field validates: positive integer, min 1, max 100000
- [x] Field is NOT shown in create mode (first-run setup uses default)
- [x] Submit includes `premiumRequestsPerSeat` in the PUT request body
- [x] Validation errors displayed inline

#### Task 4.2 - [MODIFY] Update ConfigurationTabContent to pass `premiumRequestsPerSeat`
**Description**: Update `ConfigurationTabContent` to pass the `premiumRequestsPerSeat` value from the API response to `ConfigurationForm`.

**Definition of Done**:
- [x] `premiumRequestsPerSeat` included in `ConfigurationData` interface
- [x] Value fetched from GET `/api/configuration` and passed to `ConfigurationForm`
- [x] `ConfigurationForm` receives `premiumRequestsPerSeat` in `initialValues`

### Phase 5: Testing

#### Task 5.1 - [MODIFY] Update configuration API tests
**Description**: Add test cases to `src/app/api/configuration/__tests__/route.test.ts` covering the new `premiumRequestsPerSeat` field for GET, POST, and PUT.

**Definition of Done**:
- [x] Test: GET returns `premiumRequestsPerSeat` with default value (300)
- [x] Test: POST with custom `premiumRequestsPerSeat` saves the value
- [x] Test: POST without `premiumRequestsPerSeat` defaults to 300
- [x] Test: PUT updates `premiumRequestsPerSeat`
- [x] Test: PUT with invalid `premiumRequestsPerSeat` (negative, zero, non-integer) returns 400

#### Task 5.2 - [CREATE] Unit tests for `getPremiumAllowance` helper
**Description**: Create unit tests in `src/lib/__tests__/get-premium-allowance.test.ts`.

**Definition of Done**:
- [x] Test: returns configured value when configuration exists
- [x] Test: returns default (300) when no configuration row exists
- [x] Test: returns default (300) when configuration row exists but field is null/undefined

#### Task 5.3 - [MODIFY] Update configuration validation tests
**Description**: Add test cases to `src/lib/validations/__tests__/configuration.test.ts` for the new `premiumRequestsPerSeat` field.

**Definition of Done**:
- [x] Test: schema accepts valid `premiumRequestsPerSeat` values (1, 300, 100000)
- [x] Test: schema rejects invalid values (0, -1, 1.5, "abc", 100001)
- [x] Test: schema accepts payload without `premiumRequestsPerSeat` (optional)

#### Task 5.4 - [MODIFY] Update E2E tests for seat usage page
**Description**: Update `e2e/seat-usage.spec.ts` to verify that the usage percentage column is visible and shows expected values.

**Definition of Done**:
- [x] E2E test verifies "Usage" column header is present on seat usage table
- [x] E2E test verifies percentage format is displayed (e.g. showing "%" in cell content)

#### Task 5.5 - [MODIFY] Update E2E tests for seat list page
**Description**: Update `e2e/seat-list.spec.ts` to verify that the usage percentage column is visible.

**Definition of Done**:
- [x] E2E test verifies "Usage %" column header is present on seat management table

#### Task 5.6 - [MODIFY] Update E2E tests for configuration settings
**Description**: Update `e2e/configuration-settings.spec.ts` to verify the premium requests per seat field is visible and editable.

**Definition of Done**:
- [x] E2E test verifies "Premium requests per seat" input is visible on settings page
- [x] E2E test verifies the value can be updated and saved

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Final code review of all changes by the `tsh-code-reviewer` agent to verify code quality, consistency with project patterns, and completeness of the implementation.

**Definition of Done**:
- [x] All code changes reviewed
- [x] No critical or high severity issues
- [x] Consistent with existing project patterns and conventions
- [x] All acceptance criteria verified

## Security Considerations

- **Input validation**: The `premiumRequestsPerSeat` field is validated on both client and server side (positive integer, bounded range 1–100000) to prevent invalid or malicious values
- **Authentication**: All API routes already require authentication via `requireAuth()` — no changes needed
- **Authorization**: Configuration updates are only available to authenticated users (existing pattern) — consider restricting to admin role if role-based access is added in the future
- **SQL injection**: The value is passed as a parameterised query parameter (existing pattern), not interpolated into SQL strings

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each seat row in all seat-related tables displays a usage percentage column
- [x] Percentage is calculated as (total premium requests) / configurable allowance (default 300)
- [x] Percentage is shown on: seat management, per-seat usage, team member detail, department member detail tables
- [x] When usage data is not available, the percentage displays as 0% or N/A
- [x] Premium request allowance per seat is configurable in application settings (default 300)
- [x] Changing the configured allowance immediately reflects in all usage percentage calculations
- [x] All existing unit and integration tests pass
- [x] New unit tests cover the `getPremiumAllowance` helper and validation schema changes
- [x] New E2E tests verify the presence of usage percentage columns

## Improvements (Out of Scope)

- **Sortable usage % column on seat management table**: Adding sort-by-usage-percentage to the seat management table would require a fundamentally different query approach (join-based instead of TypeORM findAndCount). Better handled as a separate story.
- **Colour-coded indicators on all tables**: Story 9.4 covers adding colour-coded status squares across all tables. This story only ensures existing colour coding in `TeamMemberTable` uses the configurable value.
- **Usage percentage on team/department summary tables**: Stories 9.2 and 9.3 cover team-level and department-level usage percentages. This story focuses solely on per-seat individual usage percentage.
- **Real-time configuration reload**: Currently, changing the premium allowance requires page reload for frontend to pick up the new value. A real-time update mechanism (e.g., SWR revalidation) could be added later.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
