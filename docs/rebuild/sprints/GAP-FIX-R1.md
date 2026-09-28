# Gap-fix round 1

Lane records for the first gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

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

## Checkpoint F1-identity-site

Lane: identity-site, branch `codex/spec-fix1identity`. Five audited SPEC gaps
were checked in the code first. All five were real, and all five are closed at
the implementation and local-verification level.

### 1. A parent-created child is never asked their own age (A.4; OD-3; Appendix M 1.1)

The gap was real. `birthDate` was optional on `POST /family/kids`, and no
declaration was written without it. `readAgeScreen` then returned
`required=true`, and the child answered the self-declaration screen, with any
band, as insert-once evidence.

Built:
- Core `POST /family/kids` requires a birth date or a Tutor-chosen `ageBand`
  (`under_13` / `13_to_17`, which must agree with a date when both are sent).
  It refuses neither with `CHILD_AGE_REQUIRED` before any identity is created,
  and records the declaration before the role (rollback on failure as before).
  (`backend/src/routes/family.ts`, `services/ageScreen.ts`: `ChildAgeBand`,
  `childAgeBand`, `recordAgeScreenBand`, `readAgeRecorded`.)
- `PATCH /family/kids/:kidId` records the first declaration from a new date
  or band. A band-only change of an age already on record is refused
  (`AGE_ALREADY_RECORDED`, insert-once). A date still updates the profile.
- `GET /family/kids` reports `ageRecorded` per child.
- `POST /auth/age-screen` refuses a kid-role caller (`403 KID_AGE_BY_TUTOR`)
  before any write, and fails closed when the role cannot be read.
- Frontend: `RequireAgeScreen` shows a kid (or any caller Core refused with
  `KID_AGE_BY_TUTOR`) the single-state "Ask your Tutor" screen
  (`AgeScreen` state `askTutor`, no date form). The Family console's add-child
  form requires an age band or a birth date. Manage account asks the Tutor for
  the age of a child with none on record. Copy is in 3 locales within budget.

### 2. The database refuses a kid-role address change on any path (A.6; Appendix M 1.3; Part 2.1 criterion 2)

The gap was real: only Core refused the change, and GoTrue was reachable
directly through Kong.

Built:
- Migration `0197_guard_kid_email.sql`: a `guard_kid_email` BEFORE UPDATE
  trigger on `auth.users` (SECURITY DEFINER). For a kid-role account it raises
  `P0001 KID_EMAIL_FORBIDDEN` on any email move, except to the derived
  `<username>@kids.littlefounders.invalid` of the current (guarded) handle,
  which is the Tutor's S-06 rename. It also raises on any new pending email
  (`email_change`) or phone. Values are compared first, so GoTrue's whole-row
  rewrites at sign-in pass. There is deliberately no session switch to skip
  the check; the Tutor's rename passes on its own terms.
- `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED: "true"` is pinned in the compose
  overlays written by `database/scripts/local-stack.sh` and
  `disposable-stack.sh`, and documented in `README.md` for the Railway auth
  service.
- Native proof: `database/scripts/verify-kid-email-guard-postgres.py` (5
  checks on the full chain). It covers 15 refused writes by GoTrue's role, the
  service role and a superuser; sign-in rewrites; clearing a pending value;
  adult, teen and Tutor changes; and the Tutor rename. The existing
  `verify-kid-username-change-postgres.py` still passes on the new chain.

### 3. Onboarding completion requires the age screen (Appendix M 1.1; Part 2.3(b))

The gap was real. `onboardingRouter` now mounts `requireAuth,
requireAgeScreen`. An adversarial test in `ageScreen.test.ts` shows that an
unscreened account gets `403 AGE_SCREEN_REQUIRED` and nothing is written. A
refused child's guest carries the under-13 origin and still passes.

### 4. The onboarding Mentor chooser shows the characters on the Diorama (Bible 08 §8; OD-6)

The gap was real, and the assets exist. Each O1 Mentor row now leads with
`findChooserStill(character, theme)`, the `mentor.chooserStill` render used by
the Mentor screen's chooser, with its name and a line of up to 6 words. The
`PUT /tutor/preferences` save is unchanged. A character without a still falls
back to its avatar render, never a stand-in. `identity.test.tsx` asserts that
the rows use `mentor.<character>.chooser.<theme>` and that no `mentor-avatar`
slot is rendered.

