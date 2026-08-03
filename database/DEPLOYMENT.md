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

**GoTrue → Courier email wiring (2026-07-18):** `GOTRUE_SMTP_HOST=email-server.railway.internal`, `GOTRUE_SMTP_PORT=587`, `GOTRUE_SMTP_USER`/`PASS` empty (internal private-IP relay, not password auth), `GOTRUE_SMTP_ADMIN_EMAIL=noreply@littlefounders.ai`, `GOTRUE_SMTP_SENDER_NAME=LittleFounders`. Auth mail (confirmation / recovery / magic-link / invite / email-change) renders from **branded, trilingual** templates hosted at `https://littlefounders.ai/email-templates/*.html` (wired via `GOTRUE_MAILER_TEMPLATES_*` + `GOTRUE_MAILER_SUBJECTS_*`; language follows the user's registration locale — see `frontend/public/email-templates/README.md`). **Google social login is LIVE (2026-07-20):** `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` + `CLIENT_ID` + `SECRET` + `REDIRECT_URI` all set (client "LittleFounders v2 (GoTrue)", Google Cloud project `littlefounders-auth`); verified end-to-end against production.

**Migrations:** The initial production rollout applied `0001` through `0011` in order via `railway ssh --service db -- psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1`, with no seeds. `0012`–`0022` were applied to production on 2026-07-28 (before the PR #25 merge — see the WALKTHROUGH decision log). **Production's live high-water mark is `0022` exactly, with no `public.schema_migrations` ledger** — verified 2026-08-02 by read-only signature-object probe (0022 objects present, 0023+ absent, no ledger). The current release worktree contains `0023` through `0033` (including the atomic course release gate, illustration-style provenance, and retired game schema) as the unapplied delta, and those deltas are **not production-ready until the migration handoff below is completed**.

### Current release migration handoff (pending production sign-off)

Before deploying this release's Core/Forge/Prism code or running Forge against
the production Vault:

1. Take and verify a fresh Vault backup. Do not use a course-generation budget
   as a substitute for a database restore point.
2. Independently inspect the live high-water mark and whether
   `public.schema_migrations` exists. The recorded rollout state above is a
   starting point, not permission to baseline by assumption. The last such
   inspection: **verified 2026-08-02 by read-only signature-object probe
   (0022 objects present, 0023+ absent, no ledger)**. Re-verify with the
   signature-object table below before applying — each row is a read-only
   probe an operator can run over `railway ssh --service db` with `psql`:

   | Migration | Probe object | Expected at baseline 0022 |
   |---|---|---|
   | 0013 | `learning_stats.longest_streak` column (`information_schema.columns`) | present |
   | 0014 | `to_regclass('public.picture_assets')` | present |
   | 0015 | `to_regclass('public.speech_assets')` | present |
   | 0017 | `to_regclass('public.generation_runs')` | present |
   | 0018 | `to_regclass('public.generation_runs_live')` | present |
   | 0020 | `to_regclass('public.generation_heartbeat_snapshots')` | present |
   | 0021 | `to_regclass('public.email_logs')` | present |
   | 0022 | rows in `pg_publication_tables` for `supabase_realtime` | present (non-empty) |
   | 0023 | `to_regclass('public.learning_events')` | absent |
   | 0024 | `to_regclass('public.anon_visitors')` | absent |
   | 0026 | `to_regclass('public.dataintel_sync_state')` | absent |
   | 0027 | `to_regclass('public.games')` | absent |
   | 0030 | `to_regclass('public.admin_permissions')` | absent |
   | 0031 | `to_regclass('public.course_release_verifications')` | absent |
   | 0032 | `lesson_documents.illustration_style_version` column | absent |
   | ledger | `to_regclass('public.schema_migrations')` | absent |

   `railway-migrate.sh` re-runs the load-bearing subset of these probes
   automatically before accepting `--baseline 0022` and refuses on any
   mismatch; the table exists so the operator can verify independently
   first, not so the check can be skipped.
3. Run the read-only service/configuration preflight from the repository root:

   ```bash
   npm run production:preflight
   ```

   It must report the reviewed service set (`dataintel` included and retired
   `gamegen` absent), an active `RUNNING` instance for each required app
   service, and configured non-placeholder provider/internal variables. It
   never prints secret values or mutates Railway.
   Its transport/classification regression test is local-only:
   `npm run production:preflight:test`.
4. From the repository root, run the operator-only migration runner in dry-run
   mode first:

   ```bash
   RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/railway_key \
     npm --prefix database run db:railway:migrate -- --dry-run --baseline 0022
   ```

   Supply `--baseline 0022` only if the live inspection proves that exact
   high-water mark (the 2026-08-02 probe above did). The dry-run must list
   `0023`–`0033` and must not create the ledger or modify a row.
5. After human review of the dry-run and backup, apply the same plan with the
   explicit mutation flag:

   ```bash
   RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/railway_key \
     npm --prefix database run db:railway:migrate -- \
       --confirm-production --baseline 0022
   ```

   `railway-migrate.sh` records immutable SHA-256 receipts, applies one file
   per transaction, refuses checksum drift, retries transient SSH failures,
   and never seeds or drops production data. The Railway CLI transport does
   not propagate the remote exit status, so the runner verifies every
   statement batch from psql output (the success sentinel present anywhere
   plus the absence of `ERROR:` — order-independent, because psql NOTICEs on
   stderr can be forwarded after the sentinel) and hard-refuses anything
   ambiguous.
6. Verify the postflight receipt count, `public.lesson_documents.illustration_style_version`,
   and the service-role-only `release_course` function. Then deploy the
   reviewed service commit and verify the `/health` chain before any paid
   generation.

The 2026-08-02 read-only Railway inventory found deployment drift: the
production project still has the retired `gamegen` service and does not yet
list `dataintel`. The preflight now fails until that drift is reconciled.
Before the operator deletes `gamegen`, verify that no route, volume, or
scheduled job depends on it; the deletion is a deliberate Railway action, not
an ad-hoc migration step, and this local task does not execute it.

The same read-only variable audit found no `DEEPSEEK_API_KEY`, `QWEN_API_KEY`,
`PICTUREGEN_URL`, `DATAINTEL_URL` or `DATAINTEL_INTERNAL_KEY` in the production
Core/Forge configuration, while Echo's `TTS_API_KEY` and Prism's
`IMAGE_API_KEY` still classify as placeholder-like. Supply these through the
approved secret-management path and run service health/smoke checks before
authorizing any paid generation. The audit never printed variable values.

### Reviewed application-variable checklist

The production operator must configure the following values before the first
paid course run. Values are intentionally not stored in this repository.

| Service | Required variables | Source/relationship |
|---|---|---|
| `coursegen` | `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `PICTUREGEN_URL`, `PICTUREGEN_INTERNAL_KEY` | Provider credentials; Prism's Railway private URL; same shared key as Prism's `INTERNAL_API_KEY` |
| `picturegen` | `IMAGE_API_KEY`, `INTERNAL_API_KEY` | DashScope image credential; shared service-to-service key |
| `audiogen` | `TTS_API_KEY` | DashScope Qwen3-TTS credential; voice map remains reviewed/operator-owned |
| `dataintel` | `INTERNAL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `DUCKDB_PATH` | Shared internal key; Vault gateway/service role; Railway Redis; persistent volume path `/app/duckdb/dataintel.db` |
| `littlefounders-backend` | `DATAINTEL_URL`, `DATAINTEL_INTERNAL_KEY` | Data Intel's Railway private URL; same shared key as Data Intel's `INTERNAL_API_KEY` |

Deploy `dataintel` with `.github/workflows/dataintel-cd.yml` (after its CI
workflow succeeds), attach the documented DuckDB volume, and verify
`GET /health` before wiring Core. Keep the retired `gamegen` service disabled
until its dependencies are checked and the operator removes it deliberately.

This is the only documented production migration path. The local
`db:publish-course` helper and direct ad-hoc `psql` replay are not production
release mechanisms.

**App services' `SUPABASE_URL`:** the public gateway, `https://auth-b2c.littlefounders.ai` (not Kong's private Railway domain) — matches `GOTRUE_JWT_ISSUER`/`API_EXTERNAL_URL` for consistency.

**Before any real (non-test) user data:** backup schedule + one successful restore drill are **DONE** (2026-07-17) — daily `pg_dump` via `.github/workflows/vault-backup.yml`, stored on filebase's Railway volume (a separate disk/service from `db`'s, since Railway wouldn't allow a dedicated backup volume/service at rollout time — see RUNBOOK.md for the full mechanism and the restore drill result).

## Costs & ops (accepted trade-off, WALKTHROUGH 2026-07-11)

9 containers (2 fewer than the original ~7–8 estimate implied for the full 11 — actual running count is 9) ≈ $20–40/mo range still applies. Backups/upgrades are ours — backups are the one piece not yet wired (see above). Local dev never depends on this deployment (same pinned stack runs locally via `npm run db:up`).
