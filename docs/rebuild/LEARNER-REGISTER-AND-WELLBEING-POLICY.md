# Learner register and wellbeing policy

Status: implemented and locally verified in S05.3f (24–25 September 2026). Product and pedagogical review, owner review of the proposals in §7 and the first human release audit are pending. This policy does not accept any requirement; acceptance needs human review.

Scope: Product `10` B.23 (age-band registers), B.26 (shame signals and task-scoped feedback, with OD-1), B.27 (a family's real financial circumstances) and B.28 (resolution efficiency over engagement volume). B.25 (the dark-pattern audit) has its own procedure in [DARK-PATTERN-AUDIT.md](DARK-PATTERN-AUDIT.md), which audits this policy too. Record: [S05.3f](sprints/S05-LEARNING-EXPERIENCE.md#s053f-registers-no-shame-and-resolution-efficiency-b23-b25-b26-b27-b28).

Binding sources: Product `10` B.23 (with the OD-4 amendment), B.25–B.28, the Block B "Age-band registers" table and six checks; Appendix B §1.8, §2.6–§2.9 and §3.6; Appendix C Part 1.2, Part 1.3 and Part 3 (Stage 2 gate 4, Stage 3); owner log OD-1, OD-4, OD-5, OD-7, OD-23 and the glossary (§5); Frontend Bible 02 D7–D9, §4.2 and §9.2–§9.3, Bible 06 and Bible 08 §9 and §11.

## 1. One policy, read everywhere

The rules live in one file Core owns: `backend/src/services/learnerRegisterPolicy.ts`. It holds the four registers, the graduation moments, the guided-review threshold and the wellbeing lexicons (English, Spanish and Portuguese). No shared package exists between the services by design, so the file is copied byte for byte:

| Reader | Copy | What it reads |
|---|---|---|
| Core | the canonical file | the register a learner reads in, the graduation owed, the guided-review threshold |
| The rebuilt UI | `frontend/src/rebuild/design/learnerRegisterPolicy.generated.ts` | the Mentor stage's size and reactions, the result screen's reward framing, the offer's voice, the graduation card |
| Forge | `coursegen/src/pipeline/learnerRegisterPolicy.generated.ts` | gates 18 and 19 |
| The repository gate | imports the canonical file directly (Node type stripping) | the copy scan in `check-dark-patterns.mjs` |

`node agent/tools/sync-learner-register-policy.mjs` regenerates the copies; `npm run spec:check` fails when one drifts. A frontend test also checks that the UI copy ends with the canonical bytes.

## 2. B.23 — age registers

**The OD-4 reading.** One design system for every user. A register never changes tokens, components or shapes. It changes copy tone, the Mentor character's presence and voice, reward framing and the social mechanics allowed.

| | Young (0–9) | Transition (10–12) | Teen (13–17) | Adult (18+) |
|---|---|---|---|---|
| Copy Budget band | 6–9 | 10–12 | 13–17 | adult |
| Praise names | the process | the skill | the capability | the use |
| Praise with nothing named ("Great job!") | allowed | not allowed | not allowed | not allowed |
| Exclamations per string | 1 | 1 | 0 | 0 |
| Extra forbidden lexicon | none | none | childish framing | childish framing |
| Mentor presence | high, 110 px lesson band, chips first, lively | reduced, 96 px, chips and field equal, moderate | minimal, 80 px, field first, calm | minimal, 80 px, field first, calm |
| Mentor on a miss | encouraging: nods, or points to the hint | encouraging: nods, or points to the hint | encouraging, still | encouraging, still |
| Mentor on a met answer | happy | happy | nods | nods |
| Reward framing | concrete: "You worked out: {skill}." | mastery: "You showed: {skill}." | identity: "Skill built: {skill}." | utility: "Skill: {skill}." |
| Result screen | medal, XP tally first | medal, XP tally first | no medal, accuracy first, XP as data | no medal, accuracy first, XP as data |
| Comparison | own history only | own history only | own history only | own history only |
| Leaderboards, peer-visible progress | none | none | none | none |
| Autonomy lever it leads with (B.24) | topic | approach (proposed; see below) | path and pace | full |

The Mentor presence values follow Bible 08 §9 and §11 (30, 25 and 15 percent of the phone height, as fixed band heights).

**Autonomy by register (what exists today).** Every register has the three levers of the reward and motivation policy §4: path (the B.6 frontier), Mentor and pace. The table's "approach" for 10–12 (Block B: "choice of approach or strategy, not just topic order") is the target, not yet a mechanism: a choice between two equally valid strategies needs lessons authored with both, which is Forge work (zero-spend authoring after pedagogical review, OD-23). Until then the transition register leads with path choice, and no design review may count "approach" as delivered.

**Social mechanics.** No register has a leaderboard, a rank or peer-visible progress. Appendix B §2.2 and §2.9 treat peer-visible performance as a risk for 13–17, and Hanus and Fox found visible leaderboards lowered motivation in a classroom; the conservative reading applies to every band. Comparison is only ever with the learner's own history (the B.5 "your best" row). Profile follower counts belong to Block E (S08) and are outside this lane.

**Which register applies.** Core decides, never the client and never the role (`services/learnerRegister.ts`):

1. A valid birth date on the profile gives the exact age.
2. Without one, an adult or 13–17 age-screen declaration (not on a protected under-13 origin) gives adult or teen.
3. An under-13 learner with no birth date reads the Mentor's first-write age calibration: tier 3 is 10–12, tiers 1 and 2 are 9 or younger.
4. Nothing known reads as the youngest register, the most protective one.

A register is not a safeguard. Every minor safeguard keeps following age through its own module.

**The graduation moment.** Appendix B §2.9 puts the change around ages 10–12, when children start discounting simple praise. Core records each register a learner is seen in (`learner_register_history`, first sighting only). A graduation (young to transition at 10, transition or young to teen at 13) is owed only to a learner who was seen in a younger register, and it is shown once, on the learning home, in the new register's words: what changes (the Mentor steps back, feedback names the exact skill, the choices get bigger) and one "Got it" action. It is information, not a celebration: it is not on OD-7's closed list, so it has no motion, medal or reward.

**Enforcement points.**

- Core: `GET /learn/register`, `POST /learn/register/graduation` (only the graduation into the register the learner is in now).
- UI: the compact Mentor stage, the rebuilt result screen, the guided-review offer and the graduation card read the policy. Every register-aware surface declares `data-age-band` so the Copy Budget audit measures it in the right band.
- The live lesson player (S05.3g): the lesson route reads Core's register once per lesson and hands it to the player. The cast's reactions follow `mentor.animation`: lively for 0–12, calm for teens and adults (a met answer is a nod, a miss is the character holding still). The completed lesson's fanfare and celebrate action play only in a register whose result shows the medal. Until Core answers, or if it fails, the youngest register applies. Pinned by `director.test.ts`, `celebrationResults.test.tsx` and `LessonRoute.test.tsx`.
- Forge gate 19: a lesson's tier ages map to the registers they span (a tier such as "8-10" spans two) and the strictest rule applies. Childish framing in a lesson a teen or an adult will read blocks; praise with nothing named in a feedback field blocks from age 10; exclamations beyond the strictest register go to the Stage 3 reviewer.
- Stage 3 and the audit: the reviewer judges whether a register is genuinely appropriate, not only compliant (Block B check 5), and the quarterly Age-Band Register Differentiation Audit is checklist item MN-03.

## 3. B.26 — no shame, and no loss mechanics (OD-1)

**The rules.**

1. Feedback names the step or the strategy, never the learner. No self-global language ("you're not a saver", "no eres bueno para el dinero"), in any state, and no praise of fixed traits ("you're so smart", "you have a detective's eye").
2. A miss is never red (red means a system error, Bible 02 §4.2), never a sad or disappointed character, never an error sound, and never moves a rank or anything a peer can see.
3. No loss mechanics: no lives, hearts, energy or other depleting resource, no counter of them (not even an unlimited one), no lockout from practice. A wrong answer costs nothing.
4. After three consecutive misses on the same skill, the learner's own Mentor offers a guided review of that skill. It is an offer: declining is neutral and changes nothing.

**The guided review.** Core decides from its own records, so a client can neither trigger nor suppress it (`services/guidedReview.ts`):

- *Same skill.* For a course lesson, the attempt log's skill key (course and topic) across every lesson that teaches it. For a v2 lesson, the graded receipts of that lesson version (v2 receipts carry no skill key; a v2 lesson teaches one topic). A miss is an attempt below the lesson's pass threshold, or a receipt that is not met.
- *When.* On the 3rd consecutive miss, and again on the 6th, 9th and 12th, never on every miss. A met answer resets the run.
- *Who offers.* The grade response carries `guided_review { skill_key, skill, misses, character }`: the learner's chosen Mentor (Bible 02: the chosen character fills every Mentor slot, including the guided review).
- *The offer.* A sheet anchored to the viewport that leaves the lesson usable, never a dialog or a lock. "Practice with Dina" or "Keep going" (Escape also declines). The line names the skill and is worded in the learner's register: warm for the young register, brief and direct from 10.
- *Accepting* opens the Mentor with `?review=<skill key>`, and the Mentor starts its existing weak-skill session for that skill once, as if the learner had picked that chip.

**The error and failure state audit.** Every learner-facing error or failure state in the rebuilt surfaces and the live product was checked against the four rules on 24–25 September 2026:

| State | Where | Words | Colour | Character | Sound | Result |
|---|---|---|---|---|---|---|
| Wrong answer, retry allowed | live player | "Let's think it through!", "Mistakes help us learn!", "New clue unlocked, try again!" | warning and a cross (the P3 test) | director's retry, gentle or hint pose; never a celebration (director test) | was the "edu_error" buzzer | **Fixed**: the miss plays the neutral tap |
| Wrong answer, no retries left | live player | the correction names the right answer | warning | as above | as above | Pass |
| Lives counter | live player | "{{count}} hearts left" | red heart | none | none | **Fixed**: removed from the session, the header, the lesson lab and all three locales; a migrated document's `scoring.hearts` is ignored; an old checkpoint's value is dropped |
| Lesson ended by lives | live player | "Good effort!" | none | none | none | **Fixed**: no lesson can end early any more |
| Lesson below the pass mark | live player result | "Good effort!", "Every founder practices. Play it again…" | none | none | none | Pass (effort and process) |
| Result "superpower" lines | live player result | "You have a detective's eye", "You handle money like a pro" | none | none | none | **Fixed**: rewritten to what the learner did ("You spotted the clues in the data") in three locales |
| Grader unavailable | live player | neutral banner, the answer is kept | warning | none | none | Pass |
| v2 answer "review" | rebuilt boards | names the action to try ("Try saving a little more.") | neutral surface | compact stage encouraging | none | Pass |
| Replay below the best | rebuilt and live result | "Your saved best is still X%. This was practice." (B.5) | none | none | none | Pass |
| Placement outcome | rebuilt and live | growth framing (B.15) | none | none | none | Pass |
| Streak broken | rhythm, Mentor | "Streak resting", "Your best stays." (B.21) | reward-soft | none | none | Pass |
| Lesson unavailable, offline, age-restricted | rebuilt transport and eligibility views | task-scoped, never about the learner | neutral | none | none | Pass |
| Form validation | rebuilt identity and family forms | names the field | error hue (a system error, allowed) | none | none | Pass |
| Mentor's own words after a miss | Oracle (live model) | model output | n/a | encouraging emotions only (no sad state exists in the vocabulary) | none | Scripted lines scanned and clean; live model output is S06's measurement (open) |

**Enforcement points.** Forge gate 18 (below); the repository gate's SH-01 to SH-03 and DP-07 items (copy in three locales, CSS rules for a miss, sad character states, the live player's session, header, lab and sound map); the policy's `missReaction` (always encouraging) read by the compact stage; Core's offer; and the tests listed in the sprint record.

