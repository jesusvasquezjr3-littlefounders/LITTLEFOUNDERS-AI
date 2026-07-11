# database (Vault)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Schema, migrations, RLS, seeds, generated shared types.
**Deploy:** Supabase self-hosted on Railway ([DEPLOYMENT.md](DEPLOYMENT.md)).

```bash
npm test            # migration gates: numbering, RLS coverage, append-only audit
npm run db:start    # local Supabase stack (requires supabase CLI)
npm run db:reset    # apply all migrations from zero
npm run db:types    # regenerate types/database.ts
```

## Layout

- `migrations/` — `0001_identity.sql` (locked identity domain), `0002_content_skeleton.sql` (PROVISIONAL)
- `seeds/dev_seed.sql` — one user per role + a 2-parent/1-kid family (dev only)
- `types/` — generated TS types (shared-type hub; placeholder until local stack runs)
- `scripts/check-migrations.mjs` — the `npm test` gate
