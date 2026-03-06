# Story 4.2: Usage data is stored uniquely per user, day, month, and year — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 4.2 |
| Title | Usage data is stored uniquely per user, day, month, and year |
| Description | Ensure data integrity and prevent duplicate records in the usage database. The database must enforce uniqueness on the combination of user, day, month, and year. Existing records must be updated (upsert) rather than duplicated. All per-model breakdowns must be preserved and historical data must remain accessible. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/story-4-1.plan.md` |

## Proposed Solution

Story 4.2's requirements are already **fully implemented** as part of the Story 4.1 delivery. The unique constraint, upsert logic, JSONB model-level breakdown storage, and historical data retention are all in place and functioning. This plan adds **dedicated verification tests** that explicitly prove each acceptance criterion at both the database constraint level and the application logic level, ensuring the guarantees cannot be silently broken by future refactors.

### Rationale

Story 4.1's plan noted: *"Unique constraint on `(seatId, day, month, year)`: The database enforces that only one usage record exists per seat per calendar day. [...] This naturally supports Story 4.2's uniqueness requirements."* While Story 4.1 includes integration tests for the upsert flow (via `executeUsageCollection()`), Story 4.2 warrants dedicated tests that:

1. **Verify the DB constraint directly** — attempt a raw duplicate insert bypassing the application's upsert logic to prove the constraint rejects it.
2. **Verify multi-model preservation** — confirm that when the GitHub API returns multiple model breakdowns in `usageItems`, all are stored and retrievable correctly.
3. **Verify historical data accessibility** — confirm that records from multiple distinct dates coexist and can be queried independently.

These tests serve as a regression safety net: even if the `usage-collection.ts` upsert logic is changed, the DB constraint will still prevent duplicates.

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-usage.entity.ts` — `CopilotUsageEntity` with `UQ_copilot_usage_seat_day` unique constraint on `(seatId, day, month, year)`, `usageItems` as JSONB, FK to `copilot_seat`, indexes on `seatId` and `(year, month)`
- `migrations/1772277589638-CreateCopilotUsage.ts` — Migration creating the `copilot_usage` table with unique constraint `UQ_copilot_usage_seat_day`, FK, and indexes
- `src/lib/usage-collection.ts` — `executeUsageCollection()` with upsert logic (`.orUpdate(["usageItems", "updatedAt"], ["seatId", "day", "month", "year"])`)
- `src/lib/__tests__/usage-collection.test.ts` — Integration test "upserts data when a record already exists for the same seat + date" verifying no duplicate is created when running collection twice for the same date
- `src/lib/__tests__/usage-collection.test.ts` — Integration test "stores empty usageItems array when API returns no usage items" verifying JSONB handles edge case
- `src/lib/data-source.ts` — `CopilotUsageEntity` registered in application data source
- `src/lib/data-source.cli.ts` — `CopilotUsageEntity` registered in CLI data source
- `src/test/db-helpers.ts` — `CopilotUsageEntity` registered in test data source, `cleanDatabase()` handles FK order via `TRUNCATE TABLE copilot_usage, copilot_seat`

### To Be Modified
- `src/lib/__tests__/usage-collection.test.ts` — Add a new `describe("Story 4.2: Data uniqueness and integrity")` block with targeted verification tests

### To Be Created
_No new source files required — all production code is implemented._

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Is all production code for Story 4.2 already implemented? | Yes. The entity, migration, unique constraint, upsert logic, JSONB storage, and historical retention are all delivered as part of Story 4.1. | ✅ Resolved |
| 2 | What additional work is needed for Story 4.2? | Dedicated verification tests proving each acceptance criterion at the database and application level. | ✅ Resolved |

## Implementation Plan

### Phase 1: Dedicated Verification Tests

#### Task 1.1 - [MODIFY] Add Story 4.2 verification tests to `src/lib/__tests__/usage-collection.test.ts`
**Description**: Add a new `describe("Story 4.2: Data uniqueness and integrity")` block within the existing test file. These tests directly verify the four acceptance criteria at the database level, independent of the `executeUsageCollection()` flow.

