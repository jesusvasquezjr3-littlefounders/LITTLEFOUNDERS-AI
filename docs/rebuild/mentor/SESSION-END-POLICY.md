# Mentor session-end policy: closing scripts and the behavioral-signature signal

Status: engineering policy for Product C.16 and C.8/C.12, written 24 September 2026 (S06 checkpoints S06.4 and S06.5; the orchestrator's label for this wave is S06.3). It implements the binding SPEC and adds no product decision of its own; where the SPEC left a choice open, the conservative default is implemented and listed in §7 as a proposal. It becomes release policy only after the Pedagogical Reviewer and the Safety/Trust Lead sign off (Appendix F Part 2.1, "Reviewed"). Thresholds live in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md), not here.

Sources: Product C.8, C.12 and C.16, the Block C Real-Time Interaction Standard (Extended Mastery Engine, Alliance Controller, non-negotiable constraints), Appendix D §2.5 and §3.5, Appendix F §1.1, §1.2, Part 2, Part 3 Stages 2 and 7, Frontend Bible 08 §3–4, Bible 06 §3, and owner decisions OD-7 (milestone list), OD-23 (zero spend) and the §5 glossary.

## 1. Governance tier

| Item | Tier (C.22) | Why |
|---|---|---|
| "No closing sequence uses the standard positive template for a safety-stop or unresolved-interruption end-reason" | 1 (never automate) | A Block C non-negotiable constraint |
| "The Mentor never issues a declarative claim about the learner's emotional state" (enforced on every turn, including the stop offer) | 1 | A Block C non-negotiable constraint |
| The hard cap (25 minutes / 120 turns) stays the ceiling; the signal never replaces it | 1 | C.8 mandate |
| The reason → script table | 1 | Session-Closing Script Accuracy is a 100% target measured against it |
| Signal thresholds, offer limits, re-engagement window | 2 (gated) | Pacing values within approved bounds, "proposed, pending calibration" |
| The closing-script wording | 2 | Human-written, closed catalogue; any change is reviewed text |
| The two metrics and their report | 3 (measurement only) | Appendix F §1.1–1.2 |

## 2. The four closing scripts (C.16)

The script is chosen by the SYSTEM from how the session actually ended, never by the model. The table lives in `oracle/src/tutor/sessionClosing.ts` (`CLOSING_SCRIPT_FOR_REASON`) and is mirrored in Core (`services/pedagogy/sessionEnd.ts`); `npm run session-end:check` keeps every copy identical.

| Close reason | Script | What the learner gets |
|---|---|---|
| `completed`, `soft_budget` | completed | The co-constructed recap QUESTION ("what is one thing that clicked for you today?"; also when the learner presses "end", rule 7), the Mentor's one-sentence reflection of the answer (a model turn with every honesty check; a wrong idea is corrected, not praised), then a scripted line naming a SPECIFIC act the server observed, with forward framing |
| `hard_budget`, `error`, `consent_revoked` | interrupted | On a budget end, the interruption said plainly and the re-entry point named ("Time is up for today. Next time, we pick up right here."); the promise is kept by the next session's opening and the offers screen's continue chip. An `error` close has no spoken line (the connection failed), and the closing state says the session is paused and names the lesson it resumes. (A consent revocation switches the microphone off and does not end the session.) |
| `learner_left`, `abandoned` | learner_left | Nothing can be said to someone who is gone, so a short, no-blame re-engagement message is QUEUED for their return (§4) |
| `safety_stop` | safety_stop | The category's safety line, then a calm, non-cheerful close: neutral posture, no praise, no summary counts, no topic, no celebration. It never reuses the positive template |

The observed acts a completed close may name, most specific first (`EffortAct`): `corroborated` (C.10 mastery declared on corroborated evidence: "the same idea right twice in a row"), `recovered` (a correct answer on a skill right after a miss on it), `hint_then_solved` (a correct answer after ladder help), `kept_going` (graded work), `talked_through` (an open conversation), `none` (the learner never said or answered anything: the line thanks them and claims nothing).

Rules that hold for every script:

1. **The model never closes the session.** A model turn that sets `next: "close"` in a running session is followed by the recap question and the session stays open for one answer. A budget end is followed by the interrupted line. The model's own turn never carries the close (`TurnOutcome.after`).
2. **Safety wins over every closing script.** The learner's text is classified BEFORE the budget close and before the recap answer, so a disclosure in the last second of a session gets the safety response, never "time is up".
3. **No celebration** outside the OD-7 milestone list: closing lines use no `celebrate` action and no `excited` emotion.
4. **No new material on the way out** (Appendix D §3.5): a closing turn never requests an activity or an adaptation; the grace turn resolves the open question without saying goodbye, and the system adds the closing line.
5. **Copy budget.** Every scripted closing and opening line fits the Mentor budget for ages 6–9 (12 English words, ×1.25 for es-MX and pt-BR, 2 sentences, one question), so one line serves every band. `sessionClosing.test.ts` measures them.
6. **Closed catalogue.** All 13 new lines are enumerated by `scriptedLineCatalogue()` (25 texts × 4 characters × 3 locales = 300 clips) so they can be pre-generated once.
7. **Pressing "end" asks the recap question first** (OD-28, owner review M-04). The learner's `end_session` gets the same scripted recap question a Mentor wrap-up gets, and the session stays open for one answer; the answer gets the reflection and the completed close, and the session closes `completed`. The learner is never held for more than that one question (`TutorOrchestrator.learnerEnd`, `ws/server.ts` `attemptEndSession`):
   - a second "end" while the recap waits (whoever asked it) gives the completed close at once, with no second question;
   - a recap asked on "end" that gets no answer closes as `completed` once `RECAP_ANSWER_WAIT_MS` (2 minutes, checked on the existing 30-second heartbeat, so 2 to 2.5 minutes) has passed with no learner frame;
   - a socket that goes while that recap waits (including a client that tears its socket down right behind `end_session`) closes as `completed` at once, never parked as a silent dropout: the learner asked to leave. A recap the Mentor asked (a wrap-up, an accepted offer) is not changed: a drop there still parks and stays resumable;
   - a stopped (safety) session gets the safety close at once, never the recap; an ended budget gets the completed close at once, so no model call is bought past the cap. A budget that ends while the recap waits still closes as completed on the answer (the answer is checked before the budget, as for every recap);
   - "end" while a stop-or-continue offer is open records the offer as accepted (once), exactly as accepting it would, then asks the recap. Nothing else is recorded on the press: no learner turn, so the effort act only moves if the learner answers the recap.

   The marker that the recap was asked on "end" (`SessionClosingSnapshot.learnerEnded`) rides the park snapshot, and a record written before it existed parses as `false`. Wire contract for the client: after `end_session` the client receives a `turn` carrying the recap question (`next: "ask"`, with its `turn_audio`) and a `state` frame; the socket stays open. After the learner's answer (`learner_text` or `learner_audio`, subject to the ordinary 700 ms turn floor) it receives the usual `thinking` acknowledgement, the reflection `turn`, the completed-close `turn`, `state`, `session_closing` (`script: "completed"`, the effort act, the topic) and `closed` (`reason: "completed"`), then a normal close. A second `end_session` instead yields the completed-close `turn`, `session_closing` and `closed`.

## 3. The behavioral-signature session-end signal (C.8/C.12)

`oracle/src/tutor/sessionEndSignal.ts`, part of the Extended Mastery Engine.

**Inputs.** One graded observation per graded turn (an activity grade, a spoken-answer verdict, a verified conversational answer): correctness, the server-measured answer latency (activities only; speech and typing times are not answer times and are recorded as unknown), and the probability of a correct answer the learner's OWN history predicted, read before this answer's evidence is applied (the controller's mastery mirror when it steers, else the session's skill estimate).

**The signature (Appendix D §2.5).** After a session-opening baseline of the first graded observations, the signal is evaluated over a rolling window of recent graded turns. It fires only when BOTH:

- the spread of the learner's answer times (standard deviation of ln(latency), so fast and slow learners are judged on the same scale) has risen over their own baseline; and
- the "surprising miss" rate (misses on items their history says they should get right) has risen over their own baseline. A miss on a hard item is not surprising and never counts.

**What it never uses.** Elapsed time and turn count are not inputs to the decision (`observe()` takes the clock only to stamp a firing for the Trigger Rate), so it can fire long before the hard cap and a long session in flow never triggers it.

**What it outputs.** Signal strength (the two measured deltas), never an emotional state. The Mentor's instruction for the offer forbids describing how the learner feels or seems, and every delivered model turn is CHECKED (`affectClaims.ts`): a draft that declares the learner tired, bored, frustrated or similar is repaired once and never delivered (§5).

**What it drives.** An adaptation offer with two equal choices, "stop here for today" or "one more" (Frontend Bible 08 §4). Never an automatic close, never a default-accepted path:

- the offer supersedes that turn's maneuver (it stands alone: no activity, no second question);
- accepting (the stage's choice, or an explicit stop in words) starts the completed close; declining continues the lesson; an ambiguous reply ("yes", "ok") is neither and continues the lesson;
- a forged or replayed answer is refused unless an offer is actually open (`NO_SESSION_END_OFFER`);
- at most two offers per session, re-armed only after four more graded turns counted from the learner's answer;
- an offer the turn could not carry (a scripted fallback, a moderation block, an interrupt) is recorded as `not_offered` and the signal re-arms at once, so a firing is never silently lost.

**Honest limits (Appendix D §2.5).** No study validates this exact design for children; it is a synthesis of adjacent science (vigilance decrement, time-on-task weakness) and must be described that way internally and externally. A session with no activity grades (voice-only or conversation-only) has no latency samples, so the signal cannot fire there and session management falls back to the time and turn caps. The Behavioral Telemetry Layer (C.9, a later checkpoint) owns richer latency signals.

## 4. The queued re-engagement (C.16 learner_left and interrupted)

Core decides the opening of every new session from its OWN row of the learner's previous closed session (`decideOpening`, `GET /tutor/internal/sessions/:id` → `opening`), never from the client or transcript text:

| Previous close | Opening |
|---|---|
| `hard_budget` | `reengage_interrupted_resume` / `_fresh` ("Welcome back! Time ran out last time…") |
| `learner_left`, `abandoned`, `error` | `reengage_left_resume` / `_fresh` ("…last time we stopped partway…" / "…stopping last time was fine…") |
| anything else, or nothing known, or a failed read | `greeting` (the character's own hello) |

`_resume` when the new session opens the same skill, topic or course; `_fresh` otherwise. A safety stop or a consent revocation never queues a cheerful "welcome back". The message is queued only for a return within the re-engagement window (§ threshold log). The opening is a scripted line (pre-generated audio, no model call) and is recorded at close.

## 5. The affect-claim check (Block C non-negotiable)

`oracle/src/tutor/affectClaims.ts` runs on every model turn, not only on the offer. It matches second-person DECLARATIONS of an emotional or fatigue state in EN, es-MX and pt-BR ("you seem tired", "te ves cansado", "você parece cansado", "I can tell you're bored"). It deliberately does not match questions (a humble check-in, C.19, asks exactly that), conditionals ("if you're confused, that's okay"), third parties or the Mentor talking about itself. A caught draft is repaired once; a claim that survives the repair is replaced by a scripted line.

## 6. Instrumentation and metrics (Appendix F)

| Metric | Target | Data | Report |
|---|---|---|---|
| Session-Closing Script Accuracy | 100% (one wrong script is a defect) | `tutor_sessions.closing_script` vs `close_reason` | `npm --prefix backend run tutor:session-end-report` (exit 1 on a defect) |
| Early-Warning Signal Trigger Rate | Diagnostic (baseline first, then trend toward high precision) | `tutor_sessions.end_signal_evaluated` + `tutor_session_end_signal` (fired before the hard cap = `remaining_ms > 0`; precision = confirmed / labelled) | same report |
| Kill-Switch Trigger Log | Every trigger reviewed | `TUTOR_SESSION_END_SIGNAL` changes | [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md) |

A firing is labelled **confirmed** when the learner accepted the stop, or when at least two surprising misses followed in the next four graded turns; **not confirmed** when those turns recovered; undetermined when the session ended first. Offer outcomes (accepted, declined, unanswered, not offered) and shadow firings are reported beside it, split by persona.

**Privacy.** `tutor_session_end_signal` holds the persona, the session reference (SET NULL at the 90-day purge) and numbers: no user id, no text, no emotion label. RLS is on with no client policy; only the service role reads it. Core refuses a firing that carries any extra field (a strict body), so a label cannot be smuggled in.

**Kill switch (Appendix F Part 3 Stage 7).** `TUTOR_SESSION_END_SIGNAL=shadow` keeps computing and logging but never offers; `off` stops computing. Either reverts session management to the time/turn caps. An unknown value falls back to `offer`, never to a silent off. Record every use in the Kill-Switch Trigger Log.

**Simulated students (Stage 2).** `npm run gym:pedagogy` (in `oracle/`) runs the signal against seven personas: disengaging (must be offered a stop well before the cap), frustrated on hard items, slipping on known items at a steady pace, gaming by rapid uniform guessing, masking (slow, careful, correct), steady (in flow for 25 minutes) (none may be offered a stop), and a reactant teen who declines every offer (never more than two offers, never inside the re-arm window). Each persona is proven able to fail against a deliberately broken signal (`sessionEndGym.test.ts`).

## 7. Proposals recorded for owner and pedagogy review

1. **Leaving by choice and the recap question: resolved by the owner.** The proposal was that pressing "end" gives the completed close at once, without the recap question. The owner chose the alternative (OD-28, owner review M-04, `docs/rebuild/OWNER-REVIEW-ANSWERS.md`): the Mentor asks the recap question first, then gives the completed close. Implemented as §2 rule 7.
2. **Re-engagement window: 30 days.** Past it, "last time we stopped partway" names a moment the learner no longer remembers, and the character's greeting is the kinder opening. An `error` close queues the "left" wording; a `consent_revoked`, `safety_stop` or ordinary completion queues nothing.
3. **Signal thresholds** (baseline 4, window 8, minimum window 6, surprise probability 0.75, surprising-miss rate rise 0.25 with at least 2 surprising misses, latency-spread rise 0.3 ln units with at least 3 samples, at most 2 offers, re-arm after 4, confirmation window 4) are proposed starting points, pending calibration.
4. **Voice-only sessions cannot fire the signal** until the Behavioral Telemetry Layer (C.9) supplies a validated spoken-answer latency.
5. **The closing state and the two choices on the live stage** are built as rebuilt surfaces (`frontend/src/rebuild/mentor/SessionEnd.tsx`) and wired into the client socket layer; their composition on the stage belongs to the wave-2 design system. In the current screen the learner answers the offer in words, and the spoken closing line carries the script.
6. **Pre-generated audio.** The 13 new scripted lines need a one-time synthesis (`npm run speech:pregenerate` in `oracle/`, about 18,000 characters across 300 clips, 156 of them new). Under OD-23 this lane spends nothing; until the owner runs it, the first delivery of each line per character and locale is synthesized live once and then cached.
