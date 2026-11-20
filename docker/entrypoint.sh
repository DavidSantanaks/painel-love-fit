#!/bin/sh
# Applies migrations, runs the idempotent seed and starts the server.
set -e
echo "[entrypoint] applying database migrations…"
./node_modules/.bin/prisma migrate deploy
echo "[entrypoint] seed (only creates content on an empty database)…"
./node_modules/.bin/tsx scripts/seed.ts
echo "[entrypoint] starting app on :3000"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p 3000
