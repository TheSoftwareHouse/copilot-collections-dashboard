# Story 1.1: Open Team Members Modal Directly from Team Table Row - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Open team members modal directly from team table row |
| Description | Replace the inline `TeamMembersPanel` with a modal dialog that opens directly when clicking "Members" on a team row, removing the intermediate "Manage Members" and "Back to Teams" buttons |
| Priority | High |
| Related Research | `specifications/team-members-modal-refactor/extracted-tasks.md` |

## Proposed Solution

Convert the current two-step team members flow (inline panel → nested modal) into a single-step modal flow. When the user clicks "Members" on a team row, a modal dialog opens immediately showing the member list, loading state, or error state. The team table remains visible behind the modal overlay.

The key architectural change: `TeamMembersPanel` currently renders as an inline `<div>` below the team table. It will be refactored to render its own `<Modal>` wrapper (always open while mounted). Since `TeamManagementPanel` only mounts `TeamMembersPanel` when `managingMembersTeam` is set, the modal appears when the "Members" button is clicked and disappears when the component unmounts (via `onClose` → setting `managingMembersTeam` to `null`).

```
BEFORE (current flow):                          AFTER (story 1.1):
┌──────────────────────────────┐                ┌──────────────────────────────┐
│ TeamManagementPanel          │                │ TeamManagementPanel          │
│ ┌──────────────────────────┐ │                │ ┌──────────────────────────┐ │
│ │ Team Table               │ │                │ │ Team Table (visible      │ │
│ │ [Members] [Delete]       │ │                │ │  behind overlay)         │ │
│ └──────────────────────────┘ │                │ │ [Members] [Delete]       │ │
│                              │                │ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │                │                              │
│ │ TeamMembersPanel (inline)│ │                │ ┌─── Modal ───────────────┐  │
│ │ "Members of X"           │ │                │ │ "Members of X"     [×]  │  │
│ │ [Back to Teams]          │ │                │ │ March 2026              │  │
│ │ [Manage Members] ────────│─│──▶ Modal       │ │                         │  │
│ │ ┌──────────────────────┐ │ │                │ │ ┌─ Members Table ─────┐ │  │
│ │ │ Members Table        │ │ │                │ │ │ Username│Name│Action│ │  │
│ │ │ Username│Name│Action │ │ │                │ │ │ alice   │... │Remove│ │  │
│ │ │ alice   │... │Remove │ │ │                │ │ └────────────────────┘ │  │
│ │ └──────────────────────┘ │ │                │ └────────────────────────┘  │
│ └──────────────────────────┘ │                └──────────────────────────────┘
└──────────────────────────────┘
```

The shared `Modal` component is extended with a `size` prop to accommodate the wider member table (`max-w-3xl` vs. default `max-w-lg`) and a scrollable content area so that when forms are later added (stories 1.2/1.3), the modal body scrolls as a single unit.

### Why TeamMembersPanel owns the Modal (not TeamManagementPanel)

`TeamMembersPanel` has all the internal state needed for the modal's dynamic title, loading body, and error body. Wrapping the component at the parent level would require exposing loading/error states or duplicating render logic. Instead, `TeamMembersPanel` renders `<Modal isOpen={true}>` as its root — the component is only mounted when `managingMembersTeam` is truthy, so the modal opens/closes naturally with mount/unmount.

## Current Implementation Analysis

### Already Implemented
- `Modal` component — `src/components/shared/Modal.tsx` — Portal-based dialog with focus trap, Escape key handler, overlay click-to-close, body scroll lock, `ModalProvider` integration
- `ModalProvider` — `src/components/shared/ModalProvider.tsx` — Single-modal enforcement context
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Team table with "Members" button per row, `managingMembersTeam` state controlling inline panel render
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — 976-line component with member list, loading/error states, remove/retire/purge flow, nested modal for Add/Backfill
- E2E tests — `e2e/team-members.spec.ts` — 775-line test suite covering view, add, remove, retire, purge, backfill, and modal interactions
- Modal unit tests — `src/components/shared/__tests__/Modal.test.ts`

