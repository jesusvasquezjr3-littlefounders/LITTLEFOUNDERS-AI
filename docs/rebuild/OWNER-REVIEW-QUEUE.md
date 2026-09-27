# Owner Review Queue: SPEC migration, wave 1 (24–25 September 2026)

> **Answered on 27 September 2026.** Every item has an owner answer; see [OWNER-REVIEW-ANSWERS.md](OWNER-REVIEW-ANSWERS.md) and owner log OD-24 to OD-28. This file stays as the record of the questions as they were asked.

## What this is

While building wave 1 of the LittleFounders SPEC migration, the implementation agents raised 150 questions that only the owner (or a lead the owner names) can settle. This document turns that raw list into one review queue. Duplicates and near-duplicates are merged, so there are fewer items than questions. Every item names the checkpoint(s) it came from.

**Nothing here is blocked.** For every question the agents built a conservative default, usually the most protective or least spending option. The code runs today on that default. Your answer either confirms it or asks for a change. A few items describe work that was deliberately not built. The item says so, and "the default" then means "the current behavior, without that feature".

**How to answer.** Reply per item ID, for example:

- `D-04: approve the default`
- `H-11: alternative, 60 days ahead for both pauses`
- `M-02: set 5% as the interim value`
- `F-05: approve the three episodes; Content team writes the lemonade one`

An item left unanswered keeps its default. Please answer the **Decide first** section before the rest, because those defaults take effect in production, cost money, touch child safety or law, or hold other work back.

**Checkpoint codes used in "Source":**

| Prefix | Area |
|---|---|
| S03.x | Shared design system |
| S05.3x | Learning engine (B.* requirements) |
| S05.4x | Forge content gates (the course-generation pipeline) |
| S06.x | Mentor / Oracle pedagogy (C.* requirements) |
| S07.x | Family Hub and teen wallet (D.* requirements) |
| S08.x | Profiles, social and sharing (E.*, F.* requirements) |

"OD-n" refers to a decision in the binding owner decision log (`docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md`). OD-23 is the zero-paid-spend rule: every paid model, image or voice run is an owner-run step.

---

## 1. Decide first

These items have consequences outside the code. Their defaults change what production does when deployed, or they cost money, affect child safety, set a legal or privacy commitment, migrate existing data, or hold back several checkpoints.

### Release pipeline and content

**D-01: Every existing course's next release is refused until its content is re-verified or rewritten**
- **Question:** After the Forge release-gate migrations are applied, every course needs a new `verify:course` run by the new Forge before its next release. Measured against the new gates, every current catalog fails until its content is rewritten and declared. Is that acceptable, or should one course's content work be done first?
- **What it means in practice:** Courses already published **stay live**. Only a *new* release (of a course, or of a lesson inside it) is refused. Rewriting is either human authoring or a paid, owner-run Forge regeneration (OD-23). Gates 14 (density) and 16 (market scenarios) stay red for every course until the content team declares them. Gate 15 stays red for first-lemonade-stand until it has a Mentor-misjudgment episode (see F-05).
- **Default:** Accept that all current catalogs fail release until rewritten, as the intended effect of requirement G.2.
- **Alternative:** Name one course whose content work is done first, before the migrations are applied.
- **Note:** The migrations (`0112`, `0113`, and `0137`, which adds gates 17–19 from the learning-engine lane) are marked `contract`. The automatic database pipeline does not apply contract migrations, so this takes effect only when they are applied by hand. You control the timing.
- **Source:** S05.4c (Q13)

**D-02: Regenerating a lesson that is already live takes it offline until it is released again**
- **Question:** Forge's "keep-published" in-place swap was removed. Regenerating a live v1 lesson now takes it offline until it is released again. Accept?
- **Default:** Yes. The in-place swap is removed.
- **Alternative:** Keep some form of in-place replacement for live lessons. The question states no specific alternative design.
- **Source:** S05.4c (Q10)

**D-03: Owner spending ceiling on the remaining paid Forge tools**
- **Question:** `generate` and `generate:track` now refuse to run without an owner-approved USD ceiling on the command line. Should `images:backfill` (paid mode) and `audiogen narrate:all` require one too?
- **Default:** Proposed, **not yet built**. Today those two tools run without a ceiling.
- **Alternative:** Leave them without a ceiling.
- **Source:** S05.4c (Q12)

**D-04: Live Mentor generation is suspended from the first deploy until the judge is calibrated**
- **Question:** Under the SPEC's reading, live generation is suspended from the first deploy until you run the judge calibration (see D-24). Until then the Mentor serves published lessons and curated packs, or teaches in conversation. Accept, or grant a time-boxed exception?
- **Default:** Suspended until calibration.
- **Alternative:** A time-boxed exception. That is itself a Tier 1 decision and needs full review.
- **Source:** S06.7

**D-05: The release-readiness check fails until both leads sign the Tier 1 records**
- **Question:** `release:readiness` now runs the Tier-Compliance Audit. It fails until both leads sign the adoption decision and the 8 baseline Tier 1 rows. A later review added 3 more rows (`mentor.non_negotiables`, `measurement.stage7_and_thresholds`, `governance.model`). Keep it blocking, or allow a documented, time-boxed waiver? And will both leads sign the 3 new rows?
- **Why first:** `release:readiness` is the required check before any production release. It stays red until someone signs.
- **Default:** Blocking, following the SPEC: no Tier 1 item ships without explicit sign-off.
- **Alternative:** A documented, time-boxed waiver. That is itself a Tier 1 decision.
- **Source:** S06.9, S06.10

**D-06: Accept the B.6 learning-pathway policy (OD-22)**
- **Question:** OD-22 says Engineering drafts and builds the pathway policy, and the owner reviews it before release. The policy is built, including questions 1–10 in section 3 (P-01 to P-10), each with its default.
- **Why first:** Three checkpoints depend on it. It controls what a child can open and how learning evidence counts.
- **Default:** Built behind the switch `COURSE_PATHWAY_ENGINE`, set to `linear`. Deploying changes nothing a learner sees. The new engine turns on only after (1) you accept the policy, (2) the B.6 migrations are applied, and (3) an operator sets the switch to `pathway`. Switching back to `linear` is the rollback.
- **How to answer:** Accept the policy as drafted (all P-item defaults), or accept it with changes named per P-item.
- **Source:** S05.3a, S05.3b, S05.3g

### Sharing, scheduled jobs and data migrations

**D-07: When do old public share links stop being issued (the F.1 cutover instant)?**
- **Question:** The cutover is fixed at 2026-09-24T00:00Z, OD-20's date, and it fails closed. A share link the live platform creates after that instant, but before this lane is deployed, is refused. Should the cutover instead be the moment of the production deploy?
- **Why first:** Parents who shared a badge link on the live platform after 24 September will find the link refused once this deploys.
- **Default:** 2026-09-24T00:00Z.
- **Alternative:** The production deploy moment. Only the constant and its two mirrors would change.
- **Related:** Migration `0115` (contract, applied by hand) makes the database refuse every new public link. Links issued before the cutover are retired on 24 October 2026.
- **Source:** S08.4, S08.8

