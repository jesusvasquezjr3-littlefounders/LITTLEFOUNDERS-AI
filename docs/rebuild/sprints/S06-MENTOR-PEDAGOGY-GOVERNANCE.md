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
| S06.2 | C.18 anti-sycophancy constraint + answer-reveal-rate instrumentation | Planned |
| S06.3 | C.10 corroborating-evidence rule (two consecutive observations before mastery/remediation) | Planned (the controller's existing 3-opportunity mastery minimum and failure guardrails are the foundation) |
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

## Verification log

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Ladder unit tests | `oracle/`: `npm test -- --run src/__tests__/hintLadder.test.ts` | 7 tests: locale hint/tell classification, exact escalation order, never-repeat, escape hatch, per-step isolation, reset, snapshot round-trip |
| Snapshot fence | `oracle/`: `npm test -- --run src/__tests__/snapshotFence.test.ts` | The fence caught the new field (as designed), then passed after the ladder joined the snapshot |
| Oracle regression | `oracle/`: `npm test` | 41 files, 1,136 tests passed |
| Oracle static checks | `oracle/`: `npm run type-check`, `npm run lint` | Passed, including the scripts and test tsconfigs |

Remaining acceptance boundaries: no live-conversation observation of the ladder in flight, no Appendix F metric for hint-level distribution yet, and no human pedagogy review. C.13 remains in progress.
