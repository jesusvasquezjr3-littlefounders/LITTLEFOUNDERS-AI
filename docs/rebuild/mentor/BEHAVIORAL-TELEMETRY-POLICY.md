# Mentor behavioral telemetry policy: signal strength and the check-in

Status: engineering policy for Product C.9 (the Behavioral Telemetry Layer) and C.19 (the disengagement check-in and repair-initiation move), written 25 September 2026 (S06 wave S06.4; the sprint record numbers the work S06.6 and S06.7). It implements the binding SPEC and adds no product decision of its own. Where the SPEC left a choice open, the conservative default is implemented and listed in §8 as a proposal. It becomes release policy only after the Pedagogical Reviewer and the Safety/Trust Lead sign off (Appendix F Part 2.1, "Reviewed"). Thresholds live in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md), not here. The dialect and ASR bias audit that every lexical reader in this layer passes is a separate policy: [bias-audit policy](BIAS-AUDIT-POLICY.md).

Sources: Product C.9 and C.19, the Block C Real-Time Interaction Standard (component 1 and the non-negotiable constraints), Appendix D §1.3–1.7 and §3.7, Appendix F §1.2, §1.3, Part 2.2 (the C.9 worked Definition of Done), Part 3 Stages 2 and 7, Frontend Bible 08 §2 and §4, Bible 06, and owner decisions OD-7, OD-23 and the §5 glossary.

## 1. Governance tier

| Item | Tier (C.22) | Why |
|---|---|---|
| The layer never outputs, stores or reports a declarative emotion label | 1 (never automate) | Block C non-negotiable; Appendix D §1.7 |
| A fired disengagement signal always produces the explicit, humble check-in before the plan continues | 1 | Block C non-negotiable (C.19) |
| The check-in asks whether the MENTOR is helping, never how the learner feels | 1 | Appendix D §1.7 (false positives must be cheap) |
| The layer only ever routes through a learner-controlled choice (the check-in, then an adaptation offer) | 1 | Appendix D §1.7 design implication |
| Channel thresholds, fusion rule, check-in limits, re-arm window | 2 (gated) | Pacing values within approved bounds, "proposed, pending calibration" |
| The check-in wording and the chip labels | 2 | Human-written, closed catalogue; any change is reviewed text |
| The Default-to-Inaction and Repair Initiation metrics, the report | 3 (measurement only) | Appendix F §1.2 |
| The Stage 7 kill-switch floor and its automatic rollback | 2 (the value) / 1 (that a rollback exists) | Appendix F Part 3 Stage 7 |

## 2. What the layer reads (no new data collection)

`oracle/src/tutor/behavioralTelemetry.ts` reads only what a tutoring session already produces: the learner's words (already fenced and cleaned for the model), when they answered, whether a server-verified answer was right, the controller's prediction for that item made BEFORE the answer was applied, and whether they asked for help. It computes, per learner turn, eight channels against that learner's OWN session-opening baseline (the first four observations), over a rolling window of the last six:

