# AGENTS.md — database (Vault)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The schema of record: migrations, RLS policies, seeds, and the generated TS types every service consumes. Deploys as **Supabase self-hosted on Railway** (runbook: [DEPLOYMENT.md](DEPLOYMENT.md)).

## Migration protocol (non-negotiable)

1. Sequential `NNNN_description.sql` — no gaps, no duplicates (`npm test` gates this).
2. **Never edit an applied migration** — write a delta migration.
3. Idempotent DDL: `IF NOT EXISTS` everywhere.
4. **RLS in the same migration** as every `CREATE TABLE` (`npm test` gates this).
5. Verify locally: `npm run db:reset` twice — both must succeed.
6. Regenerate types after schema changes: `npm run db:types` → commit `types/database.ts`.
7. Applying anything to production is a BOUNDARIES action — human sign-off first.

## Invariants owned here (DB-level enforcement of /AGENTS.md §1.3)

- 6-role CHECK on `user_roles.role`; superadmin `@littlefounders.ai` trigger.
- Families = `family_members` join table (multiple parents by construction).
- `guardian_links.verification_status` — only Guardian-driven flows move it to `verified`.
- `audit_logs` append-only: no UPDATE/DELETE policies, ever (`npm test` gates this).
- Signup bootstrap (`0003`): every `auth.users` INSERT auto-creates a profile + grants `universal` (§1.4 default role). Role grants/revokes are audited into `audit_logs` by trigger.
- Profile identity (`0005`): `profiles.username` (unique, `^[a-z0-9_]{3,20}$`), `profiles.cover` = jsonb PRESET config and `avatars.options` = DiceBear option sets — **no image/binary storage exists for covers or avatars, NON-NEGOTIABLE**. `follows` edges are self-managed via RLS (you only write rows where you are the follower); public exposure of profile fields happens ONLY through Core's whitelisted endpoint, never by loosening profiles RLS.
- `0002_content_skeleton.sql` is **PROVISIONAL** — its `lessons` table was superseded by `0007_course_hierarchy.sql`'s real hierarchy (`courses → adventures → sagas → topics → lessons → lesson_documents`, COURSE_ENGINE.md §2); `courses` itself was kept and extended, not dropped.
- `lesson_documents` (`0007`) has **NO RLS SELECT policy at all, by design** — RLS is row-level, not column-level, so any policy that exposed the row to authenticated clients would also expose `answer_keys` (server-only) sitting right next to the client-safe `document` on the same row. Zero permissive policies = deny to `authenticated`/`anon`; only the service role (Core, which bypasses RLS) may read this table, and Core is responsible for stripping `answer_keys` before serving `document` to a browser. Never add a client SELECT policy here — split the answer key out of the table first if that ever needs to change.
- `adventures.age_tier` (`0007`, widened `0008`): `tier1` | `tier2` | `tier3` — tier3 (ages 10-12) is reserved for the Inversiones course only (COURSE_ENGINE.md §3.1b); `courses.requires` (`0008`) is the course-level prerequisite edge, a jsonb array of prerequisite course slugs.
- Spaced-review projection (`0016`): `topics.kind` + `topics.review_of` (raw catalog slug paths, resolved at query time) are persisted by coursegen's publish — the catalog stays the source of truth. The `admin_retention_*` functions are the always-on retention instrument; EXECUTE is revoked from client roles, only Core (service role) may call them.
- Generation caches `picture_assets` (`0014`, Prism) and `speech_assets` (`0015`, Echo): service-role-only posture — **RLS enabled with ZERO policies, on purpose**. Browsers never read these tables (they get plain public Depot URLs embedded in lesson documents/manifests); only the owning service writes. Both guarantee "an identical paid-API request never pays twice" via a unique request-hash column; the asset BYTES live in Depot, these rows only map request → asset.
- Generation telemetry (`0017`): `generation_runs` / `generation_slots` / `generation_tracks` — coursegen's durable scoreboard (per-run summaries, per-slot outcomes with judge rubrics and failure stages, track reports). Same service-role-only posture as 0014/0015: RLS enabled, ZERO client policies; coursegen writes (swallow-on-failure ingest), Core's staff console (`/api/v1/admin/generation*`) is the only reader. Telemetry, never control flow — no pipeline behavior may ever depend on these rows.
- Generation live heartbeat (`0018`): `generation_runs_live` — per-run heartbeat upserted on every slot stage transition DURING active generation runs (active/completed/failed counts, stage breakdown, cost, images). Complement to 0017's post-mortem view; deleted when the run finishes; rows stale >2 min are ignored (the run process died). Same service-role-only posture; Core's `GET /api/v1/admin/generation/live` is the only reader.
- Generation Realtime (`0019`): SELECT RLS policy on `generation_runs_live` for admin/superadmin — the ONLY client-accessible policy on generation tables. Enables Supabase Realtime (Postgres CDC) push-based live monitoring in the admin dashboard, replacing the previous 2s polling. Table carries zero PII.
- Heartbeat snapshots (`0020`): `generation_run_snapshots` — time-series record of every heartbeat update saved as a row. Used by the admin dashboard to render a run's progress curve over time (timeline chart). Same service-role-only posture as 0017/0018.
- Email logs (`0021`): `email_logs` — transactional email audit trail (id, message_id, to_address, subject, template_type, locale, user_id, status, detail jsonb, created_at). Service-role-only posture: RLS enabled, ZERO client policies. The table exists for future durable email persistence; currently email-server logs are in-memory (ring buffer) and exposed via HTTP. Indexes on created_at DESC, status, and to_address.

## The pinned Supabase stack (NON-NEGOTIABLE)

Local dev and production run the **official self-hosted stack from a clone of
`supabase/supabase` pinned in [`SUPABASE_VERSION`](SUPABASE_VERSION)** — always
the latest functional/approved release. `npm run db:sync` materializes the
clone at `database/supabase/` (gitignored; blobless sparse checkout of
`docker/`). Upgrades: bump the pin → sync → reset-twice + `npm test` →
update the DEPLOYMENT.md pin table in the same commit. Never run `latest`
tags; never edit files inside the clone (they're upstream's).

## Local dev

Requires Docker (and the Supabase CLI only for `db:types`). First run of
`npm run db:up` creates `supabase/docker/.env` with generated secrets
(gitignored) and email autoconfirm ON (local has no SMTP). Then:
`db:migrate` / `db:seed` / `db:reset` (from-zero: nuke → up → migrate) /
`db:types` (regenerates `types/database.ts` through the Supavisor pooler).
Studio: http://localhost:8000 (credentials: `supabase/docker/.env`).
Seeds: `seeds/dev_seed.sql` (dev only, never prod).
