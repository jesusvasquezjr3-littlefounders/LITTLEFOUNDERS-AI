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
| S06.6 | C.9/C.20 Behavioral Telemetry Layer (signal strength, never emotion labels) + dialect/ASR bias audit | Planned |
| S06.7 | C.19 disengagement check-in move | Planned |
| S06.8 | C.14 self-explanation prompt + quality check | Planned |
| S06.9 | C.15/C.7 Alliance Controller + disposition profile persistence | Planned |
| S06.10 | C.11 two-tier spaced review | Planned |
| S06.11 | C.17 age-band dialogue calibration | Planned |
| S06.12 | C.5 dynamic judge-sampling rate + C.6 curated activity-pack tier | Planned |
| S06.13 | C.21 transcript scoring + anomaly flags + dashboard; C.24 consolidated monitoring | Planned |
| S06.14 | C.22 tiered governance + C.23 judge calibration process | Planned |

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

Apply `*_mentor_session_end_and_closing.sql` first. Deploy Core next (it accepts the new close fields as optional and starts returning `opening`). Deploy Oracle last. The frontend is independent (it only reacts to frames an older Oracle never sends). Regenerate `database/types/database.ts` after the migration; Core writes the new columns through narrow local types. Run `npm run speech:pregenerate` in `oracle/` when the owner approves the one-time synthesis.

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
