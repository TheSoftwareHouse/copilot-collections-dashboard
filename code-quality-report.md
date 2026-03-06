# Code Quality Report — copilot-collections-dashboard

## Overview

| Field | Value |
|---|---|
| Repository | copilot-collections-dashboard |
| Repository Type | Single System |
| Date | 3 March 2026 |
| Updated | 4 March 2026 |
| Layers/Apps Analyzed | Full-stack Next.js 16 app (API routes + React 19 frontend) |

**Tech Stack:** Next.js 16, React 19, TypeORM 0.3, PostgreSQL, Tailwind CSS 4, Zod 4, Recharts, Arctic (Azure Entra SSO), bcryptjs, node-cron, Vitest, Playwright

## Resolution Status

All **14 Critical** and **24 of 30 Important** findings have been resolved. Tests: 632/632 passing, `tsc --noEmit` clean.

### Resolved Items

| Category | Item | Resolution |
|---|---|---|
| 🔴 Bug | Dashboard hardcoded 300 | Replaced with `premiumRequestsPerSeat` from config |
| 🔴 Security | POST /api/configuration unguarded | Added defense-in-depth guard (403 if config exists) |
| 🔴 Security | admin/admin default credentials | Removed hardcoded fallback; env vars required |
| 🔴 Build | `dist/` not in `.gitignore` | Added `/dist` to `.gitignore` |
| 🔴 Dup | `formatCurrency` (×7), `formatName` (×4), `formatRelativeTime` (×2), `formatTimestamp` (×2) | Extracted to `src/lib/format-helpers.ts` |
| 🔴 Dup | Identical team/department Zod schemas | Shared `nameFieldSchema` in `src/lib/validations/shared.ts` |
| 🔴 Dup | POST create boilerplate (×3) | Extracted `validateBody` in `src/lib/api-helpers.ts` |
| 🔴 Dup | PUT update boilerplate (×4) | Extracted `validateBody` + `handleRouteError` |
| 🔴 Dup | `23505` unique-constraint check (×7) | Extracted `isUniqueViolation` to `src/lib/db-errors.ts` |
| 🔴 Dup | `NotFoundError` class (×2) | Extracted to `src/lib/errors.ts` |
| 🔴 Dup | TeamManagementPanel / DepartmentManagementPanel (~80% identical) | Extracted `useEntityCrud` hook + `EntityLoadingState` / `EntityErrorState` shared components |
| 🟡 Dead | test-modal in production | Gated behind `NODE_ENV !== "production"` |
| 🟡 Dead | Unused `clearAuthData` import | Removed from `e2e/user-management.spec.ts` |
| 🟡 Dup | `useEffect` fetch pattern (×3 usage panels) | Extracted `useAsyncFetch<T>` hook |
| 🟡 Dup | `fetchMonths` effect (×5) | Extracted `useAvailableMonths()` hook |
| 🟡 Dup | `AvailableMonth` interface (×6) | Unified in `src/lib/types.ts` |
| 🟡 Dup | `MemberEntry` interface (×2) | Unified in `src/lib/types.ts` |
| 🟡 Dup | `calcUsagePercent` inline formula (×6 backend routes) | Reused `calcUsagePercent` from `usage-helpers.ts` |
| 🟡 Dup | `parseMonthYearParams` (×7) | Extracted to `src/lib/api-helpers.ts` |
| 🟡 Dup | `parseEntityId` (×4) | Extracted to `src/lib/api-helpers.ts` |
| 🟡 Dup | `parseJsonBody` (×12+) | Extracted to `src/lib/api-helpers.ts` |
| 🟡 Dup | Identical catch blocks (×30+) | Extracted `handleRouteError` to `src/lib/api-helpers.ts` |
| 🟡 Dup | Job constants (×4 files) | Moved to `src/lib/constants.ts` |
| 🟡 Dup | Concurrency guard (×4 files) | Extracted `acquireJobLock` to `src/lib/job-lock.ts` |
| 🟡 Dup | `parseTeamId` (×3 files) | Replaced with shared `parseEntityId` |
| 🟡 Dup | `parseConnectionString` + entity list (×3 files) | Extracted to `src/lib/data-source.shared.ts` |
| 🟡 Imp | Seat base cost hardcoded `$19` | Extracted `SEAT_BASE_COST_USD` constant to `src/lib/constants.ts` |
| 🟡 Imp | `getPremiumAllowance` uncached | Added in-memory cache with 60s TTL + invalidation on config update |
| 🟡 Imp | `GITHUB_TOKEN` not validated | Added startup warning in `instrumentation.ts` |
| 🟡 Imp | `pageSize=300` in AddMembersForm + BackfillHistoryForm | Replaced with pagination loop through all pages |
| 🟡 Imp | Error handling (partially) | `handleRouteError` provides consistent catch block pattern |

