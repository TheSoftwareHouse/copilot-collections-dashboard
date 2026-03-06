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

async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Authentication Flow", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("unauthenticated user visiting /dashboard is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: /sign in to copilot dashboard/i })
    ).toBeVisible();
  });

  test("login page shows credentials form and no Azure button", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /login with azure ad/i })
    ).not.toBeVisible();
  });

  test("user enters valid credentials and is redirected to /dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("user enters invalid credentials and sees error message", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(
      page.getByText(/invalid username or password/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("user submits empty fields and sees validation errors", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/cannot be empty/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("authenticated user visiting /login is redirected to /dashboard", async ({
    page,
  }) => {
    // Log in first
    await loginViaApi(page, "admin", "password123");

    // Now visit /login — should redirect
    await page.goto("/login");
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("user clicks Sign out and is redirected to /login", async ({
    page,
  }) => {
    // Log in first
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Click sign out
    await page.getByRole("button", { name: /sign out/i }).click();

    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page).toHaveURL(/\/login$/);

    // Verify cannot access dashboard anymore
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login$/);
  });
});
