import { test, expect, type Page } from "@playwright/test";
import { seedTestUser, loginViaApi } from "./helpers/auth";
import { getClient } from "./helpers/db";

const now = new Date();
const currentMonth = now.getUTCMonth() + 1;
const currentYear = now.getUTCFullYear();

// premiumRequestsPerSeat = 300 → 300 requests = 100% usage
const PREMIUM_REQUESTS_PER_SEAT = 300;

/**
 * Scope locator to the LowUsageSeatsTable component's root div
 * by finding the heading and moving to its parent container.
 */
function getLowUsageSection(page: Page) {
  return page
    .getByRole("heading", { name: "Low Usage Seats — This Month" })
    .locator("xpath=..");
}

function getLowUsageTable(page: Page) {
  return getLowUsageSection(page).locator("table");
}

async function seedConfiguration() {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey", "premiumRequestsPerSeat")
     VALUES ($1, $2, 'GLOBAL', $3)
     ON CONFLICT ("singletonKey") DO UPDATE SET "premiumRequestsPerSeat" = EXCLUDED."premiumRequestsPerSeat"`,
    ["organisation", "TestOrg", PREMIUM_REQUESTS_PER_SEAT]
  );
  await client.end();
}

interface SeedSeatOptions {
  githubUsername: string;
  githubUserId: number;
  status?: "active" | "inactive";
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
}

async function seedSeat(options: SeedSeatOptions): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status", "firstName", "lastName", "department")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ("githubUsername") DO UPDATE SET "firstName" = EXCLUDED."firstName"
     RETURNING id`,
    [
      options.githubUsername,
      options.githubUserId,
      options.status ?? "active",
      options.firstName ?? null,
      options.lastName ?? null,
      options.department ?? null,
    ]
  );
  await client.end();
  return result.rows[0].id;
}

