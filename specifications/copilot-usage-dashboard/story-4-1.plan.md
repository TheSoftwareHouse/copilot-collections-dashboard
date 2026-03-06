# Story 4.1: System collects per-user usage from GitHub API on configured interval — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 4.1 |
| Title | System collects per-user usage from GitHub API on configured interval |
| Description | Establish an automated pipeline that fetches premium request usage data for each active seat holder from the GitHub billing API at a configurable interval and stores it in the database. The system determines which days need collection per user, handles per-user errors gracefully without blocking other users, and logs execution results via JobExecution. Failed collections are retried on the next scheduled run. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md` |

## Proposed Solution

Implement an automated usage collection pipeline with four layers: a **CopilotUsage entity** for persistent storage with model-level breakdown preserved as JSONB, a **GitHub API client extension** for fetching per-user premium request usage, a **usage collection service** that orchestrates the fetch-and-store logic with per-user error isolation, and **scheduling + manual trigger mechanisms** mirroring the existing seat sync pattern.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 Next.js App                                      │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  instrumentation.ts (server startup)                                       │  │
│  │  └─ Seat sync scheduler (existing, every 24h)                             │  │
│  │  └─ Usage collection scheduler (NEW, configurable interval)               │  │
│  │     └─ runs executeUsageCollection() every N hours                        │  │
│  └───────────────────────────────────────────────────────────┬────────────────┘  │
│                                                               │                  │
│  ┌────────────────────────────────────────────────────────┐   │                  │
│  │  POST /api/jobs/usage-collection (auth-guarded) (NEW)  │   │                  │
│  │  Manual trigger from UI button + testing/debugging     │   │                  │
│  └──────────────────────────────────────────┬─────────────┘   │                  │
│                                              │                 │                  │
│  ┌────────────────────────────────────────────────────────┐   │                  │
│  │  Settings Page — JobStatusPanel (existing)             │   │                  │
│  │  [Collect Now] button → POST /api/jobs/usage-collection│   │                  │
│  └────────────────────────────────────────────────────────┘   │                  │
│                                              │                 │                  │
│                                              ▼                 ▼                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  src/lib/usage-collection.ts — Usage Collection Service (NEW)              │  │
│  │                                                                            │  │
│  │  executeUsageCollection()                                                  │  │
│  │  1. Check configuration exists → skip if not                              │  │
│  │  2. Create JobExecution(USAGE_COLLECTION, RUNNING)                        │  │
│  │  3. Fetch all ACTIVE seats from DB                                        │  │
│  │  4. For each seat:                                                        │  │
│  │     a. Determine date range (last collected date + 1 → today)             │  │
│  │     b. For each day in range:                                             │  │
│  │        - Call fetchPremiumRequestUsage(entityName, username, day, m, y)    │  │
│  │        - Upsert into copilot_usage table                                  │  │
│  │     c. On per-user error: log and continue to next seat                   │  │
│  │  5. Update JobExecution(SUCCESS/FAILURE, recordsProcessed)                │  │
│  └───────────┬────────────────────────────────────────┬───────────────────────┘  │
│               │                                        │                         │
│               ▼                                        ▼                         │
│  ┌──────────────────────────────┐     ┌──────────────────────────────────────┐  │
│  │  src/lib/github-api.ts       │     │  PostgreSQL                          │  │
│  │  GitHub API Client           │     │                                      │  │
│  │                              │     │  ┌───────────────┐  ┌─────────────┐  │  │
│  │  fetchAllCopilotSeats()      │     │  │ copilot_usage │  │copilot_seat │  │  │
│  │  (existing)                  │     │  │ (NEW)         │  │ (existing)  │  │  │
│  │                              │     │  │               │  │             │  │  │
│  │  fetchPremiumRequestUsage()  │     │  │ seatId (FK)──►│  │             │  │  │
│  │  (NEW)                       │     │  │ day, month,   │  │             │  │  │
│  │                              │     │  │ year          │  │             │  │  │
│  └──────────────────────────────┘     │  │ usageItems    │  └─────────────┘  │  │
│               │                        │  │ (JSONB)       │                   │  │
│               ▼                        │  └───────────────┘                   │  │
│  ┌──────────────────────────────┐     │                                      │  │
│  │  GitHub Billing REST API     │     │  ┌─────────────┐  ┌──────────────┐  │  │
│  │                              │     │  │job_execution │  │configuration │  │  │
│  │  GET /organizations/{org}/   │     │  │ (existing)   │  │ (existing)   │  │  │
│  │  settings/billing/           │     │  └─────────────┘  └──────────────┘  │  │
│  │  premium_request/usage       │     └──────────────────────────────────────┘  │
│  │  ?user=X&day=D&month=M&     │                                                │
│  │   year=Y                     │                                                │
│  └──────────────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Usage items stored as JSONB**: The `usageItems` array from the GitHub API is stored as a JSONB column on the `copilot_usage` record. This preserves the full model-level breakdown without requiring a separate table. The data is always read and written as a complete set per user-day, making JSONB the natural fit. Future dashboard aggregations can use PostgreSQL's `jsonb_array_elements` for efficient querying.

2. **Foreign key to `copilot_seat`**: Rather than storing the GitHub username as a string, `copilot_usage` references `copilot_seat.id`. This enforces referential integrity (you can't have usage data for a seat that doesn't exist) and makes joins for dashboard queries efficient without string matching.

3. **Unique constraint on `(seatId, day, month, year)`**: The database enforces that only one usage record exists per seat per calendar day. When the collection re-runs for a date that already has data, the existing record is updated (upsert) rather than duplicated. This naturally supports Story 4.2's uniqueness requirements and makes retries idempotent.

4. **Per-user date tracking**: Instead of relying on the global `JobExecution` timestamp to determine which days to collect, the service queries the latest date in `copilot_usage` per seat. This is more robust because: (a) new seats that were added after the last collection need data from today, (b) seats that failed on a specific day will be retried from that specific day, (c) different seats can have different "last collected" dates after a partial failure.

5. **Per-user error isolation**: Unlike the seat sync which is transactional (all-or-nothing), usage collection continues when a single user's API call fails. Each user's data is upserted independently. The error is logged and the failed user's data will be retried on the next scheduled run (since they'll still have a gap). The overall job is marked SUCCESS if at least some users were collected, with `errorMessage` summarising any per-user failures.

6. **Default start date is today**: When a seat has no existing usage data, the collection starts from today's date. This avoids an unbounded backfill that could generate thousands of API calls for a large organisation. Admins can trigger historical backfill manually if needed (out of scope, documented in Improvements).

7. **Same scheduling pattern as seat sync**: The usage collection scheduler uses the same `instrumentation.ts` pattern with `setInterval`, configurable via `USAGE_COLLECTION_INTERVAL_HOURS` (default: 24) and `USAGE_COLLECTION_ENABLED` (default: true). Optional startup collection is controlled by `USAGE_COLLECTION_RUN_ON_STARTUP`.

8. **Monetary values as `numeric` type**: The `pricePerUnit`, `grossAmount`, `discountAmount`, and `netAmount` fields within usage items are stored as JSON numbers. Since they are inside a JSONB column and come directly from the GitHub API, they retain the API's precision. For database-level aggregation, PostgreSQL's `jsonb`→`numeric` casts preserve precision.

9. **"Collect Now" button on Settings page**: The existing `JobStatusPanel` already displays the Usage Collection job card. A "Collect Now" button is added following the same pattern as the Seat Sync "Sync Now" button from Story 3.1, providing manual trigger capability from the UI.

10. **API rate limit consideration**: Each active seat requires one API call per day of missing data. For 100 seats collecting 1 day each, that's 100 calls well within GitHub's 5,000 requests/hour limit. For larger back-fills or many seats, the sequential per-user processing acts as natural rate limiting. The `GitHubApiError` captures 403/429 responses for visibility.

### API Contracts

**GitHub Premium Request Usage API**

| Method | URL |
|--------|-----|
| GET | `https://api.github.com/organizations/{entityName}/settings/billing/premium_request/usage?user={username}&day={day}&month={month}&year={year}` |

