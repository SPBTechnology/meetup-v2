# State

**Last updated:** 2026-09-23 · **Current phase:** 0 complete → Phase 1 next · **Branch:** `phase-0-foundation`

## Phase plan

Each phase ends green on `npm run test:all` with this file updated. "Needs owner" items
can't be done by an AI assistant alone — flag them at the start of the phase.

| # | Phase | Status | Suggested model | Needs owner |
|---|-------|--------|-----------------|-------------|
| 0 | Foundation: Expo 57 + Router skeleton, test harness (unit, component, pgTAP, integration), context directory, agent settings | ✅ Done | Opus | — |
| 1 | Baseline schema: one clean migration (profiles, conversations, participants, messages, invites, events + children), RLS + helpers, profile trigger, Realtime publication, full pgTAP policy suite, generated types. Add lint + GitHub Actions CI. | Next | Opus (design) → Sonnet (pgTAP bulk) | GitHub remote for CI |
| 2 | Auth + profiles: Supabase client + session storage (check current Expo/Supabase docs), `src/data/auth.ts`, sign-up/sign-in screens, auth-gated routing, profile edit (display name, phone). Maestro installed + first flow (sign up → home). | | Sonnet | Install Java + Maestro; EAS login; dev build |
| 3 | Conversations + messaging: list, create group, chat screen, send, paging, Realtime; data-layer integration tests incl. Realtime delivery. | | Sonnet | — |
| 4 | Invites: invite code/link + `accept_invite` RPC; phonebook match RPC + `expo-contacts`; SMS invite via `expo-sms` for non-users. | | Opus (RPC/security) → Sonnet (UI) | Device test (contacts/SMS) |
| 5 | Events: port EventChip, EventBar, EventDetailCard, create wizard, edit, confirm — against the new data layer, with tests. | | Sonnet | — |
| 6 | Push notifications: Expo Notifications, token registration, triggers for messages/event changes. | | Opus → Sonnet | APNs key / FCM, dev build |
| 7 | First real groups: TestFlight/internal build to 3–5 groups; collect how they phrase availability (feeds future intents design). | | — | Everything |

Later (not scheduled): intents redesign (LLM with conversation context, confirm-only),
venue app (request model). See product.md non-goals.

## Done in Phase 0 (2026-09-23)

- `create-expo-app` blank-typescript on SDK 57; Expo Router with routes in `src/app/`.
- Jest projects: `unit` (jest-expo) and `integration` (ts-jest/node). pgTAP via `supabase test db`.
  One passing test per layer: `displayName` unit, home route render, pgTAP harness, auth integration.
- Supabase initialised on ports 544xx; storage + analytics disabled (Docker memory).
- `.claude/settings.json` permission allow/deny lists; `AGENTS.md` + pointers; this directory; ADRs 0001–0007.
- Prototype docs archived in `docs/archive/`.

## Known issues / notes

- `.env` URL is `127.0.0.1` — `en0` had no IP when generated. Set the LAN IP before testing on a phone.
- RNTL v14 / expo-router 57 incompatibility worked around in `src/test-utils/renderRoute.ts`.
- Supabase CLI is 2.78.1 (2.117 available). Upgrade when convenient (`brew upgrade supabase`) and re-run `npm run test:all`.
- Prototype (`../meetup`) is reference only; its local stack is stopped with data preserved.

## Next step (Phase 1, first task)

Draft the baseline migration from `data-model.md`, then write pgTAP policy tests table by
table (profiles → conversations/participants → messages → invites → events/children).
