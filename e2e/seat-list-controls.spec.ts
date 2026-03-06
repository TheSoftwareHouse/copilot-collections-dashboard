import { test, expect } from "@playwright/test";
import { seedTestUser, loginViaApi } from "./helpers/auth";
import { getClient } from "./helpers/db";

async function seedConfiguration() {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey") VALUES ($1, $2, 'GLOBAL')
     ON CONFLICT ("singletonKey") DO NOTHING`,
    ["organisation", "TestOrg"]
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
  lastActivityAt?: string | null;
}

async function seedSeat(options: SeedSeatOptions) {
  const client = await getClient();
  await client.query(
    `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status", "firstName", "lastName", "department", "lastActivityAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("githubUsername") DO NOTHING`,
    [
      options.githubUsername,
      options.githubUserId,
      options.status ?? "active",
      options.firstName ?? null,
      options.lastName ?? null,
      options.department ?? null,
      options.lastActivityAt ?? null,
    ]
  );
  await client.end();
}

async function seedMultipleSeats(count: number) {
  const client = await getClient();
  for (let i = 1; i <= count; i++) {
    const username = `user-${String(i).padStart(3, "0")}`;
    await client.query(
      `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status", "firstName", "lastName", "department")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("githubUsername") DO NOTHING`,
      [username, i, "active", `First${i}`, `Last${i}`, "Engineering"]
    );
  }
  await client.end();
}

