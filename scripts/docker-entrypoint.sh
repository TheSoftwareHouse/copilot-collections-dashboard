#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node dist/scripts/run-migrations.js

echo "[entrypoint] Starting Next.js server..."
exec node server.js
