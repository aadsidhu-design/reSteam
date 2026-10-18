#!/usr/bin/env bash
# Deploys safely: apply remote migrations first and confirm none are pending, then deploy the Worker, then smoke-test.
# Needs wrangler.jsonc (git-ignored) with account_id and database_id, and a signed-in `cf` CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
export CLOUDFLARE_ACCOUNT_ID=$(grep -o '"account_id": *"[^"]*"' wrangler.jsonc | cut -d'"' -f4)
DB=$(grep -o '"database_id": *"[^"]*"' wrangler.jsonc | cut -d'"' -f4)
out=$(cf d1 migrations apply "$DB" 2>&1) || { echo "$out"; echo "migration failed; not deploying" >&2; exit 1; }
echo "$out" | tail -6
# a second run must report nothing left to apply, otherwise the schema is behind the code
again=$(cf d1 migrations apply "$DB" 2>&1 || true)
if echo "$again" | grep -q "About to apply"; then echo "migrations still pending; not deploying" >&2; exit 1; fi
npm run deploy
url=$(grep -o 'https://[a-z0-9.-]*workers.dev' <(npx wrangler deployments list 2>/dev/null) | head -1 || true)
[ -n "${SHIP_URL:-}" ] && url="$SHIP_URL"
if [ -n "$url" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url/api/health")
  [ "$code" = "200" ] || { echo "health check failed ($code)" >&2; exit 1; }
  echo "health ok at $url"
fi
