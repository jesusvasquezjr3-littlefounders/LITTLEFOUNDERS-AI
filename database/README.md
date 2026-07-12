# database (Vault)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Schema, migrations, RLS, seeds, generated shared types.
**Stack source:** clone of `supabase/supabase` pinned to the latest approved release in [SUPABASE_VERSION](SUPABASE_VERSION) — same stack locally and in production ([DEPLOYMENT.md](DEPLOYMENT.md)).

```bash
npm test            # migration gates: numbering, RLS coverage, append-only audit
npm run db:sync     # materialize/update the pinned supabase/supabase clone
npm run db:up       # start the local stack (first run generates .env secrets)
npm run db:migrate  # apply migrations/*.sql in order (idempotent)
npm run db:seed     # dev seed (never prod)
npm run db:reset    # from-zero: nuke volumes → up → migrate
npm run db:down     # stop containers (data kept)
npm run db:nuke     # stop + delete volumes (data gone)
npm run db:status   # docker compose ps
npm run db:types    # regenerate types/database.ts (needs supabase CLI + running stack)
```

Studio: http://localhost:8000 — dashboard credentials live in `supabase/docker/.env` (gitignored).

## Layout

- `SUPABASE_VERSION` — the pinned `supabase/supabase` release tag (upgrade protocol: [AGENTS.md](AGENTS.md))
- `supabase/` — the pinned upstream clone (gitignored; created by `db:sync`)
- `migrations/` — `0001_identity.sql` (locked identity domain), `0002_content_skeleton.sql` (PROVISIONAL), `0003_auth_bootstrap.sql` (signup trigger + role auditing + indexes)
- `seeds/dev_seed.sql` — one user per role + a 2-parent/1-kid family (dev only)
- `types/` — generated TS types (shared-type hub)
- `scripts/` — `check-migrations.mjs` (the `npm test` gate), `sync-supabase.sh` (pin sync), `local-stack.sh` (stack driver)