**D-08: A new daily production job, plus the other recurring jobs the questions mention**
- **Question:** `badge-link-retirement.yml` is a new daily production workflow (03:30 UTC). It runs inside Core's container over `railway ssh` and deletes the stored image of every expired or revoked legacy share link. It starts running on the push that deploys this lane. Approve adding it to the scheduled-jobs list?
- **Default:** Included in the lane. It will start on push.
- **Alternative:** Do not approve. It must then be removed or disabled before the push.
- **Other recurring work named in the questions:**
  - A weekly Mentor integrity report (CLI), proposed for the first release until the C.24 dashboard replaces it (M-03).
  - A monthly paid judge re-calibration during the first year, owner-run (D-24).
- **For awareness (not raised as questions):** The workflow files show these other scheduled production jobs added or extended in wave 1. Each starts running once it reaches `main`:
  - `account-deletion.yml`: daily 03:45 UTC, over `railway ssh`. It performs the erasures once the D-11 grace period ends.
  - `social-retention.yml`: daily 04:15 UTC, over `railway ssh`. It applies the D-15 windows and the D-16 follow removal.
  - `family-retention.yml` (S07 lane): daily 03:15 UTC, over `railway ssh`. It applies the D-17 periods and deletes photos.
  - `tutor-retention.yml`: daily 03:00 UTC, now extended to purge Mentor disposition profiles (D-18).
  - `insights-maintenance.yml`: daily 07:30 UTC, extended with the 400-day bridge-prompt purge (L-11) and an S07.5 nightly eligibility sweep.
  - `mentor-evaluation-loop.yml`: **hourly**, over `railway ssh`. It scores ended sessions with zero spend and feeds the staff dashboard.
  - `mentor-live-content-monitor.yml` (weekly, read-only report), `mentor-review-routing-audit.yml` (quarterly) and `mentor-bias-audit.yml` (monthly, fixture-only, no network).
- **Source:** S08.4 (plus S06.2 and S06.7/S06.9 for the cadences)

**D-09: Existing savings-bonus rules for children under 13 are reframed, and some are switched off**
- **Question:** Under 13 (or with no known birth date), the savings bonus becomes the fixed "1 coin per 10 saved". Existing rules at 10% or more move to that ratio. Existing rules **below 10% are switched off** until the Tutor says yes again, because raising them would pay more than the Tutor agreed to. The Tutor is told why. Confirm this migration choice?
- **Why first:** On migration, some families' weekly bonus stops until a Tutor acts.
- **Default:** Rules below 10% are switched off, pending the Tutor's yes. The previous rate is kept so the Tutor's screen can say what changed.
- **Alternative:** Raise them to 1 per 10, which would pay more than the Tutor agreed to.
- **Source:** S07.3

**D-10: Best scores stored as 100 on the new v2 lessons**
- **Question:** Before this release, v2 lessons stored a best of 100 because the old function passed a constant. Keep those stored bests (a first replay then reads "Your saved best is still 100%"), or reset v2 bests to first-try accuracy at migration?
- **Default:** Keep them at 100 (per the S05.3d record).
- **Alternative:** Reset v2 bests to first-try accuracy at migration.
- **Source:** S05.3d, S05.3g

### Privacy, deletion and retention (legal)

**D-11: Account-deletion grace period and completion deadline (E.6)**
- **Question:** The implemented values are a 14-day grace period for adults, parents and independent teens, and completion within 48 hours of the stated date. Confirm both, or set others? Product owns this decision, and it is due before release.
- **Default:** 14 days of grace and a 48-hour deadline. Guests and self-registered under-13 accounts are erased at once.
- **Alternative:** Different values.
- **Source:** S08.5, S08.8

**D-12: Legal wording about deletion and backups**
- **Question:** The legal copy was not changed. May counsel add backup retention to the Privacy Notice, and review the Terms paragraph saying cancellation does not oblige immediate deletion, against `docs/rebuild/policies/ACCOUNT-DELETION.md`?
- **Default:** Unchanged. No legal text was edited.
- **Alternative:** Counsel revises both documents.
- **Source:** S08.5

**D-13: Deletion is held while a safety review is open**
- **Question:** If an account is named in an open E.3 safety review, its erasure waits until staff resolve the case, because deleting it would also delete the reports and evidence. The holder can still keep the account. Confirm?
- **Default:** Hold the erasure.
- **Alternative:** Erase on schedule regardless of the open case.
- **Source:** S08.5

**D-14: Who is told when a teen deletes their own account**
- **Question:** (a) An independent teen (13–17, Option B, no guardian) who deletes their account currently notifies nobody. Send a confirmation email to the teen's own address? (b) Once a guardian can link to a self-registered teen (if S07 adds that), should the teen's self-deletion notify the guardian, or also wait for the guardian?
- **Default:** (a) No email is sent. (b) The policy says notify only, once linking exists.
- **Alternatives:** (a) Send a confirmation email to the teen. (b) Wait for the guardian as well.
- **Source:** S08.5, S08.8

**D-15: How long social data is kept (E.11)**
- **Question:** (a) The proposed windows are: unanswered requests 30 days; closed requests 30 days after the decision; report notes 90 days; resolved reports and cases 365 days; read notices 90 days; unread notices 365 days. Should they stand? (b) Should social-graph entries in the audit log expire (proposed: 400 days, matching the H.2 raw-event window)? That needs a dated prune of the otherwise append-only audit log.
- **Default:** (a) The windows above, enforced by the daily `social-retention.yml` sweep. (b) Audit entries are kept indefinitely until you decide.
- **Alternatives:** (a) Other windows. (b) Expire them after 400 days, or another period.
- **Source:** S08.7, S08.8

**D-16: Follows approved by a former guardian are removed**
- **Question:** A follow approved by a guardian who is no longer a current verified guardian of the child is removed, even if another guardian is still linked. Confirm?
- **Why first:** The daily sweep removes these follows in production from its first run.
- **Default:** Remove them.
- **Alternative:** Keep a follow while any current verified guardian remains linked. This is the natural opposite, not a stated option.
- **Source:** S08.7

**D-17: How long Family Hub data is kept (D.21)**
- **Question:** (a) The proposed periods, pending Legal review, are: chore photos 30 days after the decision; records 400 days; invitations 30 days; research data 1,100 days; the coin record for the life of the account. (b) The new Family Hub behavior-event stream keeps data for 400 days, and a revoked consent stops new events without deleting past ones (the same practice as `learning_events`). Are these right?
- **Default:** As listed, enforced nightly by `family-retention.yml`.
- **Alternatives:** Other periods, or deleting past events when consent is revoked.
- **Source:** S07.4, S07.7

**D-18: How long Mentor data is kept**
- **Question:** (a) The learner disposition profile is kept for 365 days. (b) Mentor evaluation artifacts are kept as follows: scores and run rows 400 days, snapshots 90 days. None of them holds personal data. Both need owner or legal confirmation.
- **Default:** 365 days; 400 and 90 days. The 365-day purge runs in the nightly `tutor-retention.yml`.
- **Alternative:** Other periods.
- **Source:** S06.5, S06.8

### Child safety

**D-19: Can adults outside a teen's family send the teen connection requests?**
- **Question:** Should adults outside a teen's family be unable to send connection requests at all?
- **Default:** They may send a request, and the teen decides. Limits apply: a 20-request cap, a 30-day cooldown and the E.3 pattern trigger.
- **Alternative:** Block all requests from adults outside the teen's family.
- **Source:** S08.6, S08.8 (E.8 policy §7)

