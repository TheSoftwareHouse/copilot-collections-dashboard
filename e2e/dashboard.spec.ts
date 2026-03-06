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

async function seedDashboardSummary() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const modelUsage = JSON.stringify([
    { model: "GPT-4o", totalRequests: 150, totalAmount: 450.0 },
    { model: "Claude Sonnet 4.5", totalRequests: 80, totalAmount: 320.0 },
  ]);

  const mostActiveUsers = JSON.stringify([
    { seatId: 101, githubUsername: "top-user-1", firstName: "Alice", lastName: "Smith", totalRequests: 500, totalSpending: 125.50 },
    { seatId: 102, githubUsername: "top-user-2", firstName: "Bob", lastName: "Jones", totalRequests: 350, totalSpending: 87.25 },
  ]);

  const leastActiveUsers = JSON.stringify([
    { seatId: 201, githubUsername: "low-user-1", firstName: "Charlie", lastName: "Brown", totalRequests: 10, totalSpending: 2.50 },
    { seatId: 202, githubUsername: "low-user-2", firstName: null, lastName: null, totalRequests: 25, totalSpending: 6.25 },
  ]);

  const client = await getClient();
  await client.query(
    `INSERT INTO dashboard_monthly_summary ("month", "year", "totalSeats", "activeSeats", "totalSpending", "seatBaseCost", "totalPremiumRequests", "includedPremiumRequestsUsed", "modelUsage", "mostActiveUsers", "leastActiveUsers")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
     ON CONFLICT ON CONSTRAINT "UQ_dashboard_monthly_summary_month_year" DO UPDATE SET
       "totalSeats" = EXCLUDED."totalSeats",
       "activeSeats" = EXCLUDED."activeSeats",
       "totalSpending" = EXCLUDED."totalSpending",
       "seatBaseCost" = EXCLUDED."seatBaseCost",
       "totalPremiumRequests" = EXCLUDED."totalPremiumRequests",
       "includedPremiumRequestsUsed" = EXCLUDED."includedPremiumRequestsUsed",
       "modelUsage" = EXCLUDED."modelUsage",
       "mostActiveUsers" = EXCLUDED."mostActiveUsers",
       "leastActiveUsers" = EXCLUDED."leastActiveUsers",
       "updatedAt" = now()`,
    [month, year, 42, 38, 770.0, 722.0, 15000, 9500, modelUsage, mostActiveUsers, leastActiveUsers],
  );
  await client.end();
}

async function seedSummaryForMonth(
  month: number,
  year: number,
  overrides: {
    totalSeats?: number;
    activeSeats?: number;
    totalSpending?: number;
    seatBaseCost?: number;
    totalPremiumRequests?: number;
    includedPremiumRequestsUsed?: number;
    modelUsage?: unknown[];
    mostActiveUsers?: unknown[];
    leastActiveUsers?: unknown[];
  } = {},
) {
  const {
    totalSeats = 10,
    activeSeats = 8,
    totalSpending = 500.0,
    seatBaseCost = 152.0,
    totalPremiumRequests = 1200,
    includedPremiumRequestsUsed = 900,
    modelUsage = [{ model: "GPT-4o", totalRequests: 50, totalAmount: 200.0 }],
    mostActiveUsers = [{ seatId: 1, githubUsername: "user-1", firstName: "Test", lastName: "User", totalRequests: 100, totalSpending: 50.0 }],
    leastActiveUsers = [{ seatId: 2, githubUsername: "user-2", firstName: "Low", lastName: "User", totalRequests: 5, totalSpending: 2.0 }],
  } = overrides;

  const client = await getClient();
  await client.query(
    `INSERT INTO dashboard_monthly_summary ("month", "year", "totalSeats", "activeSeats", "totalSpending", "seatBaseCost", "totalPremiumRequests", "includedPremiumRequestsUsed", "modelUsage", "mostActiveUsers", "leastActiveUsers")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
     ON CONFLICT ON CONSTRAINT "UQ_dashboard_monthly_summary_month_year" DO UPDATE SET
       "totalSeats" = EXCLUDED."totalSeats",
       "activeSeats" = EXCLUDED."activeSeats",
       "totalSpending" = EXCLUDED."totalSpending",
       "seatBaseCost" = EXCLUDED."seatBaseCost",
       "totalPremiumRequests" = EXCLUDED."totalPremiumRequests",
       "includedPremiumRequestsUsed" = EXCLUDED."includedPremiumRequestsUsed",
       "modelUsage" = EXCLUDED."modelUsage",
       "mostActiveUsers" = EXCLUDED."mostActiveUsers",
       "leastActiveUsers" = EXCLUDED."leastActiveUsers",
       "updatedAt" = now()`,
    [
      month, year, totalSeats, activeSeats, totalSpending, seatBaseCost,
      totalPremiumRequests, includedPremiumRequestsUsed,
      JSON.stringify(modelUsage), JSON.stringify(mostActiveUsers), JSON.stringify(leastActiveUsers),
    ],
  );
  await client.end();
}

