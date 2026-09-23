# 0002 — Supabase Auth; identity is auth.uid()

- **Status:** Accepted · 2026-09-23
- **Supersedes:** prototype's Firebase Auth → Supabase JWT bridge (never recorded as an ADR there)

## Context
The prototype started on Firebase Auth with a custom fetch wrapper, text UIDs, a
`requesting_user_id()` helper and a pgjwt-minted token for Realtime. It later switched to
Supabase Auth without updating schema or docs.

## Decision
Supabase Auth (email/password for MVP). `profiles.id uuid references auth.users(id) on delete cascade`;
policies use `auth.uid()`; profile row created by trigger. No custom token handling.

## Consequences
+ One identity system; Realtime works with the standard session; user deletion cascades.
− Apple/Google sign-in later needs provider setup in Supabase (supported natively).
