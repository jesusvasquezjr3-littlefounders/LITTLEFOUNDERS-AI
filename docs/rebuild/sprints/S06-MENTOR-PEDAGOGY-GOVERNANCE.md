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
| S06.4 | C.16 four end-reason closing scripts | Planned |
| S06.5 | C.8/C.12 behavioral-signature session-end signal | Planned |
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