**D-20: The Mexican word "pelado" triggers the adult-content response**
- **Question:** In Mexico "pelado" means a cheeky person, but it matches the adult-content list. A harmless Mexican sentence therefore gets the scripted adult-content reply and a flag the guardian can see. Narrowing a moderation rule is Tier 1, so the fail-closed behavior was kept. Proposal: match bare "pelad[oa]" only in pt-BR sessions, and in every locale only near a word for photo or video. Approve?
- **Default:** Fail closed. Mexican children still hit this false positive.
- **Alternative:** The proposed narrowing (a Safety/Trust decision).
- **Source:** S06.4

**D-21: Wider abuse-disclosure detection stops the session**
- **Question:** After the audit, the abuse-disclosure rule also catches a child naming a person ("my brother hit me", "my stepdad hits me"). That stops the session and shows a flag the guardian can see, the same outcome as the existing "he hit me" rule. Keep this loose, fail-closed scope, or narrow it for siblings and friends?
- **Default:** Keep the wide scope.
- **Alternative:** Narrow it for siblings and friends.
- **Source:** S06.4

### Staff access to family data

**D-22: Should analytics staff see per-child family-engagement rows?**
- **Question:** The rows are de-identified, dated to the day, and shown only for children with analytics consent. Should the staff insight be population counts only? This is a Safety/Privacy call.
- **Default:** Per-child rows are shown, under those conditions.
- **Alternative:** Population counts only.
- **Source:** S07.6

**D-23: May staff read Tutor-written denial reasons?**
- **Question:** To measure the Denial-Reason Actionability Rate, staff score a sample of the reasons Tutors write when they say "not yet". The sample is consent-gated and anonymized: the reason, its code and an opaque id. This is a Safety/Legal review item.
- **Default:** Built. Staff with `view_analytics` score a random sample, only for children the H.1 analytics gate admits.
- **Alternative:** Do not let staff read the reason text.
- **Source:** S07.5

### Spend approvals (OD-23: each is an owner-run paid step)

**D-24: Judge calibration runs, the human panel and the paid bias audit**
- **Question:** (a) Who sits on the human panel that rates the calibration seed set (at least 2 raters)? (b) Approve the spend and schedule for the two live judge calibrations: 44 content-judge calls and 47 transcript-judge calls per calibration, repeated monthly during the first year. (c) Approve the paid live model-judge bias audit.
- **Why first:** D-04's suspension of live generation lifts only after this runs.
- **Default:** Nothing has run. No panel is named. Coverage counts the judge as not covered.
- **Alternative:** Approve the spend and a schedule, name the raters, or change the cadence.
- **Source:** S06.7, S06.9, S06.4

**D-25: One-time voice-clip synthesis (small paid text-to-speech calls)**
- **Question:** Approve each of the following:
  - (a) 156 new scripted Mentor clips, about 18,000 characters.
  - (b) 12 check-in clips.
  - (c) 6 guided-voice placement clips (`placement.resultAhead` and `placement.resultStart` in 3 locales), reframed so they no longer sound like a verdict.
- **Default:** Not generated. For (c), the two narrated sentences keep their old verdict wording until regenerated. The reframed texts are in `frontend/src/rebuild/learning/placementOutcome.ts`.
- **Alternative:** Approve any or all.
- **Source:** S06.3, S06.4, S05.3d, S05.3g

---

## 2. Learning pathway (B.6 policy)

These are the ten questions D-06 covers. Accepting D-06 as drafted accepts every default below.

**P-01: Early entry for 12-year-olds**
- **Question:** May 12-year-olds keep early entry to the legacy teen chapters, which were written for ages 12–18?
- **Default:** Yes.
- **Alternative:** No.
- **Source:** S05.3a

**P-02: Adults using the teen chapters as a bridge**
- **Question:** Until adult chapters exist, may adults keep taking the teen chapters as a younger-stage bridge that still earns the badge?
- **Default:** Yes. It is reported as a content gap.
- **Alternative:** No.
- **Source:** S05.3a

**P-03: Strong mastery and the minimum age**
- **Question:** May a minor with strong mastery open an older stage's chapter below its authored minimum age?
- **Default:** No. Age is a safeguard, and mastery never opens a closed chapter.
- **Alternative:** Yes, with some mastery threshold.
- **Source:** S05.3a

**P-04: Mentor mastery and topic completion**
- **Question:** Should mastery shown with the Mentor alone ever complete a course topic, or only unlock what follows it?
- **Default:** Unlock only. Completion needs graded lessons or placement credit.
- **Alternative:** Mentor mastery also completes the topic.
- **Source:** S05.3a

**P-05: Credit when moving into a new stage**
- **Question:** When a learner moves into a new stage, should new-stage topics covering skills (KCs) they already showed be credited automatically?
- **Default:** No. The new stage's entry placement decides.
- **Alternative:** Credit them automatically.
- **Source:** S05.3a

**P-06: The two content-gap skills**
- **Question:** Should the two content-gap KCs (fraction-of-amount, goods-vs-services) get new topics in the Forge phase, or be retired?
- **Default:** Write new topics.
- **Alternative:** Retire them.
- **Source:** S05.3a

**P-07: The 63 order conflicts**
- **Question:** Should pedagogical review settle each of the 63 conflicts between the skill graph's order and the curriculum's order before the skills are activated?
- **Default:** Yes. Until then, the authored order decides what is locked.
- **Alternative:** Activate without the review.
- **Source:** S05.3a

**P-08: Prerequisite courses from a younger stage (rule P7)**
- **Question:** Should a course-level prerequisite be waived when the required course belongs to a younger stage for this learner? Example: financial education before investing, for teens and adults.
- **Default:** Yes, rule P7. It replaces S05.2ba's rule that required the badge from everyone.
- **Alternative:** Keep requiring the prerequisite badge from everyone.
- **Source:** S05.3a

**P-09: Should graded course lessons update the Mentor's picture of the learner?**
- **Question:** Should a graded course lesson update the Mentor's mastery estimate and review cards?
- **Default:** **Not implemented**: course lessons do not feed the Mentor today. The proposal is yes, for the topic's primary skill only, as a new `course_lesson` evidence source, after policy acceptance and calibration.
- **Alternative:** Keep them separate, or feed more than the primary skill.
- **Source:** S05.3b (Q9), S05.3g

**P-10: One switch for all courses, or one per course?**
- **Question:** Should the pathway engine be switched on for every course at once, or course by course?
- **Default:** One global switch (`COURSE_PATHWAY_ENGINE`). With today's catalog, progress and badges do not change for a learner who can open a course. What changes is which chapters are locked. A learner below a course's minimum age loses access to it and keeps every pass, credit and badge.
- **Alternative:** Switch it on course by course.
- **Source:** S05.3b (Q10)

---

## 3. Lessons, grading and rewards

**L-01: The 20% penalty when a timed drill runs out**
- **Question:** In two live exercise families (choice and storyplay), running out of time still takes 20% off the score, in both the frontend and Core graders (audit item MN-02). Remove the penalty, or make timers opt-in?
- **Default:** Unchanged. The penalty remains, because this is a Pedagogical Lead decision.
- **Alternatives:** Remove the reduction, or make timers opt-in.
- **Source:** S05.3f, S05.3g

**L-02: A gentle "not yet" sound**
- **Question:** Wrong answers now play the neutral tap instead of the error buzzer. Is a dedicated, gentle "not yet" sound wanted?
- **Default:** The neutral tap.
- **Alternative:** A new sound. It needs a new audio asset, which may cost money.
- **Source:** S05.3f

