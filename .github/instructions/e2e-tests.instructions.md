---
name: 'E2E Test Conventions'
description: 'Playwright E2E test patterns with direct DB seeding via pg.Client, API-based login, and dual-config awareness. Applied when writing end-to-end tests.'
applyTo: 'e2e/**/*.ts'
---

# E2E Test Structure

Tests use raw `pg.Client` for database operations — no TypeORM in E2E tests.

## Database Access

```ts
import { getClient } from "./helpers/db";

const client = await getClient();
await client.query("INSERT INTO ...");
await client.end();  // Always close the client
```

## Authentication

Use API-based login — not the UI login form:

```ts
import { seedTestUser, loginViaApi } from "./helpers/auth";

test.beforeEach(async () => {
  await seedTestUser("admin", "password123");
});

test("page loads", async ({ page }) => {
  await loginViaApi(page, "admin", "password123");
  await page.goto("/management");
});
```

`seedTestUser()` inserts user with bcrypt-hashed password. `loginViaApi()` POSTs to `/api/auth/login` to set the session cookie.

## Cleanup Pattern

Each test file defines its own `clearAll()` function that truncates tables in foreign key order:

```ts
async function clearAll() {
  const client = await getClient();
  await client.query("DELETE FROM team_member_snapshot");
  await client.query("DELETE FROM team");
  await client.query("DELETE FROM configuration");
  // ... more tables in FK dependency order
  await client.end();
}

test.beforeEach(async () => {
  await clearAll();
  await seedConfiguration();
  await seedTestUser("admin", "password123");
});

test.afterAll(async () => {
  await clearAll();
});
```

## Seed Functions

Define per-file seed functions — NOT shared across test files:

```ts
async function seedTeam(name: string) {
  const client = await getClient();
  const result = await client.query("INSERT INTO team (name) VALUES ($1) RETURNING id", [name]);
  await client.end();
  return result.rows[0].id;
}
```

## Locators

Use accessible selectors — prefer `getByRole()`, `getByText()`, `getByLabel()` over CSS selectors:

```ts
await expect(page.getByText(/no teams found/i)).toBeVisible();
await page.getByRole("button", { name: "Add Team" }).click();
```

## Dual Config Awareness

Both configs must pass:
- `npx playwright test` — credentials-mode tests (excludes `azure-login.spec.ts`)
- `npx playwright test --config playwright.azure.config.ts` — Azure-mode tests only
