# Mentor integrity policy: honest feedback and corroborated decisions

Status: engineering policy for Product C.10 and C.18, written 24 September 2026 (S06 checkpoints S06.2 and S06.3). It implements the binding SPEC and adds no product decision of its own. It becomes release policy only after the Pedagogical Reviewer and the Safety/Trust Lead sign off (Appendix F Part 2.1, "Reviewed"). Thresholds live in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md), not here.

Sources: Product C.10 and C.18, the Block C Real-Time Interaction Standard, Appendix D §2.3, §2.6 and §3.7, Appendix F §1.1, §1.2, Part 2 and Part 3 Stage 7, and owner decisions OD-23 (zero spend) and the §5 glossary.

## 1. Governance tier

Both rules are **Tier 1 (never-automate)** constraints under the C.22 model the SPEC mandates. The Block C standard lists them among the non-negotiable behavioral constraints:

- "No mastery or remediation decision executes on a single observation" (C.10).
- "Praise is always tied to a specific, verifiable action; the Mentor never affirms a financially unsound in-scenario decision because the learner seems pleased" (C.18).

No automated process may change these rules, their enforcing code or their thresholds. A change needs a written proposal, sign-off from the Pedagogical Reviewer and the Safety/Trust Lead, and an entry in the Threshold Recalibration Log.

## 2. The anti-sycophancy constraint (C.18)

### 2.1 The rule

1. Praise names one specific thing the learner did, such as a number, a step or their own words. Generic praise by itself is a defect.
2. The Mentor never tells a learner a wrong answer is right, never calls a far-off answer "almost", and never agrees with an idea because the learner sounds sure.
3. The Mentor never endorses a financially unsound in-scenario decision, even inside a game or a story. Examples include spending everything saved, borrowing for a want, and ignoring a cost or a risk. The Mentor names what was sensible, shows one concrete consequence and asks what the learner would change.
4. The Mentor does not give the answer while the learner is still working it out, unless the learner explicitly asks ("just tell me") or the C.13 hint ladder has reached "tell".

### 2.2 Enforcement, strongest last

| Layer | Mechanism | Where |
|---|---|---|
| Advice | The rule is part of the Mentor system prompt | `oracle/src/tutor/feedbackHonesty.ts` (`ANSWER_HONESTY_RULE`), included by `prompt.ts` |
| Fact given to the model | The Mentor is told when the server verified a wrong answer, or detected a stated wrong idea or unsound decision | `orchestrator.ts` (verdict notes and `unsoundNote`) |
| Deterministic check | Every turn reacting to a server-verified wrong answer, or to a stated wrong idea or unsound decision, is checked for affirmation or endorsement in EN, es-MX and pt-BR. A hit is repaired once; if the repair still affirms, a scripted line replaces it. The affirming draft is never delivered | `isSycophantic` in `feedbackHonesty.ts`, applied in `produce()` |
| Detection of unsound decisions | The stated-misconception classifier reads decision patterns in all three locales (for example `ignores-downside`, `highest-price-wins`, `budget-is-per-item` and `returns-payment`) | `statedMisconception.ts` |
| Measurement | Every Mentor turn produces a honesty row with its sequence, reveal facts, false-affirmation catch or delivery, and praise class | `tutor_turn_honesty`, written by Core |

The checks run only where the server knows the truth: a graded activity, a voice-check verdict, the arithmetic verdict, or a detected stated claim. They never infer that an answer is wrong. Praising effort after a miss is the sanctioned form ("muy bien que lo intentaste"), and the detector accepts it.

### 2.3 Answer-reveal monitoring

- **Definition** (Appendix F §1.2): the share of Mentor turns inside a hint-ladder, repair or open-activity sequence that reveal a solution without the learner asking. Rates are reported per session and per persona (Dina, Liruf, Rho, Zara).
- **What counts as a reveal:** Core finds the open activity's own answer key stated in the turn (`backend/src/services/pedagogy/answerReveal.ts`). Oracle's checks for a question answered in the same turn and for an explicit answer statement also count. A reveal after an explicit "tell me" request, or after the ladder reached "tell", is sanctioned and does not count.
- **Unscorable turns:** a turn is unscorable when no key is recoverable or the answer was already on screen. It is left out of the key-based count rather than guessed.
- **Elevated rate:** a rate above the ceiling, or any upward drift against the previous window, is a **controller defect**. It is never an acceptable cost of being "helpful".
- **Authoritative source:** Appendix F names sampled transcript scoring by a calibrated judge, with a human spot-check, as the metric's authoritative source. That work belongs to C.21 and C.23 (checkpoints S06.13 and S06.14). The deterministic measurement here is the floor beneath it, and the only part that runs without paid spend (OD-23).

