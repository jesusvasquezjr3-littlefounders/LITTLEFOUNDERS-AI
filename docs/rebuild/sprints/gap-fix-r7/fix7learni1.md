# Gap-fix round 7, learning lane (fix7learni1)

Branch `codex/spec-fix7learni1`. Status: **implemented and locally verified; not accepted.** Nothing here was run against real learner data. The first release window is the baseline.

## Gap closed

**Half of the B.9 metric had no denominator.** Appendix C 1.1 defines "Decision Journal Coverage & Resurfacing Rate" as the "% of meaningful in-story choices that are recorded ... and of those, % later resurfaced". Appendix C 2.1 criterion 3 ("Measured") needs both halves. The gap was real:

- `learning_narrative_metrics` (0127) returned only the journal's own rows: `journal_entries_recorded` and `journal_entries_resurfaced`.
- Its only reader, the Mentor-quality signal `learning.decision_journal`, reported resurfaced ÷ recorded.
- Nothing counted the story decisions learners made. The journal write is best-effort by design (it never costs a grade), so a lost entry was invisible.

SPEC clauses: Appendix C Part 1.1 (Decision Journal Coverage & Resurfacing Rate, diagnostic, no fixed target), Appendix C Part 2.1 criterion 3, B.9.

## What was built, and where

### Database

One migration, `0253_decision_journal_coverage.sql` (expand; the orchestrator renumbers at merge):

- `learning_story_decision_segment(segment)` classifies a lesson-document segment the way Core's `decisionJournal.ts` does:
  - a `story_branch` counts only when a node offers two or more choices;
  - a `dialogue_choice` counts when a turn offers two or more replies;
  - a `would_you_rather` always counts;
  - the three v2 story kinds always count.
- `learning_json_array` is a helper, so a malformed document counts nothing instead of raising.
- `learning_narrative_metrics` keeps every key it already returned and adds three:
  - `story_decisions_made`: distinct (learner, lesson, segment) story decisions graded in the window. It reads v1 `lesson_segment_attempts` against `lesson_documents`, plus v2 `lesson_v2_grade_receipts` joined to the segment type in the document version the receipt names. A replay counts once, and a decision graded on both engines counts once.
  - `story_decisions_journaled`: the decisions above that have a `learner_decision_journal` row for that learner, lesson and segment.
  - `story_decisions_without_consent`: decisions of learners for whom `learning.decision_journal` does not apply today. These are OD-9 migrated children without the specific consent, whose journal rows the consent trigger drops by design. They are reported apart and never counted as lost.
- All three functions are service-role only.

### Core

- `pedagogy/evaluationLoop.ts` reads the three new counts. They are optional, so an older database still reads the resurfacing half.
- `pedagogy/mentorQuality.ts`: the new `decisionJournalReading` builds the `learning.decision_journal` signal.
  - The value stays the resurfacing rate.
  - The breakdown adds `journal:coverage` (journaled ÷ made, sample = made) next to `journal:resurfacing`.
  - The detail carries the counts, the coverage and `coverageBaseline: 'release-1'`.
  - The signal reads `diagnostic` when either half has the minimum sample. A window where every write was lost therefore shows 0% coverage instead of "insufficient data".
  - The signal raises no anomaly, because Appendix C sets no target.
- `learningQuality.ts`: the staff report gains `decisionJournal`, with made, journaled, without consent, coverage, recorded, resurfaced, resurfacing rate and the `release-1` baseline. It is null until the migration is applied.

### Console

- `rebuild/learning/LearningQualityPanel.tsx` gains a "Story choice journal" block, with copy in EN, es-MX and pt-BR inside the component. It shows:
  - the coverage line;
  - the resurfacing line;
  - the without-consent count, when it is not zero;
  - the chip "Release 1 baseline. No target yet.";
  - a pending line before the migration is applied.
- `rebuild/staff/MentorQualityDashboard.tsx` lists the `learning.decision_journal` breakdown (coverage and resurfacing) with the baseline note. The signal label is now "Story choices kept and brought back", and `rebuild-staff.json` has the new keys in all three locales.

## Verified

- Native PostgreSQL 17.6: `database/scripts/verify-decision-journal-coverage-postgres.py` passed 8 checks over all 252 migrations, on the lane cluster (port 16210, stopped afterwards). It is registered in `learning-db-verify.mjs`, and that runner's self-test passes.
  - Six consented story decisions were seeded on both engines, with replays. Five went through `record_learner_decisions`. One would-you-rather was **deliberately left unjournaled**, and the metric returns made 6, journaled 5.
  - One migrated child without consent: the write was dropped and the decision was counted apart (1).
  - A one-choice story, a quiz, a v2 non-story kind and a malformed document count nothing.
  - A 40-day-old decision counts only in a 60-day window.
  - An empty window returns zeros.
  - The old keys are unchanged.
  - anon and authenticated are refused on all three functions.
- Unit tests:
  - Backend: `mentorQuality.test.ts` covers coverage next to resurfacing, all writes lost, the pre-migration database and the clamp. `learningQualityS053d.test.ts` covers the route: null before the migration, null on an older row, the full block, and no learner id.
  - Frontend: `LearningQualityPanel.test.tsx` covers the block, the empty window, the pending state and the Copy Budget in 3 locales. `MentorQuality.test.tsx` covers the breakdown labels and the baseline.
- Passing gates: `type-check` and `lint` in backend and frontend, the root `spec:check`, `secrets:check` and `check-i18n.sh`.

## Remaining

- The reading comes from real data only after release. The first release window becomes the baseline (Appendix C: diagnostic).
- Consent is evaluated at read time. A learner whose consent changed after the decision is classified by today's state, not by the state at grading time.
- `database/types/database.ts` does not list the two new helper functions. It is regenerated with `db:types` on a provisioned stack, never hand-edited. The metric's signature did not change.

## Owner questions

None blocking. Two defaults were applied:

- The coverage sits next to the resurfacing rate. The primary value of `learning.decision_journal` stays the resurfacing rate, as before.
- Decisions of learners without journal consent are excluded from the denominator and reported apart.
