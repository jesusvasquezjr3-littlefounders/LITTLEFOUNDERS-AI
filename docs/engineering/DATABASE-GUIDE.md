---
title: Database guide
status: scaffold
updated: 2026-10-11
---

# Database guide

> Schema conventions, migrations, permissions and data handling for the database.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The database is the last line of defense for children's data. This guide holds the rules every table, policy and migration must follow, so nothing is exposed by default.

## Read this when

- Creating or changing a table, policy, function or migration.
- Writing seed or test data.
- Deciding what data may be stored.

## To define

- [ ] Naming, identifiers, timestamps and deletion conventions.
- [ ] Migration workflow: authoring, review, rollout and rollback.
- [ ] Row-level security model: roles, default-deny, one policy set per table.
- [ ] Data classification: personal data, minors' data, sensitive data, public data.
- [ ] Retention, deletion and erasure rules.
- [ ] Indexing and query-performance rules.
- [ ] Seed and synthetic-data policy (no real children's data outside production).
- [ ] Local, staging and production differences.
- [ ] Backup and restore expectations.

## Current state

- Self-hosted Supabase is pinned in `database/SUPABASE_VERSION`. `database/migrations/0001_identity.sql` is the first migration of the restart: profiles, user types, the age record and the audit trail ([[F-001-authentication]]). `0002_email.sql` adds what the emails need: whether an account takes the optional emails, the functions that read and set an account's language, and `email_logs`, the mail service's delivery history, which is the one table a service reads and writes directly ([[F-002-emails]]). `0003_onboarding.sql` adds the chosen mentor and the parent intent to the profile and the function that sets them and the name ([[F-003-onboarding]]). `0004_mail_least_privilege.sql` gives the mail service a role of its own, `mail_service`, with those three privileges on `email_logs` through policies written for it alone, and takes the table away from `service_role`; it deletes an account's lines when the account is deleted, and removes every line after 90 days with a nightly `pg_cron` job. A service that needs a table gets a role like this one, never the service key. `0005_review_followups.sql` adds `core_account_exists` (Core's own bookkeeping for the allowance of emails to new addresses; the answer is never told to a caller) and the display-name rules.
- The pattern it sets, to follow until the conventions above are written with the owner: every table has row-level security on and **no policy**, and `anon`, `authenticated` and `service_role` are revoked from it, so nothing reaches a table from outside; the backend works only through `SECURITY DEFINER` functions named `core_*`, with an empty `search_path` and fully qualified names, executable by `service_role` alone (Supabase's default privileges hand new functions to every API role, so each migration revokes them); a rule that matters is a trigger or a constraint, so it holds whoever writes; personal data is kept to what a feature needs (an age, not a birth date).
- Migrations are applied by `npm run db:migrate` in `database/` (`scripts/local-stack.sh`), one transaction per file, recorded with a checksum in `public.schema_migrations`; an applied file is never edited. `npm run db:reset` rebuilds the local database from zero and deletes local data.
- The local stack is closed like production (it mounts `database/railway/kong/kong.yml`) and has a mail catcher at `http://localhost:8025` where the emails arrive.
- The previous version's local database was dumped to `database/backups/legacy-local-2026-10-10.dump` (not tracked) before the first reset, to rehearse the migration of production data (T-026). Backups are described in [[BACKUP-RESTORE]].

## Related

- [[F-001-authentication]]
- [[ARCHITECTURE]]
- [[SECURITY-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[API-GUIDE]]
- [[BACKEND-GUIDE]]
- [[ENVIRONMENT-SETUP]]
- [[BACKUP-RESTORE]]
- [[GLOSSARY]]

Back to [[INDEX]].

## Update this document when

- A convention, role or policy pattern changes.
- The Supabase pin is moved.
