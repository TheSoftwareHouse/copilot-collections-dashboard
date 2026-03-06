# Story 1.2: Admin can view and update application configuration — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.2 |
| Title | Admin can view and update application configuration |
| Description | Allow administrators to view and update the application configuration after initial setup so that settings can be adjusted if the organisation structure changes. Admin can access a dedicated settings page showing current values and submit changes. |
| Priority | Medium |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/story-1-1.plan.md` |

## Proposed Solution

Extend the existing configuration feature (delivered in Story 1.1) with a **PUT endpoint** and a **settings page** that allows editing. The existing `ConfigurationForm` component is refactored to support both "create" and "edit" modes via props, avoiding code duplication. A minimal navigation bar is added to the `(app)` layout so the settings page is accessible from any authenticated page.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                       Next.js App                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  (app) Layout  — config guard + navigation bar   │    │
│  │  ┌──────────────────┐  ┌──────────────────────┐  │    │
│  │  │  /dashboard      │  │  /settings           │  │    │
│  │  │  (existing)      │  │  (Server Component)  │  │    │
│  │  └──────────────────┘  │  fetches config,     │  │    │
│  │                        │  renders EditForm     │  │    │
│  │                        └──────────┬───────────┘  │    │
│  └───────────────────────────────────┼──────────────┘    │
│                                      │                   │
│  ┌───────────────────────────────────▼───────────────┐   │
│  │  ConfigurationForm (enhanced)                     │   │
│  │  mode="create" | mode="edit"                      │   │
│  │  - create: POST → 201 → redirect /dashboard      │   │
│  │  - edit:   PUT  → 200 → success message           │   │
│  │  - accepts optional initialValues prop            │   │
│  └───────────────────────────────────┬───────────────┘   │
│                                      │                   │
│  ┌───────────────────────────────────▼───────────────┐   │
│  │  /api/configuration                               │   │
│  │  GET  — existing (returns current config)         │   │
│  │  POST — existing (creates config, singleton)      │   │
│  │  PUT  — NEW (updates existing config)             │   │
│  └───────────────────────────────────┬───────────────┘   │
│                                      │                   │
│                               ┌──────▼──────┐           │
│                               │  PostgreSQL  │           │
│                               │  config row  │           │
│                               └─────────────┘           │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **PUT (not PATCH)**: The configuration object is small (two fields). A full replacement via PUT is simpler and matches the existing Zod schema — both fields are always required. No partial update complexity.
2. **Reuse `ConfigurationForm`**: The form UI is identical for create and edit. A `mode` prop and optional `initialValues` prop parameterize submission behavior (POST vs PUT, redirects vs success message). This avoids duplicating form markup, validation, error handling, and accessibility attributes.
3. **Settings page inside `(app)` route group**: Leverages the existing configuration guard in `(app)/layout.tsx`. If no configuration exists, the user is already redirected to `/setup`, so the settings page never renders in an unconfigured state.
4. **Navigation in `(app)` layout**: A lightweight navigation bar added to the `(app)` layout provides consistent access to Dashboard and Settings from all app pages. Keeps navigation DRY and extensible for future pages.
5. **No database migration**: The existing `Configuration` entity schema is sufficient. TypeORM's `save()` method on an existing entity performs an UPDATE. The `updatedAt` column is automatically updated by TypeORM's `@UpdateDateColumn` behavior.

### Data Model

No changes to the existing data model. The `Configuration` entity already has `updatedAt` with `updateDate: true`, which TypeORM updates automatically on save.

```
┌──────────────────────────────┐
│       Configuration          │  (no changes)
├──────────────────────────────┤
│ id           : Int (PK)     │
│ singletonKey : Varchar (UQ) │
│ apiMode      : Enum         │
│ entityName   : Varchar(255) │
│ createdAt    : Timestamptz  │
│ updatedAt    : Timestamptz  │
└──────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `Configuration` entity — `src/entities/configuration.entity.ts` — TypeORM entity with singleton constraint
- `ApiMode` enum — `src/entities/enums.ts` — `ORGANISATION` / `ENTERPRISE` values
- `GET /api/configuration` — `src/app/api/configuration/route.ts` — returns current config or 404
- `POST /api/configuration` — `src/app/api/configuration/route.ts` — creates config with singleton enforcement
- `configurationSchema` (Zod) — `src/lib/validations/configuration.ts` — validates `apiMode` and `entityName`
- `ConfigurationForm` — `src/components/setup/ConfigurationForm.tsx` — client component with validation, error handling, accessibility
- `/setup` page — `src/app/setup/page.tsx` — first-run setup with redirect guard
- `/dashboard` page — `src/app/(app)/dashboard/page.tsx` — displays current configuration values
- `(app)` layout — `src/app/(app)/layout.tsx` — configuration guard (redirect to `/setup` if unconfigured)
- Test infrastructure — Vitest + Playwright configured, `db-helpers.ts` with test data source utilities
- API integration tests — `src/app/api/configuration/__tests__/route.test.ts` — covers GET and POST
- E2E tests — `e2e/first-run-setup.spec.ts` — covers first-run flow

