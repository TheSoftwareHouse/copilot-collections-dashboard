---
name: writing-integration-tests
description: "Write Vitest integration tests against a real PostgreSQL test database with proper mock setup, seed functions, and assertion patterns. Use when creating tests for API routes, lib modules, or database operations."
---

# Writing Integration Tests

Creates integration tests that run against a real PostgreSQL test database — never mocked queries.

## Test Creation Process

Use the checklist below and track your progress:

```
Progress:
- [ ] Step 1: Set up the test file structure
- [ ] Step 2: Create seed helpers
- [ ] Step 3: Write test cases
- [ ] Step 4: Run and verify
```

**Step 1: Set up the test file structure**

Create the test file at `src/app/api/{resource}/__tests__/route.test.ts` (for API routes) or `src/lib/__tests__/{module}.test.ts` (for lib modules).

The setup follows a strict ordering:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { getTestDataSource, destroyTestDataSource, cleanDatabase } from "@/test/db-helpers";
// Import entities for seeding (these are fine as static imports)
import { TeamEntity } from "@/entities/team.entity";

// 1. Declare the DataSource variable
let testDs: DataSource;

// 2. Cookie mock — defined locally in each test file
let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

// 3. Mock getDb BEFORE the dynamic import
vi.mock("@/lib/db", () => ({ getDb: async () => testDs }));

// 4. Mock external services (if needed)
vi.mock("@/lib/github-api", () => ({
  fetchSeats: vi.fn(),
}));

// 5. Dynamic import AFTER all mocks — this is critical
const { GET, POST } = await import("@/app/api/teams/route");

// 6. Lifecycle hooks
beforeAll(async () => { testDs = await getTestDataSource(); });
afterAll(async () => { await destroyTestDataSource(); });
beforeEach(async () => { await cleanDatabase(testDs); mockCookieStore = {}; });
```

Critical ordering rules:
- `vi.mock()` calls must come before `await import()` of the module under test
- Use `await import()` (dynamic), not static `import` — this ensures mocks resolve correctly
- Static imports of entities and test helpers are fine (they don't depend on mocks)

**Step 2: Create seed helpers**

Define per-file seed functions — these are NOT shared across test files:

```ts
async function seedTeam(name: string, overrides?: Partial<Team>) {
  const repo = testDs.getRepository(TeamEntity);
  return repo.save(repo.create({ name, ...overrides }));
}

async function seedConfiguration() {
  const repo = testDs.getRepository(ConfigurationEntity);
  return repo.save(repo.create({
    githubOrg: "test-org",
    githubToken: "test-token",
    seatBaseCost: 39,
  }));
}
```

For auth-protected routes, define `seedAuthSession` locally in each test file — it is NOT imported from a shared module:

```ts
async function seedAuthSession(): Promise<void> {
  const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import("@/lib/auth");
  const { UserEntity } = await import("@/entities/user.entity");
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}
```

Usage: `await seedAuthSession();` — no arguments needed (uses `testDs` and `mockCookieStore` from file scope).

**Step 3: Write test cases**

Cover these scenarios for every endpoint:

| Scenario | Expected |
|---|---|
| No auth session | 401 |
| Valid request | 200/201 with correct body |
| Invalid body | 400 with error message |
| Missing resource | 404 |
| Unique violation | 409 |
| Invalid ID param | 400 |

```ts
describe("GET /api/teams", () => {
  it("returns 401 without auth", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns active teams ordered by name", async () => {
    await seedAuthSession();
    await seedTeam("Bravo");
    await seedTeam("Alpha");
    
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Alpha");
  });
});

describe("POST /api/teams", () => {
  it("creates a new team", async () => {
    await seedAuthSession();
    const request = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Team" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe("New Team");
  });

  it("returns 409 for duplicate name", async () => {
    await seedAuthSession();
    await seedTeam("Existing");
    const request = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Existing" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});
```

For mocking external services:

```ts
import { fetchSeats } from "@/lib/github-api";

it("syncs seats from GitHub", async () => {
  vi.mocked(fetchSeats).mockResolvedValue([
    { login: "user1", created_at: "2024-01-01" },
  ]);
  // ... test the sync function
});
```

**Step 4: Run and verify**

```
npx vitest run src/app/api/{resource}/__tests__/route.test.ts
```

Check that:
- All tests pass
- Both happy and error paths are covered
- No test data leaks between tests (each test seeds its own data)
- `cleanDatabase(testDs)` runs in `beforeEach`

## Quick Reference

| Helper | Source | Purpose |
|---|---|---|
| `getTestDataSource()` | `@/test/db-helpers` | Creates test DB connection with `synchronize: true` |
| `destroyTestDataSource()` | `@/test/db-helpers` | Closes test DB connection |
| `cleanDatabase(ds)` | `@/test/db-helpers` | Truncates all tables between tests |
| `seedAuthSession()` | Defined locally in each test file | Seeds user + session, sets cookie in `mockCookieStore` |
| `mockCookieStore` | Defined locally in each test file | `Record<string, string>` for cookie mock |

## Connected Skills

- `creating-api-routes` — includes basic test scaffolding as part of the route creation workflow
- `writing-e2e-tests` — complement integration tests with full user flow E2E tests
