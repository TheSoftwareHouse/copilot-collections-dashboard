````markdown
# Convert "Add Members" and "Backfill History" to a Single Modal Dialog with Mode Selection - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.4 |
| Title | Convert "Add Members" and "Backfill History" flows to a single modal dialog with mode selection |
| Description | Replace the two separate inline "Add Members" and "Backfill History" form cards with a single modal dialog that offers both modes as selectable options, mirroring the current side-by-side button pattern but inside a focused modal view. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Consolidate the two separate inline flows (Add Members and Backfill History) in `TeamMembersPanel.tsx` into a single `<Modal>` with an internal mode selector. The current two-button trigger pattern is replaced by a single "Manage Members" button. Inside the modal, two styled buttons let the user choose between the two operations.

**Key design decisions:**

1. **Single trigger button** — the current "Add Members" and "Backfill History" buttons are replaced by a single "Manage Members" button that opens the modal.

2. **Internal mode selector** — the modal always shows a mode selection section at the top with two styled buttons ("Add Members" and "Backfill History"). The selected mode has a highlighted/active style; the other is muted. Selecting a mode loads the corresponding form content below.

3. **Dynamic title** — the modal title changes based on the active mode: "Team Members" when no mode is selected, "Add Members" when add mode is active, "Backfill History" when backfill mode is active.

4. **State consolidation** — `showAddFlow` and `showBackfillFlow` are replaced by `showMemberModal: boolean` and `activeMode: "add" | "backfill" | null`. Flow-open/close functions are consolidated around mode switching.

5. **Mode switching resets state** — switching from one mode to the other resets the previous mode's form state (selected seats, search query, errors, success messages, date values).

6. **Cancel closes whole modal** — unlike the current inline approach where Cancel only collapses the expanded section, Cancel now closes the entire modal (consistent with modal dismiss behavior from Stories 1.2/1.3).

7. **Success behavior differs by mode** — Add Members success closes the modal entirely. Backfill success stays in the modal and displays the result message (matching the current UX where the user can perform multiple backfills).

8. **No changes to Modal component** — the existing `max-w-lg` width is adequate. The backfill date grid renders as 2 columns at this width (below `sm:640px` breakpoint), which provides a clean compact layout inside the modal.

```
Before:                                   After:
┌───────────────────────────┐             ┌───────────────────────────┐
│ [Add Members] [Backfill]  │             │ [Manage Members]          │
├───────────────────────────┤             └───────────────────────────┘
│ ┌─ Inline Add Card ─────┐│
│ │ <h3>Add Members</h3>  ││                        ▼ click
│ │ search, seats, add btn ││
│ └────────────────────────┘│             ┌─ Modal ────────────────────┐
│                           │             │ Team Members          [×]  │
│ ┌─ Inline Backfill Card ─┐│            ├─────────────────────────────┤
│ │ <h3>Backfill Hist</h3> ││            │ [● Add Members] [Backfill] │  ← mode tabs
│ │ dates, seats, btn      ││            ├─────────────────────────────┤
│ └────────────────────────┘│            │                             │
└───────────────────────────┘            │ (active mode's form)        │
                                         │                             │
                                         └─────────────────────────────┘
```

**Modal dismissal mapping:**
- Cancel button (in either mode) → `closeMemberModal()`
- Escape key → Modal built-in → `onClose` → `closeMemberModal()`
- Overlay click → Modal built-in → `onClose` → `closeMemberModal()`
- Add success → `closeMemberModal()` + `fetchMembers()`
- Backfill success → stays open, shows message, calls `fetchMembers()`

## Current Implementation Analysis

### Already Implemented
- `Modal` — `src/components/shared/Modal.tsx` — Reusable modal with backdrop, focus trap, Escape/overlay-click dismiss, portal rendering, `aria-modal`, and `aria-labelledby`. Created in Story 1.1.
- `ModalProvider` — `src/components/shared/ModalProvider.tsx` — Context for single-modal enforcement. Mounted in root layout via `Providers.tsx`. Created in Story 1.1.
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — Full panel (953 lines) with Add Members flow (lines 93–272, 492–610), Backfill History flow (lines 99–110, 280–415, 638–860), member table, remove/retire/purge actions.
- Add Members flow logic — `openAddFlow()`, `closeAddFlow()`, `toggleSeatSelection()`, `handleAddSelected()`, seat filtering, API call to `POST /api/teams/:id/members`.
- Backfill History flow logic — `openBackfillFlow()`, `closeBackfillFlow()`, `toggleBackfillSeatSelection()`, `handleBackfillSubmit()`, date validation (`isStartAfterEnd`, `isFutureMonth`), API call to `POST /api/teams/:id/members/backfill`.
- E2E tests — `e2e/team-members.spec.ts` — 659 lines covering add members, remove members, retire/purge, backfill history with date validation, idempotency, and mutual exclusivity of flows.
- E2E modal tests — `e2e/modal.spec.ts` — Generic modal behavior tests (overlay, Escape, focus trap, ARIA).
- Tailwind CSS 4 — Used throughout for styling.