**L-03: Conservative learner-experience defaults**
- **Question:** Confirm these defaults:
  - Teens and adults see no medal on the lesson result.
  - The graduation message shows only after the learner has seen a younger register.
  - The guided review repeats at 6, 9 and 12 misses.
  - Retention (daily active users over users) stays allowed as an experiment success metric, while raw event and session counts are refused.
- **Default:** As listed.
- **Alternative:** Change any of them.
- **Related:** The "unknown age reads as the youngest register" default from the same list is in H-14. The leaderboard default is in L-04.
- **Source:** S05.3f

**L-04: Peer comparison and leaderboards by age band (B.23)**
- **Question:** The SPEC asks for different social and comparison mechanics per age band. The lane applies the most protective rule to every band: comparison only with the learner's own history, no leaderboard (adults included), no progress visible to peers. Do you want a peer mechanic for ages 10–12 or 13–17?
- **Default:** No peer mechanics and no leaderboards for any band.
- **Alternative:** A peer mechanic for 10–12 and/or 13–17. It would need design.
- **Source:** S05.3g, S05.3f

**L-05: Randomized rewards are banned for everyone**
- **Question:** Confirm the ban on randomized rewards applies to the whole platform, not only to minors.
- **Default:** Platform-wide.
- **Alternative:** An exception for adults. That would need an owner decision, a B.25 audit and a server-side age gate.
- **Source:** S05.3e

**L-06: Streak and pace defaults (policy §5)**
- **Question:** Confirm these defaults:
  - Rest days are counted per ISO week (Monday to Sunday).
  - Reaching a 7- or 30-day streak again celebrates again.
  - Pace options are 1–3 lessons, with 1 as the default.
  - The `days_practiced` backfill is a lower-bound estimate.
- **Default:** As listed.
- **Alternative:** Adjust any of them.
- **Related:** The pause limits from the same list are merged into H-11.
- **Source:** S05.3e

**L-07: Practice-difficulty thresholds (B.19)**
- **Question:** Accept these thresholds?
  - A 70–85% default success band, with 50–95% guard rails.
  - A minimum of 30 first attempts.
  - Review after 2 consecutive 28-day windows outside the band, then a one-window cooldown.
  - A 10% floor for judgment divergence over 30 answers.
  - Recalibration every 90 days.
- **Default:** As listed. Details: `docs/rebuild/PRACTICE-DIFFICULTY-CALIBRATION.md`.
- **Alternative:** Other values.
- **Source:** S05.3d

**L-08: Product copy review of three new lines**
- **Question:** Review three pieces of new copy:
  - The reason-quality lines shown after a reasoning check.
  - The new placement result copy: "I'd rather start earlier" replaces "This feels too advanced".
  - The kept-best sentence: "Your saved best is still X%. This was practice."
- **Default:** The copy as written.
- **Alternative:** Edits.
- **Source:** S05.3d

**L-09: Which skills trigger the real-life bridge (B.13)**
- **Question:** Approve the 7 knowledge components mapped to the two real-life actions?
  - Savings goal: biz.saving-goal, life.saving-for-later, life.goal-planning, money.savings-plan-math.
  - Earning task: biz.value-of-work, life.effort-and-work, life.track-earnings.
- **Default:** As mapped.
- **Alternative:** A different mapping.
- **Source:** S05.3c

**L-10: A guardian creating a savings goal for the child**
- **Question:** May a verified guardian create a savings goal in the child's wallet through a bridge prompt ("create a real one together")? Until now only the child's own role could create goals.
- **Default:** Allowed.
- **Alternative:** Only the child creates goals.
- **Source:** S05.3c

**L-11: How often the bridge prompts appear, and how long they are kept**
- **Question:** Confirm or adjust:
  - One prompt per knowledge component, and one open prompt per action.
  - A 30-day cooldown and a 14-day quiet expiry.
  - "Not now" is final for that component.
  - Closed prompts are purged after 400 days, so a component may prompt again after more than a year.
- **Default:** As listed. The purge runs in the nightly `insights-maintenance.yml`.
- **Alternative:** Adjust any value.
- **Source:** S05.3c

**L-12: Independent teens and "I will try"**
- **Question:** Once the teen personal wallet (D.3) exists, should an Option B teen's "I will try" create the teen's own real savings goal?
- **Default:** **Unclear from the source.** The question is framed as future work. The personal wallet was built in the parallel S07.2 lane, and the source does not say whether this connection exists.
- **Alternative:** Yes, create the teen's own goal.
- **Source:** S05.3c

**L-13: The decision journal is private**
- **Question:** The decision journal is private to the learner. The guardian's narrative shows only how many story decisions were made, never which option was chosen. Confirm this privacy default?
- **Default:** As described.
- **Alternative:** Show the guardian more.
- **Source:** S05.3c

---

## 4. Forge content gates

See also D-01 (all catalogs must be re-verified), D-02 (a live lesson goes offline when regenerated) and D-03 (spending ceilings).

**F-01: Which texts the copy-length gate blocks**
- **Question:** OD-13 names prompts, answer options and Mentor turns for the Forge copy-length gate. The build also blocks on:
  - Feedback text: explanation, rationale and recap, with a 12-word body budget (15 in Spanish and Portuguese).
  - Segment and card titles: a 6-word heading budget (8 in Spanish and Portuguese).
  - Hints: a 60-word layered sheet.

  It also measures catalog descriptions and `parent_check` tips as body copy. Keep all of these blocking, or block only OD-13's three roles and report the rest as advisory?
- **Default:** Keep them all blocking.
- **Alternative:** Block only OD-13's three roles and report the rest as advisory.
- **Source:** S05.4a

**F-02: Which age-band limits apply to tiers that straddle two bands**
- **Question:** (a) Tier 2 (ages 8–10) gets the stricter copy limits for ages 6–9, because it serves 8- and 9-year-olds. (b) Tier 4 (ages 12–18) sits in the 10–12 band for the B.17 ceiling (4), because it serves 12-year-olds. Keep both until the age pathways separate those ages?
- **Default:** Keep both until the OD-16 pathways split the ages.
- **Alternative:** Use the older band's limits now.
- **Source:** S05.4a, S05.4b

**F-03: Banking words and urgency wording in lessons**
- **Question:** In lessons and catalogs, banking vocabulary and everyday urgency wording go to Stage 3 human review instead of blocking, because teen money lessons legitimately teach what bank messages and scams say. In system and interface copy every category blocks. Confirm this split?
- **Default:** The split as described.
- **Alternative:** Block everywhere.
- **Source:** S05.4a

**F-04: Where the B.17 ranges block**
- **Question:** The upper end of each range blocks (3 / 4 / 6). Counts above the lower end (2 / 3 / 4) go to Stage 3 review. Confirm, or block at the lower end?
- **Default:** Upper end blocks. Above the lower end goes to review.
- **Alternative:** Block at the lower end.
- **Source:** S05.4b

**F-05: Episodes where the Mentor makes a mistake (B.11)**
- **Question:** Confirm the three flagged candidate lessons as Mentor-misjudgment episodes:
  - financial-education "que-paso-despues-del-error"
  - entrepreneurship "que-le-falto-a-esta-lista"
  - investing "rho-comete-un-error-barato"

  Also decide who writes the first-lemonade-stand episode.
- **Default:** The three candidates are flagged. **No author is named.** Gate 15 stays red for first-lemonade-stand until it has an episode.
- **Alternative:** Other lessons, or a named author.
- **Source:** S05.4b

