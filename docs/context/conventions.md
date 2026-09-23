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
- Inserts that race RLS: generate the uuid client-side (`expo-crypto` `randomUUID`) and insert
  without `.select()`; or better, use an RPC.
- Anything touching more than one table in one user action → Postgres function (RPC).

## Database / migrations

- `supabase migration new <descriptive_name>` → edit → `supabase db reset` → pgTAP → regen types.
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
| Supabase local | Two full stacks don't fit in Docker's 8 GB. Stop the prototype stack (`cd ../meetup && supabase stop`) before starting this one. |

## Git

- Branch per phase/step: `phase-N-short-name`. Conventional commit prefixes (`feat:`, `fix:`,
  `test:`, `docs:`, `chore:`). Commit per completed, green step.
