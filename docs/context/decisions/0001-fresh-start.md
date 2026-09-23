# 0001 — Fresh start from the prototype

- **Status:** Accepted · 2026-09-23

## Context
The prototype (`../meetup`, built T01–T51 largely with Copilot) proved the event model and UX,
but: schema was built for Firebase text UIDs while auth had moved to Supabase Auth; Supabase
calls were spread through screens (untestable); app tests covered only the intent layer now
being shelved; migrations had been edited in place; docs had drifted from the code; a
service-key dev server worked around RLS.

## Decision
Start a new repo (`meetup-v2`) and port deliberately: keep the data model, RLS lessons and UI
designs; rewrite schema, data access and tests. MVP scope first (auth, conversations, invites,
messaging, events, push). Intents shelved. Target groups formed around a plan, and recurring
clubs, rather than replacing existing WhatsApp groups.

## Consequences
+ Clean schema (uuid, `auth.uid()`), testable structure, test harness from day one.
− Re-implementing working screens costs time; mitigated by porting UI rather than redesigning.
Prototype stays as read-only reference (`../meetup`).
