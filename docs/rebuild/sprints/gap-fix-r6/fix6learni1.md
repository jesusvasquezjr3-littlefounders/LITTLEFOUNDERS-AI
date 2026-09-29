# GAP-FIX-R6 lane fix6learni1 (learning): Block B threshold log and review cadence

Branch `codex/spec-fix6learni1`. One gap, verified real and closed.

## Gap

**Block B thresholds and the quarterly register audit had no due-date tracking, overdue check or calendar trigger.** SPEC: Appendix C Part 1.3 (Threshold Recalibration Log: "every threshold reviewed at least once per defined cadence (proposed: quarterly for the first year, then per major release)"; Age-Band Register Differentiation Audit: "scheduled manual audit (quarterly, proposed)"), Part 3 Stage 6 (Post-Launch Recalibration on the log's cadence), B.17, B.19, B.26 (the 3-miss threshold "calibrated through Appendix C's threshold recalibration log"), B.28, B.23.

Verified before the fix: only the B.19 default band carried a due date (`BAND_REVIEW_CADENCE_DAYS`, the staff panel's `reviewDue`). Every other Block B threshold lived in three prose tables (`S05-FORGE-CONTENT-GATES.md`, `LEARNER-REGISTER-AND-WELLBEING-POLICY.md` §6, `PRACTICE-DIFFICULTY-CALIBRATION.md` §5) with no link to code, no due date and no check. The register audit existed only as MN-03 in the per-release dark-pattern record (45-day release freshness), with no quarterly trigger. Two Forge thresholds (the tone negation and warning-cue windows, the verbatim run) and the young-audience and band ages were inline literals nothing could compare.

## Built

- `docs/operations/BLOCK-B-THRESHOLD-LOG.md`: 42 thresholds (Copy Budget, redundancy, tone, concept cap, misjudgment, regional, practice band and guard rails, review window and trigger, band cadence, Mentor target, judgment floor, replay target, guided review, engagement trend, register ages, release-audit freshness), each with its value, requirement, source, the Forge or Core constant and the database CHECK or seed where one exists. A machine-read "First human review due: 2027-01-15", a review history and a register audit log whose rows are `engineering` or `human`, and the list of data each recalibration reads.
- Forge constants named so they can be compared: `NEGATION_WINDOW_WORDS`, `WARNING_CUE_WINDOW_WORDS` (`tone.ts`), `VERBATIM_RUN_WORDS` (`redundancy.ts`), `YOUNG_AUDIENCE_MAX_AGE` (`budgets.ts`), `WORKING_MEMORY_BAND_MAX_AGE` (`conceptCap.ts`). No value changed.
- `agent/tools/block-b-review-cadence.mjs`: the due dates. The threshold review reuses Block D's parser and schedule (90 days after the latest human review, 365 after four). The register audit stays quarterly, and its last date is the latest of a `human` row in the log's register audit log and a signed release audit in `docs/rebuild/audits/dark-pattern-audits.json` that judged MN-03 (any result except `open`).
- `agent/tools/check-block-b-thresholds.mjs`: fails when a logged value differs from the constant or migration text. It warns when either review is overdue and fails with `--strict`. It runs in `repo-gates.yml`, and `release-readiness.sh` runs it with `--strict`.
- `agent/tools/block-b-reviews-quarterly.mjs` and `.github/workflows/block-b-reviews-quarterly.yml`: on 1 January, April, July and October, the workflow opens one `block-b-review` issue listing both reviews with their owner, last human review and next due date. A malformed record still opens the issue and turns the run red.
- The twin unit tests `backend/src/__tests__/blockBThresholds.test.ts` and `coursegen/src/__tests__/blockBThresholds.test.ts` check the logged values against the live constants. They also check behaviour: the guided-review offers fire exactly at 3, 6, 9 and 12, the register boundaries, the band ages and the Mentor target inside the band. The Forge test also checks the counts no text match can read: the lexicon sizes per locale and the market anchors.
- The three prose tables now point at the log as the record. The tone lexicon comment and README (mandatory-testing row, scheduled-workflow row) are updated too.

## Verified

- `node --test agent/tools/check-block-b-thresholds.test.mjs agent/tools/block-b-reviews-quarterly.test.mjs`: 24 pass. These tests cover drift in the log alone, a Forge constant alone, a Core constant alone, a register boundary alone and a migration alone. They also cover an unchecked or missing key, no review, engineering rows that never count, a signed release audit that moves the register audit, the overdue warning and the `--strict` failure, malformed records, and the workflow schedule and notification lint.
- Backend `blockBThresholds.test.ts`: 8 pass. Coursegen `blockBThresholds.test.ts` plus `contentGates`, `lessonPolicyGates` and `contentGatesSources`: all pass.
- `type-check` and `lint` pass in backend and coursegen. `npm run spec:check`, `npm run secrets:check` and `npm run tools:test` pass. `check-block-b-thresholds.mjs --strict` passes today (both reviews due 2027-01-15).
- No migration, no UI, no copy change (i18n gate not applicable).

## Open

- The first human threshold review and the first human register audit are due 2027-01-15, owned by the Pedagogical Lead with Product and the content team. Every value is still "proposed, pending calibration" until real data exists.
- Owner question (conservative default applied): Appendix C sets the threshold cadence at "quarterly for the first year, then per major release". Release readiness cannot tell a major release from a minor one, so after four human reviews the gate uses a yearly ceiling, the same as Block D. Confirm the ceiling, or name the major-release marker the gate should read.
- Owner question (default applied): the first due date matches Block D's (2027-01-15, one quarter after the planned first release). It must move with the release date and never past it.
