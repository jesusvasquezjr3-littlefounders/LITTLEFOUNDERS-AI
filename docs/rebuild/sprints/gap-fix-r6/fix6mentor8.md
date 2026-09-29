# Gap-fix round 6, mentor lane (fix6mentor8)

Branch `codex/spec-fix6mentor8`, 29 September 2026. Three audited gaps, all verified real in the code before they were fixed. Status of every item: implemented and locally verified; not accepted.

## 1. The C.17 control arm had no controlling-language check (C.17; OD-26 / M-12; M-13; Appendix D §3.6)

**Verified real.** `dialoguePolicy(band, 'control')` returned `controllingGate: false` for every band, and the orchestrator catches, repairs and counts a controlling phrase only when the gate is on. Since OD-26, `MENTOR_DIALOGUE_EXPERIMENT_BANDS` defaults to `adult,teen,tween`, so a teen in variant A got "you have to..." turns that were never caught, repaired or counted. Core's report and the transcript rubric also counted the calibrated arm only.

**Built.**
- `oracle/src/tutor/dialogueCalibration.ts`: `CONTROLLING_GATE_BANDS` (teen, adult) and `controllingGateFor(band)`. Both policy branches use them, so the gate follows the band in both arms and under the operator's `off` switch. The control arm keeps what the experiment compares: the uniform ladder, wording and pacing, with no register note.
- `backend/src/services/pedagogy/dialogueCalibration.ts` `summarizeControllingLanguage` counts teens and adults in both arms and reports per-arm counts. `dialogue-calibration-report` names both arms. `transcriptScoring.ts` scores `controlling_language` in both arms; the rubric text and hash are unchanged.
- `agent/tools/check-review-calibration-parity.mjs` (`review-calibration:check`) fails when the gate bands drop teen or adult, when `controllingGateFor` reads anything but the band, or when a policy branch sets `controllingGate` any other way.
- Stage 2 gym: `adult_control` now requires the gate, and a new `teen_control` persona covers a teen in the control arm. Both are proven able to turn red against the pre-fix policy.
- Policy updated in `docs/rebuild/mentor/SPACED-REVIEW-AND-DIALOGUE-CALIBRATION-POLICY.md` §3 and §5.

**Tests.** `dialogueCalibration.test.ts` (gate by band in both arms); `reviewCalibrationSession.test.ts` (a teen and an adult in the control arm: caught, retried once, counted in the close record; a survival delivered and counted; the operator `off` switch keeps the gate on; a tween is not gated); `reviewCalibrationGym.test.ts`; `spacedReviewCalibration.test.ts` (control-arm defect, per-arm counts); `transcriptEvaluation.test.ts`; `check-review-calibration-parity.test.mjs` (three RED cases).

## 2. No equity-drift audit against identity cues (Appendix D §3.7; C.18; C.20 Law 5; Appendix E §3.1 Tier 3)

**Verified real.** The only bias audit (`oracle/src/safety/biasAudit/`) varies how learner text is written (dialect, ASR). Nothing varied the identity cues that reach the model (the nickname and locale among the 14 sealed fields), and nothing measured praise or leniency drift.

