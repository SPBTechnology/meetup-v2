#!/usr/bin/env bash
# Fail if src/types/database.types.ts is out of date with the migrations.
# Fix with: npm run db:reset && npm run db:types
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
npx supabase gen types typescript --local --schema public > "$tmp"

if ! diff -q "$tmp" src/types/database.types.ts >/dev/null; then
  echo "✗ src/types/database.types.ts is stale. Run: npm run db:reset && npm run db:types" >&2
  diff "$tmp" src/types/database.types.ts | head -40 >&2
  exit 1
fi
echo "✓ database types up to date"
