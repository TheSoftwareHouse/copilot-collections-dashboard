# Story 10.4: Inline Editing of Team Names in the Management Table — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.4 |
| Title | Inline editing of team names in the management table |
| Description | Replace the current row-takeover edit form in the team management table with per-cell inline editing. Clicking on a team name activates editing within that cell, allowing quick renaming without opening a separate form. |
| Priority | High |
| Related Research | [jira-tasks.md](./jira-tasks.md) (lines 1687–1724), [extracted-tasks.md](./extracted-tasks.md) (lines 614–631), [quality-review.md](./quality-review.md) (S-17) |

## Proposed Solution

Replace the existing "Edit" button + full-row form pattern in `TeamManagementPanel` with true per-cell inline editing of the team name. The team name cell becomes a click-to-edit control using the `EditableTextCell` component already created in Story 10.3.

**Key changes:**

1. **Move `EditableTextCell` to shared location** — The component currently lives in `src/components/seats/EditableTextCell.tsx`. Since it is now used by both the seats and teams features, it is relocated to `src/components/shared/EditableTextCell.tsx` and all imports are updated. This follows the recommendation from Story 10.3's Improvements section.

2. **Replace the team name `<Link>` with `EditableTextCell`** — Currently the team name is a Next.js `<Link>` that navigates to the team usage detail page (added in Story 10.2). With inline editing, clicking the name now activates edit mode. A separate small navigation link icon (→) is added adjacent to the name so users can still navigate to the team usage detail page.

3. **Remove old row-takeover edit form** — All state and logic related to the current colSpan=5 edit form are removed: `editingTeamId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing` state variables; `startEdit`, `cancelEdit`, `handleEdit` functions; the edit form JSX; and the "Edit" button from the Actions column.

4. **Add `updateTeamName` function** — A new function calls `PUT /api/teams/[id]` with the updated name. On success, it patches the local `teams` state array in-place to avoid a full list reload. On error (409 duplicate, 400 validation, network failure), the Promise is rejected so the `EditableTextCell` reverts and flashes red.

5. **Empty name validation** — The `onSave` callback rejects immediately if the user clears the name to empty/null, preventing a pointless API call. The `EditableTextCell` reverts to the original value and flashes the error indicator.

6. **Duplicate name validation** — Handled server-side by the existing `PUT /api/teams/[id]` endpoint which returns 409 for duplicate names. The cell reverts and flashes the error indicator.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Team Management Table                                                        │
├──────────────────────────┬─────────┬─────────┬──────────┬───────────────────┤
│ Name                     │ Members │ Usage % │ Created  │ Actions           │
├──────────────────────────┼─────────┼─────────┼──────────┼───────────────────┤
│ [●] Frontend Team [✎] → │    5    │   72%   │ 1/15/26  │ Members · Delete  │
│ [●] Backend Team [✎]  → │    3    │   45%   │ 1/20/26  │ Members · Delete  │
└──────────────────────────┴─────────┴─────────┴──────────┴───────────────────┘
                ↑                                              ↑
   Click name = inline edit                           "Edit" button removed
   [→] = link to usage detail page
   [●] = UsageStatusIndicator
