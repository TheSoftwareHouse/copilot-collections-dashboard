# Story 3.1: System syncs Copilot seats from GitHub API daily — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 3.1 |
| Title | System syncs Copilot seats from GitHub API daily |
| Description | Establish an automated data pipeline that fetches Copilot seat assignments from the GitHub API on a daily schedule and imports them into the application database. The system calls the appropriate endpoint (organisation or enterprise) based on configuration, handles pagination, logs execution results via JobExecution, and gracefully handles errors without corrupting existing data. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Implement an automated seat synchronisation pipeline with four layers: a **CopilotSeat entity** for persistent storage, a **GitHub API client** for fetching seat data with pagination, a **seat sync service** that orchestrates the import logic with transactional safety, and a **scheduling mechanism** using Next.js instrumentation for daily execution with a protected API route for manual triggering.

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              Next.js App                                      │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  instrumentation.ts (server startup)                                    │  │
│  │  └─ startSeatSyncScheduler() → runs executeSeatSync() every 24h       │  │
│  └─────────────────────────────────────────────────────────┬───────────────┘  │
│                                                             │                 │
│  ┌─────────────────────────────────────────────────────────┐│                 │
│  │  POST /api/jobs/seat-sync (auth-guarded)                ││                 │
│  │  Manual trigger from UI button + testing/debugging      ││                 │
│  └─────────────────────────────────────────────┬───────────┘│                 │
│                                                 │                              │
│  ┌─────────────────────────────────────────────┐│                              │
│  │  Settings Page — JobStatusPanel             ││                              │
│  │  [Sync Now] button → POST /api/jobs/seat-sync│                             │
│  └─────────────────────────────────────────────┘│                              │
│                                                 │            │                 │
│                                                 ▼            ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  src/lib/seat-sync.ts — Seat Sync Service                              │  │
│  │                                                                         │  │
│  │  executeSeatSync()                                                      │  │
│  │  1. Check configuration exists → skip if not                           │  │
│  │  2. Create JobExecution(SEAT_SYNC, RUNNING)                            │  │
│  │  3. Fetch all seats via GitHub API client (paginated)                  │  │
│  │  4. Upsert each seat into copilot_seat table                          │  │
│  │  5. Update JobExecution(SUCCESS, recordsProcessed)                     │  │
│  │  6. On error: Update JobExecution(FAILURE, errorMessage)               │  │
│  └──────────┬──────────────────────────────────────┬──────────────────────┘  │
│              │                                      │                         │
│              ▼                                      ▼                         │
│  ┌──────────────────────────┐      ┌──────────────────────────────────────┐  │
│  │  src/lib/github-api.ts   │      │  PostgreSQL                          │  │
│  │  GitHub API Client       │      │                                      │  │
│  │                          │      │  ┌──────────────┐  ┌──────────────┐  │  │
│  │  fetchAllCopilotSeats()  │      │  │ copilot_seat │  │job_execution │  │  │
│  │  - Org endpoint          │      │  │ (NEW)        │  │ (existing)   │  │  │
│  │  - Enterprise endpoint   │      │  └──────────────┘  └──────────────┘  │  │
│  │  - Pagination handling   │      │                                      │  │
│  │  - Error wrapping        │      │  ┌──────────────┐                    │  │
│  └──────────────────────────┘      │  │configuration │                    │  │
│              │                      │  │ (existing)   │                    │  │
│              ▼                      │  └──────────────┘                    │  │
│  ┌──────────────────────────┐      └──────────────────────────────────────┘  │
│  │  GitHub REST API          │                                                │
│  │                           │                                                │
│  │  Org:                     │                                                │
│  │  GET /orgs/{org}/copilot/ │                                                │
│  │      billing/seats        │                                                │
│  │                           │                                                │
│  │  Enterprise:              │                                                │
│  │  GET /enterprises/{ent}/  │                                                │
│  │      copilot/billing/seats│                                                │
│  └──────────────────────────┘                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Separate GitHub API client from sync logic**: The GitHub API client (`github-api.ts`) handles HTTP concerns (authentication, pagination, error wrapping) while the sync service (`seat-sync.ts`) handles business logic (upsert, job logging). This separation enables independent testing and reuse by Story 4.1 (usage collection).