**F-06: Money amounts in each market (B.16)**
- **Question:** Should Forge gain a per-market writing stage that recomputes answer keys? That would be paid generation, owner-run. Or is play money with the same numbers in every market acceptable, with Stage 3 review?
- **Default:** Same numbers in every market, with the plausibility judged in Stage 3 review. The per-market stage is not built. The proposal is to build it when Forge moves to the v2 contract.
- **Alternative:** Build the per-market stage sooner.
- **Source:** S05.4b

**F-07: No exception for undeclared lessons**
- **Question:** A Forge run skips undeclared slots, even in the QA smoke-test course first-lemonade-stand. Confirm there is no bypass?
- **Default:** No bypass.
- **Alternative:** Allow a bypass for the QA smoke course.
- **Source:** S05.4b

**F-08: Releasing single lessons**
- **Question:** Keep per-lesson Approve, which now goes through `release_lesson` with the full Forge preflight and only into a course that is already live? Or allow only whole-course releases?
- **Default:** Keep per-lesson release, with the full preflight.
- **Alternative:** Whole-course releases only.
- **Source:** S05.4c (Q9)

**F-09: Image and audio patches to live lessons**
- **Question:** `images:backfill` and Echo's narration stamps change already-published lessons in place. No text changes, but the images are visible to learners. Choose: (a) require demotion, or a new v2 version, first; or (b) allow the patch with a mandatory `verify:course` within 30 days.
- **Default:** **Neither option is built yet.** Today such a patch is still allowed in place and forces a fresh verification before the next release. Engineering proposes (a).
- **Alternative:** (b).
- **Source:** S05.4c (Q11)

---

## 5. Mentor

See also D-04 (live generation suspended), D-05 (Tier 1 sign-off), D-18 (retention), D-20 and D-21 (moderation), and D-24 and D-25 (spend).

**M-01: Rescue or remediate first?**
- **Question:** With graded answers only, a second miss in a row triggers both RESCUE and corroborated REMEDIATE. RESCUE is kept first because safety rules win, so a purely graded misconception is remediated on the third miss. Should corroborated REMEDIATE take precedence instead?
- **Default:** RESCUE first.
- **Alternative:** REMEDIATE first.
- **Source:** S06.2 (proposal 1)

**M-02: The ceiling on revealed answers**
- **Question:** The ceiling on how often the Mentor reveals the answer, per persona, is 10%. That is a placeholder until a human-rated baseline batch exists. Approve it, or set an interim value?
- **Default:** 10%.
- **Alternative:** Another interim value.
- **Source:** S06.2

**M-03: How often integrity is monitored**
- **Question:** Weekly integrity monitoring is proposed for the first release, until the C.24 dashboard replaces the command-line report.
- **Default:** Weekly.
- **Alternative:** Another cadence.
- **Source:** S06.2

**M-04: When the learner presses "end"**
- **Question:** When the learner presses "end", should the Mentor still ask the recap question?
- **Default:** No. The learner gets the completed close, which names the act, at once, so leaving is not held up.
- **Alternative:** Ask the recap question first.
- **Source:** S06.3

**M-05: Re-engagement messages**
- **Question:** Confirm these rules:
  - A re-engagement message is queued only for a return within 30 days.
  - An "error" close uses the "we stopped partway" wording.
  - A safety stop, a revoked consent or a normal completion queues nothing.
- **Default:** As listed.
- **Alternative:** Adjust.
- **Source:** S06.3

**M-06: Session-end signal thresholds**
- **Question:** Confirm or adjust:
  - Baseline 4, window 8.
  - Surprise probability 0.75.
  - A surprising-miss rate rise of +0.25, with at least 2 surprising misses.
  - A latency-spread rise of +0.3.
  - At most 2 offers per session, re-armed after 4 graded turns.
- **Default:** As listed.
- **Alternative:** Other values.
- **Source:** S06.3

**M-07: Automatic rollback (Stage 7) and the check-in chips**
- **Question:** (a) Approve the automatic rollback defaults: a 14-day trailing window, a minimum of 300 evaluated turns, a 10-minute cache, and a trip that stays until an operator resolves it. (b) During the rollback, goal agreement keeps running and only the renegotiation and continuity moves are suspended. Confirm? (c) Approve the check-in chip labels:
  - EN: "We're good" / "Not really"
  - es-MX: "Sí, vamos bien" / "La verdad no"
  - pt-BR: "Sim, tudo bem" / "Não muito"
- **Default:** As listed.
- **Alternative:** Adjust any part.
- **Source:** S06.4, S06.5

**M-08: A fixed instruction outside the 14-field context list**
- **Question:** For a first meeting or a persona switch, persona continuity sends the model one fixed, server-written sentence: "you have NOT worked with this learner before as yourself". It is an instruction in the turn's content, not a field of the pinned 14-field context schema. Accept that closed system instructions like this sit outside the allow-list, or treat this as a reviewed widening?
- **Default:** Accepted as outside the allow-list.
- **Alternative:** Handle it as a reviewed widening of the context schema.
- **Source:** S06.5

**M-09: Remembering declined adaptations**
- **Question:** When a learner declines an adaptation, the decline is now stored as a count that fades over time, and adaptations declined persistently shape the plan. The legacy rule never stored a decline. Confirm? The counts are visible to the guardian and can be reset.
- **Default:** Stored as fading counts.
- **Alternative:** Never store a decline (the legacy rule).
- **Source:** S06.5

**M-10: The end-of-session question about the learner's experience**
- **Question:** The closing question "Did I get what you wanted today?" (Yes / A little / Not really) is asked on the closing screen after the session ends, not as another spoken Mentor turn. Confirm, including "A little" as the middle answer?
- **Default:** As described.
- **Alternative:** Ask it as a spoken turn, or change the answers.
- **Source:** S06.5

**M-11: Thresholds for renegotiating goals with the learner**
- **Question:** Confirm or calibrate:
  - 2 declines in a row trigger renegotiation.
  - A 4-turn improvement window.
  - A 30-day memory gap.
  - 95% as the reading of "near 100%".
  - "No measurable improvement" means fewer than 50% of the last 50 improved.
- **Default:** As listed. The 365-day profile retention from the same list is in D-18.
- **Alternative:** Other values.
- **Source:** S06.5

**M-12: May minors join the dialogue-style experiment?**
- **Question:** C.17 requires an A/B test of the child and teen dialogue calibrations, but OD-23/H.7 limits experiments to adults, so the test cannot measure the age bands C.17 is about. Should Product and Legal open the young_child, tween or teen bands?
- **Default:** Adults only, pinned by a test. Minors get the calibrated default and are measured by observation only.
- **Alternative:** Open one or more minor bands. That means a recorded owner-log decision, and enrolment would still need guardian analytics consent for children and the teen's own preference.
- **Source:** S06.6, S06.10

**M-13: A controlling phrase that survives the retry**
- **Question:** When a controlling phrase survives the retry, the turn is still delivered and counted, and the report flags it as a defect. The alternative is to replace that turn with a scripted line. Confirm?
- **Default:** Deliver, count and flag it.
- **Alternative:** Replace the turn with a scripted line.
- **Source:** S06.6

**M-14: Adults and the autonomy-supportive style**
- **Question:** Adults also get the autonomy-supportive register and the controlling-language check, although the SPEC names only teens. Confirm?
- **Default:** Applied to adults too.
- **Alternative:** Teens only.
- **Source:** S06.6

