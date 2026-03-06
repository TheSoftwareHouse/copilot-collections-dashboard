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
  await client.query("DELETE FROM copilot_usage");
  await client.query("DELETE FROM team_member_snapshot");
  await client.query("DELETE FROM copilot_seat");
  await client.query("DELETE FROM team");
  await client.query("DELETE FROM department");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

async function seedTeam(name: string): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO team (name) VALUES ($1) RETURNING id`,
    [name]
  );
  await client.end();
  return result.rows[0].id;
}

async function seedDepartment(name: string): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO department (name) VALUES ($1) RETURNING id`,
    [name]
  );
  await client.end();
  return result.rows[0].id;
}

async function seedSeat(githubUsername: string): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO copilot_seat ("githubUsername", "githubUserId", "status")
     VALUES ($1, $2, 'active')
     ON CONFLICT ("githubUsername") DO UPDATE SET status = 'active'
     RETURNING id`,
    [githubUsername, Math.floor(Math.random() * 1_000_000)]
  );
  await client.end();
  return result.rows[0].id;
}

test.describe("Cross-linking from management to usage pages", () => {
  let teamId: number;
  let departmentId: number;
  let seatId: number;

  test.beforeAll(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
    teamId = await seedTeam("CrossLink Team");
    departmentId = await seedDepartment("CrossLink Dept");
    seatId = await seedSeat("crosslink-user");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("team name in management links to team usage page", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=teams");

    // Team name is now an inline-editable cell; navigate via the → link in the same row
    const row = page.locator("table").getByRole("row").filter({ hasText: "CrossLink Team" });
    const navLink = row.getByRole("link", { name: /view team usage/i });
    await expect(navLink).toBeVisible();
    await navLink.click();

    await page.waitForURL(`**/usage/teams/${teamId}**`, { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(`/usage/teams/${teamId}`));
  });

  test("department name in management links to department usage page", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=departments");

    // Department name is now an inline-editable cell; navigate via the → link in the same row
    const row = page.locator("table").getByRole("row").filter({ hasText: "CrossLink Dept" });
    const navLink = row.getByRole("link", { name: /view department usage/i });
    await expect(navLink).toBeVisible();
    await navLink.click();

    await page.waitForURL(`**/usage/departments/${departmentId}**`, {
      timeout: 10000,
    });
    await expect(page).toHaveURL(
      new RegExp(`/usage/departments/${departmentId}`)
    );
  });

  test("seat username in management links to seat usage page", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=seats");

    const seatLink = page.getByRole("link", { name: "crosslink-user" });
    await expect(seatLink).toBeVisible();
    await seatLink.click();

    await page.waitForURL(`**/usage/seats/${seatId}**`, { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(`/usage/seats/${seatId}`));
  });
});