2. **Upsert by `githubUsername`**: Seats are uniquely identified by their GitHub login (`assignee.login`). On each sync, existing seats are updated with fresh metadata (activity timestamps) while new seats are created. This prevents duplicates and preserves enrichment data (firstName, lastName, department) added by Story 3.4.

3. **Complete entity schema upfront**: The `CopilotSeat` entity includes all fields needed across Epic 3 (status, firstName, lastName, department) even though enrichment fields are populated by later stories. This avoids unnecessary schema migrations and is the pragmatic approach for a single-epic data model.

4. **`SeatStatus` enum with `ACTIVE` default**: New seats imported during sync are always created with `ACTIVE` status. The logic to mark missing seats as `INACTIVE` (and restore reappeared ones to `ACTIVE`) is Story 3.2's scope — this story only adds and updates seats.

5. **Next.js Instrumentation for scheduling**: The `instrumentation.ts` file uses `setInterval` to run the sync every 24 hours (configurable via `SEAT_SYNC_INTERVAL_HOURS` env var). This is appropriate for the single-instance Docker Compose deployment. The interval does NOT run an initial sync on startup — it waits for the first interval to elapse, preventing sync during application bootstrap. An optional `SEAT_SYNC_RUN_ON_STARTUP` env var is available to trigger an immediate sync after a short delay.

6. **Protected manual trigger endpoint**: `POST /api/jobs/seat-sync` allows admins to trigger a sync on demand. This is essential for testing and debugging without waiting for the daily schedule. The endpoint is auth-guarded and returns the JobExecution result.

7. **"Sync Now" button on Settings page**: The existing `JobStatusPanel` component is extended with a "Sync Now" button on the Seat Sync card. The button calls `POST /api/jobs/seat-sync`, shows a loading/spinning state during execution, and refreshes the job status data on completion. This lets admins trigger and observe sync results from the UI without needing API tools.

7. **Transactional safety**: The sync upserts seats within a single database transaction. If any database error occurs mid-sync, the entire batch is rolled back — ensuring existing data is never corrupted (requirement: "Existing seat data is not corrupted or lost when a sync fails").

8. **`GITHUB_TOKEN` environment variable**: The GitHub API token is read from the `GITHUB_TOKEN` environment variable — never stored in the database. This follows security best practices for secret management.

9. **Pagination with `per_page=100`**: The GitHub API supports up to 100 results per page. The client fetches all pages by incrementing the page counter until a response returns fewer results than `per_page`, collecting all seats before the sync service processes them.

10. **Configuration check before sync**: If no configuration exists (app not yet set up), the sync logs a skipped run message and exits without creating a FAILURE JobExecution. This prevents false alarm error records before first-run setup.

### API Contracts

**POST /api/jobs/seat-sync** (manual trigger)

| Status | Body |
|--------|------|
| 200 | `{ jobExecutionId, status: "success", recordsProcessed }` |
| 200 | `{ jobExecutionId, status: "failure", errorMessage }` |
| 401 | `{ error: "Authentication required" }` |
| 409 | `{ error: "Configuration not found. Complete first-run setup before syncing." }` |

### Data Model

```
┌──────────────────────────────────────┐
│          CopilotSeat (NEW)           │
├──────────────────────────────────────┤
│ id                 : Int (PK, auto)  │
│ githubUsername      : Varchar(255)   │
│                      UNIQUE, NOT NULL│
│ githubUserId        : Int, NOT NULL  │
│ status              : Enum (ACTIVE,  │
│                       INACTIVE)      │
│ firstName           : Varchar(255)?  │
│ lastName            : Varchar(255)?  │
│ department          : Varchar(255)?  │
│ assignedAt          : Timestamptz?   │
│ lastActivityAt      : Timestamptz?   │
│ lastActivityEditor  : Varchar(255)?  │
│ planType            : Varchar(50)?   │
│ createdAt           : Timestamptz    │
│ updatedAt           : Timestamptz    │
└──────────────────────────────────────┘

Indexes:
- UNIQUE on githubUsername (for upsert lookups)
- INDEX on status (for filtering active/inactive seats)
```

