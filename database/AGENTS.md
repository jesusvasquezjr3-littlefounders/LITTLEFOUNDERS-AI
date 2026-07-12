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
- `0002_content_skeleton.sql` is **PROVISIONAL** — don't deepen logic on it before the dedicated schema session.

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
