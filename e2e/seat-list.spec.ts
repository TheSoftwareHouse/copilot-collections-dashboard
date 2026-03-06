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

async function seedJobExecution(
  jobType: string,
  status: string,
  startedAt: string,
  completedAt: string | null = null,
  errorMessage: string | null = null,
  recordsProcessed: number | null = null
) {
  const client = await getClient();
  await client.query(
    `INSERT INTO job_execution ("jobType", "status", "startedAt", "completedAt", "errorMessage", "recordsProcessed")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [jobType, status, startedAt, completedAt, errorMessage, recordsProcessed]
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
  await client.query("DELETE FROM job_execution");
  await client.query("DELETE FROM copilot_seat");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Seat List", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("user navigates to /management?tab=seats and sees the tab active", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByRole("tab", { name: /seats/i, selected: true })
    ).toBeVisible();
  });

  test("Management navigation link navigates to management and Seats tab is accessible", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    const managementLink = page.getByRole("link", { name: "Management" });
    await expect(managementLink).toBeVisible();
    await managementLink.click();

    await page.waitForURL("**/management**", { timeout: 10000 });

    // Click the Seats tab
    await page.getByRole("tab", { name: /seats/i }).click();
    await expect(page).toHaveURL(/\/management\?tab=seats/);
    await expect(
      page.getByRole("tab", { name: /seats/i, selected: true })
    ).toBeVisible();
  });

  test("empty state is displayed when no seats exist", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByText(/no seats have been synced yet/i)
    ).toBeVisible();
  });

  test("seat table displays seeded seat data", async ({ page }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      status: "active",
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
      lastActivityAt: "2024-06-15T12:00:00.000Z",
    });
    await seedSeat({
      githubUsername: "devuser",
      githubUserId: 2,
      status: "active",
      firstName: "Dev",
      lastName: "User",
      department: "Product",
    });
    await seedSeat({
      githubUsername: "inactiveuser",
      githubUserId: 3,
      status: "inactive",
      firstName: null,
      lastName: null,
      department: null,
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Verify seat data is displayed
    await expect(table.getByText("octocat")).toBeVisible();
    await expect(table.getByText("devuser")).toBeVisible();
    await expect(table.getByText("inactiveuser")).toBeVisible();

    // Verify enrichment fields (now inside inline-editable cell buttons)
    const octocatRow = table.locator("tr", { hasText: "octocat" });
    await expect(octocatRow.getByRole("button", { name: /Edit first name/i })).toHaveText("Octo");
    await expect(octocatRow.getByRole("button", { name: /Edit department/i })).toHaveText("Engineering");
    const devRow = table.locator("tr", { hasText: "devuser" });
    await expect(devRow.getByRole("button", { name: /Edit department/i })).toHaveText("Product");

    // Verify Usage % column header is present
    await expect(table.getByRole("columnheader", { name: "Usage %" })).toBeVisible();

    // Active seats should display a usage status indicator next to the username
    const octoRow = page.locator("tr", { hasText: "octocat" });
    await expect(octoRow.getByRole("img", { name: /usage/i }).first()).toBeVisible();

    // Inactive seat should show N/A for usage and no indicator
    const inactiveRow = page.locator("tr", { hasText: "inactiveuser" });
    await expect(inactiveRow.getByText("N/A")).toBeVisible();
    await expect(inactiveRow.getByRole("img", { name: /usage/i })).not.toBeVisible();
  });

  test("inactive seat displays correct status badge", async ({ page }) => {
    await seedSeat({
      githubUsername: "inactiveuser",
      githubUserId: 10,
      status: "inactive",
    });

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // The inactive badge should be visible in the row
    const inactiveRow = page.locator("tr", { hasText: "inactiveuser" });
    await expect(inactiveRow.getByLabel("Status: Inactive")).toBeVisible();
  });

  test("pagination controls work with multiple pages", async ({ page }) => {
    // Seed 105 seats — default page size is 100, so this creates 2 pages
    await seedMultipleSeats(105);

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    // Should show page 1 with pagination info
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
    await expect(page.getByText(/showing 1–100 of 105 seats/i)).toBeVisible();

    // Previous should be disabled on page 1
    const prevButton = page.getByRole("button", { name: "Previous", exact: true });
    await expect(prevButton).toBeDisabled();

    // Next should be enabled
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextButton).toBeEnabled();

    // Navigate to page 2
    await nextButton.click();

    await expect(page.getByText(/page 2 of 2/i)).toBeVisible();
    await expect(page.getByText(/showing 101–105 of 105 seats/i)).toBeVisible();

    // Next should be disabled on last page
    await expect(nextButton).toBeDisabled();

    // Previous should now be enabled
    await expect(prevButton).toBeEnabled();

    // Navigate back to page 1
    await prevButton.click();

    await expect(page.getByText(/page 1 of 2/i)).toBeVisible();
  });
});

test.describe("Job Status Cards on Seats Tab", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("shows Seat Sync and Usage Collection cards with 'No runs recorded yet' when no executions exist", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const seatSyncCard = page
      .getByRole("article")
      .filter({ hasText: "Seat Sync" });
    await expect(seatSyncCard).toBeVisible();
    await expect(seatSyncCard.getByText("No runs recorded yet")).toBeVisible();

    const usageCard = page
      .getByRole("article")
      .filter({ hasText: "Usage Collection" });
    await expect(usageCard).toBeVisible();
    await expect(usageCard.getByText("No runs recorded yet")).toBeVisible();
  });

  test("shows correct job execution data when seeded", async ({ page }) => {
    await seedJobExecution(
      "seat_sync",
      "success",
      "2026-02-27T10:00:00Z",
      "2026-02-27T10:01:00Z",
      null,
      50
    );
    await seedJobExecution(
      "usage_collection",
      "failure",
      "2026-02-27T08:00:00Z",
      "2026-02-27T08:00:30Z",
      "GitHub API returned 503 Service Unavailable"
    );

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const seatSyncCard = page
      .getByRole("article")
      .filter({ hasText: "Seat Sync" });
    await expect(seatSyncCard).toBeVisible();
    await expect(seatSyncCard.getByText("Success")).toBeVisible();
    await expect(seatSyncCard.getByText("50")).toBeVisible();

    const usageCard = page
      .getByRole("article")
      .filter({ hasText: "Usage Collection" });
    await expect(usageCard).toBeVisible();
    await expect(usageCard.getByText("Failed")).toBeVisible();
    await expect(
      usageCard.getByText("GitHub API returned 503 Service Unavailable")
    ).toBeVisible();
  });

  test("Sync Now and Collect Now buttons are visible", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await expect(
      page.getByRole("button", { name: /trigger seat sync/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /trigger usage collection/i })
    ).toBeVisible();
  });

  test("job status error does not block the seat list table", async ({
    page,
  }) => {
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      status: "active",
      firstName: "Octo",
      lastName: "Cat",
    });

    await loginViaApi(page, "admin", "password123");

    // Intercept the job-status API to force a failure
    await page.route("**/api/job-status", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );

    await page.goto("/management?tab=seats");

    // The inline error should be visible
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByText(/failed to load job status/i)
    ).toBeVisible();

    // The seat list table should still render normally
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("octocat")).toBeVisible();
  });
});

test.describe("Month Data Recollection Modal on Seats Tab", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("Collect Specific Month button is visible on the Usage Collection card", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const usageCard = page.getByRole("article").filter({ hasText: "Usage Collection" });
    await expect(usageCard.getByRole("button", { name: "Collect Specific Month" })).toBeVisible();
  });

  test("clicking Collect Specific Month opens a modal with correct title and form controls", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Month Data Recollection" })).toBeVisible();
    await expect(dialog.locator("#recollection-month")).toBeVisible();
    await expect(dialog.locator("#recollection-year")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /trigger month recollection/i })).toBeVisible();
  });

  test("modal closes on Escape key press", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("modal closes on overlay click", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const overlay = page.getByTestId("modal-overlay");
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("modal closes on close button click", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("shows status badge inside modal when a successful month recollection execution exists", async ({ page }) => {
    await seedJobExecution(
      "month_recollection",
      "success",
      "2026-02-27T14:00:00Z",
      "2026-02-27T14:10:00Z",
      null,
      310
    );

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Success")).toBeVisible();
  });

  test("modal stays open after a successful recollection and shows success status", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.route("**/api/jobs/month-recollection*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobExecutionId: 1,
          status: "success",
          recordsProcessed: 50,
          usersProcessed: 5,
          usersErrored: 0,
          errorMessage: null,
        }),
      })
    );

    await dialog.getByRole("button", { name: /trigger month recollection/i }).click();

    await expect(dialog.getByText("Success")).toBeVisible();
    await expect(dialog.getByText(/recollected 50 records/i)).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("modal stays open after a failed recollection and shows failure status", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    await page.getByRole("button", { name: "Collect Specific Month" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.route("**/api/jobs/month-recollection*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobExecutionId: 2,
          status: "failure",
          recordsProcessed: 0,
          usersProcessed: 0,
          usersErrored: 0,
          errorMessage: "GitHub API timeout",
        }),
      })
    );

    await dialog.getByRole("button", { name: /trigger month recollection/i }).click();

    await expect(dialog.getByText("Failed")).toBeVisible();
    await expect(dialog.getByText(/github api timeout/i)).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});
