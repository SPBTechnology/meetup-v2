#!/usr/bin/env bash
# Tear the local environment down.
#
#   npm run teardown                 # stop stack, DELETE its local data volumes, remove .env
#   npm run teardown -- --keep-data  # stop stack only; data and .env kept
#
# Rebuild with: npm run setup
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP_DATA=false
for arg in "$@"; do
  case "$arg" in
    --keep-data) KEEP_DATA=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$KEEP_DATA" = true ]; then
  npx supabase stop
  echo "Stopped. Data kept. Restart with: npm run setup -- --keep-data"
else
  npx supabase stop --no-backup
  rm -f .env
  echo "Stopped and removed local data and .env. Rebuild with: npm run setup"
fi
