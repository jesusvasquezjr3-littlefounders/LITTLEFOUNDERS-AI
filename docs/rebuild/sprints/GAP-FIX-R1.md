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

## Learning (branch `codex/spec-fix1learning`)

Checkpoint F1-learning closes audited SPEC gaps in the v2 lesson engine, Forge and the learner surfaces. It lands in several local commits; each part below says what was built, where, what was verified and what remains.

### Part 1: general v2 player, first-release families, gradable visuals, Mentor voice

**Built (SPEC clauses):**

- **General ordered-segment player (OD-17, OD-24, B.7).** `frontend/src/rebuild/learning/LessonDocumentView.tsx` no longer hard-codes the bar-model, schema and CPA sequences: any mix of supported segments plays in order with progress across all of them, and M1 fading applies only to declared `representation_progressions`. Core (`backend/src/services/v2LessonDocument.ts`) relaxes the M7/M8 pilots to contiguous ordered chains inside a larger document (`contiguousChains`), mirrored in the browser.
- **Version-pinned completion for mixed and ungraded documents (OD-17).** Migration `0205_v2_mixed_lesson_completion.sql` adds `lesson_v2_segment_views` (RLS on, service role only), `record_v2_segment_view` and `complete_v2_mixed_lesson`: graded steps need met receipts, non-scored steps need view receipts, score is first-try accuracy over graded steps (100 when none). Core route `POST /learn/lessons/:id/v2-runs/:runId/views` (refuses graded or unknown steps and stray fields); `/v2-runs` now pins a run for lessons with no graded step and restores `viewed_segment_ids`; `/complete` uses the mixed function. `LessonRoute.tsx` starts a run for every v2 lesson, records a view before leaving a non-scored step, and keeps the learner on the step when Core does not record it.
- **First-release logic and money visuals (B.7 part 3, Appendix P Part 8).** Fifteen new v2 kinds, canonical in `backend/src/services/v2SegmentFamilies.ts` and generated byte-for-byte to `frontend/src/rebuild/learning/v2SegmentFamilies.generated.ts` (`agent/tools/sync-v2-segment-families.mjs`, now in `spec:check`): `logic.rule-checker.v2` (L1), `logic.euler.v2` (L5), `logic.flowchart.v2` (L6), `money.spend-decision.v2` ($9), `logic.sort-by-rule.v2` (L10) and `money.needs-wants.v2` ($10) with an "it depends" bin, `logic.scam-spotter.v2` (L12) and `money.scam-check.v2` ($11), `money.coin-tray.v2` ($1), `money.making-change.v2` ($2). Payloads are answerless; rubrics are private. Scorers in `v2VisualScorer.ts` (regenerated for the browser): flipped-card set; region placement with impossible regions refused per relation; path and outcome per scenario with impossible walks refused; (bin, reason) pairs; hits, false alarms and d′ with genuine messages required in the set; integer minor units with tray conservation, fewest-pieces and the change conservation check. Boards in `familyBoards.tsx` follow the Bible 05 anatomy through `segmentKit.tsx` (`BoardShell`) with tap and keyboard paths and a "Move to" choice for regions and bins.
- **Formerly ungraded visuals are gradable (Appendix P Parts 1, 4.2, 7; B.7 server-side verification).** `grading` is `'server' | 'none'` for M5, M14, M15, M19, M20, L2, goal bullet and running ledger in all three copies, with private rubrics and scorers: M5 trades and digits, M14 pair and missing value, M15 snapped percent and amount, M19 committed prediction within tolerance, M20 tax owed and marginal rate, L2 learner-built rule compiled and run on held-out cases (a key that is constant on its cases is refused), ledger conservation. Each board hides the computed answer while graded and grades through one generic `onGradeAny` wiring in `LessonRoute.tsx`.
- **Story and Mentor voice in v2 (B.8, B.9, B.11, B.18; OD-24).** `story.branch.v2`, `story.dialogue-choice.v2`, `story.would-you-rather.v2` (Core-graded choice ids) and the Mentor-voiced `voice.mentor-turn.v2` (intro, transition, wrap) and `voice.mentor-episode.v2` (setup, misjudgment, recovery), each with an optional narration channel (`text_only` or `differentiated` plus script and audio reference). The Mentor kinds are named `voice.*` rather than `mentor.*` because `mentor.<x>.<y>` is the asset-id namespace the asset check enforces. Core journals graded v2 story choices (`extractV2Decisions`, `recordV2GradedDecisions`, through `record_learner_decisions`). Forge: gate 11 now runs on v2 (`checkV2Narration`: a differentiated script must not repeat its plate; a plate longer than a caption must not duplicate the script); gate 15 passes a flagged plan staged by a `voice.mentor-episode.v2` segment and blocks one staged nowhere. Two new fixture plans (`22-v2-first-release-mixed.json`, `23-v2-first-release-logic.json`) cover every kind; `forge-v2:check` validates all 69 emitted rows.
- **Mentor prompt label, help on request, adventure scene (B.8, Bible 08 §11, Bible 05 §3, Appendix A Part 2).** `SegmentPrompt` renders "{Mentor} asks" with the avatar above every board's prompt (all 21 existing boards and the new ones) whenever Core projected a stage. An optional per-segment `help` (up to two ladder steps) is shown on request as one speech-plate turn each; steps used are sent as `hints_used` (0–2, refused above 2, clamped to the segment's ladder) and stored in the receipt; `complete_v2_mixed_lesson` totals them. Core projects `adventure_theme` (closed enum of the six 0007 themes) beside `mentor_stage`; `LessonStageSlot` draws `scene.<theme>.art` as the stage band, never inside the board.
- **Receipt signals (Appendix P Part 4.5, Appendix C 1.1).** Optional `item_role` and `knowledge_component_id` per segment (the KC must be one of the document's). Scorers return a closed diagnostic code (`gradeV2Response`); Core stores `diagnostic`, `hints_used`, `item_role`, `kc` and the detection counts in the receipt verdict, pinned by a CHECK constraint in 0205. The client verdict carries only score, correctness, judgment and a non-`none` diagnostic, which words the "not yet" line (structure versus numbers).
- **Locale numbers (Appendix P Part 5, Bible 05 §5), partial.** `parseLocaleNumber` (en-US, es-MX, pt-BR) and exact rational comparison `sameAnswer` live in the canonical scorer; the worked-example scorer now compares values, so pt-BR "12,5" and en "12.50" meet a "12.5" rubric. `NumberAnswer` echoes the parsed value before Check on every new typed answer.
- **B.4 update-required screen.** An unparseable newer document or a segment this build cannot render shows "Update the app" with a primary Reload (clears Cache Storage, reloads with a cache-busting query) and Back second; "cannot open" stays a separate screen. Copy in three locales in `rebuild-learn.json` → `player`, budgeted in `copy-budget/learn.test.ts`.

**Verified locally:** backend `type-check`, `lint`; Vitest `v2ScorerExtended.test.ts` (18), `learnV2Mixed.test.ts` (3: theme projection, view receipts, refused graded/unknown views, hint bound, journal write, resume, visual-only completion, unknown KC refused), `learn.test.ts` (80), `v2LessonDocument.test.ts`, `forgeV2Emitted.test.ts`, `v2VisualScorer.test.ts`. Coursegen `type-check`, `lint`, `v2Emit.test.ts` (23), `v2:emit --write-fixture`; backend `forge-v2:check` (69 rows). Frontend `type-check`, `lint`, `generalPlayer.test.tsx` (7), `LessonDocumentView.test.tsx` (37), `lessonDocument.test.ts`, `LessonResultView.test.tsx`, `copy-budget/learn.test.ts`, `LessonRoute.test.tsx` (51). Root `spec:check`, `secrets:check`, i18n gate. The 0205 SQL was not yet run on native PostgreSQL in this part.

**Remains (this checkpoint):** worked-example board locale echo, long multiplication/division renderers and mastery-driven fade (item 9); SQL metrics and panel for transfer, structure-versus-answer, first unaided stage and d′ (item 11); KC evidence from course lessons (item 8); v2 narrative evidence (item 12); streak strip (item 16); home and profile Mentor slots (item 15 parts 1–2); Wallet split reuse (item 14); Forge interactive-behaviour gate (item 10); publication transaction and v2 authoring/write stages (item 17); glossary injection (item 19); chart set and situational gate table (item 2); operation primitives and concept boards (item 3). Browser matrices, device acceptance and owner review are the orchestrator's merge gates.

### Part 2: KC evidence, v2 narrative, signal metrics, worked examples, glossary, streak strip, Mentor slots

**Built (SPEC clauses):**

- **Course lessons feed the Mentor's mastery (owner review P-09, B.6).** Migration `0206_course_lesson_kc_evidence.sql` widens `kc_attempt.source` with `'course_lesson'`, adds `receipt_key` (required for that source, unique per learner). `backend/src/services/pedagogy/courseLessonEvidence.ts` records each v2 grade (keyed by its one-use nonce) and each graded v1 completion (keyed by its run) on the topic's primary KC through the Mentor's own `recordAttempt` (BKT update, FSRS card, evidence row); a replayed receipt never moves mastery twice. `database/types/database.ts` is not regenerated in this lane (it needs the shared Docker database): the orchestrator regenerates it at merge.
- **v2 evidence in the guardian narrative (B.10, OD-24).** `readKidV2Attempts` reads the receipts of the child's completed v2 runs server-side; they feed the same `struggle` and `usedHint` fields, and a new top-level `evidence` list carries the first-try share and the B.12 judgment counts per shown lesson (the strictly validated entry shape is unchanged). Never an answer or a rubric.
- **Transfer, error split, first unaided stage and d′ (Appendix C 1.1, Appendix P Parts 4.5 and 8).** Migration `0207_v2_learning_signal_metrics.sql` adds four service-role functions over first tries. `loadV2LearningSignals` puts them in the staff learning-quality report (`v2Signals`, null until 0207 is applied) and `LearningQualityPanel` shows them in three locales. `learning.transfer_success` in the Mentor quality registry is now instrumented (practice and transfer per KC).
- **Worked examples (Appendix P Part 1 M9–M10, Part 5, Bible 05 §5).** The board parses each typed value for the lesson's locale, echoes it ("Reads as ...") and submits the canonical value. An optional `algorithm` (long division or long multiplication as `{digit, product, remainder}` steps, checked against the standard algorithm on both sides) renders in the market's layout: US bracket, MX casita (remainders only), BR chave (`LongArithmeticLayout.tsx`). Core sets each delivered worked example's `fade_count` from the learner's mastery of the topic's primary KC (`masteryFadeCount`, `applyMasteryFade`); a failed mastery read keeps the authored fade. KaTeX is not added: the lane may not install dependencies (owner/orchestrator question below); each step keeps its `spokenText`.
- **Controlled glossary in Forge (OD-11, owner log §5).** `coursegen/src/contentGates/glossary.ts` holds the §5 table as data (a test compares it with the owner log row for row), injects the target market's terms and never-use list into `translationSystemPrompt`, and re-gates translated lessons through `LocalizeContentGateError` (gate 12) on never-use terms: the AI as a Tutor, bot or assistant; a streak freeze; a chore as a job; the Wallet as a digital bank. Quoted or negated uses go to review, like the tone gate. The same scan runs on v2 learner-visible strings in `v2/gates.ts`.
- **Weekly streak strip (Bible 02 §9.6 rules 4-6, §4.4 item 2, Bible 04 §4.3).** Migration `0208_learning_practice_days.sql` records each practised local day from `learning_stats.last_active_date` (trigger; RLS on, service role only; 400-day retention trimmed by the trigger plus an operator sweep). Core's `streakWeek` builds the current week (practised, rest, paused, open, today) and `/learn/rhythm` (and the guardian's shared loader) returns it as `streak.week`. `StreakStrip.tsx`: seven dots, shape plus glyph plus word per state, a 3 px primary-strong ring on today, a one-time wave entrance that reduced motion removes, no celebration. Mounted in the rhythm page, the learner home streak card and the own profile.
- **One Save/Spend/Share interaction (Bible 05 §7 Money row).** `rebuild/family/PocketSplit.tsx` is the Wallet's pocket rows (hue swatch, name, shared Stepper or typed count with −/+, remaining line) extracted from `SplitChooser.tsx` and `UsualSplit.tsx`; both Wallet surfaces and the lesson `AllocationBoard.tsx` now render it, while `allocationModel.ts` keeps the lesson's grading and checkpoints. `PocketSplit.test.tsx` pins all three to the shared component.
- **The chosen Mentor fills its slots (Bible 08 §8, §11; 02 §9.7).** Learner home: a Mentor card with the real render, the name and "Ask {name}" to `/tutor`. Own profile: a Mentor row with the render, the name and "Change", which opens `/tutor?sheet=chooser` (the Mentor screen now honours that sheet on its real route). The v2 prompt label shipped in part 1.

