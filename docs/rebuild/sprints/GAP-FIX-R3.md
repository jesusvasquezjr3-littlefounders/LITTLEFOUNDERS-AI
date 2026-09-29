# GAP-FIX-R3: gap-fix round 3

Lane records for the third round of audited SPEC gaps. Each lane appends its
own section. Statuses follow the rebuild rule: implemented and locally
verified is not accepted, and nothing here is released.

## F3-staff-ops

Branch `codex/spec-fix3staffops`. Three audited gaps in operations
notification and staff access governance. Each was checked in the code
first, and all three were real.

### Gaps confirmed in code

| # | SPEC clause | Evidence before this checkpoint |
|---|---|---|
| 1 | H.4; Appendix O 1.3 (Watchdog-Plus-Notification Coverage, Simulated Job-Failure Drill), 2.3(b) | `tutor-retention-watch.yml` had only `permissions: contents: read` and on a stale sweep ran `echo ::error::` then `exit 1`: it opened and commented on no issue. `ops-job-watch.mjs` `WATCHED_JOBS` and `opsJobs.ts` `OPS_JOBS` listed only `vault_backup`, `pulse_backup` and `vault_drift`. `opsJobDrill.ts` `DrillTarget` had no retention target. The retention sweep was the only one of Appendix O's three named jobs whose failure reached nobody. |
| 2 | G.2; Appendix N 1.2, 2.3(b) | No workflow referenced `content:retro-checks` (a grep for `retro` under `.github/workflows` returned nothing). The retroactive check ran only when someone started it by hand. GAP-FIX-R2 F2-staff-ops decision 6 had left the scheduling to the owner. |
| 3 | G.4 (quarterly, calendar-triggered, owned by the staff/access owner); Appendix N 1.1 | `staff_access_review_status` (migration `0195`) computed `due`, and only the Roles & Access card read it (`adminData.ts`). No schedule, job-status field, watchdog issue or email existed for it (a search for access_review, access-review and accessReview under `.github`, `agent/tools`, `opsJobs.ts` and `backend/src/scripts` found only `adminData.ts`). |

### What was built

| # | What | Where |
|---|---|---|
| 1 | Core's operations job status (`GET /api/v1/internal/ops/job-status`, and the staff `GET /admin/ops/job-status`) carries `tutorRetention`, the Mentor retention sweep in the watched-job shape (`job: 'tutor_retention'`, `stale`, `staleAfterHours`, last run and detail). It is built from `getTutorRetentionStatus()`, so the 36-hour window keeps its one home (`RETENTION_STALE_HOURS`, now exported from `tutorData.ts`, not copied). `anyStale` covers it. A failed read is a 502. It sits beside `jobs`, not inside it, because the staff console already shows the sweep on its own card, and the frontend's `jobs` check stays unchanged. `ops-job-watch.mjs` watches four jobs (`tutor_retention` added to `WATCHED_JOBS`). A reply without the sweep, or with it under another name, is refused. A stale sweep fails the watch and is named in the notice that `ops-job-watch.yml` posts to the `ops-watchdog` issue. The drill has a `tutor_retention` target: a simulated stale `tutor.retention.swept` trail makes the real watcher exit 1 and write the notice. `tutor-retention-watch.yml` keeps failing its own run early, and its header now points to the notification path. | `backend/src/services/opsJobs.ts`, `tutorData.ts`; `backend/src/scripts/opsJobDrill.ts`, `ops-job-drill.ts`; `agent/tools/ops-job-watch.mjs`; `.github/workflows/ops-job-watch.yml`, `tutor-retention-watch.yml` |
| 2 | `.github/workflows/content-retro-checks.yml` runs every Monday at 05:00 UTC, and on `workflow_dispatch`. It runs `npm --prefix coursegen run content:retro-checks` against Vault. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from the Core service's Railway variables through `RAILWAY_TOKEN`, the pattern `tutor-content-bridge.yml` and `mentor-live-content-monitor.yml` use; no new repository secret. The key is masked, and an empty credential fails the run. A failed verification, an open check with no course or an unreadable Vault fails the run (pipefail) and comments on or opens the `ops-watchdog` issue with the last 60 lines of output. `agent/tools/content-retro-checks-workflow.test.mjs` pins the schedule (daily or weekly), the command, the script target, the credential source, the failure path and the notification, and shows the lint red on each weakened copy. | `.github/workflows/content-retro-checks.yml`; `agent/tools/content-retro-checks-workflow.test.mjs` |
| 3 | The job status carries `accessReviews: { due, windowDays: 90 }` from `staff_access_review_status(90)` (new `getAccessReviewDueCount` in `adminData.ts`, parsed with the same schema as the Roles & Access read; a failed or malformed read is a 502). `ops-job-watch.mjs` fails when `due > 0` and names it in the notice ("elevated staff grant(s) past the 90-day access review (G.4) ... Roles & Access"). It refuses a reply without the number, or with a negative, fractional or non-numeric one. The drill has an `access_reviews` target. | `backend/src/services/adminData.ts`, `opsJobs.ts`; `agent/tools/ops-job-watch.mjs`; `backend/src/scripts/opsJobDrill.ts` |

Documentation:

- `docs/operations/GOVERNANCE.md`: section 2 has a "Review trigger" bullet, and section 4 lists four watched jobs, the scheduled retroactive check and the extended drill.
- `docs/content/FORGE-V2-RELEASE.md`: the cadence of the scheduled run.
- `README.md`: the scheduled-jobs table (with `content-retro-checks.yml` and `ops-job-watch.yml`) and the command rows.
- `docs/operations/CUTOVER-RUNBOOK.md`: `content-retro-checks` is added to the workflows paused during the window.

### Verification (local)