### To Be Modified
- `ConfigurationForm` — `src/components/setup/ConfigurationForm.tsx` — add `mode` and `initialValues` props to support edit mode (PUT request, success message instead of redirect)
- `src/app/api/configuration/route.ts` — add `PUT` handler for updating existing configuration
- `src/app/(app)/layout.tsx` — add navigation bar with links to Dashboard and Settings
- `src/app/api/configuration/__tests__/route.test.ts` — add integration tests for PUT handler

### To Be Created
- Settings page — `src/app/(app)/settings/page.tsx` — server component that fetches config and renders ConfigurationForm in edit mode
- E2E test — `e2e/configuration-settings.spec.ts` — tests for viewing and updating configuration from the settings page

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the settings page be a separate route or a section within the dashboard? | Separate route (`/settings`) — clearer navigation, matches "configuration settings page" requirement | ✅ Resolved |
| 2 | After updating configuration, should the user stay on the settings page or be redirected? | Stay on the settings page with a success message — allows the user to verify the change and make further adjustments | ✅ Resolved |
| 3 | Should the form be duplicated or reused from Story 1.1? | Reused — the `ConfigurationForm` component will accept `mode` and `initialValues` props. The form UI (radio buttons, text input, validation, accessibility) is identical for both modes. | ✅ Resolved |
| 4 | Is a database migration needed? | No — the existing schema supports updates via TypeORM's `save()` method. The `updatedAt` column is automatically maintained. | ✅ Resolved |

## Implementation Plan

### Phase 1: API Enhancement

#### Task 1.1 - [MODIFY] Add PUT handler to `/api/configuration/route.ts`
**Description**: Add a `PUT` export to the existing configuration API route. The handler validates input with the existing Zod schema, finds the singleton configuration record, updates it, and returns the updated values. Returns 404 if no configuration exists to update.

**Definition of Done**:
- [x] `PUT` handler exported from `src/app/api/configuration/route.ts`
- [x] Request body parsed and validated against the existing `configurationSchema`
- [x] Returns `400` with structured validation errors for invalid input (same format as POST)
- [x] Returns `404` with `{ error: "Configuration not found" }` when no configuration exists
- [x] Returns `200` with the updated configuration object `{ apiMode, entityName, createdAt, updatedAt }` on success
- [x] `apiMode` value mapped from lowercase input string to `ApiMode` enum before persistence
- [x] Configuration record updated via TypeORM repository's `save()` method (which triggers `updatedAt` auto-update)
- [x] Handles malformed JSON body gracefully (returns `400`)
- [x] Internal errors return `500` with generic error message

### Phase 2: Settings UI

#### Task 2.1 - [MODIFY] Enhance `ConfigurationForm` to support edit mode
**Description**: Refactor the existing `ConfigurationForm` component to accept optional `mode` and `initialValues` props. In "edit" mode, the form pre-fills fields from `initialValues`, sends a PUT request instead of POST, and displays a success message on the same page instead of redirecting. In "create" mode (default), behavior is unchanged from Story 1.1.