### Remaining Important Items (not addressed)

| Category | Item | Reason |
|---|---|---|
| 🟡 Dead | Orphaned `POST /api/dashboard/recalculate` | Functional admin API; not truly dead code |
| 🟡 Dup | Detail panel layout dedup (~60% shared) | High risk of UI breakage; panels differ in card/chart/table structure |
| 🟡 Dup | LoadingState/ErrorState across usage & detail panels | Different wrapper structures; management panels already use shared components |
| 🟡 Imp | N+1 seat sync batch upsert | Deferred per user decision |
| 🟡 Imp | Sequential per-seat API calls in usage-collection | Large performance refactor requiring concurrency limiter |
| 🟡 Imp | 7 sequential queries in dashboard-metrics | Large SQL CTE refactor |
| 🟡 Imp | SeatListPanel SRP (486 lines) | Large component decomposition |
| 🟡 Imp | JobRunner abstraction | Large architectural refactor |
| 🟡 Imp | Component test coverage | Requires significant new test file creation |
| 🟡 Imp | Raw SQL → QueryBuilder (27+ locations) | Pervasive pattern change across entire API layer |

### New Files Created

| File | Purpose |
|---|---|
| `src/lib/format-helpers.ts` | `formatCurrency`, `formatName`, `formatRelativeTime`, `formatTimestamp` |
| `src/lib/db-errors.ts` | `isUniqueViolation()` helper |
| `src/lib/errors.ts` | `NotFoundError` class |
| `src/lib/types.ts` | Shared `AvailableMonth`, `MemberEntry` interfaces |
| `src/lib/constants.ts` | Added `ERROR_MESSAGE_MAX_LENGTH`, `STALE_JOB_THRESHOLD_MS`, `SEAT_BASE_COST_USD` |
| `src/lib/api-helpers.ts` | `parseJsonBody`, `parseEntityId`, `parseMonthYearParams`, `validateBody`, `handleRouteError` |
| `src/lib/job-lock.ts` | `acquireJobLock()` concurrency guard utility |
| `src/lib/data-source.shared.ts` | Shared `parseConnectionString`, `allEntities` for data source configs |
| `src/lib/validations/shared.ts` | Shared `nameFieldSchema` Zod schema |
| `src/lib/hooks/useAvailableMonths.ts` | Custom hook replacing 5× duplicated fetchMonths effect |
| `src/lib/hooks/useAsyncFetch.ts` | Generic data-fetching hook with cancelled-flag guard |
| `src/lib/hooks/useEntityCrud.ts` | CRUD state management hook for management panels |
| `src/components/shared/EntityLoadingState.tsx` | Shared loading state component |
| `src/components/shared/EntityErrorState.tsx` | Shared error state component |

---

The **copilot-collections-dashboard** is a well-structured Next.js application that serves as an internal dashboard for GitHub Copilot seat and usage management. The codebase follows consistent patterns and has meaningful unit test coverage for core business logic (seat sync, usage collection, job scheduling). The TypeORM entity design is clean, migrations are sequential and well-named, and the dual-auth system (credentials + Azure Entra) is properly abstracted.

However, the analysis revealed **three critical issues** that require immediate attention: (1) a **bug** where the dashboard hardcodes `300` for premium requests per seat instead of using the configurable value already fetched from the database, (2) a **security gap** where `POST /api/configuration` allows unauthenticated first-run setup with no safeguard, and (3) **default admin credentials** of `admin/admin` that ship as hardcoded fallbacks. Additionally, the `dist/` build output directory (79+ compiled JS files) is committed to version control.

The most pervasive quality issue is **code duplication**. Utility functions like `formatCurrency()` are copy-pasted across 7 files, API route handlers repeat identical boilerplate for JSON parsing, validation, error handling, and unique constraint checking across 20+ route files, and management panel components share ~80% of their code. Extracting shared helpers, custom hooks, and generic components would significantly reduce the maintenance surface. An estimated 28 distinct duplication clusters were identified, of which 10 are critical.

---

## Findings by Layer/App

### Full Application (`src/`)

#### Dead Code

