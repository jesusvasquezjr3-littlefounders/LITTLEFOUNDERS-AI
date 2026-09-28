# Gap-fix round 1

Lane records for the first gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implemented and locally
verified is not accepted and not released.

## F1-staff-ops

Branch `codex/spec-fix1staffops`. Seven audited SPEC gaps in the staff,
identity-metrics and operations area. Each gap was checked in the code first;
all seven were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | Appendix M Part 1 (1.1-1.4), Part 2.1 criterion 3, Part 3 Stage 5 | No Block A metric was instrumented anywhere; no identity endpoint in `admin.ts` | `identity_metrics(p_from, p_to)` (service_role only, counts only) over auth.users (is_anonymous and the app-metadata provider read through `to_jsonb`, so it also runs where those GoTrue columns are absent), account_safety_origins, account_age_declarations, profiles.birth_date, user_roles, guardian_links, the latest parent_verifications row and audit_logs. Core writes the two events it needed: `auth.guest.age_refusal` {flagged} on every age-refusal guest request and `auth.kid_email_change.refused` (no address). `GET /api/v1/admin/analytics/identity?days=` (view_analytics) returns 12 metrics, each marked `release_gate` (target 100%) or `diagnostic`, plus the five adversarial metrics with the test suite that proves each. Rebuilt panel "Identity and age safeguards" on Analytics & Health, Trust | `database/migrations/0196_identity_metrics.sql`, `backend/src/services/identityMetrics.ts`, `backend/src/routes/auth.ts`, `frontend/src/rebuild/staff/console/StaffProgramme.tsx` (IdentityMetricsCard) |
| 2 | A.5; Appendix M 1.2 Staff-Grant Justification Completeness | `admin.ts` committed the role, then wrote the justification with an ignored boolean; the revocation wrote its audit row first, also ignored | `grant_parent_role_with_justification(user, actor, justification)` and `revoke_parent_verification(user, actor, reason)`: one transaction each, reason bounds (10-200, 10-300 after trimming), actor role checked in SQL. Trigger `trg_enforce_parent_role_provenance` refuses a parent role written by an API role unless it comes through the function, the latest verification is a verified ID check, or a justification row already exists. Core maps refusals to 400/409 and answers 502 when a write is not confirmed | `database/migrations/0193_parent_grant_integrity.sql`, `backend/src/services/adminData.ts`, `backend/src/routes/admin.ts` |
| 3 | C.24; Appendix C 1.1-1.2 | Seven signals listed `not_instrumented` although their RPCs existed | The evaluation loop reads `learning_judgment_differentiation`, `learning_narrative_metrics`, `learning_session_efficiency`, `mentor_resolution_efficiency`, `learning_rest_day_utilization` and `learning_autonomy_adoption`. Judgment quality is a floor at the existing `JUDGMENT_DIVERGENCE_FLOOR`; session efficiency and Mentor resolution use the existing `classifyTrend` rule (a regression breaches and flags the named owner); bridge conversion, decision journal, rest-day use and autonomy adoption are diagnostic. An unreadable source is `unavailable`, never zero | `backend/src/services/pedagogy/mentorQuality.ts`, `evaluationLoop.ts`, `frontend/src/rebuild/staff/mentorQuality*` |
| 4 | H.4; Appendix O 1.3, 2.3 | No heartbeat, status endpoint, watch workflow or console status for the backups or the drift probe | `POST /api/v1/internal/ops/heartbeat` (internal key) writes `ops.<job>.completed` {ok, bytes?, pending?}; `GET /api/v1/internal/ops/job-status` and `GET /api/v1/admin/ops/job-status` (manage_support) return `lastRunAt`, `lastAttemptAt` and `stale` per job, with `OPS_JOB_STALE_HOURS` (36 h each) as the one home of the window. `vault-backup.yml`, `pulse-backup.yml` and `vault-drift.yml` (schedule and dispatch only) end with `scripts/ops-heartbeat.sh`. `ops-job-watch.yml` (10:00 UTC) fails on a stale or unreadable status and opens or comments on the `ops-watchdog` issue. The staff Support view shows the three jobs beside the retention sweep. Simulated-failure drill: `npm --prefix backend run ops:drill` | `backend/src/services/opsJobs.ts`, `backend/src/routes/opsHeartbeat.ts`, `agent/tools/ops-job-watch.mjs`, `backend/src/scripts/opsJobDrill.ts`, `.github/workflows/*.yml`, `StaffProgramme.tsx` (OpsJobsCard) |
| 5 | G.4; Appendix N 1.1 | The review card listed family roles, never staff permissions, aged from `granted_at` only, had no review action and no log | `staff_access_reviews` (RLS on, staff only), `record_staff_access_review` (superadmin actor, a kept review needs the grant held now, review row and `admin.access.reviewed` in one transaction) and `staff_access_review_status(cadence)` (admin/superadmin roles and the four staff permissions only, due from max(granted, last kept review)). `GET /admin/roles/reviews`, `POST /admin/roles/review` (superadmin). The Roles & Access card lists due grants with Keep access and Manage and shows Reviewed on time (compliance) and Past review (stale count) | `database/migrations/0195_staff_access_reviews.sql`, `adminData.ts`, `admin.ts`, `frontend/src/rebuild/staff/console/StaffAccess.tsx` |
| 6 | G.6; Appendix N 1.3 | Constraints written in GOVERNANCE.md section 1, enforced by no gate | `agent/tools/check-staff-standing-constraints.mjs` in `spec:check` and repo-gates: function-level reach from `admin.ts` through every imported backend symbol to `tutor_turns`, transcript or turns endpoints and per-account wallet/banking tables (allowlist entries must cite an OD); impersonate, act-as, login-as and sudo route paths, request fields and identifiers; token or session minting. Runtime Core test calls every staff GET route | `agent/tools/check-staff-standing-constraints.mjs` (+ test), `backend/src/__tests__/staffStandingConstraints.test.ts` |
| 7 | G.3; Appendix N 1.2 | The review audit row and the pack audit row were separate, ignored writes after the decision committed | `record_tutor_live_review` redefined (same signature and answers) to insert `admin.tutor_activity.review` in its transaction only when the segment changed; new `set_tutor_pack_status` does the pack decision and `admin.tutor_pack.status` together. Core's separate inserts are removed | `database/migrations/0194_audited_staff_decisions.sql`, `admin.ts`, `backend/src/services/tutorPacks.ts` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15700): `database/scripts/verify-staff-ops-postgres.py` applies all 196 migrations and passes 16 checks: a direct service-role parent insert is refused; short, overlong and non-superadmin grants leave no role; a failing audit write rolls the role back; the ID-verified path still grants; an update into parent is refused; the revocation is whole or nothing; a verdict and a pack decision write their audit row exactly when the decision row changes; the review list never holds a family role; a kept review is superadmin-only and restarts the cadence; no browser role reads the log or calls the functions; `identity_metrics` counts every population. `verify-social-governance-postgres.py` (no new messaging surface) and `verify-account-erasure-postgres.py` also pass on the new chain.
- Core (vitest, focused): `staffOps.test.ts` (13), `staffStandingConstraints.test.ts` (2), `opsJobDrill.test.ts` (3), `verificationAdmin.test.ts`, `admin.test.ts`, `auth.test.ts`, `tutorPacks.test.ts`, `mentorQuality.test.ts`, `judgeCalibration.test.ts`, `evaluationLoop.test.ts`, `learningQualityS053d.test.ts`; backend type-check and lint of touched files clean.
- Frontend: staff console, programme, Mentor quality and copy-budget tests (EN, es-MX, pt-BR); type-check and lint of touched files clean; i18n gate green.
- Root: `spec:check`, `secrets:check`, `governance:check` (two Tier 1 change rows recorded, sign-offs pending), `evaluation-loop:check`, migration phase check, the new tool tests.
- The drill (`npm --prefix backend run ops:drill`) passes for all three jobs.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites. No screenshot of the two new panels was taken.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Parent-role trigger scope.** The trigger binds every API role (anon, authenticated, service_role, authenticator). A database superuser session (migrations, dev seeds, the native verifiers, an operator at psql) is not bound, because a superuser can disable any trigger anyway; the 19 native verifiers and `dev_seed.sql` insert parent roles that way. The re-grant of an account whose justification row already exists is allowed without a new one.
2. **FAQ-claim parity** is measured as the presence of each claimed capability in the live schema (second-guardian invites, the deletion cascade, the report tool). The FAQ text side stays covered by the existing FAQ gates; a copy audit is not automated here.
3. **Flag persistence** counts origin-flagged accounts that are no longer anonymous and checks that `social_tier` still restricts them (closed or guardian). The database cannot tell a guest upgrade from a Google under-13 reclassification, so both are in the population.
4. **Watchdog notification** is a GitHub issue labelled `ops-watchdog` (opened or commented), which notifies repository watchers. A paging webhook is not added (no new secret, OD-23 zero spend).
5. **Drift heartbeat** is recorded only for scheduled and manual runs, not for the push-triggered probe.
6. **Document-type field.** The Schema Field Utilization metric reports `parent_verifications.document_type` as declared with no consumer, so that release gate reads below target until the column is dropped or validated (the form already stopped asking in S04.2).

