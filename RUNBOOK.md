# RUNBOOK.md — Incident Response

## Rollback to v1 (historical — v2 is in production as of 2026-07-17)

v1 is no longer live and no longer on `main` (superseded by the `feat: total v2 rewrite` squash commit, 2026-07-17). To inspect or resurrect it: `git log main --diff-filter=D` finds the squash commit; v1's actual last state is the parent of that commit. There is no automatic rollback — reverting to v1 in production would mean redeploying its old Render/Railway/Vercel config from that commit by hand, which no longer matches the current Railway project (`littlefounders-b2c`) or Vercel project settings (Root Directory now `frontend`). Treat this as "possible but non-trivial," not a one-command undo.

For a v2 production incident, prefer **rolling forward** (fix + redeploy via CD, or `railway redeploy`/`vercel deploy --prebuilt --prod` to the last known-good build) over reaching for v1.

## Secrets leak (a credential landed in git)

1. **ROTATE the credential immediately** — at the provider (Supabase, Railway, DeepSeek, Qwen…). Rotation is the containment; history rewriting is not.
2. Purge from history (`git filter-repo`) only after rotation, coordinate force-push with the team (BOUNDARIES action).
3. Verify `npm run secrets:check` catches the pattern; if it didn't, add the pattern to `agent/tools/check-secrets.sh`.
4. Record the incident + fix here.

## CI red on littlefounders_v2 / main

1. `gh run list --branch <branch>` → `gh run view <id> --log-failed`.
2. Reproduce locally: `cd <service> && npm ci && npm run type-check && npm run lint && npm test`.
3. Fix forward if < 30 min; otherwise revert the breaking commit. Never merge over red.

## Supabase self-hosted on Railway (deployed 2026-07-17 — backup/restore still open, see below)

- **Restart procedure:** `railway redeploy --service <name> --yes` (db, kong, auth, rest, realtime, storage, meta, supavisor, studio — all in Railway project `littlefounders-b2c`). Restart `db` first if the whole stack is down; the rest depend on it and will recover on their own restart-on-failure policy once `db` is healthy again. Check `railway logs --service <name>` for `FATAL`/crash-loop before assuming a redeploy will help.
- **Backup: CONFIGURED 2026-07-17.** `.github/workflows/vault-backup.yml` runs daily (08:00 UTC, plus `workflow_dispatch` for on-demand runs) — `pg_dump -Fc` inside the `db` container via `railway ssh`, piped straight to `/data/backups/vault-<UTC timestamp>.dump` on **filebase's (Depot) Railway volume** (`railway ssh --service filebase`, writing to the container filesystem directly — not through filebase's HTTP API, which only accepts audio/image/JSON mime types by design). This is deliberately NOT a dedicated backup volume: `db` already uses its one allowed Railway volume for PGDATA, and creating a new service for this was blocked by Railway's expired trial at rollout time. filebase's volume is still a genuinely separate disk on a separate service, so a `db`-volume incident doesn't take out its own backups — but **revisit this once Railway billing is resolved; a dedicated backup volume is the better long-term shape.** 30-day retention (auto-pruned by the same workflow). Auth: a dedicated SSH keypair (`vault-backup-ci`, registered via `railway ssh keys add`) stored as the `RAILWAY_SSH_PRIVATE_KEY` repo secret — separate from any personal key.
- **Restore drill: PERFORMED SUCCESSFULLY 2026-07-17.** Restored a real production dump into a scratch database (`CREATE DATABASE restore_drill_test`, `pg_restore -U supabase_admin -d restore_drill_test --no-owner --no-acl`) on the same `db` server. Row counts matched exactly against the live `postgres` database across `profiles`, `user_roles`, `courses`, `audit_logs` (1/1/0/1 both sides); `restore_drill_test` was then dropped. Repeat this drill periodically (e.g. quarterly, or after any migration) — a backup that's never been restored is unverified by definition.
- **Upgrade procedure:** bump `database/SUPABASE_VERSION` → `npm run db:sync` → local `db:reset` ×2 + tests green → update the pin table in `database/DEPLOYMENT.md` → **take a verified backup first** (see above — this is exactly the scenario backups exist for) → rebuild/redeploy `database/railway/db` and `database/railway/kong` (their Dockerfiles pin the same version) → `railway add --image <new-tag>` or update each plain-image service's source for auth/rest/realtime/storage/meta/supavisor/studio → re-apply any new migrations → verify `/health` chain + a real login before considering it done.

## Pulse (observability stack — Plausible CE + Umami + Uptime Kuma)

