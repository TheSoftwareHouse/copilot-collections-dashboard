---
name: 'Entity Conventions'
description: 'TypeORM EntitySchema definitions, interface co-export, column conventions, and relationship patterns. Applied when working on entity files.'
applyTo: 'src/entities/**/*.ts'
---

# Entity Definition Pattern

Always use `EntitySchema<Interface>` — never decorators. Each file exports both the TypeScript interface and the EntitySchema.

## File Structure

```ts
import { EntitySchema } from "typeorm";

export interface Team {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const TeamEntity = new EntitySchema<Team>({
  name: "Team",
  tableName: "team",
  columns: {
    id: { type: "int", primary: true, generated: "increment" },
    name: { type: "varchar", length: 255 },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
    deletedAt: { type: "timestamptz", nullable: true },
  },
  indices: [
    { name: "UQ_team_name_active", columns: ["name"], unique: true, where: '"deletedAt" IS NULL' },
  ],
});
```

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| File name | `{kebab-case}.entity.ts` | `team.entity.ts`, `copilot-seat.entity.ts`, `dashboard-monthly-summary.entity.ts` |
| Interface | PascalCase | `Team`, `CopilotSeat` |
| EntitySchema variable | `{PascalCase}Entity` | `TeamEntity`, `CopilotSeatEntity` |
| Table name | snake_case | `"team"`, `"copilot_seat"` |
| Column names | camelCase | `createdAt`, `deletedAt` |
| Index names | Prefix `UQ_` (unique) or `IDX_` (regular) | `"UQ_team_name_active"` |

## Column Conventions

- Primary keys: `type: "int"`, `generated: "increment"`
- Timestamps: `type: "timestamptz"` with `createDate: true` / `updateDate: true`
- Nullable fields: explicitly set `nullable: true`
- String lengths: always specify `length` on varchar columns
- Soft delete: use `deletedAt` nullable column (not TypeORM's built-in soft delete)

## Shared Enums

All enums live in `src/entities/enums.ts` — this includes `ApiMode`, `JobType`, `JobStatus`, `SeatStatus`. When an entity has enum columns, define the enum in and import it from `@/entities/enums`.

```ts
import { SeatStatus } from "@/entities/enums";
```

## Avoided Patterns

```ts
// Never use decorators
@Entity()
class Team {
  @PrimaryGeneratedColumn()
  id: number;
}

// Never separate interface from entity — keep in same file
// entities/team.interface.ts + entities/team.entity.ts ❌
```
