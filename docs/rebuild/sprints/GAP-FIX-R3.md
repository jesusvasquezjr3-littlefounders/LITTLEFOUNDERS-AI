# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F3-mentor

Branch `codex/spec-fix3mentor`. Two audited SPEC gaps in the Mentor area. Each
was checked in the code first; both were real.

### Gaps confirmed

1. **No Stage 5 canary delivery path** (C.22; Appendix E §3.1; Appendix F Part 3 Stage 5 and §1.4). The only H.7 target Core read on the tutor surface was `mentor.dialogue-register` (`dialogueCalibration.ts`). The seven registered Tier 2 parameters were code constants with no runtime path. `oracle/src/core/client.ts` had no field that could carry a variant. `check-mentor-governance.mjs` accepted `canary` and `released` records on an `experimentId` and a transcript count, without checking that the experiment delivered anything.
2. **C.1 to C.4 safety metrics were neither gated nor measured** (Appendix F §1.3; Part 2.1 criterion 3; C.24). No `agent/tools` script referenced `resolveMentorSafety`, `requiresMinorMentorSafeguards` or `classifyMemoryReview`. `release-readiness.sh` had no minor-safeguard audit. `mentorQuality.ts` had no fracture-closure or calibration-coverage signal. The one remaining role test (`roles.includes('kid') || guardians.length > 0` in `classifyMemoryReview`) was pinned by no gate.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | C.22; Appendix E §3.1; Appendix F Stage 5 | **The canary manifest and generated tables.** `canaries.json` lists each canary: the H.7 experiment id, the proposal, the share (at most `maxShare`, 10%), the overrides and a status (`running` or `concluded`). `check-mentor-canary-parity.mjs --write` generates the Tier 2 id and bounds table from `registry.json` into Oracle (`tier2Parameters.generated.ts`) and the same table plus the running canaries into Core (`mentorCanaryTables.generated.ts`). `npm run canary:check` (repo-gates, release-readiness) fails on stale generated files, an override that is not a registered Tier 2 parameter or is out of bounds, a share over the ceiling, a duplicate, a proposal with no record, an arm-vocabulary drift, a migration CHECK drift, or Oracle dropping one of the three config objects. The registry now marks each Tier 2 parameter `integer`. | `docs/rebuild/mentor/governance/canaries.json`, `registry.json`, `agent/tools/check-mentor-canary-parity.mjs` |
| 2 | C.22 Stage 5; OD-23 | **Core resolves the arm.** `resolveMentorCanary` runs at session start, but only when Oracle announced the `canary` context field. Eligible: the Mentor's verified-adult posture (`resolveMentorSafety` says not a minor), the adult dialogue band, and the adult analytics rule. Then the `mentor.canary` H.7 assignment, a deterministic pool of twice the share (salted apart from the runtime's A/B draw), and the exposure recorded before the arm is sent. Variant B is the canary arm and variant A the matched control. Core sends `canary: { proposalId, arm, overrides }` in the negotiated context, never in the model context. At close it stores the reported arm once (`tutor_sessions.canary_proposal_id`, `canary_arm`) and refuses a proposal the manifest does not run. Dataintel refuses a `mentor.canary` experiment unless it is on the tutor surface, adults only and without an upper age bound. | `backend/src/services/pedagogy/mentorCanary.ts`, `routes/tutor.ts`, `pedagogy/behavioralTelemetry.ts` (`CONTEXT_OPTIONAL_FIELDS`), `dataintel/src/routes/queries.ts`, migration `0228_mentor_canary_arm.sql` |
| 3 | C.22 Stage 5 | **Oracle applies it.** `MentorCanarySchema` is closed: an unknown field refuses the context, a control arm carries no override, and a canary arm carries at least one. `applyCanary` moves registered Tier 2 parameters only, clamped to the registry bounds and rounded for integer parameters. Any other key refuses the whole canary: the session runs the approved defaults and reports no arm. The orchestrator builds the telemetry, alliance and self-explanation configs from it and reports `{ proposalId, arm }` in the close record. The park-snapshot fence lists `canary` as derived from the pinned context. | `oracle/src/tutor/mentorCanary.ts`, `core/client.ts`, `tutor/orchestrator.ts` |
| 4 | C.22; Appendix F Stage 5 and §1.4 | **The gate checks delivery.** From `canary` on, `stage5.experimentId` must name a `mentor.canary` canary in `canaries.json` that delivers this proposal, with overrides equal to the proposal's `parameterChanges`. The canary must be `running` while the proposal is in `canary`. `parameterChanges` must name registered Tier 2 parameters, inside their bounds, in files the proposal lists. A proposal with no parameter changes cannot claim a canary. | `agent/tools/check-mentor-governance.mjs`, `governance/proposals/README.md`, `SELF-IMPROVEMENT-GOVERNANCE-POLICY.md` §4.1 and §9 |
| 5 | C.22 Stage 5; C.24 | **Canary against control.** The new signal `canary.arm_comparison` (pedagogical lead) compares each proposal's canary arm with its control, using the share of rules-scored sessions that failed any criterion. The existing disparity rule decides, and a clearly worse canary opens a flag scoped to `proposal:<id>`. `npm --prefix backend run tutor:canary-report -- --proposal=<id> --sample=20 [--transcripts]` prints the comparison and a reproducible sample of closed canary-arm sessions for the named reader. It re-checks every learner and never prints a transcript whose learner now reads as a minor. | `mentorQuality.ts` (`canaryReading`), `evaluationLoop.ts`, `backend/src/scripts/canary-report.ts` |
| 6 | C.2, C.3, C.4; Appendix F §1.3 Fracture-Closure Verification | **The Fracture-Closure gate.** `check-mentor-minor-safeguards.mjs` runs six static checks over Core's tutor routes, the two resolvers and Oracle's admission, and writes a pass/fail JSON with `--report`. (1) The resolvers keep their non-role evidence. (2) Every kid-role test sits inside a resolver or on an allowlist entry that cites an owner decision in the log. A sole-condition test fails, and so does a stale entry. (3) `isMinor` and `originRestricted` are bound only from `resolveMentorSafety`. (4) Every microphone decision takes the resolved indicator. (5) Every memory-review decision compares a value from `classifyMemoryReview`. (6) Oracle's moderation mode, microphone and resume posture read only `session.isMinor`, and no role, age band or birth date reaches Oracle's admission. The OD-18 kid-role hold in `classifyMemoryReview` is the one allowlisted test. Wired into `spec:check`, repo-gates, `release:readiness` (JSON under `coursegen/runs/`) and CODEOWNERS. | `agent/tools/check-mentor-minor-safeguards.mjs`, `package.json`, `.github/workflows/repo-gates.yml`, `agent/tools/release-readiness.sh`, `.github/CODEOWNERS` |
| 7 | C.1; Appendix F §1.3 Age-Tier Calibration Coverage Rate | **The coverage RPC.** `mentor_age_calibration_coverage(p_from, p_to)` is callable by the service role only and returns counts only. For the sessions started in the window, it counts those whose learner's age was unknown at the session start, by the rule of Core's `knownMentorAgeTier`, and how many of those had a `mentor_age_calibrations` row before the session started. | migration `0229_mentor_age_calibration_coverage.sql`, `backend/src/services/mentorAgeCalibration.ts` (`readAgeCalibrationCoverage`) |
| 8 | C.24; Appendix F §1.3 | **The two safety signals.** `safety.fracture_closure` (C.2, external, zero tolerance, from the release gate) and `safety.age_tier_calibration` (C.1, a hard invariant at 100%, read from the RPC; a miss opens an urgent flag), both owned by the Safety and Trust lead. The evaluation loop reads the RPC and the canary arms. Staff console fixtures and labels exist in EN, es-MX and pt-BR, and `canary.arm_comparison` is formatted as a count. Thresholds are in the recalibration log. | `mentorQuality.ts`, `evaluationLoop.ts`, `frontend/src/rebuild/staff/mentorQualityFixtures.ts`, `mentorQualityApi.ts`, `console/staffSectionFixtures.json`, `src/i18n/*/rebuild-staff.json`, `THRESHOLD-RECALIBRATION-LOG.md` |

