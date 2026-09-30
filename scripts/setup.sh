#!/usr/bin/env bash
# Bring up a clean, reproducible local environment. Safe to re-run at any time.
#
#   npm run setup                 # start stack, regenerate .env, reset DB from migrations
#   npm run setup -- --keep-data  # same, but don't reset the database
#
# Undo with: npm run teardown
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP_DATA=false
for arg in "$@"; do
  case "$arg" in
    --keep-data) KEEP_DATA=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

PROJECT_ID="meetup-v2"
step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

step "Checking prerequisites"
required_node="$(cat .nvmrc)"
current_node="$(node -p 'process.versions.node.split(".")[0]')"
[ "$current_node" = "$required_node" ] || fail "Node $required_node required (found $current_node). Run: nvm use"
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."

# Two Supabase stacks don't fit in Docker Desktop's default memory; containers go unhealthy.
others="$(docker ps --filter label=com.supabase.cli.project --format '{{.Label "com.supabase.cli.project"}}' | sort -u | grep -vx "$PROJECT_ID" || true)"
if [ -n "$others" ]; then
  fail "Other Supabase stack(s) running: $(echo "$others" | tr '\n' ' ')
  Stop them first (data is kept), e.g.: (cd ../meetup && supabase stop)"
fi
echo "ok"

step "Installing dependencies"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
else
  echo "up to date"
fi

step "Starting Supabase (pinned CLI $(npx supabase --version))"
npx supabase start

step "Writing .env"
bash scripts/write-env.sh

if [ "$KEEP_DATA" = false ]; then
  step "Resetting database from migrations"
  npx supabase db reset
fi

step "Done"
echo "Studio: http://127.0.0.1:54423   ·   Run tests: npm run test:all"
