# Threshold Recalibration Log (Block C)

This is the maintained document that Appendix F §1.4 requires. It extends Appendix C's log to the thresholds of the AI Mentor. Every value below is **proposed, pending calibration** until real production data exists to calibrate it. Review each value at least quarterly during the first year. Every change must record its date, reviewer, evidence and the previous value. A threshold and the metric that watches it are recalibrated together, never separately (C.10).

Governance: the values marked Tier 1 are never-automate constraints under C.22. Changing them requires sign-off from the Pedagogical Reviewer and the Safety/Trust Lead.

| Threshold | Value | Tier | Where enforced | Source | Status |
|---|---|---|---|---|---|
| Corroborating-evidence requirement: consecutive qualifying observations before a mastery declaration or a remediation/rescue trigger | 2 | 1 | `oracle/src/tutor/controller.ts` `CORROBORATION_MIN_OBSERVATIONS`; env `TUTOR_CORROBORATION_MIN_OBSERVATIONS` (1–5); Core `bkt.ts` `MASTERY_CORROBORATION_MIN` for the map and planner | Product C.10 (applies as written per owner log §5, line on C.10 two observations) | Proposed, pending calibration; introduced 2026-09-24 (S06.3) |
| "Surprising" correct answer: belief below which a too-fast correct answer is a possible guess and does not count | 0.5 | 2 | `controller.ts` `SURPRISING_CORRECT_BELOW` | Appendix D §2.6 ("surprising correct, possible guess") | Proposed, pending calibration; 2026-09-24 |
| Too-fast-to-read factor: an answer faster than the learner's own median divided by this factor | 3 (existing `GUESS_FACTOR`) | 2 | `controller.ts` | Blueprint §8.3; reused by C.10 | Existing value, now also a C.10 input |
| Rescue floors (graded failures; turns without progress) | 2; 3 (rise with the requirement, never fall below) | 1 | `controller.ts` `propose()` rules 1 and 1b | Pre-C.10 baseline | Unchanged; logged here because C.10 governs them |
| Mastery display bar | posterior ≥ 0.85, attempts ≥ 3, latest consecutive correct ≥ 2 | 1 | Core `tutorMap.ts` `deriveNodeState`; planner frontier | Existing bar plus C.10 | Proposed, pending calibration; corroboration added 2026-09-24 |
| Corroborating-Evidence Compliance Rate target | 100% (hard invariant) | 1 | `backend/src/services/pedagogy/mentorIntegrity.ts` | Appendix F §1.1 | Recalibrate together with the requirement above |
| Mastery Declaration Reversal Rate ceiling (Stage 7 kill switch) | 8% | 2 | `mentorIntegrity.ts` | Appendix F Part 3 Stage 7 | Proposed, pending calibration |
| Reversal window | 90 days | 2 | `mentorIntegrity.ts` | Appendix F §1.1 | Proposed, pending calibration |
| Minimum declarations before a reversal rate is judged | 20 | 3 | `mentorIntegrity.ts` | Engineering default (statistical floor) | Proposed; owner/pedagogy review requested |
| Answer-Reveal Rate ceiling, per persona | 10% | 2 | `mentorIntegrity.ts` | Appendix F §1.2 asks for a ceiling set from a human-rated baseline batch, which does not exist yet; 10% is a placeholder (the untutored MathDial baseline is 66%) | **Placeholder**: replace with the human-rated baseline value before release |
| Minimum sequence turns before a reveal rate is judged | 50 | 3 | `mentorIntegrity.ts` | Engineering default | Proposed |
| Reveal drift tolerance against the previous equal-length window | +2 percentage points | 2 | `mentorIntegrity.ts` | Appendix F §1.2 ("any upward drift is a controller defect") | Proposed; the SPEC reads "any" drift, so the tolerance only absorbs sampling noise and must be reviewed with real variance data |
| Delivered false affirmations | 0 (zero tolerance) | 1 | `mentorIntegrity.ts`; `orchestrator.ts` never delivers a caught draft | Appendix F §1.2 Sycophancy Audit Score | Fixed by the SPEC |
| Session-end signal: session-opening baseline (graded observations) | 4 | 2 | `oracle/src/tutor/sessionEndSignal.ts` `SESSION_END_SIGNAL_DEFAULTS.baselineSize` | Appendix D §2.5 ("against the learner's own session-opening baseline") | Proposed, pending calibration; introduced 2026-09-24 (S06.5) |
| Session-end signal: rolling window; minimum window before evaluation | 8; 6 graded turns | 2 | `sessionEndSignal.ts` `windowSize`, `minWindow` | Appendix D §2.5 ("e.g., last 8–10 graded turns") | Proposed, pending calibration |
| "Surprising" miss: predicted probability of a correct answer at or above which a miss counts | 0.75 | 2 | `sessionEndSignal.ts` `surpriseProbability` | Appendix D §2.5 ("items the learner's own history says they should get right") | Proposed, pending calibration |
| Surprising-miss rate rise over the baseline; minimum surprising misses and expected items in the window | +0.25; 2; 3 | 2 | `sessionEndSignal.ts` | Appendix D §2.5 | Proposed, pending calibration |
| Latency-spread rise over the baseline (SD of ln latency); minimum latency samples | +0.3; 3 | 2 | `sessionEndSignal.ts` | Appendix D §2.5 ("rising response-latency variability") | Proposed, pending calibration |
| Stop offers per session; graded turns before re-offering (counted from the learner's answer) | 2; 4 | 2 | `sessionEndSignal.ts` `maxOffers`, `rearmAfterObservations` | Appendix D §3.6 (bias toward asking, never pestering); Bible 08 §4 | Proposed, pending calibration |
| Firing confirmation: surprising misses in the next graded turns that confirm a firing | ≥ 2 in the next 4 | 3 | `sessionEndSignal.ts` `confirmWindow` | Appendix F §1.1 (precision of the Early-Warning Signal) | Proposed, pending calibration |
| Session-Closing Script Accuracy target | 100% (one wrong script is a defect) | 1 | `backend/src/services/pedagogy/sessionEnd.ts` | Appendix F §1.2 | Fixed by the SPEC |
| Minimum evaluated sessions / labelled firings before the trigger rate / precision is read | 50 / 20 | 3 | `sessionEnd.ts` `SESSION_END_THRESHOLDS` | Engineering default (statistical floor) | Proposed |
| Re-engagement window: a dropout or interruption queues a return message only for a session starting within | 30 days | 2 | `sessionEnd.ts` `reengagementMaxAgeDays` | Appendix D §3.5 (queued for return) | Proposed, pending calibration; owner/pedagogy review requested |
| Behavioral telemetry: session-opening baseline; rolling window; minimum window (learner observations) | 4; 6; 4 | 2 | `oracle/src/tutor/behavioralTelemetry.ts` `TELEMETRY_DEFAULTS` | Appendix D §1.3 (deltas against the learner's own baseline, never absolute) | Proposed, pending calibration; introduced 2026-09-25 (S06.6) |
| Behavioral telemetry: latency baseline samples per channel; slow/fast threshold (absolute z of ln(1 + seconds)); baseline-spread floor | 3; 1.5; 0.35 | 2 | `behavioralTelemetry.ts` `latencyBaselineSize`, `latencyZ`, `latencySdFloor` | Appendix D §1.3–1.4 (response latency, rapid guessing) | Proposed, pending calibration |
| Behavioral telemetry: predicted P(correct) at which a fast miss is carelessness (recorded, not fused) | 0.75 | 2 | `behavioralTelemetry.ts` `knownProbability` | Appendix D §1.4 (gaming vs carelessness) | Proposed, pending calibration |
| Behavioral telemetry: evidence count at full channel strength; verbosity drop at full strength; minimum baseline median words; minimum text observations | 2; 50%; 3; 3 | 2 | `behavioralTelemetry.ts` `countThreshold`, `verbosityDropFull`, `minBaselineWords`, `minTextObservations` | Appendix D §1.3 | Proposed, pending calibration |
| Disengagement signal: elevated fused channels needed to fire | 2 | 2 | `behavioralTelemetry.ts` `minChannels` | Appendix D §1.7 (default to inaction; corroborate, never one cue) | Proposed, pending calibration |
| Check-ins per session; learner observations before re-arming (counted from the answer) | 2; 5 | 2 | `behavioralTelemetry.ts` `maxCheckIns`, `rearmAfterObservations` | Appendix D §1.7 ("a tutor that comments on mood too often ... becomes its own bitter-taste problem") | Proposed, pending calibration |
| Default-to-Inaction Rate floor (Stage 7 kill switch) | 85% | 2 | Core `services/pedagogy/behavioralTelemetry.ts` `TELEMETRY_THRESHOLDS`; `telemetryGym.ts` suite floor | Appendix F §1.2 and Part 3 Stage 7 | Proposed, pending calibration (SPEC value) |
| Disengagement-Repair Initiation Rate target | 100% (one undelivered check-in is a defect and a Stage 7 trigger) | 1 | Core `behavioralTelemetry.ts` | Appendix F §1.2 and Stage 7 | Fixed by the SPEC |
| Automatic rollback: trailing window; minimum evaluated turns before the floor can trip; verdict cache per Core process | 14 days; 300; 10 minutes | 2 | Core `behavioralTelemetry.ts` `TELEMETRY_THRESHOLDS` | Engineering defaults for Stage 7 | Proposed; owner/pedagogy review requested |
| Minimum evaluated turns before the report reads the Default-to-Inaction Rate | 300 | 3 | Core `behavioralTelemetry.ts` `reportMinEvaluatedTurns` | Engineering default (statistical floor) | Proposed |
| Bias-audit cadence (C.20) | 183 days (semi-annual), or immediately on a material change | 2 | `oracle/src/safety/biasAudit/auditLog.ts` `CADENCE_DAYS`; `biasAudit.test.ts`; `.github/workflows/mentor-bias-audit.yml` | Appendix F §1.3 Bias-Audit Coverage | Proposed, pending calibration (SPEC value) |
| Bias-Audit Coverage target | 100% of registered components | 1 | `auditLog.ts` `coverage` | Appendix F §1.3 | Fixed by the SPEC; 91% today (live judge pending, OD-23) |

## Kill-Switch Trigger Log

Record every Stage 7 rollback here: date, knowledge components (`TUTOR_CORROBORATION_ROLLBACK_KC_KEYS`) or the session-end signal mode (`TUTOR_SESSION_END_SIGNAL=shadow|off`, [session-end policy §6](SESSION-END-POLICY.md#6-instrumentation-and-metrics-appendix-f)), cause, who decided, and resolution time. See [Mentor integrity policy §3.3](MENTOR-INTEGRITY-POLICY.md#33-kill-switch-appendix-f-part-3-stage-7). The Behavioral Telemetry Layer's AUTOMATIC rollback writes its own trigger and resolution rows to `audit_logs` (`mentor.kill_switch.behavioral_telemetry.*`), and `npm --prefix backend run tutor:telemetry-report` prints that log with resolution times ([behavioral telemetry policy §5](BEHAVIORAL-TELEMETRY-POLICY.md#5-kill-switch-appendix-f-part-3-stage-7)); copy each trip here with its root cause when it is resolved.

| Date | KCs or component rolled back | Trigger and cause | Decided by | Resolved |
|---|---|---|---|---|
| (none) | | | | |

## Change history

| Date | Change | Evidence | Reviewer |
|---|---|---|---|
| 2026-09-24 | Log created with the C.10 and C.18 thresholds above (S06.2, S06.3) | [S06 sprint record](../sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md) | Pending (Pedagogical Reviewer and Safety/Trust Lead) |
| 2026-09-24 | Added the C.8/C.12 session-end signal and C.16 closing thresholds (S06.4, S06.5) | [S06 sprint record](../sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md#s064-and-s065-implementation-and-rationale-c16-c8c12); `sessionEndGym.test.ts` persona floor | Pending (Pedagogical Reviewer and Safety/Trust Lead) |
| 2026-09-25 | Added the C.9 Behavioral Telemetry Layer, C.19 check-in and C.20 bias-audit thresholds (S06.6, S06.7) | [S06 sprint record](../sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md#s066-and-s067-implementation-and-rationale-c9-c20-c19); `telemetryGym.test.ts` persona floor; `biasAudit.test.ts` | Pending (Pedagogical Reviewer and Safety/Trust Lead) |
