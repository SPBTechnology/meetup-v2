# MeetUp (v2)

Group chat with events attached, for groups that form around a plan (trips, stag dos,
celebrations) and recurring clubs. Expo / React Native app on a Supabase backend.

This file is the entry point for any AI assistant or new developer. It is tool-neutral:
`CLAUDE.md` and `.github/copilot-instructions.md` only point here.

**Before starting work, read `docs/context/README.md`** and follow its reading order.
At minimum read `docs/context/state.md` — it says what phase we are in and what is next.

## Stack

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 (strict), Expo Router (`src/app/`)
- Supabase: Postgres + RLS, Supabase Auth (email/password), Realtime
- Tests: Jest (jest-expo) + React Native Testing Library v14, pgTAP, Maestro (planned)

## Commands

```bash
supabase start              # local stack on ports 544xx (Studio: http://127.0.0.1:54423)
npx expo start              # dev server
npm run typecheck           # tsc --noEmit
npm test                    # unit + component tests (no network)
npm run test:db             # pgTAP: schema + RLS policy tests (needs supabase start)
npm run test:int            # data layer against local Supabase (needs supabase start)
npm run test:all            # everything above, in order
supabase db reset           # rebuild local DB from migrations
supabase gen types typescript --local --schema public > src/types/database.types.ts
```

## Hard rules

1. **Definition of done** — a task is not done until:
   - `npm run test:all` passes (typecheck, unit, pgTAP, integration);
   - new behaviour has tests at the right layer (see `docs/context/testing.md`);
   - `docs/context/state.md` is updated (what changed, what is next, date);
   - a changed decision has a new ADR in `docs/context/decisions/` (supersede, never edit);
   - a changed convention is reflected in `docs/context/conventions.md`.
2. **No Supabase calls in screens or components.** All data access goes through
   `src/data/` modules. UI imports from `src/data/`, never from `@supabase/supabase-js`.
3. **Schema changes only via new migration files.** Never edit an applied migration,
   never change the DB through Studio, never patch policies with scripts. Every
   RLS policy change ships with pgTAP tests. Regenerate types after each migration.
4. **Secrets**: the secret (service-role) key is for tests and server code only. Nothing
   under `src/` may reference it. Never commit `.env`.
5. **Scope**: intents / smart suggestions and the venue app are out of scope until the
   MVP phases in `state.md` are done. Do not add them opportunistically.
6. **Git**: work on a branch, commit per completed step, never push without the owner.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved,
or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with
   corrections to common LLM misconceptions. Follow its links; never answer from memory.

The same applies to RNTL v14 and TypeScript 6 — see `docs/context/conventions.md` for the
gotchas already found (async `render`, explicit `types`, jest-expo ignore patterns).

- Always add packages with `npx expo install <package>` (resolves SDK-compatible versions).
- `npx expo-doctor` diagnoses dependency/config issues; `npx expo install --fix` repairs versions.

## Navigation & routing

- Expo Router for all navigation. Routes live in `src/app/` — every file there is a screen,
  `_layout.tsx` files define navigators. Keep everything else (components, hooks, data,
  tests) **outside** `src/app/`, or it becomes a route.
- Import `Link`, `router`, `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Build, sign and submit in the cloud (`npx eas-cli@latest build|submit|update`). The dev Mac
runs macOS Ventura (Xcode 15.2), which cannot build SDK 57 for iOS locally — use EAS for
iOS builds; Android emulator builds work locally.

- `ios/` and `android/` are generated (Continuous Native Generation). Never edit them by hand;
  configure native behaviour in `app.json` and config plugins.
- Expo Go only includes bundled native modules. After adding a library with native code the
  app needs a development build (`eas build --profile development`).
- Prefer Expo modules over third-party libraries. Docs: https://docs.expo.dev/versions/latest/index.md