async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM copilot_seat");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Seat List Controls", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("search input is visible on the seats page", async ({ page }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const searchInput = page.locator("#seat-search");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("type", "search");
    await expect(searchInput).toHaveAttribute("placeholder", /search/i);
  });

  test("typing in search input filters the displayed seats by username", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "devuser",
      githubUserId: 2,
      firstName: "Dev",
      lastName: "User",
      department: "Product",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");
    await expect(table.getByText("octocat")).toBeVisible();
    await expect(table.getByText("devuser")).toBeVisible();

    // Type partial username to filter
    await page.locator("#seat-search").fill("octo");

    // Wait for debounce and re-fetch
    await expect(table.getByText("octocat")).toBeVisible();
    await expect(table.getByText("devuser")).not.toBeVisible();
  });

  test("search filters by first name, last name, and department", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "user-alpha",
      githubUserId: 1,
      firstName: "Alice",
      lastName: "Johnson",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "user-beta",
      githubUserId: 2,
      firstName: "Bob",
      lastName: "Smith",
      department: "Marketing",
    });
    await seedSeat({
      githubUsername: "user-gamma",
      githubUserId: 3,
      firstName: "Carol",
      lastName: "Williams",
      department: "Engineering",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");

    // Search by first name
    await page.locator("#seat-search").fill("Alice");
    await expect(table.getByText("user-alpha")).toBeVisible();
    await expect(table.getByText("user-beta")).not.toBeVisible();
    await expect(table.getByText("user-gamma")).not.toBeVisible();

    // Search by last name
    await page.locator("#seat-search").fill("Smith");
    await expect(table.getByText("user-beta")).toBeVisible();
    await expect(table.getByText("user-alpha")).not.toBeVisible();

    // Search by department
    await page.locator("#seat-search").fill("Marketing");
    await expect(table.getByText("user-beta")).toBeVisible();
    await expect(table.getByText("user-alpha")).not.toBeVisible();
    await expect(table.getByText("user-gamma")).not.toBeVisible();
  });

  test("clearing search restores all seats", async ({ page }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "devuser",
      githubUserId: 2,
      firstName: "Dev",
      lastName: "User",
      department: "Product",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");

    // Filter to one result
    await page.locator("#seat-search").fill("octo");
    await expect(table.getByText("devuser")).not.toBeVisible();

    // Clear search
    await page.locator("#seat-search").fill("");

    // Both seats should reappear
    await expect(table.getByText("octocat")).toBeVisible();
    await expect(table.getByText("devuser")).toBeVisible();
  });

  test("status filter dropdown is visible with correct options", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const statusFilter = page.locator("#seat-status-filter");
    await expect(statusFilter).toBeVisible();

    // Check options
    const options = statusFilter.locator("option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText("All Statuses");
    await expect(options.nth(1)).toHaveText("Active");
    await expect(options.nth(2)).toHaveText("Inactive");
  });

  test("selecting Active in status filter shows only active seats", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "active-user",
      githubUserId: 1,
      status: "active",
    });
    await seedSeat({
      githubUsername: "inactive-user",
      githubUserId: 2,
      status: "inactive",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");
    await expect(table.getByText("active-user", { exact: true })).toBeVisible();
    await expect(table.getByText("inactive-user", { exact: true })).toBeVisible();

    // Filter by active
    await page.locator("#seat-status-filter").selectOption("active");

    await expect(table.getByText("active-user", { exact: true })).toBeVisible();
    await expect(table.getByText("inactive-user", { exact: true })).not.toBeVisible();
  });

  test("selecting Inactive in status filter shows only inactive seats", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "active-user",
      githubUserId: 1,
      status: "active",
    });
    await seedSeat({
      githubUsername: "inactive-user",
      githubUserId: 2,
      status: "inactive",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");

    // Filter by inactive
    await page.locator("#seat-status-filter").selectOption("inactive");

    await expect(table.getByText("inactive-user", { exact: true })).toBeVisible();
    await expect(table.getByText("active-user", { exact: true })).not.toBeVisible();
  });

  test("page size selector is visible with correct options", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const pageSizeSelector = page.locator("#seat-page-size");
    await expect(pageSizeSelector).toBeVisible();

    const options = pageSizeSelector.locator("option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText("100 per page");
    await expect(options.nth(1)).toHaveText("200 per page");
    await expect(options.nth(2)).toHaveText("300 per page");
  });

  test("changing page size updates the number of displayed rows", async ({
    page,
  }) => {
    // Seed 150 seats — at 100 per page: 2 pages, at 200 per page: 1 page
    await seedMultipleSeats(150);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    // Default is 100 per page → 2 pages
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
    await expect(page.getByText(/showing 1–100 of 150 seats/i)).toBeVisible();

    // Change to 200 per page → 1 page
    await page.locator("#seat-page-size").selectOption("200");

    await expect(page.getByText(/page 1 of 1/i)).toBeVisible();
    await expect(page.getByText(/showing 1–150 of 150 seats/i)).toBeVisible();
  });

  test("clicking a column header sorts by that column", async ({ page }) => {
    await seedSeat({
      githubUsername: "charlie",
      githubUserId: 1,
      firstName: "Charlie",
      lastName: "Adams",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "alice",
      githubUserId: 2,
      firstName: "Alice",
      lastName: "Brown",
      department: "Product",
    });
    await seedSeat({
      githubUsername: "bob",
      githubUserId: 3,
      firstName: "Bob",
      lastName: "Clark",
      department: "Marketing",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    // Default sort is githubUsername ASC
    const table = page.locator("table");
    const rows = table.locator("tbody tr");
    await expect(rows.first()).toContainText("alice");

    // Click "First Name" header to sort by firstName ASC
    await page
      .getByRole("button", { name: /sort by first name/i })
      .click();

    // Verify first row contains "Alice" (firstName alphabetical ASC)
    await expect(rows.first()).toContainText("Alice");
    // Second should be "Bob"
    await expect(rows.nth(1)).toContainText("Bob");
    // Third should be "Charlie"
    await expect(rows.nth(2)).toContainText("Charlie");
  });

  test("clicking the same column header a second time reverses the sort order", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "alice",
      githubUserId: 1,
      firstName: "Alice",
    });
    await seedSeat({
      githubUsername: "charlie",
      githubUserId: 2,
      firstName: "Charlie",
    });
    await seedSeat({
      githubUsername: "bob",
      githubUserId: 3,
      firstName: "Bob",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");
    const rows = table.locator("tbody tr");

    // Default sort: githubUsername ASC → alice, bob, charlie
    await expect(rows.first()).toContainText("alice");

    // Click "GitHub Username" header (already active) to reverse order
    await page
      .getByRole("button", { name: /sort by github username/i })
      .click();

    // Now DESC → charlie, bob, alice
    await expect(rows.first()).toContainText("charlie");
    await expect(rows.last()).toContainText("alice");
  });

  test("combining search and status filter shows only matching seats", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "alice-eng",
      githubUserId: 1,
      status: "active",
      firstName: "Alice",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "bob-eng",
      githubUserId: 2,
      status: "inactive",
      firstName: "Bob",
      department: "Engineering",
    });
    await seedSeat({
      githubUsername: "carol-mkt",
      githubUserId: 3,
      status: "active",
      firstName: "Carol",
      department: "Marketing",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");

    // Search for "eng" (matches Engineering department for alice-eng and bob-eng)
    await page.locator("#seat-search").fill("eng");
    await expect(table.getByText("alice-eng")).toBeVisible();
    await expect(table.getByText("bob-eng")).toBeVisible();
    await expect(table.getByText("carol-mkt")).not.toBeVisible();

    // Now also filter by Active status — should only show alice-eng
    await page.locator("#seat-status-filter").selectOption("active");
    await expect(table.getByText("alice-eng")).toBeVisible();
    await expect(table.getByText("bob-eng")).not.toBeVisible();
  });
});
