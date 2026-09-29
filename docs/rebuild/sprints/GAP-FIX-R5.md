# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-data-platform

Branch `codex/spec-fix5dataplat`. One audited gap: OD-9 section 4.1 (coins
must not be lost) and section 4.5 (row counts and per-family spot checks on
balances before and after), S10.1a.

The gap was checked in the code first and is real. The legacy schema keeps
coins a child is owed outside `wallet_ledger` until the child splits them:
`public.pending_credits` (0081, allowance payouts with `allocated = false`)
and approved tasks with `tasks.allocated = false` (0075). The rebuild still
uses both (0093, 0159 and 0163 write them; Core's `getPendingCreditsForKid`
and the rebuilt `ChildCoins` split flow read them). Before this checkpoint
`od9.inventory_categories()` hashed coins only from `wallet_ledger`, the
`chore_history` hash left out `allocated`, the spot check reported only the
ledger's coins per pocket, and the synthetic fixture never created an
unsplit payout or an unsplit chore reward. A cutover defect that dropped or
double-allocated owed coins would have passed `compare` and the section 4.5
sign-off sheet with zero failures.

### What was built

- `database/migration-od9/sql/10_inventory.sql`: two new categories.
  `pending_coins` hashes every `pending_credits` row per child (id, amount,
  source, allocated, created_at, ordered by id), split or not, so a lost row
  and a flipped `allocated` both fail. `owed_task_rewards` hashes the
  approved, unsplit chores with a reward above zero (a zero-coin
  contribution, 0158, is never split). `chore_history` now also hashes
  `allocated`. The inventory captures 18 categories (was 16).
- `database/migration-od9/sql/50_spot_check.sql`: a readable
  `owed coins (unsplit)` item per sampled account, the sum of unallocated
  `pending_credits.amount` plus unallocated approved `reward_coins`, shown
  only when above zero.
- `database/migration-od9/fixtures/generate-legacy-fixture.mjs`: every kid
  with a Family Hub record may get unsplit allowance payouts, an already
  split payout (with its ledger row) and an approved, unsplit chore reward.
  `kid_a_one` always holds one unsplit payout and `kid_c` two, so the
  negative control has a target. New independent expectations: `owed`
  (coins per child), `pendingCredits`, `owedTasks`.
- `prove-od9-postgres.mjs`: the before inventory must count exactly the
  fixture's payouts and unsplit chore rewards; a spot check over every
  family on the legacy schema must read every child's owed coins exactly as
  the fixture computed them, and again after the whole chain, the toolkit
  and the catalog retirement. Negative control: deleting one of `kid_c`'s
  unsplit payouts fails `compare` at exactly `account:pending_coins:<kid_c>`
  and that family, and the spot check at exactly that child's owed coins.
- `rehearse-cutover.mjs`: R2 checks the same two counts; R12 adds the same
  negative control on the restored database for a child drawn from the
  section 4.5 sample (the streak control is reverted first so each control
  fails at exactly one place).
- `od9.test.mjs`: the new categories, the `allocated` column in
  `chore_history` and the spot item are pinned; the fixture's owed-coin
  expectation is recomputed from the SQL it writes.
- Docs: `database/migration-od9/README.md` (18 categories, owed coins),
  `docs/operations/CUTOVER-RUNBOOK.md` and `S10-CUTOVER.md` (spot-check
  contents), `docs/rebuild/REQUIREMENTS.md` (OD-9 note in the preamble; OD-9
  has no requirement row of its own).

No migration: the toolkit is installed by `od9 install`, not by the chain.

### Verification (local)

- `node --test migration-od9/od9.test.mjs`: 17 pass (2 new).
- `npm run od9:prove` on the lane's native PostgreSQL 17.6 (port 15770,
  data directory under `.lane-cache/pg`): 17 checks pass over the 240-file
  chain (82 legacy migrations, 158 applied over the legacy data). 20 payouts
  and 11 unsplit chore rewards counted; 18 children owe 192 coins, read
  identically before and after; 24/24 families identical, 331/331 spot
  values identical; the deleted 12-coin payout failed exactly at `kid_c`
  (21 before, 9 after) and its family.
- `npm run od9:rehearse` at the default 12 random families, at 0 and at 200
  (212 families): every phase passes, including both R12 negative controls.
- `database` checks and node tests (`check-migrations`,
  `check-migration-phase`, `check-family-lifecycle`, 72 node tests) pass;
  the untouched `railway-migrate.test.mjs` fake-transport harness was
  stopped after 30 minutes under the other lanes' load and left to the
  merge gates. Root `npm run spec:check` and `npm run secrets:check` pass.

### Remaining

- The production cutover run and the person's section 4.5 signature are
  owner steps (unchanged).
- The toolkit counts owed coins; it does not reconcile a payout against the
  allowance rule that produced it (`source_ref` is informational in 0081 and
  is not hashed).

### Owner questions

None.
