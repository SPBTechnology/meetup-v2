#!/usr/bin/env bash
# Fail if a change touches the schema or dependencies without touching
# docs/context/ (ADR 0007). Crude on purpose: it catches the kind of drift the
# prototype suffered (auth switched, docs never updated).
#
#   bash scripts/check-context-docs.sh [base-ref]   # default: origin/main
set -euo pipefail
cd "$(dirname "$0")/.."

base="${1:-origin/main}"
changed="$(git diff --name-only "$base"...HEAD)"

if echo "$changed" | grep -qE '^(supabase/migrations/|package\.json$)' \
   && ! echo "$changed" | grep -q '^docs/context/'; then
  echo "✗ Schema or dependencies changed but docs/context/ did not." >&2
  echo "  Update docs/context/state.md (and data-model.md / an ADR if relevant)." >&2
  exit 1
fi
echo "✓ context docs check passed"
