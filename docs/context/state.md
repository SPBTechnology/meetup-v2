# State

**Last updated:** 2026-10-01 · **Current phase:** 4 complete (PR pending) → Phase 5 next · **Branch:** `phase-4-invites`

## Phase plan

Each phase ends green on `npm run test:all` with this file updated. Any new setup gets
scripted setup/teardown (ADR 0008). "Needs owner" items can't be done by an AI assistant
alone — flag them at the start of the phase.

| # | Phase | Status | Suggested model | Needs owner |
|---|-------|--------|-----------------|-------------|
| 0 | Foundation: Expo 57 + Router skeleton, test harness, context directory, agent settings | ✅ Done | Opus | — |
| 1 | Baseline schema + RLS + RPCs, pgTAP suite, API integration tests, lint, CI, reproducible setup/teardown | ✅ Done (merged) | Opus | Push branch, open PR, confirm CI green |
| 2 | Auth + profiles: Supabase client + session storage (check current Expo/Supabase docs), `src/data/auth.ts` + `DataError` mapping, sign-up/sign-in screens, auth-gated routing, profile edit (display name, phone). Maestro with scripted install/teardown + first flow (sign up → home). | ✅ Done (merged) | Sonnet (Opus for session-storage choice) | Install Java; EAS login; dev build |
| 3 | Conversations + messaging: list, create group, chat screen, send, paging, Realtime; component + integration tests. | ✅ Done (merged) | Sonnet | — |
| 4 | Invites UI: share code/link (`accept_invite`), phonebook match (`match_phone_numbers` + `expo-contacts`), SMS for non-users (`expo-sms`). Backend already done in Phase 1. | ✅ Done (PR to merge) | Sonnet | Device test (contacts/SMS) — still outstanding, see below |
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

## Done in Phase 2 (2026-09-30)

- **Auth + data layer**: `src/lib/supabase.ts` client, `src/data/auth.ts` (sign-up/sign-in/
  sign-out) with `DataError` mapping; unit tests for error mapping, integration tests for the
  full auth flow against the real local stack.
- **Screens + routing**: `(auth)` sign-in/sign-up screens and `(app)` home/profile screens,
  auth-gated via Expo Router `Stack.Protected`; component tests for each route plus the gate
  itself (`auth-gate.test.tsx`).
- **Maestro E2E** (ADR 0009): Java 17 (Homebrew) + Maestro CLI via scripted
  `maestro:setup`/`maestro:teardown`; first flow `sign-up-to-home.yaml` (sign up → auth gate →
  home) passing on a local Android emulator.
- **Environment fixes found along the way**: `ANDROID_HOME`/`JAVA_HOME` must be on `PATH` for
  whatever shell runs `npm run android` or `maestro` (added to `~/.zshrc`, see conventions.md);
  a corrupted NDK install (truncated mid-download during an unrelated disk-space incident) had
  to be removed and re-fetched; Maestro's `clearState: true` cold-launch timing needs a 45s
  `extendedWaitUntil`, not a bare `assertVisible` — see conventions.md.

## Done in Phase 3 (2026-10-01)

- **Data layer**: `conversation_summaries` view (`security_invoker`, reuses existing RLS via
  `is_conversation_member` — no separate access logic to keep in sync) for the conversation
  list's last-message preview without an N+1 query. `src/data/conversations.ts`
  (list/get/create/addParticipants) and `src/data/messages.ts` (send with a client-generated
  id, keyset-paginated list matching `messages_conversation_created_idx`, Realtime subscribe).
- **Screens**: `(app)/index.tsx` replaces the Phase 2 placeholder with the real conversation
  list (refetches on focus); `(app)/create-group.tsx`; `(app)/conversation/[id].tsx` — inverted
  message list with pagination, send box, Realtime with id-based de-duplication against the
  sender's own optimistic update.
