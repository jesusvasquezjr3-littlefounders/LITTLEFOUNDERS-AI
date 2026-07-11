---
template: new-migration
inputs:
  tables: "table(s) to create/alter"
  invariants_touched: "which of /AGENTS.md §1.3 apply (roles? guardian links? audit?)"
---

# Task: add a database migration

## Read first
- `/AGENTS.md` §1.3 (schema invariants) — BLOCKING: violations end the task
- `database/AGENTS.md` — migration protocol
- Latest file in `database/migrations/` — next `NNNN` number, style reference
- `agent/core/BOUNDARIES.md` — applying to prod requires human sign-off

## Steps
1. New file `database/migrations/NNNN_description.sql` (never edit an applied one).
2. Idempotent DDL: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
3. **RLS in the same migration**: enable + policies for every new table. Kid-data tables: guardian read access per §1.3.
4. Constraints for invariants (role CHECKs, superadmin domain trigger, append-only audit policies) — DB-level, not app-level-only.
5. Seed data → `database/seeds/` if needed (dev only).
6. Verify: `npm run db:reset` twice in `database/` — both must succeed.
7. Regenerate types: `npm run db:types` — commit the updated `database/types/`.

## Acceptance
- [ ] Reset-twice passes; types regenerated and committed
- [ ] Every new table has RLS before merge
- [ ] `database/AGENTS.md` updated if invariants changed (stewardship §8)
