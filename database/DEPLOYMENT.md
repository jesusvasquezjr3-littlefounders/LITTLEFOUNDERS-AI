# DEPLOYMENT.md — Supabase Self-Hosted on Railway

> Runbook for ROADMAP Day 4–5/8. Deploying/applying anything to production is a BOUNDARIES action — human sign-off first.
>
> **Status: DEPLOYED 2026-07-17** (Railway project `littlefounders-b2c`, public gateway `auth-b2c.littlefounders.ai`). 9 of the 11 components below are live — see "What's actually deployed" below for the two that were deliberately skipped and why. **Backups + restore drill are DONE** (2026-07-17, daily automated + one drill performed) — see RUNBOOK.md; the mechanism is an interim shape (filebase's volume, not a dedicated one) worth revisiting once Railway billing allows it.

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

## What's actually deployed (2026-07-17)

9 of the 11 components: **postgres, kong, gotrue (auth), postgrest (rest), realtime, storage-api, studio, postgres-meta (meta), supavisor** — each a Railway service in project `littlefounders-b2c`, named `db`/`kong`/`auth`/`rest`/`realtime`/`storage`/`studio`/`meta`/`supavisor`.

**Not deployed, on purpose: `imgproxy` and `edge-runtime` (functions).** No app code calls Supabase Storage's image-transform path or Supabase Edge Functions — Depot (`filebase/`) is the real, actively-used media service, and the `volumes/functions/` dir only ever held the stock "hello" example. Deploying them would also require solving a problem docker-compose doesn't force us to solve on Railway: `storage` and `imgproxy` share a local-disk volume upstream, but a Railway volume can only attach to one service. Re-add both (with a real reason) if that ever changes; `storage-api` runs today with `ENABLE_IMAGE_TRANSFORMATION=false`.

**`db` and `kong` run from small custom Dockerfiles, not bare pinned images** (`database/railway/db/`, `database/railway/kong/`) — Railway's Docker-image services can't bind-mount files from the repo the way `docker compose` does locally, so these Dockerfiles `FROM` the exact pinned image and `COPY` in the same init SQL / declarative config the upstream compose file mounts, copied verbatim from the gitignored `database/supabase/` clone, never hand-edited. `kong.yml` is adapted for Railway: every backend hostname is a `$KONG_<NAME>_HOST` placeholder, substituted at boot from each dependency's real `RAILWAY_PRIVATE_DOMAIN` (wired as plain env vars on the `kong` service — never hardcoded, so it stays correct if a service is ever renamed). `database/railway/db/fix-volume-entrypoint.sh` works around two things hit during the real deploy: Railway volumes mount as a fresh ext4 root (pre-populated with `lost+found`, which `supabase/postgres`'s own entrypoint treats as "directory not empty" and refuses to `initdb`), and a partial/failed prior init can leave debris with no `PG_VERSION` marker. The script clears both cases and never touches a directory that already has a valid `PG_VERSION` (real data is never at risk).

**Secrets:** generated locally with `openssl` following `docker/utils/generate-keys.sh` semantics (JWT secret, anon/service-role keys, DB + dashboard passwords, Realtime/Supavisor encryption keys), set directly as Railway variables per service — never committed, never printed in full outside that one generation step.

**GoTrue config, as actually set:** `GOTRUE_DISABLE_SIGNUP=false`, `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`, **`GOTRUE_MAILER_AUTOCONFIRM=false`** (since 2026-07-18 — Courier/email-server is live, so signups are verified against real mailbox ownership), phone auth disabled, `SITE_URL=https://littlefounders.ai`, `API_EXTERNAL_URL=https://auth-b2c.littlefounders.ai/auth/v1`.

**GoTrue → Courier email wiring (2026-07-18):** `GOTRUE_SMTP_HOST=email-server.railway.internal`, `GOTRUE_SMTP_PORT=587`, `GOTRUE_SMTP_USER`/`PASS` empty (internal private-IP relay, not password auth), `GOTRUE_SMTP_ADMIN_EMAIL=noreply@littlefounders.ai`, `GOTRUE_SMTP_SENDER_NAME=LittleFounders`. Auth mail (confirmation / recovery / magic-link / invite / email-change) renders from **branded, trilingual** templates hosted at `https://littlefounders.ai/email-templates/*.html` (wired via `GOTRUE_MAILER_TEMPLATES_*` + `GOTRUE_MAILER_SUBJECTS_*`; language follows the user's registration locale — see `frontend/public/email-templates/README.md`). **Google social login** is code-complete with `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` pre-staged; enabling it is the owner's last step — set `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` + `CLIENT_ID` + `SECRET`.

**Migrations:** `0001` through `0011` applied in order via `railway ssh --service db -- psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1`, no seeds. (`0011_oauth_bootstrap` teaches `handle_new_user()` to derive `display_name` from an OAuth provider's `full_name`/`name` metadata — verified applied in prod.)

**App services' `SUPABASE_URL`:** the public gateway, `https://auth-b2c.littlefounders.ai` (not Kong's private Railway domain) — matches `GOTRUE_JWT_ISSUER`/`API_EXTERNAL_URL` for consistency.

**Before any real (non-test) user data:** backup schedule + one successful restore drill are **DONE** (2026-07-17) — daily `pg_dump` via `.github/workflows/vault-backup.yml`, stored on filebase's Railway volume (a separate disk/service from `db`'s, since Railway wouldn't allow a dedicated backup volume/service at rollout time — see RUNBOOK.md for the full mechanism and the restore drill result).

## Costs & ops (accepted trade-off, WALKTHROUGH 2026-07-11)

9 containers (2 fewer than the original ~7–8 estimate implied for the full 11 — actual running count is 9) ≈ $20–40/mo range still applies. Backups/upgrades are ours — backups are the one piece not yet wired (see above). Local dev never depends on this deployment (same pinned stack runs locally via `npm run db:up`).