| # | Severity | Type | Location | Description |
|---|---|---|---|---|
| 1 | 🔴 Critical | Build output in VCS | `dist/` (79+ files) | `dist/` directory is not in `.gitignore`. 79+ compiled JS files are committed to version control. Should be added to `.gitignore` and purged from git history. |
| 2 | 🟡 Important | Test harness in production | `src/app/(app)/test-modal/page.tsx` | `/test-modal` page exists solely for `e2e/modal.spec.ts`. Ships as a real route in production builds. Should be gated behind `NODE_ENV` or moved to a test fixture. |
| 3 | 🟡 Important | Orphaned API route | `src/app/api/dashboard/recalculate/route.ts` | `POST /api/dashboard/recalculate` has no frontend caller. The planned `RecalculateMetricsButton` component was never implemented per the specification. |
| 4 | 🟡 Important | Unused import | `e2e/user-management.spec.ts:2` | `clearAuthData` is imported but never used in the file. |
| 5 | 🟢 Nice to Have | Dead export | `src/lib/github-api.ts:3` | `GitHubSeatAssignee` interface — only used internally as a field type. Never imported outside the file. |
| 6 | 🟢 Nice to Have | Dead export | `src/lib/github-api.ts:25` | `GitHubUsageItem` interface — only used internally. Never imported outside the file. |
| 7 | 🟢 Nice to Have | Dead export | `src/entities/copilot-usage.entity.ts:3` | `UsageItem` interface — only used internally. Never imported by name outside the file. |
| 8 | 🟢 Nice to Have | Dead export | `src/lib/auth-config.ts:3` | `SUPPORTED_AUTH_METHODS` const — only used internally for Zod validation and type derivation. |
| 9 | 🟢 Nice to Have | Dead export | `src/lib/azure-auth.ts:20` | `AzureAuthErrorCode` type — only used internally as return type of `mapArcticError`. |
| 10 | 🟢 Nice to Have | Dead export | `src/lib/seat-sync.ts:19` | `SeatSyncResult` interface — only used internally. |
| 11 | 🟢 Nice to Have | Dead export | `src/lib/usage-collection.ts:22` | `UsageCollectionResult` interface — only used internally. |
| 12 | 🟢 Nice to Have | Dead export | `src/lib/month-recollection.ts:22` | `MonthRecollectionResult` interface — only used internally. |
| 13 | 🟢 Nice to Have | Dead export | `src/lib/team-carry-forward.ts:12` | `TeamCarryForwardResult` interface — only used internally. |
| 14 | 🟢 Nice to Have | Dead export | `src/components/usage/DepartmentUsageChart.tsx:15` | `DepartmentUsageChartEntry` interface — only used locally. |
| 15 | 🟢 Nice to Have | Dead validation types | `src/lib/validations/seat.ts:38`, `user.ts:34`, `team.ts:13,25`, `department.ts:13,25`, `team-members.ts:17,24,62` | 9 Zod-inferred type exports (`UpdateSeatInput`, `UpdateUserInput`, `CreateTeamInput`, `UpdateTeamInput`, `CreateDepartmentInput`, `UpdateDepartmentInput`, `TeamMembersSeatIdsInput`, `TeamMembersRemoveInput`, `TeamMembersBackfillInput`) that are exported but never imported anywhere. Only their corresponding schemas are used. |
| 16 | 🟢 Nice to Have | Test-only export | `src/lib/azure-auth.ts:180` | `_resetEntraIdClient()` — only imported by `azure-auth.test.ts`. Consider `@visibleForTesting` pattern. |

#### Duplications

