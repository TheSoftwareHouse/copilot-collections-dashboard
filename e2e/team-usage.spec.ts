import { test, expect } from "@playwright/test";
import { seedTestUser, loginViaApi } from "./helpers/auth";
import { getClient } from "./helpers/db";

async function seedConfiguration() {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey") VALUES ($1, $2, 'GLOBAL')
     ON CONFLICT ("singletonKey") DO NOTHING`,
    ["organisation", "TestOrg"],
  );
  await client.end();
}

async function seedDashboardSummary(month: number, year: number) {
  const client = await getClient();
  await client.query(
    `INSERT INTO dashboard_monthly_summary ("month", "year", "totalSeats", "activeSeats", "totalSpending", "seatBaseCost", "totalPremiumRequests", "includedPremiumRequestsUsed", "modelUsage", "mostActiveUsers", "leastActiveUsers")
     VALUES ($1, $2, 10, 8, 500, 300, 1000, 800, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
     ON CONFLICT ON CONSTRAINT "UQ_dashboard_monthly_summary_month_year" DO NOTHING`,
    [month, year],
  );
  await client.end();
}

async function seedSeat(options: {
  githubUsername: string;
  githubUserId: number;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status", "firstName", "lastName")
     VALUES ($1, $2, 'active', $3, $4)
     ON CONFLICT ("githubUsername") DO UPDATE SET "firstName" = EXCLUDED."firstName"
     RETURNING id`,
    [options.githubUsername, options.githubUserId, options.firstName ?? null, options.lastName ?? null],
  );
  await client.end();
  return result.rows[0].id;
}

async function seedTeam(name: string): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO team ("name") VALUES ($1) RETURNING id`,
    [name],
  );
  await client.end();
  return result.rows[0].id;
}

async function seedMemberSnapshot(
  teamId: number,
  seatId: number,
  month: number,
  year: number,
) {
  const client = await getClient();
  await client.query(
    `INSERT INTO team_member_snapshot ("teamId", "seatId", "month", "year")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ON CONSTRAINT "UQ_team_member_snapshot" DO NOTHING`,
    [teamId, seatId, month, year],
  );
  await client.end();
}

async function seedUsage(
  seatId: number,
  day: number,
  month: number,
  year: number,
  usageItems: unknown[],
) {
  const client = await getClient();
  await client.query(
    `INSERT INTO copilot_usage ("seatId", "day", "month", "year", "usageItems")
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [seatId, day, month, year, JSON.stringify(usageItems)],
  );
  await client.end();
}

function makeUsageItem(model: string, grossQuantity: number, grossAmount: number) {
  return {
    product: "Copilot",
    sku: "Premium",
    model,
    unitType: "requests",
    pricePerUnit: 0.04,
    grossQuantity,
    grossAmount,
    discountQuantity: grossQuantity,
    discountAmount: grossAmount,
    netQuantity: 0,
    netAmount: 0,
  };
}

async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM team_member_snapshot");
  await client.query("DELETE FROM team");
  await client.query("DELETE FROM copilot_usage");
  await client.query("DELETE FROM copilot_seat");
  await client.query("DELETE FROM dashboard_monthly_summary");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Team Usage — Team Tab", () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("Team tab shows teams with aggregated usage metrics", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seat1Id = await seedSeat({ githubUsername: "alice-dev", githubUserId: 5001, firstName: "Alice", lastName: "Smith" });
    const seat2Id = await seedSeat({ githubUsername: "bob-dev", githubUserId: 5002, firstName: "Bob", lastName: "Jones" });

    const teamId = await seedTeam("Frontend Team");
    await seedMemberSnapshot(teamId, seat1Id, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seat2Id, currentMonth, currentYear);

    await seedUsage(seat1Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 200, 8.0)]);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 100, 4.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    // Click Team tab
    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();
    await expect(teamTab).toHaveAttribute("aria-selected", "true");

    // Verify team row is visible
    await expect(page.getByText("Frontend Team")).toBeVisible();
    await expect(page.getByText("$12.00")).toBeVisible();
    // Usage % column: 300 requests / (2 × 300) × 100 = 50%
    const row = page.getByRole("row").filter({ hasText: "Frontend Team" });
    await expect(row.getByText("50%")).toBeVisible();

    // Usage status indicator should appear next to the team name
    await expect(row.getByRole("img", { name: "Moderate usage" })).toBeVisible();
  });

  test("informative message shown when no teams have been defined", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    await expect(
      page.getByText(/no teams have been defined yet/i),
    ).toBeVisible();
  });

  test("teams with no members display zero usage", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);
    await seedTeam("Empty Team");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    await expect(page.getByText("Empty Team")).toBeVisible();
    // Should show 0 for members and requests
    const row = page.getByRole("row").filter({ hasText: "Empty Team" });
    await expect(row).toBeVisible();
    // Usage % should be 0% for teams with no members
    await expect(row.getByText("0%")).toBeVisible();
  });

  test("clicking a team row navigates to team detail page", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "nav-user", githubUserId: 6001 });
    const teamId = await seedTeam("Navigate Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 50, 2.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    await page.getByText("Navigate Team").click();
    await expect(page).toHaveURL(new RegExp(`/usage/teams/${teamId}`));
  });
});

