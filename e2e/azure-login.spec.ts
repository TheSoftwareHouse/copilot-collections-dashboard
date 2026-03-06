import { test, expect } from "@playwright/test";
import { getClient } from "./helpers/db";
import { randomBytes } from "crypto";

async function seedConfiguration() {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey") VALUES ($1, $2, 'GLOBAL')
     ON CONFLICT ("singletonKey") DO NOTHING`,
    ["organisation", "TestOrg"]
  );
  await client.end();
}

async function clearConfiguration() {
  const client = await getClient();
  await client.query("DELETE FROM configuration");
  await client.end();
}

/**
 * Seed a user and session directly in the DB, then set the session cookie.
 * In Azure mode, the standard loginViaApi cannot be used because
 * the credentials-based /api/auth/login endpoint is unavailable.
 */
async function seedAzureSession(page: import("@playwright/test").Page, role: string = "user") {
  const client = await getClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");

  const res = await client.query(
    `INSERT INTO app_user ("username", "passwordHash", "role") VALUES ($1, $2, $3) RETURNING id`,
    ["azureadmin", "AZURE_AD_USER", role]
  );
  const userId = res.rows[0].id;

  await client.query(
    `INSERT INTO session ("token", "userId", "expiresAt") VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  await client.end();

  await page.context().addCookies([
    {
      name: "session_token",
      value: token,
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.describe("Azure Login UI", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearConfiguration();
  });

  test("login page shows Azure AD login button", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("link", { name: /login with azure ad/i })
    ).toBeVisible();
  });

  test("login page does not show username/password fields", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Username")).not.toBeVisible();
    await expect(page.getByLabel("Password")).not.toBeVisible();
  });

  test("login page shows Azure-specific subtitle", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByText(/sign in with your organization's azure account/i)
    ).toBeVisible();
  });

  test("Azure AD button links to /api/auth/azure", async ({ page }) => {
    await page.goto("/login");

    const button = page.getByRole("link", { name: /login with azure ad/i });
    await expect(button).toHaveAttribute("href", "/api/auth/azure");
  });

  test("page heading remains unchanged", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /sign in to copilot dashboard/i })
    ).toBeVisible();
  });
});

test.describe("Azure PKCE Flow Initiation", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearConfiguration();
  });

  test("clicking Azure login button initiates redirect to Azure", async ({
    page,
  }) => {
    await page.goto("/login");

    // Intercept the redirect to Azure to avoid actually leaving the app
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/auth/azure") && resp.status() === 302,
      ),
      page.getByRole("link", { name: /login with azure ad/i }).click(),
    ]);

    const location = response.headers()["location"] || "";
    expect(location).toContain("https://login.microsoftonline.com/");
  });
});

test.describe("Azure Login Error Display", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearConfiguration();
  });

  test("login page displays auth_failed error message", async ({ page }) => {
    await page.goto("/login?error=auth_failed");

    await expect(
      page.getByRole("alert").getByText(/authentication failed or was cancelled/i)
    ).toBeVisible();
  });

  test("login page displays provider_unavailable error message", async ({
    page,
  }) => {
    await page.goto("/login?error=provider_unavailable");

    await expect(
      page
        .getByRole("alert")
        .getByText(/identity provider is currently unavailable/i)
    ).toBeVisible();
  });

  test("login page displays error with Azure login button still visible", async ({
    page,
  }) => {
    await page.goto("/login?error=token_exchange_failed");

    // Error banner is visible
    await expect(
      page
        .getByRole("alert")
        .getByText(/authentication could not be completed/i)
    ).toBeVisible();

    // Azure login button is still visible and clickable
    const button = page.getByRole("link", { name: /login with azure ad/i });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });
});

test.describe("Azure Mode User Management", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("Users tab shows informational notice about Azure AD", async ({
    page,
  }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/management?tab=users");

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/azure ad/i)).toBeVisible();
  });

  test("Add User button is not visible on the Users tab", async ({ page }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/management?tab=users");

    await expect(page.getByRole("button", { name: /add user/i })).not.toBeVisible();
  });

  test("Users tab is visible and clickable in the tab bar", async ({
    page,
  }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/management");

    const usersTab = page.getByRole("tab", { name: /users/i });
    await expect(usersTab).toBeVisible();
    await usersTab.click();

    await expect(page.getByRole("status")).toBeVisible();
  });

  test("other management tabs render their content normally", async ({
    page,
  }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/management?tab=configuration");

    // Configuration tab should render its content (not the Azure notice)
    await expect(page.getByRole("status")).not.toBeVisible();

    // Verify we're on the configuration tab - look for configuration-specific content
    const configTab = page.getByRole("tab", { name: /configuration/i });
    await expect(configTab).toBeVisible();
  });
});

test.describe("Azure Logout", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("user clicks Sign out and is redirected to Azure logout endpoint", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Intercept the navigation triggered by window.location.href to the Azure logout endpoint
    const navigationPromise = page.waitForURL(
      (url) => url.hostname === "login.microsoftonline.com",
      { timeout: 15000 },
    );

    await page.getByRole("button", { name: /sign out/i }).click();

    await navigationPromise;

    // Verify the browser navigated to the Azure AD logout endpoint
    expect(page.url()).toContain("https://login.microsoftonline.com/");
    expect(page.url()).toContain("/oauth2/v2.0/logout");
  });
});

test.describe("Azure Login with No App Roles", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("user with no Azure App Role can access Dashboard page", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: /monthly usage overview/i })
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("user with no Azure App Role can access Usage page", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/usage");

    await expect(
      page.getByRole("heading", { name: /usage analytics/i })
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("user with no Azure App Role sees Dashboard and Usage in navigation", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /usage/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign out/i })
    ).toBeVisible();
  });

  test("no error messages shown after Azure login with no App Roles", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    await page.goto("/usage");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Azure Mode Navigation Visibility", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("non-admin user does not see Management link", async ({ page }) => {
    await seedAzureSession(page);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: "Management" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  });

  test("admin user sees Management link", async ({ page }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: "Management" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  });
});

test.describe("Management Access Control — Azure Mode", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("non-admin Azure user is redirected from /management to /dashboard", async ({
    page,
  }) => {
    await seedAzureSession(page);
    await page.goto("/management");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /monthly usage overview/i })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("alert")
    ).toHaveCount(0);
  });

  test("admin Azure user can access /management", async ({ page }) => {
    await seedAzureSession(page, "admin");
    await page.goto("/management");

    await expect(page).toHaveURL(/\/management/);
    await expect(
      page.getByRole("heading", { name: /management/i })
    ).toBeVisible();
  });
});

test.describe("Management API Access Control — Azure Mode", () => {
  test.beforeEach(async () => {
    await clearConfiguration();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    const client = await getClient();
    await client.query("DELETE FROM session");
    await client.query("DELETE FROM app_user");
    await client.query("DELETE FROM configuration");
    await client.end();
  });

  test("non-admin Azure user receives 403 from management API", async ({
    page,
  }) => {
    await seedAzureSession(page);

    const response = await page.request.get("/api/configuration");
    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  test("admin Azure user can access management API", async ({ page }) => {
    await seedAzureSession(page, "admin");

    const response = await page.request.get("/api/configuration");
    expect(response.status()).toBe(200);
  });
});
