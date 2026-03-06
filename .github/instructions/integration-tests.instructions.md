---
name: 'Integration Test Conventions'
description: 'Vitest integration test patterns with real PostgreSQL database, mock setup, seed functions, and assertion conventions. Applied when writing API route tests.'
applyTo: 'src/**/__tests__/**/*.ts'
---

# Integration Test Structure

Tests run against a real PostgreSQL test database — never mock database queries.

## Setup Pattern

```ts
import { DataSource } from "typeorm";
import { getTestDataSource, destroyTestDataSource, cleanDatabase } from "@/test/db-helpers";
// Import entities for seeding (these are fine as static imports)
import { TeamEntity } from "@/entities/team.entity";

let testDs: DataSource;

// Cookie mock — defined locally in each test file
let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

// Mock getDb BEFORE importing the module under test
vi.mock("@/lib/db", () => ({ getDb: async () => testDs }));

// Dynamic import AFTER mocks are established
const { GET, POST } = await import("@/app/api/teams/route");

beforeAll(async () => { testDs = await getTestDataSource(); });
afterAll(async () => { await destroyTestDataSource(); });
beforeEach(async () => { await cleanDatabase(testDs); mockCookieStore = {}; });
```

## Key Rules

- `vi.mock("@/lib/db")` MUST appear before `await import()` of the module under test
- Use `await import()` (dynamic import) — not static `import` — so mocks resolve correctly
- `beforeAll` → init test DataSource, `afterAll` → destroy, `beforeEach` → clean
- Mock `next/headers` for cookie access with a local `mockCookieStore` record (see Setup Pattern above)

## Auth-Protected Routes

Define `seedAuthSession` locally in each test file — it is NOT imported from a shared module:

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

Always test the 401 path (no session) alongside happy paths.

## Seed Functions

Define seed helpers per file — NOT shared across test files:

```ts
// Local to this test file
async function seedTeam(name: string) {
  const repo = testDs.getRepository(TeamEntity);
  return repo.save(repo.create({ name }));
}
```

## Assertions

```ts
const response = await GET();
expect(response.status).toBe(200);
const data = await response.json();
expect(data).toHaveLength(2);
```

Test both success and error paths: 200/201 for happy path, 400/401/404/409 for error paths.

## External API Mocks

Mock external services (GitHub API, etc.) with `vi.mock()` + `vi.mocked()`:

```ts
vi.mock("@/lib/github-api", () => ({ fetchSeats: vi.fn() }));
import { fetchSeats } from "@/lib/github-api";
vi.mocked(fetchSeats).mockResolvedValue([...]);
```