### To Be Modified
- `src/components/shared/Modal.tsx` — Add `size` prop (`"default" | "large"`) for wider modal variant; add max-height constraint and scrollable content area
- `src/components/teams/TeamMembersPanel.tsx` — Wrap all three render paths (loading, error, normal) in `<Modal>` with `size="large"`; remove "Back to Teams" buttons, "Manage Members" button, and nested `<Modal>` with Add/Backfill forms; remove `showMemberModal`/`activeMode` UI state; keep Add/Backfill data-fetching state and handlers for stories 1.2/1.3
- `src/components/shared/__tests__/Modal.test.ts` — Add tests for `size` prop and scrollable content
- `e2e/team-members.spec.ts` — Update view/remove tests for modal flow; skip Add/Backfill tests pending stories 1.2/1.3

### To Be Created
- Nothing — all changes modify existing files

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should Add/Backfill handler code be removed or kept dormant in Story 1.1? | Keep dormant — all state and handler functions remain, only the UI triggers (buttons/nested modal JSX) are removed. Stories 1.2/1.3 will reconnect them by adding inline buttons that call the same `selectAddMode()`/`selectBackfillMode()` handlers. | ✅ Resolved |
| 2 | Should the `showMemberModal` and `activeMode` state variables be removed? | Remove `showMemberModal` (the whole component IS a modal now). Keep `activeMode` — it will be reused by stories 1.2/1.3 to toggle inline forms within the modal body. | ✅ Resolved |
| 3 | What width should the members modal use? | `max-w-3xl` (48rem = 768px) — sufficient for the three-column members table (GitHub Username, Name, Actions) with room for the retire/purge inline confirmation flow. | ✅ Resolved |
| 4 | How should E2E tests for Add/Backfill be handled? | Skip with `test.skip()` and a comment referencing Story 1.2/1.3. These tests will break because the "Manage Members" button is removed. They will be un-skipped and updated when Stories 1.2/1.3 are implemented. | ✅ Resolved |
| 5 | Should the `openMemberModal()`/`closeMemberModal()` functions be removed? | Yes — `openMemberModal()` was triggered by "Manage Members" button (now removed) and `closeMemberModal()` was used when the nested Add/Backfill modal closed. Stories 1.2/1.3 will introduce a simpler toggle pattern with `activeMode` directly. | ✅ Resolved |

## Implementation Plan

### Phase 1: Extend Modal component for wider content and scrollable body

#### Task 1.1 - [MODIFY] Add `size` prop and scrollable content to Modal component
**Description**: Extend `src/components/shared/Modal.tsx` to accept an optional `size` prop that controls the modal's maximum width. Add a viewport-constrained max-height and scrollable content area so the modal body scrolls when content exceeds viewport height. These changes support the members modal (wider content, potentially tall with form + member list) while maintaining backward compatibility for existing default-sized modals.

Changes to `Modal.tsx`:
1. Add `size?: "default" | "large"` to `ModalProps` interface (default: `"default"`)
2. Compute `maxWidthClass` based on `size`: `"default"` → `max-w-lg`, `"large"` → `max-w-3xl`
3. Add `max-h-[calc(100vh-4rem)] flex flex-col` to the dialog container to constrain height
4. Add `flex-shrink-0` to the title bar `<div>` to prevent it from shrinking
5. Add `overflow-y-auto flex-1 min-h-0` to the content `<div>` to enable scrolling

**Definition of Done**:
- [x] `ModalProps` interface includes `size?: "default" | "large"`
- [x] Default-sized modal retains `max-w-lg` (no visual change for existing usages like "Add Team")
- [x] Large-sized modal uses `max-w-3xl`
- [x] Dialog container has `max-h-[calc(100vh-4rem)]` and `flex flex-col`
- [x] Title bar has `flex-shrink-0` to stay fixed
- [x] Content area has `overflow-y-auto flex-1 min-h-0` for scrollable body
- [x] All existing Modal functionality (focus trap, Escape, overlay click, body scroll lock, ModalProvider) is unaffected

