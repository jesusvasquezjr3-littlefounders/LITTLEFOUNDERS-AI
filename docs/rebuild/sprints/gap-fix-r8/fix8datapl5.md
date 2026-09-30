# Gap-fix round 8: data-platform (fix8datapl5)

Branch `codex/spec-fix8datapl5`. Status: **implemented and locally verified; not accepted.**

## Gap 1: the warehouse retention prune and erasure re-apply had no watchdog

SPEC clauses: H.4; the Block H non-negotiables ("no job whose silent failure would have serious consequences for family data may lack the watchdog-plus-notification pattern"; H.3 "no job may be built to record without a real consumer"); Appendix O 1.2 (retention-window reconciliation) and 1.3 (watchdog coverage, simulated job-failure drill); H.2; E.6.

Verified real in code before the fix:

- `getLastRetentionRun()` in `dataintel/src/services/warehouseRetention.ts` had no caller;
- `dataintel/src/db/sync.ts` swallowed a failed prune and a failed `applyErasureTombstones()` as `-1`;
- a failed prune rolled back its own log rows, so a failure left no trace;
- the erasure re-apply logged nothing at all;
- `/health` said `ok` whatever happened;
- Core's `HEARTBEAT_JOBS` and `TRAIL_JOBS`, the watcher and the GOVERNANCE.md section 4 table did not include the warehouse.

Built:

- **dataintel**
  - `services/warehouseMaintenance.ts` (new) holds the log writers and readers.
  - `warehouse_maintenance_log` gains `ok` (default TRUE, so existing rows count as successes) and `error`, with the matching `ALTER ... ADD COLUMN IF NOT EXISTS` in the schema-evolution block.
  - Every `ran_at` is written explicitly in UTC.
  - `applyWarehouseRetention()` and `applyErasureTombstones()` write their success rows inside their own transaction. After a rollback they write one `ok = FALSE` row with the error (at most 200 characters; it names tables, never a learner). A failed prune's error is prefixed with the table it was pruning, because DuckDB's own message for a prepared statement sometimes arrives garbled without it (this made the failed-prune test flaky; found and fixed on resume).
  - The erasure re-apply logs as `erasure_reapply` (retain_days 30, the tombstone window).
  - `GET /api/v1/intel/maintenance/status` sits behind the internal-key guard. It returns, for each step, the last success (time and rows removed) and the last attempt (time, ok, error). An unreadable log is a 502, never "never ran".
  - `sync.ts` now logs both failures.
- **Core**
  - `services/warehouseMaintenance.ts` (new) reads that route the way `warehouseAlerts.ts` reads `/alerts/undelivered`. A read failure, or a reply missing either step, is `null`.
  - `services/opsJobs.ts` adds `WAREHOUSE_JOBS = ['warehouse_retention']` to `OPS_JOBS`, with `OPS_JOB_STALE_HOURS.warehouse_retention = 36`.
  - `judgeWarehouseRetention()` binds on the older step. The job is stale when either step has no success in 36 h, when either step's last attempt failed, or when the warehouse is unreadable.
  - An unreadable warehouse gives `unreadable: true`, and the other jobs' verdicts still come back (no 502).
  - The job flows into `getOpsJobStatus`, `anyStale`, `/internal/ops/job-status` and `/admin/ops/job-status`.
- **Watcher** (`agent/tools/ops-job-watch.mjs`): `warehouse_retention` is added to `WATCHED_JOBS`. A job with `unreadable: true` is refused as an error. The notice names each failing step and its error, plus the consequence line.
- **Drill** (`backend/src/scripts/opsJobDrill.ts`): simulates the warehouse prune failing outside its window. The job is covered by the per-job `it.each(OPS_JOBS)`.
- **Console**:
  - `programmeApi.ts` `OPS_JOB_NAMES` includes the job, and the `unreadable` flag is validated;
  - the `OpsJobsCard` shows an "unreadable" notice instead of "has not run in N hours";
  - new copy: `job_warehouse_retention` and `jobUnread` in EN, es-MX and pt-BR;
  - the fixtures are updated.
