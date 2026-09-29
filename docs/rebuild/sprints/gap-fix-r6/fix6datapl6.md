# Gap-fix round 6: data-platform lane (fix6datapl6)

Branch `codex/spec-fix6datapl6`. Two audited gaps, both confirmed in the code
before fixing. Status of both: implemented and locally verified; not accepted.

## Gap 1: the warehouse kept raw usage events forever (H.2)

SPEC: H.2 (a written retention policy for the domain); Block H Standard
component 1 (no two retention windows for overlapping data without a written
rationale); Appendix O 1.2 Retention-Window Reconciliation Documentation;
`docs/operations/GOVERNANCE.md` section 3.

Confirmed: `dataintel/src/db/sync.ts` copied `learning_events` into
`fact_events_raw` incrementally, and nothing pruned it (the only deletes were
account erasure). `experiment_assignments` and `experiment_exposures` were never
pruned and were not in the erasure table list.

Built:

- `dataintel/src/services/warehouseRetention.ts`: `RAW_EVENT_RETENTION_DAYS = 400`
  (one exported constant) and `applyWarehouseRetention()`, which deletes
  `fact_events_raw` (by `created_at`), `experiment_assignments` (`assigned_at`)
  and `experiment_exposures` (`exposed_at`) rows older than the window, in one
  transaction, and writes one `warehouse_maintenance_log` row per table and run
  (rows removed, even zero). `getLastRetentionRun()` reads the latest run.
- `syncAll()` (`dataintel/src/db/sync.ts`) runs it after every sync and the
  erasure tombstone pass, so a batch that brings an already-expired row cannot
  keep it; the result appears as `retention_pruned` in the sync log.
- `dataintel/src/db/schema.sql`: the two experiment tables (same definitions as
  `services/experiments.ts`) and `warehouse_maintenance_log` exist from the first
  boot, so retention and erasure never hit a missing table.
- `dataintel/src/services/erasure.ts`: both experiment tables are in the erasure
  list (matched on the lowercase text id, since they store the id as TEXT),
  including the tombstone re-apply.
- `docs/operations/GOVERNANCE.md` section 3 names the warehouse copy and its
  400-day bound next to the 90-day sessions window.
- Aggregates (`agg_daily_*`) hold counts only and are kept, as the fix allowed.

Verified: `dataintel/src/__tests__/warehouse-retention.test.ts` (a sync cycle
with a stubbed Vault removes a 401-day-old event, assignment and exposure and
keeps 399-day-old ones; each run is logged per table; the Vault workflow's
`prune_learning_events(N)` equals the constant; GOVERNANCE section 3 names the
copy); `account-erasure.test.ts` extended to both experiment tables;
`staff-exclusion.test.ts` allow-list gained the retention writer. Full dataintel
suite (19 files, 230 tests), type-check and lint green.

## Gap 2: three autonomy events bypassed the OD-9 gate (OD-9 4.2)

SPEC: OD-9 section 4.2; S10.3a; data_practices row
`analytics.motivation_events`; B.24.

Confirmed: 0246 added `approach_choice`, `enrichment_offer` and
`enrichment_open` and its header called them consent-gated, but
`enforce_learning_event_practice()` (last replaced in 0218) had no mapping, so
they were inserted for a migrated child on the legacy consent alone.

Built:

- Migration `*_autonomy_events_practice_gate.sql` (`@phase: expand`): replaces
  the function with 0218's body plus the three events under
  `analytics.motivation_events`, corrects the 0246 header claim in its comment,
  and updates the registry summary to name every event class it covers.
- `database/scripts/check-learning-event-practices.mjs` (+ `.test.mjs`), wired
  into `database` `npm test`: fails when a learning_events CHECK value added
  since the pre-rebuild CHECK (before 0131) has no practice in the latest
  function (adult-only `parent_signup_completed` and `parent_first_value` are
  exempt with reasons), when the function maps an undeclared event, or maps to
  an unregistered practice. It fails on the tree without the new migration
  (three FAIL lines) and passes with it.
- `database/scripts/verify-learning-r5-postgres.py`: a migrated child with a
  verified Tutor and the legacy H.1 consent has the three events (and
  path_choice) skipped; they land once the Tutor's motivation consent exists and
  stop again on revocation; a non-migrated child is unaffected.
- Family Hub consent label (`dataPractices.json`, three locales) names the
  choices: "Streaks, rest days and learning choices" / "Rachas, días de descanso
  y elecciones de estudio" / "Sequências, dias de descanso e escolhas de estudo";
  pinned in `DataPractices.test.tsx`; Copy Budget and glossary tests green.

Verified: `verify-learning-r5-postgres.py` on native PostgreSQL 17.6 (all 247
migrations, 9 checks) passes, and fails at the new check with the migration
removed; `check-migrations`, `check-migration-phase` and the new gate pass;
`DataPractices.test.tsx` 15/15; i18n gate.

## Owner questions (conservative default applied)

- The motivation practice's disclosure version was NOT bumped. No Tutor has yet
  answered this practice under the old label in any released build (the rebuilt
  Family Hub and the OD-9 consent step are unreleased), so there is no consent
  to invalidate. If any consent is recorded under the old label before this
  ships, bump `data_practices.disclosure_version` for
  `analytics.motivation_events` so it is asked again.
- Experiment rows are pruned by age (400 days after assignment/exposure), not by
  "concluded plus a period"; an experiment running past 400 days would lose its
  oldest exposures from its results.

## Open

- The Core ops watchdog (`backend/src/services/opsJobs.ts`, ops-job-watch) does
  not yet read `warehouse_maintenance_log`; the record exists for it.
- Acceptance (ops owner review of the reconciled windows; privacy review of the
  label) and release are pending.
