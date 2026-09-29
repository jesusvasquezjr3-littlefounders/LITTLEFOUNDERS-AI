# GAP-FIX-R6 lane fix6learni0 (learning)

Branch `codex/spec-fix6learni0`. One audited gap. Status: implemented and locally verified. Not accepted, not released.

## Gap: v2 boards answered a correct step with a generic banner and gave no hint on a miss

SPEC clauses: B.20 (a correct answer gets "a banner naming what was done right"), Frontend Bible 02 §9.2 (correct is a success banner that names what happened, not yet is a warning banner with a hint), Appendix P Part 4.11, Appendix B §1.8 (all feedback, correct included, names a specific action or strategy; one requirement with B.26), B.23 (10-12: recognition tied to the specific skill shown).

Verified real before fixing. Every `GradedFoot` board showed `player.met` ("That works."). Six hand-written boards hard-coded `correct: 'Correct'`. CPA ("You found it."), decide-and-justify ("That choice works.") and growth comparison (`player.met`) were generic too. A miss showed "Not yet. Look again." or a structure/numbers variant, with no board-specific hint. The v2 contract had no field for authored feedback, and Forge gate 19 did not run on v2 documents.

### What was built

- **Contract (Core, browser, Forge).** Every v2 segment may carry an optional `feedback` object in the document's locale: `{ met?, not_yet? }`. Each field is 1 to 160 characters, the object is strict, and at least one field is required.
  - Canonical source: `backend/src/services/v2SegmentFamilies.ts` (`v2SegmentFeedback` in `v2SegmentExtras`). It is copied byte for byte to the browser and to Forge.
  - The concept-board contract (`v2ConceptBoards.ts`, plus its browser copy) has its own base and got the same field.
  - Core serves `feedback` with the segment. It never goes into `answer_keys`.
- **Authoring rules (`v2FeedbackProblems`, shared by Forge and Core):**
  - Feedback only on a server-graded step.
  - From age 10 (age band other than 6-9), every graded step needs `feedback.met`.
  - Answerless: the text may not show a number the step does not already show. Whole payload numbers also count in hundredths (minor units, basis points).
  - Core's `forge-v2:check` (`forgeV2Rows.ts`) runs these rules. It also refuses generic praise in `met` for ages 10 and up.
- **Register policy.** `isGenericPraise` now also counts a bare verdict as generic: Correct, That's right, That works, Correcto, Exacto, Así es, Eso funciona, Correto, Certo, Isso mesmo, Isso funciona. The change is in the canonical `learnerRegisterPolicy.ts` and synced to the browser and Forge copies.
- **Forge:**
  - The plan copy accepts per-market `feedback`, and the emitter puts it on the segment (`plan.ts`, `emit.ts`, `contract.ts`).
  - Gate 13 budgets both lines as body copy (`gates.ts`).
  - Gate 18's shame screen already reads `feedback*` keys.
  - Gate 19 now runs on v2 documents (`carriedGates.ts` `v2AgeRegisterGate`). It applies each register's lexicon, blocks praise that names nothing from age 10, and blocks when `v2FeedbackProblems` finds a problem. It is listed in `V2_MANIFEST_GATES`.
  - New red-team sample: `gate19-generic-praise.json`.
- **Fixture content.** 65 graded steps in the 10+ Forge fixture plans got authored `met` and `not_yet` in EN, es-MX and pt-BR. `emitted.json` and the preview fixtures were regenerated.
- **Rebuilt UI (`frontend/src/rebuild/learning/`):**
  - `namedFeedback.ts`: a named confirmation and a "Not yet." hint for each of the 38 graded board kinds, in 3 locales. Where the graded state is known it is filled in: tray total, count-up range, month, doubling years, shaded percent, parts and shaded count, placed fraction.
  - `segmentKit.verdictBannerText` and `GradedFoot`: the new `named` prop is required, so TypeScript refuses a board that omits it. `feedback={segment.feedback}` is passed through. The authored text wins over the named fallback.
  - Boards wired:
    - All `GradedFoot` boards: family, concept and build boards, place value, ratio table, percent grid, tax bracket, running ledger, savings rule, goal bullet.
    - The six hand-written boards: bar model, fraction area, fraction number line, function machine, schema diagram, worked example.
    - CPA fading, decide-and-justify and growth comparison.
    - Allocation and whole-number line already named the outcome; they now also honor authored feedback.
  - Retired the generic `player.met`, `review`, `reviewStructure` and `reviewAnswer` strings from `rebuild-learn.json` in all three locales.

### Verified (locally)

- Unit tests:
  - `backend/src/__tests__/v2SegmentFeedback.test.ts` (10 tests): the contract accepts good feedback and refuses bad feedback; Core delivers feedback outside the key; each authoring rule refuses its population (ungraded step, missing `met` at 10+, number leak, generic praise at 10+); isGenericPraise.
  - `coursegen/src/__tests__/v2CarriedGates.test.ts`: gate 19 on v2 (missing `met`, generic praise, number leak), gate 18 on feedback, the body budget.
  - `v2Emit.test.ts`: the red team now has 16 samples, each blocked on its own gate.
  - `frontend/src/rebuild/learning/namedFeedback.test.tsx` (5 tests):
    - Every kind and locale is in the body budget, not generic and not a retired line, has a "Not yet." hint, and has a unique `met`.
    - Static pin over every board source: each `GradedFoot` passes `named` and `feedback={segment.feedback}`, each banner reads `segment.feedback`, and no `correct: 'Correct'` is left.
    - `GradedFoot` precedence.
    - A lesson document carrying feedback end to end, and the browser refusing malformed feedback.
  - Updated expectations in `LessonDocumentView`, `boardReset`, `generalPlayer` and `DecisionReasonsBoard`.
- Commands:
  - Focused suites pass: backend v2, forge, learning signals and wellbeing (20 files); coursegen v2, gate, register and release (14 files); frontend learning and preview (all files touched).
  - `forge-v2:check`: 132 rows OK.
  - Also run: `type-check` and `lint` in backend, coursegen and frontend; root `spec:check`, `secrets:check`, `check-i18n.sh`.
- Pre-existing reds, not from this lane:
  - `copy-budget/learn.test.ts` does not budget the `course.exploreNote`, `exploreTitle` and `pickTitle` keys. It fails at the base commit.
  - `copy-budget/site.test.ts` also fails. It reads only site copy, which this lane does not touch.

### Open

- No browser look. The orchestrator's UI audit measures the rendered banners (text-fit and copy budget).
- Native-speaker review of the authored es-MX and pt-BR feedback and the named fallbacks.
- The answerless rule is numeric. A strategy-naming `met` can still hint at a choice in public data (for example a story choice), and the Stage 3 reviewer judges that. Authored fixture copy names the strategy, not the chosen option.
- Documents for ages 6 to 9 may omit `feedback`. Their boards use the named fallback. This is the conservative reading of "from age 10": the SPEC's generic-praise rule applies from the transition register.

### Owner question (default applied)

- Should `feedback.met` also be required for ages 6 to 9? Default applied: not required. The young register still accepts process praise (B.23), and the board's named confirmation always names the action.