- **Docs**: GOVERNANCE.md section 3 (a failed run is logged, and the log has a consumer) and section 4 (a table row and the judging rule; eleven watched jobs after the merge with fix8staffo3's `badge_link_retirement`).

Decision (conservative default, not an owner question): the window stays at 36 h, the one logged H.4 calibration value (`STAFF-OPS-RECALIBRATION-LOG.md`, pinned by `staff-ops-review-cadence.mjs`). A failed attempt is stale at once instead of waiting for a shorter window.

## Gap 2: the OD-9 cutover freeze list was nine workflows short

SPEC clauses: OD-9 section 4.5; S10.2a and S10.2e (freeze every scheduled job); H.4.

Verified real: 28 workflows carry `schedule:`. The runbook named 18 plus the `tutor-retention-watch` exception. These nine were missing:

- `learning-retention`
- `ops-job-watch`
- `mentor-equity-audit`
- `mentor-thresholds-quarterly`
- `block-b-reviews-quarterly`
- `block-d-reviews-quarterly`
- `block-e-reviews-quarterly`
- `identity-recalibration-quarterly`
- `staff-ops-recalibration-quarterly`

Built:

- **CUTOVER-RUNBOOK.md step 1** now freezes 27 workflows plus `database-cd.yml` (26 at first; the merge brought fix8family2's `family-integrity-watch`, which the new test caught on its first post-merge run). It leaves the two watchdogs enabled: `tutor-retention-watch` and `ops-job-watch`.
  - The posture of `ops-job-watch` is stated: it reads only, and it names a paused job only after 36 h without a success. So a short window stays quiet, while a long window, or a job left disabled after the switch, gets reported.
  - The operator logs any such comment and closes the issue after the first green watch.
- **Step 9 item 4** re-enables every step 1 workflow in order (the sweeps with family deadlines first, then the backups and the drift probe, then the rest, then `database-cd.yml`), and confirms with `gh workflow list --all`.
- **`database/migration-od9/cutover-freeze.test.mjs`** (new, in `npm --prefix database test`) parses the backticked disable list and the "Leave ... enabled." sentence of step 1. It fails when:
  - that set differs from the `.github/workflows/*.yml` files with a `schedule:` trigger key;
  - a name is both frozen and left enabled;
  - the watchdogs are not exactly the two above;
  - step 9 names a workflow that step 1 did not freeze.
  - A negative case proves that the parser catches a dropped workflow.

## Verification (local, lean per speed mode)

- dataintel: type-check and lint clean. Full vitest run: 21 files and 252 tests, all green after one comment fix. `staff-exclusion.test.ts` refused the name of a `*_raw` table in a comment, which is reworded. New test file: `warehouse-maintenance-watch.test.ts` (6 tests on a real in-memory DuckDB; failures are real, caused by renaming a table away).
- Core: type-check and lint clean. `staffOps.test.ts` (32) and `opsJobDrill.test.ts` (17) are green. New cases:
  - a fresh job is not stale;
  - a failed prune is stale with a success inside the window;
  - a job past 36 h, or one that never ran, is stale;
  - unreadable replies (502, a missing step, a malformed time) give `unreadable` and stale with a 200 answer;
  - the verdict binds on the older step;
  - the drill names the failing step.
- Watcher: `node --test agent/tools/ops-job-watch.test.mjs`, 17 tests pass (21 with the freeze test), including the failed-prune notice and an unreadable job refused.
- Frontend: type-check and lint clean. `StaffProgramme.test.tsx`: 23 tests pass, including the new unreadable-job case.
- Database: `cutover-freeze.test.mjs`, 4 tests pass (run directly with `node --test`), and `check-migrations.mjs` passes (254 files). The full `npm --prefix database test` was skipped on the orchestrator's instruction (no migration changed; its Railway harness takes over 90 minutes on this host).
- Root: `spec:check`, `secrets:check` and `check-i18n.sh` pass.

No migrations: the warehouse is DuckDB (schema.sql with its evolution block). No browser run, per speed mode.

## Merge with codex/spec-migration-s02

Conflicts with fix8staffo3 (which added `badge_link_retirement` as a watched job in the same places) and fix8design7 (REQUIREMENTS H.1) were resolved as unions: both jobs are in `OPS_JOB_STALE_HOURS`, `WATCHED_JOBS`, the drill tests, `OPS_JOB_NAMES`, the console fixtures and the locale files (merged with `json3way.py`). GOVERNANCE.md section 4 now counts eleven watched jobs, and the H.4 requirement row carries both lanes' sentences and links.

## Open

- Owner question: `family-integrity-watch` only reads, but it is frozen during the cutover window and re-enabled 24 hours after the freeze is lifted. Otherwise the migration's own non-`service_role` writes would open a false Block D Stage 7 revert candidate. Conservative default implemented. The alternative is to leave it enabled and record the migration's rows on its issue.

- Production: the first `ops-job-watch` run that reads the deployed dataintel, and a drill against the deployed Core (ops owner, as for the other H.4 jobs).
- Deploy order when this ships: dataintel before Core. A Core that reaches an older dataintel without the route reads it as unreadable, so the watch fails loudly until dataintel is deployed. That fails closed and is intended.