test.describe("Team Usage — Team Search", () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
    await seedDashboardSummary(currentMonth, currentYear);

    // Seed three distinct teams for search testing
    const seat1Id = await seedSeat({ githubUsername: "search-alice", githubUserId: 8001, firstName: "Alice", lastName: "Smith" });
    const seat2Id = await seedSeat({ githubUsername: "search-bob", githubUserId: 8002, firstName: "Bob", lastName: "Jones" });
    const seat3Id = await seedSeat({ githubUsername: "search-charlie", githubUserId: 8003, firstName: "Charlie", lastName: "Brown" });

    const frontendId = await seedTeam("Frontend Team");
    await seedMemberSnapshot(frontendId, seat1Id, currentMonth, currentYear);
    await seedUsage(seat1Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 100, 4.0)]);

    const backendId = await seedTeam("Backend Team");
    await seedMemberSnapshot(backendId, seat2Id, currentMonth, currentYear);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 80, 3.2)]);

    const designId = await seedTeam("Design Team");
    await seedMemberSnapshot(designId, seat3Id, currentMonth, currentYear);
    await seedUsage(seat3Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 60, 2.4)]);
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("search input is visible on the team usage tab", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    const searchInput = page.getByPlaceholder("Search teams…");
    await expect(searchInput).toBeVisible();
  });

  test("typing a query filters the team table to matching results", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    // All 3 teams visible initially
    await expect(page.getByText("Frontend Team")).toBeVisible();
    await expect(page.getByText("Backend Team")).toBeVisible();
    await expect(page.getByText("Design Team")).toBeVisible();

    const searchInput = page.getByPlaceholder("Search teams…");
    await searchInput.fill("Frontend");

    // After debounce, only Frontend Team should appear
    await expect(page.getByText("Frontend Team")).toBeVisible();
    await expect(page.getByText("Backend Team")).not.toBeVisible();
    await expect(page.getByText("Design Team")).not.toBeVisible();
  });

  test("search is case-insensitive", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    const searchInput = page.getByPlaceholder("Search teams…");
    await searchInput.fill("frontend");

    await expect(page.getByText("Frontend Team")).toBeVisible();
    await expect(page.getByText("Backend Team")).not.toBeVisible();
  });

  test("clearing the search input restores the full team list", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    const searchInput = page.getByPlaceholder("Search teams…");
    await searchInput.fill("Frontend");
    await expect(page.getByText("Backend Team")).not.toBeVisible();

    // Clear the search
    await searchInput.clear();

    // All teams should reappear
    await expect(page.getByText("Frontend Team")).toBeVisible();
    await expect(page.getByText("Backend Team")).toBeVisible();
    await expect(page.getByText("Design Team")).toBeVisible();
  });

  test("empty state message is shown when search has no matches", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    const searchInput = page.getByPlaceholder("Search teams…");
    await searchInput.fill("nonexistent-team-xyz");

    await expect(page.getByText(/no teams match your search/i)).toBeVisible();
  });

  test("search query is preserved in URL after page refresh", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();

    const searchInput = page.getByPlaceholder("Search teams…");
    await searchInput.fill("Backend");

    // Wait for results to filter
    await expect(page.getByText("Backend Team")).toBeVisible();
    await expect(page.getByText("Frontend Team")).not.toBeVisible();

    // URL should contain search param
    await expect(page).toHaveURL(/search=Backend/);

    // Refresh the page
    await page.reload();

    // After reload, search should be pre-filled and results filtered
    const reloadedSearchInput = page.getByPlaceholder("Search teams…");
    await expect(reloadedSearchInput).toHaveValue("Backend");
    await expect(page.getByText("Backend Team")).toBeVisible();
    await expect(page.getByText("Frontend Team")).not.toBeVisible();
  });
});

