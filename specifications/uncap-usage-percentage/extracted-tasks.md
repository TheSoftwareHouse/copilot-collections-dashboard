# Uncap Usage Percentage Display - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | 2 March 2026 |
| Participants | Product Owner, Development Team |
| Source Materials | Direct requirement from product owner, codebase analysis |
| Total Epics | 1 |
| Total Stories | 3 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Show Actual Usage Percentage | 3 | High |

## Epic 1: Show Actual Usage Percentage

**Business Description**: Currently, the usage percentage displayed across the application is capped at 100%, which hides how much a user has exceeded their included premium request allowance. Stakeholders need to see the actual percentage (e.g., 200% when a user consumed 600 out of 300 included requests) to accurately understand overage levels and make informed decisions about seat allocation and cost management.

**Success Criteria**:
- All usage percentage values across the specified views display the actual (uncapped) value — e.g., 600/300 shows as "200%"
- The visual progress bar fill remains capped at 100% (since a bar cannot exceed its physical width), but the text label shows the actual percentage
- Colour-coded usage indicators reflect the uncapped percentage for accurate status representation

### Story 1.1: Display uncapped usage percentage on seat views

**User Story**: As a dashboard user, I want to see the actual usage percentage on the seat details page and seat table so that I can understand how much each seat has exceeded (or stayed within) their included premium request allowance.

**Acceptance Criteria**:
- [ ] Seat details page progress bar text shows actual percentage (e.g., "200%") when usage exceeds the allowance, instead of capping at "100%"
- [ ] Seat details page progress bar fill width remains capped at 100% of the bar (visual constraint) but the displayed percentage text is uncapped
- [ ] Seat usage table "Usage" column shows actual percentage in the format "X / Y (Z%)" where Z is not capped (e.g., "600 / 300 (200%)")
- [ ] Seat list table "Usage %" column shows actual percentage (e.g., "200%") instead of capping at "100%"
- [ ] Colour-coded status indicator (dot) next to usernames uses the uncapped percentage for colour determination
- [ ] Progress bar accessibility attributes (`aria-valuenow`, `aria-label`) correctly reflect the uncapped percentage value, ensuring screen reader users receive the same information as visual users

**High-Level Technical Notes**: The `Math.min(..., 100)` cap is applied in `SeatDetailPanel`, `SeatUsageTable`, and `SeatListPanel` components. The shared `UsageProgressBar` component also caps the display text and `aria-valuenow`/`aria-label`. The underlying `calcUsagePercent` helper already returns uncapped values.

**Priority**: High

### Story 1.2: Display uncapped usage percentage on team member and department member tables

**User Story**: As a dashboard user, I want to see the actual usage percentage on the team members table (team details) and department members table (department details) so that the usage display is consistent across all member-level views.

**Acceptance Criteria**:
- [ ] Team members table on team detail page shows actual percentage in the "Usage" column — e.g., "600 / 300 (200%)" instead of capping at "100%"
- [ ] Department members table on department detail page shows actual percentage in the "Usage" column (same table component as team members)
- [ ] Colour-coded status indicator for team/department members uses the uncapped percentage
- [ ] Percentage display is consistent with the seat views from Story 1.1

**High-Level Technical Notes**: The `TeamMemberTable` component is shared between team detail and department detail views. The `Math.min(rawPercent, 100)` cap needs to be removed in this component.

**Priority**: High

### Story 1.3: Display uncapped usage percentage on Dashboard active/inactive user lists

**User Story**: As a dashboard user, I want to see the actual usage percentage on the Dashboard's "Most Active Users" and "Least Active Users" lists so that the percentage display is consistent across the entire application.

**Acceptance Criteria**:
- [ ] "Most Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
- [ ] "Least Active Users" list on the Dashboard displays uncapped usage percentage in the colour-coded indicator
- [ ] Percentage display is consistent with the seat and member views from Stories 1.1 and 1.2

**High-Level Technical Notes**: The `DashboardPanel.tsx` applies `Math.min(calcUsagePercent(...), 100)` on lines 300 and 345 for most/least active user lists.

**Priority**: Medium

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.2 | Story 1.1 | Related to | Both stories modify usage percentage display; Story 1.1 includes changes to the shared `UsageProgressBar` component which Story 1.2 also uses |
| Story 1.3 | Story 1.1 | Related to | Dashboard consistency depends on the same uncapping approach established in Story 1.1 |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | The progress bar fill width should remain capped at 100% (visual constraint) while only the text label shows the uncapped value | High | If the bar should also visually extend beyond 100%, the `UsageProgressBar` component would need a different visual treatment |
| 2 | The colour thresholds in `getUsageColour` (≥90% green, 50–89% orange, <50% red) remain unchanged and should receive uncapped percentages | High | If colour logic should change, additional design input is needed |
| 3 | The Dashboard panel's "Most Active Users" and "Least Active Users" lists should also be uncapped for consistency (added as Story 1.3 after quality review) | High | N/A — now in scope |

## Out of Scope

Items explicitly excluded from this task breakdown:
- ~~Dashboard panel percentage indicators~~ — moved into scope as Story 1.3 after quality review
- Team usage summary table / Department usage summary table (aggregate percentage per team/department) — these use server-side capped percentage calculation and were not mentioned
- Changes to the underlying `calcUsagePercent` helper — it already returns uncapped values
- Changes to the API layer or database queries — the capping is purely a frontend display concern

## Open Questions for Stakeholders

| # | Question | Context | Impact |
|---|----------|---------|--------|
| | No open questions remaining — Dashboard consistency addressed in Story 1.3 | | |