**M-15: How much live content staff review**
- **Question:** Confirm the sizing of the dynamic review-sampling rate:
  - Standard content rises from 15% to 50%, and sensitive content from 50% to 100%.
  - The rise applies per content-risk category, not per activity type.
  - A batch is 20 decisions, and 5 clean batches restore the baseline.
- **Default:** As listed.
- **Alternative:** Other sizing.
- **Source:** S06.7

**M-16: The three Mentor-quality owner roles**
- **Question:** Are the three owner roles (Pedagogy lead, Safety and trust lead, Engineering lead) right, and is each signal assigned to the right one? For example, every subgroup disparity goes to the Safety/Trust lead. No people are named yet, and the weekly review and flag actions start only once staff name someone for each role.
- **Default:** Three roles, as assigned.
- **Alternative:** Different roles or assignments.
- **Source:** S06.8

**M-17: Flagging differences between groups of learners**
- **Question:** A group is flagged when its rate is twice that of the rest AND at least 5 points above it, with at least 30 sessions on each side. The end-of-session question (M-10) is flagged when one persona scores under 85% of the other personas' mean. Are these the right starting values?
- **Default:** As listed.
- **Alternative:** Other values.
- **Source:** S06.8

**M-18: Alerts for urgent flags nobody has acknowledged**
- **Question:** Should urgent flags that nobody acknowledges also notify someone outside the dashboard, for example by email?
- **Default:** Nothing is sent today.
- **Alternative:** Email or another channel.
- **Source:** S06.8

**M-19: What counts as Tier 1 code**
- **Question:** Confirm that mixed files such as Oracle's `controller.ts` and `orchestrator.ts`, and Core's kill-switch modules, count as Tier 1 as a whole. Also confirm the approved Tier 2 bounds in the registry.
- **Default:** Whole-file Tier 1, with the Tier 2 bounds as recorded.
- **Alternative:** Finer boundaries.
- **Source:** S06.9

**M-20: What "a defined threshold" means for calibration**
- **Question:** (a) Confirm the engineering readings: human-panel agreement (Fleiss kappa) at least 0.60, judge agreement (Cohen kappa) at least 0.70, and a verbosity gap of at most 15 points. (b) Should the moderation judge also get a human-panel calibration?
- **Default:** (a) As listed. (b) Excluded: it is a Tier 1 safety judge covered by the C.20 bias audit.
- **Alternative:** Other thresholds, or include the moderation judge.
- **Source:** S06.9

**M-21: Counting check-ins the session limit held back**
- **Question:** After 2 check-ins in a session, the telemetry layer stops firing. Should evaluations that reach the firing bar after that limit still be counted and reported, so the review can see how often the limit holds the Mentor back?
- **Default:** **Not implemented.** Doing it would change a bias-audited file and the session-close data format. It is recorded for the Pedagogical Reviewer.
- **Alternative:** Count and report them.
- **Source:** S06.10

---

## 6. Family Hub and wallet

See also D-09 (the savings-bonus migration), D-17 (retention), D-22 (staff per-child rows) and D-23 (staff reading denial reasons).

**H-01: Removing another Tutor**
- **Question:** Should a verified Tutor be able to remove ANOTHER Tutor from a child?
- **Default:** No. A Tutor can only step away from their own link, because removing someone else carries custody-dispute risk.
- **Alternative:** Allow it, possibly with safeguards.
- **Source:** S07.1

**H-02: What the confirming Tutor sees about a pending second Tutor**
- **Question:** While a second Tutor waits for confirmation, should the confirming Tutor also see a masked contact detail, in addition to the display name and date?
- **Default:** Display name and date only. This is implied by the question and not stated outright.
- **Alternative:** Add a masked contact detail.
- **Source:** S07.1

**H-03: Confirming a second Tutor**
- **Question:** A second Tutor stays pending until an existing verified Tutor confirms them. A child with no verified Tutor left is verified directly. Confirm?
- **Default:** As described.
- **Alternative:** Another confirmation rule.
- **Source:** S07.1

**H-04: What still works while an account is frozen**
- **Question:** While the account is frozen, the Tutor can still make coin corrections and goal withdrawals, but the child cannot request rewards. Confirm?
- **Default:** As described.
- **Alternative:** Freeze Tutor actions too.
- **Source:** S07.1

**H-05: Marking rewards delivered, and where withdrawn goal coins go**
- **Question:** Any verified Tutor can mark a reward delivered. Goal withdrawals go only to Spend or plain Save, never to Share. Confirm?
- **Default:** As described.
- **Alternative:** Other rules.
- **Source:** S07.1

**H-06: Can a parent turn off a teen's own wallet actions?**
- **Question:** Once a parent links to a teen, may the parent switch off the teen's self-directed actions: logging income, personal rewards, and releasing goal coins?
- **Default:** The teen keeps them, with no approval step. The parent's freeze and spending limit still apply.
- **Alternative:** Let the parent switch them off.
- **Source:** S07.2

**H-07: Can a teen remove a parent?**
- **Question:** May a teen remove a parent they confirmed? Should the S07.1 rule that the last verified guardian cannot step away also apply to the parent of a self-registered teen?
- **Default:** **Neither is built.**
- **Alternative:** Build either or both.
- **Source:** S07.2

**H-08: A teen's wallet history at 18**
- **Question:** What should a teen who turns 18 see of their wallet history?
- **Default:** Core stops reads and writes, and the rows are kept. There is no read-only view or export.
- **Alternative:** A read-only view, an export, or both.
- **Source:** S07.2

**H-09: Conservative teen-wallet defaults**
- **Question:** Confirm these defaults:
  - Only the teen confirms a parent who accepted the teen's invite.
  - The parent of a self-registered teen gets no account-holder controls.
  - Income sources are a closed list, with no free-text memo.
  - Personal rewards cost 1–500 coins, with at most 20 active.
- **Default:** As listed.
- **Alternative:** Adjust any of them.
- **Source:** S07.2

**H-10: Where a teen starts after linking a parent**
- **Question:** Should a teen who links a parent start on independence Level 1, like every child in a family, or higher, since their personal wallet had no approval step before?
- **Default:** Level 1.
- **Alternative:** Start higher.
- **Source:** S07.5

**H-11: Holiday pauses and the family-contribution cap (includes a mismatch to resolve)**
- **Question:** (a) Are these pause bounds acceptable?
  - For the chore streak (S07.3): pauses of 1–21 days, starting up to 7 days back and up to **120 days ahead**, at most 3 live pauses.
  - For the learning streak (S05.3e): up to 21 days, 7 days of backdating, up to **60 days ahead**, guardian-only.

  (b) Should one holiday pause set by the guardian cover both the learning streak and the chore streak (D.2), or should chores keep their own pause? (c) Is the 2-coin cap on a family-contribution chore acceptable?
- **Default:** Separate bounds as listed. **The two lanes disagree on how far ahead a pause may start (120 vs 60 days).** The source does not say whether one pause covers both streaks today. The 2-coin cap applies.
- **Alternative:** One shared pause with a single set of bounds, or other values.
- **Source:** S07.3, S05.3e

**H-12: The under-13 savings-bonus ratio**
- **Question:** Should the under-13 fixed ratio (1 coin per 10 saved) stay the same for the whole platform, recalibrated only through the threshold log, or may a Tutor choose a different fixed ratio?
- **Default:** Platform-wide, and not a per-family setting.
- **Alternative:** Let the Tutor choose.
- **Source:** S07.3

