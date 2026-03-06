// Vitest global setup — sets DATABASE_URL to the test database
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  "postgres://postgres:postgres@localhost:5432/copilot_dashboard_test";