## 4. B.27 — a family's real money is never a moral failing

**The rule.** No scenario, comparison, prompt, feedback or Family Hub copy may imply that a family's actual income, spending choices, debt or financial stress is a personal or moral failing. This extends Law 3 from in-app performance to real life (Appendix B §2.7: children absorb money scripts from their family's emotional tone, across the income spectrum).

**Content review guidance** (for authors and the Stage 3 reviewer):

| Do | Do not |
|---|---|
| Describe choices and their trade-offs: "Some families save in coins, some in a bank. Both can plan." | Judge a group: "Poor families are lazy", "Rich people are better" |
| Model calm, specific language about money in the parent's view | Blame a parent: "Your parents waste money", "Tus papás malgastan" |
| Teach debt, low income or a hard month as situations people plan around | Call a situation a fault or a shame: "Being poor is a choice", "vergüenza de tu familia" |
| Let the learner's own decision be revisited without a verdict | Tie a learner's worth to their family's money |
| State facts about circumstances neutrally ("Low-income families face more surprise costs") | Use a fact as a verdict |

**Enforcement.** The `family-finance-moralizing` lexicon (English, Spanish, Portuguese) blocks in Forge gate 18 (every learner-visible string, stories included) and in the repository gate (all i18n copy, the rebuilt UI, Core's family-bridge and guardian-narrative catalogs, the Mentor's scripted lines). The lexicon targets verdicts, not topics: a lesson may teach about debt or low income. The Stage 3 reviewer and the audit item FF-01 cover what a pattern cannot (tone, imagery, implication). Appendix C's "Real-World Financial-Framing Audit Pass Rate" is the count of flagged instances per cycle, target zero: the gate's count is the automated part of it.

