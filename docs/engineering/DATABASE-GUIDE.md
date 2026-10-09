---
title: Database guide
status: scaffold
updated: 2026-10-09
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

- Self-hosted Supabase is pinned in `database/SUPABASE_VERSION`. `database/migrations/` is empty: there is no schema yet. Backups are described in [[BACKUP-RESTORE]].

## Related

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
