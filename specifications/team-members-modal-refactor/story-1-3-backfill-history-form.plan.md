````markdown
# Story 1.3: Show Backfill History Form Inline in the Members Modal - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Show Backfill History form inline in the members modal |
| Description | Add a `BackfillHistoryForm` component that renders inline at the top of the members modal when "Backfill History" is toggled, with date range selectors, seat search/selection, client-side validation, submission to the backfill API, and success/error messages — all without auto-closing on success |
| Priority | High |
| Related Research | `specifications/team-members-modal-refactor/extracted-tasks.md` |

## Proposed Solution

Create a `BackfillHistoryForm` component following the same extraction pattern established by `AddMembersForm` in Story 1.2. The form renders inline inside the members modal when `activeMode === 'backfill'`, between the toggle buttons and the member list. It manages its own internal state for date range selection, seat fetching/filtering/selection, validation, submission, and result messaging.

Key design decisions:

1. **Separate component** — `BackfillHistoryForm` is extracted into its own file (`src/components/teams/BackfillHistoryForm.tsx`), mirroring the `AddMembersForm` pattern. This keeps `TeamMembersPanel` focused on the member list and mode orchestration, and makes the backfill form testable in isolation.

2. **All active seats shown (no member filtering)** — Unlike `AddMembersForm` which filters out already-assigned seats, the backfill form shows ALL active seats. Backfill targets historical months where a seat may not yet be a member, even if it is a current-month member. The API's `ON CONFLICT DO NOTHING` handles idempotency.

3. **Client-side date validation** — Two validation checks are computed reactively from the date state (not on submit): "start date after end date" and "end date in the future". These disable the submit button and display inline messages, matching the E2E test expectations.

4. **Form stays open on success** — Per AC: "The backfill form does not close automatically on success." After a successful backfill, a success message displays within the form area, selected seats are cleared, and the parent's member list refreshes. The user can immediately perform another backfill with different parameters.

5. **React unmount resets state** — When the user toggles away from backfill mode, React unmounts `BackfillHistoryForm`, naturally resetting all internal state (dates, selections, errors, success messages). No explicit reset callback is needed, consistent with the `AddMembersForm` pattern.