Tier 1 change-record rows were recorded for `safety.judge`, `mentor.non_negotiables`, `measurement.stage7_and_thresholds` and `governance.model`. Their sign-offs are pending.

### Verification (local)

- Oracle (vitest, focused): `mentorCanary.test.ts` has 17 tests: the generated table equals the registry, defaults sit inside their bounds, clamping and integer rounding, the whole canary refused on any unregistered key, the closed context field, no canary field in the model-context schema, and the orchestrator running and reporting each arm. Also run: `contextFields`, `snapshotFence`, `orchestrator`, `coreClient`, `context`, `parkStore`, `behavioralTelemetry`, `allianceSession`, `privacy-contract-docs`, `mentorGovernedDefaults` and `live-session`: 387 tests in total. Type-check and lint are clean, and no `.boot-test-` process was left.
- Core (vitest, focused): `mentorCanary.test.ts` has 17 tests. They cover OD-23 eligibility (a minor posture, a teen, a tween, under 18 and no analytics consent are never asked for an assignment), the pool share and its ceiling, exposure before the arm, invalid entries never delivered, the arm stored once or refused, and the reproducible sample. `tutor.test.ts` has 11 new route tests. A verified adult in the pool gets the canary arm with its overrides, and the exposure carries target and age. The control arm carries no override. Five refused populations get no canary and no runtime call: the under-13 kid, the independent teen with opt-in, the unverified declared adult, a revoked verification and a kid-role account. Also covered: outside the pool, an unlisted experiment, a failed runtime, an Oracle that did not announce the field, the close store, an unknown proposal and a malformed arm. `mentorQuality.test.ts` has 6 new tests and `evaluationLoop.test.ts` 1 new test. The whole focused set ran at 489 tests with `mentorQualityRoutes` and `spacedReviewCalibration`. Type-check and lint are clean.
- Dataintel: `experiment-age-eligibility.test.ts` (18, four new: three refused canary shapes and the accepted one). Type-check and lint are clean.
- Frontend: `MentorQuality.test.tsx`, `StaffSections.test.tsx` and `StaffProgramme.test.tsx` (70). Type-check is clean, and the i18n gate is green.
- Repo tools: the new `check-mentor-canary-parity.test.mjs` (7) and `check-mentor-minor-safeguards.test.mjs` (10) turn red on each mutation. `check-mentor-governance.test.mjs` has 28 tests, two of them new and covering eight delivery refusals and five `parameterChanges` refusals. The full `tools:test` ran at 418 tests. The three reds were CODEOWNERS coverage of the two new gates and the ledger before recording; all three were fixed and rerun green.
- Native PostgreSQL 17.6 (lane cluster, port 15920): `database/scripts/verify-mentor-f3-postgres.py` applies all 229 migrations and passes 5 checks:
  - the canary pair is stored, and an unknown arm, a malformed proposal id and a half-written pair are refused;
  - the coverage counts the unknown-age sessions as of their start: no evidence, an under-13 declaration with origin, and an adult declaration made after the start. It excludes the known ages (an adult declaration, a teen declaration, a birth date under 13) and the other windows, and counts only calibrations made before the session (7 sessions, 4 unknown, 2 calibrated, 0.5);
  - anon and authenticated are refused;
  - both migrations replay without changing a row.