**H-13: The savings bonus after its Tutor steps away**
- **Question:** Should the weekly savings bonus keep paying after the Tutor who set it steps away?
- **Default:** It keeps paying, as it did before S07.3. Any change to the rule then needs a current Tutor.
- **Alternative:** Stop it when its Tutor steps away.
- **Source:** S07.3

**H-14: Age-register cutoffs, and what "unknown age" means**
- **Question:** (a) The register cutoffs are 10 (transition) and 13 (teen). An 18-year-old still in a family reads the teen register. (b) A learner or child with no known age or birth date gets the youngest treatment everywhere: the young register, the younger savings-bonus framing (1 per 10), and the youngest lesson register. Confirm these, or set others for Product review?
- **Default:** As described.
- **Alternative:** Other cutoffs, or another unknown-age rule.
- **Source:** S07.6, S07.3, S05.3f

**H-15: Teen wording for shared child screens**
- **Question:** Should the child screens that are neutral about register (MyLevel, ChoreStreak, RewardAsk and others) get their own teen-register wording?
- **Default:** One copy set, written to the ages 6–9 budget.
- **Alternative:** Add teen wording.
- **Source:** S07.6

**H-16: The "Digital Banking" section name**
- **Question:** Should "Digital Banking" / "Banca Digital" / "Banco Digital" stay as the section name?
- **Default:** Kept, as the SPEC's name, now paired with a practice-card statement and a coins-stay-in-the-app statement.
- **Alternative:** Rename it.
- **Source:** S07.6

**H-17: Moving plain-Save coins into a goal**
- **Question:** Should coins in plain Save, including savings-bonus coins, ever be movable into a goal?
- **Default:** No path exists, so bonus coins never count toward a goal.
- **Alternative:** Allow it. The new progress split would then show those coins separately as bonus.
- **Source:** S07.4

**H-18: A family default split suggested by the Tutor**
- **Question:** The usual split belongs to the child: the Tutor can see it but not set it. Should a Tutor be able to suggest a family default split?
- **Default:** No suggestion feature.
- **Alternative:** Let the Tutor suggest one.
- **Source:** S07.4

**H-19: A child proposing a Share destination**
- **Question:** For a child in a family, only a Tutor can choose Share destinations. Should the child be able to propose one for the Tutor to accept?
- **Default:** Only the Tutor chooses.
- **Alternative:** The child proposes and the Tutor accepts.
- **Source:** S07.4

**H-20: Analytics consent for under-13s whose age came from the Tutor**
- **Question:** Should a Tutor's analytics consent admit a child whose under-13 status came from the Tutor's own birth-date entry?
- **Default:** No. That child is excluded from all optional analytics, including the Block D diagnostics.
- **Alternative:** Admit them with the Tutor's consent.
- **Source:** S07.4 (cross-lane H.1/A.2)

**H-21: Automatic step down a level**
- **Question:** Should the system move a child down a level on its own after three questioned items in 30 days?
- **Default:** Built, following the Appendix D demotion precedent.
- **Alternative:** Leave every step down to the Tutor.
- **Source:** S07.5

**H-22: Independence levels and thresholds**
- **Question:** Are these right?
  - Level 2 at age 8+, with 10 items approved in 60 days and at most 1 in 4 not approved.
  - Level 3 at age 12+, with 20 approved, at most 1 in 5 not approved, and 28 days on Level 2.
  - Pre-approval caps of 20 and 100 coins.
  - Self-logging up to 100 coins on Level 3.
- **Default:** As listed.
- **Alternative:** Other values.
- **Source:** S07.5

**H-23: Letting the child counter-propose after a "not yet"**
- **Question:** Should the child be able to make a structured counter-proposal to a "not yet" (the negotiation surface in Appendix G §4.4)?
- **Default:** Not built. Today the child's voice is their reason on each request, their ask for a level, and "Let's talk".
- **Alternative:** Build the counter-proposal.
- **Source:** S07.5

**H-24: Taking coins back when a Tutor questions an item**
- **Question:** When a Tutor questions an item the child logged on their own, should the coins be taken back automatically?
- **Default:** No. The Tutor uses the audited coin correction.
- **Alternative:** Take them back automatically.
- **Source:** S07.5

**H-25: Research consent at 18**
- **Question:** Should research consent lapse at 18, with re-consent requested from the new adult, or carry over?
- **Default:** It lapses at 18, and re-consent is requested.
- **Alternative:** It carries over.
- **Source:** S07.7

**H-26: Entry age for the Real-World Bridge**
- **Question:** Is 15 the right entry age for the Real-World Bridge ("Beyond the app")?
- **Default:** 15 (`MONEY_BRIDGE_MIN_AGE=15`, recorded in the threshold log).
- **Alternative:** Another age.
- **Source:** S07.7

**H-27: New public FAQ answers**
- **Question:** Are the new FAQ answers ("Does it teach credit, debt or investing?" and "How long do you keep chores, rewards and decisions?") acceptable as the published statement to parents, or should Legal also carry them into the Privacy Notice?
- **Default:** Published in the FAQ only.
- **Alternative:** Legal also adds them to the Privacy Notice.
- **Source:** S07.8

---

## 7. Profiles, social and sharing

See also D-07 and D-08 (share-link cutover and sweep), D-11 to D-16 (deletion and retention) and D-19 (adult requests to teens).

**S-01: The company name on shared achievement pictures**
- **Question:** The shared picture still shows the LittleFounders name, and the disclosure says so. Keep the name, or make the picture brand-free?
- **Default:** Keep the name.
- **Alternative:** A brand-free picture.
- **Source:** S08.4

**S-02: Goal titles that could identify a child**
- **Question:** When a reached goal's title contains identifying text (a school, a handle, a phone number, a place, a birth year), the picture uses a generic label such as "Saved 50 coins for a goal". Keep that, or refuse the share and ask the Tutor to rename the goal?
- **Default:** Use the generic label.
- **Alternative:** Refuse the share and ask for a rename.
- **Source:** S08.8

**S-03: Public profiles for 16- and 17-year-olds**
- **Question:** May a 16- or 17-year-old choose a discoverable (public) profile?
- **Default:** Teens are always private, with no control to change it.
- **Alternative:** Let 16–17-year-olds opt in.
- **Source:** S08.6, S08.8

**S-04: Storing a birth month so teens move up at 18**
- **Question:** The age screen stores an age band, not a date. A declared teen stays in the teen tier until verified adult ID or a staff correction. Should the age screen keep a birth month so the tier updates at 18?
- **Default:** Band only. There is no automatic change at 18.
- **Alternative:** Also store a birth month.
- **Source:** S08.6, S08.8

**S-05: A guardian linking to a self-registered teen**
- **Question:** Should a verified guardian link move a self-registered teen into the guardian tier?
- **Default:** No. The teen keeps deciding, and the guardian sees the teen's full profile.
- **Alternative:** Move the teen into the guardian tier.
- **Source:** S08.6, S08.8

**S-06: Changing a child's flagged username**
- **Question:** Should we build a way for a guardian to change the username of a child whose existing handle is flagged?
- **Default:** Only support can change it, because the child's sign-in address is derived from the username.
- **Alternative:** Build the guardian-initiated change.
- **Source:** S08.6

**S-07: Follower and following counts**
- **Question:** Confirm removing follower and following counts, rather than making them opt-in.
- **Default:** Removed.
- **Alternative:** Opt-in counts.
- **Source:** S08.6

