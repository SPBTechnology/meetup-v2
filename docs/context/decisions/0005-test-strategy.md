# 0005 — Test strategy: Jest + RNTL, pgTAP, integration, Maestro

- **Status:** Accepted · 2026-09-23

## Decision
- Unit/component: Jest (jest-expo) + React Native Testing Library v14.
- RLS/schema/RPCs: pgTAP via `supabase test db`.
- Data layer: Jest (node) against local Supabase with real auth users (no hand-minted JWTs).
- UI journeys: **Maestro**, not Detox.

## Why
pgTAP tests policies directly per role — faster and more precise than via the client.
Real auth users test the same path the app uses. Maestro: YAML flows, works with Expo dev
builds, supported by EAS Workflows; the prototype's Detox setup stalled on Xcode/build issues.
RNTL v14 over v13 because v13 depends on the deprecated react-test-renderer.

## Consequences
+ Each layer runnable with one command; `npm run test:all` runs everything but Maestro.
− RNTL v14 + expo-router 57 needs a small workaround (`src/test-utils/renderRoute.ts`).
− Maestro needs Java and a dev build (owner action, Phase 2).