**Request Headers**: `Accept: application/vnd.github+json`, `Authorization: Bearer {GITHUB_TOKEN}`, `X-GitHub-Api-Version: 2022-11-28`

**Response shape**:
```json
{
  "timePeriod": { "year": 2026, "month": 2, "day": 1 },
  "user": "octocat",
  "organization": "MyOrg",
  "usageItems": [
    {
      "product": "Copilot",
      "sku": "Copilot Premium Request",
      "model": "Claude Sonnet 4.5",
      "unitType": "requests",
      "pricePerUnit": 0.04,
      "grossQuantity": 53.0,
      "grossAmount": 2.12,
      "discountQuantity": 53.0,
      "discountAmount": 2.12,
      "netQuantity": 0.0,
      "netAmount": 0.0
    }
  ]
}
```

**POST /api/jobs/usage-collection** (manual trigger)

| Status | Body |
|--------|------|
| 200 | `{ jobExecutionId, status: "success", recordsProcessed, usersProcessed, usersErrored, errorMessage? }` |
| 200 | `{ jobExecutionId, status: "failure", errorMessage }` |
| 401 | `{ error: "Authentication required" }` |
| 409 | `{ error: "Configuration not found. Complete first-run setup before collecting usage data." }` |

### Data Model

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│        CopilotUsage (NEW)            │         │         CopilotSeat (existing)       │
├──────────────────────────────────────┤         ├──────────────────────────────────────┤
│ id          : Int (PK, auto)         │         │ id          : Int (PK, auto)         │
│ seatId      : Int (FK → copilot_seat)│────────►│ githubUsername : Varchar(255) UNIQUE │
│ day         : Smallint, NOT NULL     │         │ githubUserId  : Int                  │
│ month       : Smallint, NOT NULL     │         │ status        : Enum (ACTIVE/INACTIVE│
│ year        : Smallint, NOT NULL     │         │ firstName     : Varchar(255)?        │
│ usageItems  : JSONB, NOT NULL        │         │ lastName      : Varchar(255)?        │
│ createdAt   : Timestamptz            │         │ department    : Varchar(255)?        │
│ updatedAt   : Timestamptz            │         │ ...                                  │
└──────────────────────────────────────┘         └──────────────────────────────────────┘

Constraints:
- UNIQUE(seatId, day, month, year) — prevents duplicate records per user per day
- FOREIGN KEY(seatId) → copilot_seat(id)

Indexes:
- UQ_copilot_usage_seat_day (seatId, day, month, year) — unique constraint index
- IDX_copilot_usage_seat_id (seatId) — FK lookup performance
- IDX_copilot_usage_year_month (year, month) — dashboard queries by period
```

### UsageItem JSONB Structure

```typescript
interface UsageItem {
  product: string;       // e.g., "Copilot"
  sku: string;           // e.g., "Copilot Premium Request"
  model: string;         // e.g., "Claude Sonnet 4.5"
  unitType: string;      // e.g., "requests"
  pricePerUnit: number;  // e.g., 0.04
  grossQuantity: number; // e.g., 53.0
  grossAmount: number;   // e.g., 2.12
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}
```

## Current Implementation Analysis

### Already Implemented
- `src/entities/configuration.entity.ts` — `Configuration` entity with `apiMode` and `entityName` — used to determine which GitHub API endpoint and organisation name to use
- `src/entities/copilot-seat.entity.ts` — `CopilotSeat` entity with `githubUsername`, `status` — used to iterate over active seats for collection
- `src/entities/job-execution.entity.ts` — `JobExecution` entity — reused to log collection execution results
- `src/entities/enums.ts` — `JobType.USAGE_COLLECTION` enum value already exists — reused directly
- `src/lib/db.ts` — `getDb()` database connection singleton — reused in collection service and API route
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused to protect the manual trigger endpoint
- `src/lib/github-api.ts` — `GitHubApiError` class, authentication pattern, header constants — reused and extended
- `src/lib/seat-sync.ts` — Established pattern for service structure (config check → job creation → API fetch → DB persist → job update) — used as reference
- `instrumentation.ts` — Scheduler pattern with env-var-based configuration — modified to add usage collection scheduling
- `src/app/api/jobs/seat-sync/route.ts` — Manual trigger pattern (auth → execute → respond) — used as template for usage collection route
- `src/app/api/job-status/route.ts` — Already returns `usageCollection` job data — no changes needed
- `src/components/settings/JobStatusPanel.tsx` — Already renders Usage Collection job card — to be extended with "Collect Now" button
- `src/lib/data-source.ts` — Application data source — to be extended with new entity
- `src/lib/data-source.cli.ts` — CLI data source for migrations — to be extended with new entity
- `src/test/db-helpers.ts` — Test infrastructure — to be extended with new entity and cleanup

### To Be Modified
- `src/lib/github-api.ts` — Add `fetchPremiumRequestUsage()` function and related TypeScript interfaces for the billing API response
- `src/lib/data-source.ts` — Register `CopilotUsageEntity` in the entities array
- `src/lib/data-source.cli.ts` — Register `CopilotUsageEntity` in the entities array
- `src/test/db-helpers.ts` — Register `CopilotUsageEntity` and extend `cleanDatabase()` to clear the `copilot_usage` table
- `instrumentation.ts` — Add usage collection scheduler alongside existing seat sync scheduler
- `src/components/settings/JobStatusPanel.tsx` — Add "Collect Now" button to the Usage Collection job card

### To Be Created
- `src/entities/copilot-usage.entity.ts` — TypeORM EntitySchema for the `copilot_usage` table with JSONB usage items and unique constraint
- `migrations/<timestamp>-CreateCopilotUsage.ts` — Database migration for the new table, FK, unique constraint, and indexes
- `src/lib/usage-collection.ts` — Usage collection service orchestrating the full collection flow
- `src/app/api/jobs/usage-collection/route.ts` — `POST` endpoint for manual collection triggering (auth-guarded)
- `src/lib/__tests__/github-api.test.ts` — Additional unit tests for the new `fetchPremiumRequestUsage()` function
- `src/lib/__tests__/usage-collection.test.ts` — Integration tests for the usage collection service
- `src/app/api/jobs/__tests__/usage-collection.route.test.ts` — Integration tests for the manual trigger API route

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What is the default start date when no usage data exists for a seat? | Today's date. This avoids an unbounded backfill. Historical backfill is a separate concern (documented in Improvements). | ✅ Resolved |
| 2 | Should the collection job be marked SUCCESS or FAILURE when some users fail? | SUCCESS with a summary `errorMessage` listing failed usernames. The job completed its work; per-user failures are expected (e.g., user removed from org mid-collection). Failed users are retried on the next run. | ✅ Resolved |
| 3 | Is there an enterprise variant of the premium request usage API? | The project.md only documents the `organizations` endpoint. For enterprise mode we'll use the same URL pattern with `organizations` since the billing API structure is consistent. If enterprise requires a different path (e.g., `/enterprises/{name}/settings/billing/...`), it can be adjusted later. | ✅ Resolved |
| 4 | Should today's (potentially incomplete) data be collected? | Yes. The upsert logic means the next collection run will overwrite today's data with the updated values. This is simpler than excluding today and ensures the dashboard always shows the most recent available data. | ✅ Resolved |
| 5 | What is the default collection interval? | 24 hours via `USAGE_COLLECTION_INTERVAL_HOURS` env var. This balances freshness with API rate limits. Can be reduced to 6-12 hours for near-real-time dashboards. | ✅ Resolved |
| 6 | Should each user's data be upserted in a transaction? | Each user's days are upserted individually (one DB operation per day per user). There's no need for a cross-user transaction since per-user error isolation is a core requirement. If a single user's upsert fails, it does not roll back other users' data. | ✅ Resolved |
| 7 | How does the system handle API responses with empty `usageItems`? | Empty `usageItems` arrays are stored as `[]` in the JSONB column. This distinguishes "user had no premium usage on this day" from "data was never collected for this day" (no record exists). | ✅ Resolved |

## Implementation Plan

### Phase 1: Data Model & Migration

#### Task 1.1 - [CREATE] `CopilotUsage` entity at `src/entities/copilot-usage.entity.ts`
**Description**: Create a TypeORM EntitySchema for the `copilot_usage` table. The entity stores per-user daily usage data with model-level breakdowns preserved as a JSONB column. It references `copilot_seat` via a foreign key and enforces uniqueness on `(seatId, day, month, year)`.

**Definition of Done**:
- [x] Entity file created at `src/entities/copilot-usage.entity.ts` using `EntitySchema` pattern (matching `CopilotSeatEntity` and `JobExecutionEntity` conventions)
- [x] `UsageItem` TypeScript interface exported with fields: `product` (string), `sku` (string), `model` (string), `unitType` (string), `pricePerUnit` (number), `grossQuantity` (number), `grossAmount` (number), `discountQuantity` (number), `discountAmount` (number), `netQuantity` (number), `netAmount` (number)
- [x] `CopilotUsage` TypeScript interface exported with fields: `id` (number), `seatId` (number), `day` (number), `month` (number), `year` (number), `usageItems` (UsageItem[]), `createdAt` (Date), `updatedAt` (Date)
- [x] `seatId` column defined as `int`, NOT NULL, with a relation to `CopilotSeat` entity
- [x] `day`, `month`, `year` columns defined as `smallint`, NOT NULL
- [x] `usageItems` column defined as `jsonb`, NOT NULL
- [x] `createdAt` uses `createDate: true`, `updatedAt` uses `updateDate: true`
- [x] Unique constraint on `(seatId, day, month, year)` with name `UQ_copilot_usage_seat_day`
- [x] Index on `seatId` with name `IDX_copilot_usage_seat_id`
- [x] Index on `(year, month)` with name `IDX_copilot_usage_year_month`
- [x] ManyToOne relation defined: `CopilotUsage.seatId` → `CopilotSeat.id`
- [x] File compiles without TypeScript errors

#### Task 1.2 - [MODIFY] Register `CopilotUsageEntity` in data sources
**Description**: Add the new entity to both the application data source and CLI data source so TypeORM recognises it for queries and migrations.

**Definition of Done**:
- [x] `CopilotUsageEntity` imported and added to the `entities` array in `src/lib/data-source.ts`
- [x] `CopilotUsageEntity` imported and added to the `entities` array in `src/lib/data-source.cli.ts`
- [x] Application starts without errors
- [x] TypeORM CLI commands recognise the new entity

#### Task 1.3 - [CREATE] Database migration for `copilot_usage` table
**Description**: Generate a TypeORM migration that creates the `copilot_usage` table with the foreign key to `copilot_seat`, unique constraint on `(seatId, day, month, year)`, and performance indexes.

**Definition of Done**:
- [x] Migration generated via `npm run typeorm:generate -- migrations/<timestamp>-CreateCopilotUsage`
- [x] Migration creates the `copilot_usage` table with all columns matching the entity definition
- [x] Migration creates a foreign key constraint from `seatId` to `copilot_seat(id)`
- [x] Migration creates a unique constraint on `(seatId, day, month, year)` named `UQ_copilot_usage_seat_day`
- [x] Migration creates index `IDX_copilot_usage_seat_id` on `seatId`
- [x] Migration creates index `IDX_copilot_usage_year_month` on `(year, month)`
- [x] Migration applies cleanly on a fresh database (`npm run typeorm:migrate`)
- [x] Migration reverts cleanly (`npm run typeorm:revert`)

#### Task 1.4 - [MODIFY] Extend test helpers with `CopilotUsageEntity`
**Description**: Register the new entity in the test data source and extend the `cleanDatabase` function to clear the `copilot_usage` table. The usage table must be cleared before `copilot_seat` due to the foreign key constraint.

**Definition of Done**:
- [x] `CopilotUsageEntity` imported and added to the `entities` array in `src/test/db-helpers.ts`
- [x] `cleanDatabase` function clears the `copilot_usage` table before `copilot_seat` (FK dependency order)
- [x] Existing tests continue to pass

### Phase 2: GitHub API Client Extension

#### Task 2.1 - [MODIFY] Add `fetchPremiumRequestUsage()` to `src/lib/github-api.ts`
**Description**: Extend the existing GitHub API client with a function for fetching per-user premium request usage data from the GitHub billing API. The function follows the same authentication and error-handling patterns as `fetchAllCopilotSeats()`.

**Definition of Done**:
- [x] `GitHubUsageItem` TypeScript interface exported matching the API response's `usageItems` array element shape (product, sku, model, unitType, pricePerUnit, grossQuantity, grossAmount, discountQuantity, discountAmount, netQuantity, netAmount)
- [x] `GitHubUsageResponse` TypeScript interface exported matching the full API response shape: `timePeriod` (year, month, day), `user` (string), `organization` (string), `usageItems` (GitHubUsageItem[])
- [x] `fetchPremiumRequestUsage(config: { entityName: string; username: string; day: number; month: number; year: number })` function exported that:
  - Reads `GITHUB_TOKEN` from `process.env` and throws if not set
  - Constructs URL: `https://api.github.com/organizations/{entityName}/settings/billing/premium_request/usage?user={username}&day={day}&month={month}&year={year}`
  - Sends request with same headers as `fetchAllCopilotSeats()` (`Accept`, `Authorization`, `X-GitHub-Api-Version`)
  - Returns the parsed response as `GitHubUsageResponse`
  - Throws `GitHubApiError` for non-2xx responses with status code and response body
- [x] File compiles without TypeScript errors

#### Task 2.2 - [CREATE] Unit tests for `fetchPremiumRequestUsage()`
**Description**: Unit tests for the new GitHub API function using mocked `fetch`. Tests cover successful responses, error handling, missing token, and correct URL construction.

**Definition of Done**:
- [x] Tests added to `src/lib/__tests__/github-api.test.ts` in a new `describe("fetchPremiumRequestUsage")` block
- [x] Test: throws error when `GITHUB_TOKEN` is not set
- [x] Test: fetches usage data with correct URL including query parameters (user, day, month, year)
- [x] Test: sends correct authorization headers
- [x] Test: returns parsed `GitHubUsageResponse` with `timePeriod`, `user`, `organization`, and `usageItems`
- [x] Test: handles response with empty `usageItems` array (returns response with `usageItems: []`)
- [x] Test: throws `GitHubApiError` with status code for 4xx responses (e.g., 404 Not Found)
- [x] Test: throws `GitHubApiError` with status code for 5xx responses (e.g., 503 Service Unavailable)
- [x] All new and existing tests pass

### Phase 3: Usage Collection Service

#### Task 3.1 - [CREATE] Usage collection service at `src/lib/usage-collection.ts`
**Description**: Create the core collection orchestration service. This function checks configuration, creates a RUNNING job execution record, iterates over all active seats, determines which days need collection per seat, fetches usage data from the GitHub API, upserts it into the database, and handles per-user errors gracefully. The service follows the same structural pattern as `seat-sync.ts`.

**Definition of Done**:
- [x] File created at `src/lib/usage-collection.ts`
- [x] `UsageCollectionResult` interface exported with fields: `skipped` (boolean), `reason?` (string), `jobExecutionId?` (number), `status?` (string), `recordsProcessed?` (number), `usersProcessed?` (number), `usersErrored?` (number), `errorMessage?` (string)
- [x] `executeUsageCollection()` async function exported that:
  - Calls `getDb()` to get the data source
  - Checks if a `Configuration` record exists — if not, logs `"Usage collection skipped: configuration not found"` with `console.warn` and returns `{ skipped: true, reason: "no_configuration" }`
  - Creates a `JobExecution` record with `jobType: USAGE_COLLECTION`, `status: RUNNING`, `startedAt: new Date()`
  - Fetches all ACTIVE seats from the `copilot_seat` table
  - If no active seats exist, completes with SUCCESS and `recordsProcessed: 0`
  - For each active seat:
    - Queries the latest `(year, month, day)` from `copilot_usage` where `seatId` matches
    - If no existing data, starts from today; otherwise starts from the day after the latest date
    - Generates a list of dates from start date to today (inclusive)
    - For each date, calls `fetchPremiumRequestUsage()` with the configuration's `entityName`, seat's `githubUsername`, and the date components
    - Upserts the response into `copilot_usage` table (inserts if not exists, updates `usageItems` and `updatedAt` if exists)
    - If an error occurs for this specific user/date, catches the error, logs it with `console.error`, increments the error counter, and continues to the next seat
  - On completion: updates JjobExecution to `status: SUCCESS`, `completedAt: new Date()`, `recordsProcessed: <total upserted count>`
  - If ALL users failed: updates JobExecution to `status: FAILURE`, `errorMessage` summarising the failures
  - If some users failed: updates JobExecution to `status: SUCCESS`, `errorMessage` listing failed usernames and error details (truncated to 2000 chars)
  - Returns `UsageCollectionResult` with all stats
- [x] Error messages stored in `JobExecution.errorMessage` are truncated to 2000 characters
- [x] Console logging for key steps: collection start, per-user fetch progress, per-user errors, collection complete
- [x] File compiles without TypeScript errors

#### Task 3.2 - [CREATE] Usage collection service integration tests
**Description**: Integration tests for `executeUsageCollection()` using a test database and mocked GitHub API responses. Tests verify the full collection flow including configuration checks, date range calculation, per-user error handling, upsert logic, and job execution logging.

**Definition of Done**:
- [x] Test file created at `src/lib/__tests__/usage-collection.test.ts`
- [x] Tests use `getTestDataSource()` and `cleanDatabase()` from test helpers
- [x] Tests mock `src/lib/github-api.ts` module (using `vi.mock`) — mock both `fetchAllCopilotSeats` and `fetchPremiumRequestUsage`
- [x] Tests seed configuration and copilot_seat records as prerequisites
- [x] Test: skips collection when no configuration exists (returns `skipped: true`, no JobExecution created)
- [x] Test: returns SUCCESS with `recordsProcessed: 0` when no active seats exist
- [x] Test: collects usage for a single seat with no prior data — creates a `copilot_usage` record for today with correct `seatId`, `day`, `month`, `year`, and `usageItems` JSONB
- [x] Test: collects usage for multiple seats — creates records for each seat
- [x] Test: determines correct date range — fetches only days after the latest stored date for each seat
- [x] Test: upserts data when a record already exists for the same seat + date — updates `usageItems` and `updatedAt`, does not create a duplicate
- [x] Test: continues collecting for remaining users when one user's API call fails — creates a SUCCESS JobExecution with `errorMessage` mentioning the failed user
- [x] Test: marks JobExecution as FAILURE when ALL users fail
- [x] Test: stores empty `usageItems` array when the API returns no usage items for a day
- [x] Test: creates correct `JobExecution` record with `jobType: USAGE_COLLECTION` and appropriate `status`, `recordsProcessed`, `completedAt`
- [x] Database cleaned between tests for isolation
- [x] All tests pass

### Phase 4: Scheduling & API Route

#### Task 4.1 - [CREATE] Manual trigger API route at `src/app/api/jobs/usage-collection/route.ts`
**Description**: Create a POST endpoint that allows authenticated admins to manually trigger a usage collection. The endpoint calls `executeUsageCollection()` and returns the result. Follows the same pattern as `POST /api/jobs/seat-sync`.

**Definition of Done**:
- [x] File created at `src/app/api/jobs/usage-collection/route.ts`
- [x] `POST` handler calls `requireAuth()` and returns `401` if unauthenticated
- [x] If `executeUsageCollection()` returns `skipped: true`, responds with `409` and `{ error: "Configuration not found. Complete first-run setup before collecting usage data." }`
- [x] On successful collection: responds with `200` and `{ jobExecutionId, status, recordsProcessed, usersProcessed, usersErrored, errorMessage? }`
- [x] Internal errors return `500` with `{ error: "Internal server error" }`
- [x] Console logging for unexpected errors
- [x] File compiles without TypeScript errors

#### Task 4.2 - [MODIFY] Add usage collection scheduler to `instrumentation.ts`
**Description**: Extend the existing instrumentation file to also start a usage collection scheduler alongside the seat sync scheduler. The usage collection scheduler follows the same pattern with its own set of environment variables for configuration.

**Definition of Done**:
- [x] Usage collection scheduler added to the `register()` function in `instrumentation.ts`
- [x] Scheduler reads `USAGE_COLLECTION_ENABLED` env var (default: enabled, skipped if set to `"false"`)
- [x] Scheduler reads `USAGE_COLLECTION_INTERVAL_HOURS` env var (default: `24`) and validates the value
- [x] Sets up `setInterval` calling `executeUsageCollection()` at the configured interval
- [x] If `USAGE_COLLECTION_RUN_ON_STARTUP=true`, schedules an initial collection after a 15-second delay (staggered from seat sync's 10s to avoid concurrent DB load)
- [x] Wraps each collection invocation in try/catch to prevent scheduler crashes
- [x] Logs scheduler start with interval configuration
- [x] Logs skip message when disabled
- [x] File compiles without TypeScript errors

#### Task 4.3 - [CREATE] Manual trigger API route integration tests
**Description**: Integration tests for `POST /api/jobs/usage-collection` using a test database and mocked dependencies.

**Definition of Done**:
- [x] Test file created at `src/app/api/jobs/__tests__/usage-collection.route.test.ts`
- [x] Tests mock `@/lib/db`, `@/lib/github-api`, and authentication (same approach as `seat-sync.route.test.ts`)
- [x] Test: returns `401` when not authenticated
- [x] Test: returns `409` when no configuration exists
- [x] Test: returns `200` with success result when collection completes — verifies `jobExecutionId`, `status`, and `recordsProcessed` in response
- [x] Test: returns `200` with error details when some users fail — verifies `usersErrored` and `errorMessage` in response
- [x] Test: creates `CopilotUsage` records in the database after successful collection
- [x] Test: creates `JobExecution` records with `jobType` set to `USAGE_COLLECTION`
- [x] Database cleaned between tests for isolation
- [x] All tests pass

### Phase 5: UI — Manual Collection Trigger

#### Task 5.1 - [MODIFY] Add "Collect Now" button to `JobStatusPanel`
**Description**: Extend the existing `JobStatusPanel` component to include a "Collect Now" button on the Usage Collection job card. The implementation follows the same pattern as the Seat Sync "Sync Now" button: calls `POST /api/jobs/usage-collection`, shows a loading state, displays results, and refreshes the page data.

**Definition of Done**:
- [x] "Collect Now" button rendered inside the Usage Collection `JobCard` in `src/components/settings/JobStatusPanel.tsx`
- [x] Button calls `POST /api/jobs/usage-collection` on click
- [x] Button shows a loading/spinner state while collection is in progress (disabled to prevent double-clicks)
- [x] On success: displays a brief success message (e.g., "Collected {n} records for {m} users") and refreshes the page data via `router.refresh()`
- [x] On failure: displays the error message returned by the API
- [x] On 401: displays an appropriate error (session expired)
- [x] Button is accessible: has an `aria-label` ("Trigger usage collection"), disabled state is communicated to screen readers
- [x] Visual style consistent with existing "Sync Now" button (Tailwind utility classes, compact sizing within the job card)
- [x] File compiles without TypeScript errors

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to project patterns, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All new and modified source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (EntitySchema pattern, error handling, TypeScript, file naming)
- [x] Test coverage is adequate for the feature scope
- [x] Per-user error isolation is correctly implemented and tested

## Security Considerations

- **GitHub token never in database or API responses**: The `GITHUB_TOKEN` is read exclusively from environment variables. It is never stored in the database, logged, or returned in any API response.
- **Auth-guarded manual trigger**: The `POST /api/jobs/usage-collection` endpoint requires a valid session via `requireAuth()`. Unauthenticated requests receive `401`.
- **Usage data sensitivity**: Premium request usage data includes cost information (`pricePerUnit`, `grossAmount`, `netAmount`). This data is only accessible to authenticated users through the dashboard. The API response does not expose raw usage data — it's stored in the database and rendered by authorised UI components.
- **Rate limiting awareness**: Each active seat requires one API call per day of missing data. For 200 seats × 1 day = 200 API calls, well within GitHub's 5,000/hour limit. The sequential per-user processing acts as natural throttling. `GitHubApiError` captures 403/429 responses for visibility.
- **Error message sanitisation**: Error messages stored in `JobExecution.errorMessage` are truncated to 2,000 characters to prevent storage of unexpectedly large payloads.
- **No data leakage in error responses**: API error responses return generic messages. Per-user error details are stored in `JobExecution.errorMessage` for admin visibility, not in client-facing error responses beyond the `errorMessage` field.
- **Input validation**: Date parameters passed to the GitHub API are derived from database timestamps and system clock — not from user input. No injection vector exists for API URL manipulation.
- **Foreign key integrity**: The `copilot_usage.seatId` foreign key ensures usage data can only be associated with known seats. Orphaned usage records are prevented at the database level.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] System calls the GitHub usage API for each active seat holder (`fetchPremiumRequestUsage` called for every seat with `status: ACTIVE`)
- [ ] Usage data is fetched for each day since the last successful collection (date range calculated per user from latest `copilot_usage` record)
- [ ] Data includes full model-level breakdown (product, SKU, model, quantities, amounts — preserved as JSONB `usageItems`)
- [ ] Collection runs automatically at the configured interval (`instrumentation.ts` setInterval with `USAGE_COLLECTION_INTERVAL_HOURS`)
- [ ] Collection results are logged for troubleshooting (`JobExecution` record created with status, timestamps, recordsProcessed, errorMessage)
- [ ] If the API returns an error for a specific user, the system continues collecting for remaining users (per-user try/catch, error counter, summary logged)
- [ ] Failed collections are retried on the next scheduled run (failed user's date gap persists, next run re-fetches)
- [ ] Admin can trigger collection manually via the "Collect Now" button on the Settings page
- [ ] "Collect Now" button shows loading state during execution and displays the result
- [ ] All new unit tests pass (GitHub API client tests for `fetchPremiumRequestUsage`)
- [ ] All new integration tests pass (usage collection service, API route tests)
- [ ] All existing tests continue to pass (no regressions)
- [ ] No TypeScript compilation errors
- [ ] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Historical backfill command**: Provide an admin-triggered mechanism to backfill usage data for a specific date range (e.g., 30/60/90 days). Currently, collection starts from today — historical data requires manual API calls or a dedicated backfill job.
- **Parallel per-user fetching**: Fetch usage data for multiple users concurrently (e.g., 5 at a time using `Promise.allSettled`) to reduce total collection time for large organisations. Sequential processing is simple and reliable but slower.
- **Configurable collection start date**: Allow admins to set a "collect from" date per seat or globally, overriding the default "start from today" behaviour for initial setup.
- **Collection progress tracking**: Store per-user collection status (last collected date, error count) in a dedicated table for granular visibility. Currently, only the `copilot_usage` table and `JobExecution` records provide indirect tracking.
- **Rate limit header parsing**: Parse GitHub's `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers. Temporarily pause collection when approaching the limit rather than failing with a 403.
- **Webhook-based collection trigger**: Subscribe to GitHub webhook events that signal new usage data availability, replacing interval-based polling for reduced API calls and fresher data.
- **Enterprise endpoint support**: Verify and implement the enterprise-specific billing API URL if it differs from the organisation endpoint. Currently assumes the same URL structure.
- **Collection interval configurable via UI**: Allow admins to configure the collection interval through the Settings page rather than requiring environment variable changes.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Phase 1 completed: CopilotUsage entity, data source registration, migration (1772277589638-CreateCopilotUsage), test helpers updated. Used TRUNCATE TABLE copilot_usage, copilot_seat in cleanDatabase() to handle FK constraint (TypeORM clear() uses TRUNCATE which rejects FK references). 187/187 tests pass, build succeeds. |
| 2026-02-28 | Phase 2 completed: Added GitHubUsageItem, GitHubUsageResponse interfaces and fetchPremiumRequestUsage() function to github-api.ts. 8 new unit tests added. 15/15 github-api tests pass (7 existing + 8 new). |
| 2026-02-28 | Phase 3 completed: Created usage-collection.ts service with executeUsageCollection(). 11 integration tests in usage-collection.test.ts. Fixed today always re-fetched for upsert support (plan decision #4). Used mockImplementation for order-independent seat error tests. 206/206 tests pass. |
| 2026-02-28 | Phase 4 completed: Created POST /api/jobs/usage-collection route. Added usage collection scheduler to instrumentation.ts with USAGE_COLLECTION_ENABLED, USAGE_COLLECTION_INTERVAL_HOURS (default 24), USAGE_COLLECTION_RUN_ON_STARTUP (15s delay). 6 route integration tests. Refactored instrumentation.ts to not early-return when seat sync disabled. 212/212 tests pass, build succeeds. |
| 2026-02-28 | Phase 5 completed: Added CollectNowButton component to JobStatusPanel. Button follows SyncNowButton pattern: loading spinner, aria-label, success/error messages, router.refresh(). 212/212 tests pass, build succeeds. |
| 2026-02-28 | Phase 6 completed: Code review by tsh-code-reviewer found 0 critical/high, 2 medium, 4 low issues. Fixed M1 (partial failure visibility): JobCard now shows yellow warning when status=success with errorMessage, CollectNowButton shows errored users count. Fixed M2 (UTC dates): switched all date helpers in usage-collection.ts to UTC, updated all test date seeding to UTC. Low-severity items (L1-L6) documented as intentional/low-priority. 212/212 tests pass, build succeeds. |
