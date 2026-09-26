# Reward and motivation policy

Status: proposal implemented as the default, 24 September 2026 (S05.3e). Owner: the Pedagogical Lead for the thresholds and copy, Engineering for the mechanisms. Not accepted: product, pedagogical and owner review are pending. Record: [S05 learning-experience sprint record](sprints/S05-LEARNING-EXPERIENCE.md#s053e-reward-architecture-b20-b21-b22-b24).

This is the written policy behind Product 10 B.20 (overjustification and the celebration budget), B.21 (a lapse-tolerant streak), B.22 (no variable-ratio rewards for minors) and B.24 (real autonomy levers). It is also the contract the chore streak (D.2, S07) must reuse. Binding sources: Product 10 B.20 to B.24 and D.2, Appendix B §2.5, §2.9, §3.5, §3.7 and §3.8, Appendix C Part 1 (the engagement-health metrics) and Part 3 Stage 2 gate 7, the owner log (OD-5, OD-7, OD-9, the glossary in §5) and Frontend Bible 02 (D7, rules 17 and 18, §9.2, §9.3 and §9.6).

## 1. Reward framing and the celebration budget (B.20)

### 1.1 The closed list

Celebration effects (confetti, floating XP or coin amounts, spring overshoot, the streak flame takeover) fire only for these milestones (OD-7):

`lesson-complete`, `course-complete`, `savings-goal-reached`, `badge-earned`, `streak-7`, `streak-30`, `streak-100`.

Nothing else celebrates: not a correct answer, not a run of correct answers, not a coin split, not an ordinary practised day, not a rest day, not reaching one's own daily pace, not a routine press.

**Who decides.** Core decides which milestones a lesson completion reached and returns them as `celebrations` (`backend/src/services/celebrationBudget.ts`): `lesson-complete` for a pass, `course-complete` and `badge-earned` only on the completion that finished the course or earned the badge (a replay never repeats them), and `streak-N` only when the streak reached exactly 7, 30 or 100 on that completion. The client celebrates only what is on that list, through one gate (`frontend/src/rebuild/design/milestones.ts`): `celebrationsFrom`, `mayCelebrate` and, for the legacy Mentor pill that has no server list yet, `crossedStreakMilestone`. An older Core without the field celebrates nothing (fail closed).

### 1.2 Informational framing

Rewards are information about a specific decision or skill, not payment for output (Appendix B §2.5):

- **The skill behind the XP.** Every passed completion carries `recognition.skills` (the skills the lesson's topic teaches, from the shared knowledge-component graph, in the learner's locale). The rebuilt result screen leads with "You worked out: {skill}." and the live results screen shows the same line above the XP.
- **Tallied once, at the end.** Rewards earned in a lesson are shown on the result screen, never per answer. The live lesson header's XP counter, which counted up on every correct answer, was removed. A correct answer gets a check mark, a short movement of the chosen answer and a banner naming what was done right (Bible 02 §9.2).
- **No payment language.** Existing Forge tone gates (B.14) and the controlled glossary keep coins a simulation and never money.

### 1.3 Reward-delivery moments (the Appendix C "Reward-Framing Composition Rate" audit, baseline 24 September 2026)

| Moment | Surface | Framing | Status |
|---|---|---|---|
| Lesson complete, XP | Rebuilt result screen | Skill named before the XP; milestone motion only from Core's list | Pass |
| Lesson complete, XP | Live results screen | Skill line added; the streak takeover now needs a Core milestone | Pass |
| XP during a lesson | Live lesson header | Per-answer XP counter removed | Pass |
| A run of correct answers | Live lesson feedback | "N in a row" stays as words; the burst ring removed | Pass |
| A correct answer, the cast's reaction | Live lesson player (director) | Found in the S05.3g lane review: correct, perfect and in-run answers drew celebration poses (a dance, a jump, and the `celebrate` action, which also plays the celebration sound). Now a nod or a lean-in only; celebration poses are reserved for the completed lesson | Pass (S05.3g) |
| A correct answer, the verdict banner | Live lesson feedback | The "perfect" tier used a party glyph; now a check mark | Pass (S05.3g) |
| Lesson complete, the fanfare and the cast | Live results screen | Found in S05.3g: fired on the client's own pass, before Core answered and in previews. Now only for Core's `lesson-complete`, and only in a register whose result shows the medal | Pass (S05.3g) |
| The Mentor's `celebrate` action in a live conversation | Live Mentor (Oracle turn schema, S06 domain) | The model may name `celebrate` on any turn, which animates and plays the sound | Open: S06 |
| Streak shown in the Mentor | Live Mentor stage pill | Only when a 7-, 30- or 100-day mark was crossed since the last visit | Pass |
| Course badge | Course path and result | `badge-earned` from Core, once | Pass |
| Chore reward coins and the coin split | Family Hub tasks (S07 domain) | Plain confirmation, no celebration found in the code | Not audited for copy: S07 |
| Savings goal reached | Wallet (S07 domain) | On the milestone list | Not audited: S07 |

### 1.4 Enforcement

- **The automated check B.20 asks for:** `frontend/src/rebuild/design/celebrationBudget.test.ts` scans the whole frontend for every celebration effect (confetti, floaters, the burst ring, spring overshoot tokens and literals, the streak takeover and pill, and since S05.3g the celebration sound and a character's `celebrate` action) and fails when one appears in a file that is not a registered consumer deciding through the gate, when a registered consumer loses its gate, or when an effect component is mounted anywhere else. The definition list (token and keyframe definitions, and the four legacy 2D characters' tap reaction, retired with the legacy UI) is closed.
- The character layer (S05.3g): `frontend/src/lesson-engine/core/director.test.ts` fails if any per-answer event, in either register, can name a celebration pose or a celebrating action, and if any event other than the completed lesson can celebrate. `celebrationResults.test.tsx` pins the live results screen to Core's list and the register.
- Core tests (`backend/src/__tests__/motivationS053e.test.ts`) pin which completions reach which milestones, per population.
- The real-Chrome matrix (`frontend/scripts/verify-rebuild-motivation.mjs`) fails on any `data-celebrate` outside the milestone result and on a milestone result that does not celebrate exactly `lesson-complete` and `streak-7`, and checks that reduced motion removes the motion.

## 2. The habit streak (B.21, and the model D.2 reuses)

### 2.1 The rules

1. A streak counts **practised days in a row**. A day is practised when the learner passes a lesson on that local calendar date (their wall clock, as since 0009). Onboarding's day one is a practised day, as before.
2. **Two rest days per week are free and automatic** (Bible 02 §9.6): not earned, not bought, not claimed. A missed day inside the current run is a rest day. The week is the ISO week, Monday to Sunday, of the learner's local calendar. A run breaks only when one week holds a third missed day. A rest day keeps the run alive; it does not add to it.
3. **A verified guardian may pause the streak** for a holiday or an illness: up to 21 days per pause, starting at most 7 days back or 60 days ahead, one open pause at a time. A paused day is neither practised nor missed. Ending a pause early keeps the days already paused.
4. **The best streak and the days practised are permanent.** Nothing ever lowers them.
5. **A broken run is "resting", never "lost".** The learner sees "Streak resting" with the best streak; the next practised day starts a new run at 1.
6. **Only 7, 30 and 100 days are milestones.** Reaching them again in a later run is a milestone again.
7. **A device date earlier than the last practised day changes nothing.** The legacy rule restarted the run over a device clock.
8. **Never sold, never called a freeze.** Rest days, streaks and error forgiveness can never be sold (OD-5) and are never called a "streak freeze" (glossary: rest day, día de descanso, dia de descanso).

### 2.2 The model, in one place

- **Pure model:** `backend/src/services/habitStreak.ts` (`advanceHabitStreak`, `readHabitStreak`, `pausedDays`, `pauseRangeRefusal`). State: `current`, `best`, `lastActiveDate`, `restDaysUsed` (rest days the run used in the week of `lastActiveDate`) and `daysPracticed`.
- **SQL twin:** `habit_streak_advance` (in `*_habit_streak_and_autonomy.sql`), called by `complete_lesson` and `record_learning_practice_day` under the stats row lock, with the paused dates from `learning_streak_paused_dates`.
- **Shared vectors:** `database/scripts/habit-streak-vectors.json` (24 advance and 7 read cases). Core's tests run them against the TypeScript model; `database/scripts/test-habit-streak.sql` runs the same file against PostgreSQL. A change to either implementation that is not a change to the vectors fails.
- **Reads never write.** `GET /learn/rhythm` and the guardian's `GET /family/learning/kids/:kidId/streak` compute the status (`practiced_today`, `open`, `paused`, `resting`, `none`) from the stored row on the caller's local date, without rewriting it (OD-9).

### 2.3 Reusing the model for the chore streak (D.2)

D.2 says the chore streak must use this same model. The S07 lane should:

1. add `rest_days_used` and `days_completed` to `kid_task_streaks` with the same defaults and checks;
2. replace `nextStreak` in `routes/tasks.ts` with `advanceHabitStreak` (or call `habit_streak_advance` from a SQL function under a row lock, which is preferable since the current write is a last-write-wins upsert);
3. decide, with the product owner, whether a guardian's holiday pause covers chores too (the natural reading: one family holiday pauses both), and if so read `learning_streak_pauses` or generalize it to a `streak_pauses` table keyed by streak kind;
4. keep `longest_streak_days` and `current_streak_days` untouched at migration (OD-9).

`services/streak.ts` keeps the legacy `nextStreak` only for the chore streak until then, and says so.

### 2.4 Migration (OD-9)

Nothing a learner was promised is lost: `streak_days` and `longest_streak` keep their values and meaning. `days_practiced` is new and is backfilled with the best lower bound the data supports: the larger of the current run, the best run and the number of distinct dates of each lesson's latest passed completion. It can only be an undercount, never an overstatement. `rest_days_used` starts at 0, which can only favour the learner in the first week.

### 2.5 Measurement

- **Rest-day utilization** (Appendix C "Streak-Freeze Utilization Rate", named for the glossary): Core records `streak_rest_day` when a passed lesson kept a run alive over missed days and `streak_restart` when a run of two or more days had broken. Both are server-only and consent-gated like every learning event. `learning_rest_day_utilization(since, until)` returns, of the learners whose run met a lapse, the share kept by rest days. The content team sees it in the Learning Quality panel.
- **Streak-anxiety correlation** (Appendix C): the product sends no streak-at-risk notifications, and this policy forbids them (they are loss-framed). The metric has nothing to measure until a notification exists; any future notification must be reviewed against B.25 first.

## 3. The prohibition on variable-ratio and mystery rewards (B.22)

### 3.1 The prohibition

LittleFounders does not use randomized or variable-ratio reward mechanics. No reward (XP, coins, badges, streak milestones, celebrations, cosmetic unlocks or any future reward) may be delivered after an unpredictable number of actions, drawn from a chance table, hidden behind a "mystery", "surprise", "loot", "gacha", "spin" or "lucky draw" mechanic, or scaled by a random factor. Every reward is predictable and tied to a specific action the learner understands before acting.

**Scope.** B.22 requires the prohibition for every account holding the kid role or otherwise identified as a minor, by age and never by role (A.2 to A.4, OD-3). Because reward surfaces are shared by every age, the implemented rule is stricter: the prohibition applies to every account. An adult-only exception does not exist; introducing one would need an owner decision, a B.25 manipulative-design audit and a server-enforced age gate, and this document would change first.

**Teaching is not the mechanic.** A lesson may teach how a loot box's odds work, as risk and expected value, for teens (the Forge authoring brief names it). The Stage 3 pedagogical reviewer confirms such text teaches the mechanic and never offers it.

### 3.2 Enforcement

1. **Repository gate** (`agent/tools/check-reward-mechanics.mjs`, run by `npm run rewards:check` and by `npm run spec:check`, which CI runs on every push):
   - any random-number API in product source (`Math.random`, `randomInt`, `getRandomValues`, lodash `sample`/`shuffle`, SQL `random()`, `setseed`, `TABLESAMPLE`) must be on a closed allowlist with its non-reward purpose (8 entries today: character blink timing, the avatar randomize button, staff Mentor-review sampling, the simulated card display number and provider retry jitter); identifiers (`randomUUID`, token bytes, `gen_random_uuid`) are not draws;
   - reward code (the XP, streak, badge, celebration and task routes and services, the lesson player, the result screens and the milestone gate) can never draw, even if someone adds it to the allowlist;
   - no product copy, key or identifier may use mystery-reward language in English, Spanish or Portuguese.
2. **Forge gate 17** (`coursegen/src/pipeline/rewardMechanicGate.ts`, Appendix C Stage 2 gate 7): blocks a lesson whose reward fields are not fixed numbers (an XP range, a list of outcomes, a formula) or that names chance in a reward field, and flags mystery-reward language in learner-facing text for the Stage 3 reviewer. Red-team samples in `coursegen/src/__tests__/gate17-reward-mechanics.test.ts` prove it blocks.
3. **Core boundary test:** a lesson completion (XP, streak, celebrations) runs with `Math.random` replaced by a function that throws, and succeeds with identical results.

The Appendix C "Variable-Ratio Mechanic Audit Pass Rate" target (100% every release) is met when `spec:check` and gate 17 pass for the release; a human spot-check at Stage 3 remains part of the release review.

## 4. Real autonomy levers (B.24)

### 4.1 The levers

Avatar customization is not an autonomy lever (Sailer et al. 2017, Appendix B §3.5) and must never be credited as one in a design review. The product's autonomy levers are real choices the server honours:

| Lever | What the learner chooses | Where it is enforced |
|---|---|---|
| Path | Which lesson to take next among the course path's frontier (B.6); one is marked as the recommendation, any other open item is a real choice the lesson gate accepts | `GET /learn/courses/:slug/path`, the lesson gate |
| Mentor | Which of the four Mentor characters teaches them | `tutor_preferences`; the lesson Mentor stage and the live Mentor use it |
| Pace | How many lessons a day is their plan (1, 2 or 3; default 1 until chosen) | `PUT /learn/pace` (the learner only, never a guardian); Core counts passed lessons per local day and says when today's plan is done |

Reaching one's own plan is a plain status ("Today's plan is done."), never a celebration, and never a pressure to continue: it is a natural stopping point (B.28's resolution-efficiency principle).

### 4.2 Measurement

Appendix C "Autonomy Mechanism Adoption Rate": Core records `path_choice` (server-only, consent-gated, once per learner, lesson and day) when a learner opens a lesson from a path that offered more than one; value 1 when it was not the recommendation. `learning_autonomy_adoption(since, until)` reports the path share per open, and for pace and Mentor the share of active learners who made the choice themselves. It is diagnostic until a release-1 baseline exists.

### 4.3 Design-review checklist (Block B check 3)

A design review of any reward or personalization surface answers, in writing:

1. Does any reward read as information about a specific decision or skill, or as payment for output?
2. Does anything celebrate outside the OD-7 list?
3. Does any reward depend on chance, a hidden outcome or an unpredictable number of actions?
4. Which real choice (path, Mentor, pace, or a new one the server honours) does this surface support? Avatar or cosmetic personalization does not count.
5. Does any streak or reward copy frame a lapse as a loss, or sell forgiveness?

## 5. Proposals for product and owner review

Implemented as the conservative default; none is accepted until reviewed.

1. The ISO week (Monday to Sunday) as the rest-day week, in the learner's local calendar.
2. The pause rules: 21 days per pause, 7 days back, 60 days ahead, one open pause, guardian-only (an independent teen or an adult has the two weekly rest days and no pause).
3. Re-reaching 7 or 30 days in a later run is a milestone again.
4. The pace choices 1, 2 or 3 lessons a day, with 1 as the default.
5. Treating the prohibition as platform-wide rather than minors-only.
6. The `days_practiced` backfill as a lower bound.
7. Whether one holiday pause should cover the chore streak too (D.2, S07).

## 6. Change control

A change to any rule here changes, in the same commit: this document, the shared vectors and both model implementations (for the streak), the celebration gate's registry (for effects), or the reward gate's allowlist (for randomness), and the sprint record's verification log.