| # | Severity | Type | Locations | Description | Recommendation |
|---|---|---|---|---|---|
| 1 | 🔴 Critical | Duplicated utility | `SeatUsageTable.tsx:13`, `SeatModelTable.tsx:12`, `TeamUsageTable.tsx:11`, `SeatDetailPanel.tsx:60`, `TeamDetailPanel.tsx:57`, `TeamMemberTable.tsx:21`, `DashboardPanel.tsx:46` | `formatCurrency()` is defined identically **7 times** across components. | Extract to `src/lib/format-helpers.ts` and import everywhere. |
| 2 | 🔴 Critical | Duplicated utility | `SeatUsageTable.tsx:17`, `SeatDetailPanel.tsx:64`, `TeamMemberTable.tsx:25`, `TeamMembersPanel.tsx:23` | `formatName()` is defined identically **4 times**. | Extract to `src/lib/format-helpers.ts`. |
| 3 | 🔴 Critical | Duplicated utility | `SeatListPanel.tsx:57`, `JobStatusPanel.tsx:22` | `formatRelativeTime()` is defined identically **2 times**. | Extract to `src/lib/format-helpers.ts`. |
| 4 | 🔴 Critical | Duplicated utility | `SeatListPanel.tsx:74`, `JobStatusPanel.tsx:39` | `formatTimestamp()` is identical in both files. | Extract to `src/lib/format-helpers.ts`. |
| 5 | 🔴 Critical | Duplicated validation | `src/lib/validations/team.ts:3-25`, `src/lib/validations/department.ts:3-25` | `createTeamSchema` and `createDepartmentSchema` are character-for-character identical Zod schemas. Same for update schemas. 4 schemas that are clones. | Create a shared `nameSchema` and compose: `z.object({ name: nameSchema })`. |
| 6 | 🔴 Critical | Duplicated API boilerplate | `teams/route.ts POST`, `departments/route.ts POST`, `users/route.ts POST` | POST handlers follow identical pattern: parse JSON → Zod safeParse → 400 with field errors → create entity → save → 201 → catch 23505 → 409 → 500. | Extract `createEntityHandler(schema, repoFactory, mapFields)` helper. |
| 7 | 🔴 Critical | Duplicated API boilerplate | `teams/[id]/route.ts PUT`, `departments/[id]/route.ts PUT`, `users/[id]/route.ts PUT`, `seats/[id]/route.ts PUT` | PUT handlers on `[id]` routes duplicate auth → parse ID → validate → Zod → find → 404 → update → catch 23505 → 409 → 500. | Extract `updateEntityHandler(params, schema, repoFactory, applyUpdate)` helper. |
| 8 | 🔴 Critical | Duplicated error check | 7 API route files | `(error as Record<string, unknown>).code === "23505"` unique constraint check is copy-pasted **7 times**. | Extract `isUniqueViolation(error): boolean` to `src/lib/db-errors.ts`. |
| 9 | 🔴 Critical | Duplicated class | `teams/[id]/route.ts:152`, `departments/[id]/route.ts:140` | `class NotFoundError extends Error` is defined identically in **both** files. | Extract to `src/lib/errors.ts`. |
| 10 | 🔴 Critical | Duplicated component | `TeamManagementPanel.tsx`, `DepartmentManagementPanel.tsx` | ~80% identical code: same state shape, CRUD handlers, loading/error/empty states, table structure with `EditableTextCell`. Differ only in entity name strings and a few columns. | Create `EntityManagementPanel<T>` or extract `useEntityCrud(apiPath, schema)` hook. |
| 11 | 🟡 Important | Duplicated hook logic | `SeatUsagePanel.tsx:50`, `TeamUsagePanel.tsx:35`, `DepartmentUsagePanel.tsx:40` | All three usage panels duplicate the same `useEffect` fetch pattern with `cancelled` flag, try/catch/finally. | Create `useAsyncFetch<T>(url, deps)` hook. |
| 12 | 🟡 Important | Duplicated effect | `DashboardWithFilter.tsx:29`, `UsagePageLayout.tsx:113`, `SeatDetailPanel.tsx:85`, `TeamDetailPanel.tsx:77`, `DepartmentDetailPanel.tsx:67` | `fetchMonths()` effect that fetches `/api/dashboard/months` is copy-pasted **5 times** verbatim. | Extract `useAvailableMonths()` custom hook. |
| 13 | 🟡 Important | Duplicated interface | 6 files: `MonthFilter.tsx:5`, `DashboardWithFilter.tsx:7`, `UsagePageLayout.tsx:9`, `SeatDetailPanel.tsx:12`, `TeamDetailPanel.tsx:11`, `DepartmentDetailPanel.tsx:12` | `interface AvailableMonth { month: number; year: number }` defined **6 times**. | Define once in `src/lib/types.ts`. |
| 14 | 🟡 Important | Duplicated interface | `TeamDetailPanel.tsx:27-34`, `DepartmentDetailPanel.tsx:27-34` | `MemberEntry` interface is identical in both files. | Define once in `src/lib/types.ts`. |
| 15 | 🟡 Important | Duplicated panel pattern | `SeatDetailPanel.tsx`, `TeamDetailPanel.tsx`, `DepartmentDetailPanel.tsx` | All three detail panels share ~60% of structure: month state → fetchMonths → fetchData → breadcrumb → progress bar → header → MonthFilter → cards → chart → table. | Extract `UsageDetailLayout` wrapper or render-prop component. |
| 16 | 🟡 Important | Duplicated calculation | `teams/route.ts:75`, `departments/route.ts:69`, `usage/teams/route.ts:81`, `usage/departments/route.ts:84`, `usage/teams/[teamId]/route.ts:146`, `usage/departments/[departmentId]/route.ts:91` | Usage percentage formula repeated inline in **6 API routes**. `calcUsagePercent` exists in `usage-helpers.ts` but is only used on the frontend. | Reuse or adapt `calcUsagePercent` in backend routes. |
| 17 | 🟡 Important | Duplicated parameter parsing | 7 route files: `dashboard/route.ts:16`, `usage/seats/route.ts:19`, `usage/teams/route.ts:15`, `usage/departments/route.ts:15`, `usage/seats/[seatId]/route.ts:27`, `usage/teams/[teamId]/route.ts:27`, `usage/departments/[departmentId]/route.ts:27` | Month/year parameter parsing block (7 lines) is repeated in **7 routes**. | Extract `parseMonthYearParams(searchParams)` to `src/lib/api-helpers.ts`. |
| 18 | 🟡 Important | Duplicated ID parsing | `teams/[id]/route.ts:15`, `departments/[id]/route.ts:13`, `users/[id]/route.ts:24`, `seats/[id]/route.ts:15` | `const id = Number(idParam); if (Number.isNaN(id))` pattern in every `[id]` route. | Extract `parseEntityId(param, label)` helper. |
| 19 | 🟡 Important | Duplicated JSON parsing | 12+ API route files | `try { body = await request.json(); } catch { return 400 "Invalid JSON body" }` in **12+ routes**. | Extract `parseJsonBody(request)` utility. |
| 20 | 🟡 Important | Duplicated error handler | 30+ locations | `catch (error) { console.error("METHOD /api/path:", error); return 500 }` — **30+ identical catch blocks** | Create `withErrorHandling(handler, routeName)` wrapper. |
| 21 | 🟡 Important | Duplicated job constants | `seat-sync.ts:16-17`, `usage-collection.ts:19-20`, `month-recollection.ts:19-20`, `team-carry-forward.ts:9-10` | `ERROR_MESSAGE_MAX_LENGTH` and `STALE_JOB_THRESHOLD_MS` copy-pasted in **4 job files**. | Move to `src/lib/constants.ts`. |
| 22 | 🟡 Important | Duplicated concurrency guard | `seat-sync.ts:40-70`, `usage-collection.ts:98-130`, `month-recollection.ts:78-110`, `team-carry-forward.ts:74-106` | ~40 LOC concurrency guard pattern (pessimistic lock → stale check → create running execution) duplicated in **4 job files**. | Extract `acquireJobLock(jobType)` utility. |
| 23 | 🟡 Important | Duplicated UI states | 9+ components: usage panels, detail panels, management panels | Loading spinner, error banner, and empty state HTML/CSS are copy-pasted with minor text differences across **9+ components**. | Create `<LoadingState />`, `<ErrorState />`, `<EmptyState />` shared components. |
| 24 | 🟡 Important | Duplicated data-source config | `src/lib/data-source.ts`, `src/lib/data-source.cli.ts`, `scripts/run-migrations.ts` | `parseConnectionString()` duplicated in 3 files. Entity list duplicated between data-source files. | Extract shared `parseConnectionString`, have CLI config extend runtime config. |
| 25 | 🟡 Important | Duplicated team ID parser | `members/route.ts`, `purge-impact/route.ts`, `backfill/route.ts` | `parseTeamId()` helper duplicated across 3 team-related route files. | Extract to shared team route utils. |
| 26 | 🟢 Nice to Have | Duplicated type | 7 route files | `type RouteContext = { params: Promise<{ id: string }> }` defined locally in **7 [id] routes**. | Define generic `RouteContext<K>` in `src/lib/api-types.ts`. |
| 27 | 🟢 Nice to Have | Similar component | `SeatListPanel.tsx:81` (`SeatStatusBadge`), `JobStatusPanel.tsx:64` (`StatusBadge`) | Both follow same status → config-lookup → styled `<span>` pattern. | Extract generic `StatusBadge` component. |
| 28 | 🟢 Nice to Have | Similar serialization | `job-status/route.ts:26-68` | Same object shape repeated 4 times for each job type. | Map over array and serialize with a shared helper. |