### 5. The staff-reviewed age correction (E.4 as amended by OD-3; Appendix J 1.1)

The gap was real: no table, route or screen existed.

Built:
- Migration `0198_age_correction_requests.sql`:
  - `age_correction_requests`: requester, saved and requested band, a birth
    month for a 13-17 band only, status, decider, reason code and timestamps.
    RLS is on with no policy. There is no browser grant, and the service role
    can SELECT only. A unique partial index allows one pending request per
    account.
  - `request_age_correction`: refuses a kid role, an under-13 origin, a
    guest, an unscreened account, no change, a malformed band or month, and a
    second pending request. An under-13 request marks the under-13 origin at
    once (0086: a later under-13 disclosure always protects).
  - `decide_age_correction`: the decider must be superadmin, or admin with
    `manage_users`, and never the requester (`SELF_DECISION`). Only a pending
    request can be decided, and the reason must match the decision. An
    approval replaces the declaration through `record_age_declaration`,
    promotes a due month through `promote_age_declaration`, and re-runs the
    E.13 review when the tier moved. Every decision writes one `audit_logs`
    row (G.3) in the same transaction.
- Core:
  - `GET` / `POST /api/v1/account/age-correction` (strict body `{ birthDate }`,
    kid and guest refused before any write).
  - `GET /api/v1/admin/age-corrections` and `POST
    /api/v1/admin/age-corrections/:id/decision`, behind `manage_users`. The
    decider is always the session, never the body.
  - All of it is in `services/ageCorrection.ts`.
- Frontend:
  - The Settings age card (`AgeRecordCard` and `AgeRecordSetting`) now also
    shows a self-declared adult. When Core says the account may ask, it
    offers "Request a correction" and then shows the status (pending,
    approved or rejected).
  - `settings.birthDateHelp` now points to the correction.
  - The rebuilt staff section "Age corrections" (`staffGrants` entry
    `ageCorrections`, `navigation.ts`, `staff.tsx`, `staffConsole.tsx`,
    `StaffAgeCorrections.tsx`, and an Overview link) lets staff filter,
    open a request, pick a matching reason, confirm, and see the outcome.
  - Copy is in 3 locales within budget.
- Native proof: `database/scripts/verify-age-correction-postgres.py` (9
  checks). It covers the refused populations; a pending request changing
  nothing; that no one decides their own request and a non-staff decider is
  refused; that an approval moves the declaration, social tier and analytics
  admission with one audit row; a due month promoted; a rejection changing
  nothing; the under-13 request protecting at once; and browser denial.

### Verification (lean mode)

- Backend: `type-check` and `lint` are clean. The focused vitest files pass:
  `ageScreen`, `familyKids`, `family`, `onboarding`, `motivationS053e`,
  `ageUpgradeChain`, `insights` and the new `ageCorrection` (28 cases).
- Frontend: `type-check` and `lint` are clean. The focused vitest runs pass:
  `rebuild/identity`, `rebuild/family/console`, `rebuild/account`,
  `rebuild/staff`, `app-shell`, `app-routes`, `routes/app/profile`,
  `auth/RequireAgeScreen`, `design/shells` and every `copy-budget` file.
- Database: `check-migrations` and `check-migration-phase` pass on the
  194-file chain, and both new native verifiers pass on PostgreSQL 17.6 (lane
  cluster, port 15710).
- Root: `spec:check`, `secrets:check` and the i18n gate pass.
- Not run (orchestrator merge gates): full suites, `audit:rebuild`, and the
  browser matrix. The `onboarding@mentor*` audit re-run was attempted, but
  headless Chrome did not open its debugging port inside this agent's
  sandbox. It must run at the merge.

### Remaining limitations and open items

- A live GoTrue proof is still missing: `PUT /auth/v1/user {email}` with a kid
  token on the disposable stack. The trigger is proven natively. Whether a
  GoTrue version sends the confirmation mail before its refused write needs
  that live run.
- Railway's auth service must carry
  `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true`. This is an operator step,
  deferred to production.