#### Task 1.2 - [MODIFY] Update Modal unit tests for `size` prop
**Description**: Add unit tests to `src/components/shared/__tests__/Modal.test.ts` covering the new `size` prop behaviour.

**Definition of Done**:
- [x] Test verifies that omitting `size` renders with `max-w-lg` class (backward compatibility)
- [x] Test verifies that `size="large"` renders with `max-w-3xl` class
- [x] Test verifies that the content area has `overflow-y-auto` class
- [x] All existing Modal tests pass without modification

### Phase 2: Refactor TeamMembersPanel from inline panel to modal content

#### Task 2.1 - [MODIFY] Remove nested Modal, "Manage Members" button, and `showMemberModal` state
**Description**: In `src/components/teams/TeamMembersPanel.tsx`, remove the UI elements related to the nested manage-members modal pattern:
1. Remove `showMemberModal` state variable and `openMemberModal()` / `closeMemberModal()` functions
2. Remove the "Manage Members" `<button>` (lines ~494–501)
3. Remove the entire nested `<Modal isOpen={showMemberModal}>` block and all its children (the mode selector buttons and Add/Backfill form JSX) — approximately lines 505–860
4. Keep `activeMode` state, `selectAddMode()`, `selectBackfillMode()`, `resetAddState()`, `resetBackfillState()`, and all Add/Backfill data-fetching/submission handlers. These are dormant in Story 1.1 and will be reconnected in Stories 1.2/1.3.
5. Update `handleAddSelected()` success path: replace `closeMemberModal()` call with `resetAddState()` and `setActiveMode(null)` (prepares for 1.2 where success hides the form).

**Definition of Done**:
- [x] `showMemberModal` state is removed
- [x] `openMemberModal()` and `closeMemberModal()` functions are removed
- [x] "Manage Members" button JSX is removed
- [x] Nested `<Modal>` with mode selector, Add form JSX, and Backfill form JSX is removed
- [x] `activeMode` state, `selectAddMode()`, `selectBackfillMode()`, and all Add/Backfill data handlers are preserved
- [x] TypeScript compiles without errors

#### Task 2.2 - [MODIFY] Wrap all render paths in outer `<Modal>` and remove "Back to Teams" buttons
**Description**: Refactor the three render paths of `TeamMembersPanel` (loading, error, normal) to each return a `<Modal isOpen={true} onClose={onClose} title={`Members of ${teamName}`} size="large">` wrapper instead of inline `<div>` containers. Remove the "Back to Teams" buttons (error state and header). Simplify the header area — the modal title handles the team name display, so the `<h2>` and `<div className="flex items-center justify-between">` wrapper in the normal render path become unnecessary.

Specific changes:
1. **Loading path** — replace the `<div>` wrapper with `<Modal ... size="large"><p className="text-sm text-gray-500">Loading members…</p></Modal>`
2. **Error path** — replace the `<div>` wrapper with `<Modal ... size="large">` containing the error alert and Retry button. Remove "Back to Teams" button from this path.
3. **Normal path** — replace `<div className="space-y-4">` wrapper with `<Modal ... size="large">`. The modal title displays the team name. Render month label as the first child element (`<p>Members for {monthLabel}</p>`). Remove the header `<div>` with the `<h2>` and "Back to Teams" button. Keep the remove error banner, member list table, and empty state.

**Definition of Done**:
- [x] Loading state renders inside `<Modal isOpen={true} onClose={onClose} title="Members of {teamName}" size="large">` with "Loading members…" text
- [x] Error state renders inside `<Modal>` with error alert and Retry button only (no "Back to Teams" button)
- [x] Normal state renders inside `<Modal>` with month label, remove error banner, and member list
- [x] The standalone inline header `<h2>Members of {teamName}</h2>` is removed (replaced by Modal title prop)
- [x] Both "Back to Teams" buttons are removed (error and normal render paths)
- [x] Empty state message ("This team has no members for {month}") renders inside the modal
- [x] Remove/retire/purge inline confirmation flow works inside the modal
- [x] The component always renders exactly one `<Modal>` as its root element
- [x] TypeScript compiles without errors