```
┌──────────────────────────────────────────┐
│ Members of Engineering              [×]  │
│──────────────────────────────────────────│
│ Members for March 2026                   │
│                                          │
│ [Add Members] [■ Backfill History]       │
│                                          │
│ ┌── Backfill History Form ────────────┐ │
│ │ <h3>Backfill History</h3>           │ │
│ │                                     │ │
│ │ Start: [January ▼] [2025 ▼]        │ │
│ │ End:   [March   ▼] [2025 ▼]        │ │
│ │                                     │ │
│ │ Search: [__________________]        │ │
│ │ ☐ alice (Alice Smith)               │ │
│ │ ☐ bob   (Bob Jones)                 │ │
│ │                                     │ │
│ │ ✓ Added 3 snapshots across 3 months │ │
│ │                                     │ │
│ │ [Backfill Selected (0)]             │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌── Members Table (always visible) ───┐ │
│ │ GitHub Username │ Name     │ Actions│ │
│ │ charlie         │ Chas Lee │ Remove │ │
│ └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Props interface

```typescript
interface BackfillHistoryFormProps {
  teamId: number;
  onMembersBackfilled: () => void;  // refreshes member list, does NOT close form
}
```

The `onMembersBackfilled` callback differs from `AddMembersForm.onMembersAdded` — it only triggers a member list refresh without closing the form (no `setActiveMode(null)`).

## Current Implementation Analysis

### Already Implemented
- `POST /api/teams/[id]/members/backfill` — `src/app/api/teams/[id]/members/backfill/route.ts` — Accepts `{ seatIds, startMonth, startYear, endMonth, endYear }`, validates via `teamMembersBackfillSchema`, generates month range, bulk inserts with ON CONFLICT DO NOTHING, returns `{ added, totalMonthsInRange, startMonth, startYear, endMonth, endYear }`
- `teamMembersBackfillSchema` — `src/lib/validations/team-members.ts` — Zod schema with cross-field refinements: start ≤ end, no future end date, max 24-month range
- Backfill route unit tests — `src/app/api/teams/__tests__/[id].members.backfill.route.test.ts` — 507-line test suite covering auth, validation, successful backfill, idempotency, cross-year, isolation
- `Modal` component — `src/components/shared/Modal.tsx` — Portal-based dialog with `size="large"`, scrollable content area
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — 338-line modal-based component with `activeMode` state, toggle buttons, `AddMembersForm` integration, placeholder for backfill at line `{activeMode === 'backfill' && null}`
- `AddMembersForm` — `src/components/teams/AddMembersForm.tsx` — Reference pattern for the new component: seat fetching, search, checkbox selection, submission, error/loading states
- `GET /api/seats` — `src/app/api/seats/route.ts` — Paginated, filterable by status and search, returns seat records
- `MONTH_NAMES` — `src/lib/constants.ts` — Month name array for display
- E2E tests (skipped) — `e2e/team-members.spec.ts` — Backfill tests at lines 464–642 with TODO comments referencing Story 1.3, mode-switching tests at lines 644–688 and 738–775 referencing Story 1.2/1.3

### To Be Modified
- `src/components/teams/TeamMembersPanel.tsx` — Replace the `{activeMode === 'backfill' && null}` placeholder with `<BackfillHistoryForm>` integration; add `handleMembersBackfilled` callback that refreshes member list without closing the form
- `e2e/team-members.spec.ts` — Un-skip 8 backfill and mode-switching tests; rewrite `openBackfillFlow` helper to use the direct modal flow (no "Manage Members" intermediate step); update locators and assertions for the inline form pattern

### To Be Created
- `src/components/teams/BackfillHistoryForm.tsx` — New component for the inline backfill history form with date range selectors, seat search/selection, client-side validation, submission, and success/error messaging

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the backfill form filter out already-assigned seats like AddMembersForm does? | No. Backfill targets historical months where a seat may not yet be assigned. Show ALL active seats. The API's ON CONFLICT DO NOTHING handles duplicates, returning `added: 0` for already-existing snapshots. | ✅ Resolved |
| 2 | What should the date selector defaults be? | Current month and current year for both start and end, matching the E2E test expectations (line 769–772: `expectedMonth = String(now.getUTCMonth() + 1)`, `expectedYear = String(now.getUTCFullYear())`). | ✅ Resolved |
| 3 | What year range should the year selectors show? | 2020 to current year, matching the Zod schema constraint `min(2020, "Year must be 2020 or later")`. | ✅ Resolved |
| 4 | Should the success message clear when the user starts a new backfill? | Yes. Clear `successMessage` when the user changes any date selector or seat selection, so stale results don't persist alongside new inputs. | ✅ Resolved |
| 5 | Should the submit button label include selected count? | Yes — "Backfill Selected ({count})", matching the `AddMembersForm` pattern of "Add Selected ({count})" and the E2E test expectation `dialog.getByRole("button", { name: /backfill selected/i })`. | ✅ Resolved |
| 6 | Should selected seats be cleared on successful submit? | Yes. After a successful backfill, clear `selectedSeatIds` and `searchQuery` so the user can start fresh for a follow-up backfill, while the success message remains visible. | ✅ Resolved |
| 7 | What format should the success message use? | "Added {added} snapshot(s) across {totalMonthsInRange} month(s)" — matching E2E test expectations (e.g., `/added 1 snapshot across 1 month/i`, `/added 3 snapshots across 3 months/i`, `/added 0 snapshots across 1 month/i`). Handle singular/plural. | ✅ Resolved |

## Implementation Plan

### Phase 1: Create BackfillHistoryForm component

#### Task 1.1 - [CREATE] BackfillHistoryForm with date selectors, seat list, validation, and submission
**Description**: Create a new component at `src/components/teams/BackfillHistoryForm.tsx` that renders the inline backfill history form. The component manages its own state for date range selection, fetching available seats, filtering/searching, selecting via checkboxes, client-side date validation, and submitting the backfill request.

Props interface:
```typescript
interface BackfillHistoryFormProps {
  teamId: number;
  onMembersBackfilled: () => void;
}
```

Internal state:
- `startMonth: number` — default: current UTC month (1–12)
- `startYear: number` — default: current UTC year
- `endMonth: number` — default: current UTC month
- `endYear: number` — default: current UTC year
- `availableSeats: SeatOption[]` — all active seats (NOT filtered by existing members)
- `isLoadingSeats: boolean`
- `seatFetchError: string | null`
- `searchQuery: string`
- `selectedSeatIds: Set<number>`
- `isSubmitting: boolean`
- `submitError: string | null`
- `successMessage: string | null`

Type for seat records (internal to the component):
```typescript
interface SeatOption {
  id: number;
  githubUsername: string;
  firstName: string | null;
  lastName: string | null;
}
```

Behavior:
1. **On mount**: Fetch `GET /api/seats?status=active&pageSize=300`. Map response to `SeatOption[]`. Do NOT filter out existing members — backfill targets historical months.
2. **Date selectors**: Four `<select>` elements with IDs `backfill-start-month`, `backfill-start-year`, `backfill-end-month`, `backfill-end-year`. Month selectors show month names (January–December) with values 1–12. Year selectors show 2020 to current year.
3. **Client-side validation** (computed via `useMemo`):
   - `isStartAfterEnd`: `true` when `startYear * 12 + startMonth > endYear * 12 + endMonth` → message: "Start date must be before or equal to end date"
   - `isFutureEnd`: `true` when `endYear * 12 + endMonth > currentYear * 12 + currentMonth` → message: "End date cannot be in the future"
   - When either validation fails, the submit button is disabled and the message renders as a `<p>` with `text-sm text-red-600`
4. **Search**: Filter `availableSeats` by matching `searchQuery` against `githubUsername`, `firstName`, and `lastName` (case-insensitive, same logic as `AddMembersForm`).
5. **Selection**: Each seat row has a checkbox with `aria-label="Select {githubUsername}"`. Toggling updates `selectedSeatIds`.
6. **Clear stale success**: When any date selector value changes or a seat selection changes, clear `successMessage` (so old results don't sit alongside new inputs).
7. **Submit**: "Backfill Selected ({count})" button, disabled when `selectedSeatIds.size === 0`, `isSubmitting`, `isStartAfterEnd`, or `isFutureEnd`. On click, POST `{ seatIds: [...selectedSeatIds], startMonth, startYear, endMonth, endYear }` to `/api/teams/{teamId}/members/backfill`. On success (status 201), read response `{ added, totalMonthsInRange }`, set `successMessage` to `"Added {added} snapshot(s) across {totalMonthsInRange} month(s)"` (with correct singular/plural), clear `selectedSeatIds` and `searchQuery`, call `onMembersBackfilled()`. On error, set `submitError`.
8. **Error states**: Seat fetch error shows alert with "Retry" button. Submit error shows alert above the submit button.
9. **Form heading**: `<h3 className="text-sm font-semibold text-gray-900 mb-3">Backfill History</h3>`

Styling: Follow the existing Tailwind patterns from `AddMembersForm.tsx` — outer wrapper `rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4`, error banners `rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200`, success banners `rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200`, buttons `bg-blue-600 px-4 py-2 text-sm font-medium text-white`, select elements `rounded-md border border-gray-300 px-3 py-2 text-sm`.

**Definition of Done**:
- [x] `src/components/teams/BackfillHistoryForm.tsx` exists with the `BackfillHistoryFormProps` interface
- [x] On mount, the component fetches all active seats from `GET /api/seats?status=active&pageSize=300` (no existing-member filtering)
- [x] Four date `<select>` elements render with IDs `backfill-start-month`, `backfill-start-year`, `backfill-end-month`, `backfill-end-year`
- [x] Month selectors show month names (January–December) with values 1–12
- [x] Year selectors show years from 2020 to current year
- [x] Default date values are the current UTC month and year for both start and end
- [x] When start date is after end date, "Start date must be before or equal to end date" message displays and submit button is disabled
- [x] When end date is in the future, "End date cannot be in the future" message displays and submit button is disabled
- [x] A search input filters the seat list by githubUsername, firstName, lastName (case-insensitive)
- [x] Each available seat renders a checkbox with `aria-label="Select {githubUsername}"`
- [x] Checking/unchecking seats updates the selected set
- [x] "Backfill Selected ({count})" button is disabled when no seats are selected, while submitting, or when date validation fails
- [x] Submitting sends POST `{ seatIds, startMonth, startYear, endMonth, endYear }` to `/api/teams/{teamId}/members/backfill`
- [x] On success (status 201), success message "Added {N} snapshot(s) across {M} month(s)" displays with correct singular/plural
- [x] On success, `selectedSeatIds` and `searchQuery` are cleared, `onMembersBackfilled()` is called
- [x] The form does NOT close on success (stays visible for multiple backfills)
- [x] Changing any date or seat selection clears a stale success message
- [x] Seat fetch error displays an alert with "Retry" button within the form area
- [x] Submit error displays an alert within the form area
- [x] While seats are loading, "Loading available seats…" is displayed
- [x] Form heading "Backfill History" renders as `<h3>`
- [x] TypeScript compiles without errors

### Phase 2: Integrate BackfillHistoryForm into TeamMembersPanel

#### Task 2.1 - [MODIFY] Replace backfill placeholder with BackfillHistoryForm in TeamMembersPanel
**Description**: In `src/components/teams/TeamMembersPanel.tsx`, replace the `{activeMode === 'backfill' && null /* Story 1.3: BackfillHistoryForm */}` placeholder with a conditional render of the new `BackfillHistoryForm` component.

Changes to `src/components/teams/TeamMembersPanel.tsx`:
1. Import `BackfillHistoryForm` from `./BackfillHistoryForm`
2. Add `handleMembersBackfilled` callback that calls `fetchMembers()` only (does NOT set `activeMode` to `null` — the form stays open)
3. Replace `{activeMode === 'backfill' && null /* Story 1.3: BackfillHistoryForm */}` with: `{activeMode === 'backfill' && <BackfillHistoryForm teamId={teamId} onMembersBackfilled={handleMembersBackfilled} />}`

**Definition of Done**:
- [x] `BackfillHistoryForm` is imported from `./BackfillHistoryForm`
- [x] `handleMembersBackfilled` callback calls `fetchMembers()` without changing `activeMode`
- [x] `BackfillHistoryForm` renders when `activeMode === 'backfill'` with correct props
- [x] The placeholder comment is removed
- [x] The form renders between the toggle buttons and the member list (member list remains visible below)
- [x] Toggling away from backfill mode unmounts `BackfillHistoryForm` and resets its state
- [x] Toggling back to backfill mode mounts a fresh `BackfillHistoryForm` instance
- [x] TypeScript compiles without errors

### Phase 3: Un-skip and update E2E tests

#### Task 3.1 - [MODIFY] Rewrite `openBackfillFlow` helper for direct modal flow
**Description**: The current `openBackfillFlow` helper in `e2e/team-members.spec.ts` references a "Manage Members" button that no longer exists (it was part of the old modal-forms-refactor pattern). Rewrite it for the current architecture where clicking "Members" opens the modal directly and "Backfill History" is a toggle button at the top of the modal.

Updated helper:
```typescript
async function openBackfillFlow(page: import("@playwright/test").Page, teamName: string) {
  await loginViaApi(page, "admin", "password123");
  await page.goto("/management?tab=teams");

  const row = page.locator("tr", { hasText: teamName });
  await row.getByRole("button", { name: /members/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Click Backfill History toggle button
  await dialog.getByRole("button", { name: /backfill history/i }).click();

  // Wait for form heading
  await expect(
    dialog.getByRole("heading", { name: /backfill history/i })
  ).toBeVisible();

  return dialog;
}
```

**Definition of Done**:
- [x] `openBackfillFlow` no longer references "Manage Members" button
- [x] `openBackfillFlow` clicks "Members" on the team row, which opens the modal directly
- [x] `openBackfillFlow` clicks "Backfill History" toggle button within the dialog
- [x] `openBackfillFlow` waits for the "Backfill History" form heading to be visible
- [x] `openBackfillFlow` returns the dialog locator

#### Task 3.2 - [MODIFY] Un-skip and verify backfill submission E2E tests
**Description**: Un-skip the following tests in the "Team Member Backfill History" describe block and verify they pass with the new inline form:

1. `can open backfill flow, select date range and seats, submit, and see success message` — Uses `openBackfillFlow`, sets date selectors by ID, selects a seat checkbox, clicks submit, asserts success message within dialog. Should work with the new form if element IDs match.
2. `backfill across multiple months creates snapshots for each month` — Same pattern with a 3-month range.
3. `backfill is idempotent — re-submitting same range shows added: 0` — Pre-seeds a snapshot, submits same range, expects "added 0".

These tests already scope all interactions to the dialog locator and use the correct element IDs (`#backfill-start-month`, etc.) and text patterns (`/added N snapshot/i`).

**Definition of Done**:
- [x] `can open backfill flow, select date range and seats, submit, and see success message` is un-skipped and passes
- [x] `backfill across multiple months creates snapshots for each month` is un-skipped and passes
- [x] `backfill is idempotent — re-submitting same range shows added: 0` is un-skipped and passes
- [x] All three tests use the rewritten `openBackfillFlow` helper

#### Task 3.3 - [MODIFY] Un-skip and verify backfill validation E2E tests
**Description**: Un-skip the date validation tests:

1. `shows validation error when start date is after end date` — Sets start month after end month, asserts validation message visible and submit button disabled.
2. `shows validation error when end date is in the future` — Sets end date to a future month, asserts validation message visible and submit button disabled.

These tests rely on client-side validation messages matching specific text patterns and the submit button being disabled.

**Definition of Done**:
- [x] `shows validation error when start date is after end date` is un-skipped and passes
- [x] `shows validation error when end date is in the future` is un-skipped and passes
- [x] Validation messages match E2E expectations: `/start date must be before or equal to end date/i` and `/end date cannot be in the future/i`
- [x] Submit button (`/backfill selected/i`) is disabled when validation fails

#### Task 3.4 - [MODIFY] Un-skip and update backfill cancel E2E test
**Description**: Un-skip `cancel button closes the members modal`. In the current architecture, there is no explicit "Cancel" button in the backfill form (the form stays open, and closing happens via modal close mechanisms). This test needs to be rewritten to close the modal via Escape or the modal close button, or the "Backfill History" toggle button (which deactivates the form).

However, looking at the E2E test, it expects clicking a "Cancel" button closes the dialog entirely. The `BackfillHistoryForm` doesn't have a Cancel button — the form is dismissed by either: (a) clicking the "Backfill History" toggle again to deactivate, (b) pressing Escape to close the modal, or (c) clicking the modal overlay. Since the test expects `dialog` to not be visible after the action, the most natural update is to use Escape to close the modal.

Rewrite: Replace `dialog.getByRole("button", { name: /cancel/i }).click()` with `page.keyboard.press("Escape")`, then assert `dialog` is not visible. This tests that the modal can be closed while the backfill form is active without side effects.

**Definition of Done**:
- [x] `cancel button closes the members modal` is un-skipped (renamed to "pressing Escape closes the modal while backfill form is active")
- [x] Test closes the modal via Escape instead of a Cancel button
- [x] Test asserts the dialog is not visible after closing
- [x] Test passes

#### Task 3.5 - [MODIFY] Un-skip and rewrite mode-switching E2E tests
**Description**: Un-skip the two mode-switching tests that were skipped with `// TODO: Un-skip in Story 1.2/1.3`:

1. `switching to backfill mode from add mode resets add form state` (line 644):
   - Rewrite to remove "Manage Members" button reference
   - Flow: Click "Members" → modal opens → click "Add Members" → select alice → click "Backfill History" → verify backfill form heading visible, verify backfill date selectors visible → verify add members checkbox is not visible (form unmounted)

2. `switching from backfill to add mode resets backfill form state` (line 738):
   - Rewrite to remove "Manage Members" button reference
   - Flow: Click "Members" → modal opens → click "Backfill History" → change start-month to "6" → click "Add Members" → click "Backfill History" again → verify start-month is reset to current month default

**Definition of Done**:
- [x] `switching to backfill mode from add mode resets add form state` is un-skipped and rewritten without "Manage Members" reference
- [x] Test verifies that switching from add to backfill mode shows the backfill form and hides the add form
- [x] `switching from backfill to add mode resets backfill form state` is un-skipped and rewritten without "Manage Members" reference
- [x] Test verifies that switching away and back to backfill mode resets date selectors to defaults
- [x] Both tests pass

### Phase 4: Code review

#### Task 4.1 - Code review by `tsh-code-reviewer` agent
**Description**: Full code review of all changes made in phases 1–3 using the `tsh-code-reviewer` agent.

**Definition of Done**:
- [x] All new and modified files reviewed (`BackfillHistoryForm.tsx`, `TeamMembersPanel.tsx`, `team-members.spec.ts`)
- [x] No critical or high-severity issues remaining
- [x] Code follows existing project patterns and conventions (Tailwind styling, error handling, API interaction patterns, component extraction pattern from `AddMembersForm`)
- [x] Component interface between `BackfillHistoryForm` and `TeamMembersPanel` is clean and minimal

## Security Considerations

- **No new API endpoints or data changes**: Reuses the existing `POST /api/teams/[id]/members/backfill` and `GET /api/seats` endpoints, both protected by `requireAuth()` middleware.
- **Server-side validation**: The `teamMembersBackfillSchema` Zod schema validates all fields server-side (seatIds array, date ranges, start ≤ end, no future dates, max 24-month range). Client-side validation is a UX convenience — the server enforces all constraints independently.
- **Idempotent inserts**: The `ON CONFLICT DO NOTHING` clause in the backfill route prevents duplicate snapshot creation, even if the client submits overlapping ranges.
- **No XSS surface**: All dynamic content (seat usernames, names, error/success messages) is rendered via React JSX auto-escaping. No `dangerouslySetInnerHTML` is used.
- **ARIA accessibility**: Seat checkboxes use `aria-label="Select {githubUsername}"`. Date selectors use HTML `<label>` elements associated via `htmlFor`. Form heading uses semantic `<h3>`. Error and success alerts use `role="alert"`. The submit button is disabled when validation fails, preventing invalid submissions.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking "Backfill History" shows the form inline between buttons and member list
- [x] The backfill form includes date range selectors (start/end month and year as `<select>` elements)
- [x] Date selectors default to current month and year
- [x] Year selectors show range from 2020 to current year
- [x] Month selectors show month names (January–December)
- [x] The backfill form includes a search input and seat checkbox list (all active seats, not filtered by existing members)
- [x] Date validation message "Start date must be before or equal to end date" displays when start is after end
- [x] Date validation message "End date cannot be in the future" displays when end date is in the future
- [x] Submit button is disabled when date validation fails
- [x] Success messages (e.g., "Added 3 snapshots across 3 months") display within the form area
- [x] Error messages display within the form area
- [x] Submitting triggers the backfill, shows the result, and refreshes the member list
- [x] The backfill form does not close automatically on success
- [x] Selected seats and search are cleared on success (ready for another backfill)
- [x] Stale success messages clear when date or seat selection changes
- [x] The member list remains visible below the form at all times
- [x] Switching modes (backfill → add → backfill) resets the backfill form state
- [x] All un-skipped E2E backfill tests pass
- [x] All un-skipped mode-switching tests pass
- [x] All existing E2E tests (view, add, remove, retire, purge, close) continue to pass
- [x] TypeScript compiles without errors

## Improvements (Out of Scope)

- **Shared seat loading between Add and Backfill forms**: Both forms fetch `GET /api/seats?status=active&pageSize=300`. Loading seats once at the `TeamMembersPanel` level and passing them down would reduce duplicate API calls when switching modes. The filtering differs (Add filters out existing members; Backfill shows all), but the raw data is the same.
- **Debounced search**: The search filter is applied synchronously on the client-side seat array. For very large seat lists (hundreds of seats), debouncing the search input would improve performance. Not needed at current scale.
- **24-month range client-side validation**: The server-side Zod schema enforces `max 24 months` but the client-side validation only checks start ≤ end and no future dates. Adding a third client-side check for the 24-month limit would provide better UX feedback. Not in scope — the server returns a clear error message.
- **Date picker component**: The current design uses four native `<select>` elements. A more polished date range picker component (e.g., a month/year calendar widget) would improve UX. Out of scope per the extracted-tasks.md exclusions ("not restyling form components").
- **Extract member table into a separate component**: `TeamMembersPanel` would benefit from extracting the members table into a `TeamMemberTable` component. Not in scope — standalone refactor.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
| 3 March 2026 | Phase 1 complete: `BackfillHistoryForm.tsx` created (372 lines) |
| 3 March 2026 | Phase 2 complete: `TeamMembersPanel.tsx` modified to integrate `BackfillHistoryForm` |
| 3 March 2026 | Phase 3 complete: 8 E2E tests un-skipped and rewritten in `team-members.spec.ts` |
| 3 March 2026 | Phase 4 code review: 2 medium + 1 low findings — all fixed (M1: success message race condition, M2: missing `role="alert"` on validation messages, L3: misleading E2E comment) |
| 3 March 2026 | QA checklist verified: TypeScript compiles clean, 567/567 unit tests pass, all checkboxes marked |

````