## 3. The corroborating-evidence rule (C.10)

### 3.1 The rule

The pedagogy controller (`oracle/src/tutor/controller.ts`) executes its two most consequential moves only on at least two consecutive **qualifying** observations of the same knowledge component:

| Move | Observations that count | Neutral (neither counts nor breaks the chain) | Breaks or resets the chain |
|---|---|---|---|
| Declare mastery (CELEBRATE, and TRANSFER on a re-encounter) | Graded correct answer, unassisted and not fragile | A surprising correct (belief below 0.5) that came too fast to have been read, which may be a lucky guess | Any graded miss; a stated wrong idea; a hint-assisted correct; a hesitant correct before a revocation |
| Trigger remediation (REMEDIATE) | Graded miss or stated wrong idea agreeing on the same diagnosis | A miss that looked like a guess (too fast to read) | Any graded correct answer; a miss with a different diagnosis restarts the chain |
| Trigger rescue (RESCUE) | Two consecutive graded failures, or three turns without progress (existing floors, which rise if the requirement is raised) | None | A correct answer |

These rules add to the existing bars and replace none of them: the posterior of at least 0.85, the three-opportunity minimum, the fluency check and the failure guardrails all still apply.

Every mastery declaration stays provisional:

- In session, a later contradicting answer revokes it (`masteryRevokedKcIds`), and mastery must be earned again on two consecutive answers.
- In storage, the learning map shows "mastered" only while the learner's latest attempts end in at least two consecutive correct answers. The planner keeps an uncorroborated knowledge component on the frontier, so one later miss demotes it immediately (Appendix D §2.3).

### 3.2 Evidence is recorded, not only concluded

Every consequential decision carries its evidence (`rule`, `observations` and `required`) into the trajectory log (`tutor_trajectory_step`). The map node exposes `consecutiveCorrect`. A parent-facing explanation can therefore say "moved on after 2 correct answers in a row" rather than "the AI decided" (Appendix D §2.6).

### 3.3 Kill switch (Appendix F Part 3 Stage 7)

Trigger: the Mastery Declaration Reversal Rate exceeds the ceiling, or the Corroborating-Evidence Compliance Rate drops below 100%. Operating procedure:

1. The Pedagogical Lead and the Safety/Trust Lead review the `npm run tutor:integrity-report` output and the affected knowledge components.
2. If a rollback is decided, set `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS` on Oracle to the affected `kc.key` values only. Never lower `TUTOR_CORROBORATION_MIN_OBSERVATIONS` globally. Record the trigger, cause and time in the Kill-Switch Trigger Log (Appendix F §1.3).
3. Decisions made under a rollback are reported separately (`underRollback`) and are never hidden inside the compliance rate.
4. Remove the rollback once the cause is fixed, and log the resolution time.

## 4. Monitoring cadence and ownership

- `npm --prefix backend run tutor:integrity-report` reads data only and makes no model call. It exits with code 1 on any defect: a compliance miss, a reveal rate over the ceiling or drifting up, any delivered false affirmation, or a reversal rate over the Stage 7 ceiling. A result of "insufficient data" is reported as such and never as healthy.
- Proposed cadence, pending the owner's operations schedule: weekly during the first release, then on the quarterly Threshold Recalibration Log review. Owners: the Pedagogical Lead for the rates, and the Safety/Trust Lead for the zero-tolerance sycophancy count.
- The consolidated dashboard is C.24 (checkpoint S06.13). Until it exists, this report is the monitoring surface.

## 5. Known limits, stated plainly

- The detectors are lexical and favor precision. They catch the known phrasings in three languages; paraphrased sycophancy is left to the calibrated-judge audit (C.21 and C.23).
- The key-based reveal check covers numeric answers, money trays and multiple choice. Other activity types are unscorable, and the report says so.
- No live conversation has exercised these paths, because OD-23 allows zero paid spend. Evidence so far is deterministic tests and the simulated-student gates (`verify:pedagogy`, `gym:pedagogy`).
- The two-observation value is "proposed, pending data-driven validation" (C.10). Its compliance metric must be recalibrated together with it.
