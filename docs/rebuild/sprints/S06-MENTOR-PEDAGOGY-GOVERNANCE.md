# S06: Mentor pedagogy and governance

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; Product, pedagogy team and Safety/Trust for the reviews named by the SPEC (Appendix D/E/F gates). No release approval is recorded.

## Binding acceptance sources

- Product C.5–C.24 (C.8/C.12 tracked as one requirement).
- Appendix D (real-time tutoring framework), Appendix E (self-improvement governance), Appendix F (Mentor metrics/QA).
- Frontend Bible 08 (Diorama stage) for the companion UI work.

Risk classification: **child-facing AI safety and pedagogy**. The Oracle's orchestrator and controller are snapshot-fenced and heavily tested; every new component must ride the park snapshot or be deliberately excluded.

## Point-by-point checkpoints

| ID | Scope | State |
|---|---|---|
| S06.1 | C.13 first-class hint ladder (never-repeat escalation + just-tell-me escape), integrated in the learner-turn path and the park snapshot | Implemented and locally verified; live-conversation and human review pending |
| S06.2 | C.18 anti-sycophancy constraint + answer-reveal-rate instrumentation | Implemented and locally verified; physical-PostgreSQL, live-conversation, calibrated-judge baseline and human review pending |
| S06.3 | C.10 corroborating-evidence rule (two consecutive observations before mastery/remediation) | Implemented and locally verified, built in the same wave as S06.2; physical-PostgreSQL, production metric data and human review pending |
| S06.4 | C.16 four end-reason closing scripts | Implemented and locally verified (the orchestrator's wave label S06.3, built together with S06.5); physical-PostgreSQL, live-conversation, pre-generated audio, stage composition and Tier 1 review pending |
| S06.5 | C.8/C.12 behavioral-signature session-end signal | Implemented and locally verified (same wave as S06.4); physical-PostgreSQL, live-conversation, production metric data, calibration and Tier 1 review pending |
| S06.6 | C.9/C.20 Behavioral Telemetry Layer (signal strength, never emotion labels) + dialect/ASR bias audit | Implemented and locally verified (the orchestrator's wave label S06.4, built together with S06.7); physical-PostgreSQL, live-conversation, production metric data, calibration, fixture review by native speakers, the live judge audit (OD-23) and Tier 1 review pending |
| S06.7 | C.19 disengagement check-in move | Implemented and locally verified (same wave as S06.6); physical-PostgreSQL, live-conversation, pre-generated audio, stage composition (wave 2), production metric data and Tier 1 review pending |
| S06.8 | C.14 self-explanation prompt + quality check | Implemented and locally verified (the orchestrator's wave label S06.5, built together with S06.9); physical-PostgreSQL, live-conversation, pre-generated audio, native-speaker fixture review, production metric data and Tier 1 review pending |
| S06.9 | C.15/C.7 Alliance Controller + disposition profile persistence | Implemented and locally verified (same wave as S06.8); physical-PostgreSQL, live-conversation, the bond proxy live in production, stage and Family Hub composition (wave 2), pre-generated audio, calibration, retention legal review and Tier 1 review pending |
| S06.10 | C.11 two-tier spaced review | Implemented and locally verified (the orchestrator's wave label S06.6, built together with S06.11); physical-PostgreSQL, live-conversation, production routing data, the first quarterly human spot check, calibration and Tier 1 review pending |
| S06.11 | C.17 age-band dialogue calibration | Implemented and locally verified (same wave as S06.10); the owner/Product+Legal decision on enrolling minor bands (OD-23), physical-PostgreSQL, a running experiment and production data, native-speaker review of the controlling-language lexicon and Tier 1 review pending |
| S06.12 | C.5 dynamic judge-sampling rate + C.6 curated activity-pack tier | Implemented and locally verified (the orchestrator's wave label S06.7); physical-PostgreSQL, the human panel's seed-set ratings and the owner-run live judge calibration (OD-23), loading and human release of the 21 seed packs, native-speaker and pedagogical review, production data, staff-console composition (wave 2) and Tier 1 review pending |
| S06.13 | C.21 transcript scoring + anomaly flags + dashboard; C.24 consolidated monitoring | Implemented and locally verified (the orchestrator's wave label S06.8); physical-PostgreSQL, naming the owners, production data and threshold calibration, sign-off of rubric v1, the calibrated transcript judge (C.23), staff-console composition (wave 2) and Tier 3 review pending |
| S06.14 | C.22 tiered governance + C.23 judge calibration process | Implemented and locally verified (the orchestrator's wave label S06.9); physical-PostgreSQL, the two leads' sign-offs (adoption decision and 8 baseline rows), the human panel's ratings and the owner-run live judge calibrations (OD-23), branch protection on main, and Tier 1 review pending |

## S06.1 implementation and rationale

Inspected evidence: hint behavior was per-turn LLM judgment riding the strategy scaffolding (0-3), with no tracked escalation and no guarantee against repeating a hint or against the model withholding an answer when the learner explicitly asked. Appendix D §3.3 mandates a graduated ladder (re-ask → indirect → misconception-targeted → fill-in-the-blank → tell) with a hard never-repeat-a-level rule and an always-honored "just tell me" escape.

`oracle/src/tutor/hintLadder.ts` is the first-class dialogue-manager object: per-sub-step escalation where every registered hint request advances exactly one level (clamping at "tell", which bottom-outs permanently for that sub-step), an explicit tell request (detected in EN/es-MX/pt-BR) jumps straight to the bottom once, and each sub-step is independent and resettable. The ladder serializes to plain JSON (array-of-tuples, like the controller snapshot). The orchestrator owns one ladder per session: on each learner turn the cleaned utterance is classified, the ladder advances, and a policy directive rides the same strategy-instruction the model receives — escalation and the escape hatch are policy, never a request the model may weigh against being "helpful". The ladder is part of the park snapshot (`hintLadder`, defaulted for pre-build sessions), so a cross-replica resume cannot silently reset a learner's place in the escalation; the snapshot-fence test enforces this.

## S06.2 and S06.3 implementation and rationale (C.18, C.10)

The orchestrator assigned C.18 and C.10 to one wave, recorded here as checkpoint S06.2 (C.18) and checkpoint S06.3 (C.10), matching the plan above. Both rules are Tier 1 constraints in the Block C standard. The written policy is [Mentor integrity policy](../mentor/MENTOR-INTEGRITY-POLICY.md). Every threshold is recorded as "proposed, pending calibration" in the new [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md), which Appendix F §1.4 requires.

### Current state found (the SPEC's "Current State" was partly stale)

- **C.10.** The controller already required a posterior of at least 0.85 and three LIFETIME opportunities (seeded from persisted attempts), and it revoked a declared mastery once per KC per session. So a returning learner with old attempts could still be declared master on one correct answer today. A single diagnosed miss went straight to REMEDIATE, including the catalogued hint and the repair catalogue. A correct prerequisite probe remediated the original KC on the one miss that opened the probe. Core's map showed "mastered" from the posterior plus three attempts, so one lucky answer could flip it. RESCUE already needed two consecutive failures or three turns without progress.
- **C.18.** The system prompt already told the Mentor not to praise answers the learner did not give. Deterministic false-praise checks existed, but only for typed arithmetic answers, in Spanish. Every system-prompted verdict turn (a graded activity or a voice check) was exempt, although those are exactly the turns where the server knows the answer was wrong. Nothing addressed unsound money decisions. Nothing measured answer reveals.
- **Existing defect found and fixed.** Oracle always emitted `stated_misconception` trajectory steps, but Core's validator and the table CHECK (0066) did not accept them. Every session containing one therefore lost its whole trajectory batch to a 400 response.

### C.10: the corroborating-evidence rule (Oracle controller, Core map and planner)

- `oracle/src/tutor/controller.ts` keeps two snapshot-carried chains per KC:
  - `masteryEvidence` counts consecutive qualifying correct answers. A hint-assisted correct resets it, and so does a hesitant correct before a revocation. A surprising correct (belief below 0.5) that came too fast to read is neutral. Any miss or stated wrong idea breaks it.
  - `remediationEvidence` counts consecutive misses or stated ideas that agree on the diagnosis. A guess is neutral, and a correct answer clears it.
- Rule 5 (CELEBRATE/TRANSFER) now also needs `masteryEvidence ≥ required`. A misconception code reaches `misconceptionCode`, REMEDIATE, the model's hint and the repair catalogue only once its chain is corroborated. A correct probe remediates only a corroborated original KC; otherwise the probe closes, the learner returns to ordinary teaching, and difficulty is held as before. RESCUE keeps its existing multi-observation floors, which rise, and never fall, with the requirement.
- Every decision carries `kcId` (the KC it was about), `evidence` (`rule`, `observations`, `required`; null when a guardrail held the strategy) and `masteryRevoked`.
- The hint-request signal is wired: `HintLadder.assisted()` is read before each graded or voice verdict. A correct answer closes that ladder sub-step, which completes the S06.1 reset that was built but never called.
- **Configuration:** `TUTOR_CORROBORATION_MIN_OBSERVATIONS` (default 2, range 1–5; out-of-range values fall back to 2, never weaker) and `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS`, the per-KC kill switch from Appendix F Stage 7. The controller's `corroboration` field is constructor configuration, declared in the snapshot-fence exclusion list with its reason. The two chains ride the park snapshot, defaulted for records from the previous build.
- **Event log:** trajectory steps carry `evidenceRule`, `evidenceObservations`, `evidenceRequired` and `masteryRevoked`. The trajectory `kcId` now names the decided KC; it used to be the next KC after a CELEBRATE, which would have broken the reversal-rate join.
- **Core:** `tutorMap.deriveNodeState` requires the latest `kc_attempt` rows to end in at least `MASTERY_CORROBORATION_MIN` (2) consecutive correct answers. The node exposes `consecutiveCorrect` as evidence a parent can read. The planner keeps an uncorroborated KC on the frontier. A failed streak read fails the map or plan and never silently demotes (§1.14).
- **Migrations:** `*_mentor_integrity_evidence.sql` (expand) adds the evidence columns, with a unit CHECK so the three travel together. `*_trajectory_stated_misconception_kind.sql` (contract) widens the event-kind CHECK; the classifier treats any re-added CHECK as a contraction, so it needs operator review.

### C.18: the anti-sycophancy constraint and answer-reveal monitoring

- `oracle/src/tutor/feedbackHonesty.ts` adds the system-prompt rule (`ANSWER_HONESTY_RULE`): praise tied to a specific verifiable act, a hard rule against endorsing an unsound money decision, and no reveal unless requested. It also holds the deterministic detectors for EN, es-MX and pt-BR:
  - `affirmsCorrectness` / `endorsesClaim` separate opening exclamations from unambiguous phrases, guard against negation, and accept effort praise;
  - `statesTheAnswer` ignores questions;
  - `classifyPraise` labels praise specific or generic.
- `produce()` gets a `verdict` from the three server-verified sources (graded activity, voice check, arithmetic verdict) and from a stated wrong idea or unsound decision. A sycophantic draft is repaired once and, if it still affirms, replaced by the scripted line; it is never delivered. The model is also told a stated claim is unsound before it answers.
- `statedMisconception.ts` now reads the unsound-decision patterns (`ignores-downside`, `highest-price-wins`, `budget-is-per-item`, `returns-payment`) in English and Portuguese, with hedge vetoes. It was Spanish-only, so the hard rule could not fire for en-US or pt-BR learners.
- Every turn that `produce()` settles carries `TurnHonesty`:
  - sequence kind (hint ladder, repair, open activity or none) and hint level;
  - whether the reveal was sanctioned (the ladder reached "tell");
  - self-answered question and answer phrase;
  - open segment id and verdict context;
  - false affirmation caught or delivered;
  - praise class.

  These are pure reads, so nothing new enters the park snapshot.
- Core's `POST /tutor/internal/turns` accepts `honesty` through a strict body and writes `tutor_turn_honesty` (RLS on, no client policy, no user id and no text; the session reference becomes NULL at the 90-day purge). Core adds the one fact only it can compute: `reveal_key_match`, from the open activity's real answer key (`answerReveal.ts` covers numeric keys, money trays and multiple choice; unscorable turns are NULL). A failed honesty write never fails the turn.
- `npm --prefix backend run tutor:integrity-report` (read-only, no model call) reports, for C.18, the answer-reveal rate per persona (with drift against the previous window) and per session, delivered false affirmations (zero tolerance) and the praise share, and, for C.10, the Corroborating-Evidence Compliance Rate (hard 100%, with rollbacks reported separately) and the Mastery Declaration Reversal Rate (8% Stage 7 ceiling). It exits with code 1 on any defect, and reports "insufficient data" instead of calling a thin sample healthy.
- `npm run honesty:check`, a new repo gate wired into `repo-gates.yml`, keeps the four hand-mirrored copies of the honesty record identical: Oracle type, Core body, Core writer and migration CHECKs.

### Proposals recorded for owner and pedagogy review

1. **Rescue versus corroborated remediation.** With graded answers alone, the second consecutive miss on the same idea is both RESCUE's trigger and the corroboration point for REMEDIATE. Rule order ("safety rules always win", blueprint §9.3) keeps RESCUE first, so a purely graded misconception is remediated on the third miss. A stated idea plus one miss remediates on the second observation. Kept conservative; the pedagogy team may prefer corroborated REMEDIATE ahead of RESCUE.
2. **Answer-reveal ceiling.** Appendix F asks for a ceiling from a human-rated baseline batch, which does not exist yet. 10% is a placeholder and is marked as such in the log.
3. **Monitoring cadence.** Proposed weekly in the first release. The C.24 dashboard (S06.13) replaces the CLI report as the surface.

### Deploy order (integration step for the orchestrator)

Apply `*_mentor_integrity_evidence.sql` first. Deploy Core next: it writes the new trajectory columns, and its strict trajectory body must accept Oracle's new evidence keys before Oracle sends them. Deploy Oracle last. The contract `*_trajectory_stated_misconception_kind.sql` is applied by the operator with or after that Core release. Until then, a batch containing a stated-misconception step still fails, exactly as it does today. `database/types/database.ts` must be regenerated after the migrations are applied. It was not hand-edited, and Core writes these tables through narrow local types.

## Verification log

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Ladder unit tests | `oracle/`: `npm test -- --run src/__tests__/hintLadder.test.ts` | 7 tests: locale hint/tell classification, exact escalation order, never-repeat, escape hatch, per-step isolation, reset, snapshot round-trip |
| Snapshot fence | `oracle/`: `npm test -- --run src/__tests__/snapshotFence.test.ts` | The fence caught the new field (as designed), then passed after the ladder joined the snapshot |
| Oracle regression | `oracle/`: `npm test` | 41 files, 1,136 tests passed |
| Oracle static checks | `oracle/`: `npm run type-check`, `npm run lint` | Passed, including the scripts and test tsconfigs |

Remaining acceptance boundaries: no live-conversation observation of the ladder in flight, no Appendix F metric for hint-level distribution yet, and no human pedagogy review. C.13 remains in progress.

### S06.2 and S06.3 verification log (24 September 2026)

Executed 24 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. These are local results. There is no real database, no CI run and no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Controller C.10 unit tests | `oracle/`: `npx vitest run src/__tests__/controller.test.ts` | 92 tests pass (18 new C.10 tests: hint-assisted reset, surprising-rapid neutral, fluency not a cage, consecutive only, conversation neutral, disagreeing diagnoses, stated idea twice, RESCUE evidence, a held decision carries no evidence, declaration filed under its own KC, revocation flag, per-KC rollback, a probe remediation judged against the original KC's requirement, raising the requirement, out-of-range config ignored, legacy park record). 10 pre-C.10 tests were rewritten to the corroborated contract, each with the reason in place |
| Orchestrator wiring | `oracle/`: `npx vitest run src/__tests__/orchestrator.test.ts` | 168 tests pass: 2 C.10 end-to-end tests (hint-assisted correct does not count; trajectory evidence) and 7 C.18 tests (graded-wrong affirmation repaired; affirmation surviving repair replaced by the scripted line; the same words left alone after a correct answer; unsound-decision endorsement repaired; sanctioned vs unsanctioned reveal; open-activity id carried). A mutation that disabled the hint-assisted signal turned the C.10 test red, and it was restored |
| Honesty detectors | `oracle/`: `npx vitest run src/__tests__/feedbackHonesty.test.ts` | 41 tests pass (affirming vs honest sentences in 3 locales, endorsements, questions not read as reveals, praise classes, rule present in the system prompt). The first run found 3 false positives ("Certo, …", "What do you think the answer is?", a dash after "Great job"); the detectors were fixed and the tests kept |
| Unsound decisions in EN/pt-BR | `oracle/`: `npx vitest run src/__tests__/statedMisconception.test.ts src/__tests__/instrumentSpecs.test.ts` | 56 tests pass (8 new detections, 8 new must-stay-silent cases; codes stay inside the KC registry) |
| Park snapshot fence | `oracle/`: `npx vitest run src/__tests__/snapshotFence.test.ts` | Red on the new controller field (as designed), then green: 10 tests, with both chains round-tripped and `corroboration` excluded with its reason |
| Sequence gate | `oracle/`: `npm run verify:pedagogy` | OK, with 9 profiles (3 new C.10 profiles). The gate now recomputes corroboration independently from the event script and asserts that REMEDIATE stays reachable. The first run found a difficulty rise after a probe closed without remediation, which was fixed by holding difficulty |
| Simulated students | `oracle/`: `npm run gym:pedagogy` | OK, 4 archetypes, no guardrail violations |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npm test`, `npm run verify:tutor` | Pass; 42 files, 1,222 tests (1,136 before this wave); privacy boundary sealed |
| Core reveal check and monitor | `backend/`: `npx vitest run src/__tests__/mentorIntegrity.test.ts` | 21 tests pass (numeric, tray, multiple-choice and unscorable key checks; defect, drift, insufficient-data, per-persona and per-session logic; zero-tolerance; compliance hard invariant; rollback reporting; reversal window) |
| Core routes (adversarial) | `backend/`: `npx vitest run src/__tests__/tutor.test.ts src/__tests__/pedagogy-routes.test.ts src/__tests__/tutorMap.test.ts` | 246 tests pass. They cover: honesty row with key match; scaffolding scored as no reveal; another session's segment refused (NULL); learner turn never scored; unknown honesty field → 400; failed honesty write does not fail the turn; trajectory evidence persisted; partial evidence → 400; `stated_misconception` accepted; map not mastered on one lucky answer; planner keeps it on the frontier; failed streak read fails closed |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npm test` | Pass; 71 files, 1,505 tests (1 skipped, pre-existing) |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, `node --test scripts/check-migration-phase.test.mjs scripts/gate-auto-apply.test.mjs scripts/publish-course.test.mjs` | 113 files sequential, RLS covered; the expand/contract declarations agree with the SQL; 21 Node checks pass |
| Database gate, full | `database/`: `npm test` (Git Bash PATH), run after the final migration edits | Pass: 113 files sequential with RLS covered, phase declarations agree (92 expand, 21 contract), 21 Node checks, and the Railway transport suite green (12 scenarios plus the static probe-map and DEPLOYMENT.md cross-checks). An earlier run failed its checksum-drift scenario on the mentor-integrity migration only because the header comment was edited while that run was in flight (the suite hashes every file at start); the clean rerun on the final files passed. The suite took about 70 minutes under the six-lane load |
| Honesty parity gate | `npm run honesty:check`; `node --test agent/tools/check-mentor-honesty-parity.test.mjs` | OK; 5 tests (green on the tree, red on a missing field, vocabulary drift, a migration CHECK mismatch and a new hint level) |
| Repo gates | `npm run spec:check`, `npm run secrets:check`, `npm run tools:test` | Pass (61 tool tests) |
| Resume review (after the usage-limit interruption) | Re-read of the uncommitted controller diff, then `oracle/`: `npx vitest run src/__tests__/controller.test.ts` and the full Oracle and Core suites again | Found one defect: a correct probe that remediated the original KC recorded the PROBE entry's requirement as `evidence.required`. With a Stage 7 rollback on only one of the two KCs, a compliant remediation would have read as a compliance violation (or the reverse). Fixed to record the original KC's requirement, with a regression test (92 controller tests). Also clamped the trajectory's `evidenceObservations` to Core's wire bound (0–100), because one oversized count would otherwise cost the session its whole trajectory batch, and removed the hardcoded migration numbers from the two migration headers (the orchestrator renumbers at merge). Oracle 1,222 and Core 1,505 tests pass; `verify:pedagogy`, `gym:pedagogy`, `verify:tutor` OK |

Remaining acceptance boundaries (C.10 and C.18 stay In progress):

- The migrations have not been applied to a physical PostgreSQL, and types have not been regenerated.
- No live or canary conversation has exercised the new paths (OD-23 allows zero paid spend).
- There is no calibrated-judge transcript score yet. That is the authoritative source of the Answer-Reveal Rate and of the paraphrase-level sycophancy audit (C.21/C.23, checkpoints S06.13–S06.14).
- The reveal ceiling is a placeholder until a human-rated baseline exists.
- No production metric data exists; Appendix F's "Measured" criterion needs one release cycle.
- Pedagogical Reviewer and Safety/Trust Lead sign-off (Tier 1) is pending.
- The key-based reveal check covers numeric, tray and multiple-choice activities only.
- There is no parent-facing surface for the evidence yet (`consecutiveCorrect` is exposed by the map API only).

## S06.4 and S06.5 implementation and rationale (C.16, C.8/C.12)

The orchestrator assigned C.16 and C.8/C.12 to one wave and labelled it checkpoint "S06.3". This record already uses S06.3 for C.10, so the wave is recorded here as S06.4 (C.16) and S06.5 (C.8/C.12), matching the plan above. It was started by an earlier agent that was interrupted by a usage limit; the uncommitted work it left (the three new Oracle modules, the scripted lines and most of the orchestrator wiring) was reviewed line by line, kept where it matched the SPEC, corrected where it did not (listed below) and finished. The written policy is the [Mentor session-end policy](../mentor/SESSION-END-POLICY.md); every threshold is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found (the SPEC's "Current State" was accurate, with one aggravating detail)

- **C.16.** Every session closed on one of two positive templates: `SOFT_CLOSE` ("We did great work today…") and `HARD_CLOSE` ("That is our time for today. You worked hard…"). A stopped (safety) session asked for another turn got `HARD_CLOSE`, and so did the farewell of a stopped session. The input classifier ran only AFTER the ended-budget check, so a disclosure typed in the last second of a session was answered with the cheerful time-is-up line. The model wrote its own goodbye and a unilateral "what you learned" summary under the wrap-up instruction. Nothing was queued for a learner who silently left. Close reason was recorded; the script used was not.
- **C.8/C.12.** Session management was purely clock- and turn-based (`session/budget.ts`). No latency-variability or surprising-miss measure existed. The controller mirrored BKT posteriors but exposed no predicted P(correct).

### C.16: the four closing scripts (Oracle)

- `oracle/src/tutor/sessionClosing.ts` owns the reason → script table (`completed`/`soft_budget` → completed; `hard_budget`/`error`/`consent_revoked` → interrupted; `learner_left`/`abandoned` → learner_left; `safety_stop` → safety_stop), the closed vocabulary of observed acts a completed close may name (`corroborated`, `recovered`, `hint_then_solved`, `kept_going`, `talked_through`, `none`), the snapshot-carried `SessionCloser` (phase and the facts behind the act), and the openings.
- `scripted.ts` replaces the two generic closes with 13 human-written lines in three locales: the recap question, six completed closes (one per act), the interrupted close, the calm safety close and four re-engagement openings. All 25 catalogue texts × 4 characters × 3 locales (300 clips) stay pre-generatable.
- `orchestrator.ts`: the SYSTEM owns the close. A model turn never carries it: `TurnOutcome.after` queues the scripted closing line after the model's turn and `ws/server.ts` delivers the two in order (awaiting the first clip), closing on `after`. A Mentor wrap-up (`next: "close"`) becomes the recap question; the learner's answer gets a one-sentence reflection (model, with every honesty check, a stated wrong idea never praised) followed by the effort line; a budget end (grace turn or a turn that crossed the cap) is followed by the interrupted line; a stopped session always gets the safety close. The classifier now runs before the budget close and before the recap answer. The wrap-up and final-turn instructions and the system prompt tell the model not to say goodbye or list what was learned. A model failure on a closing turn delivers the closing line alone, never "say that again" on the way out.
- `ws/server.ts` greets with the opening Core decided, sends `session_closing {script, effort, topic}` before `closed`, and reports `closingScript`, `opening` and the signal record on BOTH close paths (graceful `finish()` and the parked `finalizeParked()`).

### C.8/C.12: the behavioral-signature session-end signal (Oracle)

- `oracle/src/tutor/sessionEndSignal.ts` implements Appendix D §2.5 exactly: after a 4-observation session-opening baseline, over a rolling window of recent graded turns, it fires only when BOTH the SD of ln(latency) and the surprising-miss rate (misses on items the learner's own history predicts at P(correct) ≥ 0.75) have risen over that learner's baseline. Elapsed time and turn count are not inputs (the clock only stamps a firing). It records signal strength only.
- Graded observations come from activity grades (server-measured latency), spoken-answer verdicts and verified conversational answers (no latency: speech and typing times are not answer times). `PedagogicalController.predictedCorrect()` and the dormant path's skill estimate are read BEFORE the answer's evidence is applied.
- The offer: the Mentor's reacting turn carries `SESSION_END_OFFER_INSTRUCTION` (two equal choices, no feelings described, no activity, no second question) instead of that turn's maneuver, and the server sends `session_end_offer`. The learner answers with `session_end_response` (refused with `NO_SESSION_END_OFFER` unless an offer is open) or in words (`classifyStopReply`: only an explicit stop accepts, only an explicit "keep going" declines, "yes"/"ok" is neither). Accepting starts the completed close; declining continues. At most 2 offers, re-armed 4 graded turns after the learner's answer. A firing whose turn could not carry it (scripted fallback, moderation block, interrupt, context-seal failure) is recorded `not_offered` and re-arms; `produce()` now wraps every exit so an offer is never left pending.
- `affectClaims.ts` enforces the Block C non-negotiable on EVERY model turn: a declared emotional/fatigue state of the learner (EN/es-MX/pt-BR; questions, conditionals, third parties and the Mentor itself excluded) is repaired once and never delivered.
- Stage 7 kill switch: `TUTOR_SESSION_END_SIGNAL=offer|shadow|off` (unknown → `offer`, never a silent off). The signal and the closing state ride the park snapshot (fence test green).
- Stage 2 simulated students: `src/tutor/sessionEndGym.ts`, run by `npm run gym:pedagogy`, holds seven personas (disengaging, frustrated, slipping, gaming, reactant teen, masking, steady) with the behaviour each must get, and every persona is proven able to turn red against a deliberately broken signal.

### Core, database and metrics

- Migration `*_mentor_session_end_and_closing.sql` (expand): `tutor_sessions.closing_script`, `opening`, `end_signal_evaluated` (CHECKed vocabularies) and the new `tutor_session_end_signal` table (persona, session SET NULL at the purge, numbers only; RLS on, no client policy; unique per session and observation).
- `backend/src/services/pedagogy/sessionEnd.ts`: the mirrored vocabularies and table, `decideOpening` (the queued re-engagement from Core's own row of the previous closed session: `hard_budget` → interrupted wording, `learner_left`/`abandoned`/`error` → "left" wording, `_resume` on the same skill/topic/course, nothing after a safety stop, a consent revocation or a completion, nothing past 30 days, and the plain greeting on a failed read), the firing writer and the pure Appendix F summaries.
- `POST /tutor/internal/sessions/:id/close` accepts the three new fields (optional, so an older Oracle still closes; strictly validated, so an emotion label or a `pending` outcome is a 400) and writes firings only when its own close landed. `GET /tutor/internal/sessions/:id` returns `opening`.
- `npm --prefix backend run tutor:session-end-report` (read-only, no model call) reports Session-Closing Script Accuracy (hard 100%, exit 1 on one wrong script), the openings delivered, and the Early-Warning Signal Trigger Rate, precision, offer outcomes, shadow firings and the persona split (diagnostic).
- `npm run session-end:check` (new repo gate, wired into `repo-gates.yml`) keeps the Oracle, Core, migration and client copies identical.

### Frontend (client API layer and rebuilt surfaces)

- `src/tutor/types.ts` and `useTutorSocket.ts`: `session_end_offer`, `session_closing` and `session_end_response`; `sessionEndOffer`, `closingSummary` and `answerSessionEnd()` (cleared on a new turn, on answering and on a new session).
- `src/rebuild/mentor/SessionEnd.tsx`: `SessionEndChoice` (two equal `Button`s, same variant and size, no default, no focus stolen) and `SessionClosing` (one heading and one summary line from the script and the observed act, the next topic as `data`, one action back to the path; the safety stop shows no topic and no praise). Tokens only, light and dark, 48 px targets, every string with its copy role, EN/es-MX/pt-BR copy within the 6–9 budget. Previewed at `/rebuild.html?screen=mentor-session-end&script=…`.
- Not mounted on the live stage in this wave: the stage composition is wave-2 work on the finished design system, and the legacy screen is not restyled. On today's screen the learner answers the offer in words and hears the scripted closing line.

### Corrections made to the interrupted agent's draft

1. `beginCompletedClose` returned a Promise typed as a value (type error).
2. The new snapshot field did not match the orchestrator member (`closer` vs `sessionClosing`): the snapshot fence was red; the member was renamed.
3. The predicted P(correct) for activity and voice grades was read AFTER the skill estimate was nudged with the same answer, so a miss partly judged itself; it is now read first.
4. The re-arm window counted from the firing, so observations made while an offer sat open let the signal re-offer immediately after a decline; it now counts from the answer.
5. `classifyStopReply` used `\b` around accented words, so "ya terminé" or "aún no" never matched; whole-word matching is now Unicode-aware.
6. Five scripted lines exceeded the 6–9 Mentor budget; they were shortened.
7. The env doc comment for the rollback key list had been separated from its field.
8. `produce()` never marked the offer delivered or not delivered, never appended the closing line and never checked affect claims; all three were missing and were built.

### Proposals recorded for owner and pedagogy review

See [session-end policy §7](../mentor/SESSION-END-POLICY.md#7-proposals-recorded-for-owner-and-pedagogy-review): leaving by choice skips the recap question; the 30-day re-engagement window and the `error` mapping; the proposed signal thresholds; voice-only sessions cannot fire the signal until C.9 supplies a spoken-answer latency; stage composition in wave 2; the one-time pre-generation of the 156 new clips needs the owner's approval under OD-23.

### Deploy order (integration step for the orchestrator)

Apply `*_mentor_session_end_and_closing.sql` first. Deploy Core next (it accepts the new close fields as optional and starts returning `opening`). Deploy Oracle last. (Corrected in S06.6: as written, this order would have made every session refuse to start in the gap, because the deployed Oracle's strict context schema rejects `opening`. Core now sends `opening` only to an Oracle that announces it, so either order is safe; see the S06.6 deploy order below.) The frontend is independent (it only reacts to frames an older Oracle never sends). Regenerate `database/types/database.ts` after the migration; Core writes the new columns through narrow local types. Run `npm run speech:pregenerate` in `oracle/` when the owner approves the one-time synthesis.

### S06.4 and S06.5 verification log (24 September 2026)

Executed 24–25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. Local results only: no real database, no CI run, no live model or voice call, no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Resume review | `git status`/`git diff` of the interrupted work, then `npm run type-check` and the full Oracle suite on it as found | 1 type error, 2 red tests (snapshot fence on the misnamed member; the scripted-catalogue count). Eight defects fixed (list above) |
| Signal unit tests | `oracle/`: `npx vitest run src/__tests__/sessionEndSignal.test.ts` | 24 pass: fires only on BOTH halves; not on latency alone, misses alone, hard-item misses, unknown predictions, an erratic-from-the-start baseline; clock never decides; baseline and minimum window; pending/delivered/not-offered/accepted/declined/unanswered; one offer at a time; max 2; re-arm from the answer; confirmation labels; shadow and off; snapshot round trip; stop replies in 3 locales incl. negated stops. First run: 2 red (re-arm from the firing; accented `\b`), both fixed |
| Closing scripts | `npx vitest run src/__tests__/sessionClosing.test.ts` | 12 pass: every close reason maps to one of four scripts; act precedence; no act claimed without evidence; snapshot; every closing/opening line within the 6–9 Mentor budget in 3 locales (first run found 5 over-budget lines, shortened); no positive template; safety close neutral and praise-free; no celebration; re-entry point named; every line in the pre-generated catalogue |
| Affect claims | `npx vitest run src/__tests__/affectClaims.test.ts` | 23 pass (12 declarations caught in 3 locales; questions, conditionals, third parties and the Mentor itself left alone) |
| Pipeline integration | `npx vitest run src/__tests__/sessionEnd.test.ts` | 15 pass: safety close for a stopped session and its farewell; a disclosure after the budget ended gets the safety line; interrupted close without a model call; grace turn + system-added interrupted line; wrap-up → recap question → reflection + effort line; recap answer classified for safety first; farewell names the act; model failure still closes with the effort line; queued opening delivered and recorded; the offer through the real pipeline (fires before 15 minutes with more than 10 minutes left, supersedes the maneuver, decline continues, replay refused, accept starts the recap, words: "yes" is unanswered); shadow never offers; an affect claim repaired and, if it survives, replaced. First run: the offer tests were red because the fixture's skill state failed the strict context seal, which exposed a real gap (an offer left pending by an early return); fixture fixed and `produce()` wrapped |
| Server end to end | `npx vitest run src/__tests__/live-session.test.ts` | 61 pass, incl. 3 new over a real websocket: `session_closing` before `closed` with the completed script and act, and the close journal carries `closingScript`, `opening` and `endSignal`; the queued opening greets a returning learner with no model call; a forged `session_end_response` is refused (`NO_SESSION_END_OFFER`, no model call, no close) and a malformed one is a validation error |
| Simulated students | `npx vitest run src/__tests__/sessionEndGym.test.ts`; `npm run gym:pedagogy` | 7 pass; gym OK (4 controller archetypes, 7 session-end personas). First run: 3 mutation tests stayed green (personas not sensitive, and the re-arm check judged against the broken config); personas reworked (frustrated on hard items at an erratic pace, a new slipping persona) and checks moved to the policy values |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:pedagogy`, `npm run verify:tutor` | Pass; 47 files, 1,305 tests (1,222 before this wave); privacy boundary sealed |
| Core route tests (adversarial) | `backend/`: `npx vitest run src/__tests__/tutor.test.ts -t "C.16"` | 18 pass: close writes script/opening/evaluated and one firing row (no user id, text or label); an older Oracle's close names none of the new columns; unknown script, unknown opening, a smuggled `emotion` field, a `pending` outcome, a rate over 1 and 11 firings are each a 400 that closes nothing; a lost first-close race writes no firings; a failed firing write never fails the close; a learner session (even the owner) is 403; the context queues `reengage_left_resume` and `reengage_interrupted_fresh`, and the greeting after a safety stop, consent revocation, completion, failed read or first session |
| Core unit tests | `npx vitest run src/__tests__/sessionEnd.test.ts` | 11 pass (opening decisions and staleness; the table; accuracy 100% / one-wrong-script defect / insufficient data; trigger rate, precision, persona split, diagnostic status) |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 72 files, 1,534 tests (1 skipped, pre-existing) |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 213 files, 2,201 tests, incl. `SessionEnd.test.tsx` (9), `sessionEndSocket.test.tsx` (3) and the extended preview copy-budget test. First full run: 1 red (`designClasses`: a hardcoded element id and an undefined preview class), fixed with `useId` and a defined class |
| Real-Chrome matrix | `frontend/`: `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-session-end.mjs` | 96 configurations (3 locales × 2 themes × 320/375/768/1280 px × 4 scripts), 0 findings, plus keyboard focus + Enter, pointer hit-test and reduced motion. The FIRST run also reported 0 findings, but the screenshots showed each panel stretched to a full screen (`.lf-rebuild` is a 100dvh page root) and, in dark mode, chips with no visible boundary. Both fixed, and the matrix gained proportion and chip-boundary checks so a number can no longer pass what the eye rejects. Screenshots reviewed: `completed-es-MX-light-375`, `interrupted-es-MX-dark-375`, `interrupted-es-MX-light-1280`, `safety_stop-en-US-dark-1280`, `completed-pt-BR-light-1280` (in `audit-results/rebuild-session-end/`) |
| i18n | node steps of `agent/tools/check-i18n.sh` (key parity), `node agent/tools/check-hardcoded-strings.mjs`, `node agent/tools/check-t-keys.mjs` | Pass |
| Parity gate | `npm run session-end:check`; `node --test agent/tools/check-session-end-parity.test.mjs` | OK; 8 tests (green on the tree, parsers read the real vocabularies, red on a table drift, a migration CHECK gap, a missing Core field, a client drift, an Oracle-only opening, a one-sided close reason) |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (rerun with every new file staged), `npm run tools:test`, `npm run honesty:check` | Pass; 69 tool tests (61 before this wave + 8 new) |
| Migrations (static) | `database/`: `npm test` (Git Bash PATH) | Pass: 114 files sequential with RLS covered (the new table included), phase declarations agree (93 expand, 21 contract), 21 Node checks, and the Railway transport suite green (12 scenarios plus the static cross-checks) |

Remaining acceptance boundaries (C.16 and C.8/C.12 stay In progress):

- The migration has not been applied to a physical PostgreSQL, and types have not been regenerated.
- No live or canary conversation has exercised the closing scripts or the offer (OD-23: zero paid spend); the 156 new clips are not pre-generated.
- The choice and closing surfaces are not composed on the live stage (wave 2), and the `frontend/verification-tools` text-fit/proportion/copy-budget audits have not run against the real app driver for them.
- No production metric data exists: Appendix F's "Measured" criterion needs one release cycle; the Trigger Rate baseline and every signal threshold are uncalibrated.
- Voice-only and conversation-only sessions cannot fire the signal (no answer latency) until C.9.
- Pedagogical Reviewer and Safety/Trust Lead sign-off (Tier 1: the safety-close and no-affect-claim constraints) is pending.

## S06.6 and S06.7 implementation and rationale (C.9, C.20, C.19)

The orchestrator assigned C.9, C.20 and C.19 to one wave and labelled it checkpoint "S06.4". This record already uses S06.4 for C.16, so the wave is recorded here as S06.6 (C.9 and C.20) and S06.7 (C.19), matching the plan above. It was started by an earlier agent that was interrupted by a usage limit; its uncommitted work (the telemetry layer, the lexicon, the check-in wiring, the Stage 2 personas and the bias-audit registry, fixtures and runner) was reviewed, kept where it matched the SPEC, corrected where it did not (listed below) and finished. The written policies are the [behavioral telemetry policy](../mentor/BEHAVIORAL-TELEMETRY-POLICY.md) and the [bias-audit policy](../mentor/BIAS-AUDIT-POLICY.md); every threshold is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found (the SPEC's "Current State" was accurate)

- **C.9.** No layer read the learner's behaviour. The adaptation-offer mechanism existed, but nothing decided when to use it from how the session was going. The C.8 signal (S06.5) reads two graded-answer measures only.
- **C.19.** Nothing made the Mentor check whether it was helping. A repair happened only when the model chose to ask.
- **C.20.** No component was audited against dialect or speech-to-text variation. The first audit run found real gaps in moderation, in the C.13 hint ladder and in the C.8 stop reply (below).

### C.9: the Behavioral Telemetry Layer (Oracle, with the automatic rollback in Core)

- `oracle/src/tutor/behavioralTelemetry.ts` computes eight channels per learner turn, each against that learner's own session-opening baseline: latency shift (slow AND unproductive only), rapid guessing, verbosity drop, repeated answers, hedging rise, off-topic drift, hint abuse, and fast misses on known items (carelessness, recorded but not fused). It reads only what a session already produces (words, reply latency, verified grades, the controller's prediction made before the answer, help requests). Its output is numbers; it never outputs, stores or reports an emotion label.
- `telemetryLexicon.ts` holds the lexical readers (hedging, minimal replies, off-topic with regional money words, answer normalization across digits and number words in three languages, the check-in reply). They read folded text, so speech-to-text without accents is read like typed text.
- Fusion: the disengagement signal fires only when two independent fused channels are at full strength at once; at most two check-ins per session, re-armed five observations after the learner's answer. The Default-to-Inaction Rate is counted as evaluated turns against acted turns.
- Reply latency: Oracle notes when each Mentor turn will have finished playing; typed replies are timed from their arrival, streamed spoken replies from the microphone press. Activities use the server-measured grading latency.
- The layer rides the park snapshot (fence test green) and has a Stage 7 switch `TUTOR_BEHAVIORAL_TELEMETRY=act|shadow|off` (unknown means `act`).
- **Automatic Stage 7 rollback (Core).** `backend/src/services/pedagogy/behavioralTelemetry.ts` evaluates, on each new session's context, the Default-to-Inaction Rate (floor 85%, at least 300 evaluated turns) and the Disengagement-Repair Initiation Rate (hard 100%) over act-mode sessions closed in the trailing 14 days and after the last resolution. A trip is written to `audit_logs` and makes Core send `behavioralTelemetryMode: 'shadow'`; Oracle applies the stricter of that and its own switch. The trip holds until an operator resolves it (`tutor:telemetry-report -- --resolve`). A failed read never trips it.

### C.19: the check-in and repair initiation (Oracle, Core, client)

- The Mentor's reacting turn is told to react in one sentence and ask nothing, and it is stripped of activities, adaptation offers and maneuvers. The SYSTEM then adds the human-written check-in ("Let me check I'm really helping. Are we on the same page?", three locales, 12 words or fewer, one question), so it happens on every firing. The server sends `check_in`; the learner answers on two equal chips (`check_in_response`, refused with `NO_CHECK_IN` unless a check-in is open) or in words.
- "Yes" continues the plan. "Not really" is the repair: the plan does not continue as if nothing happened; the Mentor says it will explain it another way and offers ONE adaptation (never one already declined), or re-explains with a new example when none is left.
- A check-in a turn could not carry is carried by the next learner turn and the missed turn is counted, so an unanswered end reads `undelivered` (a real miss). A safety stop or a closing supersedes it. The check-in wins over the C.8 stop offer on the same turn (the offer re-arms).
- Core records the counts on `tutor_sessions` and each firing, with its strengths and outcome, in `tutor_telemetry_firing` (migration `*_mentor_behavioral_telemetry.sql`, expand, RLS on, no client policy, no user id, no text). The strict close body refuses any other field. `npm --prefix backend run tutor:telemetry-report` reports both Appendix F metrics and the Kill-Switch Trigger Log. `npm run telemetry:check` keeps every copy identical (in `repo-gates.yml`).
- Client: `check_in` / `check_in_response`, `checkInOpen` and `answerCheckIn()` in the socket layer; `src/rebuild/mentor/CheckIn.tsx` is the two-chip surface (equal `option` controls, no default, no modal, tokens only, light and dark, 48 px targets, three locales within the 5-word option budget), previewed at `/rebuild.html?screen=mentor-check-in`. It is not mounted on the live stage in this wave (composition is wave 2); on today's screen the learner answers in words.

### C.20: the bias audit (Oracle)

- `oracle/src/safety/biasAudit/` holds the registry of every lexical component feeding C.9, the check-in and stop replies and moderation (11 components, including the model judge as live-only), 78 paired fixture items with 468 variants across six groups (standard, regional, vernacular including African American English, code-switch, child spelling, ASR artifacts), five fused-parity session cases, and the runner (accuracy, parity, fused parity, false-positive and false-negative counts per locale and group, known gaps reported on every run).
- Enforced cadence: `audit-log.json` records each passing run with every component's source hash. Oracle's `npm test` fails when an audited component changed since the last recorded audit; `npm run bias-audit -- --check` also fails past the semi-annual cadence, and the new scheduled workflow `mentor-bias-audit.yml` runs it monthly. The paid live judge audit is a plan (`--judge-plan`) plus an owner-run step (`--judge-live`, refused without `BIAS_AUDIT_JUDGE_LIVE=approved`); coverage counts the judge as not covered until then (91%).
- **What the first run found and what was fixed** (details in [bias-audit policy §6](../mentor/BIAS-AUDIT-POLICY.md#6-first-run-25-september-2026-findings-and-decisions)): the input classifier missed "I wanna die" and "I just want to die", had no Portuguese "eu quero morrer" pattern at all, missed a child naming the person who hits them in English ("my stepdad hits me"), Mexican "me madrea", Brazilian "me espanca", and the Latin American address order ("calle Hidalgo 45"); these rules were widened (Tier 1, listed for Safety/Trust review). The C.13 hint ladder had no Portuguese hint or tell phrase and did not read "I need help", "decime" or "échame la mano"; fixed. Minimal replies, number words, the check-in reply and the stop reply had regional, child-spelling and ASR gaps; fixed. One known gap is kept, not fixed: Mexican "pelado" (a cheeky person) trips the adult-content list, because narrowing a moderation rule is a Tier 1 decision (owner question below).

### Defects found in the earlier S06 work and fixed here

1. **Duplicate turn seq (C.16, S06.4).** When a system line followed a model turn (the C.16 closing line), the model turn's emission read `this.seq` after the follower had reserved the next number, so both went out under one seq. `tutor_turns` is unique on `(session_id, seq)` with ignore-duplicates, so one of the two rows was silently dropped from the transcript. The emission now captures its own seq first; the check-in test asserts `seq + 1`.
2. **Context deploy order (C.16, S06.4).** Core sent `opening` unconditionally, but Oracle's context schema is strict: deploying Core before Oracle (the order the S06.4 record gave) would have made every session refuse to start. Core now sends an optional context field only when Oracle announces it (`x-oracle-context-fields`), so the deploy order of the two services no longer matters. The field lists are in the parity gate.
3. **Hedging pattern (draft).** One hedging pattern's letter class had lost its escape, so "that don't make no sense" (AAE negative concord) was not read. The lexicon test found it.

### Corrections made to the interrupted agent's draft

1. The hedging escape above (1 red test).
2. The bias-audit test, the CLI, the audit log, the cadence enforcement and the policy that the registry and fixtures referred to did not exist; they were built.
3. Nothing on the Core side existed. Oracle would have sent `behavioralTelemetry` to a Core that silently strips it (its close body is not strict at the top level), so no metric could be computed. Core's body, writer, migration, report and automatic rollback were built.
4. The kill switch was operator-only; Appendix F Stage 7 asks for an automatic rollback condition, now in Core.
5. The client had neither frame nor surface; both were built.
6. The verbosity code-switch fixture said more than its standard form; the fixture was corrected, not the component.

### Proposals recorded for owner and pedagogy review

See [behavioral telemetry policy §8](../mentor/BEHAVIORAL-TELEMETRY-POLICY.md#8-proposals-recorded-for-owner-and-pedagogy-review) and [bias-audit policy §6 and §10](../mentor/BIAS-AUDIT-POLICY.md#10-limitations-and-open-items): per-age-band channel weights belong with C.17; the chip labels; the automatic-rollback window, minimum sample and cache; the one-time synthesis of the 12 check-in clips needs owner approval under OD-23; the "pelado" known gap needs a Safety/Trust decision; the live judge audit needs owner-approved spend; fixtures need native-speaker review.

### Deploy order (integration step for the orchestrator)

Apply `*_mentor_behavioral_telemetry.sql` before the Core release that writes it (a PATCH naming an unknown column fails the close). Core and Oracle may then deploy in either order: Core sends the new context fields only to an Oracle that asks for them, and an older Core ignores Oracle's new close field. The frontend is independent. Regenerate `database/types/database.ts` after the migration; Core writes the new columns through narrow local types.

At merge, any lane that changed an audited file (`oracle/src/safety/classifier.ts`, `moderation.ts`, `tutor/hintLadder.ts`, `tutor/sessionEndSignal.ts`, `tutor/telemetryLexicon.ts`, `tutor/behavioralTelemetry.ts`) turns `biasAudit.test.ts` red until `npm --prefix oracle run bias-audit -- --record --trigger material_change` is run on the merged tree and the log is committed. This is the C.20 re-audit rule working, not a flake.

### S06.6 and S06.7 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. Local results only: no real database, no CI run, no live model or voice call, no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Resume review | `git status`/`git diff` of the interrupted work, then `npm run type-check` and its focused tests as found | Type-check clean; 1 red test of 166 (the hedging escape). The six corrections above |
| Bias audit, first run | a probe of `runBiasAudit()` on the draft registry | 72 failures across 7 components and 1 fused-parity break (es-MX child spelling). All fixed except the one known gap; then 0 failures |
| Bias audit | `oracle/`: `npx vitest run src/__tests__/biasAudit.test.ts`; `npm run bias-audit`; `npm run bias-audit -- --check` | 18 tests pass: every variant read like its standard form; fused parity in 5 sessions (some must fire, some must not); the known gap pinned; all 3 locales and all 6 groups covered; the judge never called; registry completeness against the real imports; no prosodic feature; the audit turns red on a vernacular-blind detector (parity), a misread standard (accuracy), a component with no fixtures and a skewed session; the log rejects a stale, changed or failing audit and refuses to record a failure. CLI: 10/11 components on fixtures, 78 items, 468 variants, 0 failures, 1 known gap, coverage 91%; `--check` exits 0 after `--record --trigger initial` |
| Telemetry layer | `npx vitest run src/__tests__/behavioralTelemetry.test.ts src/__tests__/telemetryLexicon.test.ts` | Pass: baseline and window, each channel against its own baseline, productive slowness exempt, carelessness not fused, two-channel fusion, strengths only, the check-in lifecycle, max 2, re-arm from the answer, undelivered vs session-ended, supersede, shadow and off, snapshot round trip, reply latency; lexicon in 3 locales |
| Stage 2 personas | `npx vitest run src/__tests__/telemetryGym.test.ts`; `npm run gym:pedagogy` | 9 pass. 8 personas on the defaults: disengaging checked at turn 8, frustrated 9, gaming 9, masking 9, reactant teen 12 and 17, productive struggle / careless / steady never. No emotion label in any output across the suite (C.9 DoD b). Suite Default-to-Inaction 88.9% (≥ 85%; the suite is adversarial-heavy by design). Every persona turns red against a deaf, hypersensitive, productive-slowness-blind, carelessness-fused or un-rearmed layer. Gym OK |
| Pipeline integration | `npx vitest run src/__tests__/checkIn.test.ts` | 16 pass: react-then-scripted check-in with seq + 1; chips yes/no; words yes/no/other; replay refused; carried by the next turn after a scripted fallback (`undelivered` meanwhile); safety stop supersedes; cross-replica resume with the check-in open; engaged learner never checked; shadow; off; Core's `shadow` verdict silences an `act` switch; Core cannot override `off`; the line fits the 6–9 Mentor budget in 3 locales; reply-latency baselines; the check-in wins over the stop offer; the repair never re-offers a declined adaptation |
| Context negotiation | `npx vitest run src/__tests__/contextFields.test.ts` | 2 pass: the header lists both fields; an unannounced field or an unknown mode refuses the context |
| Server end to end | `npx vitest run src/__tests__/live-session.test.ts` | 63 pass, incl. 2 new over a real websocket: a forged `check_in_response` is `NO_CHECK_IN` with no model call, and a malformed one a validation error; Oracle announces the context fields, and a Core `shadow` verdict is honoured and reported at close |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:pedagogy`, `npm run verify:tutor` | Pass; 53 files, 1,463 tests (1,305 before this wave); privacy boundary sealed |
| Core route tests (adversarial) | `backend/`: `npx vitest run src/__tests__/tutor.test.ts`, filtered with `-t` to the C.9/C.19 and C.16 blocks | 42 pass. New: counts and firing rows (numbers only, no user id or text); an older Oracle's close names none of the columns; 9 malformed reports (an emotion field in a firing, a label beside the counts, `pending`, `open`, a strength over 1, action above evaluated, a shadow report that acted, an unknown mode, 11 firings) are each a 400 that closes nothing; first close wins; a failed firing write never fails the close; a learner session (even the owner's) is 403; the kill switch acts on a healthy window, trips on the floor and on ONE undelivered check-in (with the audit row, no learner data), ignores a thin sample and non-opportunities, holds a trip until resolved, counts only data after a resolution, stays `act` on a failed read, and sends nothing to an Oracle that did not ask. The C.16 context tests now announce `opening`, plus one proving it is not sent unannounced |
| Core unit tests | `npx vitest run src/__tests__/behavioralTelemetry.test.ts` | 11 pass: body shape with no label field; Default-to-Inaction by persona, thin sample, defect; Repair Initiation opportunities, one-miss defect, insufficient data; the kill-switch condition; the trigger log pairing and resolution hours |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 1,569 tests (1 skipped, pre-existing) |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 214 files, 2,208 tests, incl. `CheckIn.test.tsx` (5), the check-in socket tests (2) and the extended preview copy test. First full run: 1 red (`designClasses`: an undefined `lf-button--secondary` class and an undefined preview class), fixed and rerun |
| Real-Chrome matrix | `frontend/`: `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-check-in.mjs` | 24 configurations (3 locales × 2 themes × 320/375/768/1280 px), 0 findings, plus keyboard focus and Enter, a pointer hit-test and reduced motion; rerun after the class fix, 0 findings. Screenshots reviewed: `check-in-es-MX-light-375`, `check-in-pt-BR-dark-1280`, `check-in-en-US-dark-375` (in `audit-results/rebuild-check-in/`): equal chips, visible boundaries in both themes, a panel rather than a page |
| i18n | `bash agent/tools/check-i18n.sh` (Git Bash) | Pass: key parity, no hardcoded strings, every static `t()` key exists |
| Parity gates | `npm run telemetry:check`; `node --test agent/tools/check-behavioral-telemetry-parity.test.mjs`; `npm run session-end:check`; `npm run honesty:check` | OK; 8 new tests (green on the tree, the parsers read the real vocabularies, red on a Core channel drift, a missing migration column, an outcome CHECK gap, a missing firing field, an unparseable context field and a missing client frame) |
| Migrations (static) | `database/`: `npm test` (Git Bash) | Pass: 115 files sequential with RLS covered (the new table included), phase declarations agree (94 expand, 21 contract; the new guarded CHECK is expand, the first draft's DROP/ADD form was correctly refused as a contraction), 21 Node checks, and the Railway transport suite green (12 scenarios plus the static cross-checks) |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged), `npm run tools:test` | Pass; 77 tool tests (69 before this wave + 8 new) |

Remaining acceptance boundaries (C.9, C.19 and C.20 stay In progress):

- The migration has not been applied to a physical PostgreSQL, and types have not been regenerated.
- No live or canary conversation has exercised the layer or the check-in (OD-23: zero paid spend); the 12 check-in clips are not pre-generated.
- No production metric data exists: Appendix F's "Measured" criterion (Default-to-Inaction and Repair Initiation within one release cycle) and every threshold's calibration need real sessions. The Stage 2 personas are a regression floor, not a validation (Appendix D §1.6: "moderately useful, far from certain").
- The check-in chips are not composed on the live stage (wave 2), and the `frontend/verification-tools` text-fit, proportion and copy-budget audits have not run against the real app driver for them.
- The bias-audit fixtures have not been reviewed by native speakers of each form or by the Safety/Trust Lead; the live model-judge audit awaits owner-approved spend; the "pelado" known gap awaits a Safety/Trust decision; no real child audio has passed through a real recognizer.
- The moderation rules widened by the audit (self-harm, abuse disclosure, address order) and the C.19 constraints are Tier 1: Pedagogical Reviewer and Safety/Trust Lead sign-off is pending.
- The C.8 signal still has no answer latency for spoken answers: C.9's reply latency feeds the telemetry layer, not the C.8 signal, whose "answer time" semantics are unchanged.

## S06.8 and S06.9 implementation and rationale (C.14, C.15, C.7)

The orchestrator assigned C.14, C.15 and C.7 to one wave and labelled it checkpoint "S06.5". This record already uses S06.5 for C.8/C.12, so the wave is recorded here as S06.8 (C.14) and S06.9 (C.15 and C.7), matching the plan above. The interrupted session left no uncommitted work in the lane (clean worktree at `ab365ae9`); this wave was built from the SPEC. The written policy is the [alliance, self-explanation and disposition policy](../mentor/ALLIANCE-AND-DISPOSITION-POLICY.md); every threshold is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found

- **C.14 (the SPEC's "Current State" was partly stale).** The controller already had an `ELABORATE` strategy ("a hard-won correct answer earns a self-explanation beat"), but only after a second-attempt correct activity, performed by the model with no check of the reply. Nothing asked "why did you pick that?" after a decision, and nothing distinguished a reason from filler.
- **C.15 (accurate).** Adaptation declines were remembered for one struggling episode (`plan.declinedAdaptations`) and nothing else: no pattern, no renegotiation, no goal agreement, no bond measure. Worse than the SPEC states: Liruf's scripted greeting ("You came back! I waited all morning") is falsely familiar in a first meeting, and the C.16 re-engagement line "Last time we stopped partway" is falsely familiar when a learner returns to a different persona.
- **C.7 (accurate).** No cross-session record of how a learner works existed; the curated learner brief (prose) is model-facing and guardian-gated, and is not a disposition profile the controller can read.

### C.14: the self-explanation move (Oracle)

- `oracle/src/tutor/selfExplanation.ts` is a distinct, named dialogue-move object (snapshot-carried). Decision points: ten decision activity types (`familiesForDecision`) and a learner's choice in answer to the Mentor's own money-decision question (`isDecisionQuestion` on the Mentor's line, `answersDecision` on the reply). The reacting turn only reacts; the SYSTEM appends a written question (`why`, `how` after a verified-wrong decision, a `scaffolded` sentence stem when the C.7 profile says so). At most 4 per session, 3 learner turns after the previous move ended.
- `oracle/src/tutor/explanationLexicon.ts` holds the quality check (`classifyExplanation`: concept / off_concept / filler against nine concept families in three locales, folded) and the goal-reply reader. A pass is acknowledged specifically; a miss gets ONE targeted follow-up naming the concept family (our wording, never the learner's), a second miss gets the reason stated once; a stated wrong idea routes to C.18; a help request to C.13.
- Precedence per turn: repair > check-in > renegotiation > stop offer > goal agreement > explanation reading > renegotiation follow-up > self-explanation lead > maneuver. A higher directive closes an open follow-up (`superseded`).
- Switch `TUTOR_SELF_EXPLANATION=act|shadow|off`; four written lines (why / how / scaffolded) in three locales within the 6–9 Mentor budget.

### C.15: the Alliance Controller (Oracle, Core, client)

- `oracle/src/tutor/allianceController.ts`: goal agreement (the restatement turn carries `goal_check`; `goal_response` chips refused with `NO_GOAL_CHECK` unless open; words classified), the renegotiation trigger (two consecutive declines → the Mentor only reacts, the system asks "That way isn't working. What would help you more right now?"; carried by the next turn when a turn could not carry it; superseded by the check-in; improvement window of 4 learner turns), bond (C.18's praise classification per delivered turn), and persona continuity (Core's `allianceContinuity`: a written per-character introduction or reconnection replaces a falsely familiar greeting; a fixed no-false-familiarity sentence rides the model turns; `claimsSharedHistory` repairs a "last time we…" turn once and never delivers it). The re-engagement line was reworded persona-neutral.
- Switch `TUTOR_ALLIANCE_CONTROLLER=act|shadow|off`, and the stricter of it and Core's automatic Stage 7 verdict (`allianceMode`). In shadow the renegotiation and continuity moves are recorded, not acted on; goal and bond tracking continue.
- Core (`backend/src/services/pedagogy/alliance.ts`): strict close bodies (`alliance`, `selfExplanation`), the per-session record, the renegotiation and self-explanation ledgers, the bond proxy (`POST /api/v1/tutor/sessions/:id/alliance-check`: the learner's own closed session, once, within 24 hours, never after a safety stop), the pure Appendix F summaries, and the automatic rollback (bond proxy more than 15% below the persona's baseline, or the latest 50 renegotiations improving fewer than half the sessions → `audit_logs`, holds until `--resolve`).
- Client: `goal_check` / `goal_response` in the socket layer (`goalCheckOpen`, `answerGoal()`), and rebuilt `GoalCheckChoice` and `AllianceCheck` (bond proxy) surfaces with previews.

### C.7: the disposition profile (Core, Oracle, client)

- Migration `*_mentor_alliance_and_disposition.sql` (expand; four tables with RLS; the profile readable by the learner and a verified guardian, no client write policy).
- `backend/src/services/pedagogy/disposition.ts`: the pure fold (EWMA rates, decayed counts, per-persona rapport; safety stops, consent revocations and errors move only the rapport count), closed-label traits, the Oracle projection, the continuity decision, read/write/reset/retention, and the plain-word explanation. Learner and guardian read endpoints, the OD-18 reset rule, and `tutor:alliance-report -- --purge-stale` (365 days).
- Oracle `dispositionProfile.ts`: the projection travels in the SESSION context (negotiated via `x-oracle-context-fields`), never in the sealed model context (still 14 fields, `privacy-contract-docs.test.ts` unchanged). The controller reads it beside mastery (`stuckDegradeAfter`), and it drives the scaffolded prompt, the seeded declines and the idle-nudge floor; `disposition.applied` reports which effects happened. Each session's observations (help requests, reply pace medians, adaptations taken or turned down) go back to Core at close.
- Client: `allianceApi.ts` (its own envelope-aware call: the rebuilt UI may not import `lib/api`) and the rebuilt `DispositionSummary`.

### Instrumentation and gates

`npm --prefix backend run tutor:alliance-report` (all five Appendix F metrics plus the Stage 7 log), `npm run alliance:check` (new repo gate in `repo-gates.yml`), the Stage 2 alliance personas in `npm run gym:pedagogy`, and three new bias-audited readers (`self_explanation.quality`, `self_explanation.decision_answer`, `alliance.goal_reply`; audit re-recorded as a material change).

### Defects found while building, and their fixes

1. **Goal proposal flag.** The first draft marked the goal as proposed even when a check-in, a renegotiation or a stop offer took the turn (the model never asked the goal, but the chips would have opened). Fixed before the tests ran by gating the move on no higher directive.
2. **"lol" was a decision.** A conversational money-decision question followed by any non-question reply opened the self-explanation move. The session test found it; `answersDecision` now requires a choice (an idea named, or a word of the question's own options), bias-audited.
3. **Goal-settled turn off by one.** `goalSettledAtTurn` counted the turns before the settling act; it is now the 1-based index of the settling act (and the migration CHECK ties it to a settled goal).
4. **The three bond-proxy chips wrapped 2 + 1** at 320 and 375 px in es-MX/pt-BR: the orphan chip rendered taller with wrapped text, reading as a lesser answer. The matrix reported `chips-unequal-size` (6 configurations) and the screenshot confirmed it; the chips now sit in one row where all three fit and one column otherwise.
5. **Profile labels read like values.** Looking at the 375 px screenshots, label and value lines had the same weight; labels are now muted.
6. **Falsely familiar scripted lines** (Liruf's greeting in a first meeting; "Last time we stopped partway" after a persona switch), as above.
7. **The rebuilt API layer imported `lib/api`**, which `spec:check` refuses (Bible 02 rule 23); it now carries its own call.

### Test posture decision

`oracle/src/test-setup.ts` defaults both new components to `off` in the unit suite (production defaults are `act`), because the goal-agreement move turns the learner's first message into a restatement question with no activity, which every older end-to-end test predates. The suites that own the components (`allianceSession.test.ts`, `allianceUnits.test.ts`, `allianceGym.test.ts`, the new live-session websocket test) set `act` explicitly and cover their interaction with the check-in, the stop offer, safety, moderation, closing and the park snapshot.

### Proposals recorded for owner and pedagogy review

See [policy §9](../mentor/ALLIANCE-AND-DISPOSITION-POLICY.md#9-proposals-recorded-for-owner-and-pedagogy-review): the continuity sentence as a system instruction rather than a context field; persisting adaptation declines as decayed counts (departs from the legacy never-persist rule); the bond proxy after the close with "A little" as the middle answer; goal agreement kept running in shadow; every threshold; the 365-day retention (legal); stage and Family Hub composition in wave 2; the 84 new clips need owner-approved synthesis (OD-23).

### Deploy order (integration step for the orchestrator)

Apply `*_mentor_alliance_and_disposition.sql` before the Core release that writes it (a POST to an unknown table fails; the close still lands, but the record and the profile are lost). Core and Oracle may then deploy in either order: Core sends the three new context fields only to an Oracle that announces them, and an older Core ignores Oracle's new close fields (`alliance`, `selfExplanation`, `disposition` are optional). The frontend is independent (an older Oracle never sends `goal_check`; the bond-proxy endpoint answers `NOT_TRACKED` for a session without an alliance row). Regenerate `database/types/database.ts` after the migration; Core writes through narrow local types. At merge, a lane that changed `explanationLexicon.ts` or any other audited file turns `biasAudit.test.ts` red until the audit is re-recorded (the C.20 rule working).

### S06.8 and S06.9 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. Local results only: no real database, no CI run, no live model or voice call, no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Unit contract | `oracle/`: `npx vitest run src/__tests__/allianceUnits.test.ts` | 51 pass: the quality check in 3 locales (concept / filler / off-concept, judged against the decision's own families), decision types, decision questions and choices, goal replies, 10 shared-history claims caught or allowed, the controller lifecycles (goal, renegotiation pattern, window, cap, undelivered vs session-ended, shadow, off, continuity), the self-explanation lifecycle (never loops, spacing from the end of the move, cap, supersede), the bounded disposition effects, the controller degrading one turn earlier per trait, the observer, and every new written line within the 6–9 Mentor budget. First run: 3 red (a 3-word non-reason read as off-concept; the degrade test's expectation; one 13-word line), all fixed |
| Pipeline integration | `npx vitest run src/__tests__/allianceSession.test.ts` | 34 pass through the real turn pipeline: goal restatement stands alone with chips; chips refused unless open; "something else" → the learner's words become the goal; unclear → unconfirmed, no loop; two declines → react-then-scripted renegotiation (seq + 1); an acceptance resets; improvement window true/false; an uncarried renegotiation stays due and reads undelivered; shadow; Core's verdict silences act and cannot lift off; the check-in wins; bond counts; first meeting, the persona-switch scenario (DoD c), a surviving false-familiarity claim replaced, memory gap, re-engagement precedence, shadow; the self-explanation move (why, filler → follow-up → explained, pass on follow-up, how + C.18, help, not a counting activity, spacing, conversational decision, shadow/off, scaffolded stem, no learner text in the record); the profile never in a request body; seeded declines; observations; snapshot round trip and legacy snapshot defaults. First run: 4 red (the goal test's call count and the settled turn; a fixture misconception phrase no reader knows; the conversational decision, which exposed defect 2), fixed |
| Stage 2 simulated students | `npx vitest run src/__tests__/allianceGym.test.ts`; `npm run gym:pedagogy` | 9 pass; 8 personas (repeated decliner, reactant teen, persona switcher, filler explainer, concept explainer, frustrated, masking, steady) pass on the defaults, no record carries an emotion label or learner text, and each persona turns red against a broken controller or scenario. Gym OK |
| Server end to end | `npx vitest run src/__tests__/live-session.test.ts` | 64 pass, incl. 1 new over a real websocket: the persona-switch introduction, a forged `goal_response` refused (`NO_GOAL_CHECK`, no model call) and a malformed one a validation error, the restatement then `goal_check`, the chips answered, the projection absent from every model body, and the close journal carrying `alliance`, `selfExplanation` and `disposition` without learner text. First run: the context-fields assertion (now 5 fields) and a rate-limit wait |
| Context negotiation | `npx vitest run src/__tests__/contextFields.test.ts` | 3 pass: 5 announced fields; the projection, continuity and mode parse; an emotion field, an unknown label, an unknown continuity or a louder mode refuses the context |
| Bias audit | `npm run bias-audit -- --record --trigger material_change`; `npm run bias-audit -- --check`; `biasAudit.test.ts` | 14 components (13 on fixtures), 96 items, 576 variants, 0 failures, 1 known gap (unchanged); coverage 93%. The three new readers passed on their first run: their fixtures were written alongside the components, so they pin behaviour rather than discover gaps (native-speaker review pending) |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:pedagogy`, `npm run verify:tutor` | Pass; 56 files, 1,559 tests (1,463 before this wave); privacy boundary sealed; the model context still 14 fields |
| Core route tests (adversarial) | `backend/`: `npx vitest run src/__tests__/tutor.test.ts -t "S06.5"` | 27 pass: the record, ledgers and profile fold; an older Oracle; a safety stop never enters the behavioural profile; 10 malformed bodies (emotion field, learner text, unknown outcome, unsettled goal turn, answers above offers, shadow that acted, unknown family, help above turns, free text) each a 400 that closes nothing; lost first close; failed writes never fail the close; a failed profile read writes nothing; a learner cannot post the internal close; the context projection, continuity (first meeting, persona switch, continuing, memory gap, from session rows) and mode, a failed read sending no guess, nothing to an Oracle that did not ask; the Stage 7 trip with its audit row; the bond proxy for the under-13 kid owner, an independent teen and an adult, refused for the verified parent Tutor, another learner, a guest, staff, no token and the internal key, and for an open session, a safety stop, a late answer, a repeat, a lost race, an untracked session, a failed read and free text; the profile read by the learner and a verified guardian, refused to a stranger, 502 on a failed read; the reset refused to a child, allowed to their verified guardian (audited), refused to a stranger, allowed to an independent teen and an adult |
| Core unit tests | `npx vitest run src/__tests__/allianceDisposition.test.ts` | 21 pass: the fold (traits after 3 sessions, EWMA, dropouts, safety exclusion, decayed prompts and passes, persistent declines, bond proxy), the projection and observation bodies, the explanation, continuity, the five summaries and the kill-switch condition (a persona drop, within 15%, thin samples, the renegotiation sample) and its log |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 75 files, 1,617 tests (1 skipped, pre-existing); 1,569 before this wave |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 215 files, 2,222 tests (2,208 before), incl. `Alliance.test.tsx` (12), the goal-chip socket tests (2) and the extended preview copy test. First run of the new test: the feeling check matched "sentence" and "pasadas"; it now matches whole words |
| Real-Chrome matrix | `frontend/`: `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-alliance.mjs` | 78 configurations (3 surfaces × 3 locales × 2 themes × 320/375/768/1280 px, plus the bond proxy per closing script and the profile's empty/failed/loading states), keyboard focus and Enter on both chip surfaces, the answered state, the retry control, pointer hit-tests and reduced motion. First run: 6 findings (defect 4); after the fix 0; rerun after the label fix, 0. Screenshots reviewed: `mentor-alliance-check-es-MX-light-375` (before and after), `mentor-goal-check-en-US-dark-375`, `mentor-profile-es-MX-light-375`, `mentor-profile-es-MX-dark-375`, `mentor-profile-pt-BR-dark-1280`, `mentor-alliance-check-answered-en-US-dark-768` (in `audit-results/rebuild-alliance/`) |
| i18n | `bash agent/tools/check-i18n.sh` (Git Bash) | Pass: key parity, no hardcoded strings, every static `t()` key exists |
| Parity gates | `npm run alliance:check`; `node --test agent/tools/check-alliance-parity.test.mjs`; `telemetry:check`, `session-end:check`, `honesty:check` | OK; 10 new tests (green on the tree, parsers read the real vocabularies, red on a Core goal drift, a migration outcome gap, a missing report field, a missing concept family, a projection field Oracle cannot parse, a client bond answer Core refuses, a missing goal frame, a missing migration). The telemetry parity test's fixture was updated for the 5-field context list |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, the Node tests; `node scripts/railway-migrate.test.mjs` | 116 files sequential with RLS covered (the four new tables), phase declarations agree (95 expand, 21 contract), 21 Node checks pass. The Railway transport suite passed its 12 scenarios plus the static cross-checks, but only when run alone: two earlier attempts inside `npm test` were cut off by a 300 s and a 580 s shell timeout while four other lanes ran the same suite (one attempt was mid-scenario, not a red); the standalone run took about 45 minutes under that load |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged), `npm run tools:test` | Pass (`secrets:check` OK with every new file staged); 87 tool tests (77 before this wave + 10 new). `spec:check` first refused the rebuilt API layer's `lib/api` import (defect 7) |

Remaining acceptance boundaries (C.7, C.14 and C.15 stay In progress):

- The migration has not been applied to a physical PostgreSQL, and types have not been regenerated.
- No live or canary conversation has exercised any move (OD-23: zero paid spend); the 84 new clips are not pre-generated.
- No production data exists: Appendix F's "Measured" criterion (the Bond Proxy Score live and segmentable by persona within one release cycle; the Goal-Agreement Completion target; the Completeness baseline) and every threshold's calibration need real sessions. The Stage 2 personas are a regression floor, not a validation.
- The goal chips and the bond proxy are not composed on the live stage, and the profile is not placed in the Family Hub or Settings (wave 2); the `frontend/verification-tools` text-fit, proportion and copy-budget audits have not run against the real app driver for them.
- The explanation-quality lexicon, the decision-answer reader and the goal-reply reader need native-speaker fixture review; the continuity sentence and the persisted declines need the owner's reviewed decision (policy §9); the 365-day retention needs legal review.
- The no-false-familiarity, never-silent-renegotiation and never-silent-acceptance constraints are Tier 1: Pedagogical Reviewer and Safety/Trust Lead sign-off is pending.

## S06.10 and S06.11 implementation and rationale (C.11, C.17)

The orchestrator assigned C.11 and C.17 to one wave and labelled it checkpoint "S06.6". This record already uses S06.6 for C.9/C.20, so the wave is recorded here as S06.10 (C.11) and S06.11 (C.17), matching the plan above. The interrupted session left no uncommitted work in the lane (clean worktree at `7d6f73e2`); this wave was built from the SPEC. The written policy is the [spaced review and dialogue calibration policy](../mentor/SPACED-REVIEW-AND-DIALOGUE-CALIBRATION-POLICY.md); every threshold is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found

- **C.11 (the SPEC's "Current State" was accurate, with one aggravating detail).** No within-session tier existed: the controller stays on a plan entry until mastery and never revisits a KC it moved past, so a shaky answer was either drilled massed on the spot or not seen again that session. The aggravating detail was on the cross-session side: `recordAttempt` ran the FSRS update on EVERY graded attempt, so a miss followed by three correct answers in one sitting grew the card's stability three times in twenty minutes — exactly the "session-scoped illusion of retention" Appendix D §2.4 warns about, scheduled days out. Nothing decided which tier owned a wrong answer, and nothing avoided re-drilling in the last minutes before the cap.
- **C.17 (accurate).** Every register, persona and hint rung was uniform across ages. The teaching tier cannot express the SPEC's bands (tier 3 covers ages 10–12, teens and adults alike), no controlling-language check existed, and a stuck skill always got a unilateral change of approach before any offer. The H.7 experiment runtime existed (dataintel, age-bounded, surface `tutor`), but nothing on the Mentor used it.

### C.11: the two-tier spaced review (Oracle, Core, database)

- **The decision rule** (`oracle/src/tutor/spacedReview.ts` `routeWrongAnswer`, pure, mirrored in Core): within-session only when the belief BEFORE the miss is ≥ 0.5 and the session has 8 model turns and 4 minutes before the wrap-up left (plus a re-exposure cap of 3 and a queue of 3); every other wrong answer — a probe's unplanned prerequisite, a miss while wrapping up or near the cap, a KC far below the threshold — goes to the cross-session scheduler with the first reason that applied.
- **Within-session tier (Oracle).** `SpacedReviewRouter` keeps a PFA-style running count per queued KC (answers inside the 3-turn gap are massed and not counted; spaced successes − failures ≥ +1 retires; a spaced miss re-runs the rule with the current budget). When an item is due, the orchestrator opens the controller's **review detour** on a turn nothing else owns (no check-in, renegotiation, stop offer, goal move, explanation move or help request; never right after a miss, a milestone or a closed re-check; never while an ungraded activity is on screen). The detour serves the KC as a review (SPACED, `mode: review`, its own planned band), answers exactly one graded item and closes (FLUENCY on correct, one WORKED example on wrong; RESCUE still wins), never celebrates, never moves the plan pointer, never opens a probe, and revokes a mastery celebrated earlier in the session when the re-check fails (C.10's demotion). A re-check talked past for 3 turns is abandoned and handed off. Router and detour ride the park snapshot (defaulted for records parked by the previous build).
- **Cross-session tier (Core).** `fsrs.ts` `reviewCardTwoTier`: within 180 minutes of the card's last counted review a success changes nothing and a second lapse does not collapse the card again (a lapse after a counted success is real forgetting and counts); `kc_attempt.review_tier` records the tier, with a one-time fallback insert without the column so a Core deployed before the migration never loses evidence. At close, every KC the session did not retire is made due within 12 hours (`memory_card` PATCH filtered on `due_at > handoff`: only ever brought forward).
- Switches: `TUTOR_SPACED_REVIEW=act|shadow|off` (Oracle; Core's automatic verdict `spacedReviewMode` can only make it stricter) and `TUTOR_REVIEW_SHORT_HORIZON_MIN` (Core; 0 restores the pre-C.11 scheduler).

### C.17: age-band dialogue calibration (Core, Oracle)

- **The band** is derived in Core (`services/pedagogy/dialogueCalibration.ts` `dialogueBandFor`) in the teaching tier's own precedence: a self-registered account's declared band wins, then a birth date, then the confirmed tier (tier 3 without finer evidence → tween, never teen or adult). It travels in the SESSION context (`dialogueCalibration`, negotiated via `x-oracle-context-fields`), never the sealed model context (still 14 fields).
- **The registers** (`oracle/src/tutor/dialogueCalibration.ts`), across all four personas: the younger child gets a 4-rung ladder (the indirect hint dropped), "let's do this one together" wording and a direct register note; the tween keeps the full ladder and gets recognition tied to the step and a choice of approach; the teen and the adult get autonomy-supportive rung wording, a register note, ask-first pacing (the legacy stuck move offers an adaptation instead of changing approach; RESCUE/FADED/WORKED ask first) and a deterministic controlling-language check in three locales (declarative second-person markers only; caught on every model turn, repaired once; a survival is delivered and counted). The `control` variant is the uniform pre-C.17 register.
- **The A/B test.** The H.7 runtime (surface `tutor`, target `mentor.dialogue-register`, A = control, B = calibrated) assigns, and Core records the exposure before the treatment applies. Core consults it only for `MENTOR_DIALOGUE_EXPERIMENT_BANDS` (default `adult`: OD-23 / H.7) and only with analytics consent (a kid's verified-guardian consent, a teen's own preference); everyone else gets the calibrated default with the reason recorded. A runtime failure is never a guess (`runtime_unavailable`, calibrated default).
- **The outcome.** `tutor_dialogue_calibration` joined with the C.15 bond proxy and the C.16 closing script: per band, each arm's bond-proxy mean and completed-close share, the calibrated − control difference with a Welch / two-proportion 95% interval, and a verdict; non-enrolled sessions are reported apart and labelled uncontrolled beside the pre-C.17 baseline.
- Switch: `TUTOR_DIALOGUE_CALIBRATION=act|off` (Oracle; `off` = control for everyone, recorded as `operator_off`).

### Instrumentation and gates

- Migration `*_mentor_spaced_review_and_dialogue_calibration.sql` (expand): `tutor_review_routing` and `tutor_dialogue_calibration` (RLS, no client policy, no user id, no text; CHECKs that tie tier to reason and outcome, and ladder length to register) and `kc_attempt.review_tier`.
- `npm --prefix backend run tutor:spaced-review-report` (routing picture, Routing Accuracy by re-evaluating every recorded decision, the delivery pattern, the quarterly sample and its recorded audit, the Stage 7 log) and the quarterly read-only workflow `mentor-review-routing-audit.yml`; `npm --prefix backend run tutor:dialogue-calibration-report` (the A/B Outcome, the uncontrolled view, delivered controlling language, the assignment mix, the Stage 7 log).
- Stage 7 automatic rollbacks, both logged in `audit_logs` and lifted by `--resolve`: the router drops to shadow on any recorded decision the rule does not reproduce or when more than half of the latest 100 within-session routings never got their re-check; the register drops to control for everyone when a band's calibrated arm is significantly worse than control.
- `npm run review-calibration:check` (new, in `repo-gates.yml`): Oracle, Core and the migration agree on the vocabularies, the records, the rule's thresholds Core re-evaluates and `REVIEW_OPEN_TURNS`; it also holds the OD-23 guard (the experiment's default bands must exclude every minor band).
- Stage 2: `reviewCalibrationGym.ts` in `npm run gym:pedagogy` — 5 C.11 personas driving the real controller and router with the orchestrator's glue, 4 C.17 personas driving the real policy, ladder and stuck move; every persona is shown able to turn red.
- The C.20 bias audit was re-recorded as a material change (`hintLadder.ts` changed; its readers did not; 0 failures).

### Defects found while building, and their fixes

1. **The dialogue band ignored the teaching tier's precedence.** The first draft preferred a birth date over a self-registered account's declared band, so a declared teen with a stale child birth date would have been spoken to as a young child while taught at tier 3. Found while reading `knownMentorAgeTier`'s tests; the band now follows the same precedence and withholds the exact age unless the birth date agrees with the band.
2. **A re-check could steal an on-screen activity's grade.** Opening the detour on a conversational turn while an ungraded activity for the main KC was on screen would file that grade under the reviewed KC. Found in self-review; `openDueReview` now refuses while an activity is ungraded, and a test (proven red without the guard) pins it.
3. **The gym's first scripts were wrong, not the code.** The slipper talked three turns without progress, which correctly triggered RESCUE (a rescue is never interrupted), and the rapid guesser expected the re-exposure cap where the rule correctly hands off first as "far from threshold" once the belief falls. The scripts and the check now test what matters (massed misses never counted as spaced; a handed-off end).
4. **The env examples lacked the new switches** (`env-example.test.ts` caught the Oracle one); both examples now document them.
5. **Test-side:** a label check matched "tired" inside the outcome "retired"; the checks now match whole words.

### Test posture decision

`oracle/src/test-setup.ts` defaults `TUTOR_SPACED_REVIEW` and `TUTOR_DIALOGUE_CALIBRATION` to `off` in the unit suite (production defaults are `act`), for the same reason as the S06.8/S06.9 components: the detour changes which KC a later activity is served for, and the calibrated register changes the ladder and appends a note to every model turn — shapes every older end-to-end test predates. The dedicated suites set `act`.

### Proposals recorded for owner and pedagogy review

See [policy §7](../mentor/SPACED-REVIEW-AND-DIALOGUE-CALIBRATION-POLICY.md#7-proposals-recorded-for-owner-and-pedagogy-review): the C.17 A/B cannot measure the child and teen calibrations while OD-23 keeps experiments adults-only (owner question); a surviving controlling phrase is delivered and counted, not replaced; adults get the autonomy register and check too; the register note is a system instruction; "ask before adjusting pacing" covers the system's own pace changes; tier 3 without finer evidence is a tween; every threshold, especially the 180-minute short horizon and the 12-hour hand-off.

### Deploy order (integration step for the orchestrator)

Apply `*_mentor_spaced_review_and_dialogue_calibration.sql` before the Core release that writes it (a POST to an unknown table fails and the close loses that record; the `kc_attempt.review_tier` write already falls back to the row without the column). Core and Oracle may then deploy in either order: Core sends `spacedReviewMode` and `dialogueCalibration` only to an Oracle that announces them, an older Core ignores Oracle's new close fields (both optional), and an Oracle facing an older Core falls back to the tier for the band. The frontend is unchanged. Regenerate `database/types/database.ts` after the migration; Core writes through narrow local types. At merge, `hintLadder.ts` is an audited file: a lane that changed any audited Oracle file turns `biasAudit.test.ts` red until the audit is re-recorded on the merged tree. The migration number may collide with other lanes; renumber at merge (code, tests and the gate reference only the descriptive suffix). The C.17 experiment itself is created by staff in the H.7 console (surface `tutor`, target `mentor.dialogue-register`, adults); until then every session records `no_experiment` or `not_eligible`.

### S06.10 and S06.11 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. Local results only: no real database, no CI run, no live model or voice call, no production observation. No UI or copy was added in this wave (the re-check and the register are server-side), so no browser matrix or i18n check applies.

| Boundary | Command / evidence | Result |
|---|---|---|
| Unit contract (C.11) | `oracle/`: `npx vitest run src/__tests__/spacedReview.test.ts` | 24 pass: every rule branch and its precedence (the budget outranks proximity), the running count (massed answers ignored, retirement at +1, reroute, budget hand-off, cap, far-below, unplanned, queue full), due selection, abandonment, shadow/off, the decision overflow, the snapshot round trip, the record carrying ids and numbers only; the detour opens only for a planned KC the plan moved past, refuses during a probe or a repair, closes on one graded item (FLUENCY / WORKED), never celebrates or advances, revokes a celebrated mastery on a failed re-check, is abandoned after 3 turns, keeps the controller active after the plan completed, and rides the snapshot. First run: all green |
| Unit contract (C.17) | `npx vitest run src/__tests__/dialogueCalibration.test.ts` | 38 pass: the tier fallback, the operator off, the four registers and the control arm, no register note naming an age or a band, the 4-rung ladder (never-repeat and just-tell-me intact), malformed ladders refused, the ask-first stuck move (and the default's exact pre-C.17 wording), 12 controlling phrases caught and 11 invitations, questions and impersonal statements not flagged in three locales, the record. First run: 2 red, both test-side (a privacy regex matching "age" inside "language"; a guessed adaptation list), fixed |
| Pipeline integration | `npx vitest run src/__tests__/reviewCalibrationSession.test.ts` | 18 pass through the real turn pipeline: a near-threshold miss queued, re-checked after the plan moved on (the lead names the objective, the next activity is served for that KC), the result instruction, the hand-off at close; two spaced successes retire it; a miss 3 minutes before the wrap-up is handed off with no re-check crammed in; far-below handed off; Core's shadow verdict records and never re-checks; a help request keeps its turn; an on-screen activity keeps its grade (the guard, proven red without it); resume and legacy snapshots; no learner words in the record; the teen register note and a controlling draft repaired (and a survival counted); the younger-child ladder wording; the control arm untouched; the ask-first offer vs the control's unilateral change; the tier fallback; the close record; both operator switches |
| Stage 2 simulated students | `npx vitest run src/__tests__/reviewCalibrationGym.test.ts`; `npm run gym:pedagogy` | 12 pass; 9 personas (near-miss slipper, late-session struggler, far-below learner, forgetting reviewer, gaming rapid guesser, reactant teen, polite teen, young hint seeker, adult control) pass on the defaults and each turns red against a broken rule or policy. Gym OK (36 personas across the five gyms). First run: 2 persona scripts were wrong (defect 3) |
| Context negotiation | `npx vitest run src/__tests__/contextFields.test.ts` | 4 pass: 7 announced fields; the mode and the calibration parse; an unknown band, an age, an unknown variant, a malformed experiment id or a louder mode refuses the context |
| Bias audit | `npm run bias-audit -- --record --trigger material_change`; `npm run bias-audit -- --check` | 14 components (13 on fixtures), 96 items, 576 variants, 0 failures, 1 known gap (unchanged); coverage 93%. Re-recorded because `hintLadder.ts` changed |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:pedagogy`, `npm run verify:tutor` | Pass; 60 files, 1,652 tests (1,559 before this wave); privacy boundary sealed; the model context still 14 fields. First full run: `env-example.test.ts` red (defect 4), fixed |
| Core unit tests | `backend/`: `npx vitest run src/__tests__/spacedReviewCalibration.test.ts` | 59 pass: the two-tier scheduler (massed successes never grow the interval, a lapse after a success counts, a second lapse does not compound, 0 disables), 11 malformed routing bodies refused, the hand-off set (act only, by final decision), Routing Accuracy re-evaluation and the misroute defect, the delivery pattern, insufficient data, the reproducible stratified sample, the Stage 7 verdicts and the trigger log, 11 band derivations (incl. the declared-band precedence of defect 1), the variant for every population (minors never call the runtime; an enrolled adult with exposure; no experiment, a failed runtime and a failed exposure; consent gating once a minor band is opened; the rollback), 10 malformed register bodies refused, the A/B statistics and verdicts, the closing comparison excluding safety stops, the uncontrolled view, the controlling-language defect, and the quarterly cadence |
| Core route tests (adversarial) | `npx vitest run src/__tests__/tutor.test.ts -t "S06.10"`; `npx vitest run src/__tests__/pedagogy-routes.test.ts` | 20 + 5 pass: the close records every decision with its inputs, hands off only the unretired KC (a filtered PATCH, only forward, within 12 h) and writes the register row; shadow hands nothing off; an older Oracle closes; 9 malformed bodies (learner text, a tier/reason or tier/outcome mismatch, a shadow re-check, a non-catalog KC, an age, a control arm with the short ladder, a stray experiment id, a unilateral teen change) each a 400 that closes nothing; no key and a learner token are refused; the context for the parent-created under-13 kid (young child, no runtime call, no birth date travels), an 11-year-old (tween), the independent teen (teen, not enrolled), the adult (enrolled, exposure recorded), staff (adult rule; failed runtime → calibrated default), an Oracle that did not ask; both Stage 7 trips with their audit rows. The grade route: short-horizon success leaves the card, a later success grows it, a lapse after a success lapses, a second lapse does not, and a pre-migration schema still records the attempt. First run: 1 red (a guessed 401 where the internal gate answers 403), fixed |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass; 76 files (1 skipped, pre-existing), 1,701 tests (1,617 before this wave) |
| Operator CLIs | `npx tsx src/scripts/spaced-review-report.ts --resolve=short`, `--record-audit=...` without its flags, `npx tsx src/scripts/dialogue-calibration-report.ts --resolve=short` | Each refuses with its argument error (exit 2) before any read: the scripts load and guard their writes. They were not run against a database (none here) |
| Parity gates | `npm run review-calibration:check`; `node --test agent/tools/check-review-calibration-parity.test.mjs`; `telemetry:check`, `alliance:check`, `session-end:check`, `honesty:check`; `npm run tools:test` | OK; 10 new tests (green on the tree, parsers read the real values, red on a Core rule drift, a `REVIEW_OPEN_TURNS` drift, a missing CHECK reason, a missing decision field, a missing assignment, an extra report field, a minor band in the experiment default (OD-23), a missing migration); the telemetry parity fixture was updated for the 7-field context list; 97 tool tests (87 before) |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, the Node tests; `gate-auto-apply.mjs` on a simulated dry-run listing the new file | 117 files sequential with RLS covered (the two new tables), phase declarations agree (96 expand, 21 contract), 21 Node checks pass; the auto-apply gate answers `apply=true` (additive) |
| Railway transport suite | `database/`: `node scripts/railway-migrate.test.mjs` | Started in the background (five lanes running the same suite concurrently); it had not finished when this checkpoint was committed. Its last recorded pass was standalone in S06.8/S06.9 (12 scenarios). The migration touches no transport code; rerun it alone at merge |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged) | Pass |

Remaining acceptance boundaries (C.11 and C.17 stay In progress):

- The migration has not been applied to a physical PostgreSQL, and types have not been regenerated.
- No live or canary conversation has exercised the re-check or a register (OD-23: zero paid spend). Appendix F's "Measured" criterion needs production data: routing logs from real sessions and the first quarterly human spot check (C.11); a running H.7 experiment created by staff and enough sessions per arm (C.17).
- The C.17 A/B cannot, under OD-23, measure the child and teen calibrations the SPEC asks about; minors are measured observationally only until Product and Legal decide (owner question).
- Every threshold needs calibration; the controlling-language lexicon needs native-speaker review in es-MX and pt-BR.
- The Tier 1 items (the routing rule's guarantees, massed repetition never growing the interval, the adults-only experiment, the band never reaching the model, no silent controlling language) need Pedagogical Reviewer and Safety/Trust Lead sign-off.

## S06.12 implementation and rationale (C.5, C.6)

The orchestrator labelled this wave checkpoint "S06.7". This record already uses S06.7 for C.19, so the wave is recorded here as S06.12, which the plan above already reserved for C.5 and C.6. The interrupted session had left no uncommitted work (the worktree was clean at `873157b1`), so the wave was built from the SPEC. The written policy is the [live-content governance policy](../mentor/LIVE-CONTENT-GOVERNANCE-POLICY.md), which also states the tier each mechanism operates under (C.22's requirement for C.5). Every threshold is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found (the SPEC's "Current State" was accurate, with two aggravating details)

- **C.5.** `persistAndServe` sampled live segments with `Math.random() < TUTOR_LIVE_REVIEW_SAMPLE_RATE` (0.15), with no risk category, no rate change after an issue, no calibration of the judge, and a config comment calling zero "a valid deployment choice". The review queue existed (`/admin/tutor/review-queue`), but a rejection was a bare status that changed nothing, and nothing measured whether staff agreed with the judge or kept up with the sample.
- **C.6.** `tutor_packs` (0047) had a reader (`serveFromBank`), but no authoring contract, no loader, no publish path and no rows anywhere in the repo. **Aggravating:** packs were keyed by catalog skill key only. The four knowledge components that no published topic teaches (`kc.skill_key` null) could never be matched by a pack even if one existed, so 100% of their activities were live-generated.

### C.5: the governed live-generation tier (Core, Oracle, database)

- **Risk category, decided where the item is certified.** `backend/src/services/pedagogy/contentRisk.ts` holds a deterministic lexicon for three locales, run over folded text (no diacritics, whole-word bounded). Oracle holds a byte-identical copy (`oracle/src/content/contentRisk.ts`), runs it over the item and the Mentor's brief, adds the learner-input safety classifier, and reports `risk_signals`. Core runs its own copy over the item and the rationale, adds `session_safety_event` from `tutor_safety_flags`, and takes the union. An unknown code becomes `unrecognized_signal`, and an unreadable safety history is treated as flagged.
- **Sampling.** The floors are 15% / 50% (Appendix E §3.1.1). Configuration may only raise them, and they are also enforced by the log CHECK and by the claim function. Selection is systematic: a per-category credit accumulator, locked in the claim transaction. The dynamic rate: the first rejection in a category raises it to 50% / 100% until 100 consecutive clean decisions (5 batches of 20). `insert_tutor_live_segment_checked` writes the segment, the sampling decision and the `tutor_live_content_log` row in one transaction, and is the only path a live item is served through.
- **The calibrated judge.** Oracle stamps `judge_model` and `judge_prompt_hash` (the SHA-256 of the judge's prompt and age-band rules) on every candidate. Core admits a candidate only when its category is not suspended AND its judge matches the latest calibration, which must be `passed` and at most 35 days old. `tutor_content_judge_calibration` refuses a passed row below the thresholds. The zero-spend harness (`npm --prefix oracle run content-judge:calibrate`) reads the 44-item seed set, the panel's rating files and either the dry run, a replay or (owner-run, `CONTENT_JUDGE_CALIBRATION_LIVE=approved`) the live judge. Core's `--record-calibration` recomputes everything and refuses a dry run, a replay, fewer than two raters or non-panel ratings.
- **Stage 7.** Concordance below 90% or review below the floor trips a category (in `audit_logs`), and the trip holds until an operator resolves it. A concordance resolution is refused without a passed calibration recorded after the trip; a coverage resolution is refused while coverage is still short. A failed gate read refuses (fail closed, not cached).
- **Suspension reaches Oracle.** When the human-approved rungs miss and the request's category is suspended, `/segments` answers `{ needsGeneration: false, liveSuspended: true, reason }`. Oracle parses it and makes no author or judge call (an older Oracle fails the strict parse and shows "no activity", the same safe outcome).
- **Staff.** `POST /admin/tutor/review-queue/:id/status` takes `{ status, issue? }` (issue `quality | safety` on a rejection only; the legacy console's bare rejection still records, as an unclassified issue) through `record_tutor_live_review`: the segment and its log row in one transaction, only on a pending item (409 otherwise). `GET /admin/tutor/live-content/status` shows the per-category rate, floor, suspension, backlog and calibration. Both routes, like the pack routes, require `manage_content` before any data read.

### C.6: the curated activity-pack tier (Core, database, content)

- **Contract** `tutor-pack.v1` (`backend/src/services/tutorPacks.ts`, policy §5). A frontend test (`frontend/src/lesson-engine/curatedPacks.test.ts`) parses every seed item with the Lesson Engine's own `segmentUnion`, so the hand-mirrored payload schemas cannot drift silently.
- **Storage.** New `tutor_packs` columns: `kc_key` (a KC target is stored as skill key `kc:<key>`, keeping 0047's unique key), `pack_version`, `content_hash`, `source`, `demand_pattern`, `risk_category` and `validated_at`, plus CHECKs tying the KC key to the skill key and requiring a release on a published pack.
- **Selection.** After the named skill's catalog and pack, the ladder now tries the pack for the exact knowledge component, then for a prerequisite (catalog, pack or KC pack), then the frontier, and only then live generation. Served provenance carries `pack_version`, `content_hash` and `pack_source`.
- **Seed packs, at zero spend.** `database/seeds/tutor_packs/` holds 4 files, 21 packs and 84 activities: every tier at or above each KC's `tier_min`, in en-US, es-MX and pt-BR, with coins as the only currency word. They were authored by hand, with no model call.
- **Release.** `npm --prefix backend run seed:tutor-packs` validates (`--check`) and loads as `review` (changed content returns to review). `POST /admin/tutor/packs/:id/status` publishes after re-running the contract on the stored content (hash and live `tier_min` included), records `released_by`, and writes an audit row. `GET /admin/tutor/packs` lists packs for review.

### Instrumentation, gates and surfaces

- Migration `*_live_content_governance_and_curated_packs.sql` (expand): `tutor_live_content_log`, `tutor_live_sampling_credit`, `tutor_content_judge_calibration` and `tutor_content_ladder_events` (all with RLS on and no client policy, no learner id and no text), the two functions, and the `tutor_packs` columns.
- `npm --prefix backend run tutor:live-content-report` (policy §7) and the weekly read-only `mentor-live-content-monitor.yml`.
- `npm run live-content:check` (new, in `repo-gates.yml`): the lexicon is identical in both services; the signals, categories, ladder outcomes, routes and reasons, review issues and pack vocabularies match the migration CHECKs; the Oracle parse and the Core answer of `liveSuspended` both exist; and the **Appendix E floors guard** fails on any lowered floor or calibration minimum.
- The rebuilt staff surface `frontend/src/rebuild/mentor/LiveContentGovernance.tsx` has the status, one review decision with three equal controls (a reviewer is never nudged toward approving), and the pack release with every refusal reason listed. Its client API layer is `liveContentApi.ts`, its copy is in `rebuild.json` in 3 locales (budget-checked at the adult app budget), and the isolated preview is `?screen=staff-live-content`.

### Defects found while building, and their fixes

1. **Two seed-set items did not read as sensitive to the gate** (a theft item and a two-homes item). The test pinning that every sensitive seed item trips the lexicon, and no standard one does, caught them. The item text was made explicit, so the calibration categories match what the gate would compute.
2. **An Oracle test deleted process-wide env values the shared setup provides**, which turned a later test red in the full run only. The quiet rerun showed it; the test no longer mutates the environment.
3. **`spec:check` refused a test under `rebuild/` that imported the legacy Lesson Engine schema** (Bible 02 rule 23). It moved to `frontend/src/lesson-engine/curatedPacks.test.ts`, where it belongs.
4. **Compatibility found in review:** the legacy staff console sends a bare `{ status: 'rejected' }`. Making `issue` mandatory would have broken it, so it is optional and a bare rejection still counts as an issue.

### Proposals recorded for owner and pedagogy review

See [policy §9](../mentor/LIVE-CONTENT-GOVERNANCE-POLICY.md#9-proposals-recorded-for-owner-and-pedagogy-review). The one with a production consequence: **live generation is suspended from the first deploy until the owner runs the judge calibration** (the SPEC's reading), so the Mentor serves the catalog and the curated packs or teaches in conversation. A time-boxed exception would be a Tier 1 decision.

### Deploy order (integration step for the orchestrator)

1. Apply `*_live_content_governance_and_curated_packs.sql` before the Core release. Without it, Core refuses every live item (the claim function is missing: fail closed), ladder events are not recorded (best effort), and the pack publish route fails; the catalog and packs keep serving.
2. Core and Oracle may then deploy in either order. A Core ahead of Oracle refuses live items (no judge hash), and live generation is suspended until calibration anyway. An Oracle ahead of Core never receives `liveSuspended`, and an older Oracle reads it as "no activity".
3. Run `npm --prefix backend run seed:tutor-packs`, then have staff read and publish the 21 packs.
4. The owner schedules the human panel's ratings and approves the live calibration run (OD-23), then records it.
5. Regenerate `database/types/database.ts` (Core uses narrow local types). The migration number `0118` may collide with other lanes; renumber at merge, since code, tests and the gate reference only the descriptive suffix. No audited bias-audit file changed in this wave (`classifier.ts` is only read).

### S06.12 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. These are local results only: no real database, no CI run, no live model, judge or voice call, and no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Core governance units | `backend/`: `npx vitest run src/__tests__/liveContentGovernance.test.ts` | 37 pass: the floors and a lower configured value ignored; elevation at the first rejection, complete clean batches only, restoration at exactly 5; calibration state (none, failed, passed, stale) and judge matching by model AND hash; concordance (insufficient below 20, trip below 90%); exact review coverage and a below-floor row; per-category suspension; the trip/resolve fold and resolution hours; admission and refusal reasons; the lexicon in 3 locales and 6 must-stay-silent sentences ("Arma tu presupuesto", "Better", "robot"); the union rule, where a report cannot lower the category and an unknown code raises it; calibration against the real seed set (pass, a judge approving rejected items, a panel disagreeing with itself, and refusals of a dry run, a replay, author labels, a single rater, a missing label; the seed-set hash; a tie counted as a fail); the report summaries; the gate from fetch-stubbed PostgREST (uncalibrated suspends everything, open, elevated, both trips written, an open trip held, fail closed, and both resolution refusals). First run: 1 red (defect 1), fixed |
| Core pack contract | `npx vitest run src/__tests__/tutorPacks.test.ts` | 30 pass: every seed pack meets the contract (21 packs, 84 activities, all 3 locales per tier, never below `tier_min`, exactly the 4 uncovered KCs); a broken seed directory reports every failure; 14 contract rules each proven to bite; a declared sensitive pack accepted; the stored form strips keys and round-trips; the canonical hash; publish re-validates the stored content, names the releaser and writes the audit row; broken content, a hash mismatch and a raised `tier_min` are refused; archive and a repeated decision. First run: 1 red (test expectation: the verifier already names the key failure), fixed |
| Core routes (adversarial) | `npx vitest run src/__tests__/tutor.test.ts -t "S06.12"`; `npx vitest run src/__tests__/admin.test.ts -t "S06.12"` | 16 + 8 pass. Internal routes with no key and with a learner token: refused. An uncalibrated judge suspends (`liveSuspended`, event recorded) and no segment is claimed. A stale calibration suspends. A calibrated judge invites generation. A trip suspends only its category. A foreign judge hash and a missing identity are refused. A standard item goes through the governed claim at 15%. A divorce story Oracle called standard is sampled as sensitive at 50%. An Oracle signal, an unknown code or a session safety flag each raise the category. Elevated after a rejection (50%). A failed gate read refuses. A verification failure is logged. The KC pack is served before generation with version and hash in provenance. Only published packs are read. A prerequisite's KC pack is served. Staff: a classified rejection in one RPC with the reviewer id and audit; an issue on an approval, an unknown class or an extra field each give 400; a stale decision gives 409; the status panel. Each governance route refuses staff without `manage_content` (before any data read), a kid and no session. A refused publish gives 422 with every reason. A bad status or id gives 400. Mutation check: making Core ignore the item's own text turned the "divorce story" test red, and it was restored |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass. 78 files (1 skipped, pre-existing), 1,792 tests (1,701 before this wave). The 3 pre-existing tests that asserted the old fixed-rate or bare-PATCH behaviour were updated to the governed contract. First run: 2 test-side type errors and 1 lint error, fixed |
| Oracle | `oracle/`: `npx vitest run src/__tests__/liveContentGovernance.test.ts`, `live-session.test.ts -t "suspends"` | 10 + 1 pass: the judge identity and risk signals are stamped on every candidate; a sensitive topic is found in the item or in the brief; the classifier signal; the lexicon block is byte-identical to Core's; the `liveSuspended` parse; the seed-set soundness checks; the harness dry run labelled as author intent; rating-file parsing. Over a real websocket, a suspension makes **zero** author or judge calls (mutation: disabling the branch turned it red, and it was restored) |
| Oracle full | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:tutor`, `npm run verify:pedagogy`, `npm run gym:pedagogy`, `npm run bias-audit -- --check` | Pass. 61 files, 1,663 tests (1,652 before). The privacy boundary is sealed. Gym OK (36 personas). Bias audit: 0 failures, 1 known gap, no audited file changed. The first full run had 2 red: defect 2, plus `orchestrator.test.ts` "hint … does not count" (not touched; it passed alone and in the quiet full rerun) |
| Calibration harness | `npm run content-judge:calibrate -- --out=…`; `-- --live` without approval | The dry run reads 44 items and makes no call ("recordable by Core: no"). `--live` is refused before reading any configuration (OD-23) |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass. 217 files, 2,234 tests. New: `LiveContent.test.tsx` (10: states in words, the uncalibrated state in 3 locales, loading and failure without numbers, three equal decisions, a failed save, a stale decision, a refusal listing reasons, the API bodies, the envelope, a network error), `curatedPacks.test.ts` (2: all 84 seed items parse with the real Lesson Engine schema), and the copy budget in `previewCopy.test.ts` |
| Real Chrome | `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-live-content.mjs` (Vite on 5330, stopped afterwards) | 36 configurations, 0 findings: 3 locales × 2 themes × 4 widths (320, 375, 768, 1280), the uncalibrated state in 3 locales, loading and failure, keyboard (visible focus, Enter decides), a real pointer hit, a failed and a stale decision, a refused publish listing 2 reasons at 320 px, a landed publish, reduced motion. Screenshots were read by hand (es-MX light 375, en-US dark 1280): the panels, the equal decisions and the paused sensitive category read correctly in both themes. Evidence: `audit-results/rebuild-live-content/` (ignored by git) |
| i18n | `bash agent/tools/check-i18n.sh` (Git Bash) | Pass: key parity, no hardcoded strings, every static `t()` key exists |
| Parity gates | `npm run live-content:check`; `node --test agent/tools/check-live-content-parity.test.mjs`; the other Mentor gates; `npm run tools:test` | OK. 11 new tests: green on the tree; the parsers read real values; red on a one-sided lexicon change, a signal missing from the CHECK, an outcome drift, a lowered standard floor in code, a lowered sensitive floor in SQL, a config default and an env value below the floor, a lowered calibration minimum, Oracle not parsing the suspension, and a missing migration. 108 tool tests (97 before) |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, the Node tests; `gate-auto-apply.mjs` on a simulated dry run listing the new file | 118 files, sequential, with RLS covered (4 new tables); phase declarations agree (97 expand, 21 contract); 21 Node checks pass; the auto-apply gate answers `apply=true` (additive) |
| Railway transport suite | `database/`: `npm test` (the whole suite, ending with `railway-migrate.test.mjs`) | Pass: 21 Node checks, then 12 transport scenarios plus the static probe-map/DEPLOYMENT.md DDL cross-checks. This also closes the S06.10/S06.11 open item (that suite had not finished at that commit); it took over 10 minutes under the shared load |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged) | Pass. `spec:check` first refused the legacy import (defect 3) |

Remaining acceptance boundaries (C.5 and C.6 stay In progress):

- The migration has not been applied to a physical PostgreSQL. The two functions, the credit lock and the CHECKs have only static evidence, and the types have not been regenerated.
- The judge is not calibrated. The human panel has not rated the seed set, and the live judge run is owner-run under OD-23. Until then, live generation is suspended by design.
- No production or canary data exists yet for the concordance, the coverage, the ladder shares or the demand ranking. Every threshold still needs calibration.
- The seed packs have not been loaded or released by a human. Their text needs pedagogical and native-speaker review, and so does the es-MX/pt-BR lexicon.
- The staff surfaces are isolated rebuilt panels. Composition in the finished staff console, and the text-fit, proportion and copy-budget audits against the real app driver, are wave 2 work.
- The Tier 1 items (the floors, the calibration bar, the suspension rule, the union rule for the risk category) need Pedagogical Reviewer and Safety/Trust Lead sign-off.

## S06.13 implementation and rationale (C.21, C.24)

The orchestrator labelled this wave checkpoint "S06.8". This record already uses S06.8 for C.14, so the wave is recorded as S06.13, which the plan above reserved for C.21 and C.24. The worktree was clean at `7e2f9ef8`, with no uncommitted draft to resume, so the wave was built from the SPEC.

- **Written policy:** the [evaluation loop and quality dashboard policy](../mentor/EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md). It states the tier each mechanism operates under, as C.22's Definition of Done requires of C.21 and C.24.
- **Thresholds:** every one is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found (the SPEC's "Current State" was partly stale)

**C.21.** The SPEC says no instrumented evaluation exists. By this wave that was no longer true: S06.1–S06.12 left seven operator reports and five Stage 7 kill switches. Each report covered one requirement and read its own table. Four gaps remained:

- no **rubric** a session was scored against;
- no **per-session** scoring, so one bad session vanished into a monthly average;
- no independent read of what the Mentor actually **said**;
- no **anomaly flags** that someone was required to act on.

The honesty ledger, the telemetry firings and the alliance record already carried most of the evidence. It was never read session by session.

**C.24.** The SPEC's description was accurate: nothing consolidated these signals. Each report printed to a terminal or a weekly workflow summary. Several tables' migration comments said "the C.24 dashboard later". No owner was named anywhere, and no review of the numbers was recorded.

### C.21: the rubric, the scorer, the loop and the flags

- **The rubric** (`transcriptRubric.ts`, `mentor-transcript-rubric.v1`). It has 12 criteria, each traced to an Appendix F metric or a Block C non-negotiable. Each criterion declares its kind (hard invariant, zero tolerance, ceiling, floor, diagnostic) and who can score it:
  - 10 criteria are rule-scored;
  - `tell_honored` and `scaffold_quality` are judge-only.

  The rubric is Tier 1 (Appendix E §3.1), so its SHA-256 is pinned to the last row of the rubric change record in the policy. That row names the Pedagogical Reviewer and the Safety/Trust Lead sign-offs, and both are pending for v1. Scores are stored with the hash, so trends never mix rubric versions.
- **The deterministic scorer** (`transcriptScoring.ts`, zero spend).
  - It re-reads the runtime's own records for each session, and it independently reads the delivered text in 3 locales for two checks.
  - **Declared emotions:** a second-person emotion claim, with genuine questions excluded and tag questions kept as claims.
  - **Repeated hints:** a hint repeated word for word inside a hint ladder.
  - It never invents an opportunity: no opportunity means `not_applicable`, never a pass.
- **The fixture set** (`transcriptFixtures.ts`). It holds 14 hand-written sessions in 3 locales covering every persona, with the author's intended outcome for all 12 criteria. The suite proves every rule-scored criterion both passes and fails.
- **The loop** (`evaluationLoop.ts`). It runs hourly via `POST /api/v1/tutor/internal/evaluation/run` (internal key) from `mentor-evaluation-loop.yml`, from inside the container, like the retention sweep. Operators use `tutor:evaluate`, which is a dry run unless `--record` is passed.
  - It scores ended, unscored sessions 10 minutes after they end, and stamps each with `tutor_sessions.evaluation_rubric_hash`, the coverage numerator.
  - It then recomputes every signal and opens or refreshes flags.
  - It stores a snapshot and a run row, and prunes its own artifacts.
  - **Fail closed:** a batch whose rows cannot all be read is not scored, and an unreadable source is `unavailable` and raises an urgent flag.
- **Anomaly flags** (`mentorQuality.ts`), in seven kinds:
  - zero-tolerance or invariant violations;
  - threshold breaches;
  - upward drift against the previous window;
  - bond-proxy drops against the persona's own baseline;
  - persona disparities;
  - **demographic-subgroup disparities** (age tier or locale within one persona, for rubric fail rates and for telemetry friction), which is Appendix E's "a persona producing disproportionately negative affect signals for a demographic subgroup";
  - unreadable sources.

  One active flag exists per anomaly (a unique index enforces it). The machine never closes one.
- **The live judge: a dry-run path only.** Oracle's `transcript-judge` harness takes Core's exported batch and re-verifies the rubric against its hash. It has three modes:
  - **Dry run:** the fixture scorer's intended labels stand in for the judge, at zero spend.
  - **Replay:** recomputes agreement from an earlier live output.
  - **Live:** refused unless `TRANSCRIPT_JUDGE_LIVE=approved`, before anything is read (OD-23).

  Every output is labelled "uncalibrated: Tier 3 information only". The schema's `scorer` CHECK admits `rules` only, so judge scores cannot be recorded until C.23. The parity gate guards that fence.

### C.24: the consolidated dashboard

- **One registry of 46 signals.**
  - All Appendix F §1.1–1.4 Mentor signals are included: answer-reveal rate, bond proxy, telemetry friction rate and content-ladder distribution, which C.24 names, plus every other signal S06 built.
  - Appendix C's learning-outcome and engagement-health metrics are included. Delayed retention, the 70–85% practice success band and time to mastery are computed.
  - The remaining metrics have no data source yet. They are listed as `not_instrumented`, with the requirement that owns them, and are never left off. Bias-audit coverage and simulated-student results are `external`, with the command that reports them.
- **Named owners.** Every signal names an owner role: `pedagogical_lead`, `safety_trust_lead` or `engineering_lead`.
  - Staff with `manage_users` name a person for a role. That person must be staff who can read analytics.
  - Only a person named for the flag's role can acknowledge a flag, or resolve it with the root cause in 10 to 2,000 characters. Core enforces this against the database.
  - Each owner signs one weekly review per role. That record is the Appendix F Dashboard Usage Rate.
  - Every action is written to `audit_logs`.
- **Freshness.** It is computed at read time: a snapshot older than 24 hours is out of date on every signal, and a loop that stopped never looks calm.
- **Core endpoints.** `GET /api/v1/admin/mentor-quality`, `POST .../flags/:id/acknowledge`, `POST .../flags/:id/resolve` and `POST .../reviews` require `view_analytics` before any data is read. `POST .../owners` also requires `manage_users`.
- **The rebuilt staff surface** is in `frontend/src/rebuild/staff/`:
  - `mentorQualityApi.ts`, the client layer;
  - `MentorQualityDashboard.tsx`, with four panels: status, flags, weekly review and signals;
  - fixtures and CSS.

  Its copy is `staffMentorQuality` in 3 locales, budget-checked at the adult app budget. The isolated preview is `?screen=staff-mentor-quality`. It shows actions only for the reader's named roles, as a courtesy; the control is Core.

### Instrumentation and gates

- **Migration** `*_mentor_evaluation_loop_and_quality_dashboard.sql` (expand). It adds `tutor_sessions.evaluation_rubric_hash` and six new tables: `tutor_transcript_score`, `tutor_evaluation_run`, `mentor_quality_snapshot`, `mentor_quality_owner`, `mentor_quality_flag` and `mentor_quality_review`. All have RLS and no client policy, and none holds text or a learner id.
- **Gate:** `npm run evaluation-loop:check`, new and wired into `repo-gates.yml`. It checks that Core, Oracle's judge harness, the staff client and the migration agree on:
  - the rubric criteria and the score outcomes;
  - the owner roles, flag kinds, severities and statuses;
  - the signal categories and statuses.

  It also checks the C.23 fence (no `judge` scorer), the Appendix F service levels (24-hour freshness, weekly review) and that the workflow calls the route that exists.
- **Operator commands:** `tutor:evaluate` and `transcript-judge`, both in README.

### Defects found while building, and their fixes

1. **A tag question hid a declared emotion.** The first scorer skipped every sentence ending in "?", so "Estás muy cansada, ¿verdad?" was not flagged. The lexicon test caught it. Spanish `¿…?` spans are now removed first, and tag questions (EN/ES/PT) are kept as claims.
2. **Undefined class.** A class the stylesheet does not define (`lf-quality-flag-head`) turned `designClasses.test.ts` red in the full frontend run. It was removed.
3. **Copy role on typed text.** The Chrome matrix found the resolution note's typed text had no copy role. The textarea is now `data`.
4. **Owner list over budget.** The first owner-gap line ("No one is named for: {roles}") would exceed the 12-word body budget with all three roles filled. The role names are now a separate `data` line.

### Proposals recorded for owner and pedagogy review

See [policy §10](../mentor/EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md#10-proposals-recorded-for-owner-and-pedagogy-review):

- the three owner roles and the assignment of each signal to a role;
- the disparity rule;
- sign-off of rubric v1;
- whether unacknowledged urgent flags should also notify someone outside the dashboard. Nothing is sent today.

### Deploy order (integration step for the orchestrator)

1. Apply `*_mentor_evaluation_loop_and_quality_dashboard.sql` before the Core release. Without it, the evaluation route answers 502 and the dashboard answers 502. The Mentor's live path touches none of this. `gate-auto-apply.mjs` answers `apply=true` (additive).
2. Deploy Core. `mentor-evaluation-loop.yml` then starts scoring hourly, and the first pass works through the backlog 500 sessions at a time. Oracle and the frontend can deploy in any order: the harness is operator-only and the surface is isolated.
3. Staff with `manage_users` name a person for each of the three roles. Until then the dashboard shows the gap, and no flag can be acknowledged.
4. Regenerate `database/types/database.ts`; Core uses narrow local types. The migration number `0119` may collide with other lanes. Renumber it at merge: code, tests and the gate reference only the descriptive suffix. No bias-audited Oracle file changed.

### S06.13 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. These are local results only: no real database, no CI run, no live model or judge call, and no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| Rubric and scorer | `backend/`: `npx vitest run src/__tests__/transcriptEvaluation.test.ts` | 39 pass. The rubric hash matches the policy's last change-record row. Every criterion is traceable and typed. The 14 fixtures give 140 verdicts matching the intended outcomes, and every rule-scored criterion both passes and fails. The set covers 3 locales and 4 personas. An empty session is not applicable. Shadow and superseded firings are no opportunity. Short acknowledgements are ignored. The emotion lexicon has 14 claims flagged and 14 sentences that must stay silent. The judge batch carries the rubric and hash and no ids. First run: 1 red (defect 1), fixed |
| Signals and flags | `npx vitest run src/__tests__/mentorQuality.test.ts` | 21 pass. Registry integrity. Not-instrumented and external rows are shown and raise no flag. Every unreadable source becomes an urgent flag for engineering. One false affirmation triggers a zero-tolerance flag. Declared emotion goes to Safety/Trust. The reveal ceiling applies per persona only above the sample. Upward drift is flagged. The goal floor is enforced. Persona and tier-subgroup disparities are flagged. The locale-subgroup friction disparity is flagged. Disparity needs gap, ratio and sample together. A bond-proxy relative drop and a persona disparity are flagged. Coverage uses only due sessions, so grace and zero-turn sessions are excluded. The open kill-switch fold is per component, with live content per category and cause. The uncalibrated judge is a breach. The practice band and time to mastery are read. A diagnostic signal never breaches. Scopes match the migration's CHECK. Freshness and review completion are computed. First run: 1 red (test arithmetic: median 1.5), fixed |
| Loop (fetch-stubbed PostgREST) | `npx vitest run src/__tests__/evaluationLoop.test.ts` | 8 pass. The pass scores and stamps two sessions. It writes no text or user id. It flags a declared emotion, a delivered false affirmation, a wrong closing script and the uncalibrated judge. It records the run and a 46-signal snapshot, and prunes. A failed honesty read scores nothing (partial). A dry run writes nothing. An active flag is refreshed, not duplicated. A failed run insert is `failed`. The internal route refuses a caller with no key and a signed-in learner (with no data read), validates the body, runs with the key, and gives 502 when the pass cannot record itself. **Mutation:** accepting a missing honesty read turned the fail-closed test red; restored |
| Dashboard routes (adversarial) | `npx vitest run src/__tests__/mentorQualityRoutes.test.ts` | 12 pass. The dashboard is served to `view_analytics` with the reader's named roles, and a signal missing from the snapshot is kept. A failed read gives 502. Every route refuses the parent-created kid, the independent teen, the adult learner and the verified parent Tutor (403). It refuses staff without `view_analytics` (403, no data read) and no session (401). A non-named staff member cannot acknowledge or resolve (403 `NOT_NAMED_OWNER`, no write). The named owner acknowledges, guarded on `status=open`, and it is audited. A conflict gives 409 and a missing flag 404. Resolving needs 10 or more characters, and extra fields are refused. The weekly review allows only a named owner, once per week. Naming an owner needs `manage_users`, refuses non-staff and staff without analytics (422), and is audited. **Mutation:** removing the named-owner check turned the refusal test red; restored |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass. 81 files (1 skipped, pre-existing), 1,872 tests (1,792 before this wave, +80) |
| Oracle | `oracle/`: `npx vitest run src/__tests__/transcriptJudge.test.ts`; `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run bias-audit -- --check` | 8 new pass: a tampered rubric is refused; the dry run makes no call and is labelled uncalibrated; live is refused before reading without approval or without a key; an approved live run with an injected judge makes one call per transcript and lists disagreements; replay needs a live run on the same rubric; verdict parsing is strict; the judge sees only judge-scorable questions. Full: 62 files, 1,671 tests (1,663 before). Bias audit: 0 failures, 1 known gap, no audited file changed |
| Harness end to end | `npm --prefix backend run tutor:evaluate -- --fixtures`; `-- --export-judge-batch=<file>`; `npm --prefix oracle run transcript-judge -- --batch=<file>`; the same with `--live` | 140/140 verdicts match. The Core-exported batch's rubric hash is re-verified by Oracle. The dry run makes no call and reports "a live run makes 14 paid call(s)". `--live` is refused (exit 2) without `TRANSCRIPT_JUDGE_LIVE=approved` |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass after defect 2. 218 files, 2,246 tests (2,234 before). New: `MentorQuality.test.tsx` (12 tests). They cover: labels for every signal in 3 locales; freshness, stale, never computed and gaps in words; loading and failure with no numbers; flags urgent-first with owner and scope; actions only for the named owner; acknowledge; resolve gated on the root cause; a refusal said in words; statuses in words with glyphs only for on target and needs review; percentage, count and score formats; the weekly sign-off and "already signed"; 3 locales in dark mode; closed API bodies; no guessed success; Core code mapping. The copy budget in `previewCopy.test.ts` covers every `staffMentorQuality` string at the adult budget |
| Real Chrome | `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-mentor-quality.mjs` (Vite on 5330, stopped afterwards) | 36 configurations, 0 findings, covering 3 locales × 2 themes × 4 widths (320, 375, 768, 1280) plus: out of date and never computed; loading and failure; a reader with no role sees no actions; keyboard (visible focus, Enter acknowledges); resolving with a typed root cause at 320 px; a refused action; the weekly sign-off and "already signed"; a real pointer hit; reduced motion. The first run had 1 finding (defect 3), fixed. Screenshots were read by hand (es-MX light 375 cropped, en-US dark 1280 cropped): status, flags with owner and scope, and signal rows with status words and glyphs read correctly in both themes. Evidence: `audit-results/rebuild-mentor-quality/` (ignored by git) |
| i18n | `bash agent/tools/check-i18n.sh` (Git Bash) | Pass: key parity, no hardcoded strings, every static `t()` key exists |
| Parity gates | `npm run evaluation-loop:check`; `node --test agent/tools/check-evaluation-loop-parity.test.mjs`; `npm run tools:test` | OK. 8 new tests: green on the tree; the parsers read real values; red on a rubric criterion missing from the CHECK, a client flag kind or owner role drift, an Oracle outcome drift, a `judge` scorer admitted, a looser freshness or review cadence, a workflow calling the wrong route and a missing migration. 116 tool tests (108 before) |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`; `gate-auto-apply.mjs` on a simulated dry run listing the new file | 119 files, sequential, with RLS covered (6 new tables); phase declarations agree (98 expand, 21 contract); the auto-apply gate answers `apply=true` (additive) |
| Railway transport suite | `database/`: `npm test` (the whole suite, ending with `railway-migrate.test.mjs`) | Pass: 21 Node checks, then 12 transport scenarios plus the static probe-map/DEPLOYMENT.md DDL cross-checks (about 20 minutes under the shared load, with other lanes running the same suite) |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged) | Pass on the first run |

Remaining acceptance boundaries (C.21 and C.24 stay In progress):

- **Database.** The migration has not been applied to a physical PostgreSQL. The CHECKs, the partial unique index and the PostgREST filters have only static and stubbed evidence, and the types have not been regenerated.
- **Production data.** None exists yet: the Appendix F "Measured" criterion needs real or canary sessions scored and the dashboard read by its owners. Every threshold still needs calibration.
- **Owners.** They are not named. The weekly review and flag actions start only after staff name a person for each role.
- **Rubric sign-off.** The Pedagogical Reviewer and the Safety/Trust Lead have not signed rubric v1 (Tier 1).
- **Judge-only criteria.** `tell_honored` and `scaffold_quality` stay unscored until a transcript judge is calibrated (C.23, S06.14). The live judge run is owner-run (OD-23).
- **Appendix C metrics.** Most Appendix C engagement-health and learning-outcome metrics are not instrumented by their owning requirements yet; the dashboard lists each one.
- **Staff surface.** It is an isolated rebuilt surface. Composition in the finished staff console, and the text-fit, proportion and copy-budget audits against the real app driver, are wave 2 work.
- **Tier 3 review.** The Pedagogical Lead has not yet confirmed the metrics are live and visible (Appendix F Part 2.1).

## S06.14 implementation and rationale (C.22, C.23)

The orchestrator labelled this wave checkpoint "S06.9". This record already uses S06.9 for C.15 and C.7, so the wave is recorded as S06.14, which the plan above reserved for C.22 and C.23. The worktree was clean at `566154b5`, with no uncommitted draft to resume, so the wave was built from the SPEC.

- **Written policies:** the [self-improvement governance policy](../mentor/SELF-IMPROVEMENT-GOVERNANCE-POLICY.md) (C.22) and the [judge-calibration policy](../mentor/JUDGE-CALIBRATION-POLICY.md) (C.23, with the owner-run runbook).
- **Thresholds:** every new one is in the [Threshold Recalibration Log](../mentor/THRESHOLD-RECALIBRATION-LOG.md) as "proposed, pending calibration".

### Current state found (the SPEC's "Current State" was partly stale)

**C.22.** The SPEC was accurate on the substance. Each S06 policy had a tier table, but:

- no document defined the tiers or the promotion rule;
- nothing enforced them. Nothing stopped an automated commit from changing the moderation judge, the rubric or a kill-switch floor, and no record said which Tier 1 code had been reviewed;
- one workflow could already write to the repository: `pulse-dependabot-automerge.yml` merges Dependabot pull requests. No declaration bounded what it could reach.

**C.23.** The SPEC was stale. S06.12 had built a calibration for one judge (the live-content judge): raw agreement per category, 2 or more raters, a 35-day cadence. S06.13 had built an uncalibrated transcript-judge harness. Missing:

- a standard shared by every judge;
- chance-corrected agreement. Raw agreement on a seed set where most items pass flatters an approve-everything judge;
- a minimum number of fail items per stratum;
- any check of the documented judge biases;
- spot checks and an automatic recalibration trigger;
- a gold set for the transcript judge;
- any path by which a calibrated judge could gate a Tier 2 change.

The dashboard listed `transcript_judge.agreement`, `governance.tier_compliance` and `canary.regression_rate` as not instrumented.

### C.23: one calibration standard for every judge

- **The registry and the standard** (`backend/src/services/pedagogy/judgeCalibration.ts`). `JUDGE_REGISTRY` names each judge, what a passed calibration lets it do, its questions, strata, cadence, owner-run harness and approval variable. `computeJudgeCalibration` recomputes everything from raw labels and verdicts:
  1. the panel's pairwise agreement (≥ 85%) and Fleiss' kappa (≥ 0.60);
  2. the judge against the panel majority **in every stratum** (≥ 90%, enough items, at least N panel passes and N fails), with Cohen's kappa per question (≥ 0.70). A false alarm counts against the judge, as a miss does;
  3. the verbosity-bias gap (≤ 15 points) and the self-enhancement check (not the author's model family).

  The **scope** is the list of calibrated questions, so the transcript judge may be trusted on some criteria and not others. Dry runs, replays, author labels, a single rater, a duplicate rater name, a missing verdict and an identity mismatch are all refused.
- **Trust over time** (`judgeTrust`). The five states are `uncalibrated`, `failed`, `recalibration_required`, `stale` and `passed`, with a due date and a "due soon" warning.
  - The latest full calibration decides.
  - A failed spot check requires a new calibration (Appendix F §1.3's automatic trigger).
  - A passed spot check restarts the monthly cadence.
- **The database boundary** (migration `*_mentor_judge_calibration_registry.sql`, expand). `mentor_judge_calibration` and `mentor_judge_calibration_stratum` enforce three things:
  - CHECK floors for every threshold, and per-judge minimum strata;
  - a pass must follow from its own numbers, and may not come from the same model family;
  - the only write path, `record_mentor_judge_calibration`, recomputes each stratum's pass and the scope, and checks a spot check's target, then refuses a row whose claims differ.

  RLS is on with no client policy.
- **The live-content judge moved onto it.** The live gate reads the content judge's trust from the shared registry, and its recording command writes there. `tutor_content_judge_calibration` was never written in any environment; it is left in place and marked superseded. Its bar gains the kappas, label balance and bias checks.
- **The transcript gold set** (`transcriptGoldSet.ts`, `transcript-gold.v1`). 47 hand-written transcripts in 3 locales and 3 age bands, split into strata:
  - `routine` (20): the plain cases;
  - `hard` (27): borderline cases, which is where Appendix E says judges fail.

  Every question has at least 10 applicable transcripts per stratum, with 4 of each label. Ids are opaque, so the panel's sheet cannot leak an answer.
- **The pipeline** (`npm --prefix backend run tutor:judge-calibration`):
  - `--export-rating-sheet` writes the blind sheet and a JSON template;
  - `--export-gold-batch` writes the judge batch, which Oracle's strict schema accepts, with a new `gold_set` source and age band;
  - `--dry-run` runs everything at zero spend and is never recordable;
  - `--record` handles either judge and spot checks;
  - `--status` shows every judge's trust;
  - `--verify-proposal` answers whether the transcript judge may gate Stage 3 of a given Tier 2 change. It checks the trust at the time of scoring, the identity and the scope. A calibration recorded after the scoring cannot vouch for it.
- **Oracle.**
  - The transcript judge's system prompt now defines pass and fail (defect 1 below).
  - Both harness runs carry the author model.
  - Live runs stay refused without `TRANSCRIPT_JUDGE_LIVE=approved` or `CONTENT_JUDGE_CALIBRATION_LIVE=approved` (OD-23).
- **Dashboard (C.24).** `transcript_judge.agreement` is instrumented, and is an urgent breach for the Safety/Trust Lead whenever the judge is not `passed`. `governance.tier_compliance` and `canary.regression_rate` are `external`, with the governance gate as their source. The staff preview fixtures follow.
- **Unchanged on purpose.** Judge-written transcript scores stay unrecordable (`scorer` admits `rules` only). Scoring real sessions would send children's transcripts to a paid provider every hour, which needs a privacy review and a spend decision as well as a calibration.

### C.22: the tiered model, enforced

- **The registry** (`docs/rebuild/mentor/governance/registry.json`). It holds 12 components:
  - 7 Tier 1: the safety judge, the rubric and judges, the Stage 2 suites and bias audit, the non-negotiables, the monetization-adjacent session caps, the Stage 7 thresholds, and the governance model itself;
  - 1 on the live-content axis;
  - 3 Tier 2: dialogue and persona, pacing and signals, runtime;
  - 1 Tier 3: reporting.

  Each has an owner, a policy, named examples and an append-only tier history. Every one of the 78 files under the governed roots belongs to exactly one component, and a file that mixes tiers takes the strictest. The registry also holds:
  - 7 Tier 2 parameters with approved bounds;
  - the automation policy documents for C.5, C.21, C.23 and C.24;
  - the declared automated pipelines;
  - an empty list of proposal generators;
  - the Appendix F Stage 2 personas;
  - the adoption decision.
- **The Tier 1 change record** (`tier1-change-record.json`). It holds one row per change to each Tier 1 or live-content component: the content hash (LF-normalized, the bias-audit log excluded), what changed, `origin: human`, and the two sign-offs. It is append-only against the base, and a sign-off, once given, cannot change. The 8 baseline rows record the code as found at adoption.
- **The gate** (`npm run governance:check`, `agent/tools/check-mentor-governance.mjs`) checks:
  - Stage 0 coverage;
  - that every Tier 1 change is recorded;
  - that no promotion happens without a decision signed by both leads;
  - that Tier 2 values stay inside their bounds;
  - that the tier statements exist (DoD c);
  - that every repo-writing workflow is declared and cannot reach Tier 1;
  - the proposal records (`evaluateProposal`: the tier is computed from the paths; automated plus Tier 1 is a violation; the stages each tier needs, with Stage 3 bypassed for Tier 1, routed to Stage 4 when the judge is uncalibrated, two distinct Stage 4 reviewers, a canary of at least 20 human-read transcripts, and the metric shipped at Stage 6);
  - the Canary Regression Rate;
  - with `--range`, the automated-origin fence: a `[bot]` author or a `Mentor-Change-Origin: automated` trailer never touches Tier 1 or live content, and cites a cleared `Mentor-Proposal` for any other governed file.
- **Where the gate runs.**
  - `--release` is the Tier-Compliance Audit: every Tier 1 version and decision signed off. `release:readiness` runs it.
  - CI runs the rest on every push and pull request in a new `repo-gates.yml` job (`mentor-governance`, full history, `--base` and `--range`), and uploads the audit JSON.
- **The judge-calibration guard** (`npm run judge-calibration:check`, in `repo-gates.yml`) checks:
  - the vocabulary parity across Core, Oracle and the migration;
  - the Tier 1 floors, the per-judge minimums and the monthly cadence;
  - the recomputation needles in the SQL function;
  - that the live gate and the dashboard read the registry;
  - the owner-approval refusals.

  The live-content gate's copy of the calibration minimums moved here, and it keeps the concordance floor.
- **The first Tier-Compliance Audit** (C.22 DoD b) was run against the current architecture before any proposal generator exists. Its result is recorded in the [governance policy §7](../mentor/SELF-IMPROVEMENT-GOVERNANCE-POLICY.md#7-the-tier-compliance-audit-appendix-f-13):
  - no violation;
  - one declared pipeline, scoped to `pulse/**`;
  - no automated commit touching Tier 1 in `main..HEAD`;
  - the release audit fails, as designed, until the 8 baseline rows and the adoption decision are signed.

### Defects found while building, and their fixes

1. **The transcript judge's prompt was ambiguous.** Every judge question is a yes/no question ("Did the Mentor repeat a hint…?"), and the prompt said to answer "pass" or "fail" without saying which meant yes. A live calibration would have measured the model's guess at the convention, not its judgement. The prompt now defines pass as "the Mentor did the right thing on that question", and an Oracle test pins it. This changes the judge identity; the judge was uncalibrated, so there was no trust to lose.
2. **The panel's sheet leaked the answers.** The first gold-set ids were descriptive (`h05-es-tag-question-paraphrased-hint`), and the blind sheet printed them. Ids are now opaque (`gold-` plus 8 hex characters), and a test asserts that neither the key nor the author note appears in the sheet or the batch.
3. **Two author labels were mis-coded** (a tag-question emotion claim and a hedged boredom claim were labelled pass). The dry run's per-stratum table showed only 3 hard emotion fails where 4 were planned, and both were fixed.
4. **Kappa sat on the wrong level.** Kappa was first applied per stratum row, so a clean routine stratum showed "not met" because of a hard-stratum miss. Kappa is now judged per question, separately from each stratum's own pass, in Core and in the SQL function.
5. **A mutation survived.** Removing the weakest-stratum rule left the suite green, because the first test's disagreements also dropped kappa below its floor. The test now uses three false alarms, so kappa stays at or above 0.70 and only the stratum rule can exclude the question. The mutation now turns it red, and it was restored.

### Proposals recorded for owner and pedagogy review

See [governance policy §10](../mentor/SELF-IMPROVEMENT-GOVERNANCE-POLICY.md#10-proposals-recorded-for-owner-review) and [judge-calibration policy §9](../mentor/JUDGE-CALIBRATION-POLICY.md#9-proposals-recorded-for-owner-and-pedagogy-review). The ones with a consequence:

- **Release blocking.** `release:readiness` now fails until both leads sign the adoption decision and the baseline rows. This is the SPEC's reading.
- **The component boundaries.** Mixed files are Tier 1, including `controller.ts`, `orchestrator.ts` and Core's kill-switch modules.
- **The kappa floors and the verbosity gap.** These are engineering readings of "a defined threshold".
- **Branch protection on `main`**, requiring the `mentor-governance` job.
- **Runtime clamping** of Tier 2 environment overrides.
- **A human-panel calibration of the moderation judge.**

### Deploy order (integration step for the orchestrator)

1. Apply `*_mentor_judge_calibration_registry.sql` before the Core release. Without it, the live gate cannot read a calibration and keeps live generation suspended (fail closed, the same state as today), the transcript-judge signal is `unavailable`, and recording fails. `gate-auto-apply.mjs` answers `apply=true` (additive).
2. Core, Oracle and the frontend can then deploy in any order. The Oracle changes are the harness and scripts only; nothing in the live path changed.
3. **Merge integration.**
   - Any lane that changed a file in a Tier 1 or live-content component turns `governance:check` red until `npm run governance:check -- --record --change="<what>"` is run on the merged tree and the record is committed. This is the C.22 rule working as designed; the baseline rows here hash this lane's tree.
   - A new Mentor file from another lane must be classified in the registry.
   - Renumber migration `0120` at merge if it collides. Code, tests and the gates reference only the descriptive suffix.
   - No bias-audited Oracle file changed.
4. Regenerate `database/types/database.ts`. Core uses narrow local types.
5. **Owner-side.**
   - The two leads sign the adoption decision and the baseline rows.
   - Branch protection on `main` (repository configuration).
   - The panels rate both seed sets.
   - Approve and run the two live calibrations: 91 paid calls (OD-23).

### S06.14 verification log (25 September 2026)

Executed 25 September 2026 in the lane worktree (`/c/lf-wt/s06`) with `VITEST_MAX_THREADS=3`. These are local results only: no real database, no CI run, no live model or judge call, and no production observation.

| Boundary | Command / evidence | Result |
|---|---|---|
| C.23 standard, trust, Stage 3, gold set, export, record | `backend/`: `npx vitest run src/__tests__/judgeCalibration.test.ts` | 37 pass, covering:<ul><li>**Statistics.** Fleiss and Cohen kappa known values; always-pass on a 90/10 set scores 0; majority and tie rules; model families.</li><li>**Registry and floors.** The content judge keeps the S06.12 bar.</li><li>**Gold-set integrity.** At least 10 per question per stratum, 4 of each label; no controlling-language label for a child; no money words.</li><li>**Computation.** The dry run is never recordable. A clean panel and a clean judge pass all 6 questions. Always-pass calibrates nothing. Weakest-stratum exclusion. A false alarm counts. A noisy panel fails. Same family fails. Verbosity bias fails. Six refusal kinds. A spot check with the same identity and scope (and scope lost). The content judge answers pass/fail only.</li><li>**Trust.** Uncalibrated, passed, stale, due soon; a failed recalibration; a failed spot check requires recalibration; a new pass restores trust; a passed spot check restarts the cadence; no cross-judge vouching; the end of the first year.</li><li>**Stage 3.** Scope only; uncalibrated, stale, a wrong identity, a wrong judge or empty criteria route to Stage 4; a later calibration cannot vouch.</li><li>**Blind export.** No labels, keys, notes or strata; opaque ids; rating-file refusals; run-file refusals; the batch keys match Oracle's strict schema.</li><li>**Recording.** One RPC with every threshold, then the audit row; a dry run never reaches the database; a database refusal message is surfaced.</li><li>**Dashboard.** OK only when passed; stale and recalibration required are urgent breaches; unavailable when unreadable; the two external signals.</li></ul>First run: 1 red (defect 4), fixed. **Mutation:** removing the weakest-stratum rule survived the first test (defect 5); after the fix it turns red, and it was restored |
| Live gate on the shared registry | `npx vitest run src/__tests__/liveContentGovernance.test.ts` | 37 pass. `calibrationStatus` now reads rows: a failed recalibration and a failed spot check un-trust the judge; a transcript-judge row never vouches for the content judge. The fetch-stubbed gate reads `mentor_judge_calibration`. The route suites (`tutor.test.ts`, `admin.test.ts`) point at the new table |
| Loop and dashboard | `npx vitest run src/__tests__/evaluationLoop.test.ts src/__tests__/mentorQuality.test.ts src/__tests__/mentorQualityRoutes.test.ts` | 41 pass. The loop reads the calibration registry and opens an urgent flag for the uncalibrated transcript judge |
| Core full | `backend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass. 82 files (1 skipped, pre-existing), 1,909 passed + 1 skipped (1,872 before, +37). First lint run: 2 unused parameters in the new test, fixed |
| Oracle | `oracle/`: `npm run type-check`, `npm run lint`, `npx vitest run`, `npm run verify:tutor`, `npm run verify:pedagogy`, `npm run gym:pedagogy`, `npm run bias-audit -- --check` | Pass. 62 files, 1,674 tests (1,671 before, +3 in `transcriptJudge.test.ts`: the gold-set source and age band, the pass/fail definition, the author model on the run). The privacy boundary is sealed. Gym OK. Bias audit: 0 failures, 1 known gap, no audited file changed. The first full run had 3 red files that I had not touched (`boot-skills` timing out at 10 s, `hardening`, `live-session`), with the Core suite running in parallel. They passed alone (79 tests), and the quiet full rerun passed |
| Pipeline end to end (zero spend) | `tutor:judge-calibration -- --export-rating-sheet`, `--export-gold-batch`; `oracle transcript-judge -- --batch=<gold> --out=<run>`; the same with `--live`; `tutor:judge-calibration -- --record --judge=transcript_judge --run=<dry run> --ratings=a,b` | The sheet is 47 transcripts, with no label, stratum or key. Oracle's strict schema accepted the Core gold batch ("a live run makes 47 paid call(s)"). `--live` is refused (exit 2) without approval. `--record` on the dry-run file computes all 12 strata and is **refused** ("not obtained live"). `--dry-run` shows full scope and "NOT RECORDABLE" |
| Governance gate | `node --test agent/tools/check-mentor-governance.test.mjs`; `npm run governance:check -- --range=main..HEAD`; `-- --release --report=…` | 18 pass. They prove red on each of: an unclassified or doubly claimed file; a stale component; missing examples or policy; a tier/history mismatch; an unrecorded Tier 1 change (and green after `--record`); an automated ledger row; append-only violations (row removed, hash or sign-off rewritten, decision or component removed); an unsigned promotion or a move out of the live axis; a Tier 2 value out of bounds or in the wrong tier; a missing tier statement; an undeclared or over-scoped workflow (a comment is not a capability); proposal stage rules (never automate, weaker tier, Stage 3 bypass, distinct reviewers, Stage 2 failures, canary minimum, Stage 6); the canary rate; the commit fence (bot on Tier 1, trailer without proposal, files outside the proposal, a draft proposal). Also: CRLF-insensitive hashing and the excluded audit log. On the real tree: 12 components, 78 files, 8 recorded components, 19 lane commits checked, OK. The release audit fails with 9 problems (8 unsigned components and the adoption decision), as designed. The gate also caught its own edit: changing the gate file after the first baseline turned `governance.model` red until it was re-recorded |
| Judge-calibration guard | `npm run judge-calibration:check`; `node --test agent/tools/check-judge-calibration-parity.test.mjs` | OK. 7 pass: green on the tree; the parsers read real values; red on a lowered Core floor or gap, a lowered judge minimum or a looser cadence, a lowered SQL floor, a dropped stratum, removal of the same-family rule, a client policy, Oracle dropping `gold_set` or the author model, a live run losing its approval, and the live gate reading the wrong judge |
| Other gates | `npm run live-content:check` (and its 11 tests, calibration floors moved out, concordance guard kept), `npm run evaluation-loop:check`, `npm run tools:test` | OK. 141 tool tests (116 before, +25) |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npx vitest run` | Pass. 218 files, 2,246 tests (fixtures only changed: the three signals' instrumented state) |
| Real Chrome | `REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-mentor-quality.mjs` (Vite on 5330, stopped afterwards) | 36 configurations, 0 findings (3 locales × 2 themes × 4 widths plus the state and interaction checks). I read the en-US dark 1280 screenshot by hand: "Transcript judge agreement" shows ✗ Needs review, and "Tier rules followed" and "Canary rollbacks" show "Measured elsewhere". Evidence: `audit-results/rebuild-mentor-quality/` (ignored by git). No copy changed, so the i18n check was not needed |
| Migrations (static) | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`; `gate-auto-apply.mjs` on a simulated dry run listing the new file | 120 files, sequential, RLS covered (2 new tables); phase declarations agree (99 expand, 21 contract); the auto-apply gate answers `apply=true` (additive) |
| Railway transport suite | `database/`: `npm test` (the whole suite, ending with `railway-migrate.test.mjs`) | Pass: 21 Node checks, then 12 transport scenarios plus the static probe-map/DEPLOYMENT.md DDL cross-checks |
| Repo gates | `npm run spec:check`, `npm run secrets:check` (every new file staged), `npm run governance:check` on the staged tree | Pass on the first run |

Remaining acceptance boundaries (C.22 and C.23 stay In progress):

- **Database.** The migration has not been applied to a physical PostgreSQL. The recording function's recomputation and the CHECKs have only static evidence and the fetch-stubbed RPC contract. The types have not been regenerated.
- **Sign-off (Tier 1).** The Pedagogical Reviewer and the Safety/Trust Lead have not signed the adoption decision, the 8 baseline rows or the calibration standard. The release audit fails until they do, by design.
- **Calibration.** No panel has rated either seed set. The live calibrations are owner-run (OD-23: 44 + 47 paid calls). Until then, both judges are `uncalibrated`, live generation stays suspended, and Stage 3 routes to human review.
- **Gold-set review.** The gold set is hand-written. It needs native-speaker review (es-MX, pt-BR) and pedagogy review of the hard cases, and should grow from consented real transcripts once a privacy review allows it.
- **Enforcement the owner controls.** Branch protection on `main` (requiring the `mentor-governance` job), and runtime clamping of Tier 2 environment overrides, are proposals.
- **The pipeline itself.** No proposal has gone through it yet, and no automated proposal generator exists. The canary infrastructure is the H.7 experiment console. The first real Tier 2 change will be the pipeline's own acceptance test.
- **Thresholds.** Every new threshold (kappas, verbosity gap, strata sizes, canary minimum, Tier 2 bounds) still needs calibration.