async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM dashboard_monthly_summary");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Dashboard", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("dashboard is the landing page — navigating to / redirects to /dashboard", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: /monthly usage overview/i }),
    ).toBeVisible();
  });

  test("dashboard displays total seats count", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(page.getByText("42")).toBeVisible();
    await expect(page.getByText(/38 active/i)).toBeVisible();
  });

  test("dashboard displays per-model usage", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(page.getByText("GPT-4o")).toBeVisible();
    await expect(page.getByText("Claude Sonnet 4.5")).toBeVisible();
    await expect(page.getByText("$450.00")).toBeVisible();
    await expect(page.getByText("$320.00")).toBeVisible();
  });

  test("dashboard displays most active users", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /most active users/i }),
    ).toBeVisible();
    await expect(page.getByText("top-user-1")).toBeVisible();
    await expect(page.getByText("Alice Smith")).toBeVisible();
    await expect(page.getByText("$125.50")).toBeVisible();
    await expect(page.getByText("top-user-2")).toBeVisible();
    await expect(page.getByText("$87.25")).toBeVisible();

    // Usage status indicators should appear next to usernames
    const mostActiveHeading = page.getByRole("heading", { name: /most active users/i });
    const mostActiveCard = mostActiveHeading.locator("../..");
    await expect(mostActiveCard.getByRole("img", { name: /usage/i }).first()).toBeVisible();
  });

  test("overcap user on most active list has correct usage indicator", async ({ page }) => {
    // top-user-1 has 500 requests against 300 premiumRequestsPerSeat (167%)
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const mostActiveHeading = page.getByRole("heading", { name: /most active users/i });
    const mostActiveCard = mostActiveHeading.locator("../..");
    // The first indicator belongs to top-user-1 (500 requests / 300 allowance = 167%)
    // getUsageColour(167) returns "High usage"
    await expect(mostActiveCard.getByRole("img", { name: "High usage" }).first()).toBeVisible();
  });

  test("dashboard displays total spending with breakdown", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(page.getByText("$770.00", { exact: true })).toBeVisible();
    // Breakdown: $48.00 paid requests + $722.00 seat licenses
    await expect(page.getByText(/paid requests.*seat licenses/)).toBeVisible();
  });

  test("dashboard displays premium request metrics", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    // Included Allowance: 38 seats × 300 = 11,400
    await expect(page.getByText("11,400", { exact: true })).toBeVisible();
    // Included Used (from discountQuantity): 9,500
    await expect(page.getByText("9,500", { exact: true })).toBeVisible();
    // Included Remaining: 11,400 - 9,500 = 1,900
    await expect(page.getByText("1,900")).toBeVisible();
    // Total Used (uncapped): 15,000
    await expect(page.getByText("15,000")).toBeVisible();
    // Paid Requests: 15,000 - 9,500 = 5,500
    await expect(page.getByText("5,500")).toBeVisible();
  });

  test("dashboard displays empty state when no summary data exists", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(
      page.getByText(/no usage data available/i),
    ).toBeVisible();
  });

  test("allowance used card is visible on dashboard", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /allowance used/i }),
    ).toBeVisible();
  });

  test("allowance used card displays correct percentage and absolute values", async ({
    page,
  }) => {
    // 38 active seats × 300 = 11,400 included; 9,500 used → 83%
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    await expect(card.getByText("83%")).toBeVisible();
    await expect(card.getByText("9,500 / 11,400 requests")).toBeVisible();
  });

  test("allowance used card shows N/A when included allowance is zero", async ({
    page,
  }) => {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    // Seed with 0 active seats → 0 included allowance → "N/A"
    await seedSummaryForMonth(month, year, {
      totalSeats: 5,
      activeSeats: 0,
      totalSpending: 0,
      seatBaseCost: 0,
      totalPremiumRequests: 0,
      includedPremiumRequestsUsed: 0,
      modelUsage: [{ model: "GPT-4o", totalRequests: 1, totalAmount: 1.0 }],
      mostActiveUsers: [{ seatId: 1, githubUsername: "user-1", firstName: "Test", lastName: "User", totalRequests: 1, totalSpending: 1.0 }],
      leastActiveUsers: [],
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    await expect(card.getByText("N/A")).toBeVisible();
    await expect(card.getByText("0 / 0 requests")).toBeVisible();
  });

  test("allowance used card updates when month filter changes", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Current month: 38 active × 300 = 11,400; 9,500 used → 83%
    await seedDashboardSummary();

    // Previous month: 8 active × 300 = 2,400; 900 used → 38%
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    await seedSummaryForMonth(prevMonth, prevYear);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    // Verify current month percentage
    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    await expect(card.getByText("83%")).toBeVisible();

    // Switch to previous month
    const select = page.getByLabel("Month");
    await select.selectOption(`${prevMonth}-${prevYear}`);

    // Verify updated percentage (900 / 2400 = 37.5% → 38%)
    await expect(card.getByText("38%")).toBeVisible();
  });

  test("trend indicator shows correct direction and delta", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Current month: 38 active × 300 = 11,400; 9,500 used → 83.33%
    await seedDashboardSummary();

    // Previous month: 8 active × 300 = 2,400; 900 used → 37.5%
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    await seedSummaryForMonth(prevMonth, prevYear);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    // 83.33 - 37.5 = 45.83 → rounds to 46
    await expect(card.getByText("↑ 46% vs last month")).toBeVisible();
  });

  test("trend shows 'No prior data' when no previous month exists", async ({ page }) => {
    // Seed only current month — no previous month row
    await seedDashboardSummary();

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    await expect(card.getByText("No prior data")).toBeVisible();
  });

  test("trend shows 'No prior data' when previous month has 0 active seats", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    await seedDashboardSummary();

    // Previous month with 0 active seats → 0 allowance → "No prior data"
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    await seedSummaryForMonth(prevMonth, prevYear, {
      totalSeats: 5,
      activeSeats: 0,
      totalSpending: 0,
      seatBaseCost: 0,
      totalPremiumRequests: 0,
      includedPremiumRequestsUsed: 0,
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");
    await expect(card.getByText("No prior data")).toBeVisible();
  });

  test("trend updates when month filter changes", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Month C (current): 38 active × 300 = 11,400; 9,500 used → 83.33%
    await seedDashboardSummary();

    // Month B (prev): 8 active × 300 = 2,400; 900 used → 37.5%
    const monthB = currentMonth === 1 ? 12 : currentMonth - 1;
    const yearB = currentMonth === 1 ? currentYear - 1 : currentYear;
    await seedSummaryForMonth(monthB, yearB);

    // Month A (two months back): 10 active × 300 = 3,000; 1,500 used → 50%
    const monthA = monthB === 1 ? 12 : monthB - 1;
    const yearA = monthB === 1 ? yearB - 1 : yearB;
    await seedSummaryForMonth(monthA, yearA, {
      activeSeats: 10,
      includedPremiumRequestsUsed: 1500,
      totalPremiumRequests: 1500,
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const card = page.getByRole("heading", { name: /allowance used/i }).locator("..");

    // Current month (C): trend vs B → 83.33 - 37.5 = 45.83 → 46
    await expect(card.getByText("↑ 46% vs last month")).toBeVisible();

    // Switch to month B: trend vs A → 37.5 - 50 = -12.5 → Math.round(-12.5) = -12 → ↓ 12%
    const select = page.getByLabel("Month");
    await select.selectOption(`${monthB}-${yearB}`);
    await expect(card.getByText("↓ 12% vs last month")).toBeVisible();
  });
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

test.describe("Dashboard — Month Filter", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("month filter dropdown is visible on the dashboard", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(page.getByLabel("Month")).toBeVisible();
  });

  test("current month is selected by default", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();
    const expectedLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const select = page.getByLabel("Month");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(`${currentMonth}-${currentYear}`);
    // Verify the displayed text matches the expected month label
    await expect(select.locator("option:checked")).toHaveText(expectedLabel);
  });

  test("selecting a different month refreshes dashboard metrics", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Seed current month with specific values
    await seedDashboardSummary();

    // Seed a previous month with different values
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    await seedSummaryForMonth(prevMonth, prevYear, {
      totalSeats: 77,
      activeSeats: 55,
      totalSpending: 1500.0,
      seatBaseCost: 300.0,
      totalPremiumRequests: 8000,
      includedPremiumRequestsUsed: 4000,
      modelUsage: [
        { model: "Claude Haiku 4.5", totalRequests: 200, totalAmount: 800.0 },
      ],
      mostActiveUsers: [
        { seatId: 3, githubUsername: "prev-top-user", firstName: "Prev", lastName: "Top", totalRequests: 300, totalSpending: 150.0 },
      ],
      leastActiveUsers: [
        { seatId: 4, githubUsername: "prev-low-user", firstName: "Prev", lastName: "Low", totalRequests: 2, totalSpending: 1.0 },
      ],
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    // Verify current month data is displayed
    await expect(page.getByText("42")).toBeVisible();
    await expect(page.getByText("$770.00", { exact: true })).toBeVisible();

    // Switch to previous month
    const select = page.getByLabel("Month");
    await select.selectOption(`${prevMonth}-${prevYear}`);

    // Verify metrics update — previous month data
    await expect(page.getByText("77")).toBeVisible();
    await expect(page.getByText("$1500.00")).toBeVisible();
    await expect(page.getByText("Claude Haiku 4.5")).toBeVisible();
    await expect(page.getByText("prev-top-user")).toBeVisible();
  });

  test("all months with available data appear as options in the dropdown", async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Seed 3 months of data
    await seedDashboardSummary(); // current month

    const prevMonth1 = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear1 = currentMonth === 1 ? currentYear - 1 : currentYear;

    const prevMonth2 = currentMonth <= 2 ? (currentMonth === 1 ? 11 : 12) : currentMonth - 2;
    const prevYear2 = currentMonth <= 2 ? currentYear - 1 : currentYear;

    await seedSummaryForMonth(prevMonth1, prevYear1);
    await seedSummaryForMonth(prevMonth2, prevYear2);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const select = page.getByLabel("Month");
    await expect(select).toBeVisible();

    // Verify all 3 months appear as options
    const options = select.locator("option");
    await expect(options).toHaveCount(3);

    const expectedLabel1 = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
    const expectedLabel2 = `${MONTH_NAMES[prevMonth1 - 1]} ${prevYear1}`;
    const expectedLabel3 = `${MONTH_NAMES[prevMonth2 - 1]} ${prevYear2}`;

    await expect(options.filter({ hasText: expectedLabel1 })).toHaveCount(1);
    await expect(options.filter({ hasText: expectedLabel2 })).toHaveCount(1);
    await expect(options.filter({ hasText: expectedLabel3 })).toHaveCount(1);
  });

  test("most active user rows are clickable links to seat detail", async ({ page }) => {
    await seedDashboardSummary();
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const mostActiveHeading = page.getByRole("heading", { name: /most active users/i });
    const mostActiveCard = mostActiveHeading.locator("../..");
    const firstUserLink = mostActiveCard.getByRole("link", { name: /top-user-1/i });
    await expect(firstUserLink).toBeVisible();
    await expect(firstUserLink).toHaveAttribute("href", /\/usage\/seats\/101\?month=\d+&year=\d+/);
  });

});
