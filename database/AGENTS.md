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
- `0002_content_skeleton.sql` is **PROVISIONAL** — don't deepen logic on it before the dedicated schema session.

## Local dev

Requires the Supabase CLI. First time: `supabase init` here (config not committed until Day 4–5 deploy work), then `npm run db:start` / `db:reset`. Seeds: `seeds/dev_seed.sql` (dev only, never prod).
