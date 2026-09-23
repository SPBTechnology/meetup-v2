# Data model

Status: **target design** for Phase 1 — carried over from the prototype's proven model, with
the changes listed at the bottom. Once the baseline migration lands, the migration is the
source of truth for columns; this file keeps the *relationships, rules and reasons*.

## Entities

```
auth.users 1─1 profiles
profiles  *─* conversations         via conversation_participants
conversations 1─* messages
conversations 1─* conversation_invites
conversations 1─* events
events 1─* event_date_options 1─* event_responses (one per user per option)
events 1─* event_locations (ordered)
events ─ confirmed_option_id → event_date_options (nullable)
```

| Table | Purpose | Notes |
|-------|---------|-------|
| `profiles` | Public face of a user | `id` = `auth.users.id` (uuid). `display_name`, `avatar_url`, `phone_number` (unique when set, E.164). Row created by trigger on `auth.users` insert. |
| `conversations` | A group chat | `type` direct/group, optional `name`, `created_by`. |
| `conversation_participants` | Membership | PK (conversation_id, user_id). Membership is the root of almost every access rule. |
| `messages` | Chat messages | `sender_id`, `content`, `created_at`; index (conversation_id, created_at desc) for paging. Client generates the uuid. |
| `conversation_invites` | Invite codes (new) | code, conversation, created_by, expires_at, optional max uses. Redeemed only via `accept_invite(code)` RPC. |
| `events` | A plan inside a conversation | title, description, `status` planning/confirmed/cancelled, `allow_alt_dates`, `allow_alt_locations`, `confirmed_option_id`. |
| `event_date_options` | Candidate dates | `starts_at`, optional `ends_at`, `created_by`. |
| `event_responses` | ✓ / ? / ✗ per user per date | PK (date_option_id, user_id); `response` accepted/maybe/declined. Upsert on the PK. |
| `event_locations` | Candidate/ordered places | Only `name` required now. `place_id`, `address`, `lat/lng`, `place_type` reserved for future place search and venue features. `sort_order` keeps user ordering. Join table (not an array) so venues can be first-class later. |

## Access rules (what RLS must enforce)

- **Profiles**: read your own and those of people you share a conversation with; update your own.
- **Conversations / participants / messages / events and children**: readable only by
  conversation members. Checked through `security definer` helpers: `is_conversation_member`,
  `is_event_member`, etc.
- **Messages**: members insert as themselves only (`sender_id = auth.uid()`). No edits in MVP.
- **Joining a conversation**: *only* via the creator adding you, or `accept_invite(code)`.
  No self-join policy — the prototype's self-join policy let anyone who knew a conversation id join it.
- **Events**: members create (as themselves); creator updates/deletes/confirms.
- **Date options**: creator adds; members add only when `allow_alt_dates` is true — checked
  via a `security definer` helper, not a raw subquery on `events`.
- **Responses**: users write only their own rows, only for options in their conversations.
- **Phone matching** (for phonebook invites): never expose the profiles table for arbitrary
  phone lookup. Use an RPC that takes a list of numbers and returns only matched profile ids /
  names.

## Changes from the prototype (and why)

| Change | Why |
|--------|-----|
| User ids `text` → `uuid` referencing `auth.users` | Firebase UIDs are gone; FK to auth.users gives cascade-on-delete and type safety. |
| `requesting_user_id()` → `auth.uid()` | Native Supabase Auth; no JWT bridge. |
| Drop `get_realtime_token()` / pgjwt | Realtime accepts the Supabase session directly. |
| Profile created by DB trigger, not client upsert | One source of truth; can't be skipped or raced. |
| Add `conversation_invites` + `accept_invite()` | Invites are MVP; joining must be controlled. |
| No self-join policy | Security hole in prototype. |
| Multi-step writes as RPCs | See architecture.md. |
| Intent / personalization / consent tables not carried | Out of scope; will be redesigned. |