| Channel | Appendix D | Evidence counted in the window |
|---|---|---|
| `latencyShift` | §1.3 response latency | A reply slow for its channel (typed, spoken or activity; absolute z of ln(1 + seconds) at least 1.5 against that channel's baseline) that ended in a miss, a terse, a hedged or an off-topic reply. A slow reply that ends in a right or thoughtful answer is productive confusion and never counts |
| `rapidResponse` | §1.4 rapid guessing | A reply far faster than the learner's baseline that was wrong on an item the learner's history does not predict they know |
| `verbosityDrop` | §1.3 verbosity delta | The median message length against the learner's own first messages, or a rise in minimal replies ("k", "idk", "sale", "blz"). Never an absolute length |
| `repeatedAnswer` | §1.3 repeated identical answers | The same wrong answer again, in digits or number words in any locale ("20", "veinte", "beinte"), or the same message again |
| `hedging` | §1.3, §1.6 uncertainty | A RISE in uncertainty language over the learner's opening rate |
| `offTopic` | §1.3 off-topic drift | A rise in contentful messages that share no word with the lesson, its domain (with regional money words) or talk about the lesson |
| `hintAbuse` | §1.4–1.5 help abuse | Help asked again with no attempt in between, or asked at a rapid pace |
| `fastKnownMiss` | §1.4 carelessness | A fast miss on an item the learner knows. RECORDED, never fused: carelessness wants "check it again", which the controller already gives, not a check-in |

Reply latency runs from when the Mentor's latest turn finished playing (turns queue; about 2.5 words a second) to when the learner started answering: the message's arrival for typed text, the microphone press for a streamed spoken clip. An activity's latency is the server-measured time from serving to grading. A reply that starts while the Mentor is still talking reads as zero.

Each channel's strength is its evidence divided by its full-strength count, capped at 1. The output is numbers: strengths per channel, how many fused channels are elevated, and whether the signal fired. Nothing in the layer's code, state, report or wire record names a feeling. The adversarial suite asserts it over every simulated learner (§6).

## 3. When it fires (default to inaction)

The fused disengagement signal fires only when at least TWO independent fused channels reach full strength at once, after the baseline and a four-observation window exist. One noisy cue never fires it. At most two check-ins per session, and never again within five learner observations of the learner's answer (counted from the answer, not the firing, so an ignored check-in cannot be repeated at once). Most turns take no action at all: the Default-to-Inaction Rate is the share of evaluated turns without an action, high by design (Appendix D §1.7).

A teen who is terse and fast from the first minute is not "dropping": every channel compares the learner with themselves (Appendix D §1.6 developmental masking). A masking learner who complains about nothing and simply withdraws (shorter, slower, missing) is detected from behaviour alone.

## 4. What firing produces: the check-in (C.19)

The SYSTEM, not the model, owns the repair initiation, so it happens on 100% of firings:

1. The Mentor's reacting turn is told to react in one sentence and ask nothing (`CHECK_IN_LEAD_INSTRUCTION`); that turn carries no activity, no adaptation offer and no maneuver. The check-in supersedes the controller's maneuver and the C.8 stop offer for that turn (the offer is recorded as not offered and re-arms).
2. The system then adds the human-written check-in line (`scripted.ts` `CHECK_IN`, pre-generatable audio): "Let me check I'm really helping. Are we on the same page?" / "Quiero asegurarme de que sí te estoy ayudando. ¿Vamos bien?" / "Quero ter certeza de que estou ajudando. Estamos indo bem?". It fits the Mentor budget for ages 6–9 (at most 12 words, one question) and asks about the Mentor's help, never the learner's state.
3. The server sends `check_in` after that turn; the stage shows two EQUAL reply chips ("We're good" / "Not really"; Frontend Bible 08 §4: "a turn with chips, not a modal"). The learner answers with `check_in_response`, or in words (`classifyCheckInReply`: only an explicit "not really" repairs, only an explicit "yes" continues; anything else is answered as an ordinary turn, because the learner may simply have answered the lesson).
4. **Aligned:** the plan continues with the next small step; the Mentor does not ask again.
5. **Misaligned (the repair):** the plan does NOT continue as if nothing happened. The Mentor says, without blame and without describing feelings, that it will explain it another way, and offers ONE adaptation the learner can take or leave (routed through the existing adaptation-offer mechanism, never an adaptation the learner already declined this session). When none is left, it re-explains with a different concrete example.

A check-in a turn could not carry (a scripted fallback, a blocked draft) stays pending and is carried by the next learner turn, and the missed turn is counted, so an end of session with it still pending is reported as `undelivered`, a real miss. A safety stop or a closing sequence supersedes it: it is never asked on the way out or after a disclosure. A forged or replayed `check_in_response` is refused (`NO_CHECK_IN`) with no model call. The layer, the check-in state and the learner's baselines ride the park snapshot, so a cross-replica resume neither restarts the baseline nor forgets an open check-in.

## 5. Kill switch (Appendix F Part 3 Stage 7)

Two ways to roll the layer back to the pre-C.9 baseline (time/turn caps only):

- **Operator switch:** `TUTOR_BEHAVIORAL_TELEMETRY=act|shadow|off` in Oracle. `shadow` keeps measuring and recording but never checks in; `off` computes nothing. An unknown value means `act`, never a silent off.
- **Automatic rollback (Core):** on every new session's context, Core evaluates the Stage 7 condition over act-mode sessions closed in the trailing 14 days (and after the latest resolution): the Default-to-Inaction Rate below 85% with at least 300 evaluated turns, or ONE fired signal that a Mentor turn could have carried and did not (Disengagement-Repair Initiation Rate below 100%). When it holds, Core writes the trip to `audit_logs` (`mentor.kill_switch.behavioral_telemetry.triggered`, the cause and the numbers, no learner data) and sends `behavioralTelemetryMode: 'shadow'` in the context. Oracle applies the stricter of the operator switch and Core's verdict, so Core can only make the layer quieter. The trip HOLDS until an operator records the root cause (`npm --prefix backend run tutor:telemetry-report -- --resolve="…"`); a rollback is lifted by a root cause, never by the window going quiet. A failed read is not evidence: the verdict stays `act` and nothing is logged (§1.14). The verdict is cached per Core process for 10 minutes.

Core sends the mode (and C.16's `opening`) only to an Oracle that announces it can parse it (`x-oracle-context-fields`), because Oracle's context schema is strict. This makes the Core/Oracle deploy order irrelevant.

## 6. Instrumentation, metrics and tests (Appendix F)

- **Close record:** Oracle reports at close how the layer ran (`act` or `shadow`), the evaluated and acted turns, and every firing with its eight strengths, the fused-channel count, the check-in outcome and whether the repair carried an adaptation offer. Core's strict body refuses any other field, so an emotion label cannot be sent; it writes the counts on `tutor_sessions` and each firing in `tutor_telemetry_firing` (migration `*_mentor_behavioral_telemetry.sql`: RLS on, no client policy, no user id, no text, the session reference SET NULL at the 90-day purge).
- **Report:** `npm --prefix backend run tutor:telemetry-report` (read-only, no model call) prints the Default-to-Inaction Rate (floor 85%, by persona), the mean channel strength across firings (diagnostic), the Disengagement-Repair Initiation Rate (hard 100%; outcomes `superseded` and `session_ended` had no opportunity and are excluded), the check-in answers, repairs with an adaptation offer, and the Kill-Switch Trigger Log with resolution times. It exits 1 on a defect and prints "insufficient data" instead of calling a thin sample healthy.
- **Stage 2 simulated learners:** `src/tutor/telemetryGym.ts`, run by `npm run gym:pedagogy`, holds eight personas from Appendix D (disengaging, frustrated, productive struggle, gaming, careless, reactant teen, masking, steady) with the behaviour each must get, the suite-wide Default-to-Inaction floor, and the C.9 Definition of Done (b) adversarial check: no output of the layer carries an emotion label across the full suite. Every persona is proven able to turn red against a deliberately broken layer (deaf, hypersensitive, productive slowness read as disengagement, carelessness fused, no re-arm or cap).
- **Parity gate:** `npm run telemetry:check` (in `repo-gates.yml`) keeps the channels, the firing record, the outcomes, the modes, the context fields and the two socket frames identical across Oracle, Core, the migration and the client.

## 7. Client surfaces

`frontend/src/tutor/types.ts` and `useTutorSocket.ts` carry `check_in`, `check_in_response`, `checkInOpen` and `answerCheckIn()` (cleared on any new turn, on answering, on the closing summary and on a new session). `frontend/src/rebuild/mentor/CheckIn.tsx` is the two-chip surface: equal `option` controls, neither pre-selected, no focus stolen, no modal, tokens only, light and dark, 48 px targets, EN/es-MX/pt-BR within the youngest band's budget. It is previewed at `/rebuild.html?screen=mentor-check-in` and verified by `node scripts/verify-rebuild-check-in.mjs`. Composition inside the stage's response area is wave-2 work on the finished design system; on today's screen the learner answers the check-in in words.

## 8. Proposals recorded for owner and pedagogy review

1. **Age-band weighting.** Appendix D §1.6 notes the same detector logic may need different weighting per age band. The layer compares every learner with their own baseline, which already absorbs a teen's baseline terseness; per-band weights are not implemented and belong with C.17 (age-band calibration, S06.11).
2. **Chip labels.** "We're good" / "Not really" (es-MX "Sí, vamos bien" / "La verdad no"; pt-BR "Sim, tudo bem" / "Não muito"). Reviewed text is Tier 2; the pedagogy team may prefer other wording within the 5-word option budget.
3. **Automatic rollback thresholds.** The 14-day window, the 300-turn minimum and the 10-minute cache are engineering defaults, logged as proposed.
4. **Pre-generated audio.** The check-in adds 12 clips (1 line × 4 characters × 3 locales) to the closed catalogue; their one-time synthesis needs the owner's approval under OD-23, like the C.16 lines.
5. **Voice latency.** A single-frame (non-streamed) spoken clip has no known start, so its latency is not measured; its words still feed every lexical channel.
