# Mentor spaced review and dialogue calibration policy

Status: engineering policy for Product C.11 (the two-tier spaced review) and C.17 (age-band-differentiated dialogue calibration). Written 25 September 2026 in S06 (the orchestrator's wave label S06.6; the sprint record numbers the work S06.10 for C.11 and S06.11 for C.17). It implements the binding SPEC and adds no product decision of its own. Where the SPEC left a choice open, the conservative default is implemented and listed in §7 as a proposal. It becomes release policy only after the Pedagogical Reviewer and the Safety/Trust Lead sign off (Appendix F Part 2.1, "Reviewed"). Thresholds live in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md), not here.

Sources: Product C.11, C.17, C.13 (the hint ladder C.17 extends), C.15/C.16 (the telemetry C.17 is measured with) and B.23 (the age-band registers); Appendix D §2.4, §2.6, §3.3 and §3.6; Appendix F §1.1 ("Spaced-Review Routing Accuracy"), §1.2 ("Age-Band Calibration A/B Outcome"), Part 3 Stages 2 and 7, Part 4 phases 4–5; owner decisions OD-23 (zero paid spend; experiments adults-only until Product and Legal choose wider ages, H.7) and the §5 glossary.

## 1. Governance tier

| Item | Tier (C.22) | Why |
|---|---|---|
| A wrong answer is routed by the explicit rule, never by per-turn model judgement; a re-check never interrupts a rescue, a probe or a remediation, never celebrates and never moves the plan | 1 (never automate) | C.11 mandated requirement; the controller is the shield (Appendix D §2.6) |
| Massed in-session repetition never grows the cross-session interval | 1 | Appendix D §2.4 ("a session-scoped illusion of retention") |
| The C.17 experiment enrols adults, teens 13-17 with their own analytics opt-in and tweens 10-12 with a verified guardian's analytics consent (on an exact age); children 6-9 never; every other experiment stays adults-only | 1 | OD-26 (owner review M-12), OD-23 / H.7 |
| The band and the age never reach a language model; the register note never names an age | 1 | Oracle privacy contract (14-field schema) |
| The teen/adult register never delivers controlling language silently (caught, repaired once, counted) | 1 | C.17 ("a concrete, auditable style constraint") |
| Register wording, rung wording, overlays | 2 (gated) | Human-written, closed catalogue; any change is reviewed text |
| Routing thresholds, gap, caps, short horizon, hand-off interval, A/B floors and margins | 2 | Pacing values within approved bounds, "proposed, pending calibration" |
| Routing Accuracy, A/B Outcome, controlling-language count | 3 (measurement only) | Appendix F §1.1–1.2 |
| That both components have an automatic rollback / its values | 1 / 2 | Appendix F Part 3 Stage 7 |

## 2. C.11 — the two-tier spaced review

Appendix D §2.4 and the Duolingo precedent (Settles and Meeder, 2016): within-session sufficiency and cross-day scheduling are two distinct problems, solved by two distinct mechanisms, with an explicit rule for which one owns a wrong answer.

**The decision rule** (`oracle/src/tutor/spacedReview.ts` `routeWrongAnswer`, mirrored in Core `services/pedagogy/spacedReview.ts`; the first reason that applies wins):

| Order | Condition | Tier | Reason |
|---|---|---|---|
| 1 | The KC has no plan entry (a probe's prerequisite) | cross-session | `no_plan_entry` |
| 2 | The session is wrapping up or ended | cross-session | `wrapping` |
| 3 | Less than 4 minutes before the wrap-up | cross-session | `time_budget` |
| 4 | Fewer than 8 model turns before the turn cap | cross-session | `turn_budget` |
| 5 | The KC already had 3 spaced re-exposures this session | cross-session | `reexposure_cap` |
| 6 | The belief BEFORE the miss is below 0.5 (teaching, not review) | cross-session | `far_from_threshold` |
| 7 | Three other KCs are already waiting | cross-session | `queue_full` |
| 8 | Otherwise: close to the threshold with budget left | within-session | `near_threshold` |

The belief is read before the miss because the miss itself drags the posterior down (0.9 becomes 0.6 on the mirror's parameters); "close to the threshold" describes the learner the Mentor was teaching, not the one the update produced.

**Within-session tier** (Oracle). A short-horizon, PFA-style running count (Pavlik, Cen and Koedinger, 2009): the routed miss is the first failure; a graded answer on the KC counts only when it comes at least 3 learner turns after the previous counted event (answers inside the gap are massed practice: the controller still teaches from them, the count ignores them); the item retires when spaced successes minus failures reach +1 (two spaced successes after one miss); a spaced miss re-runs the rule with the current budget (so a KC that keeps missing falls below the threshold or hits the cap and is handed off). When an item is due and the plan has moved on, the orchestrator opens the controller's **review detour** (`controller.openInSessionReview`) on a turn nothing else owns (no check-in, renegotiation, stop offer, goal move, explanation move, help request, and never right after a miss, a celebration or a closed re-check). The detour serves the KC as a review (SPACED, `mode: review`, its own planned difficulty), answers exactly one graded item and closes: a correct re-check gets one short confirming sentence, a wrong one a single worked example and no drill; a failed re-check of a KC celebrated earlier this session revokes that mastery (C.10's demotion). A re-check the learner talks past for 3 turns is abandoned and handed off. The whole router rides the park snapshot.

**Cross-session tier** (Core). The existing FSRS-style memory card per (learner, KC) is the activation/half-life model: stability is the days the memory holds at ~90% recall (a half-life of about 6.6 × stability) and it widens as successful spaced reviews accumulate. Two C.11 changes: (1) the **short horizon** (`fsrs.ts` `reviewCardTwoTier`, 180 minutes): an attempt within the horizon of the card's last counted review is a within-session re-exposure — a success changes nothing, a second lapse does not collapse the card again, a lapse after a counted success is real forgetting and counts; `kc_attempt.review_tier` records which tier each attempt was; (2) the **hand-off**: at close, every KC the session did not retire (routed cross-session, still queued, or abandoned) is made due no later than 12 hours after the close, so the next session's plan brings it back as review debt. The card is only ever brought forward.

**Recording and audit.** Every decision is reported at close with the inputs the rule read (`tutor_review_routing`: no user id, no text). Core re-evaluates the pure rule over every recorded decision (Routing Accuracy); `tutor:spaced-review-report` prints the routing picture, every misroute, the systematic pattern check and, with `--sample=N`, a reproducible tier-stratified sample for the quarterly human spot check, which the auditor records with `--record-audit`. The quarterly workflow `mentor-review-routing-audit.yml` runs the report against production read-only and publishes the sample; the report is a defect when the router has more than a quarter of history and no audit was recorded within 99 days.

## 3. C.17 — age-band dialogue calibration

**The band** is derived in Core from its own age evidence, in the teaching tier's precedence: a self-registered account's declared band (13–17 → teen, adult → adult) wins; otherwise a birth date gives an exact age (parent-created accounts); otherwise the confirmed teaching tier (1–2 → young child, 3 → tween, never teen or adult on a guess). An older Core that sends no calibration makes Oracle fall back to the tier the same way. The birth date never leaves Core; the band never enters the sealed model context.

**The registers** (`oracle/src/tutor/dialogueCalibration.ts`):

| | Young child (6–9) | Tween (10–12) | Teen (13–17) | Adult (18+) | Control (A/B arm) |
|---|---|---|---|---|---|
| Hint ladder | 4 rungs: re-ask → targeted hint → fill in the blank → tell (indirect hint dropped) | 5 rungs | 5 rungs | 5 rungs | 5 rungs |
| Rung wording | direct, "let's do this one together" | original | offered as options, with a reason | as teen | original |
| Register note on every model turn | short concrete steps, model then do it together | recognition tied to the step; a choice of approach | autonomy-supportive: choices, reasons, acknowledge their view, ASK before changing pace; never "you need to / have to / must / should"; never childish | direct, respectful of time; no controlling phrasing | none |
| Pacing changes | as before | as before | ask first: a stuck skill gets an accept/decline offer instead of a unilateral change of approach; RESCUE/FADED/WORKED ask before making it easier | as teen | as before (unilateral change, then offer) |
| Controlling-language check | — | — | caught on every model turn, all four personas, three locales; repaired once; a survival is delivered and counted | as teen | follows the band: a teen or adult in the control arm is checked, repaired and counted exactly as above |

**The gate follows the band, not the variant (gap-fix round 6).** Before OD-26 only adults could be in the control arm; OD-26 opened it to teens, and a variant-keyed gate let "you have to…" reach a 13-17 learner uncaught, unrepaired and uncounted. `CONTROLLING_GATE_BANDS` (teen, adult) and `controllingGateFor(band)` now set the gate in both arms, including the operator's `off` switch. The control arm keeps what the experiment compares (the uniform ladder and wording, no register note, no ask-first pacing), and both arms now report comparable `controllingCaught` / `controllingDelivered` counts in `tutor_dialogue_calibration`. `npm run review-calibration:check` fails if a policy branch sets the gate any other way.

"You need to" in a question ("do you need to see it again?") or an impersonal teaching statement ("hay que sumar") is not flagged; the check reads declarative second-person sentences only (Reeve and Jang's controlling markers).

**The A/B experiment** (Appendix F §1.2). The H.7 runtime (dataintel, surface `tutor`, target `mentor.dialogue-register`; variant A = control, B = calibrated) assigns and records the exposure when a session starts with the treatment. Core consults it only for bands in `MENTOR_DIALOGUE_EXPERIMENT_BANDS` (default `adult,teen,tween` since OD-26; `young_child` is never accepted, and the resolver refuses it again through `DIALOGUE_EXPERIMENT_OPENABLE_BANDS`), a tween only on an exact age of 10 to 12 from a birth date, and only with the band's consent (an adult: the adult rule, or the guardian's for a parent-created adult; a teen: the teen's own analytics opt-in, plus the guardian's consent for a parent-created teen; a tween: a verified guardian's analytics consent); every other learner receives the calibrated register with the reason recorded (`not_eligible`, `no_consent`, `no_experiment`, `runtime_unavailable`). Staff create and stop the experiment in the H.7 console; this code never creates one. `tutor:dialogue-calibration-report` reports, per band, the bond proxy (C.15) and the completed-close share (C.16) of each arm with the calibrated − control difference and a 95% interval, and the verdict (improvement, non-regression within 0.05, inconclusive, regression, insufficient data under 30 per arm). Sessions outside the experiment (every minor) are reported separately beside the pre-C.17 baseline and labelled **uncontrolled**: observational evidence, never causal.

## 4. Kill switches (Appendix F Part 3 Stage 7) and operator switches

| Component | Automatic trigger (Core, evaluated on the context read, logged in `audit_logs`) | Rollback | Resolve |
|---|---|---|---|
| Spaced-review router | a recorded decision the rule does not reproduce (latest 200 act decisions), or more than 50% of the latest 100 act within-session routings never got their re-check | `spacedReviewMode: shadow` — decisions recorded, no re-check detours, no hand-offs | `tutor:spaced-review-report -- --resolve="root cause"` |
| Dialogue calibration | a band whose calibrated arm is significantly worse than control on the bond proxy or the completed-close share (90-day window) | every new session runs the control register (`assignment: rollback`) | `tutor:dialogue-calibration-report -- --resolve="root cause"` |

Operator switches in Oracle: `TUTOR_SPACED_REVIEW=act|shadow|off` (Core's verdict can only make it stricter) and `TUTOR_DIALOGUE_CALIBRATION=act|off` (`off` runs the control register for everyone, recorded as `operator_off`). Core: `TUTOR_REVIEW_SHORT_HORIZON_MIN` (0 restores the pre-C.11 scheduler) and `MENTOR_DIALOGUE_EXPERIMENT_BANDS`.

## 5. Instrumentation, metrics and tests (Appendix F)

- Spaced-Review Routing Accuracy: `tutor_review_routing`, `tutor:spaced-review-report`, the quarterly workflow, and the Stage 7 verdict.
- Age-Band Calibration A/B Outcome: `tutor_dialogue_calibration` joined with `tutor_session_alliance.bond_proxy` and `tutor_sessions.closing_script`; `tutor:dialogue-calibration-report`.
- Stage 2 simulated learners (`oracle/src/tutor/reviewCalibrationGym.ts`, in `npm run gym:pedagogy`): near-miss slipper, late-session struggler, far-below learner, forgetting reviewer, gaming rapid guesser (C.11); reactant teen, polite teen (the over-correction check), young hint seeker, adult control, teen control (the gate in the control arm) (C.17). Each persona is proven able to turn red.
- `npm run review-calibration:check` (in `repo-gates.yml`) keeps Oracle, Core and the migration identical, including the rule's thresholds Core re-evaluates, and holds the OD-23 guard on the experiment's default bands and the Tier 1 rule that the teen/adult controlling-language gate runs in both arms.

## 6. What reaches the model, stated plainly

Nothing new about the learner. The sealed context keeps its 14 fields (`tier` unchanged). The review lead and result instructions carry the KC's objective text from our own catalog. The register note and the rung wording are fixed, band-free style instructions. The router reads ids, a correctness bit, the controller's belief and the budget; it never reads the learner's words.

## 7. Proposals recorded for owner and pedagogy review

1. ~~**The C.17 A/B cannot measure the bands it is about.**~~ Answered by OD-26 (owner review M-12, 27 September 2026): the C.17 experiment may enrol teens 13-17 with their own analytics opt-in and tweens 10-12 with a verified guardian's analytics consent; children 6-9 stay excluded and are measured observationally only; every other experiment keeps OD-23's adults-only rule. `npm run review-calibration:check` refuses a default or schema that would enrol a young child and a resolver that would admit a tween on a guess or without the guardian. A parent-created teen has no analytics opt-in of their own today, so stays out until one exists. Note for the owner: H-20 keeps a child whose under-13 age came from the Tutor out of every OTHER optional analytics; OD-26 is read as the specific rule for C.17, so such a tween with the guardian's analytics consent may be enrolled.
2. **A controlling phrase that survives the retry is delivered and counted**, not replaced by a scripted line: it is a style fault, and a scripted apology in place of a teaching turn damages the alliance more. The report treats any delivery as a defect.
3. **Adults get the autonomy-supportive register and the controlling-language check too.** The SPEC names teens; B.23's adult register ("direct, respectful of time") is read as including it.
4. **The register note is a system instruction, not a context field** (like the C.15 continuity note), so the band never reaches the model.
5. **"Ask before adjusting pacing"** is implemented where the system itself changes pace: the stuck move, and RESCUE/FADED/WORKED. The hint ladder still escalates on the learner's own request (the request is the ask).
6. **A tier-3 learner without finer age evidence is a tween**, never a teen or adult.
7. **Every threshold** (§2, §3 and the log) is proposed, pending calibration; the short horizon (180 minutes) and the hand-off interval (12 hours) especially need production data.

## 8. Limitations and open items

- The migration has not been applied to a physical PostgreSQL; `database/types/database.ts` is not regenerated (Core writes through narrow local types).
- No live or canary conversation has exercised either component (OD-23); Appendix F's "Measured" criterion (routing logs from real sessions, the A/B outcome) needs production data, and the A/B needs a running H.7 experiment that staff create.
- The quarterly human spot check has never been run (no production routing yet).
- The controlling-language lexicon needs native-speaker review in es-MX and pt-BR (it reads Mentor output, not learner input, so it is outside the C.20 bias audit's registry).
- Tier 1 sign-off (Pedagogical Reviewer and Safety/Trust Lead) is pending for every Tier 1 item in §1.