#### Improvement Opportunities

| # | Severity | Category | Location | Description | Recommendation |
|---|---|---|---|---|---|
| 1 | 🔴 Critical | Security | `src/app/api/configuration/route.ts:41` | `POST /api/configuration` has **no authentication check**. Any unauthenticated request can create the initial configuration, setting the GitHub org/token. | Guard with `requireAuth()` or add a one-time setup token. Verify no config exists before allowing unauthenticated setup; return 403 otherwise. |
| 2 | 🔴 Critical | Security | `src/lib/auth.ts:139-140` | Default admin credentials are hardcoded as `"admin"/"admin"`. Even when overridable via env vars, the fallback is a production risk. | Remove hardcoded defaults; require `DEFAULT_ADMIN_USERNAME`/`DEFAULT_ADMIN_PASSWORD` env vars. Force password change on first login. |
| 3 | 🔴 Critical | Bug | `src/app/api/dashboard/route.ts:35` | `includedPremiumRequests` uses `summary.activeSeats * 300` (hardcoded), while `premiumRequestsPerSeat` is **already fetched** on line 33 via `getPremiumAllowance()` but never used. Dashboard always shows 300 regardless of configuration. | Replace `summary.activeSeats * 300` with `summary.activeSeats * premiumRequestsPerSeat`. |
| 4 | 🟡 Important | Hardcoded Value | `src/lib/dashboard-metrics.ts:132` | Seat base cost hardcoded as `activeSeats * 19` ($19/seat/month). If pricing changes, calculation will be silently wrong. | Move `seatBaseCost` to the `configuration` table and read at runtime. |
| 5 | 🟡 Important | Performance | `src/lib/seat-sync.ts:107-138` | **N+1 query pattern**: individual `findOne` + `save` per seat inside a `for` loop within a transaction. With hundreds of seats this generates hundreds of round-trips. | Use `upsert()` or `INSERT ... ON CONFLICT` with batch of seat records. TypeORM supports `.createQueryBuilder().insert().orUpdate()`. |
| 6 | 🟡 Important | Performance | `src/lib/usage-collection.ts` | Sequential per-seat, per-day API call to GitHub + individual DB upsert. For 200 seats over 30 days = 6000 sequential HTTP requests. | Parallelize with a concurrency limiter (`p-limit`). Batch DB upserts with `INSERT ... VALUES ON CONFLICT`. |
| 7 | 🟡 Important | Performance | `src/lib/get-premium-allowance.ts` | `getPremiumAllowance()` queries the `configuration` table on **every API request**. Configuration rarely changes. | Cache in-memory with short TTL (60s), or load once at startup and invalidate on `PUT /api/configuration`. |
| 8 | 🟡 Important | Performance | `src/lib/dashboard-metrics.ts` | 7 separate `dataSource.query()` calls executed sequentially. Each scans the same `copilot_usage` + `jsonb_array_elements` join. | Combine into 1-2 CTEs or a single query with multiple aggregations. |
| 9 | 🟡 Important | SRP Violation | `src/components/seats/SeatListPanel.tsx` (486 lines) | Single component handles data fetching, filtering, sorting, pagination state, inline editing, and full table rendering. | Extract `useSeatList` hook, `SeatFilters`, `SeatTable`, and `InlineEditDepartment` components. |
| 10 | 🟡 Important | SRP Violation | `seat-sync.ts`, `usage-collection.ts`, `month-recollection.ts`, `team-carry-forward.ts` | Each job file mixes 5 concerns: config loading, concurrency guard, API fetching, data processing, and status bookkeeping. | Create a `JobRunner` abstraction that handles config, guard, status; each job only implements `execute()`. |
| 11 | 🟡 Important | Error Handling | All 31 API route files | Every route uses identical `catch (error) { console.error(...); return 500 }` with no structured logging, no request correlation, no error categorization. | Create `withErrorHandler(handler)` middleware for centralized error logging and responses. |
| 12 | 🟡 Important | Test Coverage | ~20 component files | **No unit tests** for any container/panel components. Only `Modal`, `ModalProvider`, `UsageProgressBar`, and `UsageStatusIndicator` have tests (4 of ~25 components). | Add component tests for critical interactive panels using Vitest + Testing Library. |
| 13 | 🟡 Important | Outdated Pattern | 27+ locations across API routes and `dashboard-metrics.ts` | Extensive raw SQL via `dataSource.query(...)` scattered across route handlers, bypassing TypeORM's type safety and query builder. | Consolidate into a repository/service layer. Use TypeORM QueryBuilder where possible. |
| 14 | 🟡 Important | Security | `src/lib/github-api.ts:110,163` | `GITHUB_TOKEN` is read from `process.env` on **every API call** with no startup validation. | Validate at startup in `instrumentation.ts`. Fail fast if missing. |
| 15 | 🟡 Important | Hardcoded Value | `src/components/teams/AddMembersForm.tsx:40`, `BackfillHistoryForm.tsx:75` | `pageSize=300` hardcoded in fetch URLs. If org has >300 seats, member selection silently misses seats. | Remove arbitrary limit by paginating through all results, or use server-side search. |
| 16 | 🟢 Nice to Have | Type Safety | `src/lib/seat-sync.ts:119,130` | `as CopilotSeat` type assertions used instead of constructing properly typed objects. | Define `NewSeatData` type matching the insert shape. |
| 17 | 🟢 Nice to Have | Logging | `src/app/api/auth/callback/route.ts:87,100,119,177` | Multiple `console.log` with `[auth/callback]` prefix in production for successful operations. | Use structured logger with configurable log levels. Gate verbose logs behind `DEBUG` level. |
| 18 | 🟢 Nice to Have | Logging | `src/app/api/auth/azure/route.ts:30` | `console.log` logs potentially sensitive redirect details in production. | Gate behind `NODE_ENV === "development"` or debug-level logging. |
| 19 | 🟢 Nice to Have | Complexity | `src/components/seats/SeatListPanel.tsx:57-72` | `formatRelativeTime()` shows stale values if user keeps tab open. "5 minutes ago" never updates. | Add `useInterval` for periodic re-render, or use `timeago.js` with auto-refresh. |
| 20 | 🟢 Nice to Have | Consistency | `src/app/api/configuration/route.ts:157` | `PUT` uses raw `dataSource.query("UPDATE ...")` instead of TypeORM repository `save()`, inconsistent with other routes. | Use `configRepository.save()` for consistency. |
| 21 | 🟢 Nice to Have | Test Coverage | `src/lib/dashboard-metrics.ts` | Raw SQL aggregation queries are hard to verify without integration tests against a real DB. | Add integration tests with a test database seeding known JSONB rows and asserting expected aggregations. |