- Root: `spec:check` (now including the Fracture-Closure gate), `secrets:check`, `governance:check`, `canary:check`, `minor-safeguards:check`, `telemetry:check`, `evaluation-loop:check`, `alliance:check`, `review-calibration:check`, `judge-calibration:check`, `honesty:check`, `session-end:check`, `check-migrations` and `check-migration-phase` are all green.
- Not run here (the orchestrator runs them per merge): browser matrices, `audit:rebuild`, full service suites, `test:all`.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Who may be in a canary.** Only a learner the Mentor already treats as a verified adult (`resolveMentorSafety`: a service-owned ID verification proves 18+), whose dialogue band is adult and whom the adult analytics rule admits. A declared but unverified adult is excluded, because the Mentor gives that account minor safeguards. In practice canaries reach verified parents who use the Mentor. Widening this to declared adults is a Product and Legal decision under OD-23.
2. **Age sent for a verified adult without an exact age.** Core sends 18, the floor the ID verification proves. To keep that truthful, dataintel refuses any upper age bound on a `mentor.canary` experiment.
3. **Non-parameter Tier 2 changes have no canary path.** A reworded scripted line or a persona tone variant cannot reach a share of sessions. The gate now refuses a proposal that claims a canary without `parameterChanges`, so such a change ships only as a human change. A feature-flagged variant path for wording is future scope.
4. **Starting a canary is a Tier 1 act.** `canaries.json` belongs to `governance.model`, so every canary start or conclusion needs a change-record row with both leads' sign-offs. The lighter alternative is a Tier 2 manifest that still requires the proposal's Stage 0.
5. **Canary share ceiling.** 10% of eligible sessions per arm is proposed, pending calibration. There is no experiment-console screen that creates a canary; staff use the experiment API.
6. **Canary regression rule.** The dashboard's existing disparity rule is reused (2x the control, 5 points, 30 scored sessions per arm). A dedicated Stage 5 threshold was not invented.

