# Testing

Goal: every behaviour is tested at the cheapest layer that can prove it; every layer runs
locally with one command (`npm run test:all`, after `npm run setup`) and in CI on every PR.
All layers must stay green after every change.

## Layers

| Layer | Tool | Location | Command | Proves |
|-------|------|----------|---------|--------|
| Types | `tsc` | — | `npm run typecheck` | Strict TS compiles; generated DB types line up |
| Lint | ESLint (expo config + project rules) | `eslint.config.js` | `npm run lint` | Data-layer boundary, no secret keys in `src/` |
| Unit | Jest (jest-expo) | `src/**/__tests__/*.test.ts` | `npm test` | Pure logic, hooks with mocked data layer |
| Component / route | Jest + RNTL v14 + expo-router testing | `src/**/__tests__/*.test.tsx`, `src/__tests__/routes/` | `npm test` | Screens render/behave, navigation; `src/data/` mocked |
| Database | pgTAP | `supabase/tests/database/*.test.sql` | `npm run test:db` | Schema, constraints, RLS, column grants, RPCs — per role |
| Types drift | script | `scripts/check-types.sh` | `npm run db:types:check` | Committed types match migrations |
| Integration | Jest (node) + supabase-js | `tests/integration/*.int.test.ts` | `npm run test:int` | Behaviour through the real API: exposure, grants via PostgREST, RPC contract, Realtime |
| UI / E2E | Maestro | `.maestro/*.yaml` | `npm run test:e2e` | Critical journeys on a real device build |

`npm run test:all` = typecheck → lint → unit → pgTAP → types drift → integration.

## What goes where

- **Access control** ("B can't read A's conversation", "use_count isn't writable") → pgTAP.
- **API behaviour** (RPC reachable/not reachable, supabase-js upsert works with grants,
  Realtime delivers to members only) → integration.
- **Rendering/interaction** → component test with `src/data/` mocked.
- **Journeys across screens/users** → Maestro (one user via UI, others via API helpers). Keep few.

## pgTAP

Each file: `begin;` → `\ir _helpers.psql` → `plan(n)` → tests → `finish()` → `rollback;`.
Helpers (session-temporary, rolled back):

| Helper | Use |
|--------|-----|
| `pg_temp.create_user(email, meta?)` | Real `auth.users` row (fires the profile trigger); capture with `\gset` |
| `pg_temp.login_as(uuid)` | Act as that signed-in user for following statements |
| `pg_temp.login_anon()` | Act as signed-out |
| `reset role;` | Back to postgres before switching user or arranging data |

`001_schema.test.sql` holds **schema-wide guards** that also police future migrations: every
public table has RLS; every security definer function pins `search_path`; anon can execute
no function and has no table privileges; the table list and Realtime publication are exact.
A new table or function that breaks these fails CI.

**Mutation check** (do this when adding policies): temporarily weaken a policy in the local DB
(e.g. `create policy … with check (true)`), confirm the relevant tests fail, then
`npm run db:reset`. Done for the baseline on 2026-09-30: all weakened rules were caught.

## Integration

`tests/integration/helpers.ts`: `createTestUser(label)` → real auth user + signed-in client;
`cleanupTestUsers` in `afterEach` closes Realtime channels and deletes users (rows cascade).
`service` bypasses RLS — arrange/inspect only, never the action under test.

Realtime: use `listenForInserts(client, table, filter?)` from `tests/integration/realtime.ts`.
It resolves only after Realtime's "Subscribed to PostgreSQL" system message — inserting
earlier (after the channel's SUBSCRIBED status) is the classic cause of flaky Realtime tests.
Verified stable over 5 consecutive runs.

## Unit / component (RNTL v14: `render` is async)

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';

it('sends on press', async () => {
  const user = userEvent.setup();
  await render(<Composer onSend={onSend} />);
  await user.type(screen.getByTestId('Chat-Input'), 'hi');
  await user.press(screen.getByTestId('Chat-SendButton'));
  expect(onSend).toHaveBeenCalledWith('hi');
});
```

Routes: `renderRoute` from `src/test-utils/renderRoute.ts` (see conventions.md).

## CI

`.github/workflows/ci.yml` on every PR and push to main: `npm run setup` (same as local —
proves a clean rebuild) → `npm run test:all` → `scripts/check-context-docs.sh` (PRs that change
migrations or package.json must also change `docs/context/`).

## Maestro

One-time toolchain (ADR 0009): `npm run maestro:setup` (Java 17 + Maestro CLI via Homebrew,
idempotent; `npm run maestro:teardown` reverses it). Android is the primary target — build the
dev client with `npm run android` onto a running emulator, then `npm run test:e2e`.

Flows start with `launchApp: clearState: true` for a clean app-storage slate. A flow that
signs up a real user (like the first one) mutates the local database — `npm run db:reset`
before re-running it.

## Not yet in place

- Maestro in CI (needs an emulator or EAS Workflows runner) — later.