- **Services (Railway project `littlefounders-b2c`):** `pulse-plausible` (app), `pulse-clickhouse` (events, volume `/var/lib/clickhouse`), `pulse-db` (Postgres 16, PGDATA volume, logical DBs `plausible` + `umami`), `pulse-umami` (app), `pulse-kuma` (volume `/app/data` — its SQLite holds every monitor; **redeploying without the volume wipes the monitoring config**). Restart order if the whole stack is down: `pulse-db` → `pulse-clickhouse` → apps.
- **An outage here loses telemetry, never product.** No product service depends on Pulse; degrade gracefully and fix without urgency-pressure. The admin panel's Analytics/Health cards will show Core's upstream-unreachable envelope error meanwhile.
- **Backup:** `.github/workflows/pulse-backup.yml` daily 08:30 UTC — `pg_dump -Fc` of both logical DBs, tar'd to `/data/backups/pulse-<ts>.dump` on Depot's volume (same mechanism/keys as the Vault backup; 30-day retention). **ClickHouse events are deliberately not dumped**: accepted-loss analytics (decision 2026-07-20) — a volume incident loses history, not correctness; revisit if analytics history ever becomes a compliance artifact.
- **Restore:** untar the dump, `pg_restore -U postgres -d plausible --no-owner --no-acl plausible.dump` (and same for `umami`) inside `pulse-db` via `railway ssh`. Run a restore drill after first real data accumulates (same policy as Vault).
- **Upgrade / rollback:** pins live ONLY in `pulse/railway/*/Dockerfile` `FROM` lines (protocol: `pulse/AGENTS.md`). Rollback = revert the bump commit; `pulse-cd.yml` redeploys. Plausible+ClickHouse move together; Plausible < v3.2.1 is FORBIDDEN (CVE-2026-8467 RCE) and the registry must stay ghcr.io (Docker Hub is frozen at v2.1.4).
- **Automerge mechanics (no repo config needed):** `pulse-dependabot-automerge.yml` triggers on `workflow_run` of `pulse CI` — it merges a Dependabot `dependabot/docker/pulse/*` PR only when CI already SUCCEEDED on it, and only for patch-level semver bumps (parsed from the PR title; anything unparsable or minor/major is left open for human review). No branch protection or *Allow auto-merge* flag required, and non-pulse PRs are untouched.
- **Kuma admin surface:** keep 2FA on; it is the one Pulse UI with real blast radius (its release line has patched admin-RCE-class issues — the Dependabot pin keeps it current). If compromised-looking: redeploy from pin + restore `/app/data` volume snapshot, rotate its admin password.

## Service down (Railway)

1. Check `/health` of the service; check Railway logs/deploy status.
2. Redeploy last green build; if DB-related, check Vault components (Kong, GoTrue, Postgres) in order.
3. Record cause + fix in this file.

## Railway cost / right-sizing (memory is ~97% of the bill)

Railway bills almost entirely on **memory actually used** (GB-minutes) — CPU,
egress and volume are rounding errors at our scale. To diagnose cost: Project
→ Settings → Usage → *View Cost by Service*, sort by RAM. The whole
optimization game is "which services hold the most resident RAM, and do they
need to."

**Known finding + fix APPLIED (2026-07-17): Kong was ~63% of the entire memory bill.**
Kong (OpenResty) defaults `nginx worker_processes` to `auto` = one worker per
**host** core; Railway hosts expose ~50 cores, so Kong spawned ~50 workers
(each a full Lua VM + resident declarative config) → **~5.8 GB RSS, 52
processes**, alone ~$34/mo of a ~$52/mo bill. Fix: `KONG_NGINX_WORKER_PROCESSES=2`
(baked into `database/railway/kong/Dockerfile` ENV + set as a Railway variable).
Applied + redeployed 2026-07-17 → **measured live: 192 MB RSS, 6 processes**
(~97% less), ~$1.6/mo. Two workers × `worker_connections 16384` = ~32k
concurrent connections, far above our load; **this is right-sizing, not a
scalability cap** — raise the value (or set `auto`) via the ENV/variable the
moment real traffic warrants. Verified after: full signup→/me→login chain
through Kong returns 201/200/200.

**Right-sizing levers, biggest-first (all reversible) — status 2026-07-17:**
1. ✅ **Kong worker cap** (above) — APPLIED, the giant (~$32/mo saved). Always
   keep capped for low traffic.
2. ⏭️ **Node heap cap — SKIPPED, not warranted.** Measured backend/Core at
   steady state = ~105 MB RSS (npm 28 + node ~74); the earlier high number was
   inflated by repeated rollout redeploys, not real usage. A
   `--max-old-space-size` cap would do nothing (app is well under any cap) and
   only add OOM risk — measure before capping any Node service; only cap if
   steady-state RSS is genuinely high (>~400 MB).
