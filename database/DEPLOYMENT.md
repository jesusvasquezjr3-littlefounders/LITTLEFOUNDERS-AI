# DEPLOYMENT.md — Supabase Self-Hosted on Railway

> Runbook for ROADMAP Day 4–5. Deploying/applying anything to production is a BOUNDARIES action — human sign-off first.

## Source of truth: the pinned upstream clone (NON-NEGOTIABLE)

Local dev **and** production both run the official self-hosting stack from a
clone of `supabase/supabase`, pinned to the latest **functional/approved
release** in [`SUPABASE_VERSION`](SUPABASE_VERSION) (currently `v1.26.07`,
released 2026-07-09). One version string reproduces the whole stack anywhere.

- `npm run db:sync` materializes/updates the clone at the pin (`database/supabase/`, gitignored — blobless sparse checkout of `docker/`).
- The pin table below MUST mirror `database/supabase/docker/docker-compose.yml` at the pinned tag. Railway services use exactly these image tags — never `latest`.

### Upgrade procedure (keeps us on the newest approved Supabase)

1. Review the new release: [releases](https://github.com/supabase/supabase/releases) + `docker/CHANGELOG.md` (breaking changes) + `docker/versions.md`.
2. Bump `SUPABASE_VERSION` → `npm run db:sync`.
3. Local proof: `npm run db:reset` twice (both green) + `npm test` + smoke the auth flow.
4. Update the pin table below in the same commit as the version bump.
5. Production rollout (sign-off required): backup first, then update Railway image tags to match, migrate, verify `/health` chain.

## Component versions (pin — mirrors docker-compose.yml @ v1.26.07)

| Component | Image | Version |
|---|---|---|
| postgres | `supabase/postgres` | `17.6.1.136` |
| gotrue (auth) | `supabase/gotrue` | `v2.189.0` |
| postgrest | `postgrest/postgrest` | `v14.12` |
| realtime | `supabase/realtime` | `v2.102.3` |
| storage-api | `supabase/storage-api` | `v1.60.4` |
| imgproxy | `darthsim/imgproxy` | `v3.30.1` |
| kong | `kong/kong` | `3.9.1` |
| studio | `supabase/studio` | `2026.07.07-sha-a6a04f2` |
| postgres-meta | `supabase/postgres-meta` | `v0.96.6` |
| edge-runtime | `supabase/edge-runtime` | `v1.74.0` |
| supavisor (pooler) | `supabase/supavisor` | `2.9.5` |

(Logflare/Vector analytics are an optional overlay in this release — `docker-compose.logs.yml` — and are not part of our default stack.)

## Production plan (Railway)

1. Deploy the stack components above as Railway services with the pinned tags (Postgres, Kong, GoTrue, PostgREST, Realtime, Storage, Studio, postgres-meta, Supavisor).
2. Secrets: generate per-environment with `docker/utils/generate-keys.sh` semantics (JWT secret, anon/service keys, DB + dashboard passwords) into Railway variables — never committed.
3. Configure GoTrue: email signups on, autoconfirm OFF (real email verification via Courier later), site URL = Vercel frontend, custom domains at this stage.
4. Apply `migrations/` in order; run NO seeds in production.
5. Wire service env vars (backend `SUPABASE_*`) from Railway shared variables.
6. **Before any real user data:** backup schedule (`pg_dump` to external storage) + one successful restore drill, recorded in /RUNBOOK.md.

## Costs & ops (accepted trade-off, WALKTHROUGH 2026-07-11)

~7–8 containers ≈ $20–40/mo. Backups/upgrades are ours. Local dev never depends on this deployment (same pinned stack runs locally via `npm run db:up`).
