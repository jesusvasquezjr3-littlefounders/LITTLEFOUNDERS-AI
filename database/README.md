# database (Vault)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Schema, migrations, RLS, seeds, generated shared types.
**Stack source:** clone of `supabase/supabase` pinned to the latest approved release in [SUPABASE_VERSION](SUPABASE_VERSION) — same stack locally and in production ([DEPLOYMENT.md](DEPLOYMENT.md)).

```bash
npm test            # migration gates: numbering, RLS coverage, append-only audit
npm run db:sync     # materialize/update the pinned supabase/supabase clone
npm run db:up       # start the local stack (first run generates .env secrets)
npm run db:migrate  # apply only migrations not recorded in the immutable ledger
npm run db:migrate -- --baseline NNNN  # one-time, verified high-water mark for a legacy database
npm run db:seed     # dev seed: role-stub users + demo published courses (never prod)
npm run db:seed:users  # 6 real login-able test users (password123) + Tutor↔Niño linked
npm run db:publish-course -- <slug>  # LOCAL DEV ONLY: flip a fixture course's full chain (course→adventures→sagas→topics→lessons) draft/review → published
npm run db:export-course -- <slug> [file]  # snapshot a course's rows (ids preserved) to a git-committable .sql fixture — no image/audio binaries, no LLM re-spend
npm run db:import-course -- <file>         # load a fixture into your local Vault (idempotent); fixtures retain their review/draft state unless deliberately made visible locally
npm run db:reset    # from-zero: nuke volumes → up → migrate
npm run db:down     # stop containers (data kept)
npm run db:nuke     # stop + delete volumes (data gone)
npm run db:status   # docker compose ps
npm run db:types    # regenerate types/database.ts (needs supabase CLI + running stack)
npm run db:railway:migrate -- --dry-run [--baseline NNNN]  # inspect production Vault only
npm run db:railway:migrate -- --confirm-production [--baseline NNNN]  # operator-approved production apply
```

Studio: http://localhost:8000 — dashboard credentials live in `supabase/docker/.env` (gitignored).

## Layout

- `SUPABASE_VERSION` — the pinned `supabase/supabase` release tag (upgrade protocol: [AGENTS.md](AGENTS.md))
- `supabase/` — the pinned upstream clone (gitignored; created by `db:sync`)
- `migrations/` — `0001_identity.sql` (locked identity domain), `0002_content_skeleton.sql` (PROVISIONAL), `0003_auth_bootstrap.sql` (signup trigger + role auditing + indexes), … through `0031_course_release_gate.sql` (atomic production course release), `0032_lesson_illustration_style.sql` (style-aware image inheritance provenance), and `0033_retire_unused_game_schema.sql` (forward cleanup of the never-shipped game tables/telemetry). What each one owns and its RLS posture: [AGENTS.md](AGENTS.md)
- `seeds/dev_seed.sql` — one user per role + a 2-parent/1-kid family (dev only)
- `seeds/first-lemonade-stand-fixture.sql` — non-shipping Forge/Engine QA corpus; intentionally draft/review, never a learner-facing production seed
- `types/` — generated TS types (shared-type hub)
- `scripts/` — `check-migrations.mjs` (the `npm test` gate), `sync-supabase.sh` (pin sync), `local-stack.sh` (local stack driver), `railway-migrate.sh` (confirmed production migration runner), `seed-dev-users.sh` (6 login-able test accounts), `publish-course.sh` (local fixture helper only), `export-course-fixture.sh` / `import-course-fixture.sh` (git-committable course snapshots)

## Migration ledger

`db:migrate` owns `public.schema_migrations`: an RLS-protected, zero-policy
ledger of migration filename, SHA-256 checksum and apply time. Each new file
and its receipt run in one transaction, so retrying after a failure is safe and
editing an applied file fails as migration drift. On a pre-ledger database the
command refuses to replay history. After an operator independently verifies the
last migration already applied, local development may run
`npm run db:migrate -- --baseline NNNN` exactly once, then the ordinary command
to apply only later files. Production uses `scripts/railway-migrate.sh`:
`--dry-run` inspects the remote ledger without writing, while
`--confirm-production` is required for mutation. A legacy production Vault must
receive an explicit, independently verified `--baseline NNNN`; the script
refuses the baseline unless a read-only signature-object probe of the live
schema matches it, then records the baseline and applies every later migration
in order, one transaction per file. The Railway CLI does not propagate the
remote exit status, so the runner verifies every batch from psql output (a
trailing success sentinel plus the absence of `ERROR:`) and hard-refuses
anything ambiguous. Never baseline by guesswork; production application
remains a human-approved operation under [DEPLOYMENT.md](DEPLOYMENT.md).