**Definition of Done**:
- [x] `ConfigurationForm` accepts an optional `mode` prop (`"create"` | `"edit"`, defaults to `"create"`)
- [x] `ConfigurationForm` accepts an optional `initialValues` prop (`{ apiMode: string; entityName: string }`)
- [x] In "create" mode: all existing behavior is preserved (POST, redirect on 201/409)
- [x] In "edit" mode: form fields are pre-populated from `initialValues`
- [x] In "edit" mode: submit sends PUT to `/api/configuration`
- [x] In "edit" mode: on success (200), a success message is displayed (e.g., "Configuration updated successfully")
- [x] In "edit" mode: on 404, displays error message indicating configuration not found
- [x] In "edit" mode: submit button label reads "Update Configuration" instead of "Save Configuration"
- [x] Client-side Zod validation remains active in both modes
- [x] Server-side validation errors (400) are displayed in both modes
- [x] All existing accessibility attributes are preserved (`aria-describedby`, `aria-invalid`, `role="alert"`, labels, keyboard navigation)
- [x] Existing `/setup` page usage of `ConfigurationForm` continues to work without changes (default mode is "create")

#### Task 2.2 - [CREATE] Settings page at `/settings`
**Description**: Create a server component page inside the `(app)` route group that displays the current configuration and renders the `ConfigurationForm` in edit mode with the current values as initial values.

**Definition of Done**:
- [x] Page created at `src/app/(app)/settings/page.tsx` as a Server Component
- [x] Page fetches current configuration from the database via TypeORM repository (same pattern as dashboard page)
- [x] Renders a heading ("Configuration Settings" or similar) and a brief description
- [x] Passes current `apiMode` and `entityName` as `initialValues` to `ConfigurationForm`
- [x] Renders `ConfigurationForm` with `mode="edit"`
- [x] Page has appropriate `<title>` via metadata export (e.g., "Settings — Copilot Dashboard")
- [x] Page is responsive (works on desktop and tablet viewports)
- [x] Configuration guard in `(app)/layout.tsx` ensures this page is never accessed with no configuration

#### Task 2.3 - [MODIFY] Add navigation bar to `(app)` layout
**Description**: Add a simple navigation bar to the `(app)` layout that provides links to Dashboard and Settings. This ensures consistent navigation across all app pages.

**Definition of Done**:
- [x] `src/app/(app)/layout.tsx` updated to include a `<nav>` element above `{children}`
- [x] Navigation contains links to `/dashboard` and `/settings`
- [x] Active page link is visually distinguished (e.g., bold or underlined based on current pathname)
- [x] Navigation bar is accessible: uses `<nav>` landmark with `aria-label`, links are keyboard-navigable
- [x] Navigation bar is responsive and does not break on smaller viewports
- [x] Existing configuration guard logic is preserved
- [x] All pages within `(app)` route group display the navigation bar

### Phase 3: Testing

#### Task 3.1 - [MODIFY] Add PUT integration tests
**Description**: Extend the existing API integration tests to cover the new PUT handler. Tests use the same test infrastructure (Vitest, test data source, `cleanDatabase`) established in Story 1.1.

**Definition of Done**:
- [x] `PUT /api/configuration` test: returns `200` and updates configuration with valid input when config exists
- [x] `PUT /api/configuration` test: returns updated `apiMode`, `entityName`, `createdAt`, `updatedAt` in response body
- [x] `PUT /api/configuration` test: `updatedAt` value changes after update
- [x] `PUT /api/configuration` test: returns `404` when no configuration exists
- [x] `PUT /api/configuration` test: returns `400` for invalid input (empty entityName, invalid apiMode)
- [x] `PUT /api/configuration` test: returns `400` for malformed JSON body
- [x] `PUT /api/configuration` test: persisted values match the update payload (verified by subsequent GET or direct DB read)
- [x] All existing GET and POST tests continue to pass
- [x] Database is cleaned between tests to ensure isolation

