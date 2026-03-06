---
name: creating-api-routes
description: "Scaffold new Next.js API route handlers with auth guards, Zod validation, error handling, and integration tests. Use when creating new API endpoints, adding CRUD operations, or building route handlers."
---

# Creating API Routes

Scaffolds complete API route handlers following the project's request lifecycle pattern, including validation schemas and integration tests.

## Creation Process

Use the checklist below and track your progress:

```
Progress:
- [ ] Step 1: Create the validation schema
- [ ] Step 2: Create the route handler
- [ ] Step 3: Create the integration test
- [ ] Step 4: Verify the route works
```

**Step 1: Create the validation schema**

Create a Zod schema in `src/lib/validations/{entity}.ts`:

```ts
import { z } from "zod";
import { nameFieldSchema } from "@/lib/validations/shared";

export const createTeamSchema = z.object({
  name: nameFieldSchema,
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

- Check `src/lib/validations/shared.ts` for reusable field schemas before defining new ones
- Naming: `create{Entity}Schema`, `update{Entity}Schema`
- Always extract the TypeScript type: `export type {Action}{Entity}Input = z.infer<typeof schema>`

**Step 2: Create the route handler**

Create the route file at `src/app/api/{resource}/route.ts` (or `src/app/api/{resource}/[id]/route.ts` for single-resource routes).

Every handler follows this exact skeleton:

```ts
import { NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { validateBody, isValidationError, handleRouteError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { EntityNameEntity } from "@/entities/entity-name.entity";
import { createEntitySchema } from "@/lib/validations/entity-name";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const dataSource = await getDb();
    const repo = dataSource.getRepository(EntityNameEntity);
    const items = await repo.find();
    return NextResponse.json(items);
  } catch (error) {
    return handleRouteError(error, "GET /api/resource");
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const parsed = await validateBody(request, createEntitySchema);
  if (isValidationError(parsed)) return parsed;

  try {
    const dataSource = await getDb();
    const repo = dataSource.getRepository(EntityNameEntity);
    const entity = repo.create(parsed.data);
    const saved = await repo.save(entity);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "POST /api/resource", {
      uniqueViolationMessage: "Resource with this name already exists",
    });
  }
}
```

For routes with URL params (`[id]`):

```ts
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id } = await context.params;
  const entityId = parseEntityId(id);
  if (entityId === null) return invalidIdResponse("resource");

  try {
    const dataSource = await getDb();
    const repo = dataSource.getRepository(EntityNameEntity);
    const item = await repo.findOneBy({ id: entityId });
    if (!item) throw new NotFoundError("Resource not found");
    return NextResponse.json(item);
  } catch (error) {
    return handleRouteError(error, "GET /api/resource/:id");
  }
}
```

**Step 3: Create the integration test**

Create the test file at `src/app/api/{resource}/__tests__/route.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { getTestDataSource, destroyTestDataSource, cleanDatabase } from "@/test/db-helpers";
import { EntityNameEntity } from "@/entities/entity-name.entity";

let testDs: DataSource;

let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

vi.mock("@/lib/db", () => ({ getDb: async () => testDs }));

const { GET, POST } = await import("@/app/api/resource/route");

beforeAll(async () => { testDs = await getTestDataSource(); });
afterAll(async () => { await destroyTestDataSource(); });
beforeEach(async () => { await cleanDatabase(testDs); mockCookieStore = {}; });

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

describe("GET /api/resource", () => {
  it("returns 401 without auth", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns items", async () => {
    await seedAuthSession();
    // seed test data...
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
  });
});

describe("POST /api/resource", () => {
  it("creates a new item", async () => {
    await seedAuthSession();
    const request = new Request("http://localhost/api/resource", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
```

Key rules:
- `vi.mock()` before `await import()` for correct mock resolution
- Test both 401 (no auth) and happy path
- Test validation errors (400) and unique violations (409) where applicable
- Define local seed functions — not shared across test files

**Step 4: Verify the route works**

1. Run the integration test: `npx vitest run src/app/api/{resource}/__tests__/route.test.ts`
2. Check types: `npx tsc --noEmit`
3. Check linting: `npm run lint`

## Connected Skills

- `creating-entities` — create the entity before creating the API route
- `writing-integration-tests` — detailed test patterns beyond the basics covered here
- `writing-e2e-tests` — add E2E coverage for the new endpoint's UI
