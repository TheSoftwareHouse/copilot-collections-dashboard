/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { getTestDataSource, cleanDatabase, destroyTestDataSource } from "@/test/db-helpers";

const MIGRATION_SQL = 'ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT \'user\'';

let testDs: DataSource;

beforeAll(async () => {
  testDs = await getTestDataSource();
});
afterAll(async () => {
  await destroyTestDataSource();
});
beforeEach(async () => {
  await cleanDatabase(testDs);
});
afterEach(async () => {
  await testDs.query(MIGRATION_SQL);
});

describe("User role migration (Story 1.4)", () => {
  it("backfills all existing users with 'user' role", async () => {
    await testDs.query('ALTER TABLE "app_user" DROP COLUMN "role"');
    await testDs.query(
      'INSERT INTO "app_user" ("username", "passwordHash") VALUES (\'alice\', \'hash1\'), (\'bob\', \'hash2\'), (\'carol\', \'hash3\')'
    );

    await testDs.query(MIGRATION_SQL);

    const rows = (await testDs.query('SELECT "role" FROM "app_user"')) as { role: string }[];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.role).toBe("user");
    }

    const nullCount = (await testDs.query(
      'SELECT COUNT(*) AS count FROM "app_user" WHERE "role" IS NULL'
    )) as { count: string }[];
    expect(Number(nullCount[0].count)).toBe(0);
  });

  it("NOT NULL constraint prevents NULL role values after migration", async () => {
    await expect(
      testDs.query(
        'INSERT INTO "app_user" ("username", "passwordHash", "role") VALUES (\'nulluser\', \'hash\', NULL)'
      )
    ).rejects.toThrow();
  });

  it("active sessions are not disrupted by migration", async () => {
    await testDs.query('ALTER TABLE "app_user" DROP COLUMN "role"');

    const userResult = (await testDs.query(
      'INSERT INTO "app_user" ("username", "passwordHash") VALUES (\'sessionuser\', \'hash\') RETURNING "id"'
    )) as { id: number }[];
    const userId = userResult[0].id;

    await testDs.query(
      'INSERT INTO "session" ("token", "userId", "expiresAt") VALUES (\'test-token-123\', $1, \'2099-01-01T00:00:00Z\')',
      [userId]
    );

    await testDs.query(MIGRATION_SQL);

    const rows = (await testDs.query(
      'SELECT s."token", u."role" FROM "session" s JOIN "app_user" u ON s."userId" = u."id" WHERE s."token" = \'test-token-123\''
    )) as { token: string; role: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token).toBe("test-token-123");
    expect(rows[0].role).toBe("user");
  });

  it("migration is idempotent (IF NOT EXISTS)", async () => {
    await testDs.query(
      'INSERT INTO "app_user" ("username", "passwordHash") VALUES (\'idempotent-user\', \'hash\')'
    );

    await testDs.query(MIGRATION_SQL);
    await testDs.query(MIGRATION_SQL);

    const rows = (await testDs.query(
      'SELECT "role" FROM "app_user" WHERE "username" = \'idempotent-user\''
    )) as { role: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("user");
  });
});
