# 0009 — Maestro toolchain: scripted, Java via Homebrew, Maestro via its own installer

- **Status:** Accepted · 2026-09-30

## Context
Maestro needs Java 17+ (with `JAVA_HOME` set) and its own CLI — machine-wide prerequisites,
not project dependencies. ADR 0005 already chose Maestro over Detox; the prototype's Detox
setup was exactly the kind of fickle, undocumented, hard-to-reproduce environment step the
owner wants avoided this time (ADR 0008's reproducibility requirement applies here too).

This machine is on **macOS 13.7.8 (Ventura)**, which Homebrew has downgraded to a "Tier 3",
no-bottle configuration — formulas without a prebuilt binary for this OS version are compiled
from source. It has no local iOS build path (ADR 0003) but already has a working Android SDK
with emulators (`Pixel_9`, `Pixel_10_Pro`) and an authenticated EAS CLI session — no EAS login
needed for local dev-client builds.

## What was tried and what actually happened
1. `brew install openjdk@17` — succeeded (compiled several transitive deps, e.g. `json-c`,
   `libunistring`, from source; slow but fine).
2. `brew install mobile-dev-inc/tap/maestro` — **failed**. That formula separately declares
   `depends_on "openjdk"` (unversioned, currently major 27) regardless of the `openjdk@17`
   already present, and Homebrew tried to compile that from source too — which failed outright
   (`make[1]: *** [main] Error 2`) on this Tier-3 configuration.
3. Switched to Maestro's own installer (`curl -fsSL "https://get.maestro.mobile.dev" | bash`),
   which installs prebuilt Maestro binaries to `~/.maestro` and only needs a `java` already on
   `PATH` — it does not try to install its own JDK. Using the `openjdk@17` from step 1, this
   worked immediately.

## Decision
- `scripts/setup-maestro.sh` / `scripts/teardown-maestro.sh` (`npm run maestro:setup` /
  `maestro:teardown`): Java 17 via Homebrew (`openjdk@17`, pinned to an LTS — not "latest"),
  Maestro via its official installer (not Homebrew). Both idempotent.
- **Android is the primary target for Maestro**, using `npm run android` (Expo prebuild +
  local Gradle build, installed on a running emulator) rather than an EAS cloud build — free,
  faster to iterate on, and this Mac's Android SDK already supports it. EAS remains available
  for iOS (ADR 0003) and CI later.
- Flows live in `.maestro/*.yaml`, run with `npm run test:e2e` (`maestro test .maestro`).
  Each flow starts with `launchApp: clearState: true` for a clean app-storage slate.
- **`JAVA_HOME`/`PATH` must be exported in the same shell invocation that runs anything
  needing Java** (`gradlew` via `npm run android`, and `maestro` itself) — they do not persist
  from one command to the next in this harness, and Gradle fails with a plain "Unable to
  locate a Java Runtime" if skipped. Add the export to `~/.zshrc` for interactive use (the
  setup script prints the exact lines); CI will need the same exports in its own step.

## Consequences
+ `npm run maestro:setup` / `teardown` fully reverses the machine-wide install; nothing is
  left behind silently.
+ No EAS/Apple credential setup needed for the first flow.
+ Avoids a second, currently-broken-on-this-OS JDK compile entirely.
− Flows that sign up a real user (e.g. the first flow) mutate the local Supabase database;
  re-running requires `npm run db:reset` first. Acceptable for now — revisit (e.g. a
  service-role cleanup step, or generated unique emails) if this becomes a friction point in
  CI or with more flows.
− First Homebrew installs on this machine can be slow (Tier 3: no prebuilt bottles for some
  formulas). Not a problem specific to Maestro/Java — expect it for other new formulas too.