- A parent-created child whose age is still missing sees "Ask your Tutor"
  until the Tutor gives it in Family. No backfill guesses a band for a child
  with no stored date. Children with a stored `profiles.birth_date` were
  already backfilled by S10.1.
- A later birth date from a Tutor does not change an age already on record
  (the declaration is insert-once, as before). A guardian-side correction of a
  parent-created child's recorded band is not in scope here.
- Browser matrix, audits, human design review and Trust review are pending.

### Owner questions (conservative defaults applied)

- An under-13 correction request marks the under-13 origin at once, before
  staff decide. This is the protective reading of 0086. It stays even if
  staff reject the request. Confirm.
- The correction's reason codes are `evidence_verified`, `entry_error`
  (approve), `evidence_missing` and `not_credible` (reject). Evidence is
  checked outside the app. No document upload is built.
- Self-declared adults now see the age card, so they can ask for a
  correction.

## Checkpoint F1-identity-site-finish (lane summary)

Final state of the identity-site lane. All five audited gaps (A.4, A.6, E.4,
Appendix M 1.1 / Part 2.3(b) onboarding, Bible 08 §8 chooser) are
implemented and locally verified; none is accepted or released.

- Sync: `codex/spec-migration-s02` had not moved since the lane branched
  (`d0c9a0f7`), so the merge was a no-op.
- Adversarial pass against the SPEC scope found no mandated behavior missing.
  Every refusal is enforced at Core and, for A.6 and E.4, again in the
  database. The rebuilt screens (`ChildControls`, `AgeRecordCard`,
  `AgeScreen` ask-your-Tutor state, `StaffAgeCorrections`) import only the
  shared design controls and shells, and their copy exists in EN, es-MX and
  pt-BR. E.4 is met by its "lock" branch for parent-created children: their
  recorded band is insert-once, and the database's `profiles_birth_date_guard`
  (0087) still refuses a self-edit.
- Fixes in this checkpoint:
  - `backend/src/__tests__/ageCorrection.test.ts`: the `rpcCalls` helper
    dropped the recorded body from its type, so backend `type-check` was red
    (TS2339) although the tests ran. It is generic now.
  - `frontend/src/routes/onboarding/__tests__/OnboardingPage.test.tsx` still
    expected the square `mentor.<c>.avatar` renders in the O1 chooser. It now
    asserts the `mentor.<c>.chooser.<theme>` stills and no `mentor-avatar`
    slot (Gap 4).
  - `backend/src/__tests__/analytics.test.ts` (not lane code, found by the
    full suite): "does not invent years of leading zeros for all-time" used
    the real clock and turned red on 2026-09-28, when the series from
    2026-08-20 reached 40 days. `now` and the zone are now pinned. The base
    branch has the same red.
- Verification:
  - Backend and frontend `type-check` and `lint` are clean.
  - The full backend unit suite ran: 125 of 126 files passed, and the one red
    was the analytics clock test above, which passes after the fix.
    `ageCorrection` passes 28 of 28.
  - The full frontend unit suite ran twice with other lanes loading the CPU
    to 99%. The first run's real red was the onboarding test above. The
    second run's reds were timeouts only, in `App`, `BankingPage`,
    `AuthLayout` and `assetGate`. All four pass when run alone, and
    `check-rebuild-assets.mjs` passes directly.
  - `database` `npm test`: `check-migrations`, `check-migration-phase`,
    `check-family-lifecycle` and the node test files pass on the 194-file
    chain. `railway-migrate.test.mjs` was still applying its full-chain
    scenario after more than two hours under load when this record was
    written; see the lane report.
  - Root `spec:check` and `secrets:check` pass.
- Still open: the live GoTrue proof on the disposable stack, the Railway
  `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true` operator step, the
  `onboarding@mentor*` audit, the browser matrix, device and screen-reader
  passes, human design and Trust review, and acceptance for A.4, A.6 and
  E.4. A Tutor cannot correct a parent-created child's recorded band (see
  the owner question below).

Additional owner question (conservative default applied): E.4 allows either
a lock or a guardian re-confirmation. The lane locks. A Tutor who entered the
wrong band for their child has no in-app path to change it; the recommended
follow-up is to let the Tutor file the same staff-reviewed request for a
linked child.