**Built** in `oracle/src/safety/equityAudit/`, with policy `docs/rebuild/mentor/EQUITY-AUDIT-POLICY.md`:
- `cues.ts`: 56 names across gender and name origin (en-US 6 origins, es-MX 4, pt-BR 4), two per cell.
- `scripts.ts`: two scripted sessions per locale with identical shape, plus the cue-blind scripted model (zero spend).
- `harness.ts`: replays each session through the real `TutorOrchestrator` with a virtual clock. Only the model call is answered; Core, Depot and the judge are refused offline. The harness keeps the orchestrator's own C.18 honesty facts per turn and every request body.
- `audit.ts`: praise rate, generic-praise share, sycophantic-draft rate, correction rate and unsanctioned-reveal rate. Drift is the spread between groups, within a locale by gender and by origin, and across locales. Tolerances are pre-registered, the minimum sample is 30, and cells below it are `insufficient_data`. A controlled-variation check requires identical request bodies once the nickname and fence nonces are masked, and fails a run whose nickname never reached the model.
- `auditLog.ts` and `audit-log.json`: the record (dry run or live, model, sources hash, verdict), a semi-annual cadence, a material-change trigger (prompt builder, model call, C.18 readers, the audit's own files) and an open-finding rule for a drifting live run. Live evidence warns while pending or stale; `--require-live` fails.
- `oracle/scripts/equity-audit.ts` (`npm --prefix oracle run equity-audit`): dry run, `--json`, `--check`, `--record`, `--live-plan`, and `--live`, which refuses without `EQUITY_AUDIT_LIVE=approved` and a model key.
- `.github/workflows/mentor-equity-audit.yml` runs `--check` monthly. `release:readiness` runs it too.
- C.24 signal `safety.equity_drift` (Safety/Trust Lead, external, zero tolerance), labelled in EN/es-MX/pt-BR. Threshold Recalibration Log rows cover the tolerances, sample, cadence and open finding. The bias-audit policy links the sibling audit (§9a). Governance registry: `oracle/src/safety/equityAudit/**` is in the Tier 1 component `evaluation.stage2_and_bias_audit`.

**Verified.** The dry run covers 224 sessions and 2,240 scripted calls: 35 of 35 cells judged, zero drift, variation controlled, zero delivered false affirmations. It is recorded as the initial entry. `equityAudit.test.ts` (14 tests) proves that a model reading the name is caught for origin praise drift and for gender leniency drift in the drafts. It also covers the control check, whole-word and nonce normalization, the sample floor, and the record, cadence and material-change rules.

## 3. Nothing scheduled or flagged the quarterly Block C threshold review (Appendix F §1.4, Part 3 Stage 7; C.10; C.24)

**Verified real.** The log said "review quarterly" but had no dates. No gate, workflow or signal read it.

**Built.**
- `docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md` now has a machine-read "Review schedule" (reviewers, cadence, first human review due 2026-12-23, last review, next due) and a "Review history" table.
- `agent/tools/check-mentor-thresholds.mjs` reuses the Block D cadence parser. It fails on a malformed schedule, on stale "Last" or "Next" lines, and on a human row that does not name both reviewers. It warns when the review is overdue and fails with `--strict`. It is wired into `spec:check` (warn) and `release-readiness.sh` (`--strict`).
- `agent/tools/mentor-thresholds-quarterly.mjs` and `.github/workflows/mentor-thresholds-quarterly.yml` open the quarter's issue for both reviewers.
- CODEOWNERS entries. C.24 signal `governance.threshold_review` (external).

**Tests.** `check-mentor-thresholds.test.mjs`: 9 tests covering cadence, the move to yearly, RED cases, wiring, the issue and the workflow lint.

## Verification

- Oracle, backend and frontend: `type-check` and `lint` are clean.
- Focused vitest: Oracle, 135 tests in 7 files, plus boundaries, pedagogy gym and feedback honesty. Backend: `mentorQuality`, `evaluationLoop`, `spacedReviewCalibration`, `transcriptEvaluation` and `judgeCalibration`. Frontend: `MentorQuality.test.tsx`.
- Tool tests: thresholds, review-calibration, CODEOWNERS, Block D cadence and governance.
- Root gates: `spec:check`, `secrets:check`, `i18n:check`, `review-calibration:check`, `judge-calibration:check` and `governance:check` all pass.
- No browser, no database, no paid call.

Tier 1 change-record rows were appended, with sign-offs pending, for `mentor.non_negotiables`, `evaluation.stage2_and_bias_audit`, `evaluation.rubric_and_judges`, `measurement.stage7_and_thresholds` and `governance.model`. The integration base already carried an unrecorded `safety.judge` change: commit 95944ae6 edited `check-mentor-minor-safeguards.mjs`. It is recorded with that origin so `governance:check` is green; this lane did not change the component.

## Open

- The live equity-drift run is an owner step (OD-23): `EQUITY_AUDIT_LIVE=approved npm --prefix oracle run equity-audit -- --live --record --trigger initial`, about 5,600 model calls at five repeats. The dry run proves only the harness.
- The Safety/Trust Lead must review the name sets and origin groups per market (native speakers). A gender-neutral set is not yet chosen.
- The first human threshold-log review is due 2026-12-23.
- Tier 1 sign-offs are pending on every row above.
- The staff console's sample fixture (`staffSectionFixtures.json`) does not list the two new signals. It is illustrative, and the dashboard fixture does list them.

## Owner questions (conservative defaults implemented)

1. The first Block C threshold review is due one quarter after the log was created (2026-12-23), not one quarter after a future release, because the Mentor is already live. Confirm, or move it with the release date (never later).
2. The C.17 controlling-language gate stays on under the operator's `TUTOR_DIALOGUE_CALIBRATION=off` kill switch, for teens and adults. It is read as a Tier 1 style constraint, not part of the calibrated register.
3. The equity-drift audit uses the adult moderation posture in its replays: it measures the Mentor's feedback, not moderation, which the bias audit covers, and this keeps the live run to model calls only. Its names are binary-gender sets with engineering-proposed origin groups.