### GitHub API Endpoints Used

| Configuration | Endpoint |
|---|---|
| Organisation | `GET /orgs/{entityName}/copilot/billing/seats?page={n}&per_page=100` |
| Enterprise | `GET /enterprises/{entityName}/copilot/billing/seats?page={n}&per_page=100` |

**Authentication**: `Authorization: Bearer {GITHUB_TOKEN}` header.

**Response shape** (both endpoints):
```json
{
  "total_seats": 42,
  "seats": [
    {
      "created_at": "2021-08-03T18:00:00-06:00",
      "updated_at": "2021-09-23T15:00:00-06:00",
      "pending_cancellation_date": null,
      "last_activity_at": "2021-10-14T00:53:32-06:00",
      "last_activity_editor": "vscode/1.77.3/copilot/1.86.82",
      "plan_type": "business",
      "assignee": {
        "login": "octocat",
        "id": 1,
        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        "type": "User"
      }
    }
  ]
}
```

## Current Implementation Analysis

### Already Implemented
- `src/entities/configuration.entity.ts` — `Configuration` interface and `ConfigurationEntity` with `apiMode` (organisation/enterprise) and `entityName` — used to determine which GitHub API endpoint to call
- `src/entities/enums.ts` — `ApiMode` enum (organisation/enterprise), `JobType` enum (includes `SEAT_SYNC`), `JobStatus` enum — all reused directly
- `src/entities/job-execution.entity.ts` — `JobExecution` interface and `JobExecutionEntity` — reused to log sync execution results
- `src/lib/db.ts` — `getDb()` database connection singleton — reused in sync service and API route
- `src/lib/data-source.ts` — `AppDataSource` with entity registration — to be extended with new entity
- `src/lib/data-source.cli.ts` — CLI data source for migrations — to be extended with new entity
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused to protect the manual trigger API endpoint
- `src/app/(app)/layout.tsx` — Auth + config guards — already protects app routes
- `src/test/db-helpers.ts` — `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()` — to be extended with new entity
- `e2e/helpers/auth.ts` — E2E authentication helpers — reused for E2E test setup

### To Be Modified
- `src/entities/enums.ts` — Add `SeatStatus` enum (ACTIVE, INACTIVE)
- `src/lib/data-source.ts` — Register `CopilotSeatEntity` in entities array
- `src/lib/data-source.cli.ts` — Register `CopilotSeatEntity` in entities array
- `src/test/db-helpers.ts` — Register `CopilotSeatEntity` and extend `cleanDatabase` to clear the `copilot_seat` table
- `src/components/settings/JobStatusPanel.tsx` — Add a "Sync Now" button to the Seat Sync job card that calls `POST /api/jobs/seat-sync` and refreshes status on completion