async function seedUsage(
  seatId: number,
  day: number,
  grossQuantity: number
) {
  const client = await getClient();
  const usageItems = [
    {
      product: "Copilot",
      sku: "Premium",
      model: "Claude Sonnet 4.5",
      unitType: "requests",
      pricePerUnit: 0.04,
      grossQuantity,
      grossAmount: grossQuantity * 0.04,
      discountQuantity: 0,
      discountAmount: 0,
      netQuantity: 0,
      netAmount: 0,
    },
  ];
  await client.query(
    `INSERT INTO copilot_usage ("seatId", "day", "month", "year", "usageItems")
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [seatId, day, currentMonth, currentYear, JSON.stringify(usageItems)]
  );
  await client.end();
}

async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM copilot_usage");
  await client.query("DELETE FROM team_member_snapshot");
  await client.query("DELETE FROM team");
  await client.query("DELETE FROM copilot_seat");
  await client.query("DELETE FROM department");
  await client.query("DELETE FROM job_execution");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Low Usage Seats Table", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("should display section heading on Seats tab", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByRole("heading", { name: "Low Usage Seats — This Month" })
    ).toBeVisible();
  });

  test("should display empty state when all seats are at 100% usage or above", async ({
    page,
  }) => {
    // Seed a seat with exactly 100% usage (300 requests / 300 allowance)
    const seatId = await seedSeat({
      githubUsername: "full-usage-user",
      githubUserId: 1,
      firstName: "Full",
      lastName: "User",
      department: "Engineering",
    });
    await seedUsage(seatId, 1, PREMIUM_REQUESTS_PER_SEAT);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByText("All seats are at 100% usage or above this month.")
    ).toBeVisible();
  });

  test("should display empty state when no seats exist", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByText("All seats are at 100% usage or above this month.")
    ).toBeVisible();
  });

  test("should display correct seat data with username, display name, department, and usage percent", async ({
    page,
  }) => {
    // 150 / 300 = 50%
    const seatId = await seedSeat({
      githubUsername: "alice-dev",
      githubUserId: 10,
      firstName: "Alice",
      lastName: "Smith",
      department: "Engineering",
    });
    await seedUsage(seatId, 1, 150);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    // Verify column headers
    await expect(
      table.getByRole("columnheader", { name: /GitHub Username/i })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: /Display Name/i })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: /Department/i })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: /Usage %/i })
    ).toBeVisible();

    // Verify row data
    const row = table.locator("tbody tr", { hasText: "alice-dev" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Alice Smith")).toBeVisible();
    await expect(row.getByText("Engineering")).toBeVisible();
    await expect(row.getByText("50%")).toBeVisible();

    // Usage status indicator present
    await expect(row.getByRole("img", { name: /usage/i })).toBeVisible();
  });

  test("should display dash for missing display name and department", async ({
    page,
  }) => {
    const seatId = await seedSeat({
      githubUsername: "no-name-user",
      githubUserId: 20,
      firstName: null,
      lastName: null,
      department: null,
    });
    await seedUsage(seatId, 1, 60); // 20%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    const row = table.locator("tbody tr", { hasText: "no-name-user" });
    await expect(row).toBeVisible();

    // formatName returns "—" when both are null, department also shows "—"
    const cells = row.locator("td");
    await expect(cells.nth(1)).toHaveText("—");
    await expect(cells.nth(2)).toHaveText("—");
  });

  test("should only show active seats and exclude inactive seats", async ({
    page,
  }) => {
    // Active seat with low usage
    const activeId = await seedSeat({
      githubUsername: "active-user",
      githubUserId: 30,
      status: "active",
      firstName: "Active",
      lastName: "User",
      department: "Engineering",
    });
    await seedUsage(activeId, 1, 90); // 30%

    // Inactive seat with low usage — should not appear
    const inactiveId = await seedSeat({
      githubUsername: "inactive-user",
      githubUserId: 31,
      status: "inactive",
      firstName: "Inactive",
      lastName: "User",
      department: "Engineering",
    });
    await seedUsage(inactiveId, 1, 60); // 20%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table.getByText("active-user")).toBeVisible();
    await expect(table.getByText("inactive-user")).not.toBeVisible();
  });

  test("should sort by usage percent ascending by default", async ({
    page,
  }) => {
    // Seed three seats with different usage levels
    const seat1 = await seedSeat({
      githubUsername: "high-usage",
      githubUserId: 40,
      firstName: "High",
      lastName: "Usage",
    });
    await seedUsage(seat1, 1, 270); // 90%

    const seat2 = await seedSeat({
      githubUsername: "low-usage",
      githubUserId: 41,
      firstName: "Low",
      lastName: "Usage",
    });
    await seedUsage(seat2, 1, 30); // 10%

    const seat3 = await seedSeat({
      githubUsername: "mid-usage",
      githubUserId: 42,
      firstName: "Mid",
      lastName: "Usage",
    });
    await seedUsage(seat3, 1, 150); // 50%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    // Default sort: ascending by usagePercent → low-usage(10%), mid-usage(50%), high-usage(90%)
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("low-usage");
    await expect(rows.nth(1)).toContainText("mid-usage");
    await expect(rows.nth(2)).toContainText("high-usage");
  });

  test("should toggle sort direction when clicking a column header", async ({
    page,
  }) => {
    const seat1 = await seedSeat({
      githubUsername: "high-usage",
      githubUserId: 50,
      firstName: "High",
      lastName: "Usage",
    });
    await seedUsage(seat1, 1, 270); // 90%

    const seat2 = await seedSeat({
      githubUsername: "low-usage",
      githubUserId: 51,
      firstName: "Low",
      lastName: "Usage",
    });
    await seedUsage(seat2, 1, 30); // 10%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    // Default: ascending → low-usage first
    const rows = table.locator("tbody tr");
    await expect(rows.nth(0)).toContainText("low-usage");

    // Click Usage % header to toggle to descending
    await table
      .getByRole("button", { name: /Sort by Usage %/i })
      .click();

    // Now descending → high-usage first
    await expect(rows.nth(0)).toContainText("high-usage");
    await expect(rows.nth(1)).toContainText("low-usage");
  });

  test("should sort by GitHub Username when clicking that column header", async ({
    page,
  }) => {
    const seat1 = await seedSeat({
      githubUsername: "zebra-dev",
      githubUserId: 60,
      firstName: "Zebra",
      lastName: "Dev",
    });
    await seedUsage(seat1, 1, 150); // 50%

    const seat2 = await seedSeat({
      githubUsername: "alpha-dev",
      githubUserId: 61,
      firstName: "Alpha",
      lastName: "Dev",
    });
    await seedUsage(seat2, 1, 90); // 30%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    // Click GitHub Username header to sort by username ascending
    await table
      .getByRole("button", { name: /Sort by GitHub Username/i })
      .click();

    const rows = table.locator("tbody tr");
    await expect(rows.nth(0)).toContainText("alpha-dev");
    await expect(rows.nth(1)).toContainText("zebra-dev");
  });

  test("should show pagination when more than 10 low usage seats exist", async ({
    page,
  }) => {
    // Seed 12 active seats with low usage (all below 100%)
    const client = await getClient();
    for (let i = 1; i <= 12; i++) {
      const username = `user-${String(i).padStart(3, "0")}`;
      const result = await client.query(
        `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status", "firstName", "lastName", "department")
         VALUES ($1, $2, 'active', $3, $4, 'Engineering')
         ON CONFLICT ("githubUsername") DO UPDATE SET "firstName" = EXCLUDED."firstName"
         RETURNING id`,
        [username, 100 + i, `First${i}`, `Last${i}`]
      );
      const seatId = result.rows[0].id;
      // Each gets i * 10 requests → usage % from 3.3% to 40%
      const usageItems = [
        {
          product: "Copilot",
          sku: "Premium",
          model: "Claude Sonnet 4.5",
          unitType: "requests",
          pricePerUnit: 0.04,
          grossQuantity: i * 10,
          grossAmount: i * 10 * 0.04,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 0,
          netAmount: 0,
        },
      ];
      await client.query(
        `INSERT INTO copilot_usage ("seatId", "day", "month", "year", "usageItems")
         VALUES ($1, 1, $2, $3, $4::jsonb)`,
        [seatId, currentMonth, currentYear, JSON.stringify(usageItems)]
      );
    }
    await client.end();

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const lowUsageSection = getLowUsageSection(page);

    // Pagination should be visible — Page 1 of 2
    await expect(lowUsageSection.getByText(/Page 1 of 2/i)).toBeVisible();

    // Page 1 shows 10 rows
    const table = lowUsageSection.locator("table");
    await expect(table.locator("tbody tr")).toHaveCount(10);

    // Previous should be disabled on page 1
    const prevButton = lowUsageSection.getByRole("button", {
      name: /Previous/i,
    });
    await expect(prevButton).toBeDisabled();

    // Next should be enabled
    const nextButton = lowUsageSection.getByRole("button", {
      name: /Next/i,
    });
    await expect(nextButton).toBeEnabled();

    // Navigate to page 2
    await nextButton.click();

    await expect(lowUsageSection.getByText(/Page 2 of 2/i)).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(2);

    // Next disabled on last page
    await expect(nextButton).toBeDisabled();

    // Previous enabled
    await expect(prevButton).toBeEnabled();

    // Navigate back to page 1
    await prevButton.click();
    await expect(lowUsageSection.getByText(/Page 1 of 2/i)).toBeVisible();
  });

  test("should show active seat with zero usage when no usage records exist", async ({
    page,
  }) => {
    // Active seat without any usage records → 0% usage → should appear
    await seedSeat({
      githubUsername: "zero-usage-user",
      githubUserId: 70,
      firstName: "Zero",
      lastName: "Usage",
      department: "Product",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    const row = table.locator("tbody tr", { hasText: "zero-usage-user" });
    await expect(row).toBeVisible();
    await expect(row.getByText("0%")).toBeVisible();
    await expect(row.getByText("Zero Usage")).toBeVisible();
    await expect(row.getByText("Product")).toBeVisible();
  });

  test("should exclude seats at exactly 100% and above", async ({ page }) => {
    // Seat at 100% — should NOT appear
    const exactId = await seedSeat({
      githubUsername: "exact-100",
      githubUserId: 80,
      firstName: "Exact",
      lastName: "Hundred",
    });
    await seedUsage(exactId, 1, 300); // 100%

    // Seat above 100% — should NOT appear
    const overId = await seedSeat({
      githubUsername: "over-100",
      githubUserId: 81,
      firstName: "Over",
      lastName: "Hundred",
    });
    await seedUsage(overId, 1, 450); // 150%

    // Seat below 100% — should appear
    const belowId = await seedSeat({
      githubUsername: "below-100",
      githubUserId: 82,
      firstName: "Below",
      lastName: "Hundred",
    });
    await seedUsage(belowId, 1, 150); // 50%

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = getLowUsageTable(page);
    await expect(table).toBeVisible();

    await expect(table.getByText("below-100")).toBeVisible();
    await expect(table.getByText("exact-100")).not.toBeVisible();
    await expect(table.getByText("over-100")).not.toBeVisible();
  });

  test("should display table above job status cards", async ({ page }) => {
    // Seed seat so table is visible (not empty state)
    await seedSeat({
      githubUsername: "position-check",
      githubUserId: 90,
      firstName: "Position",
      lastName: "Check",
    });
    // No usage → 0% → will show in low usage table

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    // Verify the low usage heading appears in the tabpanel
    const seatsPanel = page.locator('[role="tabpanel"][id="tabpanel-seats"]');
    await expect(
      seatsPanel.getByRole("heading", { name: "Low Usage Seats — This Month" })
    ).toBeVisible();

    // Verify layout order: low usage section comes before job status cards
    // The heading for low usage appears first in the DOM
    const allHeadings = seatsPanel.locator("h2, h3");
    const firstHeading = allHeadings.first();
    await expect(firstHeading).toHaveText("Low Usage Seats — This Month");
  });
});