### To Be Modified
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — Import `Modal`. Consolidate `showAddFlow`/`showBackfillFlow` into `showMemberModal`/`activeMode`. Replace two trigger buttons with single "Manage Members" button. Replace two inline sections with `<Modal>` containing mode selector and conditional form content. Update cancel/success handlers to use modal close.
- `e2e/team-members.spec.ts` — Update all tests that reference "Add Members" or "Backfill History" buttons as direct trigger actions. Scope form interactions to dialog locator. Update the `openBackfillFlow` helper. Rewrite "opening backfill flow closes add members flow" test as a mode-switching test. Add new modal-specific tests.

### To Be Created
Nothing new — all building blocks exist. This story only modifies existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should a mode be pre-selected when the modal opens? | No. The modal opens with no mode selected, showing the two mode options. The user selects the desired operation. This matches the story requirement: "The modal presents two selectable options." | ✅ Resolved |
| 2 | What should the trigger button label be? | "Manage Members" — it encompasses both operations and is distinct from the existing "Members" button (which opens the panel). | ✅ Resolved |
| 3 | Is `max-w-lg` sufficient for the backfill date grid? | Yes. At 512px modal width (~464px content area), the `grid-cols-2 sm:grid-cols-4` grid renders as 2 columns (below `sm:640px` breakpoint). This is a clean, compact layout. If a 4-column layout is desired, widening the modal is an out-of-scope improvement. | ✅ Resolved |
| 4 | Should the mode selector look like tabs or buttons? | Styled as button-like segments with `aria-pressed` for accessibility. The active mode gets a highlighted style (e.g., `bg-blue-600 text-white`), the inactive one gets a muted style (e.g., `border border-gray-300 text-gray-700`). | ✅ Resolved |
| 5 | Does backfill success still keep the modal open? | Yes. The AC states: "submitting triggers the backfill and refreshes the member list." The success message should display within the modal. This allows the user to perform multiple backfill operations without reopening the modal. | ✅ Resolved |
| 6 | Does the Cancel button in each mode close the entire modal or just reset the mode? | Closes the entire modal, per the AC: "Cancel or Escape closes the modal without performing any action." | ✅ Resolved |

## Implementation Plan

### Phase 1: Refactor TeamMembersPanel State and Handlers

#### Task 1.1 - [MODIFY] Consolidate flow state into modal + mode state
**Description**: In `src/components/teams/TeamMembersPanel.tsx`, replace the `showAddFlow` and `showBackfillFlow` boolean state variables with `showMemberModal: boolean` and `activeMode: "add" | "backfill" | null`. Create unified handler functions:

- `openMemberModal()` — sets `showMemberModal(true)`, `activeMode(null)`.
- `closeMemberModal()` — resets ALL add and backfill state (selected seats, search queries, errors, success, dates), sets `showMemberModal(false)`, `activeMode(null)`.
- `selectAddMode()` — sets `activeMode("add")`, resets backfill state (selected seats, search, errors, success, dates), loads available seats (same logic as current `openAddFlow`).
- `selectBackfillMode()` — sets `activeMode("backfill")`, resets add state (selected seats, search, errors), loads backfill seats (same logic as current `openBackfillFlow`).

Remove the `openAddFlow`, `closeAddFlow`, `openBackfillFlow`, `closeBackfillFlow` functions. Update `handleAddSelected` to call `closeMemberModal()` on success instead of `closeAddFlow()`. Update `handleBackfillSubmit` — on success, it clears selected seats and shows success message (stays in modal, no change needed other than not calling a close function).