### To Be Created
- `src/entities/copilot-seat.entity.ts` — TypeORM EntitySchema for the `copilot_seat` table
- `migrations/<timestamp>-CreateCopilotSeat.ts` — Database migration for the new table with enum type and indexes
- `src/lib/github-api.ts` — GitHub API client with pagination support, typed responses, and error wrapping
- `src/lib/seat-sync.ts` — Seat sync service orchestrating the full sync flow (config check → API fetch → upsert → job logging)
- `src/app/api/jobs/seat-sync/route.ts` — `POST` endpoint for manual sync triggering (auth-guarded)
- `instrumentation.ts` — Next.js server lifecycle hook to start the daily sync scheduler
- `src/lib/__tests__/github-api.test.ts` — Unit tests for the GitHub API client (mocked fetch)
- `src/lib/__tests__/seat-sync.test.ts` — Integration tests for the seat sync service (test database)
- `src/app/api/jobs/__tests__/seat-sync.route.test.ts` — Integration tests for the manual trigger API route

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Where does the GitHub API token come from? | `GITHUB_TOKEN` environment variable. Not stored in the database for security reasons. The sync skips execution if the token is not set. | ✅ Resolved |
| 2 | What scheduling mechanism should be used for daily sync? | Next.js `instrumentation.ts` with `setInterval`. Suitable for the single-instance Docker Compose deployment. Configurable via `SEAT_SYNC_INTERVAL_HOURS` env var (default: 24). | ✅ Resolved |
| 3 | Should the sync run immediately on server startup? | No by default — it waits for the first interval. An optional `SEAT_SYNC_RUN_ON_STARTUP=true` env var triggers an immediate sync after a 10-second delay (to let the server fully boot). | ✅ Resolved |
| 4 | Should Story 3.1 include flagging inactive seats? | No — Story 3.1 only imports and updates seats. Marking missing seats as INACTIVE and restoring reappeared ones to ACTIVE is Story 3.2's scope. During sync, existing seats are updated and new seats are created with ACTIVE status. | ✅ Resolved |
| 5 | Should enrichment fields (firstName, lastName, department) be included in the entity? | Yes — they are nullable columns with no impact on Story 3.1 logic. Including them upfront avoids an extra migration in Story 3.4. | ✅ Resolved |
| 6 | What is the enterprise endpoint URL for Copilot seats? | `GET /enterprises/{enterprise}/copilot/billing/seats` — same response shape as the organisation endpoint. | ✅ Resolved |
| 7 | How should API errors be handled during sync? | HTTP errors from GitHub (4xx, 5xx) are caught, logged as a FAILURE JobExecution with the error message, and the sync exits. The next scheduled run acts as a retry. No partial data is committed (transactional). | ✅ Resolved |
| 8 | Should the manual trigger return synchronously or asynchronously? | Synchronously — the endpoint waits for the sync to complete and returns the result. This keeps the implementation simple and the sync duration is bounded (GitHub API call + DB upserts). | ✅ Resolved |

## Implementation Plan

### Phase 1: Database & Entity

#### Task 1.1 - [MODIFY] Add `SeatStatus` enum to `src/entities/enums.ts`
**Description**: Add a new enum defining the possible statuses of a Copilot seat (active or inactive). This follows the existing pattern of `ApiMode`, `JobType`, and `JobStatus` enums.

**Definition of Done**:
- [ ] `SeatStatus` enum added with values `ACTIVE = "active"` and `INACTIVE = "inactive"`
- [ ] Enum is exported alongside existing enums
- [ ] No changes to existing enums (`ApiMode`, `JobType`, `JobStatus`)
- [ ] File compiles without TypeScript errors

#### Task 1.2 - [CREATE] `CopilotSeat` entity at `src/entities/copilot-seat.entity.ts`
**Description**: Create a TypeORM EntitySchema for the `copilot_seat` table following the same pattern as `ConfigurationEntity` and `JobExecutionEntity`. The entity stores GitHub seat data with enrichment fields for future stories.

**Definition of Done**:
- [ ] Entity file created at `src/entities/copilot-seat.entity.ts` using `EntitySchema` pattern
- [ ] `CopilotSeat` TypeScript interface exported with fields: `id` (number), `githubUsername` (string), `githubUserId` (number), `status` (SeatStatus), `firstName` (string | null), `lastName` (string | null), `department` (string | null), `assignedAt` (Date | null), `lastActivityAt` (Date | null), `lastActivityEditor` (string | null), `planType` (string | null), `createdAt` (Date), `updatedAt` (Date)
- [ ] `githubUsername` column has `unique: true` constraint
- [ ] `status` column uses `SeatStatus` enum with default `ACTIVE`
- [ ] Enrichment fields (`firstName`, `lastName`, `department`) are nullable
- [ ] GitHub metadata fields (`assignedAt`, `lastActivityAt`, `lastActivityEditor`, `planType`) are nullable
- [ ] `createdAt` uses `createDate: true` and `updatedAt` uses `updateDate: true`
- [ ] Index on `status` column for efficient filtering (`IDX_copilot_seat_status`)
- [ ] File compiles without TypeScript errors

#### Task 1.3 - [MODIFY] Register `CopilotSeatEntity` in data sources
**Description**: Add the new entity to both the application data source and CLI data source so TypeORM recognises it for queries and migrations.

**Definition of Done**:
- [ ] `CopilotSeatEntity` imported and added to the `entities` array in `src/lib/data-source.ts`
- [ ] `CopilotSeatEntity` imported and added to the `entities` array in `src/lib/data-source.cli.ts`
- [ ] Application starts without errors
- [ ] TypeORM CLI commands recognise the new entity

