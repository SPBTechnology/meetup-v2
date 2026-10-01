# State

**Last updated:** 2026-10-01 · **Current phase:** 5 complete (PR pending) → Phase 6 next · **Branch:** `phase-5-events`

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
| 5 | Events: port EventChip, EventBar, EventDetailCard, create wizard (`create_event`), edit, confirm — with tests. | ✅ Done (PR to merge) | Sonnet | — |
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

## Done in Phase 5 (2026-10-01)

- **Data layer**: `event_summaries` view (`security_invoker`, reuses `is_event_member` RLS via
  the underlying tables, three `LEFT JOIN LATERAL`s for per-event date/location/response
  aggregation — `multi_date` hides per-date fields since aggregating across options is
  misleading). `src/data/events.ts`: `listEventSummaries`, `getEventDetail` (parallel + one
  conditional query, skipped entirely when an event has no date options yet), `createEvent`
  (wraps the Phase 1 `create_event` RPC), `updateEvent`, `confirmEvent`, `cancelEvent`,
  `addDateOption`/`deleteDateOption`, `addLocation`/`updateLocationName`/`deleteLocation`,
  `respondToDateOption` (upsert), and two Realtime subscriptions — `event_responses` has no
  `event_id` column, so its subscription filters client-side against the event's current
  date-option ids.
- **Screens**: `EventChip`/`EventBar` (ported from the prototype design, status dot + nearest
  date or "Multiple dates" + location + response counts, counts hidden when multi-date);
  `(app)/event/[id].tsx` (detail: edit title, add location/date, respond, confirm, cancel —
  creator-only controls, read-only for others unless `allow_alt_dates`/`allow_alt_locations`);
  `(app)/event/create.tsx` (title, locations, dates via two-stage native date+time picker,
  alt-dates/alt-locations toggles). Both are modal routes; `EventBar` wired into
  `(app)/conversation/[id].tsx` with reload-on-focus and a Realtime-driven refetch.
- **New native dep**: `@react-native-community/datetimepicker` (Android only supports single
  `date` or `time` mode, not both — the two-stage flow and the `combineDateAndTime` helper in
  `src/lib/dateTime.ts` exist because of this; see conventions.md).
- **Tests**: 174 unit (data layer incl. summary mapping and the two Realtime subscriptions,
  both new components, both new routes), 102 pgTAP (incl. 7 for `event_summaries`), 21
  integration (`event_summaries` reachability/scoping — `create_event` itself already had RPC
  coverage from Phase 1). All green via `npm run test:all`.
- **Found and fixed before shipping** (code review + manual testing, not shipped bugs):
  a date+time combination bug (the time-picker stage returns a `Date` carrying *today's* date,
  not the day picked in the date stage — fixed by extracting `combineDateAndTime`); a Realtime
  staleness bug in `event/[id].tsx` (the resubscribe effect was keyed on `detail === null`
  instead of the actual set of date-option ids, so responses to a date added after the first
  load were silently dropped from the client-side filter).
- **Found via manual device testing — new, cross-cutting, pre-existing (not a Phase 5
  regression)**: see "No safe-area-inset handling" below. Everything else manually verified
  end-to-end on the Android emulator: sign-up → create group → create an event with a location
  and a date (two-stage picker, confirmed the combined date+time was correct) → respond →
  confirm the date → chip updated live in the conversation.

## Known issues / notes

- **No safe-area-inset handling anywhere in the app (found in Phase 5, affects every phase) —
  HIGH PRIORITY, recommend fixing before Phase 6**: every screen's header row (`Back`/`Cancel`/
  `Close`/`Invite`, etc.) is laid out with a plain `paddingTop`, not `useSafeAreaInsets()` or
  `SafeAreaView`, even though `react-native-safe-area-context` is already a dependency (pulled
  in transitively, never actually used). On the Android emulator (Pixel 9, Android's edge-to-edge
  enforcement) this isn't just a cosmetic overlap: `adb shell dumpsys window` confirms the status
  bar owns the top gesture region (`mTopGestureHost=Window{...StatusBar}`), and taps on header
  Pressables landing in or near that region are silently swallowed — confirmed reproducible from
  a fully clean environment (killed Metro, cleared cache, fresh app process) and independent of
  the specific `onPress` handler (`router.back()`, `router.push()`, confirmed via a temporary
  `console.log` that the handler never fires for affected buttons). Buttons lower on screen
  (title-row `Edit`, response buttons, `+ Event`, etc.) are unaffected and work reliably.
  Reproduce: on the conversation screen, tap `Conversation-BackButton` or
  `Conversation-InviteButton` — nothing happens; tap `EventDetail-EditTitleButton` a few rows
  down — works. Fix: wrap screen headers in insets from `useSafeAreaInsets()` (already a
  dependency) across every screen, not just Phase 5's — this is app-wide, present since Phase 2.
  No test caught this because no component test renders inside a `SafeAreaProvider` with
  non-zero insets, and neither Maestro flow has ever tapped a header Back/Cancel button (both
  only exercise forward navigation and hardware-back-equivalent assertions).
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

## Next step

Recommend a short bug-fix pass before Phase 6: fix the no-safe-area-inset issue above (every
screen's header, app-wide) and add a regression test/Maestro step that actually taps a header
Back/Cancel button — the current test suite has never exercised that path at all. Then Phase 6:
Push notifications — Expo Notifications, token registration, triggers for messages/event changes
(needs an APNs key / FCM and a dev build; see the phase table).
