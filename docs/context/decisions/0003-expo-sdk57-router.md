# 0003 — Expo SDK 57 with Expo Router

- **Status:** Accepted · 2026-09-23

## Context
Prototype was on SDK 54 with React Navigation. SDK 57 is current. The dev Mac (macOS Ventura,
Xcode 15.2) can't build iOS locally for either version, so iOS builds go through EAS regardless.

## Decision
SDK 57 (React Native 0.86, React 19.2, TypeScript 6) and Expo Router with routes in `src/app/`.

## Consequences
+ Supported SDK, current Expo Go, file-based routing and route testing utilities.
− Newer than most AI training data: always check versioned docs (AGENTS.md). Known gotchas
  are recorded in conventions.md.