### Migrations (renumbered by the orchestrator at merge)

- `0193_parent_grant_integrity.sql` (contract: apply after the Core release of this lane)
- `0194_audited_staff_decisions.sql` (expand)
- `0195_staff_access_reviews.sql` (expand)
- `0196_identity_metrics.sql` (expand)

### Lane finish (F1-staff-ops-finish)

- Sync: `codex/spec-migration-s02` merged; already up to date, no conflicts.
- Adversarial pass over the seven gaps: every new route sits behind its server-side guard (`/analytics` view_analytics, `/ops` manage_support, `/roles/reviews` and `/roles/review` superadmin only, the internal ops routes the internal key); the rebuilt panels import only `rebuild/design/controls` and console parts, no legacy component; copy present in all three locales (i18n gate green). Nothing mandated was found missing.
- Full unit suites, once per touched service. Backend: type-check and lint clean; 3092 of 3095 passed (1 skipped); the reds below were fixed and their three files pass alone (the full suite was not rerun). Frontend: type-check and lint clean; 2859 of 2860 passed.
- Three backend reds, fixed:
  - `mentorQualityRoutes.test.ts` still expected session efficiency to be `not_instrumented`; this lane instruments it (C.24), so the test now expects `yes`.
  - `analytics.test.ts` (not lane code) used a fixed first-data day of 2026-08-20; by 2026-09-28 the all-time fill is 40 days and trips its `< 40` bound. The day is now relative to today.
  - `opsJobDrill.test.ts` spawns the watcher as a child process per job; it timed out at the 5 s default in a loaded run. It now has an explicit 30 s budget.