### Merge integration (F1-identity-site)

Merged into `codex/spec-migration-s02` after F1-staff-ops.

- Migrations renumbered by the orchestrator: the lane's `0193_guard_kid_email`
  and `0194_age_correction_requests` collided with F1-staff-ops' `0193`-`0196`,
  so they are now `0197_guard_kid_email.sql` and
  `0198_age_correction_requests.sql` (references rewritten). Neither lane
  redefines the other's functions or triggers; both files stay under
  23,000 bytes (3,652 and 11,567).
- `backend/src/__tests__/analytics.test.ts`: both lanes fixed the same
  date-dependent all-time case differently (F1-staff-ops made the first data
  day relative to the real clock; this lane pinned `now` and the time zone).
  The pinned version is kept, with its fixed `2026-08-20` expectation, because
  it no longer depends on the day the suite runs.
- `docs/rebuild/REQUIREMENTS.md` rows A.1-A.6: the F1-staff-ops and
  F1-identity-site additions are both kept (union), with both evidence links.
- `rebuild-staff.json` (3 locales): the Age corrections section and the
  F1-staff-ops staff panels merged key by key; no key clash.
- Checks on the merged tree: typecheck:all, lint:all, backend unit suite,
  frontend unit suite, spec:check, secrets:check, the i18n gate and the fast
  database gates. The onboarding@mentor* rebuild audit and the live GoTrue
  kid-token proof are still open, as listed above.

## F1-data-platform

**Branch:** `codex/spec-fix1dataplat`, based on `d0c9a0f7`. Migrations were numbered `0193`-`0198` in this worktree; the orchestrator renumbered them to `0199`-`0204` at merge (the table below uses the merged names).

Nine audited gaps, each verified in the code before it was fixed. All nine were real.

### What was built