#### Task 1.4 - [CREATE] Database migration for `copilot_seat` table
**Description**: Generate a TypeORM migration that creates the `copilot_seat` table with the `seat_status` PostgreSQL enum type, unique constraint on `githubUsername`, and index on `status`.

**Definition of Done**:
- [ ] Migration generated via `npm run typeorm:generate -- migrations/<timestamp>-CreateCopilotSeat`
- [ ] Migration creates the `copilot_seat_status_enum` PostgreSQL enum with values `active`, `inactive`
- [ ] Migration creates the `copilot_seat` table with all columns matching the entity definition
- [ ] Migration includes unique constraint on `github_username`
- [ ] Migration includes index on `status`
- [ ] Migration applies cleanly on a fresh database (`npm run typeorm:migrate`)
- [ ] Migration reverts cleanly (`npm run typeorm:revert`)

#### Task 1.5 - [MODIFY] Extend test helpers with `CopilotSeatEntity`
**Description**: Register the new entity in the test data source and extend the `cleanDatabase` function to clear the `copilot_seat` table.

**Definition of Done**:
- [ ] `CopilotSeatEntity` imported and added to the `entities` array in `src/test/db-helpers.ts`
- [ ] `cleanDatabase` function clears the `copilot_seat` table (before other tables that might depend on it)
- [ ] Existing tests continue to pass

### Phase 2: GitHub API Client

#### Task 2.1 - [CREATE] GitHub API client at `src/lib/github-api.ts`
**Description**: Create a typed HTTP client for the GitHub Copilot seats API. The client handles authentication via `GITHUB_TOKEN` env var, constructs the correct URL based on `ApiMode` (organisation vs enterprise), and fetches all pages of seat results. Errors are wrapped in a descriptive `GitHubApiError` class for clean handling by callers.

**Definition of Done**:
- [ ] File created at `src/lib/github-api.ts`
- [ ] TypeScript interfaces exported for the GitHub API response shape: `GitHubSeatAssignment` (per-seat object with `assignee.login`, `assignee.id`, `created_at`, `last_activity_at`, `last_activity_editor`, `plan_type`) and `GitHubSeatsResponse` (`total_seats`, `seats` array)
- [ ] `GitHubApiError` class exported extending `Error` with `statusCode` and `responseBody` properties
- [ ] `fetchAllCopilotSeats(config: { apiMode: ApiMode; entityName: string })` function exported that:
  - Reads `GITHUB_TOKEN` from `process.env` and throws if not set
  - Constructs the base URL: `/orgs/{entityName}/copilot/billing/seats` for organisation mode, `/enterprises/{entityName}/copilot/billing/seats` for enterprise mode
  - Sends requests with `Accept: application/vnd.github+json`, `Authorization: Bearer {token}`, and `X-GitHub-Api-Version: 2022-11-28` headers
  - Uses `per_page=100` and increments `page` until a response returns fewer seats than `per_page`
  - Aggregates all seats from all pages into a single array
  - Throws `GitHubApiError` for non-2xx responses with status code and response body
- [ ] File compiles without TypeScript errors

#### Task 2.2 - [CREATE] GitHub API client unit tests
**Description**: Unit tests for the GitHub API client using mocked `fetch`. Tests cover successful pagination, error handling, missing token, and endpoint selection based on `ApiMode`.

**Definition of Done**:
- [ ] Test file created at `src/lib/__tests__/github-api.test.ts`
- [ ] Tests mock global `fetch` (using `vi.fn()`)
- [ ] Test: throws error when `GITHUB_TOKEN` is not set
- [ ] Test: fetches single page of seats for organisation mode with correct URL and headers
- [ ] Test: fetches single page of seats for enterprise mode with correct URL and headers
- [ ] Test: handles multi-page pagination (e.g., 150 seats across 2 pages with `per_page=100`)
- [ ] Test: throws `GitHubApiError` with status code for 4xx responses (e.g., 401 Unauthorized)
- [ ] Test: throws `GitHubApiError` with status code for 5xx responses (e.g., 503 Service Unavailable)
- [ ] Test: returns empty array when API returns `total_seats: 0` and `seats: []`
- [ ] All tests pass

