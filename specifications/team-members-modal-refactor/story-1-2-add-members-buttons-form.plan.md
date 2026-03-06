# Story 1.2: Show Add Members and Backfill History Action Buttons in the Members Modal - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Show Add Members and Backfill History action buttons in the members modal |
| Description | Add "Add Members" and "Backfill History" toggle buttons at the top of the members modal and implement the Add Members inline form with search input, seat checkbox list, and submission logic |
| Priority | High |
| Related Research | `specifications/team-members-modal-refactor/extracted-tasks.md` |

## Proposed Solution

Add an `activeMode` state (`'add' | 'backfill' | null`) to `TeamMembersPanel` that controls which inline form is displayed between the toggle buttons and the member list. Two toggle buttons ("Add Members" and "Backfill History") render at the top of the modal body, right after the month label. Clicking an active button deactivates it; clicking an inactive button activates its mode and resets the other form's state.

When `activeMode === 'add'`, an `AddMembersForm` component renders inline between the buttons and the member list. This form fetches all active seats via `GET /api/seats?status=active&pageSize=300`, filters out seats already assigned to the team (by comparing seat IDs), offers a search input and checkbox list, and submits via `POST /api/teams/{teamId}/members`. On success, the parent refreshes the member list and hides the form. Errors display within the form area.

When `activeMode === 'backfill'`, nothing renders (the Backfill History form will be added in Story 1.3). The button toggle still works, so clicking "Backfill History" sets the mode and clicking "Add Members" switches back.

