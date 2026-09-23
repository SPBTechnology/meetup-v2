# 0006 — Multi-step / privileged writes are Postgres functions

- **Status:** Accepted · 2026-09-23

## Context
The prototype executed multi-step writes from the client under RLS, hit ordering/permission
failures, and worked around them with a local server holding the service key — which cannot
exist in production.

## Decision
Any user action touching more than one row/table, or needing a privileged check, is a Postgres
function called via `supabase.rpc`. `security definer` only when required; then
`set search_path = ''`, explicit `auth.uid()` checks, and pgTAP tests. Edge Functions only for
work needing secrets or external APIs.

## Consequences
+ Atomic, enforceable server-side, same behaviour in dev and prod. No service key in dev tooling.
− Business logic partly in SQL; mitigated by pgTAP coverage.
