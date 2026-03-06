# GitHub API Rate Limit Logging - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Log GitHub API rate limit headers (`x-ratelimit-remaining`, `x-ratelimit-reset`) |
| Description | Extract and log GitHub API rate limit information from response headers on every API call so operators can monitor remaining quota and reset times. Log a warning when the remaining quota drops below a configurable threshold. |
| Priority | Medium |
| Related Research | N/A |

## Proposed Solution

Add a centralised rate-limit header extraction and logging utility inside `src/lib/github-api.ts`. After every GitHub API response (both success and error paths), the utility reads `x-ratelimit-remaining` and `x-ratelimit-reset` from the response headers and emits a structured `console.log`. When `x-ratelimit-remaining` drops below a low-water-mark threshold (default: 100), it emits a `console.warn` to give operators early visibility before hitting a 403.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  src/lib/github-api.ts                                                   │
│                                                                          │
│  fetchAllCopilotSeats()                                                  │
│    └─ fetch() → Response                                                 │
│         └─ logRateLimitInfo(response, url)                               │
│              ├─ console.log  (remaining, reset timestamp, endpoint)       │
│              └─ console.warn (if remaining < RATE_LIMIT_WARNING_THRESHOLD)│
│                                                                          │
│  fetchPremiumRequestUsage()                                              │
│    └─ fetch() → Response                                                 │
│         └─ logRateLimitInfo(response, url)                               │
│              ├─ console.log  (remaining, reset timestamp, endpoint)       │
│              └─ console.warn (if remaining < RATE_LIMIT_WARNING_THRESHOLD)│
└──────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

1. **Centralised in `github-api.ts`** — the only file that calls `fetch` against GitHub. No changes needed in callers (`seat-sync.ts`, `usage-collection.ts`, `month-recollection.ts`).
2. **Log on every response** (not just errors) — rate limit info is most useful as a continuous signal, not just at failure time.
3. **Log on error responses too** — when a `GitHubApiError` is thrown, rate limit info is logged *before* the throw so the context is available.
4. **Human-readable reset time** — convert the Unix timestamp from `x-ratelimit-reset` to an ISO 8601 string for readability.
5. **Warning threshold** — configurable via a constant (`RATE_LIMIT_WARNING_THRESHOLD = 100`). This gives advance notice without being noisy on healthy systems.
6. **No behaviour changes** — purely additive logging. No retry logic, no pausing, no new error types.

## Current Implementation Analysis

### Already Implemented
- `fetchAllCopilotSeats()` — [src/lib/github-api.ts](src/lib/github-api.ts) — paginated GitHub API client for Copilot seats; uses `fetch()` and has access to `Response` objects
- `fetchPremiumRequestUsage()` — [src/lib/github-api.ts](src/lib/github-api.ts) — per-user usage API client; uses `fetch()` and has access to `Response` objects
- `GitHubApiError` class — [src/lib/github-api.ts](src/lib/github-api.ts) — custom error with `statusCode` and `responseBody`
- Existing test suite — [src/lib/__tests__/github-api.test.ts](src/lib/__tests__/github-api.test.ts) — comprehensive tests for both functions using mocked `fetch`
- Console-based logging pattern — project uses `console.log`, `console.warn`, `console.error` throughout `src/lib/` (no structured logging library)

### To Be Modified
- `fetchAllCopilotSeats()` — [src/lib/github-api.ts](src/lib/github-api.ts) — add `logRateLimitInfo()` call after each `fetch` response (inside the pagination loop), both on success and before throwing `GitHubApiError`
- `fetchPremiumRequestUsage()` — [src/lib/github-api.ts](src/lib/github-api.ts) — add `logRateLimitInfo()` call after the `fetch` response, both on success and before throwing `GitHubApiError`
- Test file — [src/lib/__tests__/github-api.test.ts](src/lib/__tests__/github-api.test.ts) — add tests verifying rate limit header logging, warning threshold behaviour, and graceful handling of missing headers

### To Be Created
- `logRateLimitInfo()` helper function — inside `src/lib/github-api.ts` (not exported; internal utility)
- `RATE_LIMIT_WARNING_THRESHOLD` constant — inside `src/lib/github-api.ts`

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should rate limit info also be logged on error (non-ok) responses? | Yes — log before throwing `GitHubApiError`. Rate limit info on 403/429 responses is especially valuable for debugging. | ✅ Resolved |
| 2 | Should `x-ratelimit-limit` and `x-ratelimit-used` also be logged? | Only `x-ratelimit-remaining` and `x-ratelimit-reset` as requested. Adding more headers later is trivial. | ✅ Resolved |
| 3 | What warning threshold for remaining requests? | 100 — provides early warning without excessive noise for the typical 5,000 requests/hour GitHub limit. | ✅ Resolved |
| 4 | Should missing rate limit headers cause an error? | No — log gracefully with a "rate limit headers not present" info message. Some GitHub endpoints or cached responses may omit them. | ✅ Resolved |

## Implementation Plan

### Phase 1: Rate Limit Logging Utility

#### Task 1.1 - [CREATE] `logRateLimitInfo()` helper and `RATE_LIMIT_WARNING_THRESHOLD` constant in `src/lib/github-api.ts`
**Description**: Add a non-exported helper function `logRateLimitInfo(response: Response, url: string)` that extracts `x-ratelimit-remaining` and `x-ratelimit-reset` from response headers. It logs a structured info message with remaining quota, reset time (ISO 8601), and the request URL. If `x-ratelimit-remaining` is below `RATE_LIMIT_WARNING_THRESHOLD` (100), emit a `console.warn`. If headers are absent, log a debug-level note and return without error. Add a `RATE_LIMIT_WARNING_THRESHOLD` constant set to `100`.

