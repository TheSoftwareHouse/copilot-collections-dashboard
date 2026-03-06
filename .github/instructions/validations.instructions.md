---
name: 'Validation Schema Conventions'
description: 'Zod schema naming, shared field patterns, type extraction, and update schema conventions. Applied when working on validation files.'
applyTo: 'src/lib/validations/**/*.ts'
---

# Zod Schema Conventions

One file per entity domain. All schemas in `src/lib/validations/`.

## Naming

| Element | Convention | Example |
|---|---|---|
| Create schema | `create{Entity}Schema` | `createTeamSchema` |
| Update schema | `update{Entity}Schema` | `updateSeatSchema` |
| Input type | `{Action}{Entity}Input` | `CreateTeamInput` |
| File name | Entity domain (singular) | `team.ts`, `seat.ts` |

## Shared Fields

Reusable field schemas live in `shared.ts`:

```ts
// src/lib/validations/shared.ts
export const nameFieldSchema = z.string({ error: "Name is required" })
  .trim()
  .min(1, "Name cannot be empty")
  .max(255, "Name must be 255 characters or fewer");
```

Import shared fields — don't duplicate:

```ts
import { nameFieldSchema } from "@/lib/validations/shared";
export const createTeamSchema = z.object({ name: nameFieldSchema });
```

## Type Extraction

Always extract TypeScript types with `z.infer<>`:

```ts
export const createDepartmentSchema = z.object({ name: nameFieldSchema });
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
```

## Update Schemas

Use `.refine()` when at least one field must be present:

```ts
export const updateSeatSchema = z.object({
  teamId: z.number().optional(),
  departmentId: z.number().nullable().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one field must be provided" }
);
```

## Nullable String Pattern

For optional nullable strings, use union + transform + pipe:

```ts
z.union([z.string(), z.null()])
  .optional()
  .transform(v => v === "" ? null : v)
  .pipe(z.string().max(255).nullable().optional());
```
