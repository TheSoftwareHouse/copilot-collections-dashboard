import { Client } from "pg";
import { execSync } from "child_process";
import { TEST_DB_URL } from "./helpers/db";

/**
 * Playwright global setup — ensures the test database exists and is migrated
 * before any E2E test runs.
 */
export default async function globalSetup() {
  // 1. Ensure the test database exists (connect to default `postgres` DB)
  const parsed = new URL(TEST_DB_URL);
  const adminUrl = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}/postgres`;
  const dbName = parsed.pathname.replace("/", "");

  const adminClient = new Client({ connectionString: adminUrl });

  try {
    await adminClient.connect();
  } catch (err) {
    throw new Error(
      `Failed to connect to PostgreSQL. Is the database running? (docker compose up)\n${err}`
    );
  }

  const result = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );

  if (result.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created test database: ${dbName}`);
  }

  await adminClient.end();

  // 2. If the test DB was created by Vitest's synchronize (migrations table empty),
  //    drop the public schema so migrations can run cleanly.
  const testClient = new Client({ connectionString: TEST_DB_URL });
  await testClient.connect();

  const migrationsCount = await testClient.query(
    `SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations'`,
  );
  const hasTable = migrationsCount.rows[0]?.cnt > 0;

  if (hasTable) {
    const records = await testClient.query("SELECT count(*)::int AS cnt FROM migrations");
    if (records.rows[0]?.cnt === 0) {
      // Schema was created by synchronize — no migration history; reset for clean migration run
      await testClient.query("DROP SCHEMA public CASCADE");
      await testClient.query("CREATE SCHEMA public");
    }
  }

  await testClient.end();

  // 3. Run TypeORM migrations against the test database using the existing CLI command
  execSync("npm run typeorm:migrate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}
