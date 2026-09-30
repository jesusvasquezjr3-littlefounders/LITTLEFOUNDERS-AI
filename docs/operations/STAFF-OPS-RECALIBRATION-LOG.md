# Staff console and operations recalibration log (Blocks G and H)

Appendix N Part 3 Stage 6 and Appendix O Part 3 Stage 6 ("Post-Launch Recalibration") each ask for a quarterly review, consistent with Appendices H, J, L and M (and N, for Block H): real production data feeds back into the block's thresholds. For Block G, the Platform Lead reviews access-review compliance, bypass-path usage and Audit Log completeness. For Block H, the Data/Privacy Lead reviews consent coverage, alert delivery, watchdog drill results and retention-policy currency. The owner decision log (section 8) says the G.2 30-day retroactive window and the G.4 quarterly cadence apply as written and are recalibrated through each block's threshold log. This file is that log for both blocks. It is not a specification: the SPEC (`docs/littlefounders-spec/`, Appendices N and O) and the owner decision log win when they disagree with it.

**Enforced, not only written.** `agent/tools/staff-ops-review-cadence.mjs` (in `npm run spec:check`) reads the tables below and fails when:

- a threshold row drifts from the Appendix N and O Part 1 metrics it knows (id, block, part, requirement or kind);
- a row's code source no longer exists;
- a calibration value differs from the constant Core, dataintel or a migration actually enforces;
- the rollback rule stops naming its five metrics.

Owners of the review:

- **Block G: the Platform Lead** (Appendix N Part 3 Stage 6).
- **Block H: the Data/Privacy Lead** (Appendix O Part 3 Stage 6).

Each owner is a distinct role from the Engineering Lead who scoped or built a change. Cadence: quarterly, for each block.

**First human review due: 2026-12-31** for both blocks (one quarter after this log was created, 29 September 2026; an owner may bring it earlier, never later). The due date is machine-read. Only a row of kind `human` counts as a review, and only for the block(s) in its Block column (`G`, `H` or `G+H`). A row of kind `engineering` records what a lane did and never counts. After a human review of a block, that block's next review is due 90 days later. The tool warns when a review is overdue and fails with `--strict` (release readiness). `.github/workflows/staff-ops-recalibration-quarterly.yml` opens the quarter's issue on the first day of each calendar quarter, for both leads. The issue lists every release-gate metric and asks for the simulated job-failure drill.

## What a recalibration looks at

1. **Block G (Platform Lead):**
   - access-review cadence compliance and the stale-grant count (Roles & Access; `accessReviews` in the operations status);
   - bypass-path usage and retroactive-check completeness (`content_bypass_metrics`, the Content release card);
   - Audit Log completeness for live-activity and pack decisions (`npm run staff:db-verify`).
2. **Block H (Data/Privacy Lead):**
   - teen and guest disclosure coverage and the population gap (`GET /admin/analytics/consent-coverage`);
   - the alert-to-notification delivery rate (`GET /admin/intel/alerts/delivery`);
   - the watchdog: every watched job fresh, and the quarterly **simulated job-failure drill** (`npm --prefix backend run ops:drill`, every target), recorded in the history row (Appendix O 1.3: "quarterly otherwise");
   - retention-policy currency (`GOVERNANCE.md` sections 3 and 5).
3. **A release gate that reads missed is a regression, not a threshold to relax.** See the rollback rule below.
4. **The calibration values below.** Each can move only with evidence from real production data. To change one, do all of the following in one change:
   - record the owner decision;
   - change the constant (and, for a database value, add a new migration);
   - update this table.
5. **Any new metric.** Update Appendix N or O first (or record the owner decision), then the code, then this table and the tool's list, in one change.

## Thresholds

Kinds: `release gate` (a fixed target, checked every release or by a per-release proof), `diagnostic` (a trend, with no fixed target) and `documentation` (a documentation or code audit, "present and current").