### Phase 3: Seat Sync Service

#### Task 3.1 - [CREATE] Seat sync service at `src/lib/seat-sync.ts`
**Description**: Create the core sync orchestration service. This function checks configuration, creates a RUNNING job execution record, fetches all seats from the GitHub API, upserts them into the database within a transaction, and updates the job execution with the result. The service is self-contained and can be called from both the scheduler and the manual trigger API route.

**Definition of Done**:
- [ ] File created at `src/lib/seat-sync.ts`
- [ ] `executeSeatSync()` async function exported that:
  - Calls `getDb()` to get the data source
  - Checks if a `Configuration` record exists — if not, logs `"Seat sync skipped: configuration not found"` with `console.warn` and returns `{ skipped: true, reason: "no_configuration" }`
  - Creates a `JobExecution` record with `jobType: SEAT_SYNC`, `status: RUNNING`, `startedAt: new Date()`
  - Calls `fetchAllCopilotSeats()` with the configuration's `apiMode` and `entityName`
  - Within a single database transaction, upserts each seat: finds by `githubUsername`, updates if exists (refreshing `githubUserId`, `assignedAt`, `lastActivityAt`, `lastActivityEditor`, `planType`), creates with `status: ACTIVE` if new
  - On success: updates the `JobExecution` to `status: SUCCESS`, `completedAt: new Date()`, `recordsProcessed: <count>`
  - On error: updates the `JobExecution` to `status: FAILURE`, `completedAt: new Date()`, `errorMessage: <error.message>` (truncated to 2000 chars)
  - Returns `{ skipped: false, jobExecutionId, status, recordsProcessed?, errorMessage? }`
- [ ] Upsert uses TypeORM's `save()` method within a `queryRunner` transaction for atomicity
- [ ] Existing seat enrichment data (`firstName`, `lastName`, `department`) is NOT overwritten during sync
- [ ] Console logging for key steps: sync start, seats fetched count, sync complete/failed
- [ ] File compiles without TypeScript errors

#### Task 3.2 - [CREATE] Seat sync service integration tests
**Description**: Integration tests for `executeSeatSync()` using a test database and mocked GitHub API responses. Tests verify the full sync flow including configuration checks, seat creation, seat updates, job execution logging, and error handling.

**Definition of Done**:
- [ ] Test file created at `src/lib/__tests__/seat-sync.test.ts`
- [ ] Tests use `getTestDataSource()` and `cleanDatabase()` from test helpers
- [ ] Tests mock `src/lib/github-api.ts` module (using `vi.mock`)
- [ ] Test: skips sync when no configuration exists (returns `skipped: true`, no JobExecution created)
- [ ] Test: successfully syncs seats — creates new CopilotSeat records with ACTIVE status and a SUCCESS JobExecution with correct `recordsProcessed`
- [ ] Test: updates existing seats on re-sync — refreshes `lastActivityAt`, `lastActivityEditor`, `assignedAt` without overwriting `firstName`, `lastName`, `department`
- [ ] Test: creates FAILURE JobExecution when GitHub API throws an error, with the error message captured
- [ ] Test: does not corrupt existing seats when sync fails mid-operation (transactional rollback)
- [ ] Test: handles empty seat list from API (0 seats returned, SUCCESS JobExecution with `recordsProcessed: 0`)
- [ ] Database cleaned between tests for isolation
- [ ] All tests pass

### Phase 4: Trigger Mechanisms

#### Task 4.1 - [CREATE] Manual trigger API route at `src/app/api/jobs/seat-sync/route.ts`
**Description**: Create a POST endpoint that allows authenticated admins to manually trigger a seat sync. The endpoint calls `executeSeatSync()` and returns the result. This enables testing and debugging without waiting for the daily schedule.