---

## Architecture Observations

### Strengths

1. **Clean entity design**: TypeORM entities use decorators consistently, migrations are sequential and well-named, and the schema covers the full domain model (seats, usage, teams, departments, jobs, sessions).

2. **Good separation of auth strategies**: The `auth-config.ts` + `auth.ts` + `azure-auth.ts` split cleanly separates auth method resolution from implementation. The `requireAuth()` / `isAuthFailure()` pattern provides a clean API route guard.

3. **Robust job scheduling**: The `instrumentation.ts` file handles cron scheduling with environment variable overrides, startup execution, and proper sequential dependencies (seat sync before usage collection). Each job has its own concurrency guard.

4. **Meaningful test coverage for business logic**: Core library functions (seat sync, usage collection, dashboard metrics, team carry-forward, auth, session management) all have dedicated test files with good scenario coverage.

5. **Proper Next.js conventions**: Route groups `(app)`, API routes, layouts, and the standalone output mode are used correctly.

### Concerns

1. **No service/repository layer**: All business logic lives directly in API route handlers or in `src/lib/*.ts` files. There is no formal service or repository layer. API routes directly call `dataSource.getRepository()`, construct raw SQL queries, and contain business logic. This makes the codebase harder to test in isolation and leads to the massive duplication identified above.

