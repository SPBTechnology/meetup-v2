# State

**Last updated:** 2026-09-30 · **Current phase:** 1 complete (PR pending) → Phase 2 next · **Branch:** `phase-1-schema`

## Phase plan

Each phase ends green on `npm run test:all` with this file updated. Any new setup gets
scripted setup/teardown (ADR 0008). "Needs owner" items can't be done by an AI assistant
alone — flag them at the start of the phase.

| # | Phase | Status | Suggested model | Needs owner |
|---|-------|--------|-----------------|-------------|
| 0 | Foundation: Expo 57 + Router skeleton, test harness, context directory, agent settings | ✅ Done | Opus | — |
| 1 | Baseline schema + RLS + RPCs, pgTAP suite, API integration tests, lint, CI, reproducible setup/teardown | ✅ Done (PR to merge) | Opus | Push branch, open PR, confirm CI green |
| 2 | Auth + profiles: Supabase client + session storage (check current Expo/Supabase docs), `src/data/auth.ts` + `DataError` mapping, sign-up/sign-in screens, auth-gated routing, profile edit (display name, phone). Maestro with scripted install/teardown + first flow (sign up → home). | **Next** | Sonnet (Opus for session-storage choice) | Install Java; EAS login; dev build |
| 3 | Conversations + messaging: list, create group, chat screen, send, paging, Realtime; component + integration tests. | | Sonnet | — |
| 4 | Invites UI: share code/link (`accept_invite`), phonebook match (`match_phone_numbers` + `expo-contacts`), SMS for non-users (`expo-sms`). Backend already done in Phase 1. | | Sonnet | Device test (contacts/SMS) |
| 5 | Events: port EventChip, EventBar, EventDetailCard, create wizard (`create_event`), edit, confirm — with tests. | | Sonnet | — |
| 6 | Push notifications: Expo Notifications, token registration, triggers for messages/event changes. | | Opus → Sonnet | APNs key / FCM, dev build |
| 7 | First real groups: internal build to 3–5 groups; collect how they phrase availability. | | — | Everything |

Later (not scheduled): intents redesign (LLM with conversation context, confirm-only),
venue app (request model), rate limiting on invite/phone RPCs before public launch.

## Done in Phase 1 (2026-09-30)

- **Schema** (`20260930161002_baseline_schema.sql`): all MVP tables; profile trigger; RLS on
  every table; column-level grants; `private` helpers; RPCs `create_conversation`,
  `add_participants`, `accept_invite`, `match_phone_numbers`, `create_event`; Realtime publication.
- **pgTAP**: 90 tests in 7 files, incl. schema-wide guards; mutation-checked (weakened policies
  are caught).
- **Integration**: 8 tests through the real API — profile trigger, private functions not
  exposed, RPC error contract, invite flow, response upsert with grants, Realtime member-only
  delivery (stable across 5 runs).
- **Reproducibility** (ADR 0008): Supabase CLI pinned at 2.118.0 in package.json; `npm run
  setup` / `teardown`; generated `.env`; teardown → setup → green verified from scratch.
- **Guardrails**: ESLint rules enforcing the data-layer boundary and no secret keys in `src/`;
  types drift check; CI (`.github/workflows/ci.yml`) running setup + full suite; PR check that
  schema/dependency changes come with `docs/context/` changes.

## Known issues / notes

- `test:int` runs with `--forceExit` because of realtime-js timers (see conventions.md). Unit
  tests keep full leak detection.
- RNTL v14 / expo-router 57 incompatibility worked around in `src/test-utils/renderRoute.ts`.
- `src/lib/displayName.ts` mirrors the DB trigger's naming rule (an integration test asserts
  they agree). Its app use (e.g. previews before the profile loads) arrives in Phase 2.
- `npm audit` reports 13 moderate advisories in dev tooling dependencies — review in Phase 2,
  don't `audit fix --force` (breaks Expo pins).
- Prototype (`../meetup`) is reference only; its local stack is stopped with data preserved.

## Next step (Phase 2, first task)

Check the current Expo 57 + Supabase docs for React Native session storage, then add
`src/lib/supabase.ts` (client) and `src/data/auth.ts` with `DataError` mapping, test-first:
unit tests for error mapping, integration tests for sign-up/sign-in/sign-out.
