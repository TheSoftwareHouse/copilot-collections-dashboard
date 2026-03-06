import { defineConfig, devices } from "@playwright/test";
import { TEST_DB_URL } from "./e2e/helpers/db";

/**
 * Separate Playwright config for Azure-mode E2E tests.
 *
 * Runs `next dev` with AUTH_METHOD=azure on port 3001 to avoid
 * conflicting with the default credentials-mode server (.next lock).
 *
 * Usage: npx playwright test --config playwright.azure.config.ts
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "azure-mode",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "azure-login.spec.ts",
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: TEST_DB_URL,
      AUTH_METHOD: "azure",
      AZURE_TENANT_ID: "e2e-test-tenant-id",
      AZURE_CLIENT_ID: "e2e-test-client-id",
      AZURE_REDIRECT_URI: "http://localhost:3001/api/auth/callback",
    },
  },
});
