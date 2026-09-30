# Runbook

## Everyday

```bash
npm run setup                 # bring everything up clean (idempotent, ~80s with cached images)
npm run test:all              # full suite
npx expo start --host lan     # app on a physical phone
npm run teardown              # stop + delete local data and .env
npm run teardown -- --keep-data   # just stop
npm run setup -- --keep-data      # restart without resetting the DB
```

Prerequisites (checked by setup): Docker Desktop running, Node 22 (`nvm use`), no other
Supabase stack running — stop the prototype's with `(cd ../meetup && supabase stop)`; its
data is kept.

**Something weird locally?** `npm run teardown && npm run setup`. That rebuilds everything
from migrations; there is no local state worth keeping.

## Local ports (offset from Supabase defaults so they never collide with the prototype)

| Service | URL |
|---------|-----|
| API / REST / Auth / Realtime | http://127.0.0.1:54421 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54422/postgres |
| Studio | http://127.0.0.1:54423 |
| Mailpit (local email) | http://127.0.0.1:54424 |

Storage and analytics are **disabled** in `supabase/config.toml` to save Docker memory.
Re-enable `[storage]` when avatars are implemented.

## Environment files

- `.env` is **generated** by `scripts/write-env.sh` (run by setup) — don't edit it.
- Hand-maintained values go in `.env.local` (Expo loads it too; never committed).
- The app URL uses the Mac's LAN IP so a physical phone can reach the stack. If detection
  fails (no `en0`/`en1` address), re-run: `LAN_IP=192.168.x.y bash scripts/write-env.sh`.
  Node tooling rewrites the host to 127.0.0.1, so tests work either way.

## Database

```bash
npx supabase migration new <name>   # create a migration
npm run db:reset                    # rebuild local DB from all migrations
npm run test:db                     # pgTAP
npm run db:types                    # regenerate src/types/database.types.ts
npm run db:types:check              # fail if types are stale
npx supabase db diff                # should print nothing — otherwise Studio drift
```

## Upgrading the Supabase CLI

`npm install --save-dev --save-exact supabase@<version>` → `npm run teardown && npm run setup`
(pulls new images) → `npm run test:all` → commit with a note in `state.md`. CI verifies it.

## Maestro (UI tests)

One-time, machine-wide (ADR 0009 — installs Java via Homebrew, Maestro via its own installer,
not Homebrew, because that formula's own JDK dependency fails to build on this macOS version):

```bash
npm run maestro:setup      # Java 17 + Maestro CLI (idempotent)
npm run maestro:teardown   # reverses it (--keep-java to keep the JDK)
```

`JAVA_HOME`/`PATH` must be set in whatever shell runs `npm run android` or `maestro` —
they don't carry over between separate commands. The setup script prints the exact lines;
add them to `~/.zshrc` once so every new shell has them.

Then, per session:

```bash
# emulator already running? `emulator -list-avds` then `emulator -avd <name>` if not
npm run android             # builds + installs the dev client (first time: several minutes;
                             # also runs Expo prebuild the very first time — generates the
                             # gitignored android/ directory and switches this script from
                             # `expo start --android` to `expo run:android`)
npm run test:e2e            # maestro test .maestro
```

Android is the primary target here — this Mac has no local iOS build path (see below), but
does have a working Android SDK and emulators already. A flow that creates a real account
(like the first one) needs `npm run db:reset` before it can be re-run.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| setup: "Other Supabase stack(s) running" | Stop them (command printed). Two stacks exhaust Docker memory. |
| `supabase start`: container "unhealthy" | Usually memory. `docker ps` for strays; `npm run teardown && npm run setup`. |
| `toomanyrequests: Rate exceeded` pulling images | Public ECR throttling; the CLI retries. Re-run setup if it gives up. |
| Phone: "Network request failed" | Same Wi-Fi; `.env` URL uses LAN IP and port 54421 (see above). |
| Jest: `Cannot use import statement outside a module` | Extend jest-expo's `transformIgnorePatterns`, don't replace it. |
| `npm install` ERESOLVE | Use `npx expo install <pkg>`; check nothing pulled Jest 30 / a mismatched react-dom. |
| iOS local build fails on Xcode version | Expected on macOS Ventura — build iOS with EAS. |