test.describe("Team Usage — Team Detail", () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("team detail page shows team summary with member count, total requests, spending", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seat1Id = await seedSeat({ githubUsername: "detail-alice", githubUserId: 7001, firstName: "Alice", lastName: "Smith" });
    const seat2Id = await seedSeat({ githubUsername: "detail-bob", githubUserId: 7002, firstName: "Bob", lastName: "Jones" });

    const teamId = await seedTeam("Detail Team");
    await seedMemberSnapshot(teamId, seat1Id, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seat2Id, currentMonth, currentYear);

    await seedUsage(seat1Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 150, 6.0)]);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 100, 4.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    // Team name and member count
    await expect(page.getByRole("heading", { name: "Detail Team" })).toBeVisible();
    await expect(page.getByText("2 members")).toBeVisible();

    // Summary cards
    await expect(page.getByText("Total Requests")).toBeVisible();
    await expect(page.getByText("Total Spending")).toBeVisible();
  });

  test("team detail page shows daily usage line chart", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "chart-user", githubUserId: 8001 });
    const teamId = await seedTeam("Chart Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 50, 2.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    await expect(page.getByText("Daily Usage by Member")).toBeVisible();
    // Chart should be rendered
    await expect(page.getByRole("img", { name: /daily usage line chart/i })).toBeVisible();
  });

  test("team detail page shows member table with usage as % and number", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "percent-user", githubUserId: 9001, firstName: "Pam", lastName: "Test" });
    const teamId = await seedTeam("Percent Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    // 150 requests = 50% of 300
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 150, 6.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    const memberTable = page.getByRole("table");
    await expect(memberTable.getByText("percent-user")).toBeVisible();
    // Should show "150 / 300 (50%)"
    await expect(memberTable.getByText(/150 \/ 300 \(50%\)/)).toBeVisible();
  });

  test("team member colour indicators are correct", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    // Red: 0-50% → 90 requests = 30%
    const seatLow = await seedSeat({ githubUsername: "low-user", githubUserId: 10001 });
    // Orange: 51-99% → 210 requests = 70%
    const seatMid = await seedSeat({ githubUsername: "mid-user", githubUserId: 10002 });
    // Green: 100%+ → 350 requests = 117%
    const seatHigh = await seedSeat({ githubUsername: "high-user", githubUserId: 10003 });

    const teamId = await seedTeam("Colour Team");
    await seedMemberSnapshot(teamId, seatLow, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seatMid, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seatHigh, currentMonth, currentYear);

    await seedUsage(seatLow, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 90, 3.6)]);
    await seedUsage(seatMid, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 210, 8.4)]);
    await seedUsage(seatHigh, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 350, 14.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    // Verify colour dots exist next to usernames
    const lowIndicator = page.locator('[aria-label="Low usage"]');
    const moderateIndicator = page.locator('[aria-label="Moderate usage"]');
    const highIndicator = page.locator('[aria-label="High usage"]');

    await expect(lowIndicator).toBeVisible();
    await expect(moderateIndicator).toBeVisible();
    await expect(highIndicator).toBeVisible();
  });

  test("month filter changes the displayed data on team detail page", async ({ page }) => {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    await seedDashboardSummary(currentMonth, currentYear);
    await seedDashboardSummary(prevMonth, prevYear);

    const seatId = await seedSeat({ githubUsername: "mf-team-user", githubUserId: 11001 });
    const teamId = await seedTeam("Month Filter Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seatId, prevMonth, prevYear);

    // Current month: 200 requests
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 200, 8.0)]);
    // Previous month: 80 requests
    await seedUsage(seatId, 1, prevMonth, prevYear, [makeUsageItem("GPT-4o", 80, 3.2)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    // Current month: 200 total requests
    await expect(page.getByRole("heading", { name: "Total Requests" })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^200$/ })).toBeVisible();

    // Switch to previous month
    const select = page.getByLabel("Month");
    await expect(select).toBeVisible();
    await select.selectOption(`${prevMonth}-${prevYear}`);

    // Previous month: 80 total requests
    await expect(page.getByRole("paragraph").filter({ hasText: /^80$/ })).toBeVisible();
  });

  test("breadcrumb navigates back to /usage with team tab active", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "bc-user", githubUserId: 13001 });
    const teamId = await seedTeam("Breadcrumb Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 50, 2.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    // Breadcrumb should render
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText("Usage")).toBeVisible();
    await expect(breadcrumb.getByText("Teams")).toBeVisible();
    await expect(breadcrumb.getByText("Breadcrumb Team")).toBeVisible();

    // Click breadcrumb "Usage" link
    await breadcrumb.getByRole("link", { name: "Usage" }).click();

    await expect(page).toHaveURL(/\/usage\?/);
    await expect(page).toHaveURL(/tab=team/);

    // Verify Team tab is active
    const teamTab = page.getByRole("tab", { name: "Team" });
    await expect(teamTab).toHaveAttribute("aria-selected", "true");
  });

  test("browser back from team detail returns to usage with team tab active", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "back-nav-user", githubUserId: 13002 });
    const teamId = await seedTeam("Back Nav Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 50, 2.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/usage");

    // Switch to Team tab
    const teamTab = page.getByRole("tab", { name: "Team" });
    await teamTab.click();
    await expect(teamTab).toHaveAttribute("aria-selected", "true");

    // Navigate to team detail
    await page.getByText("Back Nav Team").click();
    await expect(page).toHaveURL(new RegExp(`/usage/teams/${teamId}`));

    // Browser back
    await page.goBack();

    await expect(page).toHaveURL(/\/usage\?/);
    await expect(page).toHaveURL(/tab=team/);
    const teamTabAfter = page.getByRole("tab", { name: "Team" });
    await expect(teamTabAfter).toHaveAttribute("aria-selected", "true");
  });

  test("progress bar displays correct team-level usage percentage", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seat1Id = await seedSeat({ githubUsername: "bar-team-a", githubUserId: 12001, firstName: "Alice", lastName: "Bar" });
    const seat2Id = await seedSeat({ githubUsername: "bar-team-b", githubUserId: 12002, firstName: "Bob", lastName: "Bar" });

    const teamId = await seedTeam("Bar Team");
    await seedMemberSnapshot(teamId, seat1Id, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seat2Id, currentMonth, currentYear);

    // Total: 180 + 120 = 300 requests, 2 members × 300 allowance = 600 → 50%
    await seedUsage(seat1Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 180, 7.2)]);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 120, 4.8)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    const progressBar = page.getByRole("progressbar");
    await expect(progressBar).toBeVisible();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "50");
    await expect(page.getByText("50%")).toBeVisible();
  });

  test("progress bar shows 0% when team has no members", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const teamId = await seedTeam("Empty Bar Team");

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    const progressBar = page.getByRole("progressbar");
    await expect(progressBar).toBeVisible();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByText("0%")).toBeVisible();
  });

  test("member table shows actual percentage when member exceeds premium allowance", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seat1Id = await seedSeat({ githubUsername: "cap-heavy", githubUserId: 13001, firstName: "Heavy", lastName: "User" });
    const seat2Id = await seedSeat({ githubUsername: "cap-light", githubUserId: 13002, firstName: "Light", lastName: "User" });

    const teamId = await seedTeam("Capped Team");
    await seedMemberSnapshot(teamId, seat1Id, currentMonth, currentYear);
    await seedMemberSnapshot(teamId, seat2Id, currentMonth, currentYear);

    // seat1: 1000 requests (exceeds 300 cap), seat2: 100 requests
    // Overview progress bar: (300 + 100) / (2 × 300) × 100 ≈ 67% (server-calculated, capped)
    await seedUsage(seat1Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 1000, 40.0)]);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 100, 4.0)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    const progressBar = page.getByRole("progressbar");
    await expect(progressBar).toBeVisible();
    // Overview progress bar still shows aggregate capped percentage: 67%
    await expect(progressBar).toHaveAttribute("aria-valuenow", "67");
    await expect(page.getByText("67%")).toBeVisible();

    // Member table shows uncapped percentages
    await expect(page.getByText("1,000 / 300 (333%)")).toBeVisible();
    await expect(page.getByText("100 / 300 (33%)")).toBeVisible();
  });

  test("clicking a team member row navigates to seat usage page", async ({ page }) => {
    await seedDashboardSummary(currentMonth, currentYear);

    const seatId = await seedSeat({ githubUsername: "nav-member", githubUserId: 14001, firstName: "Nav", lastName: "Member" });
    const teamId = await seedTeam("Nav Member Team");
    await seedMemberSnapshot(teamId, seatId, currentMonth, currentYear);
    await seedUsage(seatId, 1, currentMonth, currentYear, [makeUsageItem("GPT-4o", 120, 4.8)]);

    await loginViaApi(page, "admin", "password123");
    await page.goto(`/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`);

    // Click the member username link in the member table
    await page.getByRole("link", { name: "nav-member" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/usage/seats/${seatId}\\?month=${currentMonth}&year=${currentYear}`),
    );
  });
});

test.describe("Team Usage — Team Detail Member Search", () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  let teamId: number;

  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
    await seedDashboardSummary(currentMonth, currentYear);

    // Seed a team with 3 distinct members for search testing
    teamId = await seedTeam("Search Detail Team");

    const seat1Id = await seedSeat({
      githubUsername: "alice-dev",
      githubUserId: 40001,
      firstName: "Alice",
      lastName: "Johnson",
    });
    await seedMemberSnapshot(teamId, seat1Id, currentMonth, currentYear);
    await seedUsage(seat1Id, 1, currentMonth, currentYear, [
      makeUsageItem("GPT-4o", 100, 4.0),
    ]);

    const seat2Id = await seedSeat({
      githubUsername: "bob-ops",
      githubUserId: 40002,
      firstName: "Bob",
      lastName: "Smith",
    });
    await seedMemberSnapshot(teamId, seat2Id, currentMonth, currentYear);
    await seedUsage(seat2Id, 1, currentMonth, currentYear, [
      makeUsageItem("GPT-4o", 80, 3.2),
    ]);

    const seat3Id = await seedSeat({
      githubUsername: "charlie-qa",
      githubUserId: 40003,
      firstName: "Charlie",
      lastName: "Brown",
    });
    await seedMemberSnapshot(teamId, seat3Id, currentMonth, currentYear);
    await seedUsage(seat3Id, 1, currentMonth, currentYear, [
      makeUsageItem("GPT-4o", 60, 2.4),
    ]);
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("search input is visible on the team detail page when the team has members", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const searchInput = page.getByPlaceholder("Search members…");
    await expect(searchInput).toBeVisible();
  });

  test("search input is NOT visible when the team has no members", async ({
    page,
  }) => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
    await seedDashboardSummary(currentMonth, currentYear);
    const emptyTeamId = await seedTeam("Empty Search Team");

    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${emptyTeamId}?month=${currentMonth}&year=${currentYear}`,
    );

    await expect(page.getByText(/no members for/i)).toBeVisible();
    await expect(
      page.getByPlaceholder("Search members…"),
    ).not.toBeVisible();
  });

  test("typing a query filters the member table by GitHub username", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const table = page.getByRole("table");
    await expect(table.getByText("alice-dev")).toBeVisible();
    await expect(table.getByText("bob-ops")).toBeVisible();
    await expect(table.getByText("charlie-qa")).toBeVisible();

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("alice-dev");

    await expect(table.getByText("alice-dev")).toBeVisible();
    await expect(table.getByText("bob-ops")).not.toBeVisible();
    await expect(table.getByText("charlie-qa")).not.toBeVisible();
  });

  test("typing a query filters the member table by first name", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("Bob");

    const table = page.getByRole("table");
    await expect(table.getByText("bob-ops")).toBeVisible();
    await expect(table.getByText("alice-dev")).not.toBeVisible();
    await expect(table.getByText("charlie-qa")).not.toBeVisible();
  });

  test("typing a query filters the member table by last name", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("Brown");

    const table = page.getByRole("table");
    await expect(table.getByText("charlie-qa")).toBeVisible();
    await expect(table.getByText("alice-dev")).not.toBeVisible();
    await expect(table.getByText("bob-ops")).not.toBeVisible();
  });

  test("search is case-insensitive", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("alice");

    const table = page.getByRole("table");
    await expect(table.getByText("alice-dev")).toBeVisible();
    await expect(table.getByText("bob-ops")).not.toBeVisible();
  });

  test("the daily usage chart updates to show only filtered members", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const chart = page.getByRole("img", {
      name: /daily usage line chart/i,
    });
    await expect(chart).toBeVisible();

    // Initially all 3 member lines should be in the chart legend
    const legendItems = chart.locator(".recharts-legend-item");
    await expect(legendItems).toHaveCount(3);

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("alice-dev");

    // After filtering, only 1 line should remain in the chart legend
    await expect(legendItems).toHaveCount(1);
  });

  test("clearing the search input restores the full member list and chart", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const table = page.getByRole("table");
    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("alice-dev");
    await expect(table.getByText("bob-ops")).not.toBeVisible();

    // Clear the search
    await searchInput.clear();

    // All members should reappear
    await expect(table.getByText("alice-dev")).toBeVisible();
    await expect(table.getByText("bob-ops")).toBeVisible();
    await expect(table.getByText("charlie-qa")).toBeVisible();

    // Chart should show all 3 legend items again
    const chart = page.getByRole("img", {
      name: /daily usage line chart/i,
    });
    const legendItems = chart.locator(".recharts-legend-item");
    await expect(legendItems).toHaveCount(3);
  });

  test("empty state message is shown when search has no matches", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto(
      `/usage/teams/${teamId}?month=${currentMonth}&year=${currentYear}`,
    );

    const searchInput = page.getByPlaceholder("Search members…");
    await searchInput.fill("nonexistent-member-xyz");

    await expect(
      page.getByText(/no members match your search/i),
    ).toBeVisible();
  });
});
