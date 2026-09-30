# Conventions

## Layout

| Path | Contains | Rule |
|------|----------|------|
| `src/app/` | Expo Router routes only | Every file is a route. No tests, helpers or components here. |
| `src/components/` | Presentational components | Props in, callbacks out. No data fetching. |
| `src/hooks/` | UI state, subscriptions | Call `src/data/`; never supabase-js directly. |
| `src/data/` | Data access modules | The only importer of `src/lib/supabase.ts` (client, added in Phase 2). |
| `src/lib/` | Pure logic | No I/O, no React. |
| `src/types/database.types.ts` | Generated Supabase types | Never hand-edit; regenerate after every migration. |
| `src/test-utils/` | Shared test helpers for unit tests | |
| `src/**/__tests__/` | Unit/component tests next to the code | Route tests go in `src/__tests__/routes/` (not in `src/app/`). |
| `tests/integration/` | `*.int.test.ts` against local Supabase | |
| `supabase/tests/database/` | pgTAP `*.test.sql` | One file per table/concern. |
| `.maestro/` | Maestro UI flows (from Phase 2) | |

## Data layer

- One module per domain: `src/data/auth.ts`, `conversations.ts`, `messages.ts`, `events.ts`, `invites.ts`.
- Functions return typed domain objects and throw a typed `DataError` on failure. Hooks/UI
  decide how to present errors; data functions never `console.error` and carry on.
- RPC errors carry a stable snake_case `error.message` (e.g. `invite_expired`); the full list is
  the RPC contract table in data-model.md. Map those to `DataError` codes — don't parse free text.
- Lint enforces the boundary: importing `@supabase/supabase-js` (non-type) outside `src/data/`
  or `src/lib/supabase.ts` is an error.
- Inserts that race RLS: generate the uuid client-side (`expo-crypto` `randomUUID`) and insert
  without `.select()`; or better, use an RPC.
- Anything touching more than one table in one user action → Postgres function (RPC).

## Database / migrations

- `npx supabase migration new <descriptive_name>` → edit → `npm run db:reset` → pgTAP →
  `npm run db:types`. New tables also need: RLS enabled, explicit column grants (the baseline
  revokes Supabase's default grant-everything), and an entry in `001_schema.test.sql`'s table list.
- Never edit a migration that has been committed. Fix forward with a new migration.
- Section headers in SQL: `-- ── Section ──`. Explain non-obvious decisions in comments.
- `security definer` functions: `set search_path = ''`, fully qualify names, check `auth.uid()`.
- Every new table: `enable row level security` in the same migration, plus pgTAP tests.
- Realtime tables: add to `supabase_realtime` publication in the migration that needs it.

## UI

- `testID` on every interactive element and every screen root, named `Screen-Element`
  (e.g. `Chat-SendButton`, `ConversationList-Screen`). Maestro and RNTL both rely on these.
- Accessible labels on icon-only buttons (RNTL queries by role/label first).

## Library gotchas already found (don't rediscover)

| Library | Gotcha |
|---------|--------|
| RNTL v14 | `render` is **async** — `await render(...)`. Needs the `test-renderer` peer. |
| expo-router 57 testing | `renderRouter` loses its helpers under RNTL v14 — use `src/test-utils/renderRoute.ts`, which awaits correctly and exposes `getPathname()` etc. The `toHavePathname` matcher does not work. |
| jest-expo 57 | Don't override `transformIgnorePatterns` with the docs' old pattern — the preset default already covers new Expo deps (e.g. `standard-navigation`). Extend, don't replace. |
| TypeScript 6 | `types` no longer auto-includes `@types/*`; `tsconfig.json` lists `jest` and `node` explicitly. |
| npm + Expo | Use `npx expo install` for runtime deps. Plain `npm install` of e.g. `ts-jest` first can drag in Jest 30 / `react-dom` 19.3 and break peers; pin `jest@~29.7.0`. |
| Supabase local | Two full stacks don't fit in Docker's 8 GB. `npm run setup` refuses to start while another stack runs; stop it with `(cd ../meetup && supabase stop)`. |
| Supabase CLI | Always `npx supabase` (pinned in package.json), never the global/Homebrew one. `gen types` output is unformatted — expected for a generated file (lint ignores it). |
| realtime-js 2.117 | A clean disconnect leaves two 10s timers running (channel-leave ack; hard-coded socket-close fallback), so Jest can't exit. `test:int` uses `--forceExit` for this reason only. Don't call `realtime.disconnect()` on a client that never connected (same 10s wait). |
| Realtime tests | Wait for the `system` message `{extension: 'postgres_changes', status: 'ok'}`, not the SUBSCRIBED status, before inserting — use `listenForInserts`. |
| pgTAP | A volatile function in `WHERE` runs per row — capture its result with `\gset` first. Cast psql variables passed to polymorphic functions (`:'code'::text`). Don't end a line with `-- comment;` expecting the `;` to execute. |
| GitHub Actions | Check current major versions before bumping (`actions/checkout`, `setup-node` were v7 in Sep 2026). |

## Git

- Branch per phase/step: `phase-N-short-name`. Conventional commit prefixes (`feat:`, `fix:`,
  `test:`, `docs:`, `chore:`). Commit per completed, green step.
