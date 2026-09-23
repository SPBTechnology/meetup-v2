# Runbook

## Start a session

1. Docker Desktop running.
2. Prototype stack stopped (both don't fit in Docker's memory):
   `cd ../meetup && supabase stop` — its data is kept; `supabase start` there restores it.
3. `supabase start` in this repo.
4. `npx expo start` (add `--host lan` for a physical phone).

## Local ports (offset from Supabase defaults so they never collide with the prototype)

| Service | URL |
|---------|-----|
| API / REST / Auth / Realtime | http://127.0.0.1:54421 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54422/postgres |
| Studio | http://127.0.0.1:54423 |
| Mailpit (local email) | http://127.0.0.1:54424 |

Storage and analytics are **disabled** in `supabase/config.toml` to save Docker memory.
Re-enable `[storage]` when avatars are implemented.

## Environment

`cp .env.example .env`, then fill keys from `supabase status`. For a physical phone,
`EXPO_PUBLIC_SUPABASE_URL` must use the Mac's LAN IP (`ipconfig getifaddr en0`, or `en1`
on some Macs) — `127.0.0.1` on the phone means the phone. Node tooling rewrites the host to
127.0.0.1 automatically, so tests work either way.

## Database

```bash
supabase migration new <name>     # create
supabase db reset                 # rebuild local DB from all migrations
npm run test:db                   # pgTAP
supabase db diff                  # should print nothing — else Studio drift, capture as migration
supabase gen types typescript --local --schema public > src/types/database.types.ts
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `supabase start`: a container "unhealthy" | Usually Docker memory. Stop other stacks (`docker ps`), retry. |
| Phone: "Network request failed" | Same Wi-Fi; `.env` URL uses LAN IP, port 54421; Supabase running. |
| Jest: `Cannot use import statement outside a module` in node_modules | A package needs transforming — extend jest-expo's `transformIgnorePatterns`, don't replace it. |
| `npm install` ERESOLVE | Use `npx expo install <pkg>`; check nothing pulled Jest 30 / react-dom ≠ react version. |
| iOS local build fails on Xcode version | Expected on macOS Ventura — build iOS with EAS. |
