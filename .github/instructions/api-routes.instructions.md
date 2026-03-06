---
name: 'API Route Conventions'
description: 'Request lifecycle, auth checks, validation, error handling, and response conventions for Next.js API routes. Applied when working on API route handlers.'
applyTo: 'src/app/api/**/*.ts'
---

# API Route Handler Structure

Every handler follows this exact sequence — no exceptions:

1. Auth guard (before try/catch)
2. Body/param validation (before try/catch)  
3. Business logic (inside try/catch)
4. Error handling (catch block)

## Auth Guard — Always First

```ts
const auth = await requireAuth();
if (isAuthFailure(auth)) return auth;
```

Import from `@/lib/api-auth`. The type guard `isAuthFailure` narrows the result — after the guard, `auth` is the session object.

## Request Validation

Prefer `validateBody()` (combined JSON parsing + Zod validation):

```ts
// Preferred — single call handles JSON parsing + schema validation
const parsed = await validateBody(request, createTeamSchema);
if (isValidationError(parsed)) return parsed;
const { name } = parsed.data;
```

```ts
// Avoided — manual two-step approach
const body = await parseJsonBody(request);
if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
const result = createTeamSchema.safeParse(body);
```

## URL Parameter Parsing

For routes with dynamic segments (`[id]`), define a `RouteContext` type alias at the top of the file:

```ts
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  // ...
  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("entity-name");
```

`parseEntityId` returns `number | null`. Always guard with `invalidIdResponse("entity-name")`.

## Database Access

Always via `getDb()` from `@/lib/db`:

```ts
const dataSource = await getDb();
const repo = dataSource.getRepository(EntityName);
```

Never import or construct `DataSource` directly.

## Error Handling

Single `try/catch` wrapping the business logic block:

```ts
try {
  const dataSource = await getDb();
  // ... business logic
  return NextResponse.json(result, { status: 201 });
} catch (error) {
  return handleRouteError(error, "POST /api/resource", {
    uniqueViolationMessage: "Resource already exists",
  });
}
```

- Route name format: `"METHOD /api/path"` (used for logging)
- Provide `uniqueViolationMessage` when the entity has unique constraints

## Response Format

- Success: `NextResponse.json(data)` (200) or `NextResponse.json(data, { status: 201 })` for creation
- Errors: always `{ error: "message" }` format
- Validation errors: `{ error: "message", details: [...] }`

## Imports

Use `@/` path alias exclusively:

```ts
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { validateBody, isValidationError, handleRouteError, invalidIdResponse, parseEntityId } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
```