| # | SPEC clause | What | Where |
|---|---|---|---|
| 1 | A.5 (field removed, the alternate remedy); Appendix M 1.2 (retired into a Schema Field Utilization check) and 1.4 | `parent_verifications.document_type` stamped `'national-id'` on every new verification although nothing ever validated a document type. Expand step: no default, nullable, NULL on every row. Contract step: the column is dropped, after the Core release that no longer declares it. Core's `ParentVerificationInsert` and the generated types drop the field. A new `schema-fields:check` (in `spec:check`) asserts a retired field stays dropped in the chain, the types and every service source. | `database/migrations/0199_parent_verification_document_type_retire.sql`, `0200_drop_parent_verification_document_type.sql` (contract); `backend/src/services/supabaseRest.ts`; `database/types/database.ts`; `agent/tools/check-schema-fields.mjs` (+ test) |
| 2 | Appendix J Part 1.1-1.2 and DoD 2.1(3); E.1-E.5 | The nine E.1-E.5 metrics are instrumented. `social_protection_counters` holds daily counts by event, tier pair and relation, never an identifier. Core records the events only it sees through `record_social_protection_event` (every profile, list and action resolution with its verdict; follow attempts and the `GUARDIAN_APPROVAL_REQUIRED` / `SUBJECT_CONSENT_REQUIRED` refusals; the Tutor badge shown; the Family social panel view; unfollow and unblock). Triggers count every change of a set birth date or age declaration with its path (reviewed function, Core's guardian path, other). `social_protection_metrics(days)` returns discovery, unauthorized connections, approval latency p50/p95, reports and resolution time, pattern escalation (subjects meeting the report_escalation rule vs cases staff received), age boundary, Tutor badge, Family panel views and audit completeness (follows, blocks and reports reconciled with their audit rows, unfollows and unblocks with Core's raw count). `GET /admin/analytics/social-protection` (view_analytics, strict `days` 1-366, 502 on a malformed answer) adds the Appendix J verdicts. The staff programme shows three cards next to the social-safety ones. `social:check` fails if any of the nine metrics is dropped from the SQL, Core or the screen, or if Core stops recording. | `database/migrations/0204_social_protection_metrics.sql`; `backend/src/services/socialProtection.ts`, `backend/src/routes/admin.ts`, `profile.ts`, `family.ts`; `frontend/src/rebuild/staff/console/programmeApi.ts`, `staffProgrammeFixtures.json`, `rebuild-staff.json` (3 locales); `agent/tools/check-social-tiers.mjs` section 7 (+ tests) |
| 3 | Appendix J 1.3, DoD 2.1(2), 2.2 E.1(a-b), Stage 2 | `social:db-verify` (root and `database/`) runs every `verify-social-*.py` plus the teen discoverable, cooperative goals and account-erasure verifiers against the full chain: a throwaway cluster (initdb from `LF_PG_BIN`, `pg_config`, `/usr/lib/postgresql/*` or the portable binaries), or the running cluster named by `LF_PG_*`. Exit 1 on any failure; a clean SKIP only when no PostgreSQL or Python exists. The four older verifiers now honour `LF_PG_PSQL/PORT/USER/DATA`. Called from `release-readiness.sh`; a `social-db-verify` job in `database-ci.yml` (paths-filtered on `database/**`) runs it on a PostgreSQL 17 service container. | `database/scripts/social-db-verify.mjs` (+ test in `database` npm test), `package.json`, `database/package.json`, `agent/tools/release-readiness.sh`, `.github/workflows/database-ci.yml`, README Mandatory testing table |
| 4 | H.3; Appendix O 1.3 | The email channel sent `{to, template, data}`, which the email-server's `SendBody` rejects (400). It now sends `{to, subject: '[LittleFounders alert] <name>', text, templateType: 'alert_notification'}` (the first option; no template was added to the email-server). `alert_history` gains `delivery_status` (delivered, failed, unconfigured), `delivery_channel`, `delivered_at`, `delivery_error`, written after each attempt and returned by the history read. A shared fixture, byte-identical in both packages, is built by dataintel and POSTed through the email-server's real route (202). | `dataintel/src/services/alertEmail.ts`, `alerts.ts`; `dataintel/src/__tests__/alert-delivery.test.ts` + `fixtures/alert-email-body.json`; `email-server/src/__tests__/send.test.ts` + fixture |
| 5 | H.5; Appendix O 1.2 | The daily Vault and Pulse backups are encrypted on the runner with `backup-crypto.mjs` (key: the `BACKUP_ENCRYPTION_KEY` secret) before upload; only the `.lfbk` file and its manifest are stored; a missing key, an empty ciphertext or a surviving plaintext fails the job; the prune covers `*.dump.lfbk`, the manifests and the old plaintext dumps; the key is removed on every outcome. A lint refuses a backup workflow that uploads anything without the `.lfbk` suffix. | `.github/workflows/vault-backup.yml`, `pulse-backup.yml`; `agent/tools/backup-workflows.test.mjs`; `docs/operations/BACKUP-RESTORE-ROLLBACK.md` §1, `GOVERNANCE.md` §5 |
| 6 | G.2; Appendix N 1.2, 2.3; owner queue F-09 (option a) | For the API roles, a content change to a published lesson's `document`, or deleting it, is refused (42501). Echo's narration stamp is the one allowlisted diff (the documents compared with every `segments[].audio_segment_id` removed); the `audio` manifest stays writable. The database owner's change passes and is logged (`content.live_document_patched`) for the retroactive check. `images:backfill` reads each lesson's status, never illustrates or writes a published lesson, and reports each one it skipped (`skippedPublished`). | `database/migrations/0201_live_lesson_document_guard.sql`; `coursegen/src/scripts/backfill-images.ts`; `coursegen/src/__tests__/backfillImages.test.ts`, `liveDocumentGuard.test.ts` (static pins, Echo-stamp parity) |
| 7 | H.7; OD-23; OD-26 | dataintel treats an experiment with no bounds as adults only (18+); unknown ages are never eligible; a declared bound can raise the floor, never lower it. `eligibility_policy` is `adults_only` (default) or `od26_c17`, the only exception: tutor surface, never under 10. The create schema is strict and refuses every other population. `GOVERNANCE.md` §6 states OD-23, the OD-26 bands and that a new exception needs an owner decision. | `dataintel/src/services/experiments.ts`, `routes/queries.ts`; `dataintel/src/__tests__/experiment-age-eligibility.test.ts`, `experiments-stats.test.ts`; `docs/operations/GOVERNANCE.md` §6; comment in `backend/src/services/learningIntel.ts` |
| 8 | OD-9 §4.2; S10.3; B.23 / OD-27 (1) | `sharing.cooperative_goals` is registered (sharing surface, Tutor-only). `coop_goal_eligible` also requires `data_practice_applies`, so every read and write path applies it; create and accept refuse the acting account by name (`DATA_PRACTICE_CONSENT_REQUIRED`); an invitee it does not apply to is simply unavailable. The verified Tutor's opt-in is recorded as the practice consent (audited) and the opt-out revokes it. Core names the refusal (403) only on a clear no from the database. The practice appears in the Family Hub "Shared with others" group and in My data practices (3 locales). The data-practice pin now fails when a migration at or after the registry creates a table tying two accounts without a registered, enforced practice (or a written exemption). | `database/migrations/0202_cooperative_goals_data_practice.sql`; `backend/src/services/coopGoals.ts`, `dataPractices.ts`, `routes/coopGoals.ts`; `backend/src/__tests__/coopGoals.test.ts`, `dataPractices.test.ts`; `frontend/src/rebuild/family/dataPracticesApi.ts`, `dataPractices.json` (3 locales); `database/migration-od9/fixtures/generate-legacy-fixture.mjs`, `od9.test.mjs` |
| 9 | OD-24; OD-9 §4.1; toolkit README step 7; CUTOVER-RUNBOOK "T plus 7 days" | `od9 retire-catalog [--apply]` (`sql/60_retire_catalog.sql`): refused without the `before` inventory or a recorded `kc-credit --apply`; the dry run lists every legacy row to archive (rows that existed at the before inventory) and every learner whose complete topic still lacks its KC credit; apply refuses while one is missing, archives only, idempotently, then snapshots `pre_retire`/`retired` inventories around it and compares them (exit 1 on any loss). A BEFORE DELETE trigger refuses deleting a lesson, topic or course with learner progress, placement or badge rows, for every role. The proof and the rehearsal use the command instead of raw SQL. | `database/migration-od9/sql/60_retire_catalog.sql`, `00_schema.sql`, `od9.mjs`, `prove-od9-postgres.mjs`, `rehearse-cutover.mjs`, `od9.test.mjs`, README; `database/migrations/0203_legacy_catalog_delete_guard.sql`; `docs/operations/CUTOVER-RUNBOOK.md` step 10 |

