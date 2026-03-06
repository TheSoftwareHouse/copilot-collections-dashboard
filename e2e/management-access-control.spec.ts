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

test.describe("Management Navigation Access Control", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("non-admin user does not see Management link in navigation", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: "Management" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  });

  test("admin user sees Management link in navigation", async ({ page }) => {
    await seedTestUser("admin", "password123", "admin");
    await loginViaApi(page, "admin", "password123");
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: "Management" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  });

  test("non-admin user sees only Dashboard and Usage in nav on Usage page", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");
    await page.goto("/usage");

    await expect(
      page.getByRole("link", { name: "Management" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  });
});

test.describe("Management Page Access Control", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("non-admin user is redirected from /management to /dashboard", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");
    await page.goto("/management");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /monthly usage overview/i })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("alert")
    ).toHaveCount(0);
  });

  test("admin user can access /management", async ({ page }) => {
    await seedTestUser("admin", "password123", "admin");
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management");

    await expect(page).toHaveURL(/\/management/);
    await expect(
      page.getByRole("heading", { name: /management/i })
    ).toBeVisible();
  });

  test("non-admin user redirected from /management preserves dashboard functionality", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");
    await page.goto("/management?tab=configuration");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /monthly usage overview/i })
    ).toBeVisible();
  });
});

test.describe("Management API Access Control", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("non-admin user receives 403 from GET /api/users", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");

    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  test("non-admin user receives 403 from GET /api/seats", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");

    const response = await page.request.get("/api/seats");
    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  test("non-admin user receives 403 from GET /api/configuration", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");

    const response = await page.request.get("/api/configuration");
    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  test("non-admin user receives 403 from POST /api/jobs/seat-sync", async ({
    page,
  }) => {
    await seedTestUser("viewer", "password123", "user");
    await loginViaApi(page, "viewer", "password123");

    const response = await page.request.post("/api/jobs/seat-sync");
    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  test("admin user can access management API endpoints", async ({ page }) => {
    await seedTestUser("admin", "password123", "admin");
    await loginViaApi(page, "admin", "password123");

    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(200);
  });
});
