# 0004 — All data access through src/data/

- **Status:** Accepted · 2026-09-23

## Decision
Only modules in `src/data/` import the Supabase client. Screens, components and hooks call
data functions that return typed domain objects and throw typed errors.

## Why
Makes UI testable by mocking one module; centralises query shape, types and error handling;
the prototype's scattered queries (6 in ChatScreen alone) blocked testing.

## Consequences
+ Component tests need no network; integration tests target one small surface.
− One extra layer of indirection for simple reads (accepted).
