---
name: writing-e2e-tests
description: "Write Playwright E2E tests with direct DB seeding, API-based login, accessible selectors, and dual-config awareness. Use when creating end-to-end tests, testing user flows, or verifying UI behavior."
---

# Writing E2E Tests

Creates Playwright E2E tests using direct database seeding and API-based authentication — the project's established pattern.

## Test Creation Process

Use the checklist below and track your progress:

```
Progress:
- [ ] Step 1: Set up the test file structure
- [ ] Step 2: Create seed and cleanup functions
- [ ] Step 3: Write test cases
- [ ] Step 4: Run both configs
```

**Step 1: Set up the test file structure**

Create the test file at `e2e/{feature-name}.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { seedTestUser, loginViaApi } from "./helpers/auth";
import { getClient } from "./helpers/db";
```

Key imports:
- `seedTestUser(username, password)` — inserts user with bcrypt-hashed password
- `loginViaApi(page, username, password)` — POSTs to `/api/auth/login` to set session cookie
- `getClient()` — returns a `pg.Client` connected to the test database

**Step 2: Create seed and cleanup functions**

Define all seed functions locally in the test file — NOT shared across files:

```ts
async function seedConfiguration() {
  const client = await getClient();
  await client.query(
    `INSERT INTO configuration ("apiMode", "entityName", "singletonKey") VALUES ($1, $2, 'GLOBAL')
     ON CONFLICT ("singletonKey") DO NOTHING`,
    ["organisation", "TestOrg"]
  );
  await client.end();
}

async function seedTeam(name: string): Promise<number> {
  const client = await getClient();
  const result = await client.query(
    `INSERT INTO team (name) VALUES ($1) RETURNING id`, [name]
  );
  await client.end();
  return result.rows[0].id;
}

async function clearAll() {
  const client = await getClient();
  // Delete in foreign-key dependency order
  await client.query("DELETE FROM team_member_snapshot");
  await client.query("DELETE FROM team");
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.query("DELETE FROM configuration");
  await client.end();
}
```

Rules:
- Use raw SQL with parameterized queries (`$1`, `$2`) — never string interpolation
- Always `client.end()` after each operation
- `clearAll()` deletes in FK dependency order (children before parents)
- Use `ON CONFLICT DO NOTHING` for idempotent configuration seeding

Set up lifecycle hooks:

```ts
test.beforeEach(async () => {
  await clearAll();
  await seedConfiguration();
  await seedTestUser("admin", "password123");
});

test.afterAll(async () => {
  await clearAll();
});
```

**Step 3: Write test cases**

```ts
test("displays empty state when no teams exist", async ({ page }) => {
  await loginViaApi(page, "admin", "password123");
  await page.goto("/management?tab=teams");
  await expect(page.getByText(/no teams found/i)).toBeVisible();
});

test("creates a new team via modal", async ({ page }) => {
  await loginViaApi(page, "admin", "password123");
  await page.goto("/management?tab=teams");
  
  await page.getByRole("button", { name: "Add Team" }).click();
  await page.getByLabel("Team Name").fill("Alpha Team");
  await page.getByRole("button", { name: "Create" }).click();
  
  await expect(page.getByText("Alpha Team")).toBeVisible();
});
```

Locator rules:
- Prefer accessible selectors: `getByRole()`, `getByText()`, `getByLabel()`
- Use regex for flexible text matching: `getByText(/no teams found/i)`
- Avoid CSS selectors unless no accessible alternative exists
- Use `page.waitForURL()` for route transitions

Common patterns:
- Login: `await loginViaApi(page, username, password)` — always before `page.goto()`
- Navigation: `await page.goto("/path")` — use absolute paths from root
- Assertions: `await expect(locator).toBeVisible()` — use Playwright's auto-waiting

**Step 4: Run both configs**

Both must pass before the feature is complete:

```bash
# Credentials-mode tests (excludes azure-login.spec.ts)
npx playwright test

# Azure-mode tests (azure-login.spec.ts only)
npx playwright test --config playwright.azure.config.ts
```

If the test only applies to credentials mode, no need to worry about the Azure config. But always state which mode the test targets.

## Connected Skills

- `writing-integration-tests` — complement E2E tests with API-level integration tests
- `creating-api-routes` — understand the API routes that E2E tests interact with