### Phase 3: Update E2E tests for modal-first flow

#### Task 3.1 - [MODIFY] Update member view and remove/retire/purge E2E tests
**Description**: Update E2E tests in `e2e/team-members.spec.ts` that test member viewing, empty state, and remove/retire/purge flows. These tests click "Members", then interact with the member panel. After the refactor, clicking "Members" opens a modal dialog. Most locators (table, heading, buttons) should work without changes since they search the whole page including the modal. Verify each test passes and adjust locators if needed.

Tests to verify/update:
- `can view members panel for a team (shows empty state)` — clicking "Members" now opens a modal. The heading "Members of Engineering" is still an `<h2>` (Modal title). The `getByText(/no members/i)` locator works inside the modal. Likely passes as-is.
- `can remove a seat from a team` — table and button locators work inside the modal. Likely passes as-is.
- `retire removes current month only, preserving historical snapshots` — same pattern. Likely passes as-is.
- `purge flow shows impact count and requires explicit confirmation` — same pattern. Likely passes as-is.
- `purge removes member from ALL months` — same pattern. Likely passes as-is.
- `cancelling purge confirmation returns to normal state` — same pattern. Likely passes as-is.

For the `a seat can belong to multiple teams` test: this test uses "Back to Teams" button (line 364) to navigate back after adding a member to the first team. After refactor, the "Back to Teams" button is gone — the user closes the modal (press Escape or click overlay) to return to the team list. Update this test to close the modal (e.g., press Escape or click the modal close button) instead of clicking "Back to Teams". Also, this test uses "Manage Members" (stories 1.2/1.3 dependency), so it should be skipped (handled in Task 3.2).

**Definition of Done**:
- [x] `can view members panel for a team (shows empty state)` test passes
- [x] `can remove a seat from a team` test passes
- [x] `retire removes current month only, preserving historical snapshots` test passes
- [x] `purge flow shows impact count and requires explicit confirmation` test passes
- [x] `purge removes member from ALL months` test passes
- [x] `cancelling purge confirmation returns to normal state` test passes
- [x] No references to "Back to Teams" button in any active (non-skipped) test

#### Task 3.2 - [MODIFY] Skip E2E tests that depend on Add/Backfill UI
**Description**: Tests that interact with the "Manage Members" button or the Add Members / Backfill History modal flows will fail after Story 1.1 removes those UI elements. Skip these tests with `test.skip()` and add a clear comment explaining which story will un-skip them.

Tests to skip:
- `can add one or more seats to a team` — uses "Manage Members" button → skip with `// TODO: Un-skip in Story 1.2 — Add Members button moves to modal top`
- `a seat can belong to multiple teams` — uses "Manage Members" and "Back to Teams" → skip with `// TODO: Un-skip in Story 1.2`
- `already-assigned seat is handled gracefully` — uses "Manage Members" → skip with `// TODO: Un-skip in Story 1.2`
- `can open backfill flow, select date range and seats, submit, and see success message` — uses `openBackfillFlow` helper with "Manage Members" → skip with `// TODO: Un-skip in Story 1.3`
- `backfill across multiple months creates snapshots for each month` — same → skip
- `shows validation error when start date is after end date` — same → skip
- `shows validation error when end date is in the future` — same → skip
- `backfill is idempotent — re-submitting same range shows added: 0` — same → skip
- `cancel button closes the members modal` — same → skip
- `switching to backfill mode from add mode resets add form state` — same → skip with `// TODO: Un-skip in Story 1.2/1.3`
- `pressing Escape closes the members modal without performing any action` — same → skip
- `clicking overlay closes the members modal without performing any action` — same → skip
- `switching from backfill to add mode resets backfill form state` — same → skip

