# Gap-fix round 6: staff-ops (fix6staffo5)

Branch `codex/spec-fix6staffo5`. Status: **implemented and locally verified; not accepted.**

## Gap

H.4, the Block H non-negotiable ("No job whose silent failure would have serious consequences for family data may lack the watchdog-plus-notification pattern") and Appendix O 1.3 / 2.3: before this lane the watchdog covered four jobs (the Vault and Pulse backups, the drift probe and the Mentor retention sweep). Five scheduled jobs that keep promises to families had no staleness check and notified no one:

- `account-deletion.yml` (E.6 erasure; A.1's promise that a paused child is deleted after 90 days);
- `family-retention.yml` (D.21);
- `social-retention.yml` (E.11);
- `learning-retention.yml` (400-day practice days);
- `insights-maintenance.yml` (`prune_learning_events(400)`, H.2's raw-event window).

Verified in code before fixing: `OPS_JOBS` in `backend/src/services/opsJobs.ts`, `WATCHED_JOBS` in `agent/tools/ops-job-watch.mjs` and `DRILL_TARGETS` in `backend/src/scripts/opsJobDrill.ts` named only the four jobs, and none of the five workflows recorded a heartbeat.

## Built

- `backend/src/services/opsJobs.ts`: `HEARTBEAT_JOBS` (the backups, the drift probe, `learning_retention` and `insights_prune`) and `TRAIL_JOBS` (`account_deletions`, `family_retention`, `social_retention`). `OPS_JOBS` is both lists, each with a 36-hour window in `OPS_JOB_STALE_HOURS`. The trail jobs are read from their existing records and never re-written:
  - `account_deletions.sweep_ran`: a run with `suspensionsUnreadable` counts as a failed attempt, not a success;
  - `family_retention_runs.ran_at`;
  - `social_retention.sweep_ran`.
- The heartbeat route accepts only `HEARTBEAT_JOBS`, so a trail job's record cannot be faked through it.
- New notify condition `accountDeletionFailures.stuck`: erasures still `processing` that have an `account.deletion_step_failed` row older than 24 hours (`DELETION_STEP_FAILURE_HOURS`). A completed request leaves `processing`, so a counted request has had no success since the failure. An unreadable list is a 502, never a zero.
- `GET /internal/ops/job-status` and `GET /admin/ops/job-status` return all of the above.
- `agent/tools/ops-job-watch.mjs` watches nine jobs plus the stalled-erasure count. A reply without the count is refused. The notice names each stale job and each stalled erasure, and says what a missed family-data job means.
- `scripts/ops-heartbeat.sh` accepts the two new heartbeat jobs. `learning-retention.yml` and `insights-maintenance.yml` now check out the repo and record a success heartbeat, or a failed-run heartbeat, as their last step.
- `.github/workflows/ops-job-watch.yml` header and job name updated.
- Drill: `DRILL_TARGETS` covers every `OPS_JOBS` entry plus `account_deletion_failures`, and simulates each job's own trail, including the family run table.
- Staff console, Reports > Support (`frontend/src/rebuild/staff/console/StaffProgramme.tsx` `OpsJobsCard`):
  - lists the five new jobs by name;
  - shows a stalled-erasure error notice, with copy in EN, es-MX and pt-BR;
  - treats a reply without the count as an error state.
- `docs/operations/GOVERNANCE.md` section 4 now lists the nine jobs in a table, with each job's workflow, time and trail.

## Verified (local)

- backend: `npm run type-check`, `npm run lint`, and vitest `staffOps.test.ts` plus `opsJobDrill.test.ts` (38 tests). New cases:
  - the new heartbeats are accepted and a trail job's heartbeat is refused;
  - each trail job is judged from its own record, including a failed deletion-sweep attempt;
  - an unreadable family run table is a 502;
  - stalled-erasure counting: a failure older than 24 h counts, a fresh failure does not, a completed request does not, and an unreadable list is a 502;
  - the drill covers every job and the stalled erasure.
- agent tools: `node --test agent/tools/ops-job-watch.test.mjs` (12 tests). New cases check that each family-data job going quiet fails the watch and is named, that a missing job is refused, and that a stalled erasure fails the watch while a malformed count is refused.
- frontend: `npm run type-check`, `npm run lint`, and vitest `StaffProgramme.test.tsx`, `StaffConsole.test.tsx` and `copy-budget/staff.test.ts` (Copy Budget in all three locales). The copy-budget test fills the new `{hours}` placeholder.
- Root: `spec:check`, `secrets:check` and the i18n gate (see the final lane report).

## Open

- The first scheduled runs of the new heartbeat steps and of the widened watch, plus a drill against the deployed Core. These need production, so they belong to the ops owner (OD-23 zero spend: none were run here).
- No owner question: the SPEC's own default (36-hour daily window, 24-hour stalled-erasure threshold per the gap's fix) was implemented.