**Limits.** Family Hub task and savings-goal copy is S07's surface; it is inside the repository scan (i18n) but its product review is S07's. Content already in the catalog was not regenerated (OD-23); gate 18 applies when Forge next writes or releases it.

## 5. B.28 — resolution efficiency, not engagement volume

**The rule.** No product decision, metric, experiment or Mentor behaviour may treat more time, more sessions, more events or more Mentor turns as success. The Mentor resolves a question or finishes a requested demonstration in as few turns as genuinely needed; a session is healthier when more of it is practice. A rising turn count or a falling efficiency ratio is a regression to investigate, never a neutral "engagement" signal (Appendix B §2.6: flow-as-learning, not flow-as-stickiness).

**The two metrics** (Appendix C Part 1.2), service-role functions in `*_engagement_health.sql`, shown to content staff in the Learning Quality panel's report as weekly series with a trend status:

| Metric | Definition | Good direction |
|---|---|---|
| Session Efficiency Ratio | graded-attempt seconds Core recorded ÷ visible session seconds (the 60-second heartbeats sent only while the tab is visible), per learner-day, capped at the day's session time, staff excluded. Consent-gated at ingest: no heartbeat exists for a learner without analytics consent | higher |
| AI Mentor Resolution Efficiency | median and 75th-percentile turn count of Mentor sessions that ended because the Mentor closed them as done (`completed`), overall and per intent | lower |