3. ✅ **Scale-to-zero (Railway service → Settings → Serverless) — APPLIED** to
   the 8 services with zero live-user traffic: `studio` (admin dashboard),
   `meta` (studio-only), `storage`/`supavisor`/`realtime` (deployed but unused
   by app code), `coursegen`/`audiogen`/`gamegen` (operator-triggered
   generation). They sleep after ~10-15 min idle and wake on first request;
   cold start is irrelevant for admin/generation and they receive no user
   traffic. Combined ~$8/mo → near-$0 while asleep.
   **NEVER sleep the hot path** — kept always-warm: `kong`, `auth` (GoTrue),
   `rest` (PostgREST — Core reads/writes the DB through it), `db`,
   `littlefounders-backend`, `Redis` (rate-limit store, hit every request),
   `filebase` (Depot serves public media + holds the backups volume),
   `parent-id-check` (user-triggered during Tutor verification — kept warm to
   avoid cold-start latency on that flow). If you later wire realtime
   subscriptions or route DB traffic through supavisor, disable Serverless on
   those two then.

Net effect: estimated bill **~$52.74/mo → ~$12/mo** (observed: the Railway estimate dropped to
$11.98 right after applying — kong ~$32 + sleeping services ~$8), no
capability removed, every change reversible as you scale.

**Note:** these all require the Railway account active — a suspended
trial/unpaid state blocks deploys/redeploys (variable edits still stage for the
next deploy). To re-apply on a fresh environment: the Kong cap is version-
controlled in its Dockerfile; the Serverless toggles are per-service dashboard
settings (not in code) — re-enable them after any service re-create.

## Published content invisible to users (RLS policy silently missing) — incident 2026-07-13

**Symptom:** a fully-published course (every row `status='published'`, all counts correct via service-role/psql) renders **zero lessons** for real logged-in users. No errors anywhere — the API returns `lessons: []`.

**Cause:** a table with `ENABLE ROW LEVEL SECURITY` and **no** permissive SELECT policy denies every row to `authenticated`. On this instance, `lessons` lost its `lessons_select_published` policy because re-running `npm run db:migrate` replays `0002_content_skeleton.sql`, whose old policy references the since-removed `lessons.course_id` column — the replay aborts mid-way with `column "course_id" does not exist`, dropping the policy without recreating it. (Follow-up delta migration tracked separately.)

**Diagnose:** `bash database/scripts/local-stack.sh psql -c '\d <table>'` → look at the `Policies` section. `(none)` + "row security enabled" on a user-readable table = this incident. Compare against the policy blocks in `database/migrations/0007_course_hierarchy.sql`.

**Fix:** re-apply the exact `CREATE POLICY` block from the authoritative migration (0007 for the course hierarchy) via `local-stack.sh psql`. Then verify **as a real user in the browser** — service-role queries bypass RLS and prove nothing about visibility.

**Prevention:** until the delta migration lands, do NOT re-run `db:migrate` on an instance that is already past 0007; after any publish/RLS/schema change, the acceptance check is a real login seeing the content, never a row count.

## Frontend deep links 404 / every API call 405s — incident 2026-07-17 (first production deploy)

**Symptom A:** `littlefounders.ai` loads, but any deep link (`/signup`, `/login`, `/faq`, a refresh on any non-root route) returns Vercel's 404 page.

**Cause A:** the Vercel project's Root Directory was unset (= repo root) with a manual Build Command override (`cd frontend && npm install && npm run build`) and Output Directory override (`frontend/dist`) — a leftover pattern from before `frontend/vercel.json`'s SPA rewrite existed. Vercel only reads `vercel.json` from the configured Root Directory; with Root Directory empty, it looked for a `vercel.json` at the true repo root (deleted along with v1) and found none, so it fell back to a default static-site config with no SPA fallback (`^(?!/api).*$` → `/404.html`).

**Fix:** set Root Directory = `frontend` in Vercel Project Settings → Build and Deployment, and remove the manual Build Command/Output Directory overrides (Vite framework auto-detect now provides correct defaults from within `frontend/`). Confirm the fix by inspecting `.vercel/output/config.json` after `vercel build` — it must show `{"handle": "filesystem"}` then a catch-all rewrite to `/index.html`, not a catch-all to `/404.html`.

**Symptom B:** every frontend API call resolved to `https://littlefounders.ai/[SENSITIVE]/api/v1/...` → HTTP 405, instead of hitting the backend domain.

**Cause B:** `VITE_BACKEND_URL` was added as a Vercel environment variable with the "Sensitive" toggle ON (the dashboard's default state for new variables). Sensitive variables are **write-only** — Vercel will never return their real value again, not via the dashboard, not via `vercel pull`, not even to the project owner. The build baked in the literal placeholder string `"[SENSITIVE]"` as the value, which Vite/the router then resolved as a relative path segment.

**Fix:** delete the Sensitive variable and re-add it with the toggle OFF. `VITE_BACKEND_URL` is not actually a secret — Vite inlines it into the public JS bundle regardless, so marking it Sensitive only broke the build without adding any real protection. Reserve "Sensitive" for values that must never appear in the dashboard UI again (e.g. server-side API keys), never for `VITE_*`/public client config.

**Prevention:** after any Vercel project settings change or new environment variable, do a real `vercel build && vercel deploy --prebuilt --prod` and click through at least one deep link and one API-calling flow (e.g. signup) in a browser before considering the deploy done — a green build does not prove routing or env vars are correct.
