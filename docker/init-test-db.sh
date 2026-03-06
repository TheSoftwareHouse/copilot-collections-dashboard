#!/bin/bash
# Creates the test database alongside the main database.
# This script runs automatically on first Postgres container start
# via the /docker-entrypoint-initdb.d/ mechanism.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE copilot_dashboard_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'copilot_dashboard_test')\gexec
EOSQL
