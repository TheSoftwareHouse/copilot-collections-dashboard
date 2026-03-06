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

test.describe("User Management", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  test("admin navigates to /users and sees user list with own account", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    await expect(
      page.getByRole("heading", { name: /management/i })
    ).toBeVisible();

    // Verify Users tab is active
    await expect(
      page.getByRole("tab", { name: /users/i, selected: true })
    ).toBeVisible();

    // The admin user should appear in the table
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("admin", { exact: true })).toBeVisible();
  });

  test("admin creates a new user and it appears in the list", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Click "Add User" button
    await page.getByRole("button", { name: /add user/i }).click();

    // Modal dialog should be visible with overlay
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("modal-overlay")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /add new user/i })).toBeVisible();

    // Fill the create form within the modal
    await dialog.getByLabel("Username").fill("newuser");
    await dialog.getByLabel("Password").fill("newpassword");
    await dialog.getByRole("button", { name: /create user/i }).click();

    // Modal should close after successful creation
    await expect(dialog).not.toBeVisible();

    // Wait for the user to appear in the table
    const table = page.locator("table");
    await expect(table.getByText("newuser")).toBeVisible();
  });

  test("validation and server errors display inside the create user modal", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Open modal and submit empty form
    await page.getByRole("button", { name: /add user/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /create user/i }).click();

    // Validation errors should display inside the still-open modal
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Username cannot be empty")).toBeVisible();

    // Close modal, create a user, then try to create a duplicate
    await dialog.getByLabel("Username").fill("dupuser");
    await dialog.getByLabel("Password").fill("duppassword");
    await dialog.getByRole("button", { name: /create user/i }).click();
    await expect(dialog).not.toBeVisible();

    // Verify user was created
    const table = page.locator("table");
    await expect(table.getByText("dupuser")).toBeVisible();

    // Open modal again and try to create with the same username
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Username").fill("dupuser");
    await dialog.getByLabel("Password").fill("anotherpass");
    await dialog.getByRole("button", { name: /create user/i }).click();

    // Server error should display inside the still-open modal
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/already exists/i)).toBeVisible();
  });

  test("pressing Escape closes the create user modal without creating a user", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Open the create modal and fill in data
    await page.getByRole("button", { name: /add user/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Username").fill("ghostuser");
    await dialog.getByLabel("Password").fill("ghostpass");

    // Press Escape to dismiss
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // No user should have been created
    await expect(page.getByText("ghostuser")).not.toBeVisible();
  });

  test("clicking overlay closes the create user modal without creating a user", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Open the create modal and fill in data
    await page.getByRole("button", { name: /add user/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Username").fill("overlayuser");
    await dialog.getByLabel("Password").fill("overlaypass");

    // Click on the overlay at the edge to dismiss
    const overlay = page.getByTestId("modal-overlay");
    await overlay.click({ position: { x: 10, y: 10 } });

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // No user should have been created
    await expect(page.getByText("overlayuser")).not.toBeVisible();
  });

  test("admin edits a user's username and updated name appears", async ({
    page,
  }) => {
    // Seed a second user to edit
    await seedTestUser("editme", "editpass");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Find the row for "editme" and click Edit
    const editmeRow = page.locator("tr", { hasText: "editme" });
    await editmeRow.getByRole("button", { name: /edit/i }).click();

    // The edit form should appear with the username pre-filled
    const usernameInput = page.getByLabel("Username");
    await expect(usernameInput).toHaveValue("editme");

    // Change the username
    await usernameInput.clear();
    await usernameInput.fill("renamed");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Verify updated username appears in table
    const table = page.locator("table");
    await expect(table.getByText("renamed")).toBeVisible();
    await expect(table.getByText("editme")).not.toBeVisible();
  });

  test("admin attempts to delete own account and sees error", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Find the row for "admin" and click Delete
    const adminRow = page.locator("tr", { hasText: "admin" });
    await adminRow.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion
    await expect(page.getByText(/are you sure/i)).toBeVisible();
    await page.getByRole("button", { name: /yes, delete/i }).click();

    // Error message should appear
    await expect(
      page.getByText(/cannot delete your own account/i)
    ).toBeVisible();

    // Admin should still be in the list
    const table = page.locator("table");
    await expect(table.getByText("admin", { exact: true })).toBeVisible();
  });

  test("admin deletes another user and they disappear from the list", async ({
    page,
  }) => {
    await seedTestUser("deleteme", "deletepass");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Verify user exists in the table first
    const table = page.locator("table");
    await expect(table.getByText("deleteme")).toBeVisible();

    // Find the row for "deleteme" and click Delete
    const userRow = page.locator("tr", { hasText: "deleteme" });
    await userRow.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion
    await expect(page.getByText(/are you sure/i)).toBeVisible();
    await page.getByRole("button", { name: /yes, delete/i }).click();

    // User should disappear from the table
    await expect(table.getByText("deleteme")).not.toBeVisible();
  });

  test("deleted user cannot log in", async ({ page }) => {
    // Seed and then delete a user
    await seedTestUser("tobedeleted", "temppass");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Delete the user via UI
    const userRow = page.locator("tr", { hasText: "tobedeleted" });
    await userRow.getByRole("button", { name: /delete/i }).click();
    await page.getByRole("button", { name: /yes, delete/i }).click();

    // Wait for deletion to complete
    await expect(page.locator("table").getByText("tobedeleted")).not.toBeVisible();

    // Now try to log in as the deleted user
    // First, log out by clearing cookies and navigating to login
    await page.context().clearCookies();
    await page.goto("/login");

    await page.getByLabel("Username").fill("tobedeleted");
    await page.getByLabel("Password").fill("temppass");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should see an error message, not be redirected to dashboard
    await expect(
      page.getByText(/invalid username or password/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("user list displays role badge for each user", async ({ page }) => {
    await seedTestUser("viewer", "viewerpass", "user");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Admin user should show "Admin" badge
    const adminRow = page.locator("tr", { hasText: "admin" });
    await expect(adminRow.getByLabel("Role: Admin")).toBeVisible();

    // Regular user should show "User" badge
    const viewerRow = page.locator("tr", { hasText: "viewer" });
    await expect(viewerRow.getByLabel("Role: User")).toBeVisible();
  });

  test("admin creates a user with Admin role and badge appears", async ({
    page,
  }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    await page.getByRole("button", { name: /add user/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Verify role selector defaults to "User"
    await expect(dialog.getByLabel("Role", { exact: true })).toHaveValue("user");

    // Fill form and select Admin role
    await dialog.getByLabel("Username").fill("newadmin");
    await dialog.getByLabel("Password").fill("newadminpass");
    await dialog.getByLabel("Role", { exact: true }).selectOption("admin");
    await dialog.getByRole("button", { name: /create user/i }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // New user should appear with Admin badge
    const newAdminRow = page.locator("tr", { hasText: "newadmin" });
    await expect(newAdminRow.getByLabel("Role: Admin")).toBeVisible();
  });

  test("admin edits a user's role from User to Admin", async ({ page }) => {
    await seedTestUser("promoteme", "promotepass", "user");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Verify user has "User" badge initially
    const userRow = page.locator("tr", { hasText: "promoteme" });
    await expect(userRow.getByLabel("Role: User")).toBeVisible();

    // Click Edit
    await userRow.getByRole("button", { name: /edit/i }).click();

    // Role selector should show current role "user"
    await expect(page.getByLabel("Role", { exact: true })).toHaveValue("user");

    // Change role to admin
    await page.getByLabel("Role", { exact: true }).selectOption("admin");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Verify badge updated
    const updatedRow = page.locator("tr", { hasText: "promoteme" });
    await expect(updatedRow.getByLabel("Role: Admin")).toBeVisible();
  });

  test("admin cannot change their own role", async ({ page }) => {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Edit the admin user (themselves)
    const adminRow = page.locator("tr", { hasText: "admin" });
    await adminRow.getByRole("button", { name: /edit/i }).click();

    // Change role to user
    await page.getByLabel("Role", { exact: true }).selectOption("user");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Self-role-change error should appear
    await expect(
      page.getByText(/cannot change your own role/i)
    ).toBeVisible();
  });

  test("admin can demote another admin when multiple admins exist", async ({ page }) => {
    // Seed a second admin so we can demote them, leaving only one admin
    await seedTestUser("admin2", "admin2pass", "admin");

    await loginViaApi(page, "admin", "password123");
    await page.goto("/management?tab=users");

    // Demote admin2 to user — succeeds because there are 2 admins
    const admin2Row = page.locator("tr", { hasText: "admin2" });
    await admin2Row.getByRole("button", { name: /edit/i }).click();
    await page.getByLabel("Role", { exact: true }).selectOption("user");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Verify admin2 is now a User
    await expect(
      page.locator("tr", { hasText: "admin2" }).getByLabel("Role: User")
    ).toBeVisible();
  });
});
