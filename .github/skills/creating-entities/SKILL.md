---
name: creating-entities
description: "Scaffold TypeORM EntitySchema definitions with TypeScript interfaces, database migrations, and Zod validation schemas. Use when creating new database entities, adding tables, or modifying existing entity structures."
---

# Creating Entities

Scaffolds complete entity definitions following the project's EntitySchema pattern — interface, schema, migration, and validation in one workflow.

## Creation Process

Use the checklist below and track your progress:

```
Progress:
- [ ] Step 1: Define the entity interface and schema
- [ ] Step 2: Create the database migration
- [ ] Step 3: Register the entity
- [ ] Step 4: Create the validation schema
- [ ] Step 5: Verify everything works
```

**Step 1: Define the entity interface and schema**

Create `src/entities/{entity-name}.entity.ts`:

```ts
import { EntitySchema } from "typeorm";

export interface ResourceName {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ResourceNameEntity = new EntitySchema<ResourceName>({
  name: "ResourceName",
  tableName: "resource_name",
  columns: {
    id: { type: "int", primary: true, generated: "increment" },
    name: { type: "varchar", length: 255 },
    description: { type: "varchar", length: 1000, nullable: true },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  indices: [
    { name: "UQ_resource_name_name", columns: ["name"], unique: true },
  ],
});
```

Conventions:
- Interface name: PascalCase (`ResourceName`)
- Variable name: `{PascalCase}Entity` (`ResourceNameEntity`)
- Table name: snake_case (`resource_name`)
- Column names: camelCase in TypeScript, quoted in SQL
- Primary keys: `type: "int"`, `generated: "increment"`
- Timestamps: `type: "timestamptz"` with `createDate: true` / `updateDate: true`
- Nullable fields: explicitly `nullable: true`
- Index names: `UQ_` for unique, `IDX_` for non-unique
- Soft delete: nullable `deletedAt` column + partial unique index with `where: '"deletedAt" IS NULL'`
- Enum columns: define enums in `src/entities/enums.ts` and import from `@/entities/enums` (e.g., `import { SeatStatus } from "@/entities/enums"`)

**Step 2: Create the database migration**

Create `migrations/{timestamp}-Create{EntityName}.ts`. Generate a timestamp with `Date.now()`.

```ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateResourceName{timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "resource_name" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "description" VARCHAR(1000),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_resource_name_name" ON "resource_name" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_resource_name_name"`);
    await queryRunner.query(`DROP TABLE "resource_name"`);
  }
}
```

Rules:
- Raw SQL only — no TypeORM schema builder
- Quote column names with double quotes for PostgreSQL camelCase preservation
- `down()` drops in reverse order (indices before tables)
- Class name: `{PascalCaseDescription}{Timestamp}`

**Step 3: Register the entity**

Add the entity import to `src/lib/data-source.shared.ts` in the entities array.

> **Note:** `data-source.shared.ts` is an exception to the `@/` import rule — it uses **relative imports** because it is shared with the TypeORM CLI which does not understand path aliases.

```ts
import { ResourceNameEntity } from "../entities/resource-name.entity";
// Add to the entities array
```

Add the migration import to `src/lib/data-source.cli.ts` in the migrations array.

**Step 4: Create the validation schema**

Create `src/lib/validations/{entity-name}.ts`:

```ts
import { z } from "zod";
import { nameFieldSchema } from "@/lib/validations/shared";

export const createResourceNameSchema = z.object({
  name: nameFieldSchema,
  description: z.string().max(1000).nullable().optional(),
});

export type CreateResourceNameInput = z.infer<typeof createResourceNameSchema>;
```

Check `src/lib/validations/shared.ts` first for reusable field schemas.

**Step 5: Verify everything works**

1. Run Docker to test migrations: `docker compose up`
2. Check types: `npx tsc --noEmit`
3. Check linting: `npm run lint`
4. Run tests: `npx vitest run`

## Connected Skills

- `creating-api-routes` — create API endpoints for the new entity
- `writing-integration-tests` — write tests for entity operations