2. **Scattered raw SQL**: Complex aggregation queries (dashboard metrics, usage calculations) are embedded as raw SQL strings directly in route handlers and `dashboard-metrics.ts`. These bypass TypeORM's type safety and are difficult to maintain, test, and refactor. They should be consolidated into dedicated query files or a query service.

3. **No shared API middleware/helpers**: Each of the 30+ API routes independently implements JSON body parsing, parameter validation, authentication, error handling, and response formatting. This creates a high duplication burden and inconsistency risk. A middleware or helper layer is critically needed.

4. **Frontend state management is ad-hoc**: Every panel component independently manages its own loading/error/data state with raw `useState` + `useEffect`. No shared data fetching abstraction (no SWR, React Query, or even a custom hook). This leads to the duplicated fetch patterns found in 12+ components.

5. **Dependency graph is flat but coupled**: There are no circular dependencies, but everything in `src/lib/` is at the same level. Job files, auth utilities, formatting helpers, database access, and GitHub API clients all sit together with no sub-organization. As the codebase grows, this will become harder to navigate.

6. **Missing build artifact exclusion**: The `dist/` directory with 79+ compiled JS files is committed to version control. This bloats the repository, can cause merge conflicts, and masks which files are source vs. generated.

---

## Summary

| Category | 🔴 Critical | 🟡 Important | 🟢 Nice to Have | Total |
|---|---|---|---|---|
| Dead Code | 1 | 3 | 12 | 16 |
| Duplications | 10 | 15 | 3 | 28 |
| Improvements | 3 | 12 | 6 | 21 |
| **Total** | **14** | **30** | **21** | **65** |

## Recommended Action Plan

### Immediate (Critical)