```

**No backend API changes are required** — the existing `PUT /api/teams/[id]` endpoint already supports name updates with Zod validation, duplicate name detection (409), soft-delete awareness (404), and authentication.

## Current Implementation Analysis

### Already Implemented
- `EditableTextCell` — [src/components/seats/EditableTextCell.tsx](../../src/components/seats/EditableTextCell.tsx) — Reusable inline text-editing component with Enter/Escape/blur save/cancel, loading spinner, and error flash. Created in Story 10.3.
- `PUT /api/teams/[id]` — [src/app/api/teams/[id]/route.ts](../../src/app/api/teams/%5Bid%5D/route.ts) — Supports name updates with Zod validation (`updateTeamSchema`), returns 409 for duplicate names, 404 for missing/soft-deleted teams. Auth-protected via `requireAuth`.
- `updateTeamSchema` — [src/lib/validations/team.ts](../../src/lib/validations/team.ts) — Zod schema requiring non-empty string, max 255 chars, with trim.
- `UsageStatusIndicator` — [src/components/usage/UsageStatusIndicator.tsx](../../src/components/usage/UsageStatusIndicator.tsx) — Colour-coded dot indicator used in team rows.
- API route unit tests — [src/app/api/teams/__tests__/[id].route.test.ts](../../src/app/api/teams/__tests__/%5Bid%5D.route.test.ts) — Comprehensive PUT endpoint tests covering 401, 400, 404, 409, and 200 responses.
- E2E team management tests — [e2e/team-management.spec.ts](../../e2e/team-management.spec.ts) — Tests for create, edit (row-form pattern), delete, usage indicators, and soft-delete.
- Cross-linking — Team names in view mode are `<Link>` to `/usage/teams/${team.id}` (implemented in Story 10.2).

### To Be Modified
- `EditableTextCell` — [src/components/seats/EditableTextCell.tsx](../../src/components/seats/EditableTextCell.tsx) — Move to `src/components/shared/EditableTextCell.tsx` (file relocation, no logic changes).
- `SeatListPanel` — [src/components/seats/SeatListPanel.tsx](../../src/components/seats/SeatListPanel.tsx) — Update import path from `@/components/seats/EditableTextCell` to `@/components/shared/EditableTextCell`.
- `TeamManagementPanel` — [src/components/teams/TeamManagementPanel.tsx](../../src/components/teams/TeamManagementPanel.tsx) — Remove row-takeover edit form; replace team name `<Link>` with `EditableTextCell` + separate navigation icon; remove "Edit" button from Actions column; add `updateTeamName` function with local state patching.
- `team-management.spec.ts` — [e2e/team-management.spec.ts](../../e2e/team-management.spec.ts) — Rewrite the "can edit a team's name inline" test to use the new click-on-cell interaction pattern; add tests for escape-to-cancel, empty name prevention, and duplicate name prevention.

### To Be Created
_Nothing needs to be created from scratch. All required components and API endpoints already exist._

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | How should users navigate to the team usage detail page after the name becomes editable instead of a link? | Add a small link icon (→) adjacent to the team name in the same cell. Clicking the icon navigates to `/usage/teams/${team.id}`. This separates the edit trigger (click name) from the navigate trigger (click icon). | ✅ Resolved |
| 2 | Should the `EditableTextCell` component show a text error message for empty/duplicate name? | No — the existing error flash behaviour (red border for 2 seconds + revert) is sufficient for the inline editing pattern. Empty name is caught client-side in `onSave` before hitting the API. Duplicate names are caught server-side (409). Both cause the cell to revert. | ✅ Resolved |
| 3 | Should the `EditableTextCell` remain in `src/components/seats/` or be moved? | Move to `src/components/shared/EditableTextCell.tsx` as recommended in Story 10.3's Improvements section, now that it is used by both seats and teams. | ✅ Resolved |

## Implementation Plan

### Phase 1: Relocate EditableTextCell to Shared Directory

#### Task 1.1 - [MODIFY] Move EditableTextCell to shared location
**Description**: Move `src/components/seats/EditableTextCell.tsx` to `src/components/shared/EditableTextCell.tsx`. The file content remains unchanged. Update the import in `SeatListPanel.tsx` to reference the new path.

**Definition of Done**:
- [x] File `src/components/shared/EditableTextCell.tsx` exists with the same content as the original
- [x] File `src/components/seats/EditableTextCell.tsx` is deleted
- [x] Import in `SeatListPanel.tsx` updated from `@/components/seats/EditableTextCell` to `@/components/shared/EditableTextCell`
- [x] The seat list table continues to function correctly (inline editing for firstName, lastName)
- [x] No TypeScript compilation errors
- [x] All existing E2E tests in `seat-edit.spec.ts` still pass

### Phase 2: Replace Row-Takeover Edit with Inline Editing in TeamManagementPanel

#### Task 2.1 - [MODIFY] Remove old edit form state, logic, and JSX from TeamManagementPanel
**Description**: Remove all state variables and functions related to the row-takeover edit form from `TeamManagementPanel.tsx`. This includes: `editingTeamId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing` state variables; the `FieldErrors` type alias (no longer referenced after create form switches to inline errors); `startEdit`, `cancelEdit`, `handleEdit` functions; the `colSpan={5}` edit form row JSX block; the "Edit" button from the Actions column; and the `updateTeamSchema` import (only the create form uses `createTeamSchema` now). Retain the "Members" and "Delete" buttons in the Actions column.

**Definition of Done**:
- [x] State variables removed: `editingTeamId`, `editName`, `editFieldErrors`, `editServerError`, `isEditing`
- [x] Functions removed: `startEdit`, `cancelEdit`, `handleEdit`
- [x] The `colSpan={5}` edit form row JSX is removed
- [x] The "Edit" button is removed from the Actions column
- [x] The `updateTeamSchema` import is removed (only `createTeamSchema` retained)
- [x] "Members" and "Delete" buttons remain functional in the Actions column
- [x] `FieldErrors` type alias is retained if still used by create form, removed otherwise
- [x] The table renders without errors and all columns display correctly

#### Task 2.2 - [MODIFY] Replace team name link with EditableTextCell and separate navigation icon
**Description**: In the team table row (non-editing view), replace the `<Link>` wrapper on the team name with the `EditableTextCell` component. The `UsageStatusIndicator` remains before the name. A small link icon (→) is added after the `EditableTextCell` as a `<Link>` to `/usage/teams/${team.id}` for navigation. Import `EditableTextCell` from the new shared location. Add a `updateTeamName` async function that: (1) rejects immediately if the new value is null/empty (prevents saving empty names without an API call); (2) calls `PUT /api/teams/${teamId}` with `{ name: newValue }`; (3) on success (200), patches the matching entry in the local `teams` state array with the updated `name` and `updatedAt` from the response; (4) on error (409, 400, 404, network), rejects the Promise so the cell reverts.

**Definition of Done**:
- [x] `EditableTextCell` imported from `@/components/shared/EditableTextCell`
- [x] Team name column renders `<EditableTextCell>` with `value={team.name}` and `ariaLabel={`Edit name for team ${team.name}`}`
- [x] `onSave` callback rejects with an Error if new value is null (empty name prevention)
- [x] `onSave` callback calls `updateTeamName(team.id, newValue)` for non-null values
- [x] `updateTeamName` function sends `PUT /api/teams/{teamId}` with `{ name }` payload
- [x] On 200 response, the local `teams` state is patched in-place (name, updatedAt) without full list reload
- [x] On 409/400/404/network error, the Promise is rejected so the cell reverts and flashes red
- [x] `UsageStatusIndicator` remains visible before the team name in each row
- [x] A small navigation `<Link>` icon (→) is added after the `EditableTextCell`, pointing to `/usage/teams/${team.id}`, with `aria-label="View team usage"` and accessible styling
- [x] The `<Link>` import from `next/link` is retained for the navigation icon
- [x] All other columns (Members count, Usage %, Created, Actions) remain unchanged
- [x] Previously direct `<Link>` on team name text is fully removed

### Phase 3: Update E2E Tests

#### Task 3.1 - [MODIFY] Rewrite team edit E2E test for inline editing pattern
**Description**: Rewrite the existing "can edit a team's name inline" test in `e2e/team-management.spec.ts` to use the new per-cell inline editing interaction. Instead of clicking an "Edit" button and filling a label-based form, the test should click directly on the team name text in the table cell, type into the inline input, and press Enter. Add additional tests for: (1) pressing Escape reverts to the original name; (2) clearing the name to empty and pressing Enter reverts (empty name prevention); (3) attempting to rename to a duplicate name reverts; (4) the navigation icon (→) still navigates to the team usage detail page; (5) inline edit shows a loading state while saving.

**Definition of Done**:
- [x] Test: clicking on a team name cell activates an inline text input with the current name
- [x] Test: pressing Enter in the inline input saves the new name and exits edit mode — the updated name is visible in the table
- [x] Test: pressing Escape in the inline input reverts to the original name without saving
- [x] Test: clicking outside (blur) the inline input saves the new name
- [x] Test: clearing the name to empty and pressing Enter reverts to the original name (empty name prevented)
- [x] Test: renaming to a duplicate name (name of another existing team) reverts to the original name
- [x] Test: the navigation icon (→) next to the team name links to the correct `/usage/teams/${teamId}` page
- [x] All tests pass against the updated `TeamManagementPanel`
- [x] No references to the removed "Edit" button or row-form remain in the "edit" tests
- [x] Existing non-edit tests (create, delete, empty state, usage indicators) continue to pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review by tsh-code-reviewer agent
**Description**: Run a full code review of all changed and newly created files using the `tsh-code-reviewer` agent. The review should cover code quality, accessibility, consistency with project patterns, test coverage, and adherence to the acceptance criteria.

**Definition of Done**:
- [x] All changed files reviewed: `src/components/shared/EditableTextCell.tsx` (moved), `src/components/seats/SeatListPanel.tsx` (import update), `src/components/teams/TeamManagementPanel.tsx` (main changes), `e2e/team-management.spec.ts` (E2E test rewrite)
- [x] No critical or high-severity findings remain unresolved
- [x] Accessibility requirements verified (keyboard navigation, ARIA attributes, focus management)
- [x] Code follows existing project conventions (Tailwind styling, state management patterns, error handling)
- [x] Inline editing behaviour is consistent with the seat inline editing pattern from Story 10.3

## Security Considerations

- **No new API endpoints**: Inline editing reuses the existing authenticated `PUT /api/teams/[id]` endpoint. No additional attack surface is introduced.
- **Input validation unchanged**: All input continues to be validated server-side by the Zod `updateTeamSchema` (non-empty, max 255 chars, trimmed). Client-side empty check is a UX convenience only.
- **Auth enforcement unchanged**: The `requireAuth` middleware on the PUT route ensures only authenticated users can modify team data.
- **Duplicate name protection unchanged**: The database unique constraint and 409 response prevent duplicate team names.
- **No XSS risk increase**: React's JSX escaping handles all rendered values. No `dangerouslySetInnerHTML` is used.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking on a team name cell activates inline editing with a text input
- [x] Pressing Enter or clicking outside saves the updated name
- [x] Pressing Escape cancels the edit and reverts to the previous value
- [x] Validation prevents saving an empty name
- [x] Validation prevents saving a duplicate team name
- [x] A loading indicator is shown while saving
- [x] The updated name is immediately reflected in the table
- [x] Keyboard accessibility: editable team name cells are reachable via Tab, activatable via Enter/Space
- [x] Screen reader: editable cells have appropriate ARIA attributes (`role="button"`, `tabIndex`, `aria-label`)
- [x] Navigation to team usage detail page is preserved via the link icon (→)
- [x] All E2E tests in `team-management.spec.ts` pass
- [x] No regressions in `seat-edit.spec.ts`, `seat-list.spec.ts`, or `cross-linking.spec.ts`

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Error message toast for duplicate names**: Currently the cell just flashes red when a duplicate name is rejected. A brief toast notification saying "Team name already exists" would provide clearer feedback.
- **Inline editing for department names (Story 10.5)**: The same `EditableTextCell` component (now shared) can be reused directly for department name inline editing.
- **Undo/toast after save**: After a successful rename, show a brief toast with "Undo" option for accidental edits.
- **Optimistic UI**: Show the new name immediately and revert on error, instead of showing a spinner during save.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — all 4 phases done. Code review: 0 critical/high, 1 medium (M1 resolved: `updateTeamName` wrapped in `useCallback`), 2 low (L1 stale member panel name — pre-existing, L2 no spinner E2E test — accepted). Cross-linking E2E test updated for new navigation pattern. |