**Definition of Done**:
- [x] `showAddFlow` and `showBackfillFlow` state variables are removed
- [x] `showMemberModal` (boolean) and `activeMode` (`"add" | "backfill" | null`) state variables are added
- [x] `openMemberModal()` function is created — sets modal visible, mode to `null`
- [x] `closeMemberModal()` function is created — resets all add and backfill state, closes modal
- [x] `selectAddMode()` function is created — sets mode to `"add"`, resets backfill state, loads seats
- [x] `selectBackfillMode()` function is created — sets mode to `"backfill"`, resets add state, loads backfill seats
- [x] `openAddFlow`, `closeAddFlow`, `openBackfillFlow`, `closeBackfillFlow` functions are removed
- [x] `handleAddSelected` success branch calls `closeMemberModal()` + `fetchMembers()` instead of `closeAddFlow()` + `fetchMembers()`
- [x] `handleBackfillSubmit` success branch clears `backfillSelectedSeatIds` and shows success message (stays in modal — no close call)
- [x] No TypeScript errors (`npx tsc --noEmit`)

#### Task 1.2 - [MODIFY] Replace trigger buttons and inline forms with Modal + mode selector
**Description**: In the JSX of `TeamMembersPanel.tsx`:

1. **Replace the two trigger buttons** (`<div className="flex gap-3">` containing "Add Members" and "Backfill History" buttons) with a single "Manage Members" button that calls `openMemberModal()`.

2. **Remove the two inline sections** — the `{showAddFlow ? <div card>…</div> : null}` block and the `{showBackfillFlow && <div card>…</div>}` block.

3. **Add a `<Modal>` component** after the trigger button:
   ```tsx
   <Modal
     isOpen={showMemberModal}
     onClose={closeMemberModal}
     title={activeMode === "add" ? "Add Members" : activeMode === "backfill" ? "Backfill History" : "Team Members"}
   >
     {/* Mode selector */}
     <div className="mb-4 flex gap-2">
       <button
         type="button"
         onClick={selectAddMode}
         aria-pressed={activeMode === "add"}
         className={activeMode === "add" ? "active-style" : "inactive-style"}
       >
         Add Members
       </button>
       <button
         type="button"
         onClick={selectBackfillMode}
         aria-pressed={activeMode === "backfill"}
         className={activeMode === "backfill" ? "active-style" : "inactive-style"}
       >
         Backfill History
       </button>
     </div>

     {/* Active mode form content */}
     {activeMode === "add" && <AddMembersContent />}
     {activeMode === "backfill" && <BackfillContent />}
   </Modal>
   ```

4. **Style the mode selector buttons**:
   - Active mode: `rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white`
   - Inactive mode: `rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50`

5. **Move form content into the modal** — the existing form JSX (search input, seat checkbox list, action buttons for add; date selectors, search, seat list, action buttons for backfill) is rendered inside the modal conditionally based on `activeMode`. Remove the `<h3>` headings from both form sections (the Modal title already indicates the active mode). Remove the outer `<div className="rounded-lg border…">` card wrappers.

6. **Update Cancel buttons** in both modes to call `closeMemberModal()` instead of `closeAddFlow()`/`closeBackfillFlow()`.

**Definition of Done**:
- [x] `Modal` is imported from `@/components/shared/Modal`
- [x] The two separate trigger buttons ("Add Members" and "Backfill History") are replaced by a single "Manage Members" button
- [x] The "Manage Members" button is rendered unconditionally (not toggled based on flow state)
- [x] The `<Modal>` wraps the mode selector and form content with `isOpen={showMemberModal}`, `onClose={closeMemberModal}`, and dynamic `title`
- [x] The mode selector section renders two styled buttons ("Add Members" and "Backfill History") with `aria-pressed` attributes
- [x] The active mode button has a visually distinct highlighted style (blue background, white text)
- [x] Selecting "Add Members" reveals the search input, seat checkbox list, and Add Selected/Cancel buttons
- [x] Selecting "Backfill History" reveals the date range selectors, search input, seat checkbox list, and Backfill Selected/Cancel buttons
- [x] The inline `<h3>` headings ("Add Members", "Backfill History") are removed from form sections
- [x] The inline card wrappers (`<div className="rounded-lg border…">`) are removed from form sections
- [x] The scrollable seat list (`max-h-64 overflow-y-auto`) is preserved and scrolls within the modal
- [x] Cancel buttons in both modes call `closeMemberModal()`
- [x] The shaded backdrop overlay is visible behind the modal
- [x] Existing member table, remove/retire/purge flows are NOT affected
- [x] The application compiles with no TypeScript errors (`npx tsc --noEmit`)
- [x] ESLint passes (`npm run lint`)

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update add-members E2E tests for modal interaction
**Description**: In `e2e/team-members.spec.ts`, update all tests in the "Team Member Management" describe block that interact with the Add Members flow. Each test that currently clicks `page.getByRole("button", { name: /add members/i })` must now:

1. Click `page.getByRole("button", { name: /manage members/i })` to open the modal.
2. Assert `page.getByRole("dialog")` is visible.
3. Click the "Add Members" mode button inside the dialog.
4. Scope all subsequent interactions to the dialog locator (e.g., `dialog.getByLabel(…)`).
5. On success, assert the dialog closes (`await expect(dialog).not.toBeVisible()`).

Affected tests:
- "can add one or more seats to a team"
- "a seat can belong to multiple teams"
- "already-assigned seat is handled gracefully"

**Definition of Done**:
- [x] "can add one or more seats to a team" opens the modal, selects "Add Members" mode, interacts within dialog scope, asserts dialog closes on success
- [x] "a seat can belong to multiple teams" opens the modal for each team, selects "Add Members" mode, interacts within dialog scope
- [x] "already-assigned seat is handled gracefully" opens the modal, selects "Add Members" mode, asserts "all active seats are already assigned" within dialog scope
- [x] All three tests assert `page.getByRole("dialog")` is visible after clicking "Manage Members"
- [x] All three tests assert `page.getByTestId("modal-overlay")` is visible when modal is open
- [x] The modal title "Add Members" is verified in at least one test via `dialog.getByRole("heading", { name: /add members/i })`
- [x] Existing remove/retire/purge tests pass without modification
- [x] All updated tests pass

#### Task 2.2 - [MODIFY] Update backfill history E2E tests for modal interaction
**Description**: In `e2e/team-members.spec.ts`, update all tests in the "Team Member Backfill History" describe block. The `openBackfillFlow` helper function must be refactored to:

1. Navigate to the team's members panel.
2. Click `page.getByRole("button", { name: /manage members/i })`.
3. Assert `page.getByRole("dialog")` is visible.
4. Click the "Backfill History" mode button inside the dialog.
5. Return or scope to the dialog locator.

All backfill tests that interact with form elements must scope their locators to the dialog. Tests that assert headings (e.g., "Backfill History") must look inside the dialog.

Affected tests:
- "can open backfill flow, select date range and seats, submit, and see success message"
- "backfill across multiple months creates snapshots for each month"
- "shows validation error when start date is after end date"
- "shows validation error when end date is in the future"
- "backfill is idempotent — re-submitting same range shows added: 0"
- "cancel button closes backfill flow"

The "cancel button closes backfill flow" test should be updated: Cancel now closes the entire modal. Assert `dialog` is not visible after clicking Cancel.

**Definition of Done**:
- [x] The `openBackfillFlow` helper function opens the modal, asserts dialog visibility, selects "Backfill History" mode, and returns the dialog locator (or equivalent pattern)
- [x] All backfill tests scope date selector, search, seat selection, and submit interactions to the dialog
- [x] Backfill success/error messages are asserted within the dialog scope
- [x] The "cancel button closes backfill flow" test asserts the dialog is not visible after Cancel (instead of just the heading disappearing)
- [x] The `page.getByTestId("modal-overlay")` is asserted as visible in at least one backfill test
- [x] The modal title "Backfill History" is verified in at least one test via `dialog.getByRole("heading", { name: /backfill history/i })`
- [x] All updated tests pass

#### Task 2.3 - [MODIFY] Rewrite mutual-exclusivity test and add new modal-specific tests
**Description**: In `e2e/team-members.spec.ts`:

1. **Rewrite** the "opening backfill flow closes add members flow" test as a mode-switching test: open modal, select "Add Members" mode, verify add form visible, switch to "Backfill History" mode, verify backfill form visible and add form hidden, verify previous mode's form state was reset (no selected seats carry over).

2. **Add** a new test: "pressing Escape closes the members modal without performing any action" — open modal, select a mode, fill some data, press Escape, assert dialog gone, assert no side effects.

3. **Add** a new test: "clicking overlay closes the members modal without performing any action" — open modal, click overlay at edge, assert dialog gone.

4. **Add** a new test: "switching from backfill to add mode resets backfill form state" — open modal, select backfill mode, change dates, switch to add mode, switch back to backfill mode, verify dates are reset to defaults.