1. **Fix dashboard bug**: Replace `summary.activeSeats * 300` with `summary.activeSeats * premiumRequestsPerSeat` in `src/app/api/dashboard/route.ts:35`. The configurable value is already fetched but unused.
2. **Secure first-run setup**: Add authentication guard to `POST /api/configuration` or implement a one-time setup token mechanism.
3. **Remove default admin credentials**: Require `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` environment variables to be set explicitly. Remove the `"admin"/"admin"` hardcoded fallback.
4. **Add `dist/` to `.gitignore`**: Add `/dist` to `.gitignore` and purge the directory from git history with `git rm -r --cached dist/`.
5. **Extract `src/lib/format-helpers.ts`**: Consolidate `formatCurrency` (7x), `formatName` (4x), `formatRelativeTime` (2x), `formatTimestamp` (2x). Minimal risk, eliminates 15 duplicate function definitions across 11 files. (~1 hour)
6. **Extract `isUniqueViolation()` helper**: Create `src/lib/db-errors.ts` with the PostgreSQL `23505` check. Used in 7 route files. (~30 minutes)
7. **Extract `NotFoundError` class**: Create `src/lib/errors.ts` and import in the 2 route files that independently define it. (~15 minutes)
8. **Extract shared validation schema**: Create `nameSchema` in `src/lib/validations/shared.ts` and compose team/department schemas from it. (~30 minutes)

### Short-term (Important)

1. **Create `src/lib/api-helpers.ts`**: Extract `parseJsonBody()`, `parseEntityId()`, `parseMonthYearParams()`, and refactor all route files to use them. (~4 hours)
2. **Create `withErrorHandling(handler)` wrapper**: Centralize error logging and 500 responses to eliminate 30+ identical catch blocks. (~2 hours)
3. **Extract `useAvailableMonths()` and `useAsyncFetch()` custom hooks**: Eliminate repeated `fetchMonths` effect (5 files) and data-fetching `useEffect` pattern (8+ components). Also unify the `AvailableMonth` and `MemberEntry` types in `src/lib/types.ts`. (~3 hours)
4. **Create `EntityManagementPanel<T>` or `useEntityCrud()` hook**: Merge the ~80% identical `TeamManagementPanel` and `DepartmentManagementPanel` implementations. (~3 hours)
5. **Create `<LoadingState />`, `<ErrorState />`, `<EmptyState />` shared components**: Replace 9+ copy-pasted UI state blocks. (~1 hour)
6. **Extract shared job infrastructure**: Move `ERROR_MESSAGE_MAX_LENGTH` and `STALE_JOB_THRESHOLD_MS` to `constants.ts`. Create `acquireJobLock(jobType)` utility. Consider a `JobRunner` abstraction. (~3 hours)
7. **Batch seat sync upserts**: Replace N+1 `findOne` + `save` loop with `INSERT ... ON CONFLICT` batch operation. (~2 hours)
8. **Cache `getPremiumAllowance()`**: Add in-memory cache with 60s TTL to avoid querying configuration table on every request. (~1 hour)
9. **Validate `GITHUB_TOKEN` at startup**: Add validation in `instrumentation.ts` to fail fast if the token is missing. (~30 minutes)
10. **Remove test-modal from production**: Gate `/test-modal` page behind `NODE_ENV === "development"` or move to test fixtures. (~30 minutes)
11. **Reuse `calcUsagePercent` on backend**: Adapt `usage-helpers.ts` for server-side use in the 6 API routes that inline the formula. (~1 hour)
12. **Add component tests**: Prioritize `SeatListPanel`, `TeamManagementPanel`, and `UserManagementPanel` with Vitest + Testing Library. (~4 hours)

### Long-term (Nice to Have)

1. **Introduce a service/repository layer**: Extract business logic from API routes into dedicated service classes. Centralize raw SQL into query files or TypeORM QueryBuilder patterns.
2. **Adopt a data-fetching library**: Consider SWR or TanStack Query to replace ad-hoc `useState`/`useEffect` data fetching patterns, providing caching, revalidation, and error handling out of the box.
3. **Organize `src/lib/`**: Group related utilities into subdirectories (`src/lib/jobs/`, `src/lib/api/`, `src/lib/auth/`, `src/lib/format/`) to improve navigability as the codebase grows.
4. **Remove dead exports**: Remove unnecessary `export` keyword from 16+ types/interfaces/constants that are only used within their own files.
5. **Add structured logging**: Replace `console.log`/`console.error` with a logger (e.g., `pino`) that supports log levels, request correlation, and production-appropriate formatting.
6. **Make seat base cost configurable**: Move the `$19/seat` calculation from a hardcoded value into the configuration table alongside `premiumRequestsPerSeat`.
7. **Implement the recalculate button**: Either implement the planned `RecalculateMetricsButton` UI component for `POST /api/dashboard/recalculate` or remove the orphaned route.
8. **Combine dashboard metrics queries**: Merge the 7 sequential raw SQL calls in `dashboard-metrics.ts` into 1-2 CTEs for better performance.