**Definition of Done**:
- [x] All tests that reference "Manage Members" button are wrapped with `test.skip()`
- [x] Each skipped test has a comment indicating which story (1.2 or 1.3) will un-skip it
- [x] All non-skipped tests pass
- [x] The `openBackfillFlow` helper function is not modified (it's only used by skipped tests)

### Phase 4: Code review

#### Task 4.1 - Code review by `tsh-code-reviewer` agent
**Description**: Full code review of all changes made in phases 1–3 using the `tsh-code-reviewer` agent.

**Definition of Done**:
- [x] All modified files reviewed
- [x] No critical or high-severity issues remaining
- [x] Code follows existing project patterns and conventions

## Security Considerations

- **No new API endpoints or data changes**: This is a pure UI container refactor — all API interactions remain identical.
- **Modal accessibility preserved**: The shared `Modal` component already implements ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), focus trap, and Escape key handling. The refactored `TeamMembersPanel` inherits all these properties.
- **Focus management**: When the modal opens, focus moves into the dialog (handled by `Modal`). When it closes, focus restores to the previously focused element (the "Members" button). This prevents focus from being "lost" behind the overlay.
- **No XSS surface changes**: All dynamic content (team name, member names) is rendered via React JSX, which auto-escapes values. No `dangerouslySetInnerHTML` is introduced.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking the "Members" button on a team row opens a modal dialog (role="dialog")
- [x] The modal title displays the team name (e.g., "Members of Engineering")
- [x] The modal shows the current month/year label below the title
- [x] The modal displays the members table with GitHub Username, Name, and Actions columns
- [x] The member list is scrollable within the modal if it exceeds available height (overflow-y-auto on content area)
- [x] Empty state ("This team has no members for {month}") is shown when the team has no members
- [x] Member remove actions (retire/purge flow with confirmation steps) work within the modal
- [x] While members are loading, the modal displays a "Loading members…" message
- [x] If the member fetch fails, a retry button is shown within the modal
- [x] Error banners (remove error, fetch error) display within the modal
- [x] The team table remains visible behind the modal overlay
- [x] The modal content area scrolls as a single unit (future-proofing for forms above member list)
- [x] The "Manage Members" button is removed
- [x] The "Back to Teams" button is removed
- [x] The modal can be closed via Escape key
- [x] The modal can be closed by clicking outside the modal (overlay click)
- [x] Focus trap works within the modal (Tab cycling)
- [x] All non-skipped E2E tests pass
- [x] All existing Modal unit tests pass
- [x] New Modal size prop unit tests pass
- [x] TypeScript compiles without errors

## Improvements (Out of Scope)

- **Extract member table into a separate component**: `TeamMembersPanel` is 976 lines. The members table (~100 lines of JSX) could be extracted into a `TeamMemberTable` component. Not in scope for this story — it's a standalone refactor.
- **Add a `subtitle` prop to Modal**: The month/year label could be passed as a subtitle prop to Modal for a more semantic API. Currently rendered as the first child of modal content.
- **Consolidate Add/Backfill data-fetching logic**: Both `selectAddMode()` and `selectBackfillMode()` fetch seats with identical API calls. This duplication could be factored into a shared hook. Out of scope for a UI container refactor.
- **Add closing animation to Modal**: Mount/unmount transitions (fade/scale) would improve UX. Requires `AnimatePresence` or CSS transition groups.
- **Responsive modal sizing**: The large modal (`max-w-3xl`) may need responsive adjustments for mobile viewports. Out of scope per the extracted-tasks.md exclusions.

## Changelog

| Date | Change Description |
|------|-------------------|
| 3 March 2026 | Initial plan created |
| 3 March 2026 | **Deviation**: Removed all dormant Add/Backfill code (state variables, handler functions, helper functions, computed values, `SeatRecord` interface) instead of keeping it dormant as originally planned. Reason: keeping unused variables/functions caused 20+ TypeScript compile errors ("defined but never used"), violating the plan's own "TypeScript compiles without errors" acceptance criterion. Stories 1.2/1.3 will re-add this code in a new structure (inline forms within the modal). |
