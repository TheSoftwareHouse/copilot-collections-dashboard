import { test, expect } from "@playwright/test";
import { clearAuthData } from "./helpers/auth";
import { getClient } from "./helpers/db";

/**
 * Helper: clear the configuration table via fetch to a test-reset endpoint.
 * Instead, we use direct DB access via the API: if config exists, we
 * need to clean it. Since there's no DELETE endpoint, we connect directly.
 *
 * For simplicity in E2E, we hit the API to check state, and use
 * pg directly for cleanup.
 */
async function clearConfiguration() {
  const client = await getClient();
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("First-Run Setup Flow", () => {
  test.beforeEach(async () => {
    await clearAuthData();
    await clearConfiguration();
  });

  test.afterAll(async () => {
    await clearAuthData();
    await clearConfiguration();
  });

  test("redirects from / to /setup when no configuration exists", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/setup");
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole("heading", { name: /first-run setup/i })
    ).toBeVisible();
  });
  test("fills form and submits successfully, redirected to login", async ({
    page,
  }) => {
    await page.goto("/setup");

    // Select "Organisation" radio
    await page.getByRole("radio", { name: "Organisation" }).check();

    // Fill in entity name
    await page.getByRole("textbox", { name: /organisation name/i }).fill("TheSoftwareHouse");

    // Submit the form
    await page.getByRole("button", { name: /save configuration/i }).click();

    // After config setup, user is redirected to /dashboard which requires auth
    // so they end up at /login
    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects from /setup to /login when configuration already exists", async ({
    page,
  }) => {
    // First, create a configuration via API
    const response = await page.request.post("/api/configuration", {
      data: {
        apiMode: "enterprise",
        entityName: "AcmeCorp",
      },
    });
    expect(response.status()).toBe(201);

    // Now visit /setup — should redirect to /dashboard, which requires auth
    // so ultimately redirects to /login
    await page.goto("/setup");
    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows validation error when submitting empty entity name", async ({
    page,
  }) => {
    await page.goto("/setup");

    // Select organisation radio
    await page.getByRole("radio", { name: "Organisation" }).check();

    // Leave entity name empty, submit
    await page.getByRole("button", { name: /save configuration/i }).click();

    // Should show validation error, stay on /setup
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByText(/cannot be empty/i)).toBeVisible();
  });
});
