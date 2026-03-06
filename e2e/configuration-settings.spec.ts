import { test, expect } from "@playwright/test";
import { seedTestUser, loginViaApi, clearAuthData } from "./helpers/auth";
import { getClient } from "./helpers/db";

async function clearConfiguration() {
  const client = await getClient();
  await client.query("DELETE FROM configuration");
  await client.end();
}

async function seedConfiguration(
  apiMode: string = "organisation",
  entityName: string = "TestOrg"
) {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey") VALUES ($1, $2, 'GLOBAL')`,
    [apiMode, entityName]
  );
  await client.end();
}

test.describe("Configuration Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthData();
    await clearConfiguration();
    await seedConfiguration("organisation", "TheSoftwareHouse");
    await seedTestUser("admin", "password123");
    await loginViaApi(page, "admin", "password123");
  });

  test.afterAll(async () => {
    await clearAuthData();
    await clearConfiguration();
  });

  test("displays current configuration values pre-filled in the form", async ({
    page,
  }) => {
    await page.goto("/management?tab=configuration");

    // Verify heading
    await expect(
      page.getByRole("heading", { name: /management/i })
    ).toBeVisible();

    // Verify Configuration tab is active
    await expect(
      page.getByRole("tab", { name: /configuration/i, selected: true })
    ).toBeVisible();

    // Verify radio is pre-selected to Organisation
    await expect(
      page.getByRole("radio", { name: "Organisation" })
    ).toBeChecked();

    // Verify entity name is pre-filled
    await expect(
      page.getByRole("textbox", { name: /organisation name/i })
    ).toHaveValue("TheSoftwareHouse");
  });

  test("updates configuration and shows success message", async ({ page }) => {
    await page.goto("/management?tab=configuration");

    // Change API mode to Enterprise
    await page.getByRole("radio", { name: "Enterprise" }).check();

    // Clear and fill new entity name
    await page
      .getByRole("textbox", { name: /enterprise name/i })
      .fill("AcmeCorp");

    // Submit the form
    await page.getByRole("button", { name: /update configuration/i }).click();

    // Verify success message appears
    await expect(
      page.getByText(/configuration updated successfully/i)
    ).toBeVisible();

    // Reload and verify values persisted
    await page.reload();
    await expect(
      page.getByRole("radio", { name: "Enterprise" })
    ).toBeChecked();
    await expect(
      page.getByRole("textbox", { name: /enterprise name/i })
    ).toHaveValue("AcmeCorp");
  });

  test("shows validation error when submitting empty entity name", async ({
    page,
  }) => {
    await page.goto("/management?tab=configuration");

    // Clear entity name
    await page.getByRole("textbox", { name: /organisation name/i }).fill("");

    // Submit the form
    await page.getByRole("button", { name: /update configuration/i }).click();

    // Should show validation error
    await expect(page.getByText(/cannot be empty/i)).toBeVisible();

    // Should stay on management page with configuration tab
    await expect(page).toHaveURL(/\/management\?tab=configuration/);
  });

  test("displays premium requests per seat field with default value", async ({
    page,
  }) => {
    await page.goto("/management?tab=configuration");

    // Verify the premium requests per seat input is visible
    const input = page.getByRole("spinbutton", {
      name: /premium requests per seat/i,
    });
    await expect(input).toBeVisible();

    // Should show default value of 300
    await expect(input).toHaveValue("300");
  });

  test("updates premium requests per seat and persists the value", async ({
    page,
  }) => {
    await page.goto("/management?tab=configuration");

    // Change the premium requests per seat value
    const input = page.getByRole("spinbutton", {
      name: /premium requests per seat/i,
    });
    await input.fill("500");
    await expect(input).toHaveValue("500");

    // Submit the form and wait for the PUT response to complete
    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/configuration") &&
          resp.request().method() === "PUT",
      ),
      page.getByRole("button", { name: /update configuration/i }).click(),
    ]);
    expect(putResponse.status()).toBe(200);

    // Verify success message appears
    await expect(
      page.getByText(/configuration updated successfully/i)
    ).toBeVisible();

    // Reload and verify value persisted
    await page.reload();
    await expect(
      page.getByRole("spinbutton", {
        name: /premium requests per seat/i,
      })
    ).toHaveValue("500");
  });

  test("navigation bar is present with working links", async ({ page }) => {
    await page.goto("/management?tab=configuration");

    // Verify navigation is present
    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).toBeVisible();

    // Verify exactly three links exist
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Usage" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Management" })).toBeVisible();

    // Verify old links are removed
    await expect(nav.getByRole("link", { name: "Settings" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Seats" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Teams" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Departments" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).not.toBeVisible();

    // Click Dashboard link and verify navigation
    await nav.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard$/);

    // Verify navbar is also on dashboard
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeVisible();

    // Navigate to Management and verify Seats tab is active (default tab)
    await page
      .getByRole("navigation", { name: /main navigation/i })
      .getByRole("link", { name: "Management" })
      .click();
    await page.waitForURL("**/management**", { timeout: 10000 });
    await expect(page).toHaveURL(/\/management/);
    await expect(
      page.getByRole("tab", { name: /seats/i, selected: true })
    ).toBeVisible();
  });
});
