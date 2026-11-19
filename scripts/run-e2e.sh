#!/usr/bin/env bash
# Menjalankan test E2E pada database TERPISAH (hakuu_bakery_test) agar data uji tidak masuk ke DB utama.
# Prasyarat: PostgreSQL berjalan, user DB punya hak CREATEDB, `npm run build` sudah dijalankan,
#            paket playwright + chromium tersedia.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
BASE_DB_URL="${DATABASE_URL%%\?*}"
TEST_DB="${TEST_DB_NAME:-hakuu_bakery_test}"
ADMIN_URL="${BASE_DB_URL%/*}/postgres"
export DATABASE_URL="${BASE_DB_URL%/*}/${TEST_DB}?schema=public"
PORT="${TEST_PORT:-3100}"

psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)" -c "CREATE DATABASE ${TEST_DB}"
rm -rf ./storage-test
npx prisma migrate deploy >/dev/null
npx tsx prisma/seed.ts >/dev/null
npx tsx prisma/seed-demo.ts >/dev/null

STORAGE_DIR=./storage-test RATE_LIMIT_MULTIPLIER=100 npx next start -p "$PORT" > /tmp/hakuu-e2e-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf "http://localhost:$PORT/" >/dev/null && break; sleep 1; done

BASE_URL="http://localhost:$PORT" npx tsx scripts/e2e-test.ts