**Verified locally:** backend `type-check`, `lint`; Vitest `learnV2Mixed.test.ts` (4, incl. P-09 idempotent evidence), `v2WorkedExampleMastery.test.ts` (4), `learningSignalsV2.test.ts` (3), `habitStreakWeek.test.ts` (2), `courseNarrative.test.ts`, `learnNarrative.test.ts`, `mentorQuality.test.ts`, `learningQualityS053d.test.ts`, `motivationS053e.test.ts`, `learn.test.ts`. Native PostgreSQL 17.6 (lane cluster, port 15730): `database/scripts/verify-v2-learning-postgres.py` applies all 196 migrations and passes 14 checks (view receipts, mixed and visual-only completion, receipt CHECKs, practice-day trigger, course-lesson evidence keys, metric functions, browser-role refusals). Coursegen `type-check`, `lint`, `glossary.test.ts`, `localize.test.ts`, `v2Emit.test.ts`. Frontend `type-check`, `lint`, `longArithmetic.test.tsx`, `StreakStrip.test.tsx`, `PocketSplit.test.tsx` with the family and Wallet tests, learn and profile Copy Budget tests, `LearnHomeView`, `LearningRhythmView`, `LearningQualityPanel`, own-profile route and Mentor screen tests.

**Remains:** item 2 (chart set and situational gate table), item 3 (eight primitives and the concept boards), item 10 (Forge interactive-behaviour gate), item 17 (publication transaction and v2 authoring/write stages). KaTeX needs an approved dependency. `database/types/database.ts` regeneration at merge.

### Part 3: Forge interactive-behaviour gate, reviewed v2 publication, v2 authoring and write stages

**Built (SPEC clauses):**