**Definition of Done**:
- [x] "switching to backfill mode from add mode resets add form state" test passes (replaces the old "opening backfill flow closes add members flow" test)
- [x] "pressing Escape closes the members modal without performing any action" test opens modal, selects a mode, presses Escape, asserts dialog is gone
- [x] "clicking overlay closes the members modal without performing any action" test opens modal, clicks overlay at edge, asserts dialog is gone
- [x] "switching from backfill to add mode resets backfill form state" test verifies dates reset when switching modes
- [x] All new tests pass
- [x] All existing tests continue to pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run automated code review on all files modified in this story.

**Definition of Done**:
- [x] `src/components/teams/TeamMembersPanel.tsx` modifications pass code review
- [x] `e2e/team-members.spec.ts` modifications pass code review
- [x] No lint errors (`npm run lint`)
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] All existing unit tests continue to pass (`npm test`)
- [x] All E2E tests pass (`npm run test:e2e`)

## Security Considerations

- **No new attack surface**: This change is purely a UI container swap. No new API endpoints, data flows, or user inputs are introduced. The form content, validation, and server-side handling remain identical.
- **XSS via modal children**: The Modal renders React children (the form content). Since React auto-escapes string content and no `dangerouslySetInnerHTML` is used, this is safe.
- **Focus trap prevents interaction leakage**: The Modal's built-in focus trap ensures keyboard users cannot tab out to page content behind the overlay, preventing accidental interactions with the member table or other controls.
- **Mode state isolation**: Switching modes resets the previous mode's state, preventing stale selections from being submitted inadvertently.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] A single trigger button ("Manage Members") opens one modal dialog for team member operations
- [ ] The modal presents two selectable options: "Add Members" and "Backfill History" as a mode selection section
- [ ] Selecting "Add Members" reveals the search input, seat checkbox list, and Add/Cancel buttons
- [ ] Selecting "Backfill History" reveals the date range selectors, search input, seat checkbox list, and Backfill/Cancel buttons
- [ ] Switching between modes resets the form state of the previously active mode
- [ ] The shaded backdrop overlay is visible behind the modal
- [ ] The scrollable seat list scrolls within the modal container (not the page)
- [ ] In "Add Members" mode: successful member addition closes the modal and refreshes the member list
- [ ] In "Add Members" mode: error messages display within the modal
- [ ] In "Backfill History" mode: date validation messages display within the modal
- [ ] In "Backfill History" mode: success and error messages display within the modal
- [ ] In "Backfill History" mode: submitting triggers the backfill and refreshes the member list
- [ ] Cancel or Escape closes the modal without performing any action
- [ ] Clicking the overlay closes the modal without performing any action
- [ ] All existing E2E tests pass (including remove/retire/purge tests unchanged)
- [ ] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Wider modal for 4-column date grid**: The current `max-w-lg` (512px) renders the backfill date grid as 2 columns. Adding a `maxWidth` prop to the Modal component and using `max-w-2xl` for this modal would allow the 4-column layout. Recommended as a follow-up if UX feedback requires it.
- **Shared seat loading between modes**: Both Add and Backfill modes load seats from the same endpoint (`/api/seats?status=active&pageSize=300`). Loading once when the modal opens and sharing the data would reduce network requests. The add flow filters out already-assigned members, while backfill shows all seats, so the filtering logic differs — but the raw data is the same.
- **Pre-select default mode**: The current design requires the user to select a mode after opening the modal (extra click vs. the current flow). Auto-selecting "Add Members" as the default mode would reduce friction for the more common operation.
- **Tab-based mode navigation**: Replace the button-based mode selector with a proper ARIA tab pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`) for improved accessibility semantics. The current button + `aria-pressed` approach is accessible but tabs would be the ideal pattern for this use case.
- **Confirmation on dirty dismiss**: If a user has selected seats or changed dates and presses Escape or clicks the overlay, the form resets without warning. A "discard changes?" prompt could be added but is explicitly out of scope per the epic requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
| 3 March 2026 | Phase 1 & Phase 2 implemented: state refactoring, JSX replacement with Modal, all 19 E2E tests updated and passing |
| 3 March 2026 | Phase 3 code review completed. Fixed: added focus ring styles to mode selector buttons, added role="group" with aria-label, extracted resetAddState/resetBackfillState helpers. All checks green. |

````