- One frontend red, not lane code: `assetGate.test.ts` OCR case timed out at 90 s while four other lanes ran full suites on the same machine; an isolated rerun stalled under the same contention and was stopped. The same OCR check (`check-rebuild-assets.mjs`, 118 rasters free of text) passed inside `spec:check` in this session. Left to the orchestrator's quiet full run.
- Root: `spec:check`, `secrets:check`, the two new tool test files (11 tests) and the i18n gate green.

### Merge integration

- Merged into `codex/spec-migration-s02` with no conflicts: the lane's base was the integration head (`d0c9a0f7`), so no other lane's change was in flight.
- Migrations: the lane's `0193`-`0196` already follow the integration branch's highest number (`0192`); no renumbering. All four are under 23,000 bytes (largest `0196`, 13,479). No other lane redefines `record_tutor_live_review`, `set_tutor_pack_status` or the new grant/revoke functions after `0194`, so the apply-order state is the lane's.
- No integration defects found. On the merged tree: `typecheck:all`, `lint:all`, `spec:check` (S03 design gates, S05/S08 gates, OD-28 Wallet glossary), `secrets:check`, the i18n gate, `tools:test`, `database` `npm test` (44 tests plus the migration checks), backend (127 files passed, 1 skipped) and frontend (248 of 248 files, including the `assetGate.test.ts` OCR case the lane left open) all green. The lane's open item "full backend suite not rerun" is closed by this run.

### What remains

- Production data for every Appendix M metric and the first scheduled heartbeat and watch runs (production is out of scope in speed mode).
- Both leads' signatures on the two new Tier 1 change rows.
- The owner decisions above; the document-type column decision.
- Browser look and the rebuild audits over the two new panels and the new review card (orchestrator gates).