| Metric | Block | Part | Requirement | Kind | Target | Source |
|---|---|---|---|---|---|---|
| `permission_endpoint_enforcement_coverage` | G | 1.1 | G.1 | release gate | 100% of the four grants gate their named endpoints server-side | `requireAdminPermission` (`backend/src/middleware/auth.ts`); `admin.test.ts` "independent staff grant matrix"; `verify-admin-permissions-postgres.py` |
| `cosmetic_permission_regression` | G | 1.1 | G.1 | release gate | pass every release, each of the four grants independently | `admin.test.ts` (a revoked grant is refused on the next request); `npm run staff:db-verify` |
| `privilege_differentiation_rate` | G | 1.1 | G.1 | release gate | 100% | `admin.test.ts` "makes each of the four grants admit only its own named API family" |
| `access_review_cadence_compliance` | G | 1.1 | G.4 | release gate | 100% | `staff_access_review_status` (Roles & Access; `accessReviews` in `/internal/ops/job-status`) |
| `stale_grant_rate` | G | 1.1 | G.4 | diagnostic | trend to zero; every grant past the window is flagged | `staff_access_review_status` due rows; `ops-job-watch.mjs` (`accessReviews.due`) |
| `release_verification_bypass_rate` | G | 1.2 | G.2 | release gate | zero bypasses without a Superadmin and a logged justification | `content_bypass_metrics` (`backend/src/services/contentRelease.ts`) |
| `bypass_retro_check_completeness` | G | 1.2 | G.2 | release gate | 100% justified and retro-checked within the window | `content_bypass_metrics` (complete); `content_retro_checks`; `verify-content-release-postgres.py` |
| `live_activity_audit_completeness` | G | 1.2 | G.3 | release gate | 100%, verified per release | `verify-staff-ops-postgres.py` (G.3 section), run by `npm run staff:db-verify` |
| `staff_screen_navigation_parity` | G | 1.3 | G.5 | release gate | 100% | `STAFF_ROUTE_GRANTS` (`frontend/src/app-routes/staffGrants.ts`); `app-shell/__tests__/navigation.test.ts` |
| `standing_constraint_integrity` | G | 1.3 | G.6 | release gate | pass every release, zero exceptions | `check-staff-standing-constraints.mjs` (spec:check); `staffStandingConstraints.test.ts` |
| `teen_guest_disclosure_coverage` | H | 1.1 | H.1 | release gate | 100% | `disclosureCoverage.ts` coverage (`GET /admin/analytics/consent-coverage`) |
| `consent_gate_population_gap_rate` | H | 1.1 | H.1 | release gate | zero, verified per release | `disclosureCoverage.ts` gap |
| `kid_role_consent_gate_regression` | H | 1.1 | H.6 | release gate | pass every release, zero exceptions | `verify-analytics-postgres.py` (the kid-role consent gate), run by `npm run staff:db-verify` |
| `retention_window_reconciliation` | H | 1.2 | H.2 | documentation | present and current | `GOVERNANCE.md` section 3; `warehouse-retention.test.ts` |
| `backup_encryption_confirmation` | H | 1.2 | H.5 | documentation | confirmed encrypted, documented | `backup-workflows.test.mjs`; `GOVERNANCE.md` section 5 |
| `incident_response_plan_currency` | H | 1.2 | H.5 | documentation | present; reviewed within 366 days and after every incident | `check-staff-standing-constraints.mjs` (the plan's review date); `GOVERNANCE.md` section 5 |
| `instrumentation_consumer_coverage` | H | 1.3 | H.3 | release gate | 100% end to end | `ALERT_CHANNEL_UNCONFIGURED` (dataintel refuses an alert with no channel), plus the delivery, export-job and emitter rows below |
| `alert_notification_delivery_rate` | H | 1.3 | H.3 | release gate | 100% | `alertDeliveryRate` (`dataintel/src/services/alerts.ts`, `GET /admin/intel/alerts/delivery`); `alerts.undelivered` in `ops-job-watch.mjs` |
| `export_job_terminal_state` | H | 1.3 | H.3 | documentation | retired: the export-job machinery is removed, so no job can stay pending | `dataintel/src/services/exports.ts` (removal note; no job route in `routes/queries.ts`) |
| `missing_emitter_closure` | H | 1.3 | H.3 | release gate | 100%: both events emit | `trackInsight('task_view'` (`TasksPage.tsx`) and `trackInsight('tutor_open'` (`TutorPage.tsx`) |
| `watchdog_notification_coverage` | H | 1.3 | H.4 | release gate | 100% of the watched jobs, with the Mentor retention sweep | `OPS_JOBS` (`backend/src/services/opsJobs.ts`); `ops-job-watch.mjs` and `ops-job-watch.yml` |
| `simulated_job_failure_drill` | H | 1.3 | H.4 | release gate | pass before any release that touches job scheduling, and quarterly otherwise | `ops:drill` (`backend/src/scripts/opsJobDrill.ts`) |
| `reference_standard_documentation` | H | 1.4 | H.6 | documentation | present and current | `GOVERNANCE.md` section 1, item 4 |
| `experiment_eligibility_policy` | H | 1.4 | H.7 | release gate | present before the exposure endpoint's first call (pass or fail) | `POLICY_MIN_AGE` (`dataintel/src/services/experiments.ts`); `GOVERNANCE.md` section 6; `experiment-age-eligibility.test.ts` |

## Calibration values

The numbers these metrics are judged by. Each value is read from every place that enforces it. They must all agree with this table.

| Key | Value | Requirement | Source |
|---|---|---|---|
| `g2.retro_check_days` | 30 | G.2 | `RETRO_CHECK_DAYS` (`backend/src/services/contentRelease.ts`); `content_retro_check_days()` (latest migration defining it) |
| `g4.access_review_cadence_days` | 90 | G.4 | `ACCESS_REVIEW_CADENCE_DAYS` (`backend/src/services/adminData.ts`); the `staff_access_review_status` default (latest migration defining it) |
| `h3.alert_undelivered_window_hours` | 36 | H.3 | `ALERT_UNDELIVERED_WINDOW_HOURS` (`backend/src/services/warehouseAlerts.ts`) |
| `h4.ops_job_stale_hours` | 36 | H.4 | every entry of `OPS_JOB_STALE_HOURS` (`backend/src/services/opsJobs.ts`); `RETENTION_STALE_HOURS` (`backend/src/services/tutorData.ts`) |
| `h4.deletion_step_failure_hours` | 24 | H.4, E.6 | `DELETION_STEP_FAILURE_HOURS` (`backend/src/services/opsJobs.ts`) |
| `h7.policy_min_age` | adults_only 18, od26_c17 10 | H.7, OD-23, OD-26 | `POLICY_MIN_AGE` (`dataintel/src/services/experiments.ts`) |

## Stage 6 rollback rule

A regression in any of these five metrics triggers an **immediate rollback** of the change that caused it, never a patch under pressure. This is the kill-switch discipline of Appendices F, H, J, L and M.

- Appendix N Stage 6: `cosmetic_permission_regression` and `release_verification_bypass_rate`.
- Appendix O Stage 6: `kid_role_consent_gate_regression`, `alert_notification_delivery_rate` and `watchdog_notification_coverage`.

The rollback restores the last release where the metric passed (see `CUTOVER-RUNBOOK.md` and `BACKUP-RESTORE-ROLLBACK.md`). The target is never relaxed to make a failing release pass. The owner of the block decides when to ship again, and records the decision in the history below.

## Review history

| Date | Kind | Block | Metrics | Decision | By |
|---|---|---|---|---|---|
| 2026-09-29 | engineering | G+H | All rows | Initial record (gap-fix round 7, staff-ops). The targets and calibration values are those of Appendices N and O and the owner decision log, as written. No production data exists yet (the product runs locally), so nothing has been recalibrated. The simulated job-failure drill passes locally as a unit test (`opsJobDrill.test.ts`). A drill against the deployed Core is the ops owner's. | Engineering (fix7staffo5 lane) |
