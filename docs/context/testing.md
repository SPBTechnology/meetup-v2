# Testing

Goal: every behaviour is tested at the cheapest layer that can prove it, and every layer
runs locally with one command (`npm run test:all`) and in CI.

## Layers

| Layer | Tool | Location | Command | Proves |
|-------|------|----------|---------|--------|
| Types | `tsc` | — | `npm run typecheck` | Compiles under strict TS, generated DB types line up |
| Unit | Jest (jest-expo) | `src/**/__tests__/*.test.ts` | `npm test` | Pure logic in `src/lib/`, hooks with mocked data layer |
| Component / route | Jest + RNTL v14 + expo-router testing | `src/**/__tests__/*.test.tsx`, `src/__tests__/routes/` | `npm test` | Screens render and behave, navigation, with `src/data/` mocked |
| Database / RLS | pgTAP | `supabase/tests/database/*.test.sql` | `npm run test:db` | Schema, constraints, RLS policies, RPC functions — per user role |
| Integration | Jest (node) + supabase-js | `tests/integration/*.int.test.ts` | `npm run test:int` | `src/data/` functions work against real Supabase as real signed-in users, incl. Realtime |
| UI / E2E | Maestro | `.maestro/*.yaml` | `maestro test .maestro` (Phase 2) | Critical user journeys on a simulator/emulator build |

## What goes where (rules of thumb)

- **Access control** ("B cannot read A's conversation") → pgTAP. Fast, exact, no client noise.
- **Data-layer contract** ("`sendMessage` returns the saved message; subscriber receives it") →
  integration.
- **Rendering and interaction** ("tapping ✓ calls `respond('accepted')` and shows the count") →
  component test with `src/data/` mocked via `jest.mock`.
- **Journeys across screens and devices** ("A invites B, B joins, B's message appears for A") →
  Maestro for A's UI, with a test helper acting as B through the API. Keep these few.

## Writing each kind

**Unit / component** — RNTL v14: `render` is async.

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

Routes: use `renderRoute` from `src/test-utils/renderRoute.ts` (see conventions.md for why).

**pgTAP** — one transaction per file, rolled back:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(N);
-- arrange as postgres, then act as a user:
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
select is_empty($$ select * from conversations $$, 'stranger sees no conversations');
select * from finish();
rollback;
```

**Integration** — use `tests/integration/helpers.ts`: `createTestUser()` makes a real auth
user and returns a client signed in as them; `cleanupTestUsers` in `afterEach` deletes them
(rows cascade from `auth.users`). `service` bypasses RLS — use it only to arrange/inspect,
never to perform the action under test.

## CI (planned — Phase 1 exit)

GitHub Actions: install → `supabase start` → typecheck → unit → pgTAP → integration.
Maestro runs via EAS Workflows or an Android emulator job once the first flow exists.

## Not yet in place

- Maestro (needs Java + `maestro` CLI + a dev build) — Phase 2, with the first real screens.
- Lint (`npx expo lint` sets up ESLint on first run) — Phase 1.
- CI workflow — Phase 1 exit.
