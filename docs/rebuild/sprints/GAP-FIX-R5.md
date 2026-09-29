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

None (see the lane finish below).

## Checkpoint F5-data-platform-finish

Lane finish: sync with `codex/spec-migration-s02` (already up to date, no
conflict), an adversarial pass over the lane against OD-9 section 4.1 and
4.5, and the full `database` suite.

### Adversarial pass: what was still missing

Section 4.1 reads "nothing is lost that a family was promised", and the
lane's first checkpoint covered coins earned but not split. Coins a Tutor
promised for later were still invisible: `public.allowance_rules` (the
recurring allowance: amount, cadence, on/off, next payout) and
`public.savings_bonus_rules` (0081). A cutover that dropped or changed a
child's allowance would have passed `compare` and the sign-off sheet.

- `sql/10_inventory.sql`: `allowance_promise` hashes every allowance rule
  per child (id, Tutor, amount, frequency, anchor day, active, next run,
  created). `savings_bonus_promise` hashes the Tutor, the agreed rate, the
  next run and the creation time. 0159 deliberately moves an under-13
  child's percentage bonus to the fixed per-ten ratio (switching off a rate
  below it) and keeps the agreed rate in `reframed_from_rate_bp`; the
  category reads that rate through `to_jsonb` (so it also runs on the
  legacy schema, where the column does not exist) and leaves `active` out,
  because that reframe changes it on purpose. 20 categories.
- `sql/50_spot_check.sql`: `allowance promised` (for example `12 weekly`,
  `(paused)` when off) and `savings bonus promised (basis points)`.
- Fixture: allowance rules for about half the Family Hub children (always
  `kid_c`) and bonus rules for about a third (always `kid_a_one`, aged 8,
  at 500 bp, which 0159 reframes). New expectations `allowance` and `bonus`.
- `prove-od9-postgres.mjs`: counts and spot values before and after the
  full chain; asserts 0159 really reframed `kid_a_one` (500 to 1000) while
  the inventory and the sheet still read 500; negative control: lowering
  `kid_c`'s allowance by one coin fails `compare` at exactly
  `account:allowance_promise:<kid_c>` and that family, and the spot check
  at exactly that child's allowance.
- `rehearse-cutover.mjs` R2 checks both counts. `od9.test.mjs`: two new
  tests pin the categories, the spot items and the fixture's expectations.

Not added: `spend_limits` (a control on spending, not coins owed or
promised) and `banking_accounts` (card nickname and design); both are
still covered by the chain's own tests, not by the OD-9 inventory.

### Verification (local)

- `node --test migration-od9/od9.test.mjs`: 19 pass (2 new); the database
  checks and node tests of `npm test` (74) pass. The
  `railway-migrate.test.mjs` fake-transport harness (untouched) is left to
  the merge gates.
- `npm run od9:prove` on the lane's native PostgreSQL 17.6 (port 15970):
  19 checks pass over the full chain (82 legacy migrations, then 158). The
  before inventory holds 20 categories; 20 `pending_credits` rows, 11
  unsplit chore rewards (18 children owe 192 coins), 10 allowance rules and
  5 savings bonus rules, all read the same after the chain; 24/24 families
  identical, 346/346 spot values identical; `kid_a_one`'s 500 bp bonus is
  reframed by 0159 to 1000 and still reads 500. Negative controls: a
  deleted 12-coin payout fails at exactly `kid_c`'s `pending_coins`, its
  family and its owed coins (21 to 9); a one-coin lower allowance fails at
  exactly `kid_c`'s `allowance_promise`, its family and its allowance
  (35 monthly to 34 monthly).
- `npm run od9:rehearse` (default 12 random families): R0 to R12 pass
  (13 checks, 66 s; R2 22 categories and identifier sets, R8 24/24
  families and 116/116 spot values, R12 restore 24/24).
- Root `npm run spec:check` and `npm run secrets:check`: pass.

### Lane summary

- One audited gap (OD-9 section 4.1 and 4.5, S10.1a): coins owed but not
  split and coins promised for later are now inventoried, hashed per child
  and family, shown on the section 4.5 sign-off sheet, held by the
  synthetic fixture and proven on native PostgreSQL with a negative control
  per kind. No migration (the toolkit is installed by `od9 install`), no UI,
  no copy.
- Status: implemented and locally verified; not accepted, not released.

### Remaining

- The production cutover run and the person's section 4.5 signature are
  owner steps.
- The toolkit does not reconcile a payout against the rule that produced it
  (`pending_credits.source_ref` is informational in 0081 and not hashed).
- A savings bonus switched off by something other than 0159 is not
  detected (`active` is not hashed; see above).

### Owner questions

None.
