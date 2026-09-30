# Data model

**Source of truth for columns and policies:** `supabase/migrations/` (baseline:
`20260930161002_baseline_schema.sql`, which carries section comments explaining each rule).
Types: `src/types/database.types.ts` (generated). This file keeps the *relationships, rules
and reasons*.

## Entities

```
auth.users 1─1 profiles                  (created by trigger on auth.users insert)
profiles  *─* conversations              via conversation_participants
conversations 1─* messages
conversations 1─* conversation_invites
conversations 1─* events
events 1─* event_date_options 1─* event_responses   (one per user per option)
events 1─* event_locations                          (ordered by sort_order)
events.confirmed_option_id → event_date_options     (same event enforced by composite FK)
```

| Table | Purpose | Notes |
|-------|---------|-------|
| `profiles` | Public face of a user | `id` = `auth.users.id`. `phone_number` E.164, unique when set. Display name defaults via the same rule as `src/lib/displayName.ts` (an integration test asserts they agree). |
| `conversations` | A group chat | `type` direct/group; `name` optional; `created_by`. |
| `conversation_participants` | Membership | Root of nearly every access rule. No client INSERT at all. |
| `messages` | Chat | `kind` user/system; immutable; client-generated uuid allowed; keyset-paging index. |
| `conversation_invites` | Invite codes | 8-char code from an unambiguous alphabet; ≤30-day expiry (default 7); optional `max_uses`; `revoked_at`. |
| `events` | A plan in a conversation | `status` planning/confirmed/cancelled; `allow_alt_dates` / `allow_alt_locations` let non-creators propose. Confirmed ⇒ `confirmed_option_id` set. |
| `event_date_options` | Candidate dates | `ends_at` > `starts_at` when set. |
| `event_locations` | Candidate places | Only `name` used now; place fields reserved for place search / venues. |
| `event_responses` | ✓ / ? / ✗ | PK (date_option_id, user_id); upsert on that key. `responded_at` maintained by trigger. |

## Access rules (enforced by RLS + column grants; tested in pgTAP)

- **Profiles** — read self and anyone you share a conversation with; update own
  `display_name`, `avatar_url`, `phone_number` only.
- **Membership** — joined only via `create_conversation()`, `add_participants()` (any member
  can add existing users, e.g. phonebook matches) or `accept_invite(code)`. Members can leave;
  nobody can remove others (yet).
- **Conversations** — members read; creator renames/deletes.
- **Messages** — members read; members send as themselves, `kind = 'user'` only; no edits/deletes.
  System messages come only from RPCs.
- **Invites** — any member creates and lists; only the creator revokes; `code`, `use_count`
  are server-owned. Redeem via `accept_invite` (idempotent for existing members).
- **Events** — members read and create (as themselves); creator edits/deletes/confirms.
- **Date options / locations** — creator adds; other members add only when the event allows
  it; creator deletes (and edits locations).
- **Responses** — your own row, only for dates in your conversations.
- **Phone lookup** — only via `match_phone_numbers(numbers[])` (≤1000 per call, excludes
  caller). The profiles table is never searchable by phone.
- **Signed-out (anon)** — no table privileges and no function execute rights at all.

## RPC contract (for `src/data/`)

| Function | Returns | Errors (`error.message`) |
|----------|---------|--------------------------|
| `create_conversation(p_name?, p_type?)` | conversation id | `not_authenticated` |
| `add_participants(p_conversation_id, p_user_ids[])` | number newly added | `not_authenticated`, `not_a_member`, `too_many_users` (>256) |
| `accept_invite(p_code)` | conversation id | `not_authenticated`, `invite_not_found`, `invite_revoked`, `invite_expired`, `invite_exhausted` |
| `match_phone_numbers(p_phone_numbers[])` | rows (user_id, display_name, phone_number) | `not_authenticated`, `too_many_numbers` (>1000) |
| `create_event(p_conversation_id, p_title, p_description?, p_starts_at[]?, p_locations[]?, p_allow_alt_dates?, p_allow_alt_locations?)` | event id | `not_authenticated`; RLS error if not a member |

Codes are normalised by `accept_invite` (case-insensitive, separators ignored), so the UI can
display them as `ABCD-EFGH`.

## Known limits / future work

- No rate limiting on `accept_invite` / `match_phone_numbers` (contact-discovery enumeration).
  Needed before public launch.
- No "remove member" or admin roles. No message edit/delete. No direct-conversation
  (exactly-two-members) enforcement — MVP is group-first.
- Realtime uses `postgres_changes` with default replica identity: DELETE events carry only
  primary keys.

## Changes from the prototype (and why)

| Change | Why |
|--------|-----|
| User ids `text` → `uuid` FK to `auth.users` | Firebase gone; cascades and type safety. |
| `requesting_user_id()` → `auth.uid()`; no `get_realtime_token()` | Native Supabase Auth and Realtime. |
| Profile created by trigger | Can't be skipped or raced by the client. |
| Invites + `accept_invite()`; no self-join policy | The prototype's self-join policy let anyone who knew a conversation id join it. |
| Column-level grants on every table | RLS decides *which rows*; grants decide *which columns* (e.g. `use_count`, `created_by` can't be forged). |
| Helpers in a non-exposed `private` schema | Not callable over the API. |
| Multi-step writes as RPCs | ADR 0006. |
| Intent / personalisation / consent tables dropped | Out of scope; to be redesigned. |