**Definition of Done**:
- [ ] File created at `src/app/api/jobs/seat-sync/route.ts`
- [ ] `POST` handler calls `requireAuth()` and returns `401` if unauthenticated
- [ ] Handler checks if configuration exists — returns `409` with `{ error: "Configuration not found. Complete first-run setup before syncing." }` if not
- [ ] Handler calls `executeSeatSync()` and returns the result as JSON with `200` status
- [ ] Success response: `{ jobExecutionId, status: "success", recordsProcessed }`
- [ ] Failure response: `{ jobExecutionId, status: "failure", errorMessage }`
- [ ] Skipped response: `{ skipped: true, reason: "no_configuration" }`
- [ ] Internal errors return `500` with `{ error: "Internal server error" }`
- [ ] File compiles without TypeScript errors

#### Task 4.2 - [CREATE] Daily sync scheduler via `instrumentation.ts`
**Description**: Create the Next.js instrumentation file that starts a daily interval to execute the seat sync. The scheduler only runs on the Node.js runtime (not Edge), reads interval configuration from environment variables, and handles errors gracefully without crashing the server.

**Definition of Done**:
- [ ] File created at `instrumentation.ts` in the project root
- [ ] Exports a `register()` function that is called by Next.js on server startup
- [ ] Only activates when `process.env.NEXT_RUNTIME === 'nodejs'`
- [ ] Reads `SEAT_SYNC_INTERVAL_HOURS` env var (default: `24`) to configure the interval in milliseconds
- [ ] Sets up `setInterval` calling `executeSeatSync()` at the configured interval
- [ ] If `SEAT_SYNC_RUN_ON_STARTUP=true`, schedules an initial sync after a 10-second delay (using `setTimeout`) to allow the server to fully boot
- [ ] Wraps each sync invocation in try/catch to prevent scheduler crashes on unhandled errors — logs errors to console
- [ ] Does not start the scheduler if `SEAT_SYNC_ENABLED=false` env var is set
- [ ] `next.config.ts` is updated to include `instrumentationHook: true` in `experimental` if required by the Next.js version
- [ ] File compiles without TypeScript errors

#### Task 4.3 - [CREATE] Manual trigger API route integration tests
**Description**: Integration tests for `POST /api/jobs/seat-sync` using a test database, mocked GitHub API, and mocked auth.

**Definition of Done**:
- [ ] Test file created at `src/app/api/jobs/__tests__/seat-sync.route.test.ts`
- [ ] Mocks `@/lib/db` and `next/headers` (same approach as `job-status/route.test.ts`)
- [ ] Mocks `src/lib/github-api.ts` module
- [ ] Test: returns `401` when not authenticated
- [ ] Test: returns `409` when no configuration exists
- [ ] Test: returns `200` with success result when sync completes — verifies `jobExecutionId`, `status`, and `recordsProcessed` in response
- [ ] Test: returns `200` with failure result when GitHub API throws — verifies `jobExecutionId`, `status`, and `errorMessage` in response
- [ ] Test: creates CopilotSeat records in the database after successful sync
- [ ] Test: creates JobExecution records with correct `jobType` (SEAT_SYNC)
- [ ] Database cleaned between tests for isolation
- [ ] All tests pass

### Phase 5: UI — Manual Sync Trigger

#### Task 5.1 - [MODIFY] Add "Sync Now" button to `JobStatusPanel`
**Description**: Extend the existing `JobStatusPanel` component to include a "Sync Now" button on the Seat Sync job card. When clicked, the button calls `POST /api/jobs/seat-sync`, shows a loading state during execution, displays a success/error message upon completion, and triggers a page refresh (via `router.refresh()`) to update the job status data. The button follows the existing Tailwind and accessibility patterns in the project.

**Definition of Done**:
- [ ] "Sync Now" button rendered inside the Seat Sync `JobCard` in `src/components/settings/JobStatusPanel.tsx`
- [ ] Button calls `POST /api/jobs/seat-sync` on click
- [ ] Button shows a loading/spinner state while the sync is in progress (disabled to prevent double-clicks)
- [ ] On success: displays a brief success message (e.g., "Synced {n} seats") and refreshes the page data via `router.refresh()`
- [ ] On failure: displays the error message returned by the API
- [ ] On 401: does not crash — displays an appropriate error (session expired)
- [ ] Button is accessible: has an `aria-label` ("Trigger seat sync"), disabled state is communicated to screen readers
- [ ] Visual style consistent with the existing component (Tailwind utility classes, compact sizing within the job card)
- [ ] File compiles without TypeScript errors

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [ ] All source code reviewed by `tsh-code-reviewer` agent
- [ ] No critical or high-severity issues remain unresolved
- [ ] All review feedback addressed or documented as intentional design decisions
- [ ] Code follows project conventions (EntitySchema pattern, Zod validation, TypeScript strict mode, file naming)
- [ ] Test coverage is adequate for the feature scope