#### Task 3.2 - [CREATE] E2E tests for configuration update flow
**Description**: Write Playwright E2E tests that exercise the complete settings page flow — viewing current values, updating them, and verifying the changes are persisted.

**Definition of Done**:
- [x] Test file created at `e2e/configuration-settings.spec.ts`
- [x] Test setup: configuration created via API before each test (so settings page is accessible)
- [x] Test 1: User navigates to `/settings` → current configuration values are pre-filled in the form
- [x] Test 2: User changes API mode and entity name → submits → success message appears → updated values are reflected
- [x] Test 3: User navigates to `/settings`, submits empty entity name → validation error displayed, no save
- [x] Test 4: Navigation bar is present on the settings page with working links to Dashboard and Settings
- [x] Database is cleaned before each test run
- [x] All E2E tests pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (naming, structure, formatting)
- [x] Test coverage is adequate for the feature scope

## Security Considerations

- **Input Validation**: The PUT endpoint reuses the same Zod schema as POST, ensuring consistent server-side validation. All user input is validated and sanitized before database persistence.
- **No Authentication (current state)**: Like the existing POST endpoint, the PUT endpoint is currently unauthenticated. This is an accepted trade-off for Story 1.2 — once authentication (Story 2.1) is implemented, all configuration endpoints should be restricted to admin users only.
- **SQL Injection Prevention**: TypeORM parameterised queries prevent SQL injection in the update operation.
- **No Mass Assignment**: Only `apiMode` and `entityName` are extracted from the validated request body. Other entity fields (`id`, `singletonKey`, `createdAt`) cannot be overwritten by the client.
- **Rate Limiting**: Not in scope for this story, but configuration update endpoints should be rate-limited in production to prevent abuse. Documented as an improvement.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Admin can access a configuration settings page at `/settings`
- [x] Current configuration values (API mode, entity name) are displayed and pre-filled in the form
- [x] Admin can update the organisation/enterprise name
- [x] Admin can update the endpoint type (organisation ↔ enterprise)
- [x] Changes are saved to the database (verified by page refresh showing updated values)
- [x] Success feedback is displayed after a successful update
- [x] Invalid input is rejected with clear, accessible error messages
- [x] Navigation bar provides access to the settings page from any app page
- [x] API returns correct HTTP status codes (200, 400, 404)
- [x] All existing Story 1.1 functionality continues to work (setup flow, dashboard, API)
- [x] All unit/integration tests pass
- [x] All E2E tests pass

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Authentication guard on configuration endpoints**: Once Story 2.1 (authentication) is delivered, restrict PUT/POST `/api/configuration` to admin users only.
- **Optimistic concurrency control**: Add an `ETag` or version field to prevent conflicting concurrent updates. Low risk for a single-admin singleton but good practice.
- **Rate limiting**: Apply rate limiting to the PUT endpoint to prevent abuse (relevant after the app is publicly accessible).
- **Audit log**: Record who changed configuration and when, for compliance and troubleshooting.
- **Confirmation dialog**: Show a confirmation dialog before saving configuration changes to prevent accidental modifications.

## Code Review Findings

Code review performed by `tsh-code-reviewer` agent. **Verdict: APPROVED.**

- **0 Critical / 0 High** issues found
- **1 Medium** (M1): E2E helper code duplication across `e2e/configuration-settings.spec.ts` and `e2e/first-run-setup.spec.ts` — both define identical `clearConfiguration()` functions. Recommendation: extract to shared `e2e/helpers/db.ts`. Deferred to future cleanup; does not block this story.
- **4 Low** findings: missing `@types/pg` dev dependency (pre-existing), defensive null guard in settings page (acceptable), hardcoded DB fallback strings in E2E (pre-existing), dynamic imports for `pg` in E2E (consistent with existing pattern).

All acceptance criteria verified. Test suite: 25 unit/integration + 8 E2E, all passing.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-27 | Initial plan created |
| 2026-02-27 | Implementation completed — all phases delivered. Code review performed by tsh-code-reviewer: APPROVED with 1 medium and 4 low findings (no blockers). |