**S-08: Future messaging-like features for teens without a guardian**
- **Question:** If a future feature is close to messaging, what replaces guardian notice for a teen with no linked guardian who wants to turn it on?
- **Default:** Such a teen cannot turn it on.
- **Alternative:** Another safeguard in place of guardian notice. The source names none.
- **Source:** S08.7, S08.8

---

## 8. Design system and visual assets

**V-01: The Mentor avatars (the first asset family): style, pose and background**
- **Question:** (a) Approve or reject the style of the 8 Mentor avatar drafts. They use the pose `ambient.idle`, lit by the stage's own lights, framed head and shoulders, with Zara framed at 0.42 of her height. The files are in `frontend/public/rebuild/mentor-avatars/*.png`. (b) May we render transparent-background avatars of Dr. Rho, Zara, Liruf and Dina, in light and dark, from the real models, locally and at no cost? Today the avatar slot uses a draft square still of Dina with the Diorama behind her, and Bible 02 §9.7 asks for transparent slots. (c) Which catalogue pose should they use?
- **Default:** The drafts use `ambient.idle`. **However, S03.1 proposed `think.wait`**, so the pose is not settled.
- **Alternative:** Another pose, or other framing or lighting.
- **Source:** S03.1, S03.3

**V-02: Style of the other first-family assets**
- **Question:** Approve or reject the style of:
  - the in-house medal SVG (the first asset of the badges family);
  - the course coin, save jar, spend bag, share heart and empty-state flag art. They are shown on the component catalogue at `/rebuild.html?screen=system`.
- **Default:** The drafts as shown, pending your approval.
- **Alternative:** Reject, with direction.
- **Source:** S03.3, S03.8

**V-03: Date entry**
- **Question:** Generic date fields use the browser's native date picker, whose format follows the device's locale, not the page language. For example, an es-MX page in an en-US browser shows 09/24/2026. Keep the native picker, or use the three-field day/month/year pattern already on the age screen for every date?
- **Default:** The native picker in general. Three fields on the age screen.
- **Alternative:** Three fields everywhere.
- **Source:** S03.1

**V-04: Loading states, pending buttons and dark-mode depth**
- **Question:** Confirm:
  - (a) Loading placeholders do not shimmer.
  - (b) A pending button changes its label and shows no spinner.
  - (c) Dark mode shows no shadows and separates layers by surface color only.
- **Default:** As listed. (a) and (b) follow from the budget for idle motion.
- **Alternative:** Shimmer, spinners, or shadows in dark mode.
- **Source:** S03.1

**V-05: The dimmed backdrop behind dialogs (scrim)**
- **Question:** The scrim is the `ink` token at 66%, because the Bible's token block has no scrim token. Approve, or add a scrim token?
- **Default:** `ink` at 66%.
- **Alternative:** A dedicated scrim token.
- **Source:** S03.2 (proposal 6)

**V-06: Toast notifications**
- **Question:** At most three toasts at once, 6 seconds each. A toast with an action stays until dismissed. Approve?
- **Default:** As described.
- **Alternative:** Other limits.
- **Source:** S03.2 (proposal 7)

**V-07: Position of the Mentor tab**
- **Question:** The Mentor tab is second in the learner's navigation, following the mockup's order. Confirm?
- **Default:** Second.
- **Alternative:** Another position.
- **Source:** S03.2 (proposal 8)

**V-08: Console navigation on phones**
- **Question:** Consoles use a phone tab bar for up to five destinations, and switch to a full menu sheet beyond five. Approve?
- **Default:** As described.
- **Alternative:** Another pattern.
- **Source:** S03.2 (proposal 9)

**V-09: Reference sheets and the one-screen rules**
- **Question:** Can the reference sheets (the control catalogue, gallery index, overlays page and preview index) stay exempt from the one-screen proportion rules, as the reference exempts its system route?
- **Default:** Exempt.
- **Alternative:** Apply the rules to them.
- **Source:** S03.3 (proposal 12)

**V-10: The "breathing" call-to-action halo**
- **Question:** The breathing call to action draws a halo in its own color at 45%, fading over an 8 px spread in 2.6 s. The Bible fixes the period, not the spread. Approve or adjust?
- **Default:** As described.
- **Alternative:** Another spread or opacity.
- **Source:** S03.5 (proposal 13)

**V-11: Remembering that a moment was already celebrated**
- **Question:** A celebrated moment is remembered only for the browser session, so a second device may celebrate the same completion once more. Should "already celebrated" be stored on the server instead?
- **Default:** Per browser session (`sessionStorage`).
- **Alternative:** Store it on the server.
- **Source:** S03.5 (proposal 14)

**V-12: Confetti for lesson complete**
- **Question:** Build a confetti burst for lesson complete? It is permitted by Bible 02 §9.2, and it needs a motion asset and a 07 §7 review. Or keep the medal pop, rising tiles, count-up and bar fill only?
- **Default:** No confetti. The medal pop, rising tiles, count-up and bar fill only.
- **Alternative:** Build the confetti burst.
- **Source:** S03.5 (proposal 15)

**V-13: Keeping "Run" visible on phones**
- **Question:** On phones, the function-machine diagram gives up its spare height so the Run button stays in the first view, instead of making the shared segmented control smaller. Acceptable?
- **Default:** As described.
- **Alternative:** Make the segmented control smaller.
- **Source:** S03.5 (proposal 16)

**V-14: Emails in light mode only**
- **Question:** Should account emails stay light-only? The mail app, not the product, decides how a message is darkened, which conflicts with decision D2 ("both modes first-class").
- **Default:** Light-only.
- **Alternative:** Design for dark mode as well.
- **Source:** S03.8 (proposal 17)

**V-15: Copy length in emails**
- **Question:** Should emails follow the app's copy budget (the stricter option) or the website's?
- **Default:** The app budget.
- **Alternative:** The website budget.
- **Source:** S03.8 (proposal 18)

**V-16: Automating the "no text inside images" check**
- **Question:** May the lane add a text-recognition (OCR) dependency, for example tesseract.js, to automate the 07 §7 check that no raster art contains text?
- **Default:** Not added. The check is not automated.
- **Alternative:** Add the dependency.
- **Source:** S03.8

---

## 9. Operations

See also D-08 (scheduled jobs) and D-24 (the human panel).

**O-01: Branch protection for Mentor code**
- **Question:** Should `main` require the new `mentor-governance` CI job, plus a review, for changes under the governed Mentor folders? Only the owner can set this repository configuration.
- **Default:** Not enabled.
- **Alternative:** Enable it.
- **Source:** S06.9

**O-02: Named owners for two long-term initiatives**
- **Question:** The SPEC requires named owners within two quarters for the older-teen graduation initiative "Beyond the app" (D.19, Product) and the long-horizon research plan (D.22, Product/Research). Who are they?
- **Default:** None named. The repository has no owners for them.
- **Alternative:** Name them.
- **Source:** S07.7, S07.8

**O-03: The legacy `display_number` column**
- **Question:** Should the legacy `display_number` column be dropped in the wave-2 Banking cleanup (a contract migration), or kept for any internal use?
- **Default:** Kept until the wave-2 contract migration. The practice card no longer shows a number.
- **Alternative:** Keep it permanently.
- **Source:** S07.6

---

## Count

150 source questions, merged into **132 items**: Decide first 25 · Learning pathway 10 · Lessons, grading and rewards 13 · Forge content gates 9 · Mentor 21 · Family Hub and wallet 27 · Profiles, social and sharing 8 · Design system and visual assets 16 · Operations 3.