## Security Considerations

- **GitHub token never in database or API responses**: The `GITHUB_TOKEN` is read exclusively from environment variables. It is never stored in the database, logged, or returned in any API response.
- **Auth-guarded manual trigger**: The `POST /api/jobs/seat-sync` endpoint requires a valid session via `requireAuth()`. Unauthenticated requests receive `401`.
- **Rate limiting awareness**: The GitHub API has rate limits (5,000 requests/hour for authenticated requests). With `per_page=100`, a 1,000-seat organisation requires only 10 API calls per sync. No custom rate limiting is needed at this scale, but the `GitHubApiError` captures 403 rate-limit responses for visibility.
- **Error message sanitisation**: Error messages stored in `JobExecution.errorMessage` are truncated to 2,000 characters to prevent storage of unexpectedly large error payloads.
- **No data leakage in error responses**: API error responses return generic messages. Detailed error information is logged server-side and stored in `JobExecution` — not exposed to the client beyond the `errorMessage` field.
- **Transactional integrity**: Database upserts run within a transaction. A failed sync rolls back all changes, preventing partial/corrupted seat data.
- **Token validation**: The sync service validates that `GITHUB_TOKEN` is set before making any API calls, providing a clear error message rather than an opaque HTTP 401 from GitHub.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] System calls the appropriate GitHub API endpoint based on configuration (`apiMode` selects organisation vs enterprise URL)
- [ ] All current seat assignments are imported into the database (all pages fetched, all seats stored in `copilot_seat` table)
- [ ] New seats discovered during sync are added with `ACTIVE` status
- [ ] Sync runs automatically on a daily schedule (instrumentation.ts setInterval with 24h default)
- [ ] Sync results are logged for troubleshooting (JobExecution record created with status, timestamps, recordsProcessed, and errorMessage)
- [ ] If the GitHub API returns an error, the sync logs the error and retries on the next scheduled run (FAILURE JobExecution, next interval runs fresh)
- [ ] Existing seat data is not corrupted or lost when a sync fails (transaction rollback on error)
- [ ] Sync does not run if application configuration has not been completed; the skipped run is logged (console.warn and `skipped: true` return)
- [ ] Admin can trigger a sync manually via the "Sync Now" button on the Settings page
- [ ] "Sync Now" button shows loading state during execution and displays the result
- [ ] All new unit tests pass (GitHub API client tests)
- [ ] All new integration tests pass (sync service, API route tests)
- [ ] All existing tests continue to pass (no regressions)
- [ ] No TypeScript compilation errors
- [ ] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Webhook-based sync trigger**: Instead of polling on an interval, listen for GitHub webhook events (e.g., `copilot_seat_assignment_created/cancelled`) for real-time sync. Reduces unnecessary API calls and provides faster updates.
- **Concurrent sync prevention**: Add a distributed lock or check for an existing RUNNING JobExecution before starting a new sync. Currently harmless (upsert is idempotent) but could prevent duplicate API calls.
- **Retry with exponential backoff**: On transient GitHub API errors (429, 503), retry with exponential backoff within the same sync run instead of waiting for the next daily interval.
- **GitHub App authentication**: Support GitHub App installation tokens in addition to personal access tokens for enterprise deployments with stricter security requirements.
- **Sync history UI**: Display historical sync executions (not just the latest) on the settings page with timestamps, record counts, and error details.
- **Configurable sync schedule via UI**: Allow admins to configure the sync interval through the settings page rather than requiring environment variable changes.
- **Avatar URL storage**: Store the `assignee.avatar_url` from the GitHub API for display in the seat list UI.
- **Rate limit tracking**: Parse GitHub's `X-RateLimit-Remaining` response header and log warnings when approaching the limit.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Added Phase 5: "Sync Now" UI button on Settings page JobStatusPanel |