```
┌──────────────────────────────────────────┐
│ Members of Engineering              [×]  │
│──────────────────────────────────────────│
│ Members for March 2026                   │
│                                          │
│ [Add Members] [Backfill History]         │
│                                          │
│ ┌── Add Members Form (when active) ───┐ │
│ │ Search: [__________________]        │ │
│ │ ☐ alice (Alice Smith)               │ │
│ │ ☐ bob   (Bob Jones)                 │ │
│ │ [Add Selected (0)]                  │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌── Members Table (always visible) ───┐ │
│ │ GitHub Username │ Name     │ Actions│ │
│ │ charlie         │ Chas Lee │ Remove │ │
│ └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Why extract AddMembersForm as a separate component?

`TeamMembersPanel` is already 311 lines post-Story 1.1 with member list + remove flow logic. The Add Members form introduces its own state cluster (available seats, search query, selected seat IDs, loading, error, submission) that is independent of the member list. Extracting it into `AddMembersForm` keeps each component focused on a single concern, makes the form testable in isolation, and prevents `TeamMembersPanel` from growing to 500+ lines. This also sets a pattern for StoryÂ 1.3 to extract a `BackfillHistoryForm` component.

## Current Implementation Analysis

### Already Implemented
- `Modal` component — `src/components/shared/Modal.tsx` — Portal-based dialog with focus trap, `size="large"` variant, scrollable content area
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — 311-line modal-based component with member list, loading/error/empty states, remove/retire/purge flow (Story 1.1 output)
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Team table with "Members" button, mounts `TeamMembersPanel` when `managingMembersTeam` is set
- `POST /api/teams/[id]/members` — `src/app/api/teams/[id]/members/route.ts` — Accepts `{ seatIds: number[] }`, validates seat existence, inserts snapshots with ON CONFLICT DO NOTHING, returns `{ added, month, year }`
- `GET /api/seats` — `src/app/api/seats/route.ts` — Paginated, filterable by status and search, returns seat records
- `teamMembersSeatIdsSchema` — `src/lib/validations/team-members.ts` — Zod schema for seatIds payload
- `MONTH_NAMES` — `src/lib/constants.ts` — Month name array
- E2E tests (skipped) — `e2e/team-members.spec.ts` — Add-member tests with TODO comments referencing Story 1.2

### To Be Modified
- `src/components/teams/TeamMembersPanel.tsx` — Add `activeMode` state, toggle buttons, `AddMembersForm` integration, mode-switching reset logic, pass existing member seat IDs to form
- `e2e/team-members.spec.ts` — Un-skip and rewrite 5 E2E tests for the new modal-first flow (no "Manage Members" intermediate step, form hides on success instead of dialog closing)

### To Be Created
- `src/components/teams/AddMembersForm.tsx` — New component for the inline add members form (search input, seat checkbox list, submission, error handling)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the "Backfill History" button be functional in Story 1.2 or just rendered as a placeholder? | Functional as a toggle — it should switch `activeMode` to `'backfill'` (which hides the Add Members form if active) and switch back when clicked again. No form renders for backfill mode until Story 1.3. | ✅ Resolved |
| 2 | Should the add form close on success automatically or require manual close? | Auto-close (hide form) on success per AC: "Submitting the add members form adds members, refreshes the member list, and hides the form" | ✅ Resolved |
| 3 | Should already-assigned seats be filtered out client-side or server-side? | Client-side. The parent `TeamMembersPanel` already has the `members` array with `seatId` fields. Pass those IDs to `AddMembersForm` to exclude from the available seats list. The POST endpoint uses ON CONFLICT DO NOTHING as a server-side safety net. | ✅ Resolved |
| 4 | Should E2E tests for mode switching between Add and Backfill remain skipped? | Tests that depend on the Backfill History form being functional (`switching to backfill mode from add mode resets add form state`, `switching from backfill to add mode resets backfill form state`) should remain skipped until Story 1.3. | ✅ Resolved |
| 5 | Should the modal-close E2E tests (Escape, overlay) be un-skipped in Story 1.2? | Yes — they test generic members modal close behavior, not backfill-specific functionality. They need updating to remove the "Manage Members" step and work with the modal-first flow. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add action buttons and mode state to TeamMembersPanel

#### Task 1.1 - [MODIFY] Add `activeMode` state and toggle buttons to TeamMembersPanel
**Description**: Add an `activeMode` state variable of type `'add' | 'backfill' | null` to `TeamMembersPanel`. Render two toggle buttons ("Add Members" and "Backfill History") in the normal render path of the modal, between the month label and the member list (or empty state). The buttons use a toggle pattern: clicking an active button deactivates it (`setActiveMode(null)`); clicking an inactive button activates it (`setActiveMode('add')` or `setActiveMode('backfill')`).

Changes to `src/components/teams/TeamMembersPanel.tsx`:
1. Add state: `const [activeMode, setActiveMode] = useState<'add' | 'backfill' | null>(null);`
2. After the month label `<p>` and before the remove error banner, insert a `<div className="flex gap-3 mb-4">` containing two buttons:
   - "Add Members" button: `onClick={() => setActiveMode(activeMode === 'add' ? null : 'add')}`, styled with `bg-blue-600` when active and `border border-gray-300 text-gray-700` when inactive
   - "Backfill History" button: same toggle pattern for `'backfill'`
3. The buttons should not appear in the loading or error render paths — only in the normal (successful) render path.

**Definition of Done**:
- [x] `activeMode` state exists with type `'add' | 'backfill' | null`, initialized to `null`
- [x] "Add Members" and "Backfill History" buttons render above the member list in the normal render path
- [x] Clicking "Add Members" when inactive sets `activeMode` to `'add'`
- [x] Clicking "Add Members" when active sets `activeMode` to `null`
- [x] Clicking "Backfill History" when inactive sets `activeMode` to `'backfill'`
- [x] Clicking "Backfill History" when active sets `activeMode` to `null`
- [x] Clicking one button while the other is active switches the mode (e.g., `'add'` → clicking "Backfill History" → `'backfill'`)
- [x] Active button has visually distinct styling (primary/filled vs. secondary/outlined)
- [x] Buttons are not rendered in loading or error states
- [x] TypeScript compiles without errors

### Phase 2: Create AddMembersForm component

#### Task 2.1 - [CREATE] AddMembersForm component with seat fetching, search, selection, and submission
**Description**: Create a new component at `src/components/teams/AddMembersForm.tsx` that renders the inline add members form. The component handles its own state for fetching available seats, filtering them, searching, selecting via checkboxes, and submitting the selection.

Props interface:
```typescript
interface AddMembersFormProps {
  teamId: number;
  existingMemberSeatIds: number[];
  onMembersAdded: () => void;
}
```

Internal state:
- `availableSeats: SeatOption[]` — fetched from API, filtered to exclude existing members
- `isLoadingSeats: boolean` — loading state for seat fetch
- `seatFetchError: string | null` — error message if seat fetch fails
- `searchQuery: string` — search input value
- `selectedSeatIds: Set<number>` — checked seat IDs
- `isSubmitting: boolean` — submission loading state
- `submitError: string | null` — error message if submission fails

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
1. **On mount**: Fetch `GET /api/seats?status=active&pageSize=300`. Map response to `SeatOption[]`. Filter out seats whose IDs are in `existingMemberSeatIds`.
2. **Search**: Filter `availableSeats` by matching `searchQuery` against `githubUsername`, `firstName`, and `lastName` (case-insensitive contains).
3. **Selection**: Each seat row has a checkbox with `aria-label="Select {githubUsername}"`. Toggling updates `selectedSeatIds`.
4. **Empty state**: If no seats remain after filtering out existing members, show "All active seats are already assigned to this team."
5. **Submit**: "Add Selected ({count})" button, disabled when `selectedSeatIds.size === 0` or `isSubmitting`. On click, POST `{ seatIds: [...selectedSeatIds] }` to `/api/teams/{teamId}/members`. On success (status 201), call `onMembersAdded()`. On error, set `submitError`.
6. **Error states**: Seat fetch error shows an alert with "Retry" button. Submit error shows an alert above the submit button.
7. **Form heading**: Render `<h3 className="text-sm font-semibold text-gray-900 mb-3">Add Members</h3>` at the top of the form area.

Styling pattern: Follow the project's existing Tailwind patterns visible in `TeamMembersPanel.tsx` and `TeamManagementPanel.tsx` — `rounded-lg border border-gray-200 bg-white p-4`, error banners with `bg-red-50 p-4 text-sm text-red-700 border border-red-200`, buttons with `bg-blue-600 px-4 py-2 text-sm font-medium text-white`.

**Definition of Done**:
- [x] `src/components/teams/AddMembersForm.tsx` exists with the `AddMembersFormProps` interface
- [x] On mount, the component fetches active seats from `GET /api/seats?status=active&pageSize=300`
- [x] Seats already in `existingMemberSeatIds` are excluded from the displayed list
- [x] A search input filters the seat list by githubUsername, firstName, lastName (case-insensitive)
- [x] Each available seat renders a checkbox with `aria-label="Select {githubUsername}"`
- [x] Checking/unchecking a seat updates the selected set
- [x] "Add Selected ({count})" button is disabled when no seats are selected or while submitting
- [x] Submitting sends POST `{ seatIds }` to `/api/teams/{teamId}/members`
- [x] On success (status 201), `onMembersAdded()` is called
- [x] Seat fetch error displays an alert with "Retry" button within the form area
- [x] Submit error displays an alert within the form area
- [x] Empty state ("All active seats are already assigned to this team") displays when no unassigned seats exist
- [x] While seats are loading, "Loading available seats…" is displayed
- [x] Form heading "Add Members" renders as `<h3>`
- [x] TypeScript compiles without errors

### Phase 3: Integrate AddMembersForm and wire up mode switching

#### Task 3.1 - [MODIFY] Render AddMembersForm conditionally in TeamMembersPanel
**Description**: In the normal render path of `TeamMembersPanel`, render the `AddMembersForm` component between the toggle buttons and the member list when `activeMode === 'add'`. Pass `teamId`, `existingMemberSeatIds` (derived from the `members` state array), and an `onMembersAdded` callback that refreshes the member list and hides the form.

Changes to `src/components/teams/TeamMembersPanel.tsx`:
1. Import `AddMembersForm` from `./AddMembersForm`
2. Compute `existingMemberSeatIds`: `members.map(m => m.seatId)`
3. Define handler: `handleMembersAdded` → `fetchMembers()` then `setActiveMode(null)`
4. After the toggle buttons `<div>` and before the remove error banner, conditionally render: `{activeMode === 'add' && <AddMembersForm teamId={teamId} existingMemberSeatIds={existingMemberSeatIds} onMembersAdded={handleMembersAdded} />}`
5. Add a placeholder comment for Story 1.3: `{activeMode === 'backfill' && null /* Story 1.3: BackfillHistoryForm */}`

**Definition of Done**:
- [x] `AddMembersForm` is imported and rendered when `activeMode === 'add'`
- [x] `existingMemberSeatIds` is correctly derived from the `members` state array
- [x] `onMembersAdded` callback refreshes the member list via `fetchMembers()` and sets `activeMode` to `null`
- [x] The form renders between the buttons and the member list (member list remains visible below)
- [x] A placeholder comment exists for Story 1.3 backfill form
- [x] TypeScript compiles without errors

#### Task 3.2 - [MODIFY] Reset form state when switching modes
**Description**: Ensure that switching from `'add'` to `'backfill'` (or vice versa) unmounts the `AddMembersForm`, which naturally resets its internal state (search query, selected seats, errors). This happens automatically because React unmounts the component when `activeMode` changes away from `'add'`. Verify this behavior is correct and no additional reset logic is needed.

Since `AddMembersForm` manages its own state internally and is conditionally rendered based on `activeMode`, switching modes causes React to unmount and remount the component, which resets all state. No explicit reset function is needed.

The toggle logic already handles this: clicking "Backfill History" while "Add Members" is active sets `activeMode` to `'backfill'`, which unmounts `AddMembersForm`. When the user clicks "Add Members" again, a fresh instance mounts with default state.

**Definition of Done**:
- [x] Switching from `'add'` to `'backfill'` unmounts `AddMembersForm` (search query, selections, errors reset)
- [x] Switching from `'add'` to `null` (clicking "Add Members" again) unmounts `AddMembersForm`
- [x] Re-activating `'add'` mode after deactivation shows a fresh form (empty search, no selections)
- [x] No explicit reset functions are needed — React unmount/remount handles state reset

### Phase 4: Un-skip and update E2E tests

#### Task 4.1 - [MODIFY] Un-skip and rewrite "can add one or more seats to a team" E2E test
**Description**: Un-skip this test and rewrite it for the new modal-first flow. The old test clicked "Manage Members" to open a nested modal, then clicked "Add Members" inside that dialog. The new flow is:
1. Click "Members" → modal opens directly
2. Click "Add Members" button at the top of the modal → form appears inline
3. Select seats via checkboxes
4. Click "Add Selected" → form hides, members appear in the table below
5. Modal stays open (assert members are visible in the modal's member table)

Key changes:
- Remove `await page.getByRole("button", { name: /manage members/i }).click()` step
- The dialog is already open after clicking "Members" (Story 1.1)
- After submit, assert form is hidden but modal stays open (`dialog` is still visible)
- Assert members appear in the members table within the modal

**Definition of Done**:
- [x] Test is un-skipped (`test.skip` → `test`)
- [x] Test does NOT reference "Manage Members" button
- [x] Test clicks "Add Members" directly within the already-open members modal
- [x] After submission, the test verifies added members appear in the members table
- [x] After submission, the test verifies the modal remains open
- [x] After submission, the test verifies the Add Members form is no longer visible
- [ ] Test passes in CI

#### Task 4.2 - [MODIFY] Un-skip and rewrite "a seat can belong to multiple teams" E2E test
**Description**: Un-skip and rewrite this test for the modal-first flow. The old test used "Manage Members" and "Back to Teams" buttons. The new flow is:
1. Click "Members" on first team → modal opens
2. Click "Add Members" → select seat → submit
3. Close modal (press Escape or click close button)
4. Click "Members" on second team → new modal opens
5. Click "Add Members" → select same seat → submit
6. Verify seat is in both teams via DB check

Key changes:
- Remove "Manage Members" and "Back to Teams" button references
- Close modal via Escape key or close button between team interactions
- Verify members after submit within the modal (before closing)

**Definition of Done**:
- [x] Test is un-skipped (`test.skip` → `test`)
- [x] Test does NOT reference "Manage Members" or "Back to Teams" buttons
- [x] Test closes the members modal (via Escape or close button) between team interactions
- [x] Test verifies the seat is added to both teams
- [ ] Test passes in CI

#### Task 4.3 - [MODIFY] Un-skip and rewrite "already-assigned seat is handled gracefully" E2E test
**Description**: Un-skip and rewrite this test. The old test used "Manage Members" to open the add flow. The new flow:
1. Click "Members" on the team row → modal opens, alice is shown in member list
2. Click "Add Members" → form loads available seats
3. Since alice is the only active seat and she's already assigned, verify "All active seats are already assigned" message appears

Key changes:
- Remove "Manage Members" button reference
- Click "Add Members" directly in the modal

**Definition of Done**:
- [x] Test is un-skipped (`test.skip` → `test`)
- [x] Test does NOT reference "Manage Members" button
- [x] Test clicks "Add Members" directly within the modal
- [x] Test verifies the "all active seats are already assigned" message
- [ ] Test passes in CI

#### Task 4.4 - [MODIFY] Un-skip and rewrite modal close E2E tests (Escape and overlay)
**Description**: Un-skip the "pressing Escape closes the members modal" and "clicking overlay closes the members modal" E2E tests. These were skipped because they used the old "Manage Members" flow. In the new flow, these simply test that the members modal can be closed. Rewrite them to:
1. Click "Members" → modal opens
2. Optionally activate Add Members mode (to verify closing works even with form active)
3. Press Escape / click overlay → modal closes
4. Verify no error state remains

**Definition of Done**:
- [x] Both tests are un-skipped (`test.skip` → `test`)
- [x] Tests do NOT reference "Manage Members" button
- [x] "pressing Escape" test verifies modal closes when Escape is pressed
- [x] "clicking overlay" test verifies modal closes when overlay is clicked
- [x] Tests verify no side effects remain after closing
- [ ] Tests pass in CI

### Phase 5: Code review

#### Task 5.1 - Code review by `tsh-code-reviewer` agent
**Description**: Full code review of all changes made in phases 1–4 using the `tsh-code-reviewer` agent.

**Definition of Done**:
- [ ] All new and modified files reviewed (`AddMembersForm.tsx`, `TeamMembersPanel.tsx`, `team-members.spec.ts`)
- [ ] No critical or high-severity issues remaining
- [ ] Code follows existing project patterns and conventions (Tailwind styling, error handling, API interaction patterns)
- [ ] Component interface between `AddMembersForm` and `TeamMembersPanel` is clean and minimal

## Security Considerations

- **No new API endpoints**: Reuses existing `POST /api/teams/[id]/members` and `GET /api/seats` endpoints, both of which are protected by `requireAuth()` middleware.
- **Server-side validation**: Seat IDs are validated on the server (existence check via DB query). The `teamMembersSeatIdsSchema` Zod schema enforces that seatIds is a non-empty array of positive integers (max 100).
- **Idempotent inserts**: The `ON CONFLICT DO NOTHING` clause prevents duplicate snapshot insertion even if the client-side filter misses an already-assigned seat.
- **No XSS surface**: All dynamic content (seat usernames, names, error messages) is rendered via React JSX auto-escaping. No `dangerouslySetInnerHTML` is used.
- **ARIA accessibility**: Seat checkboxes use `aria-label="Select {githubUsername}"` for screen reader support. Form heading uses semantic `<h3>`. Error alerts use `role="alert"`. The Add Members button toggle is accessible via keyboard (standard `<button>` elements).

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] "Add Members" and "Backfill History" buttons are visible at the top of the members modal, above the member list
- [ ] Buttons use a toggle pattern: clicking an active button deactivates it and hides the form
- [ ] Clicking "Add Members" shows the add members form inline between the buttons and the member list
- [ ] The add members form includes a search input and seat checkbox list
- [ ] Submitting the add members form adds members, refreshes the member list, and hides the form
- [ ] Add members error messages display within the form area inside the modal
- [ ] The member list remains visible below the form at all times (the form does not replace the member list)
- [ ] Switching from one mode to another resets the previously active form's state
- [ ] While seats are loading in the form, "Loading available seats…" is displayed
- [ ] If seat fetch fails, a retry option is available within the form
- [ ] When all active seats are already assigned, an appropriate message is shown
- [ ] "Add Selected" button shows the count of selected seats and is disabled when none are selected
- [ ] E2E tests for add members flow pass
- [ ] E2E tests for modal close (Escape, overlay) pass
- [ ] TypeScript compiles without errors
- [ ] All non-skipped E2E tests pass

## Improvements (Out of Scope)

- **Extract member table into a separate component**: `TeamMembersPanel` is growing. The members table (~100 lines of JSX) could be a standalone `TeamMemberTable` component. Not in scope — it's a standalone refactor.
- **Virtualized seat list**: If the organization has hundreds of seats, the checkbox list could benefit from virtualization (e.g., `react-window`). Current `pageSize=300` max should be sufficient for most organizations.
- **Debounced search**: The search filter is applied synchronously on the client-side seat array. For very large seat lists, debouncing the search input would improve performance. Not needed at current scale.
- **Optimistic UI for add members**: Could show the added members immediately in the table before the API responds. Current approach (refresh after success) is simpler and more reliable.
- **Extract BackfillHistoryForm**: Story 1.3 will likely follow the same extraction pattern. Could plan the interface now, but the actual implementation is out of scope.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
