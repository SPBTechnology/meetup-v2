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
| RNTL v14 | `render` **and** `renderHook` are async — `await render(...)`, `await renderHook(...)`, and `await unmount()`/`await rerender(...)` too (their return type is `Promise<void>`). Needs the `test-renderer` peer. |
| RNTL v14 + React 19 `act()` | `act(() => triggerStateUpdate())` without `await` logs "called act(async () => ...) without await" and the update may not have flushed before your next assertion — silently breaking *later* tests too (state updates leak across tests when this happens). Always `await act(...)`. Because `renderHook` itself now awaits internal flushing, a transient state (e.g. `loading: true` right after the initial render) is often no longer observable — assert the settled state via `waitFor` instead. |
| `fireEvent` on `Switch` (and likely other non-`Pressable` native components) | Plain `fireEvent(switchEl, 'valueChange', true)` isn't auto-wrapped in `act()` the way `userEvent.press`/`.type` are — it still updates the component, but leaves an unflushed update that silently breaks *other tests in the same file* run afterward (symptom: later tests can't find even unconditionally-rendered elements, as if the render tree got corrupted). Wrap it: `await act(() => fireEvent(switchEl, 'valueChange', true))`. Took a while to isolate from the `DateTimePicker` mock also in that test, which was innocent. |
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
| Maestro / Java | `JAVA_HOME`/`PATH` don't persist between separate command invocations here — export them in the *same* command that runs `gradlew` (via `npm run android`) or `maestro`, or add them to `~/.zshrc` for interactive shells. Maestro is installed via its own installer, not Homebrew — see ADR 0009 for why (a broken from-source JDK build on this machine's "Tier 3" macOS version). |
| Maestro `launchApp: clearState: true` | On this machine, the force-stop + `pm clear` + relaunch alone was observed taking 12-16s under load (confirmed via `adb shell dumpsys window` polling — focus briefly drops to the launcher before the app's window ID changes), before the fresh cold process (Hermes init + Metro bundle fetch) even starts. Give the first post-launch assertion `extendedWaitUntil` with a 45s timeout, not a bare `assertVisible` — the element renders correctly once the JS loads, it's purely a slow-launch timing issue, not a testID/id-matching bug. |
| Maestro + Expo dev client (unresolved) | Both flows in Phase 3 reproducibly landed on `CreateGroup-Screen` instead of `Home-Screen` right after a fresh sign-up — confirmed via Maestro's own UI-hierarchy dumps, not a screenshot artifact. Reproduced from a from-scratch emulator + fresh Metro + fresh DB, and again after adding `stopApp` before `clearState` to force a real process kill, so it isn't simply leftover on-device state. The app's own code has no path that auto-navigates to create-group. Best lead: the Expo dev client's "resume last screen" convenience feature, tied to the long-running Metro dev server rather than on-device state — not confirmed. See `state.md`'s Known issues. Don't trust Maestro for navigation regressions until this is root-caused; the component tests cover the same screens reliably in the meantime. |
| expo-contacts (SDK 57) | Completely different API from older SDKs — no `getContactsAsync()`. It's now class-based: `import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts'`, then `Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES])` returns `{ id, fullName, phones }[]`. Verified against the installed `.d.ts` files, not docs/memory — AGENTS.md's "Expo has changed" warning was correct to distrust training data here. Needs the `expo-contacts` plugin entry in `app.json` (`contactsPermission` string) and a dev client rebuild (native code). |
| libphonenumber-js: isPossible vs isValid | Use `.isPossible()` (structurally plausible), not `.isValid()` (really-allocated range), when normalizing phone numbers just for matching against stored profiles. `.isValid()` rejects reserved example ranges like the UK's `07700 900xxx` — which this project's own fixture/seed data uses throughout — as not real carrier allocations. |
| Device/native-permission features (contacts, SMS) | Can't be meaningfully exercised in the Android emulator — contacts list is empty by default and SMS has no real transport. Build and unit-test these with mocks (see `invite.test.tsx`), but real verification needs a physical device or the owner. |

## Git

- Branch per phase/step: `phase-N-short-name`. Conventional commit prefixes (`feat:`, `fix:`,
  `test:`, `docs:`, `chore:`). Commit per completed, green step.