### Migrations (the orchestrator renumbers at merge)

- `0228_mentor_canary_arm.sql` (expand: two nullable columns with CHECKs, a pair constraint and a partial index)
- `0229_mentor_age_calibration_coverage.sql` (expand: a new service-role function)

### Open items

- `database/types/database.ts` was not regenerated. Core reads the new columns and the RPC untyped through `serviceRest`, as it does for the other dashboard RPCs.
- No canary has run. The first real proposal through Stage 5 is the acceptance evidence for C.22.
- `safety.age_tier_calibration` needs production data. `safety.fracture_closure` is external: its evidence is the release-readiness JSON.
- Tier 1 sign-offs for the four recorded rows are pending: the Pedagogical Reviewer and the Safety and Trust Lead.

## Checkpoint F3-mentor-finish (lane close)

Sync: `codex/spec-migration-s02` merged into `codex/spec-fix3mentor` with no
new commits to take (already up to date). No uncommitted work was left in the
worktree.

### Adversarial pass against the two audited gaps

- **Gap 1 (C.22 Stage 5 canary delivery).** Every mandated piece exists: the
  manifest, the generated bounds tables and their parity gate, Core's
  verified-adult assignment with the exposure recorded first, Oracle's closed
  context field with clamping and whole-canary refusal, the stored arm, the
  gate that checks delivery, the canary-against-control signal and the reader's
  sample. One hole was found and closed: Oracle trusted Core alone for OD-23. A
  context that carried a canary for a minor-posture session would have run it.
  `applyCanary` now takes the session posture and refuses any canary, control
  arm included, when `session.isMinor` is true, and it defaults to the minor
  posture when none is given. Two new Oracle tests pin it (the function and the
  orchestrator: defaults run, no arm reported). Because `oracle/src/tutor/`
  files are Tier 1, change-record rows were recorded for `governance.model` and
  `mentor.non_negotiables` (sign-offs pending).
- **Gap 2 (C.1 to C.4 metrics).** The Fracture-Closure gate, the coverage RPC
  and both safety signals are in place and gated; nothing half-built was found.
- Authorization stays at the server: Core decides eligibility and the arm, and
  Oracle refuses independently. No rebuilt UI was added beyond staff fixtures
  and labels, which exist in EN, es-MX and pt-BR.

### Final verification (local)

- Type-check and lint clean in `oracle`, `backend`, `dataintel` and `frontend`.
- Full unit suites, once each: Oracle 66 files, 1757 tests; Core 148 files,
  3369 tests (1 skipped, the Postgres-only placement test); dataintel 18 files,
  226 tests; frontend 272 files, 3126 tests; `database`: `check-migrations`
  (229 files), `check-migration-phase`, `check-family-lifecycle` and the 48
  `node --test` tests green (`railway-migrate.test.mjs`, which only spawns the
  dry-run script, is slow on Windows; see the lane report). No `.boot-test-`
  process was left.
- Root: `tools:test` 418 tests (the one red was the Tier 1 change record before
  the rows above were recorded; `check-mentor-governance.test.mjs` then ran 28 of
  28 green), `spec:check`, `secrets:check`, `canary:check`,
  `minor-safeguards:check` and `governance:check` green.

### Lane summary

Built: the C.22 Stage 5 canary delivery path end to end (manifest, Core
assignment for verified adults only, Oracle application with two independent
OD-23 fences, stored arm, delivery-checking governance gate, canary-against-
control signal, reader sample) and the Appendix F section 1.3 safety metrics
(Fracture-Closure Verification gate for C.2 to C.4, the C.1 calibration
coverage RPC, and both safety signals on the Mentor-quality dashboard).
Migrations: `0228_mentor_canary_arm.sql`,
`0229_mentor_age_calibration_coverage.sql` (renumbered at merge). Nothing is
accepted or released.

Still open: `database/types/database.ts` not regenerated for the two
migrations; no canary has run (the first real Tier 2 proposal through Stage 5 is
C.22's acceptance evidence); `safety.age_tier_calibration` needs production
data; six Tier 1 change-record rows from this lane await both leads'
sign-offs; there is no experiment-console screen to create a `mentor.canary`
experiment (staff use the experiment API). Owner questions are the six listed
under F3-mentor.