**The trend rule.** The median of the last four weeks against the four before, ignoring weeks with fewer than 20 learners or resolved sessions; a change of more than 10 percent in the bad direction is `regression`, in the good direction `improving`, otherwise `steady`, and fewer than eight usable weeks is `insufficient_data`.

**Guardrails.**

- *A registry.* `backend/src/services/engagementHealth.ts` gives every Appendix C 1.2 metric its direction and lists the engagement-volume signals (time on app, session length, sessions, events, Mentor turns, messages sent, screen time) that may be reported but never be an optimization target. A test pins both.
- *Experiments.* The analytics service refuses an experiment whose success metric is `events` or `sessions` (`ENGAGEMENT_VOLUME_METRIC`, 400), and an existing one never names a winner: it reports which arm is higher for diagnosis only. A return signal (`dau`, `users`) stays allowed.
- *Session design.* No autoplay or timed advance into another screen or lesson (repository gate DP-03); the learner's own pace goal (B.24) ends the day with a plain "Today's plan is done", never a push for more; the Mentor already runs under session budgets and a turn cap (Oracle), which this rule forbids raising to lengthen sessions.
- *Stage 3.* Block B check 6: no pacing choice is justified by engagement time alone.

**Limits.** The Mentor's own evaluation against resolution efficiency (a gym scenario and live transcript scoring) is S06's (Block C), and live scoring is an owner-run step under OD-23. `completed` includes the Mentor's soft farewell at the end of its budget, so the metric slightly overcounts resolutions until Oracle tags a resolution event of its own. v2 lesson attempts carry no time yet and are not in the ratio.

## 6. Thresholds (Appendix C threshold recalibration log)

| Threshold | Value | Owner | Review |
|---|---|---|---|
| Guided review after consecutive misses on one skill | 3, repeated at 6, 9 and 12 (proposed in B.26) | Pedagogical Lead | quarterly for the first year |
| Engagement-health trend window, tolerance, minimum weekly sample | 4 weeks against 4, 10 percent, 20 | Product and Pedagogical Lead | quarterly |
| Register age boundaries | 10 and 13 (Appendix B §2.9; directional, not hard) | Pedagogical Lead | with the register audit |
| Release audit freshness | 45 days before a release (DARK-PATTERN-AUDIT.md) | Product | per release |

## 7. Proposals for product and owner review

Implemented as the conservative default and recorded here, per the lane rules:

1. **Registers by exact age, youngest when unknown.** An unknown age reads as the young register; a teen whose age is unknown therefore sees warmer copy until age evidence exists.
2. **No leaderboards for any band, adults included.** Stricter than "no peer-visible risk comparisons for teens".
3. **Teens and adults see no medal on the lesson result.** The lesson-complete milestone is still recorded; its motion is simply not shown without the medal.
4. **The graduation shows only after a younger register was seen.** Learners who were already 10 or older before this release see no graduation.
5. **The guided review repeats at 6, 9 and 12 misses**, and counts per skill key (v1) or per lesson version (v2).
6. **The live player's wrong-answer sound** is the neutral tap. A softer dedicated "not yet" sound would need an audio asset (owner call, possible spend).
7. **Timed drills** (choice and storyplay families) still reduce the score by 20 percent when time runs out. Proposed: remove the reduction or make timers opt-in. Recorded as audit item MN-02 for the Pedagogical Lead.
8. **Experiments may not win on events or sessions.** Retention stays allowed as a success metric; a learning-outcome metric in the analytics service is future work (H.7).