- Core, focused vitest: `staffOps.test.ts` (18, with 3 new cases): the retention sweep is carried stale, fresh and never-run, and the `jobs` list is unchanged; the access-review count is passed with `p_cadence_days: 90`, and a 500 or malformed reply is a 502; the internal status refuses a missing or wrong key. Also `opsJobDrill.test.ts` (8: six drill targets, with the retention and access-review drills new), `tutorData.test.ts` (64) and `admin.test.ts` (94). `npm run type-check` and `npm run lint` are clean.
- `npm --prefix backend run ops:drill`: PASS for vault_backup, pulse_backup, vault_drift, tutor_retention, content_retro_checks and access_reviews (each stale, watcher exit 1, notice written).
- Root: `node --test agent/tools/ops-job-watch.test.mjs` (9, with 4 new cases) and `agent/tools/content-retro-checks-workflow.test.mjs` (5) pass, as do `npm run spec:check` and `npm run secrets:check`.
- Not run here (orchestrator, per merge): full suites and `tools:test` as a whole. No UI changed and no copy changed, so the i18n gate is not affected. No migration.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **The retention sweep is a separate `tutorRetention` field, not a fourth entry in `jobs`.** The staff console already shows the sweep on its own card. Putting it in `jobs` would duplicate it there and change the frontend's strict `jobs` check. The watcher treats it as its fourth watched job either way.
2. **Retroactive-check cadence: weekly (Monday 05:00 UTC).** Every bypass is verified within 7 days, and at least three more runs fit inside the 30-day window. A daily run would comment on the watchdog issue every day about one failing course. The ops watchdog still alerts daily once a check passes 30 days.
3. **Access-review trigger: both the daily watchdog and a calendar-quarter issue.** Each grant is due on its own rolling 90 days, the same verdict the Roles & Access card shows, so a due grant is reported the day it falls due and every day until it is kept or revoked. The SPEC's proposal is "quarterly, calendar-triggered", so the finish checkpoint added the calendar trigger as well (see F3-staff-ops-finish). The rolling per-grant check stays; the owner may drop one of the two.
4. **The notification channel is the `ops-watchdog` GitHub issue**, the H.4 channel already built. For the notice to reach the staff/access owner and the ops owner, they must watch the repository or that issue label (owner step).

### Migrations

None.

### F3-staff-ops-finish

Sync: `git merge codex/spec-migration-s02` was already up to date.

Adversarial pass against the three gaps. H.4 (retention sweep notification) and G.2 (scheduled retroactive checks) held: the server builds the status, the watcher refuses any reply without the fields, and the drill proves each. G.4 was half-built. The SPEC mandates a cadence "quarterly, calendar-triggered, owned by the staff/access owner" (10-PRODUCT-GOLD-STANDARD-REQUIREMENTS G.4), and only the rolling per-grant watchdog existed. It was built now:

| What | Where |
|---|---|
| The job status's `accessReviews` also carries `total`, the elevated grants held, from the same `staff_access_review_status` read (`getAccessReviewDueCount` became `getAccessReviewCounts`, returning `{ due, total }`, or null on a failed or malformed read, which is a 502). | `backend/src/services/adminData.ts`, `opsJobs.ts`; `staffOps.test.ts` |
| `access-review-quarterly.yml` runs at 09:00 UTC on 1 January, April, July and October (and on `workflow_dispatch`). It asks Core for the status over the same Railway SSH route as `ops-job-watch.yml`, and opens the quarter's issue, "Quarterly access review: YYYY-Qn", labelled `access-review`, or comments on it if it is already open. The issue carries the held and due counts and the review steps (every grant against actual usage on Roles & Access, keep or revoke each, then close). It opens even when nothing is due. An unreadable status still opens the issue and turns the run red. | `.github/workflows/access-review-quarterly.yml`; `agent/tools/access-review-quarterly.mjs` |
| `agent/tools/access-review-quarterly.test.mjs` (8 tests) covers the quarter label, the issue with counts, the issue with nothing due, eight unreadable replies (each still writes the issue and exits 1) and a workflow lint. The lint pins the calendar-quarter cron, the tool call, `issues: write` and an `always()` notification, and goes red on yearly or daily schedules, a skipped tool, a failure-only notice and a read-only permission. | `agent/tools/access-review-quarterly.test.mjs` |
| Docs: GOVERNANCE.md section 2 has a "Calendar trigger" bullet. The README scheduled-jobs table now counts fifteen workflows, with the new row. CUTOVER-RUNBOOK.md pauses `access-review-quarterly`. REQUIREMENTS G.4 row appended (not accepted). | docs |

No UI or copy changed, so the i18n gate and the UI audits do not apply. Authorization: the counts are read only through Core's internal status (`x-internal-api-key`, 403 without it, already pinned) and the staff route behind `manage_support`.

Final verification (local): backend `npm run type-check` and `npm run lint` clean. Full backend unit suite: 147 files passed and 1 skipped (the Postgres-only placement test), 3,341 tests passed and 1 skipped. Root `npm run tools:test`: 416 of 416 passed. `npm run spec:check` and `npm run secrets:check` are OK. `npm --prefix backend run ops:drill` gives PASS for all six targets.

### What remains

- The staff/access owner must watch the `access-review` label, as well as `ops-watchdog`, and the first quarterly run (1 October 2026 if deployed by then) is the first real review.
- Owner and ops steps: the first scheduled runs in production of `content-retro-checks.yml` and `ops-job-watch.yml`, with its new fields, once Core is deployed. Deploy Core before the watcher runs against it: a Core without `tutorRetention` and `accessReviews` makes the watcher refuse the reply and notify, which is loud, not silent. Also the subscription of the staff/access owner to the `ops-watchdog` issue, and a drill against the deployed Core.
- Human review. Acceptance of G.2, G.4 and H.4.
