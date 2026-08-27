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
   **First two lines are the phase header**, and `npm test` in `database/` rejects the file without one:
   ```sql
   -- @phase: expand
   ```
   or, when it removes or narrows anything an already-deployed service could still be using
   (`DROP COLUMN`/`TABLE`/`VIEW`, `SET NOT NULL`, a type change, a rename, a narrowed `CHECK`, a `DELETE`):
   ```sql
   -- @phase: contract
   -- @after-release: <sha or tag of the release that removed the last reader>
   ```
   The gate re-derives the classification from your SQL, so declaring `expand` on a file that
   contracts is a hard failure with the reason named. A `contract` migration MUST NOT be applied
   until its release is live: applied first, the column goes while an older deploy still names it
   and PostgREST rejects every write that does.
2. Idempotent DDL: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
3. **RLS in the same migration**: enable + policies for every new table. Kid-data tables: guardian read access per §1.3.
4. Constraints for invariants (role CHECKs, superadmin domain trigger, append-only audit policies) — DB-level, not app-level-only.
5. Seed data → `database/seeds/` if needed (dev only).
6. Verify: `npm run db:reset` twice in `database/` — both must succeed.
7. Regenerate types: `npm run db:types` — commit the updated `database/types/`.

## Acceptance
- [ ] Reset-twice passes; types regenerated and committed
- [ ] `npm test` in `database/` green — includes the phase gate and its self-test
- [ ] If `contract`: `@after-release` names a release that is ACTUALLY deployed before anyone dispatches the migration
- [ ] Every new table has RLS before merge
- [ ] `database/AGENTS.md` updated if invariants changed (stewardship §8)
