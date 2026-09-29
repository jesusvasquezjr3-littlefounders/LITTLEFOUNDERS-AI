# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F3-learning

Branch `codex/spec-fix3learning`. Eight audited SPEC gaps in the learning
area. Each was checked in the code first; all eight were real (the code
matched the audit's description). Built under the project leader's speed
mode (27 September 2026): complete features, lean verification, full gates at
merge.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | Appendix P Part 1 M7, Part 4.1 and 4.5; Bible 05 §4 (Build) and §7; B.7 part 3 | Comparison-only payload and rubric; the scorer refused any other model; the structure step was a two-option control that started on the only right answer; bars pre-drawn from the payload | Schema-neutral payload (the text's 2-3 quantities, the unknown's label); private rubric `{model: part-whole \| comparison, slots}`; the canonical scorer grades a complete build (structure on a wrong model or slot, value on a wrong answer), refuses a key whose lengths contradict themselves (`solveBarModel`), and Core refuses an answer key the structure does not reach. The board starts empty: the learner adds one bar in parts or two bars to compare, adds a part or the total bracket, and fills each slot from a picker (Tab through slots, Enter or ArrowDown opens it); the unknown is a dashed "?" segment; lengths follow the quantities placed; the arithmetic step draws the learner's met build. Behaviour gate: empty `initial`, every build of both models enumerated. Forge: plan 08 rewritten, part-whole plan 41 | `backend/src/services/v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `v2LessonDocument.ts`, `v2ScorerPayload.ts`, `forgeV2Behaviour.ts`; `frontend/src/rebuild/learning/BarModelBoard.tsx`, `pizarron/visuals.tsx`; `coursegen/src/v2/fixtures/plans/08-v2-bar-model.json`, `41-v2-bar-model-part-whole.json`; `frontend/scripts/verify-rebuild-bar-model.mjs` |
| 2 | B.8 (and OD-15); OD-19; Bible 08 §11 | `mentor_stage` optional; the projection and the preference read only ran when it was declared | `projectV2MentorStage` always projects the learner's character (catalog default) on `mentor_stage.scene`, else `adventure_scene_id`, else the catalog's first scene; the route reads preferences for every v2 document (a failed read still omits the stage, §1.14); Forge gate 15 blocks a document whose stage scene is not an approved scene | `v2LessonDocument.ts`, `routes/learn.ts`, `coursegen/src/v2/gates.ts` |
| 3 | Bible 08 §11; B.8 | The adventure scene was a separate 160 px stripe in a wrapper, so the `:has(> .lf-mentor-band)` side column never applied and phone bands could exceed their caps | The scene is the backdrop inside the one band (`MentorStage` `backdrop`); the band is the slot's single element; with no stage the scene keeps the band class contract and register height; the stripe classes are gone. Screenshot check: teen phone band 80 px of 740 with the scene on both sides of the Mentor; desktop side column 4/12 with the scene as its top strip. The compact-stage audit gains theme states per register (30/25/15%, answers in the first view, band as direct child) | `learning/lessonStage.tsx`, `CompactMentorStage.tsx`, `mentor/MentorStage.tsx`, `learning/mentorStage.css`, `AllocationBoard.tsx`, `scripts/verify-compact-stage.mjs` |
| 4 | B.8, B.18; Appendix P Part 5; OD-24 | `audio_ref` resolved nowhere; boards rendered only the text line | Core returns `narration_audio` (segment id -> public URL) for ungraded Mentor-voiced segments whose differentiated `audio_ref` Echo's manifest holds; the browser re-checks the map; Mentor turns and episodes offer Listen through the lesson's one narration channel (never autoplay, silent with the sound off switch, one line at a time, stops on leaving the segment, plate as caption); no resolvable audio = text-only plate. Forge release flags (`--audio-manifest`) or blocks (`--require-narration-audio`) a channel without an asset | `v2LessonDocument.ts` `v2NarrationAudio`, `routes/learn.ts`, `learning/lessonCue.ts`, `segmentKit.tsx` `NarrationControl`, `familyBoards.tsx`, `AuthenticatedLessonDocument.tsx`, `LessonRoute.tsx`, `coursegen/src/v2/release.ts`, `releaseCli.ts` |
| 5 | Appendix P Part 2 L1; Part 4.5 | Rubric only `must_flip_ids`; generic partial/miss/false_alarm | Private card roles (`p`, `not_p`, `q`, `not_q`, checked against `must_flip_ids`); codes `confirmation_bias` {P,Q}, `p_only_missing_not_q` {P}, `matching` {Q}, `not_p_checked` (any other set with not-P), `all_cards`; added to `V2_DIAGNOSTIC_CODES` (the grade-replay schema now reads that list; it had also lacked `count_from_zero`) and to the receipt CHECK (0228); the behaviour gate checks every role combination's code; plan 23 carries the roles; the staff learning-quality panel names the codes (three locales) | `v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `supabaseRest.ts`, `forgeV2Behaviour.ts`, `LearningQualityPanel.tsx`, `database/migrations/0228_v2_selection_task_diagnostics.sql` |
| 6 | Bible 02 D1, §7 rules 1 and 11; 05 §5 | `fitLabel` cut labels with "…" in 8-9 px SVG text | Every word label (categories, lanes, nodes, bones, point and link labels) is an HTML tag over the drawing at 14 px that wraps within its mark's room; after layout a label that does not fit (a word wider than its room, too many lines, outside the drawing, over another label) is hidden and the table carries it; SVG text is numerals only; `fitLabel` deleted from Core's model and its mirror; the in-page `boards()` audit measures `.lf-chart` and flags cut or sub-14 px chart labels | `learning/charts/TeachingChart.tsx`, `charts.css`, `backend/src/services/v2ChartModel.ts` (+ generated), `scripts/audits/in-page.mjs`, `rules.mjs` |
| 7 | Bible 02 D1, rule 1; 06 §4 | Offer skill list sliced to three plus "…" | Up to three skills inline plus a localized "and N more" that opens a Details sheet with the whole list | `learning/CourseView.tsx`, `rebuild-learn.json` (3 locales) |
| 8 | P-09; OD-22; D-06; OD-23 | `recordCourseLessonEvidence` ran unconditionally | Gated at its single entry point: nothing unless `COURSE_PATHWAY_ENGINE = pathway` and the new `COURSE_LESSON_EVIDENCE` switch is `on` (default `off`); the calibration it must pass is a row in `THRESHOLD-RECALIBRATION-LOG.md` | `backend/src/services/pedagogy/courseLessonEvidence.ts`, `config.ts`, `.env.example` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15910): `database/scripts/verify-learning-r3-postgres.py` applies all 228 migrations and passes 4 checks (the five selection codes and every older code accepted; unknown codes and malformed fields still refused; `learning_error_family_split` reports each code as an answer error on first tries; browsers read nothing). `database`: `check-migrations`, `check-migration-phase`, `check-family-lifecycle` and the phase/auto-apply node tests green (the `railway-migrate` test hung on this loaded machine, as in other lanes' runs; not touched by this lane).
- Core: `forge-v2:check` 123 rows, 216/216 graded segments pass the behaviour gate; focused vitest (v2 scorers, lesson documents, learn routes incl. mixed v2, stage and narration, Forge emitted rows, evidence gate, learning quality); `type-check` and `lint` clean; `governance:check` green.
- Forge: v2 emit, release (narration flag) and carried-gate tests; emitted fixture regenerated; `type-check` and `lint` clean.
- Frontend: every test under `src/rebuild` and the learn routes (149 files, 1,823 passed); focused runs before that (bar model build, reset, pending controls, lesson route M7 flow and resume, charts, board audit pin, general player narration, course offers, stage band, copy budget, recomposition); `type-check` and `lint` clean. Headless screenshots of the empty and built bar model at 375 px and of the stage band with an adventure theme at 375 (teen) and 1280.
- Root: `spec:check`, `secrets:check`, i18n gate.
- Not run here (orchestrator, per merge): browser matrices (`verify-rebuild-bar-model`, `verify-compact-stage` with its new theme states), `audit:rebuild`, full suites.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Narration never autoplays.** The learner presses Listen; this is the conservative reading of "never autoplay over the learner's own audio". The sound off switch hides the control.
2. **Selection-task codes are answer errors** in the structure-vs-answer split (a reasoning choice, not a wrong model); the names follow the audit's examples, with `not_p_checked` and `all_cards` added for the other named patterns.
3. **Course-lesson evidence calibration.** The switch is off; the proposed calibration (shadow-run agreement within 0.15 on 80% of topics with 20+ learners, reversal rate under 8%) is an engineering proposal for the two leads.
4. **Stage scene fallback.** A lesson scene outside the approved catalog stages the Mentor on the first catalog scene at runtime; Forge blocks such a document before publication.
5. **Bar-model bars without a number.** In a comparison a bar may carry no number (Ana's bar in "12 more than Leo; together 50"); part-whole slots and an added total must be filled.
6. **Tier 1 change record.** `courseLessonEvidence.ts` is classified Tier 2 (`mentor.runtime`) in the governance registry, so the gate needs no Tier 1 row; the switch itself is logged as a Tier 1 threshold in the recalibration log, pending both leads.

### Migrations (renumbered by the orchestrator at merge)

- `0228_v2_selection_task_diagnostics.sql` (contract by classifier, widening in fact: apply before the Core release that grades rule-checker rubrics with card roles)

### What remains

- The narration audio itself (a paid audiogen run, OD-23); until then every v2 plate is text-only.
- Browser matrices and `audit:rebuild` over the new bar-model build, the chart labels and the stage theme states. No chart screenshot was taken in the lane (no preview surface renders `visual.chart.v2` alone).
- The Mentor reading the new selection codes in its own decisions (the receipts carry them; the Mentor lane owns its use).
