# 0008 — Reproducible, disposable local environment

- **Status:** Accepted · 2026-09-30

## Context
Owner requirement: any setup — especially fickle setup — must be easy to tear down and
reproduce. The prototype relied on hand-run steps, a globally installed (and drifting)
Supabase CLI, a hand-edited `.env`, and ad-hoc scripts that patched the live database.

## Decision
- **Pinned toolchain in-repo:** Supabase CLI as an exact devDependency (`npx supabase`),
  Node major in `.nvmrc` + `engines`. The global/Homebrew CLI is not used by any script.
- **One command each way:** `npm run setup` (idempotent: prerequisite checks, refuses to run
  alongside another Supabase stack, starts the stack, regenerates `.env`, resets the DB from
  migrations) and `npm run teardown` (stops the stack and deletes its volumes and `.env`;
  `--keep-data` to only stop).
- **`.env` is generated, never edited.** Hand-maintained values go in `.env.local`.
- **CI runs the same `npm run setup`**, so every CI run proves a from-scratch rebuild works.
- **Database state only from migrations.** No scripts that change the schema or policies.

## Consequences
+ A broken local environment is fixed with `npm run teardown && npm run setup` (~80s with cached images).
+ CLI upgrades are deliberate commits, tested by CI.
− First run after a CLI upgrade pulls new Docker images (several minutes).