**Definition of Done**:
- [x] New `describe("Story 4.2: Data uniqueness and integrity")` block added to `src/lib/__tests__/usage-collection.test.ts`
- [x] Test: **DB constraint rejects duplicate insert** — directly inserts a `copilot_usage` record via `usageRepository.save()`, then attempts to insert a second record with the same `(seatId, day, month, year)` via raw `INSERT INTO` (not upsert). Asserts the query throws a unique constraint violation error mentioning `UQ_copilot_usage_seat_day`.
- [x] Test: **Upsert updates existing record instead of duplicating** — inserts a record with initial `usageItems`, then runs the upsert query (same `orUpdate` pattern as `usage-collection.ts`) with different `usageItems`. Asserts only one record exists for that `(seatId, day, month, year)` combination and the `usageItems` reflect the updated values.
- [x] Test: **Multiple model breakdowns are preserved** — inserts a record with `usageItems` containing multiple model entries (e.g., "Claude Haiku 4.5" and "Claude Sonnet 4.5" with different quantities/amounts). Retrieves the record and asserts all model breakdown entries are present and correct, including all numeric fields (`pricePerUnit`, `grossQuantity`, `grossAmount`, `discountQuantity`, `discountAmount`, `netQuantity`, `netAmount`).
- [x] Test: **Historical data is retained across multiple dates** — inserts usage records for the same seat across three different dates (e.g., day 1, day 15, day 28 of the same month). Queries by `seatId` and asserts all three records are returned. Queries by `(year, month)` and asserts the correct records are returned. Queries by individual `(seatId, day, month, year)` and asserts each returns exactly the expected record.
- [x] Test: **Different seats can have usage for the same date** — inserts usage records for two different seats on the same `(day, month, year)`. Asserts both records exist (no false-positive uniqueness across seats).
- [x] All new tests pass
- [x] All existing tests continue to pass

### Phase 2: Code Review

#### Task 2.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure test quality, completeness against acceptance criteria, and adherence to project testing patterns.

**Definition of Done**:
- [x] All new test code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] Tests adequately cover all four acceptance criteria
- [x] Tests follow project conventions (Vitest, TypeORM, test helpers)
- [x] Tests verify database-level guarantees, not just application-level logic

## Security Considerations

- **No new security surface**: This story adds only verification tests — no new endpoints, database changes, or API interactions. All security considerations from Story 4.1 apply unchanged.
- **Test data isolation**: Tests use `cleanDatabase()` between runs and operate on the test database only.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Database enforces uniqueness on user + day + month + year (verified by direct duplicate insert test that asserts constraint violation)
- [x] Existing data is updated (upsert), not duplicated (verified by upsert test that asserts single record with updated values)
- [x] All per-model breakdowns are preserved (verified by multi-model test with full field assertions)
- [x] Historical data is retained and accessible (verified by multi-date query test)

## Improvements (Out of Scope)

- **Usage data read API**: Currently there is no dedicated `GET /api/usage` endpoint for querying usage data. Future dashboard stories (Epic 5) will introduce read endpoints. Historical data accessibility is verified at the database level for now.
- **Data retention policy**: No expiration or archival mechanism exists. For long-running deployments with many seats, a retention/archival strategy may be needed to manage table growth.
- **Constraint violation error handling in collection**: The `usage-collection.ts` uses `orUpdate` to avoid constraint violations. If a future code change accidentally removes the `orUpdate`, the constraint will cause failures rather than silent duplicates — a desirable fail-safe. Consider adding explicit constraint violation handling that logs a warning and retries with an update.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Phase 1 completed: Added 5 verification tests in `describe("Story 4.2: Data uniqueness and integrity")` block. Tests cover: DB constraint rejection of raw duplicate INSERT, upsert via orUpdate pattern, multi-model JSONB preservation with full field assertions, historical data retention with multi-query verification, cross-seat same-date coexistence. 217/217 tests pass. |
| 2026-02-28 | Phase 2 completed: Code review by tsh-code-reviewer — PASS. 0 critical, 0 high, 0 medium, 1 low finding. L1 (asymmetric Sonnet assertions): fixed by adding 3 missing field assertions (sku, unitType, pricePerUnit) for consistency. 217/217 tests pass. |