**Definition of Done**:
- [x] `RATE_LIMIT_WARNING_THRESHOLD` constant exists in `src/lib/github-api.ts` with value `100`
- [x] `logRateLimitInfo(response, url)` function exists in `src/lib/github-api.ts` (not exported)
- [x] Function reads `x-ratelimit-remaining` and `x-ratelimit-reset` from `response.headers`
- [x] Function emits `console.log` with remaining count, reset time as ISO 8601 string, and a shortened URL/endpoint identifier
- [x] Function emits `console.warn` when remaining is below threshold, including remaining count and reset time
- [x] Function handles missing headers gracefully (no error, no log — silent return)
- [x] Function handles non-numeric header values gracefully (no error)

#### Task 1.2 - [MODIFY] `fetchAllCopilotSeats()` to call `logRateLimitInfo()`
**Description**: Inside the pagination `while` loop, call `logRateLimitInfo(response, url)` after receiving the response — both on the success path (after `response.ok` check passes) and on the error path (before throwing `GitHubApiError`).

**Definition of Done**:
- [x] `logRateLimitInfo()` is called on every successful page response inside the pagination loop
- [x] `logRateLimitInfo()` is called before throwing `GitHubApiError` on non-ok responses
- [x] Existing behaviour is unchanged — function still returns `GitHubSeatAssignment[]` and throws `GitHubApiError` as before
- [x] All existing tests in `github-api.test.ts` still pass

#### Task 1.3 - [MODIFY] `fetchPremiumRequestUsage()` to call `logRateLimitInfo()`
**Description**: Call `logRateLimitInfo(response, url)` after receiving the response — both on the success path and on the error path (before throwing `GitHubApiError`).

**Definition of Done**:
- [x] `logRateLimitInfo()` is called on the successful response path
- [x] `logRateLimitInfo()` is called before throwing `GitHubApiError` on non-ok responses
- [x] Existing behaviour is unchanged — function still returns `GitHubUsageResponse` and throws `GitHubApiError` as before
- [x] All existing tests in `github-api.test.ts` still pass

### Phase 2: Tests

#### Task 2.1 - [MODIFY] Add rate limit logging tests in `src/lib/__tests__/github-api.test.ts`
**Description**: Add test cases covering rate limit header logging for both `fetchAllCopilotSeats` and `fetchPremiumRequestUsage`. Verify `console.log` is called with rate limit info, `console.warn` is called when remaining is below threshold, and missing headers are handled gracefully.

**Definition of Done**:
- [x] Test: `fetchAllCopilotSeats` logs rate limit info from response headers on success
- [x] Test: `fetchAllCopilotSeats` logs rate limit info on each page of a multi-page response
- [x] Test: `fetchAllCopilotSeats` logs rate limit info before throwing on error response
- [x] Test: `fetchPremiumRequestUsage` logs rate limit info from response headers on success
- [x] Test: `fetchPremiumRequestUsage` logs rate limit info before throwing on error response
- [x] Test: `console.warn` is emitted when `x-ratelimit-remaining` is below warning threshold
- [x] Test: no error or warning when rate limit headers are absent from response
- [x] All existing tests still pass
- [x] `vitest run` passes with no failures

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent to review all changes for code quality, consistency with existing patterns, and correctness.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed

## Security Considerations

- **No sensitive data in logs**: Rate limit headers (`x-ratelimit-remaining`, `x-ratelimit-reset`) are non-sensitive metadata. The URL logged in the message should not include the `Authorization` header or token.
- **No new environment variables or secrets**: The change is purely additive logging using existing response headers.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Every GitHub API call (seats pagination, usage fetch) logs `x-ratelimit-remaining` and `x-ratelimit-reset` values
- [x] Rate limit reset time is logged as a human-readable ISO 8601 timestamp
- [x] A warning is logged when remaining requests drop below 100
- [x] Missing rate limit headers do not cause errors or warnings
- [x] All existing unit tests continue to pass
- [x] New unit tests cover success path logging, error path logging, multi-page logging, warning threshold, and missing headers
- [x] `vitest run` passes with no failures
- [x] No changes to function signatures or return types — existing callers are unaffected

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Proactive rate limit throttling**: Automatically pause/slow down API calls when `x-ratelimit-remaining` approaches zero, resuming after `x-ratelimit-reset`. Would prevent 403 errors during large seat syncs or month recollections.
- **Log `x-ratelimit-limit` and `x-ratelimit-used`**: Include total quota and used count for a more complete picture.
- **Structured logging library**: Replace `console.*` calls with a structured logger (e.g., `pino` or `winston`) for machine-parseable log output with configurable levels.
- **Rate limit metrics dashboard**: Surface rate limit health in the application UI alongside job status.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed — Phases 1 & 2 done, all 294 tests pass |
| 2026-02-28 | Code review by tsh-code-reviewer: APPROVED with minor findings. Addressed W3 (added non-numeric header test) and S1 (display "unknown" instead of NaN for non-numeric remaining). S2 and S3 deferred as low-priority cosmetic items. |
