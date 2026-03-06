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
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}

test.describe("Modal Component", () => {
  test.beforeEach(async () => {
    await clearAll();
    await seedConfiguration();
    await seedTestUser("admin", "password123");
  });

  test.afterAll(async () => {
    await clearAll();
  });

  async function openTestModalPage(page: import("@playwright/test").Page) {
    await loginViaApi(page, "admin", "password123");
    await page.goto("/test-modal");
    await expect(page.getByText("Modal Test Harness")).toBeVisible();
  }

  test("modal opens when trigger button is clicked and renders overlay and dialog", async ({
    page,
  }) => {
    await openTestModalPage(page);

    await page.getByRole("button", { name: "Open Modal" }).click();

    // Overlay is visible
    await expect(page.getByTestId("modal-overlay")).toBeVisible();

    // Dialog is visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Title is rendered
    await expect(
      dialog.getByRole("heading", { name: "First Modal" })
    ).toBeVisible();

    // Children content is rendered
    await expect(page.getByTestId("modal-children")).toBeVisible();
  });

  test("overlay has semi-transparent dark background", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    const overlay = page.getByTestId("modal-overlay");
    await expect(overlay).toBeVisible();

    // Verify the overlay has a background color with opacity (Tailwind v4 uses oklab)
    const bgColor = await overlay.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // bg-black/50 renders as oklab(0 0 0 / 0.5) in Tailwind v4 or rgba(0, 0, 0, 0.5)
    expect(bgColor).toMatch(/(?:rgba?\(0,\s*0,\s*0|oklab\(0\s+0\s+0\s*\/\s*0\.5\))/);
  });

  test("modal content is centered on screen", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    const overlay = page.getByTestId("modal-overlay");
    const overlayDisplay = await overlay.evaluate(
      (el) => getComputedStyle(el).display
    );
    expect(overlayDisplay).toBe("flex");

    const alignItems = await overlay.evaluate(
      (el) => getComputedStyle(el).alignItems
    );
    const justifyContent = await overlay.evaluate(
      (el) => getComputedStyle(el).justifyContent
    );
    expect(alignItems).toBe("center");
    expect(justifyContent).toBe("center");
  });

  test("pressing Escape closes the modal", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("clicking outside the modal content (on the overlay) closes the modal", async ({
    page,
  }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();

    // Click on the overlay at the top-left area (outside modal content)
    const overlay = page.getByTestId("modal-overlay");
    await overlay.click({ position: { x: 10, y: 10 } });

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("clicking inside the modal content does not close it", async ({
    page,
  }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Click inside the modal content area
    await page.getByTestId("modal-children").click();

    // Modal should still be open
    await expect(dialog).toBeVisible();
  });

  test("dialog has correct ARIA attributes", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // aria-labelledby should reference the title
    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    // The referenced element should contain the title text
    const titleElement = page.locator(`[id="${labelledBy}"]`);
    await expect(titleElement).toHaveText("First Modal");
  });

  test("focus is trapped within the modal", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();

    // Wait for focus to settle inside the modal
    await page.waitForTimeout(100);

    // Tab through all elements — focus should stay in the modal
    // The modal has: input, Inner Button, Close button (×)
    // Press Tab multiple times and check focus stays inside dialog
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(el) ?? false;
      });
      expect(activeElement).toBe(true);
    }

    // Also test Shift+Tab
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(el) ?? false;
      });
      expect(activeElement).toBe(true);
    }
  });

  test("title prop is rendered as the modal header", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    const dialog = page.getByRole("dialog");
    const heading = dialog.getByRole("heading", { level: 2 });
    await expect(heading).toHaveText("First Modal");
  });

  test("children content is rendered inside the modal", async ({ page }) => {
    await openTestModalPage(page);
    await page.getByRole("button", { name: "Open Modal" }).click();

    await expect(page.getByTestId("modal-children")).toBeVisible();
    await expect(page.getByTestId("modal-children")).toHaveText(
      "This is the first modal content."
    );
  });

  test("only one modal is visible at a time — opening second closes first", async ({
    page,
  }) => {
    await openTestModalPage(page);

    // Open first modal
    await page.getByRole("button", { name: "Open Modal" }).click();
    await expect(page.getByTestId("modal-children")).toBeVisible();

    // Open second modal while first is open
    // The second button is behind the overlay so we need to trigger it programmatically
    await page.evaluate(() => {
      // Find and click the "Open Second Modal" button
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent === "Open Second Modal");
      btn?.click();
    });

    // Wait for the second modal to appear
    await expect(page.getByTestId("second-modal-children")).toBeVisible();

    // First modal should be gone
    await expect(page.getByTestId("modal-children")).not.toBeVisible();
  });

  test("page behind modal does not scroll when modal is open", async ({
    page,
  }) => {
    await openTestModalPage(page);

    // Verify body can scroll before opening modal
    const overflowBefore = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(overflowBefore).not.toBe("hidden");

    await page.getByRole("button", { name: "Open Modal" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Body overflow should be hidden
    const overflowDuring = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(overflowDuring).toBe("hidden");

    // Close modal
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Body overflow should be restored
    const overflowAfter = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(overflowAfter).not.toBe("hidden");
  });
});
