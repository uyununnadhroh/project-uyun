#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source "${E2E_ENV_FILE:-.env.test}"
set +a

# Reset hanya database lokal yang khusus untuk pengujian.
node - <<'NODE'
const db = new URL(process.env.DATABASE_URL ?? '');
if (!['postgresql:', 'postgres:'].includes(db.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) || !/^\/[a-zA-Z0-9_]+_test$/.test(db.pathname)) {
  throw new Error('Gunakan DATABASE_URL lokal dengan nama database berakhiran _test.');
}
NODE
: "${SUPABASE_URL:?Isi URL project Supabase khusus pengujian}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Isi service role project Supabase khusus pengujian}"
PORT="${TEST_PORT:-3100}"

npx prisma migrate reset --force --skip-seed
node --import tsx prisma/seed.ts
node --import tsx prisma/seed-demo.ts

LOG="$(mktemp)"
RATE_LIMIT_MULTIPLIER=100 ./node_modules/.bin/next start -H 127.0.0.1 -p "$PORT" > "$LOG" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true; rm -f "$LOG"' EXIT
export BASE_URL="http://localhost:$PORT"
for i in $(seq 1 30); do curl -sf "$BASE_URL/" >/dev/null && break; sleep 1; done
if ! curl -sf "$BASE_URL/" >/dev/null; then cat "$LOG"; exit 1; fi

node --import tsx scripts/e2e-test.ts