### Verification

- **Native PostgreSQL 17.6** (the lane's owned cluster, port 15720, full 198-migration chain each time): `verify-data-platform-postgres.py` (new: document_type absent and refused; the live document guard with the stamp allowlist, the review lesson and the logged owner change; the delete guard for owner and service role), `verify-social-protection-postgres.py` (new: counters hold no identifier, browser and service-role access, window validation, discovery, badge, panel, age-boundary buckets, audit completeness with a negative control, pattern escalation with a negative control, latency), `verify-coop-goals-postgres.py` (11 checks, the OD-9 section new). The first `social:db-verify` run on a throwaway cluster passed 9 of 13 and exposed that the older verifiers assumed pre-existing API roles; the runner now creates them first. The second run (14 verifiers, 5 at a time, alongside the OD-9 proof) passed 13 of 14; the block-race verifier lost its connection 7 seconds in (client ephemeral-port exhaustion: one psql connection per statement, many in parallel) and passed alone (292 s). The runner now defaults to 2 at a time and reruns a verifier once, alone, when it failed only on the connection. `prove-od9-postgres.mjs` passed 15 of 15, including the new retire-catalog and delete-guard checks and the 15-practice consent registry.
- **Unit and contract tests:** backend `socialProtection`, `coopGoals`, `dataPractices`; dataintel `alert-delivery`, `experiment-age-eligibility`, `experiments-stats`, `intel`, `connection-recovery`; email-server `send`; coursegen `backfillImages`, `liveDocumentGuard`; frontend `StaffProgramme`, `DataPractices`; database `npm test` (migration numbering, RLS, phase headers, od9, social-db-verify); root `check-schema-fields`, `backup-workflows`, `check-social-tiers`. Type-check and lint in every touched service; `spec:check`, `secrets:check`, i18n gate.

### Owner questions (conservative default implemented)

1. **Self-registered migrated teens and goals together.** `sharing.cooperative_goals` is Tutor-only (`teen_self_consent = false`, like `sharing.social_connections`), so a self-registered 13-17 account the OD-9 step marks as a migrated child cannot take part until a verified Tutor consents. Should a teen with no Tutor be able to consent to this one practice themselves (H.1's self-managed model)?
2. **Teen discoverable profile (0184).** Not yet registered as a data practice; the new two-account pin records it as pending the owner's answer to the open question on it.
3. **Retire-catalog comparison baseline.** The task named "compare against before". At T plus 7 days ordinary activity has changed promised records since the before inventory, so the command compares a `pre_retire` snapshot taken immediately before archiving with the `retired` one (the proof also compares before with after, as before). Confirm this is the intended check.

### Remaining

- Owner steps: create `BACKUP_ENCRYPTION_KEY` (keygen, escrow with the two custodians) and push the backup workflows; apply `0200` (contract; `0194` in the lane) only after the Core release of this lane; a real production restore rehearsal of an encrypted daily backup.
- Appendix J targets need a release cycle of real data (E.2's 100% audit completeness for one cycle; E.1's zero discovery). Family-Panel adoption is reported as views over Tutors with a linked child: the counters store no ids, so distinct viewers are not measured.
- `coursegen/src/scripts/apply-image-map.ts` also patches documents; on a published lesson the guard now refuses it (by design). A documented demote-backfill-release flow for live lessons is the Forge phase's.
- The CI `social-db-verify` job has not run on GitHub yet (nothing is pushed).

### F1-data-platform-finish (lane finish)

- **Sync.** `codex/spec-migration-s02` was already an ancestor of the lane (base `d0c9a0f7`); the merge was a no-op, no conflicts.
- **Adversarial pass over the nine gaps.** Each was re-read against its clause: every new read or write is enforced at the server (the metrics route sits behind the `/analytics` `view_analytics` mount and its test refuses no session, a Tutor, a child, a teen, an adult and staff without the grant; the cooperative-goals practice is enforced inside `coop_goal_eligible`, so every path applies it; the live-document and catalog-delete guards are database triggers; dataintel's eligibility refuses every population but adults and the OD-26 exception in the strict create schema). The only rebuilt UI (three staff programme cards, one data-practice row) is data-driven through the existing rebuilt console and Family Hub, with copy in EN, es-MX and pt-BR. Nothing mandated was found missing.
- **Two test fixes found by the full suites.** (a) Lane regression: `frontend/src/rebuild/staff/console/usageShared.test.ts` read the last `check (event in (...))` in any migration as the `learning_events` CHECK, so the lane's `social_protection_counters_event_check` (0198 in the lane, now 0204) was taken for it. The parser now counts a match only when the nearest table or constraint named before it is `learning_events` / `learning_events_event_check`. (b) Clock bomb, not the lane's: `backend/src/__tests__/analytics.test.ts` "does not invent years of leading zeros for all-time" asserted fewer than 40 filled days from a fixed 2026-08-20 point while the window ends today, so it failed on every branch from 28 September 2026. The bound is now relative to the clock (days since the first point, and under a year), which still refuses a fill from the 2020 sentinel.
- **Final verification.** Type-check and lint green in backend, coursegen, dataintel, email-server and frontend. Full unit suites: email-server 7/7 files, dataintel 17/17, coursegen 56/56, backend 125 files green plus 1 skipped after fix (b) (the one red, rerun alone, was the clock bomb); frontend 246 of 248 files green, then `usageShared` green after fix (a). `assetGate.test.ts` timed out in every case, twice (once in the suite, once alone), with the machine at 100% CPU from other lanes; the gate it drives, `node scripts/check-rebuild-assets.mjs`, passes on this tree in 9 s, and the lane changes no asset, manifest or rebuilt glyph. The orchestrator's merge run should confirm it on a quiet machine. `database` `npm test`: `check-migrations`, `check-migration-phase`, `check-family-lifecycle` and the 48 node tests green; `railway-migrate.test.mjs` (fake transport, about 18 minutes alone) was still running after 70 minutes beside other lanes' copies; the lane does not change the transport. Root `check-schema-fields`, `backup-workflows`, `check-social-tiers` tests (31/31), `spec:check` and `secrets:check` green. The PostgreSQL evidence is the F1 section above.

**Lane summary.** All nine audited data-platform gaps are implemented and locally verified (migrations `0193`-`0198` in this worktree, renumbered to `0199`-`0204` at merge). None is accepted, released or deployed. Open: the owner steps and the three owner questions above, Appendix J targets that need a release cycle of real data, the first GitHub run of the `social-db-verify` job, a `db:types` regeneration when the shared stack is available (the types were hand-edited to drop `document_type`), and the Forge phase's demote-backfill-release flow for live lessons.

### Merge integration (F1-data-platform)

- Migrations renumbered by the orchestrator: the lane's `0193`-`0198` collided
  with F1-staff-ops' `0193`-`0196` and F1-identity-site's `0197`-`0198`, so they
  are now `0199_parent_verification_document_type_retire`,
  `0200_drop_parent_verification_document_type` (contract),
  `0201_live_lesson_document_guard`, `0202_cooperative_goals_data_practice`,
  `0203_legacy_catalog_delete_guard` and `0204_social_protection_metrics`
  (suffix references rewritten; all under 23,000 bytes, largest `0204` at
  21,687). No other lane redefines a function or trigger these create or
  replace; the coop-goal functions were last defined in `0189`/`0190`.
- Cross-lane defect fixed: F1-staff-ops' `verify-staff-ops-postgres.py`
  asserted that `identity_metrics` still reports `parent_verifications.document_type`
  as declared. On the merged chain `0200` drops the column, so the verifier
  now expects `{declared: false, consumed: false}` (the Schema Field
  Utilization check passes once the contract step is applied; between `0199`
  and `0200` it reports the field as declared and unconsumed, which is the
  truthful state).
- Cross-lane defect fixed (F1-staff-ops against F1-identity-site, already on
  the integration branch): `verify-staff-ops-postgres.py` wrote a pending
  `email_change` on a child after giving it the kid role, which
  `guard_kid_email` (`0197`) now refuses. The fixture writes the legacy
  pending address before the role, as it existed before the guard.
- Lane regressions fixed: `check-social-governance.test.mjs` (L-04) mutated
  `coop_goal_eligible` and `create_coop_goal` in `0189`/`0190`, but `0202`
  redefines both, so the gate read the unmutated copy; the test now mutates
  the latest definition. `backend/src/__tests__/dataPractices.test.ts`'s
  two-account pin found F1-identity-site's `age_correction_requests` (the
  account and the deciding staff member); it is exempted as a staff decision
  record that shares nothing between accounts.
- Cross-lane check: F1-identity-site's `decide_age_correction` (`0198`) is a
  SECURITY DEFINER function, so an approved correction is counted by `0204`'s
  age-boundary trigger as `age_change_function` (sanctioned), not `other`.
- Conflicts resolved as unions: the backup workflows keep F1-staff-ops' H.4
  heartbeat steps and the lane's H.5 encryption; the checkout is now a full
  checkout (the lane's sparse checkout of `database/migration-od9` would have
  dropped `scripts/ops-heartbeat.sh`), and the heartbeat's byte count is the
  encrypted file's. `package.json` keeps `staff-constraints:check` and adds
  `social:db-verify` and `schema-fields:check`; `spec:check` runs both
  `check-staff-standing-constraints.mjs` and `check-schema-fields.mjs`.
  `admin.ts` imports both the age-correction and social-protection services.
  REQUIREMENTS rows A.5 and E.4 carry both lanes' evidence.
- Checks on the merged tree: typecheck:all, lint:all, spec:check,
  secrets:check, the i18n gate, tools:test (374/374 after the L-04 fix), the
  backend, frontend (249/249 files), dataintel, email-server and coursegen
  unit suites (coursegen's `contentGatesSources` timed out once under the
  parallel load and passed alone), `database` npm test, and on a throwaway
  native PostgreSQL 17.6 cluster with all 204 migrations:
  `verify-data-platform`, `verify-social-protection`, `verify-coop-goals`,
  `verify-staff-ops`, `verify-age-correction` and `verify-kid-email-guard`.