- **Interactive-behaviour gate (B.7 "deterministic gates across the full interactive input range", Appendix C 1.3).** `backend/src/services/forgeV2Behaviour.ts` enumerates every server-graded segment's permitted input space from its payload bounds (grids, parts, ranges, option sets, denominations, flowchart paths), or samples it densely (capped), and scores every state through `gradeV2Visual`, the path Core grades with. It blocks an unreachable target, a trivially met rubric (story choices may accept every option), a met set that differs from a rubric's accepted answers, a permitted state that throws or is refused, an off-grid or conservation-breaking state that is not refused, and an initial board state that is already met. `forge-v2:check` runs it on every emitted row and prints the per-gate pass rate (committed fixture: 90 of 90 graded segments, 7,692 states).
- **Reviewed v2 publication (0101 header, 0113 guard; OD-17, OD-24).** Migration `0209_v2_reviewed_publication.sql` adds `publish_v2_lesson_version(lesson, locale, version_id, document, answer_keys, release_manifest)`: SECURITY DEFINER (the one identity the 0113 guard lets through), executable only by the service role (Forge's release credential). One transaction checks the document identity, requires a manifest attesting that document (gate 1 and gates 11-16 plus the v2 content gate, Core's contract and behaviour checks), requires a current course verification for a published lesson (0112's refusal), inserts the immutable version (never a reused id), moves the pointer and writes an audit row with digests.
- **Forge v2 authoring stage (OD-17, OD-23).** `coursegen/src/v2/author.ts` and `npm run v2:author`: Stage 1 copy for a Stage 0 skeleton through DeepSeek, with the glossary, tone and budget rules, emitted and gated, with two corrective rounds. A paid run needs `--max-usd` (`spendCeilingRefusal`) and runs under the usage ledger; `--dry-run` uses a fixture responder (zero model calls, tested with `fetch` stubbed to throw).
- **Forge v2 write/publish stage with per-market answer keys (F-06/B.16).** `coursegen/src/v2/release.ts` and `npm run v2:publish`: emit, v2 gates, Core `forge-v2:check`, `verify:course`, then `publish_v2_lesson_version` per market; `--dry-run` stops after the Core check and writes the calls. Plans may give `rubric_by_locale`, so each market's answer keys come from its own scenario. Owner runbook: `docs/content/FORGE-V2-RELEASE.md`.

**Verified locally:** backend `forgeV2Behaviour.test.ts` (4) and `forge-v2:check` (69 rows, 90/90 segments); coursegen `v2Release.test.ts` (5), `v2Emit.test.ts`, `type-check`, `lint`, and the two CLIs in dry-run mode end to end (author: 0 model calls; publish: 3 documents, Core check spawned, 3 calls written). Native PostgreSQL 17.6: `verify-v2-learning-postgres.py` now applies 197 migrations and passes 17 checks, including a refused direct pointer move on a published lesson, refusals for a stale course verification, a missing gate and an unattested behaviour gate, a successful publication that moves the pointer and audits, and a refused reuse of a version id.

**Remains:** items 2 (chart set, situational gate table) and 3 (eight primitives, nine concept boards).

### Part 4: Core chart set and the situational gate table

**Built (SPEC clauses):**

- **Core chart set (Appendix A Part 1, Bible 05 V1/V6).** `backend/src/services/v2ChartModel.ts` is the canonical chart model (browser copy `frontend/src/rebuild/learning/charts/chartModel.generated.ts`, kept byte-identical by `agent/tools/sync-v2-chart-model.mjs` in `spec:check`): 25 Core kinds (bar family, waterfall, pie and donut, waffle, pictogram, stat tile, bullet, radar, line family, sparkline, area, calendar heatmap, scatter, bubble, Sankey, flowchart, decision tree, tree) plus 8 situational kinds. `chartProblem` refuses data a kind cannot honestly draw (pie 2-6 parts, waffle totals 100, whole pictogram icons, Sankey conservation, a tree with one root and one parent per node, and so on). `TeachingChart.tsx` draws every kind in-house from tokens, carries series by hue plus a pattern, shortens long labels only in the drawing, names each chart as one image with a text description, and offers "Show as table" (three locales).
- **Situational gate table (Appendix A Part 1).** `SITUATIONAL_CHART_GATES` records the minimum age band and subject for each situational kind; Core refuses a lesson that uses one outside its gate at delivery (`visual.chart.v2` superRefine). Kinds the table lists without a first-release renderer (marimekko, treemap, sunburst, icicle, box plot, strip plot, connected scatter, candlestick, bump, org chart, funnel, swimlane, fishbone, mind map) are not in the contract, so no lesson can ship them.
- **`visual.chart.v2` segment in Core, browser and Forge.** Capabilities `operation.show-table.v1` and `visual.<kind>.v1` (plus choose-option when the chart asks a question); an optional graded question is scored on the server (`acceptable_choice_ids`) and passes the behaviour gate. Forge plan `24-v2-teaching-charts.json` (13-17: Sankey, graded waterfall, step, calendar heatmap, stat tile); `forge-v2:check` 72 rows, 93/93 graded segments.

**Verified locally:** backend `type-check`, `lint`, `v2ChartModel.test.ts`, `v2LessonDocument.test.ts`, `v2ScorerExtended.test.ts`, `forgeV2Emitted.test.ts`; frontend `type-check`, `lint`, `charts/TeachingChart.test.tsx` (35: every kind as a named, described image and a table; pattern and label rules; Copy Budget in three locales); coursegen `type-check`, `lint`, `v2Emit.test.ts`, `v2Release.test.ts`; root `spec:check`, `secrets:check`, i18n gate.

**Remains:** item 3 (eight primitives, the concept boards). No browser matrix was run for the charts (speed mode): visual review in light and dark is pending.

### Part 5: the eight missing interaction primitives and the concept boards

**Built (SPEC clauses):**

- **Interaction primitives (Appendix A Part 2, patterns 5, 7, 8, 10, 11, 12, 14, 15).** `frontend/src/rebuild/learning/operations/operations.tsx` adds `operation.what-if-branch.v1` (every branch simulated and shown side by side), `operation.before-after.v1` (one switch, two states), `operation.guided-sandbox.v1` (a light goal and cues earned by exploring), `operation.threshold-marker.v1` (the flag appears exactly where a series first reaches the line), `operation.trade-off-chooser.v1` (discrete tokens, what was given up stays visible), `operation.curve-shift.v1`, `operation.reactive-text.v1` (numbers in a sentence are controls) and `operation.ghost-trace.v1` (the previous run ghosted under the current one), plus the `operation.drag-point.v1` they share (pointer drag or arrow keys on the grid). Pure helpers live in `operationsModel.ts`. Each primitive is built from the shared controls, has a tap and keyboard path, says what changed in a live region, animates only under `prefers-reduced-motion: no-preference`, and owns no words.
- **Concept boards (Appendix A Part 3).** `backend/src/services/v2ConceptBoards.ts` is the canonical model, contract and scorer (browser copy `v2ConceptBoards.generated.ts`, kept byte-identical by `agent/tools/sync-v2-concept-boards.mjs` in `spec:check`): `money.amortization.v2` (step-by-step scrub), `econ.supply-demand.v2` (drag point plus curve shift, live equilibrium), `money.opportunity-cost.v2` (token chooser, explored), `money.inflation.v2` (sliders, near/far view, today versus later, reactive sentence), `money.rule-of-72.v2` (slider plus threshold marker), `money.debt-payoff.v2` (snowball versus avalanche what-if with ghost trace), `money.diversification.v2` (reallocation that always totals 100% with a dependent risk/return point) and `money.lemonade-stand.v2` (guided sandbox, running ledger and a sales-to-profit waterfall). Marginal tax gains its Sankey on the existing tax-bracket board (income into each bracket, then into tax and take-home). The boards are in Core, the browser and Forge (capability parity gate), open by age as Part 3 says (teens; opportunity cost and the lemonade stand in every tier), and seven of them are server-graded with private rubrics and closed diagnostics. A graded board hides the value it asks the learner to predict until Core has met the answer.
- **Forge and the behaviour gate.** Plan `25-v2-concept-boards.json` (13-17, all eight boards, three markets); the interactive-behaviour gate enumerates each concept board's permitted input space. `forge-v2:check`: 75 rows, 114 of 114 graded segments pass (47,901 states).

**Verified locally:** backend `type-check`, `lint`, `v2ConceptBoards.test.ts` (9: models, grading and diagnostics per board, malformed refusals, age gate, behaviour gate and a trivially met rubric), `forgeV2Emitted.test.ts` (46 kinds), the other v2, Forge and learn route tests (143); frontend `type-check`, `lint`, `operations/operations.test.tsx` (9), `conceptBoards.test.tsx` (11: each board plays in the general player, sends only integers and ids, hides predictions until met; the tax Sankey conserves; Copy Budget in three locales), and every learning and copy-budget test (365); coursegen `type-check`, `lint`, `v2Emit.test.ts`, `v2Release.test.ts`, `glossary.test.ts`; root `spec:check`, `secrets:check`, i18n gate.

**Remains:** no browser matrix or visual review was run for the primitives and concept boards (speed mode): a light/dark and phone-width screenshot pass is pending. The concept-board age gate follows Appendix A Part 3's tiers; a 10-12 variant of any board is an owner/content decision.

### Part 6: lane finish (checkpoint F1-learning-finish)

**Sync.** `codex/spec-migration-s02` had not moved since the lane branched (`d0c9a0f7`); the merge was a no-op.

**Adversarial pass, built now:**

- **Evidence in the Family console (B.10 for v2).** Core already sent the per-lesson `evidence` list; the rebuilt `LearningNarrative.tsx` now shows it on each lesson card: "Right on the first try: 3 of 4." and, when reasoning was judged, "Explained their thinking well: 1 of 2." (three locales, adult Copy Budget). `familyLearning.ts` keeps evidence only for the page's lessons and refuses a count above its total, judgment counts that do not add up, or any extra field.
- **Practice-day retention is scheduled (Bible 02 §9.6, 400-day window).** `POST /api/v1/internal/learning-retention/run` (internal key only; a failed or malformed database answer is a 502, never zero; the body takes no options) runs `sweep_learning_practice_days`; `.github/workflows/learning-retention.yml` calls it daily through the same in-container transport as the social-retention sweep.
- **Shared controls only (02 rule 23, S03.6).** The full frontend suite found local toggles and a raw button in the lane's boards. The rule cards and the trade-off tokens are now the shared `ChoiceChip`; the scam/not-scam pair and every "Move to" choice are the shared `SegmentedControl` (radio semantics); the chart's "Show as table" is a plain labelled button. Twenty lane classes that had no stylesheet definition are now defined, the coin tray renders its two denomination classes literally, the dead rule-card styles and copy are gone, and `PocketSplit` declares its register policy (neutral: callers pass each count's written value).
- **Mentor governance (C.22).** `courseLessonEvidence.ts` is classified under `mentor.runtime`; the lane's Tier 1 changes (`kcData.ts` course-lesson source, `mentorQuality.ts` transfer metric, the registry) have change-record rows with sign-offs pending.
- **Outside the lane:** `backend/src/__tests__/analytics.test.ts` used a fixed date that turned red 40 days later; it now uses a date relative to today.

**Verified locally:** backend, frontend and coursegen `type-check` and `lint`; full unit suites once: backend 3,118 of 3,119 on the first run (the date-bound analytics test, fixed and rerun green) plus the new `learningRetention.test.ts` (3); frontend 2,927/2,927 after the fixes; coursegen 814/814. Root `spec:check`, `secrets:check`, i18n gate, `tools:test` 350/350 and `governance:check`.

## Learning lane: final summary

**Built (19 audited gaps):** first-release logic and money visuals; the Core chart set with the situational gate table; eight interaction primitives and eight concept boards plus the tax Sankey; server grading for every formerly ungraded visual with closed diagnostics; the general ordered-segment player with version-pinned mixed completion (0205); story and Mentor-voice segments with the narration channel and Forge gates 11 and 15; adventure scene band, "{Mentor} asks" label and two-step help; course-lesson KC evidence into the Mentor's mastery (0206); locale numbers, long-arithmetic layouts and mastery fade; the Forge interactive-behaviour gate; receipt signals and learning-signal metrics (0207); v2 evidence in the guardian narrative, now shown in the Family console; the update-required screen; one PocketSplit for the Wallet and the lesson board; Mentor slots on home and profile; the weekly streak strip (0208) with a scheduled retention sweep; reviewed v2 publication (0209) with Forge v2 authoring and publish stages; the controlled glossary in Forge.

**Migrations (renumbered at merge, see Merge integration):** `0205_v2_mixed_lesson_completion.sql`, `0206_course_lesson_kc_evidence.sql`, `0207_v2_learning_signal_metrics.sql`, `0208_learning_practice_days.sql`, `0209_v2_reviewed_publication.sql`. Proven on native PostgreSQL 17.6 (17 checks); not on the shared Docker stack.

**Open:** light/dark and phone-width visual review of the charts, primitives, concept boards and the boards moved to shared controls (no browser matrix in speed mode); `database/types/database.ts` regeneration for 0205-0209 at merge; KaTeX needs an approved dependency; situational chart kinds without a first-release renderer stay out of the contract; ungraded story views do not journal; the three Tier 1 change-record rows need both leads' signatures before release; `learning-retention.yml` has not run against a deployed stack.

**Owner questions (conservative defaults implemented):** approve KaTeX as a frontend dependency, or keep `spokenText` plus the long-arithmetic layouts; whether any concept board gets a 10-12 variant (today Appendix A Part 3's tiers); whether ungraded story views should enter the decision journal (today only graded choices do).

### Merge integration (learning)

- Migrations renumbered by the orchestrator: the lane's `0193`-`0197`
  collided with F1-staff-ops, F1-identity-site and F1-data-platform
  (`0193`-`0204` on the integration branch), so they are now
  `0205_v2_mixed_lesson_completion`, `0206_course_lesson_kc_evidence`,
  `0207_v2_learning_signal_metrics`, `0208_learning_practice_days` and
  `0209_v2_reviewed_publication` (suffix references and bare number mentions
  in the lane's code, docs and REQUIREMENTS rows B.6, B.7 and B.21 rewritten;
  all under 23,000 bytes, largest `0205` at 10,353). No other lane redefines a
  function, trigger or table these create or alter.
- Lane defect fixed: `0206` (drops and re-adds `kc_attempt_source_check`) and
  `0208` (DELETE inside the trim trigger and the sweep function) declared
  `@phase: expand`, which the migration-phase gate refuses. Both are now
  `contract` with an `@after-release` line that states why applying them
  removes nothing a running Core uses, following the `0118`/`0122`/`0191`
  pattern.
- Cross-lane union (F1-staff-ops, C.24): `mentorQuality.ts` keeps the lane's
  instrumented `learning.transfer_success` and staff-ops' instrumented
  `learning.judgment_quality`, `learning.bridge_conversion` and
  `learning.decision_journal`; the lane's `transfer` source moved from the
  staff-ops `LearningSignalSources` interface (where the textual merge put it)
  to `QualitySources`. `evaluationLoop.ts` reads both `collectLearningSignals`
  and `learning_transfer_success`. `learningSignalsV2.test.ts` builds its
  source set with the staff-ops `learning` block, without which the evaluator
  threw.
- `app.ts` mounts both `/api/v1/internal/ops` (F1-staff-ops) and
  `/api/v1/internal/learning-retention` (this lane); `spec:check` keeps
  staff-ops' `check-staff-standing-constraints` and data-platform's
  `check-schema-fields` beside the lane's three new sync checks. The
  analytics date-drift fix keeps the integration branch's pinned-clock
  version (both sides fixed the same test).
- Mentor governance: the merged tree changes the hash of
  `mentor.non_negotiables` and `measurement.stage7_and_thresholds` again, so
  two merge change-record rows were recorded (sign-offs pending, as for the
  lane's rows).
- Still open from the lane: `database/types/database.ts` is not regenerated
  for `0205`-`0209` (needs the shared Docker database); visual review.
## Mentor lane

Branch `codex/spec-fix1mentor`, checkpoint F1-mentor. Binding sources: product C.8, C.12, C.13, C.24, B.7; OD-6, OD-13; Frontend Bible 05 §2, 06, 07 §4, 08 §2, §8, §10.

### F1-mentor part A: the Mentor runtime and its measurements

What was built:

- **OD-6, glossary (item 7).** The live system prompt now opens "You are the learner's Mentor, one of the LittleFounders characters." It tells the model to call itself by its character name or "your Mentor", never a tutor, teacher-bot, bot or assistant, and that "Tutor" is the learner's parent. The unknown-persona fallback is "a friendly Mentor character". `selfNamingViolation` (prompt.ts, beside `TIER_FORBIDDEN`) catches self-naming in the three locales ("I'm your tutor", "soy tu tutor", "sou seu tutor", "I'm just a bot", "soy un asistente"). It only catches the Mentor naming itself, so "ask your tutor to approve it" and "the shop assistant" in a story pass. A hit is a shape failure with one retry. A survival is delivered, counted and flagged.
- **OD-13, Copy Budget (item 8).** The prompt asks for "1-2 short sentences, at most 20 words (12 for ages 6-9), and at most one question", and the length section states the same budget. `mentorTurnBudget(say, tier, locale)` mirrors `frontend/src/rebuild/design/copyBudget.ts`: same word regex, same sentence rule (honorifics and decimals are not boundaries), ×1.25 for es-MX and pt-BR, and 12 words for tiers 1 and 2 (ages 6-9). An overflow gets one retry that names the limit. It is the lowest-priority repair: when a higher fault takes the retry, that correction carries the budget too. A survival is delivered, counted and flagged (the M-13 pattern).
- **C.8/C.12 (item 2).** Spoken (`voice_result`) and verified conversational answers now pass C.9's onset-based reply latency to `observeGraded()`, with their channel. `SessionEndSignal` keeps one latency baseline per channel (typed, spoken, activity). Each baseline holds the first four latencies of its own channel, and a window's SD of ln(latency) is only compared with the baseline of the same channel. Older snapshots restore, defaulting to the activity channel.
- **C.24 and the tell invariant (item 5).** The C.24 dashboard now reads the sources that already existed: B.28 session efficiency and Mentor resolution (the `engagementHealth.ts` RPCs, with their trend rule and direction; a regression is a breach), the B.9 decision journal and B.13 bridge conversion (`learning_narrative_metrics`), B.21 rest-day use (`learning_rest_day_utilization`) and B.24 autonomy adoption (`learning_autonomy_adoption`). An unreachable RPC fails closed as `unavailable`, with an urgent flag for engineering. For `rubric.tell_honored`, Oracle now counts, per session, the explicit "just tell me" requests, the answer turns that carried the tell rung, and the requests that were withdrawn (the learner cut in, or a safety response replaced the turn). These counts are stored on `tutor_dialogue_calibration` (migration `0210_mentor_tell_budget_self_naming_counts.sql`, which also stores the budget and self-naming counts). Rubric v2 rule-scores `tell_honored` as a hard invariant, and the judge still scores it too.

What still says `not_instrumented`, and why: `learning.transfer_success` (B.7/B.12 tagging), `learning.judgment_quality` (B.12; the existing `learning_judgment_differentiation` checks the signal's validity, not judgment quality), `engagement.streak_anxiety` (no streak-at-risk notification exists), the B.25, B.22 and B.20 audits (manual), and `engagement.parent_time_to_value` (no client timing).

Tier 1 change control: rows were recorded in `docs/rebuild/mentor/governance/tier1-change-record.json` for evaluation.rubric_and_judges, evaluation.stage2_and_bias_audit, mentor.non_negotiables, mentor.monetization_adjacent and measurement.stage7_and_thresholds. Both leads' sign-offs are pending. The rubric change record has a v2 row (EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md §2.2). The bias-audit log records a material change for `session_end.stop_reply`: the file changed, and its classifier did not. The threshold rows are dated 2026-09-27 in THRESHOLD-RECALIBRATION-LOG.md.

Deploy order (for later): Core before Oracle. The close body is strict. The new report fields are optional in Core, so an older Oracle still closes, but a newer Oracle needs a Core that knows the new fields.

Verified locally:

- Oracle: type-check and lint are clean. The full Oracle suite is green after the fixture updates: 1725 tests, with the 5 reds all fixed. The new file `mentorNamingAndBudget.test.ts` covers self-naming in both directions, the budget limits and the parity test that reads the frontend `copyBudget.ts`. `orchestrator.test.ts` has new OD-13, OD-6 and C.13 blocks: retry, survival with counting, and the one-question rule. The budget repair is switched off by default in the rest of that file, whose older fixtures pin other checks. `sessionEndSignal.test.ts` and `sessionEndGym.test.ts` cover the new personas plus two red proofs (latency dropped, channels mixed).
- Core: type-check and lint are clean. mentorQuality, the routes, transcriptEvaluation, spacedReviewCalibration, judgeCalibration and the tutor routes are green (539 + 89 + 40 tests across the runs).
- Gates: session-end:check (extended, with 10 node tests), review-calibration:check, evaluation-loop:check, telemetry:check, honesty:check, alliance:check, governance:check, spec:check and secrets:check.
- PostgreSQL 17.6 (owned cluster, port 15740): `database/scripts/verify-mentor-counts-postgres.py` applies all 193 migrations. It then checks that a legacy row keeps NULL counts, that bad counts and more tell answers than requests are refused, and that RLS still closes the table to browser roles.

Remaining for part A: `database/types/database.ts` is not regenerated (`db:types` needs the shared stack). The budget will spend a retry on many child turns, so its live cost and hit rate are unmeasured (OD-23 zero spend: no live run).

### F1-mentor part B: the board, one component set, and the chooser

What was built:

- **B.7 and Bible 05 §2 hue rules (items 1 and 3).** A shared Pizarrón visual library lives in `frontend/src/rebuild/learning/pizarron/` (`visuals.tsx`, `pizarron.css`, `index.ts` with `PIZARRON_VISUALS`). Every visual is presentation only: it draws the numbers and words it is given, and scaling a length to the board is its only computation. The lesson boards now draw with it: BarModelBoard uses the tape, FractionAreaBoard and FractionNumberLineBoard use the area model, and RatioTableBoard uses the ratio lines, with its drag handle passed as an overlay. The Mentor board (`mentor/screen/MentorBoard.tsx`) no longer has generic bars. `boardVisuals.tsx` maps each of the 45 Oracle kinds to the visual for its concept (`BOARD_RENDERERS`), for example open_number_line, marked_line and timeline to the number line; bar_model, part_whole, equation_bar, receipt, budget_plate and change to the tape; table to ratio lines; ledger to the running ledger; worked and cycle to worked steps; sequence, sequence_compare, whatif and your_turn to growth lines; categories to the allocation waffle; tokens and regroup to reward coins. The visuals added for kinds that had no lesson board are the ten frame, balance scale, Venn, array, tally, bead string and pictograph. Each board takes Oracle's server values read-only. The table view is still one press away. A your-turn board never writes a value the learner has not reached, in the picture, on the axis or in the description. `boardModel.ts` tones are now `sky | mint | berry | overflow`. Primary and accent are gone from the tones and from the CSS, and the old `lf-mentor-board-bar-*` rules were deleted. The whiteboard parity gate (`instruments:check`) now fails when a wire kind has no shared visual, or when it maps to something that is not a shared visual. One Copy Budget word was added for the unit-price board's quantity line: `mentorScreen.board.words.units` (Units / Unidades / Unidades). The dark-pattern gate now accepts the manifest key `ranking: '…Visual'`. It is the same money-item instrument as `kind: 'ranking'`, and it ranks no person.
- **Bible 08 §8 and 07 §4 (item 6).** One shared `MentorChooser` (`frontend/src/rebuild/mentor/MentorChooser.tsx`) shows the four characters standing on their Diorama (`mentor.chooserStill`), each with a name and a line of at most six words. The avatar render is used only when no Diorama still is registered. The onboarding 'mentor' step and the Mentor screen's chooser sheet both use it. Onboarding keeps its saving state (the rows stay buttons, and a press during a save does nothing), its chosen pill and its skip. The audit states gained `onboarding@mentor-saving`, and the preview takes `?saving=`.

Verified locally: frontend type-check and lint are clean. Vitest is green for rebuild/mentor, rebuild/learning, recomposition and identity. The new `boardVisuals.test.tsx` covers all kinds in three locales, copy roles, series-only fill classes, server values written as given, the table view and hidden your-turn values. `identity.test.tsx` checks that onboarding shows chooser stills and no bust avatars, and pins the saving and skip states. Gates: instruments:check (with 16 node tests), the dark-pattern tests, the i18n gate, spec:check and secrets:check. I looked at headless captures of 12 kinds (light at 1280, dark at 375). That look found and fixed uncoloured waffle and icon cells, squashed number-line points, and end labels running off the board.

Remaining for part B: the lesson boards for growth comparison, allocation, tax brackets, percent grid, place value, worked examples and the running ledger still draw their own inline pictures. Their interactive layers (predictions, sliders, fading) were not moved onto the shared visuals in this round. The board-specific audits listed in 05 §8 (no reserved hue as a series, contrast of marks) are not machine-verified yet.

### F1-mentor part C: nothing covers the Mentor's face or hands (Bible 08 §2, §10 item 3)

The gap is real, and it was measured before anything was fixed. `verify:placement` gained a stage-occlusion check. It found Dr. Rho's left hand occluded on diorama-a (close-up, phone), and Dina's right paw occluded on diorama-a (wide close-up, phone). On diorama-b it found Dina's head and paws occluded in eleven shot/viewport combinations, which is the leaf across her face.

What was built:

- **The rule.** `frontend/src/tutor-scene/occlusion.ts` (pure) projects each character's head and both hands (Dina's front paws) from every Mentor-stage camera: close-up and wide close-up, each seen from a 375 × 812 phone, a 1280 × 800 desktop and the compact lesson band. Each pose comes from `shots.ts` `poseFor`, so the cameras are the stage's own. A point is occluded when the ray from the camera meets the island before it reaches the point.
- **The fix.** Both Dioramas are one mesh with one material. The ammonite, the palms and the bushes are not separate nodes, so there is nothing to hide or fade. Instead, the placement solver (`standingSpots.ts`, new `leadCorridorClear`) refuses a lead spot whose corridor is blocked. It checks the whole band of facings the lead can be turned to (±25° around the stage bearing), because facings are solved after placement. It takes the best-scoring clear spot, which bounds the raycasts. If an island has no clear spot at all, it falls back to the best spot rather than leave the stage empty, and `verify:placement` names that case. `TutorScene.tsx` applies the gate outside an audition, and `verify:placement` applies the same gate and then re-checks the solved facings.
- **The stills.** Dr. Rho's and Dina's stage stills (`public/rebuild/mentor-stage`) and their chooser stills (`public/rebuild/mentor-chooser`) were re-rendered from the new placement with the repository's zero-spend renderers. Zara's and Liruf's placements did not change.

Verified locally: `npm run verify:placement` is OK on both Dioramas (every lead clear in every stage shot and viewport, still on walkable ground, inside the rim and facing the learner). `occlusion.test.ts` covers all four characters: points on open ground are clear, a post in the camera corridor is reported by shot, viewport and point, the same post behind the character is not, and the solver moves the lead out of a blocked corridor. The tutor-scene and mentor suites are green.

Limitation: the head and hand points are proportional samples of each character's measured height in the bind pose, not projected skinned bones. The exports are quantized and skinned, and the repository cannot measure them headless (see `verify-placement.ts` `characterStandIn`). A gesture that swings a hand far from its bind position is not covered.

### F1-mentor finish: lane close

The finish synced with `codex/spec-migration-s02`, which was already up to date, and then made an adversarial pass over the eight gaps.

Built in the finish:

- **B.7, one component set (the rest of items 1 and 3).** Part B left the lesson boards with their own inline pictures. The finish moved every one of them into the shared library: `learning/pizarron/lessonVisuals.tsx`, exported through `PIZARRON_VISUALS`. That covers the running ledger (balance meter), percent grid, tax brackets (stacked slices), place value (base ten), savings line, growth comparison, goal bullet, number line and fraction number line (number axis), CPA dots, savings rule (condition rule), function machine, and the allocation waffle, donut and stacked bar. The worked example now uses the shared `WorkedStepsList`, which the Mentor's `WorkedStepsVisual` also uses. Each board keeps its model, controls, table and existing selectors.
- **05 §2 violations the move exposed, now fixed.** Three second or third series were drawn without their pattern channel: the tax brackets' mint and berry slices, the place-value tens rods and the CPA second group. A fourth tax bracket had no fill at all. It now uses the neutral crosshatch overflow.
- **A static 05 §8 audit.** `learning/pizarron/oneComponentSet.test.tsx` fails if any lesson board or the Mentor board draws its own `<svg>` or chart image. It checks board mark rules in the pizarron and lesson stylesheets: no accent, warning, error or success; reward only for coins; primary only for a selected mark (the learner's prediction or marker, or the board's marked item); and a pattern on every strong mint or berry mark. It also renders the new pictures.
- **Stale tests fixed.** `OnboardingPage.test.tsx` still expected bust avatars in the onboarding chooser. It now pins the Diorama chooser stills (08 §8, from part B). `designClasses.test.ts` found two classes that part B referenced but never defined (`lf-pz-ledger-change`, `lf-pz-growth`); both are now defined. Core's `analytics.test.ts` used a fixed date that the calendar passed on 2026-09-28, so it now uses a date relative to today.

Verified at the lane close:

- Full unit suites: frontend 251 files and 2,903 tests, Oracle 65 files, Core 125 files, each with type-check and lint. The only reds were the three fixed above and the load-sensitive Oracle boot tests (hardening, live-session, boot-skills). Those passed when rerun alone (86 tests).
- Gates: instruments:check, spec:check (with the dark-pattern and wallet-glossary gates) and secrets:check.
- Database package: check-migrations and check-migration-phase pass on 193 files, and the chained node tests passed. `railway-migrate.test.mjs`, which runs against a fake Railway CLI and never contacts production, was still in its fifth scenario after about 20 minutes on this Windows machine and was stopped. The lane did not touch it. The orchestrator's merge gate should run it where process spawning is fast.
- Touched gate node tests: 38 of 38 pass (instrument, session-end and review-calibration parity).
- The copy did not change, so the i18n gate was not needed.

Still open (Mentor lane, for the orchestrator or a later round):

- `database/types/database.ts` is not regenerated for the new `tutor_dialogue_calibration` columns (migration 0210, numbered 0193 on the lane). `db:types` needs the shared stack.
- Live measurement of the OD-13 budget retry rate and its model cost (OD-23 zero spend).
- C.24 metrics still `not_instrumented`: transfer_success, judgment_quality, streak_anxiety, the B.25, B.22 and B.20 manual audits, and parent_time_to_value.
- Parts of 05 §8 are not machine-checked yet: measured contrast of marks and axes in both modes, the draggable 64 px and tap-alternative check, and the in-board animation check. The static hue audit is in place.
- Occlusion uses proportional head and hand points, not skinned bones.
- The re-rendered Rho and Dina stills are `reviewStatus: draft` and need the owner's character-render review.
- The merge-time gates still apply: test:all, browser matrices and audits (the lesson boards' DOM selectors were kept), and verify:placement with scenes:fetch.
- Deploy order for later: Core before Oracle.

### Owner questions and the defaults taken (Mentor lane)

1. **OD-13 retry cost.** The Mentor turn Copy Budget is enforced as written: 12 words for ages 6-9, 20 above, 2 sentences, one question. An overflow spends the one retry, and many real child turns overflow today, so turns cost more model calls. Default taken: enforce, lowest-priority repair, survivals delivered and counted. The retry rate should be measured before release.
2. **OD-6 self-naming scope.** Only the Mentor calling *itself* a tutor, bot or assistant is caught. "Ask your tutor" (the parent) and a story's "shop assistant" pass. Default taken: self-reference only, to avoid retrying correct sentences.
3. **C.24 `tell_honored`.** The rules scorer counts an answer turn that carried the tell rung as honoured. Whether that turn really stated the answer is still the judge's question. Default taken: a hard invariant on the runtime record, plus the judge.
4. **08 §2 occlusion points.** Head and hands are proportional samples, not skinned bones. Default taken: gate placement on them now; measure real bones when source exports are available.

### Mentor lane: merge integration

Merged into `codex/spec-migration-s02` after the staff-ops, identity-site, data-platform and learning lanes. Implemented and locally verified, not accepted.

- Migration renumbered: the lane's `0193_mentor_tell_budget_self_naming_counts` collided with F1-staff-ops' `0193_parent_grant_integrity` and is now `0210_mentor_tell_budget_self_naming_counts` (every reference rewritten; 3,057 bytes, `@phase: expand`, additive columns only). No other lane touches `tutor_dialogue_calibration`.
- C.24 (defect: two implementations of the same seven Block B readers). F1-staff-ops and this lane both instrumented judgment quality, bridge conversion, decision journal, session efficiency, Mentor resolution, rest-day use and autonomy adoption. The staff-ops readers (`LearningSignalSources`, `collectLearningSignals`, `learningReading`, `trendReading`) are kept as the one implementation because they also instrument `transfer_success` and `judgment_quality`; this lane's duplicate RPC readers and types were removed. This lane's minimum of 20 opportunities (`narrativeMinSample`, `restDayMinLapses`, `autonomyMinOffers`) now gates the four diagnostics, and the trend rows read `engagementTrendTolerance` / `engagementTrendMinWeeklySample`. `rubric.tell_honored` stays rule-scored. The threshold log row now names `trendReading`; the staff-ops test fixture was raised to meet the minimum, and a new test pins the minimum.
- Bible 08 §8 (defect: two Diorama choosers). F1-identity-site built an onboarding-only chooser list; this lane's shared `MentorChooser` (onboarding and the Mentor screen) is kept, with the same still and avatar fallback. The orphaned `.lf-onboarding-chooser*` rules were removed from `identity.css`.
- B.7 boards: every board keeps the learning lane's `SegmentPrompt`, server grading (`useSegmentGrade`, `GradedFoot`, `NumberAnswer`) and hidden-until-met values, and draws with this lane's shared Pizarrón visuals. The hidden values now also reach the shared visuals' labels and ticks (ratio lines, running ledger, tax slices). The worked example keeps the long-arithmetic layout and the locale number echo inside `WorkedStepsList`; the tax board keeps its Sankey beside `StackedSlicesVisual`.
- Tier 1 change record: both lanes' rows kept in order, plus two merge-integration rows (`mentor.non_negotiables`, `measurement.stage7_and_thresholds`), sign-offs pending.
- Checks on the merged tree: type-check and lint (all services), Core 3,206 tests, Oracle 1,633 tests (six boot-timing files went red only while Core's suite ran beside it and were green on a quiet rerun), frontend 259 files / 2,993 tests, `spec:check`, `secrets:check`, i18n, `governance:check`, `instruments:check`, `session-end:check`, `evaluation-loop:check`, `tools:test` (378), and `database` `npm test` (the `railway-migrate` part went red under the same parallel load and passed alone). Not run here: browser matrices and audits, `verify:placement` with `scenes:fetch`, `db:types`.

## F1-design-system

Branch `codex/spec-fix1designsy`. Six audited SPEC gaps in the shared design
system, each checked in the code before it was fixed (all six were real).

### 1. Teaching-board audits and Reset (Bible 05 §3, §8)

- Built: `boards()` in `frontend/scripts/audits/in-page.mjs` measures every
  visible `.lf-learning-board`: SVG text limited to short numerals and symbols
  and kept inside the board (05 §5), mark and axis contrast of 3:1 against the
  board ground in the current mode (both modes by the matrix; gridlines and
  `[data-board-decoration]` ground excluded), no reserved hue on a
  `[data-series]` mark (05 §2), a 64 px hit area for every draggable and a tap
  alternative for any non-native handle (05 V4, §2). `motion()` adds
  `boardMotion`: no animation inside a board that is infinite, longer than
  `--dur-component`, springy or a celebration (05 §4, V5).
  `frontend/scripts/audits/rules.mjs` `boardFindings` turns them into findings
  inside the proportion pass, so `npm run audit:rebuild` (the pre-merge run)
  carries them. The scorer-parity half of 05 §8 stays the node gate
  `agent/tools/sync-v2-visual-scorer.mjs --check` in `spec:check`.
- Built: Reset in the control strip of BarModel, FractionArea, PlaceValue,
  SavingsRule, SchemaDiagram, FunctionMachine, CpaFading and WorkedExample
  boards. It restores the authored initial state and clears the verdict
  (EN Reset, es-MX Restablecer, pt-BR Recomeçar, the words the other boards
  already use). On the CPA board it is the `refresh` icon button with that
  name, because a visible word pushed the 6-9 first view to 26/25 (06 §3.1).
- Calibration: the proportion pass over the 21 board preview states (en-US,
  light and dark, 375 and 1280 px) found one board finding, the goal bullet's
  track and goal band at 1.24:1 in dark mode. Those two rects are ground (the
  target line and the fill carry the values), so they are marked
  `data-board-decoration`; the rerun is clean.
- Verified: `boardReset.test.tsx` (8), `boardAudit.test.ts` (3),
  `LessonDocumentView.test.tsx`.

### 2. The legacy page body is gone (02 rule 23, D3, D13; 08 §0; OD-15)

- `AppShellLayout` renders the page straight into the shell's `<main>` (a keyed
  fragment keeps the old per-address remount); `StaffShellLayout` has no
  fallback; `LegacyBody`, `isRebuiltStaffPath` and the `rebuilt` flag are
  deleted. Every `[data-legacy-body]` selector and bridge rule is gone from
  `system.css`, `shells.css`, `learnerPage.css` and the in-page audit.
- `.lf-shell-main` owns the content padding and, in the learner and console
  shells, a centred maximum width of `calc(var(--spacing-32) * 10)`; a learner
  page inside a shell adds no padding of its own, and every page fills the
  column `<main>` (zero-specificity `inline-size: 100%`; without it the teen
  wallet, which centres itself with auto margins, shrank to 0 px, found by the
  real-route audit).
- The legacy `lf-page-enter` entrance is replaced by the shell's own route
  entrance: `data-route-enter` on `<main>`, `lf-route-enter` over
  `--dur-transition` on `--ease-enter` inside `prefers-reduced-motion:
  no-preference`, fill mode `backwards` so no transform outlives it, fired
  from the shells' route-focus effect only on a real route change
  (`replayRouteEntrance`).
- Verified: `AppLayouts.test.tsx`, `shells.test.tsx` (new entrance case),
  `staffConsole.test.tsx`.

### 3. The legacy sheet is scoped to the island (02 rule 2, D3, D4; 07 §1; OD-12)

- `main.tsx` no longer imports `index.css`; it imports
  `rebuild/design/document.css` (body ground, ink and Nunito from the tokens,
  both modes, pinned to `tokens.css` by `bootVeil.test.ts`).
- `index.css` (Tailwind, the legacy tokens, glass, Inter/Sora via its own
  `@import`, the self-hosted Material Symbols face) loads only with the v1
  island (`LegacyLessonIsland.tsx`, now lazy from `LessonRoute.tsx`, so a v2
  lesson never loads it), the staff lesson preview (lazy, in
  `staffConsole.tsx`) and the four dev labs.
- `index.html`: no Google Fonts request and no icon-font preload; it preloads
  `fredoka-latin-v1.woff2` and `nunito-latin-v1.woff2`. The boot veil paints
  `--base` (#f4f5fd) and dark `--base` (#0b0d1b) with a `--primary` bloom.
- The 3D layer's Tailwind utilities became `tutor-scene/sceneCanvas.css`
  classes (the Mentor stage mounts it outside the island).
- `system.css` carries the element baseline the rebuilt surfaces were built on
  in the real app (the preflight's borders, heading, list, form-control, link
  and media rules), scoped to `.lf-rebuild` at zero specificity, so any
  component rule wins and the preview entry and the real app share it (the
  real-route audit had found a bare `h3` at the UA's 18.72 px).
- Verified: `bootVeil.test.ts` (15), `legacyLessonIsland.test.ts` (new lazy
  and sheet case), `CharacterLayer.test.tsx`, `designClasses.test.ts`,
  `celebrationBudget.test.ts`; a real-app audit run (below).

### 4. The four orchestrated motion patterns (04 §4.1-§4.4; 02 §9.9, rule 14)

All in `rebuild/design/motion.tsx` and `motion.css`, under
`prefers-reduced-motion: no-preference`; with reduced motion the final state is
shown directly.

- `useRouteEntry(key)`: true only on the first render of a surface after a
  route or lesson-screen change (`noteRouteChange`, called by the shells' route
  entrance and the lesson layer); a re-render or a same-route remount never
  re-fires.
- `SequenceTransition` wraps the v2 lesson's segment swap
  (`LessonDocumentView`): the outgoing `.lf-learning-content` is cloned before
  the swap (inert, hidden from assistive technology, ids stripped) and slides
  out 14% on `--ease-exit` while the incoming card slides in from 18% on
  `--ease-enter`, both over `--dur-transition`, about 22% overlap; the foot
  travels with its card. The CPA board keeps its own stage transition.
- `SuccessWipe` in the Tutor's `DecisionQueue` (Tasks and Coins pages): on
  approving a chore or a reward, a solid success panel with the check glyph and
  the item's title covers the row from the top, holds and clears downwards over
  three `--dur-component` steps, revealing the row as approved (kept, with a
  success chip, until the wipe ends even when the refreshed queue drops it).
- `Wave` on a new streak strip in the learner's rhythm card (seven days derived
  from the streak's own count, decorative; index × 60 ms). `Stagger` on the own
  and public profile badge grids (min(i, 10) × 45 ms).
- Registered as non-celebration motion (`ORCHESTRATED_MOTION`) in
  `celebrationBudget.test.ts` and in the in-page motion audit, which reports a
  wave outside the streak strip or a stagger outside its primitive.
- Verified: `motionPatterns.test.tsx` (route entry, re-render and remount do
  not re-fire, wipe and slide with and without reduced motion).

### 5. The coin asset (07 §1 class B, §6; 02 §9.5)

- `public/rebuild/art/coin.svg`: in-house, flat, no text, under 1 KB, the
  `reward` fill with a `reward-ridge` outline and a `reward-strong` star.
  Registered as `money.coin` (class B, slot `money.coin`, family `coins`,
  modes both, draft). The asset gate now also reads `money.*` ids as
  references. The SVG uses the token hex values rather than CSS variables:
  an `<img>` SVG cannot read the page's variables, the reward tokens are the
  same in both modes, and the gate proves every colour is a token.
- `CoinAmount` (coin art, aria-hidden, then the number and the word "coins")
  and `RewardChip coin`. Used for task rewards, the reward catalog (child and
  Tutor), the family console's wallet total, the Tutor's reward costs, pocket
  balances (child pockets, coin account pockets), goal progress (the copy now
  says "{saved} of {target} coins" in all three locales), Share gifts and the
  teen wallet (total, pockets, reward prices). XP and streak chips never carry
  the coin. Shown in the SystemGallery.
- Verified: `coinAmount.test.tsx`, the money surface tests, `check-rebuild-assets`.

### 6. Press ring and haptic tick (02 §9.1)

- `pressFeedback` / `withPressFeedback` in `motion.tsx`: on pointer down a ring
  in the control's own on-* colour (`currentColor` border, no fill) scales out
  from the touch point over `--dur-micro` on `--ease-standard`, then is
  removed; `navigator.vibrate?.(8)` unless the platform's sound off switch
  (`lf_sound_muted`) is on. Disabled or pending controls give no feedback.
  Applied to Button, IconButton, AnswerChoice, ReplyChip, ChoiceChip and the
  pressable ListRow. Under reduced motion only the colour change remains.
- Pinned in `controlsCss.test.ts` and `scripts/verify-rebuild-controls.mjs`
  (a real press must start `lf-press-ring` and clear it).

### Verification summary

`npm run type-check` and `npm run lint` (frontend) clean; focused Vitest over
design, learning, family, account, social, wallet, banking, app-shell,
routes/app and `src/__tests__` green (1,233 tests in the widest run); root
`npm run spec:check`, `npm run secrets:check` and the i18n gate green;
`check-rebuild-assets` OK (145 class B assets). Browser (`audit-rebuild.mjs
all`, local dev server, synthetic Core): all 183 real-app states at 375 px in
en-US light and dark and all 176 preview states at 375 px en-US light: text fit
and proportion clean; copy budget clean except the one finding below. The
eight Reset boards, the goal board, the system gallery and the learner home in
es-MX and pt-BR, light and dark, 320 and 1280 px: clean. The full matrices and
`test:all` are the orchestrator's merge gate.

### Owner questions and defaults taken

- The streak strip has no per-day history from Core, so it is derived from the
  streak count and kept decorative (the words carry the meaning). If the owner
  wants real practised/rest-day marks, Core needs a seven-day history field.
- The haptic tick follows the platform sound off switch only, not reduced
  motion (haptics are not visual motion). Conservative alternative: also skip
  it under reduced motion.
- The legacy island's typefaces: resolved at the lane finish by moving the
  island to the self-hosted Fredoka and Nunito (below), the design system's own
  faces, rather than self-hosting Inter and Sora. If the owner prefers the v1
  player's original look until OD-24 retires it, Inter and Sora would have to be
  self-hosted (a font download this lane did not make).

### Lane finish (F1-design-system-finish)

Sync with `codex/spec-migration-s02`: already up to date (no conflicts). An
adversarial pass over the lane's three commits against the six gaps closed the
three items the checkpoint had left open:

- Copy budget, public profile at 6-9 (06 §3.1): the youngest register now shows
  each badge's art and name without the "Earned {date}" line (the other
  registers keep it), which brings `app:/@marta@kid-6-9` back under 25
  first-view words. `PublicProfile.tsx`; pinned in `PublicProfileRoute.test.tsx`.
- No third-party font on any route (02 D3, D4): `src/index.css` drops its
  Google Fonts `@import`, declares the self-hosted Fredoka and Nunito faces (the
  dev labs load this sheet without `system.css`) and sets them in the legacy
  type scale; `tailwind.config.js` maps `display` and `body` to them. Pinned in
  `bootVeil.test.ts`.
- Press ring on the picture option (02 §9.1): `pressFeedback` draws into a
  `[data-press-host]` clipping layer when the control has one, so the picture
  option ripples without clipping its corner check badge, and it gives no
  feedback when the option's input or fieldset is disabled. `fields.tsx`,
  `motion.tsx`, `motion.css`; pinned in `motionPatterns.test.tsx`.

Verified at the finish: frontend `type-check` and `lint` clean; root
`spec:check`, `secrets:check`, the i18n gate and `check-rebuild-assets` green.
Full frontend unit suite: 249 of 252 files and 2,878 of 2,891 tests passed in
the loaded run; the three red files each pass alone (`App.test.tsx` and
`LessonRoute.test.tsx` 70/70; `assetGate.test.ts` 11/11 in 490 s, its first
clean pass, with single cases taking up to 84 s against the suite's 90 s
budget, so it times out whenever it shares the machine with the rest of the
suite). The copy-budget audit over `app:/@marta@kid-6-9` and
`app:/@marta@adult` (375 px, light, three locales, local dev server,
synthetic Core) reports no issue. Only `frontend/` and docs were touched by
the lane, so no other service suite applies.

### Remaining

- Ledger lines (activity, corrections, statements) keep signed numbers without
  the coin mark (02 §9.5 limits the coin to money but does not require it on
  every amount); cards other than the pressable list row do not ripple.
- `assetGate.test.ts` reruns the whole gate (OCR over every raster) per case,
  so it needs a quiet machine or a larger budget: run it alone in the merge
  gate, or make the gate cache its OCR results.
- The island's typeface change has unit evidence only; the merge matrices cover
  the v1 lesson's text fit.
- Acceptance and release are not claimed.

### F1-design-system merge integration

Merged into `codex/spec-migration-s02` after the staff-ops, identity-site, data-platform, learning and Mentor lanes. No migrations in this lane, so nothing was renumbered.

- Two streak strips in the rhythm card (defect). The learning lane's `StreakStrip` (Core's `streak.week`: practised, rest, paused, open and today by shape, glyph and word) and this lane's derived seven-dot `Wave` strip both rendered in `StreakCard`, and both used the `.lf-streak-strip` / `.lf-streak-day` classes, so `rhythm.css` restyled the real strip. The derived strip, its `streakWeek` helper and its `rhythm.css` rules were removed; `StreakStrip` now renders its days through the shared `Wave` (`data-streak-strip`, 04 §4.3), so the wave fires only on a real route entry, as the in-page motion audit expects, on the rhythm page, the learner home and the own profile. Its own always-on CSS wave was removed.
- Board Reset on the Pizarrón boards. The learning and Mentor lanes moved the bar-model, fraction-area, goal-bullet, place-value, savings-rule and schema boards to `SegmentPrompt`, server grading and the shared Pizarrón visuals; this lane added Reset to the old markup. Reset now sits in each merged board's control bar. On place value and the savings rule it also clears the server verdict (`grading.reset()`), and on the savings rule it also clears the graded builder (comparison, threshold, link); it is disabled once the step is met.
- Goal band and track as board ground. The goal bullet now draws with `GoalBulletVisual`, so the `data-board-decoration` marking moved into that shared component (`pizarron/lessonVisuals.tsx`) and the Mentor's board inherits it.
- `LessonDocumentView`: this lane's `SequenceTransition` now wraps the learning lane's `renderSegment` and its record-the-view failure notice.
- `staffGrants.ts`: the `rebuilt` flag is gone, and the identity-site lane's age-correction route keeps its grant without it.
- `motionPatterns.test.tsx`: the success-wipe title is a constant, so the i18n hardcoded-string gate stays green.

Checks on the merged tree: `typecheck:all`, `lint:all`, frontend 262 files / 3,017 tests, plus `assetGate.test.ts` run on its own (11/11 in 295 s with a raised per-test timeout; its 90 s budget per case is still too tight), `spec:check`, `secrets:check`, i18n. Not run here: browser matrices and the in-page audits. The new `boards()` audit (3:1 mark contrast, SVG text) has not yet measured the other lanes' Pizarrón visuals (ratio, ledger, tax, growth, number line). The orchestrator's `audit:rebuild` matrices must confirm them.

## Family (`codex/spec-fix1family`)

### F1-family.1: the money section is the Wallet in every label (OD-28 glossary)

**Gap (confirmed in code).** The verified parent's `/banking` tab read "Coins" / "Monedas" / "Moedas" and a linked teen's "Family coins"; the Tutor page's H1 was "Coins" and the linked teen's "Family coins". Only a parent-created child saw "Wallet". The glossary gate refused only the retired name and a bare "Banking", so the mismatch passed.

**Built.**
- Copy, all three locales: `appShell.nav.coins` is "Wallet" / "Cartera" / "Carteira" (the Tutor's tab, one word so the 375 px bar does not wrap more than recorded in W2F.2); `appShell.nav.familyCoins`, `familyCoins.title` and `childCoins.titleFamily` are "Family wallet" / "Cartera familiar" / "Carteira da família"; the failure, refusal and verification titles of both screens name the wallet.
- Path: the family Wallet moved from `/banking` to `/family-wallet` (the glossary avoids "bank"). `frontend/src/rebuild/banking/walletPath.ts` holds the path; the three navigation slots, the Family console, Tasks links and the route read it; `/banking` redirects and keeps `?child=`. API paths (`/api/v1/banking/*`) are unchanged: no person reads them.
- Gate: `agent/tools/check-wallet-glossary.mjs` section 4 requires the Wallet term in every navigation label and page, failure and refusal title of `/family-wallet` and `/wallet` (a missing key is refused), and refuses a Wallet navigation slot whose path says "bank".

**Verified.** Glossary gate mutation tests (23, five new refusals); `familyWalletPath.test.tsx` (redirect keeps the child, every slot on the new path); navigation, app shell, family console, tasks, coins and copy-budget unit tests; `spec:check`, i18n gate, type-check and lint.

**Remains.** Native copy review of the new terms; the family audit's money states now open `/family-wallet` (not rerun in this lane; the orchestrator runs the matrix at merge).

### F1-family.2: the Tutor sees every drawn board in a child's Mentor talks (Block D oversight, Product 10 §1.9, OD-9)

**Gap (confirmed in code).** F3 (`ChildMentorTalks.tsx`) printed only each board's caption; `consoleApi.ts` reduced a board to `{ kind, label }` and dropped the wire Core already sends on transcript turns, the savings plan and the kept boards, although the Mentor lane's renderer (`mentor/screen/MentorBoard.tsx`) now exists. W2-FAMILY-AND-WALLET recorded this as an OD-9 reduction against the legacy guardian transcript.

**Built.**
- `consoleApi.ts`: `BoardNote` keeps `wire` (the Mentor lane's `TutorWhiteboardWire`) beside the caption. `boardWire()` validates it with the Mentor lane's own `boardModel`: a shape the model draws (an unknown shape yields no model), a caption, and every row writable (no missing field, no value that is not a number). Anything else keeps the caption alone.
- `ChildMentorTalks.tsx`: the transcript (from a talk and from a flag) and the kept boards and savings plan render `<MentorBoard readOnly>` with the page locale's `mentorScreen.board` copy, titled by the caption; a render failure falls back to the caption (error boundary). Heading levels follow the page outline (h3 under a section, h4 inside a talk).
- `MentorBoard.tsx` gains `readOnly` (a class II shape, such as grab, fill, what-if or your turn, is drawn as its rows with every value written and no control) and `headingLevel`; `TeachingChartBoard.tsx` gains `headingLevel`. Defaults keep the Mentor stage and lesson player unchanged.
- Family audit: the transcript and plan fixtures now use real wire shapes; new scenario `family-mentor-boards` and state `/family/:kid/tutor@boards` (a talk with a drawn goal bar and a read-only your-turn board, and a kept board).

**Verified.** `consoleApi.test.ts` (every Mentor board fixture in three locales passes the validator; unknown shape, no caption, old shape, non-number and missing figure refused), `ChildMentorTalks.test.tsx` (drawn board with its caption as an h4 title and its figures; class II board read-only with no control; undrawable boards keep their caption; kept boards drawn); family, Mentor, learning and copy-budget suites (999 tests); type-check, lint, `spec:check`.

**Remains.** The new audit state was not run in this lane (the orchestrator's matrix at merge); native review of the board words is the Mentor lane's.

### F1-family.3: no card-shaped number is minted, stored or served (D.7)

**Gap (confirmed in code).** Core's `generateDisplayNumber()` minted `LF-1234-5678` on every account insert, `toWireAccount` served `displayNumber` on the account routes, and `banking_accounts.display_number` stayed `NOT NULL`. The rebuilt UI only dropped the field in its API layer; NO-UNBACKED-GUARANTEE.md left the removal open.

**Built.**
- Core: `generateDisplayNumber` removed; `insertBankingAccount` sends only the row; `BANKING_ACCOUNT_FIELDS` and `BankingAccountRow` no longer name the column; `toWireAccount` no longer returns `displayNumber` (`backend/src/services/supabaseRest.ts`, `backend/src/routes/banking.ts`).
- Migrations (lane numbers; the orchestrator renumbers at merge): `banking_display_number_optional` (expand; drops the NOT NULL, guarded so a chain replay after the drop is a no-op) and `banking_display_number_drop` (contract, `@after-release` the Core release above): redefines `guard_banking_account_state()` without the column (a PL/pgSQL body naming a dropped column fails at run time), redefines `social_messaging_surfaces()` without the reviewed name `text:banking_accounts.display_number` (removed from SOCIAL-GOVERNANCE.md §2.2 too), then drops the column. The 0121 and 0178 copies of the scan are history; 0192 was the live one.
- Verifiers that seed an account insert the number only while the column exists (`number_columns()` in six `database/scripts/verify-*-postgres.py`).
- Docs: the open line in NO-UNBACKED-GUARANTEE.md is closed; `block-d-controls.json` `simulation` names the Core select list as enforcement and the new Core test as proof. Fixtures (`moneyFixtures.ts`, `BankingPage.test.tsx`, the family audit, three verify scripts) no longer carry `displayNumber`; `CoinAccount.test.tsx` keeps its refusal of a card that carries a number.

**Verified.** Core `banking.test.ts` (the insert body carries no number; neither a parent nor a child read serves one, even from a row stored before the drop; the select list does not name the column), `choreStreakBonus`, `moneyPresentation` (151 tests); `database` npm test (migration numbering, phase gate: 147 expand / 47 contract, lifecycle); native PostgreSQL 17.6 on a lane cluster (port 15760) over the WHOLE chain (`LF_PG_FULL_CHAIN=1`): seven verifiers green: family state machine, account erasure, social governance (the E.10 messaging scan finds nothing unreviewed after the drop), teen wallet, money habits, autonomy decisions and family governance. Run in parallel they exhausted Windows client ports (connection refused, empty psql errors); run one at a time they pass. The `railway-migrate` test inside `database` npm test was still running (contended by several lanes) when the lane closed; every other part of that script passed; `guardrails:check`, `no-unbacked-guarantee`, type-check, lint.

**Remains.** `database/types/database.ts` still lists `display_number`: `db:types` needs the Supabase CLI and a local stack, neither available to this lane (the shared Docker database is off limits); regenerate at integration. Deploy order: Core first, then the contract migration (the expand one may go either side).

### Owner questions and defaults (family)

- **Tutor tab wording.** Default taken: the Tutor's tab is "Wallet" and the page title "Family wallet" (a Tutor has no personal wallet, OD-3; one word keeps the 375 px tab bar from wrapping further). The owner may prefer "Family wallet" on the tab too.
- **Path.** Default taken: `/family-wallet`, with `/banking` redirecting (the glossary avoids "bank"; `/wallet` is the independent teen's). API paths stay `/api/v1/banking/*`.

### F1-family-finish: lane summary

**Closed in code (implemented and locally verified, not accepted):** the three audited family gaps. (1) OD-28 glossary: the money section reads Wallet / Cartera / Carteira in every label and title, at `/family-wallet` (`/banking` redirects), pinned by the glossary gate. (2) Block D oversight (Product 10 §1.9, OD-9): the Tutor's view of a child's Mentor talks draws every board read-only with the Mentor lane's renderer, validated at the API edge. (3) D.7: Core no longer mints, stores or serves the card-shaped account number; expand and contract migrations remove the column.

**Finish pass.** Synced with `codex/spec-migration-s02` (already up to date). Adversarial sweep: no `displayNumber`/`display_number` left in any service source outside refusal tests; no rebuilt route opens `/banking` (only API paths `/api/v1/banking/*`); the rebuilt console imports only shared controls and the Mentor lane's board; every new element carries `data-copy-role`. Authorization is unchanged at the server: the boards travel on the existing guardian-only transcript endpoints, and D.7 is a removal.

**Verified once at lane end.** frontend and backend type-check and lint green; root `spec:check`, `secrets:check`, `tools:test` and the i18n gate green. Full unit suites under 100% CPU from parallel lanes: frontend 2849/2862 and backend reds were timeouts in files this lane did not touch; each passed when rerun alone, except `backend/src/__tests__/analytics.test.ts` "does not invent years of leading zeros for all-time", which fails deterministically because it reads the real clock (40 days from its 2026-08-20 fixture to 28 Sep 2026, against a bound of 40). It is not lane code and was left for the owner of that test. `database` npm test: migration numbering, phase and lifecycle checks and the 44 node tests green; its last step, `railway-migrate.test.mjs` (a fake Railway CLI, no network), died on a scenario whose bash child never started (Windows status 0xC0000142, DLL init failure under load, empty stdout and stderr). The lane does not touch that runner; the orchestrator's merge gates should rerun it on a quiet machine.

**Open.** `database/types/database.ts` still lists `banking_accounts.display_number` (regenerate with `db:types` at integration; no Supabase CLI or stack here). Deploy order for D.7: Core first, then `banking_display_number_drop`. The new audit state `/family/:kid/tutor@boards` and the `/family-wallet@*` states were not run through the audit matrix. Native copy review of Cartera familiar / Carteira da família and of the read-only board words.

### Family: merge integration

- Migrations renumbered by the orchestrator: the lane's `0193_banking_display_number_optional` and `0194_banking_display_number_drop` collided with the integration branch (highest `0210`), so they are now `0211_banking_display_number_optional` (expand) and `0212_banking_display_number_drop` (contract). No migration between `0193` and `0210` redefines `guard_banking_account_state()` or `social_messaging_surfaces()`, so the contract's definitions are the final apply-order state. Both are under 23,000 bytes (largest 8,774).
- `MentorBoard.tsx` conflict: the Mentor lane had moved every board to the shared Pizarrón visual (`BoardVisual`, `data-board-visual`, a `format` prop on the class II boards); this lane added `readOnly` and `headingLevel`. The merged board keeps both: the interactive boards use the Mentor lane's props under the page's heading level, and a read-only class II board is drawn by `BoardVisual` in `TeachingChartBoard`, with a your-turn board's every step shown (none held back as the learner's turn).
- `ChildMentorTalks.test.tsx`: the read-only your-turn board no longer prints its values as text rows (the Mentor lane's picture replaced the row list). The test now checks that the picture's accessible description names every value; the table stays one press away.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check` (wallet glossary included), `secrets:check`, the i18n gate, `tools:test` (384/384), backend (3,207 passed, 1 skipped) and frontend unit suites, and `database` `npm test`.
- Still open: `database/types/database.ts` still lists `banking_accounts.display_number` (no `db:types` run at merge; it needs the local stack). The audit matrix for `/family/:kid/tutor@boards` and `/family-wallet@*` was not run.

## F1-social: E.3 pattern trigger by age

Branch `codex/spec-fix1social`.

**Gap (confirmed in code).** E.3 queues an account for staff review once reports or blocks from 3 or more unrelated minor accounts reach it within 30 days. OD-3 (13-OWNER-DECISION-LOG section 1 and the section 2 access table) makes every minor safeguard follow age, not role, and OWNER-REVIEW-ANSWERS D-19 names this trigger as a limit on adults who send teens requests. `evaluate_social_pattern` in `0108_report_escalation.sql` counted a reporter only when `user_roles.role = 'kid'` and skipped any reporter with no verified guardian. No later migration redefined it. A self-registered 13-17 teen's report or block therefore counted for nothing, and three teens reporting one adult never opened a case.

**Built.**

- Migration `social_pattern_age_based` (`database/migrations/0213_social_pattern_age_based.sql`, `@phase: expand`) redefines `public.evaluate_social_pattern(p_subject)` with the same signature, grants and event sources (reports, and blocks read from the 0095 audit trail). The window stays 30 days and the threshold stays 3.
  - A reporter qualifies when `public.social_tier()` puts it in a minor tier (`guardian` or `teen`). Adults, guests and the closed tier never count.
  - A reporter with verified guardians is excluded when it shares a guardian with the subject, or when the subject is one of its guardians (new: a child blocking its own Tutor is family). Siblings count once.
  - A reporter without a guardian is its own unrelated unit. It is excluded only when a verified guardian link joins it to the subject in either direction. A pending link does not exclude it, so an adult cannot shield itself by starting a link.
- `database/scripts/verify-social-pattern-postgres.py`: a new PostgreSQL verifier with 10 checks, described under Verified.
- `backend/src/__tests__/report.test.ts`: three teen-tier sessions report one adult. Each report reaches `submit_social_report` as that teen, and Core never filters reporters by role.
- Copy: the staff case sheet's `reports.body.patternHelp` now reads "reports or blocks from 3 unrelated minors" in EN, es-MX and pt-BR. `StaffReports.tsx` header comment. Policy text: SOCIAL-GOVERNANCE threshold table and SOCIAL-TIERS section 7 item 3 (D-19 answered).

**Verified (local).**

- The new verifier passed 10 of 10 checks on portable PostgreSQL 17.6, with all 193 migrations applied in order:
  - three independent teens blocking an adult open a `pattern` case, and two do not;
  - two teen reports plus one teen block cross the threshold;
  - three adults open nothing;
  - siblings count once, and minor tiers mix;
  - the subject's own family is excluded: a child blocking its own Tutor, a sibling of the subject, or a teen joined to the subject by a verified link;
  - a pending link does not shield the subject;
  - two mutation checks: restoring `role = 'kid'`, or restoring the skip for a reporter with no guardian, turns the independent-teen case red;
  - no browser role and not the service role can call the rule directly.
- `verify-social-governance-postgres.py` and `verify-account-erasure-postgres.py` were rerun on the same chain and are green.
- Core `report.test.ts`: 25 of 25 pass.

**Remaining.**

- Human review.
- Production readings for the Appendix J pattern metric.
- The tier is read when the rule is evaluated, the same "as of today" reading every other E.8 gate uses. A teen who turns 18 inside the window stops counting.
- Conservative default recorded as an owner question: a child blocking or reporting its own verified Tutor no longer counts toward the Tutor's pattern case. E.3 says "unrelated", and a report still opens a case on its own.

## F1-social-finish: guardian notice by age, lane close

**Adversarial pass.** The audited E.3 gap had a second role test in the same 0108 file: `submit_social_report` notified a reporter's or subject's verified guardian only when that account held the `kid` role. A guardian-linked under-13 origin account (social tier `guardian`, role `universal`) could report or be reported without its Tutor being told, against OD-3.

**Built.** Migration `social_pattern_age_based` now also redefines `public.submit_social_report` (0108 verbatim otherwise). The reporter and subject notice sources read `public.social_child_account` (0121), the same child test E.11 uses. A self-registered teen still decides for itself (S-05). Whether a teen's linked guardian also gets this notice stays the open question SOCIAL-TIERS already records. The migration is now about 11 KB.

**Verified (local).**

- `verify-social-pattern-postgres.py`: 11 of 11 on PostgreSQL 17.6, 193 migrations. The new check covers three cases. A linked origin account that reports, or is reported, notifies its guardian. An unlinked teen reporter notifies nobody. A third mutation check (putting back the `kid` role test) loses the notice. `verify-social-governance-postgres.py` is green on the same chain.
- Full unit suites, run once at the lane close, with type-check and lint:
  - backend: 3067 pass, 1 skipped;
  - frontend: 2855 of 2856 pass. The one red was `assetGate.test.ts`, an OCR timeout under shared machine load in a file this lane never touched. It passed 11 of 11 when rerun alone.
  - database: the migration, phase and lifecycle checks pass, and so do 44 of 44 node tests. The last step of `npm test`, `railway-migrate.test.mjs`, hung in its fake-Railway shell harness with no output, and was stopped. The same test hung at that moment in two other lane worktrees, and this lane did not touch it or `railway-migrate.sh`. The orchestrator's merge gate should rerun it.

**Lane summary.** E.3 now follows OD-3 in both of its role tests. Minors count toward the pattern trigger by age tier, and a child's guardian is notified by the child test instead of the kid role. The staff copy is updated in EN, es-MX and pt-BR, and so is the policy text. There is no new UI and no Core wire change. Remaining: human review and acceptance of E.3, production readings for the Appendix J metric, and the two owner questions: a child reporting its own Tutor, and notices for a teen's linked guardian.

### Merge integration (F1-social)

- Migration renumbered by the orchestrator: the lane's `0193_social_pattern_age_based` collided with F1-staff-ops' `0193_parent_grant_integrity` (integration branch highest `0212`), so it is now `0213_social_pattern_age_based` (10,905 bytes, `@phase: expand`). The verifier and the docs look it up by name.
- Cross-lane defect fixed: F1-data-platform's `0204_social_protection_metrics` added `social_pattern_qualifies`, a read-only copy of the 0108 pattern rule (kid-role reporters with a verified guardian) that the Appendix J Repeated-Contact Pattern Escalation Rate compares with the cases staff received. After `0213` the enforced rule counts minors by age tier, so the metric would have measured the old rule and never seen a self-registered teen pattern. New migration `0214_social_pattern_metric_age_based` (`@phase: expand`) redefines `social_pattern_qualifies` to mirror the `0213` `evaluate_social_pattern` exactly, minus the case upsert, with the same signature, STABLE, SECURITY DEFINER and grants.
- `verify-social-pattern-postgres.py` gained a 12th check: `social_pattern_qualifies` and `evaluate_social_pattern` agree on all eight seeded subjects (teens, adults, siblings, own family, verified and pending links). README's social-tiers row names the new migration.
- `docs/rebuild/REQUIREMENTS.md` E.3: kept the integration branch's F1D metric text and links and added the F1-social text and link.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`, `secrets:check`, the i18n gate, `social:check`; Core `report.test.ts` and `socialProtection.test.ts` (36 of 36); frontend `src/rebuild/staff` (144 of 144); on native PostgreSQL 17.6 with all 214 migrations, `verify-social-pattern-postgres.py` 12 of 12 and `verify-social-protection-postgres.py` 8 of 8; `database` migration numbering, phase and lifecycle checks and the node tests.
- Still open: `railway-migrate.test.mjs` (fake Railway transport, never production) did not finish within 8 minutes when run alone on this Windows machine; the same slowness was recorded by earlier lanes. It needs a run where process spawning is cheap, or a scoped fix to the harness.
