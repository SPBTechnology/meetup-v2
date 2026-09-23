# Architecture

## Shape

```
┌──────────────────────── Expo app ────────────────────────┐
│  src/app/         routes (Expo Router) — thin: layout,   │
│                   wiring, navigation                     │
│  src/components/  presentational components              │
│  src/hooks/       UI state + subscriptions, call data/   │
│  src/data/        THE ONLY place that talks to Supabase  │
│  src/lib/         pure logic (no I/O) — easiest to test  │
└───────────────┬──────────────────────────────────────────┘
                │ supabase-js (publishable key + user session)
┌───────────────▼──────────── Supabase ────────────────────┐
│  Auth       email/password; session JWT → auth.uid()     │
│  PostgREST  table reads/writes, gated by RLS             │
│  RPC        Postgres functions for multi-step writes     │
│  Realtime   postgres_changes (MVP); Broadcast if needed  │
│  Edge Fns   anything needing secrets or external APIs    │
└──────────────────────────────────────────────────────────┘
```

## Key rules and why

**Data access only through `src/data/`.** Screens never import supabase-js. This is what
makes screens testable (mock one module) and keeps query shape, error handling and types in
one place. The prototype scattered queries across screens and was untestable as a result.
[ADR 0004](decisions/0004-data-layer-boundary.md)

**Multi-step or privileged writes are Postgres functions, not client sequences.** E.g.
"create conversation + add creator as participant", "accept invite", "confirm event".
A function runs in one transaction, can enforce rules the client can't be trusted with, and
avoids RLS ordering traps (e.g. RETURNING hitting a SELECT policy before the participant row
exists). Functions that bypass RLS are `security definer`, check `auth.uid()` themselves,
set `search_path = ''`, and have pgTAP tests. The prototype needed a service-key dev server
to work around this — that must never recur. [ADR 0006](decisions/0006-rpc-for-authoritative-writes.md)

**RLS is the security boundary.** The client is untrusted; every table has RLS enabled and
policies tested in pgTAP. Cross-table checks inside policies go through `security definer`
helpers (e.g. `is_conversation_member`) — a policy that directly subqueries another
RLS-protected table re-enters that table's policies and fails or recurses.

**Identity is `auth.uid()` (uuid).** `profiles.id` references `auth.users.id`. No custom JWT
bridging, no minted tokens; Realtime uses the normal Supabase session.
[ADR 0002](decisions/0002-supabase-auth.md)

**Secrets never ship in the app.** The publishable key is safe in the client; the secret key is
used only by tests, scripts and Edge Functions.

## Realtime

MVP uses `postgres_changes` on `messages` and event tables (tables must be in the
`supabase_realtime` publication). Each change is checked against RLS per subscriber, which is
fine at MVP scale. If message fan-out becomes a bottleneck, move chat delivery to Realtime
Broadcast (with DB triggers) — record that as an ADR when it happens.

## Environments

- **Local**: `supabase start` (Docker) on ports 544xx; app via Expo dev server. See runbook.
- **Hosted Supabase / EAS production**: not set up yet. Migrations are the only way schema
  reaches any environment.
