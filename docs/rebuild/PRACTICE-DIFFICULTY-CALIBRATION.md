# Practice difficulty calibration and learning-quality thresholds

Status: proposal implemented as the default, 24 September 2026 (S05.3d). Owner: the Pedagogical Lead for the thresholds, Engineering for the mechanisms. Not accepted: product and pedagogical review are pending. Record: [S05 learning-experience sprint record](sprints/S05-LEARNING-EXPERIENCE.md#s053d-learning-quality-b12-b5-b15-b19).

This document is the written policy behind Product 10 B.19 (practice difficulty calibrated to a success band), and the Appendix C thresholds that S05.3d made enforceable for B.12 (judgment-quality signal) and B.5 (replay notice). Every number in it is a starting hypothesis to be recalibrated against real data (Appendix C, Stage 6), never a permanent constant.

## 1. What is measured

**First-try practice success, per lesson and per exercise family.** A practice attempt counts once: the first graded attempt of a segment in a run.

- **v1 lessons** (`lesson_segment_attempts`): `attempt_number = 1`. It is a success only when correct and unaided (`diagnostic_code` is null and the score is above 0). A first attempt after a hint counts as an attempt and is reported as *assisted*, never as a success. A retry that recovers is not a first try.
- **v2 lessons** (`lesson_v2_grade_receipts`): the earliest receipt of each segment in a run, grouped by segment type as the exercise family.
- **Not counted:** placement probes (they measure prior exposure, not practice), ungraded visuals, and lessons with no graded practice (B.4: no graded work, no score).

The metric is never a satisfaction or completion rate. A lesson that everyone finishes and enjoys at 98% first-try success is flagged, not celebrated.

## 2. The band

| Setting | Default | Where it lives | Guard rail |
|---|---|---|---|
| Target band | 70–85% first-try success | `practice_difficulty_bands` (row with no lesson) | Lower bound at least 50%, upper bound at most 95%, at least 5 points wide. Database CHECK, repeated by Core and the staff form. |
| Minimum evidence | 30 first attempts in a window | same row, `min_sample` | 10–100,000 |
| Per-lesson hypothesis | none until set | `practice_difficulty_bands` (row per lesson) | same guard rails |

The ceiling of 95% is the enforceable half of B.19's warning: no band can be set in the near-certain zone where practice stops building anything.

**The Mentor already aims inside the band.** The session planner targets a predicted success of 0.75 (`ZPD_TARGET` in `backend/src/services/pedagogy/sessionPlan.ts`). A test pins that target inside the default band, so the adaptive side cannot drift out of it without a failing test.

## 3. When a lesson needs a calibration review

A lesson opens one review when it is outside its band, in the same direction, in **two consecutive 28-day windows**, with at least the minimum evidence in both. One noisy window never opens a review. A lesson has at most one open review, and after a decision it cannot reopen for one window (the cooldown).

`sync_practice_difficulty_reviews` opens reviews. This stack has no scheduler, so the staff panel catches reviews up when it opens ("Check for reviews"), and the call is idempotent. A nightly job can call the same function later without any change.

## 4. What the content team decides

Each review is resolved once, by a staff member holding `manage_content` (or a superadmin), with a note of at least 10 characters:

| Decision | Allowed when | Effect |
|---|---|---|
| Make harder | the lesson is above its band (too easy) | recorded; the content change goes through Forge and moderation as usual |
| Make easier | the lesson is below its band (too hard) | recorded; same |
| Adjust band | always | sets the lesson's own band within the guard rails, logged with the review id |
| Keep as is | always | recorded with its reason |

A decision that would push a lesson further out of its band ("make easier" on a too-easy lesson) is refused by the database. Every decision and every band change writes an audit log entry with the verified staff actor.

## 5. The Threshold Recalibration Log

The machine-checked log of record is now [`docs/operations/BLOCK-B-THRESHOLD-LOG.md`](../operations/BLOCK-B-THRESHOLD-LOG.md) (GAP-FIX-R6): it holds these values with their constants, a review due date and the review history, and `agent/tools/check-block-b-thresholds.mjs` fails when they drift. This table is the initial record.

Appendix C asks for a living record of every threshold, when it was last reviewed and what changed. S05.3d keeps it in two places:

- **The band history is data:** `practice_difficulty_band_log` is append-only (a trigger refuses updates and deletes). Each row keeps the previous and the new band, the rationale, the review it came from and the actor.
- **The thresholds below are the reviewed list.** Cadence: quarterly for the first year, then per major release (Appendix C, proposed). The staff panel flags the default band when it was last set more than 90 days ago.

| Threshold | Value | Requirement | Enforced by | Status | Last reviewed |
|---|---|---|---|---|---|
| Practice success band | 70–85% | B.19 | `practice_difficulty_bands` default row | Proposed, pending calibration | 24 Sep 2026 |
| Band guard rails | 50–95%, at least 5 points wide | B.19 | CHECK `practice_difficulty_bands_guard_rails`; Core `bandWithinGuardRails` | Proposed, pending calibration | 24 Sep 2026 |
| Minimum evidence per window | 30 first attempts | B.19 | `min_sample` | Proposed, pending calibration | 24 Sep 2026 |
| Review trigger | 2 consecutive 28-day windows, same direction | B.19 | `sync_practice_difficulty_reviews` | Proposed, pending calibration | 24 Sep 2026 |
| Mentor target | 0.75 predicted success | B.19 | `ZPD_TARGET`, pinned inside the band by test | Proposed, pending calibration | 24 Sep 2026 |
| Judgment divergence floor | at least 10% of judged answers diverge from correctness | B.12 | Core `classifyJudgmentSignal` | Proposed, pending calibration | 24 Sep 2026 |
| Judgment minimum evidence | 30 judged answers | B.12 | same | Proposed, pending calibration | 24 Sep 2026 |
| Replay notice display rate | 100% | B.5 | `learning_replay_notice_display_rate`; panel flags any shortfall | Appendix C target | 24 Sep 2026 |
| Band review cadence | 90 days | Appendix C | panel `reviewDue` flag | Proposed, pending calibration | 24 Sep 2026 |

## 6. The reasoning signal (B.12)

The `reasoning.decide-justify.v2` family grades two things from one signed attempt: the decision (the 0/100 verdict, which alone decides completion) and the reason given for it (a judgment quality: sound, partial or unsupported). The judgment never changes the score, completion or XP.

Authoring rules, enforced when a lesson version is validated and again at grading:

- At least one offered decision is not acceptable, so a decision can be wrong.
- Every offered reason is classified, and the reasons include at least one sound and one unsupported option, so a reason can disagree with the decision.
- The rubric (which decision is acceptable, how each reason is judged) lives only in the private answer key. The public document carries labels only.

If judged answers almost never diverge from correctness (below the floor in §5), the signal is measuring nothing new, and the lesson's reasoning items go to pedagogical review (Appendix C, Stage 3). The staff panel shows this per lesson as "Tracks correctness only".

## 7. The replay notice (B.5)

Core writes the replay facts into every completion receipt: whether this is a first run, a retry or a replay, the kept best before the run, and whether the kept best was unaffected (`notice: best_kept`). The result screen states "Your saved best is still X%. This was practice." whenever that notice is set. XP follows one rule, unchanged since the atomic completion and now stated in the receipt (`xp_policy: improvement_only`): a run pays XP only above what the lesson has already paid, and never lowers the best score or XP.

The display rate divides the client's `replay_notice_view` by Core's own `replay_below_best`. Both ride the same consent gate, so they are dropped for the same learners. Only Core can write the denominator: the events ingest drops a client-sent `replay_below_best`.

## 8. What this policy does not do

- It does not change content by itself. "Make harder" and "make easier" are recorded decisions; the lesson change still goes through Forge and moderation.
- It never shows a learner their calibration status or compares learners. The report carries lesson ids and counts, never a learner id.
- It does not tune the Mentor's controller from the band automatically. The target is pinned by test; an automatic loop would need its own review.