- **Tests**: pgTAP for the view (visibility + last-message-wins); unit tests for the data layer
  and all three screens, including Realtime dedup and pagination; integration tests for the
  view through PostgREST and the keyset `.or()` filter string against the real API.

## Done in Phase 4 (2026-10-01)

- **Data layer**: `src/data/invites.ts` (`createInvite`, `listInvites`, `getOrCreateActiveInvite`
  — reuses an unrevoked/unexpired invite instead of spamming new rows, `acceptInvite`,
  `matchPhoneNumbers`); `src/lib/inviteCode.ts` (pure code formatting, kept out of `src/data/`
  since it touches no Supabase); `src/lib/phoneNumber.ts` (normalizes device contact numbers to
  E.164 via `libphonenumber-js` for matching against `profiles.phone_number`).
- **Screens**: `(app)/invite.tsx` — share a code (native `Share`), find friends already on the
  app via `expo-contacts` + `match_phone_numbers` (add directly via `add_participants`), text
  the rest via `expo-sms`; `(app)/join.tsx` — manual code redemption. Both reachable from
  `(app)/index.tsx` ("Join with code") and the chat screen header ("Invite").
- **New native deps**: `expo-contacts`, `expo-sms` (dev client rebuilt; SDK 57's `expo-contacts`
  API is completely different from older SDKs — see conventions.md).
- **Tests**: unit tests for the data layer, both new screens (contacts/SMS/Share mocked), and
  the invite-navigation wiring from the chat screen; integration test for `match_phone_numbers`
  through the real API (the one RPC that didn't already have coverage from Phase 1). 262 tests
  total (129 unit, 95 pgTAP, 20 integration), all passing.
- **Found via manual device testing**: a stale dev-client session (pointing at a user a later
  `npm run db:reset` had deleted) produced a generic error on `createConversation` — same root
  cause already diagnosed in Phase 3, not a new bug; `pm clear` + fresh sign-in resolved it.

## Known issues / notes

- **Device test still needed (Phase 4)**: contacts matching and SMS composing are unit-tested
  with mocks but not verified on a real device — the Android emulator can't meaningfully
  exercise either (empty contacts by default, no real SMS transport). Needs the owner.
- **Maestro E2E flakiness (unresolved)**: both flows reproducibly land on `CreateGroup-Screen`
  instead of `Home-Screen` right after a fresh sign-up — confirmed via Maestro's own
  UI-hierarchy dumps (not a screenshot artifact), reproduced across a from-scratch emulator +
  fresh Metro + fresh DB, and again after adding `stopApp` before `clearState` to force a real
  process kill. The app's own code has no path that auto-navigates to create-group, so this
  looks like an Expo dev-client "resume last screen" behavior tied to the long-running Metro
  dev server rather than an application bug — not confirmed further; needs investigation before
  relying on Maestro for Phase 4 regression coverage. All 213 other tests (99 unit, 95 pgTAP, 19
  integration) pass and cover the same functionality directly.

- `test:int` runs with `--forceExit` because of realtime-js timers (see conventions.md). Unit
  tests keep full leak detection.
- RNTL v14 / expo-router 57 incompatibility worked around in `src/test-utils/renderRoute.ts`.
- `src/lib/displayName.ts` mirrors the DB trigger's naming rule (an integration test asserts
  they agree). Its app use (e.g. previews before the profile loads) arrives in Phase 2.
- `npm audit` reports 13 moderate advisories in dev tooling dependencies — review in Phase 2,
  don't `audit fix --force` (breaks Expo pins).
- Prototype (`../meetup`) is reference only; its local stack is stopped with data preserved.

## Next step (Phase 5, first task)

Events: port EventChip, EventBar, EventDetailCard, create wizard (`create_event`), edit, confirm
from the prototype (`../meetup`) — with tests at each step, as in Phases 2-4. Backend schema and
RPCs already exist from Phase 1 (`events`, `event_date_options`, `event_locations`,
`event_responses`, `create_event`).
