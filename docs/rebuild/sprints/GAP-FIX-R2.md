# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F2-learning

Branch `codex/spec-fix2learning`. Twelve audited SPEC gaps in the learning
area (items 11 and 12 were one gap, KaTeX notation). Each was checked in the
code first; all were real. Built under the project leader's speed mode (27
September 2026): complete features, lean verification, full gates at merge.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | B.7 part 3; Appendix P Part 1 (ages), Part 8; OD-16 | Core and the browser pinned the ratio table, waffle, donut and M3/M6/M7/M8/M9-10/M13/M15/L2/M19/M20/ledger to single pilot values and narrow ages; M5 accepted only totals 10-29 | One shared age-scope policy (`V2_AGE_SCOPE`, `v2AgeScopeProblem`, `v2PayloadScopeProblem` in the synced families module) that both contracts call: each kind open across its Appendix P range, the adult pathway where the money use applies (M9/M10, M14, $6, M15, M19, M20, ledger, donut, rule builder). Generic parameters: waffle totals that divide 100, donuts up to 40 wedges, local currency only for adults. M5 gains a three-place compose form and subtraction with borrows ($1.00 - $0.37), replayed in the canonical scorer and the board (hundreds as berry flats); L2 at 8-9 is a single IF | `backend/src/services/v2SegmentFamilies.ts`, `v2LessonDocument.ts`, `v2VisualScorer.ts`, `frontend/src/rebuild/learning/lessonDocument.ts`, `placeValueModel.ts`, `PlaceValueBoard.tsx`; fixtures 26-29 |
| 2 | B.7 part 1; Appendix A Part 1 | `SITUATIONAL_CHART_KINDS` lacked 13 learner-facing kinds | Candlestick, Marimekko, treemap, sunburst, icicle, box plot, connected scatter, bump, org chart, swimlane, Venn (counted), Ishikawa and mind map: data rules, Show-as-table rows, accessible facts, Appendix A subject/age gates and in-house SVG renderers (hue plus pattern) | `v2ChartModel.ts` (+ generated copy), `charts/TeachingChart.tsx`; fixtures 38-40 |
| 3 | Appendix C Stage 2; B.22, B.26, B.27; G.2 | v2 ran only gates 11-16; the 0209 manifest never required 17 or 18; gates 2-4 were v1-only | `carriedGates.ts` runs gates 2 (tier vocabulary, accent-aware), 3 (facts.yaml denominations for real-currency trays), 4 (worked steps and keys re-executed, change and unit prices), 17 and 18 (the v1 measurement code over the raw v2 document) inside `runV2DocumentGates`; `V2_MANIFEST_GATES` lists them; migration 0216 moves the v2 required gates into `forge_v2_manifest_gates` rows read by `publish_v2_lesson_version`, and the gate-parity tool keeps both lists equal | `coursegen/src/v2/carriedGates.ts`, `gates.ts`, `release.ts`, `agent/tools/check-forge-release-gate-parity.mjs`, red-team plans |
| 4 | Appendix P M8, $4, $8 | Payload income/spending only; rubric `schema: 'change'`; compare a dead distractor | Schema-neutral payload (two quantities, the unknown's label); private rubric names one of change/group/compare/ratio and the slot of each quantity; scorer grades schema (structure), slots (structure vs value) and an answer that must be a relation of the quantities; four-way picker and slot row (shared `SchemaSlotsVisual`) | `v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `SchemaDiagramBoard.tsx`, `pizarron/visuals.tsx`; fixtures 09, 30 |
| 5 | Appendix P L2, L6, $9, Part 4.6 | Fixed AND/OR choice; flowcharts walk-only | `logic.rule-builder.v2`: condition/action tiles, IF-THEN-ELSE, levels single/connective/nested by age, graded by behaviour on 5-10 hidden scenarios. Flowchart and spend-decision build mode (13+): the learner places question and outcome nodes; Core evaluates the tree on hidden cases (`operation.build-flowchart.v1`) | families, scorer, `buildBoards.tsx`; fixtures 32-35 |
| 6 | Appendix P $6, M14 | No comparator | `money.unit-price.v2`: 2-3 offers on the shared ratio lines, the unit always shown, exact rational unit prices within half a hundredth and the strictly cheapest offer | families, scorer, `buildBoards.tsx`; fixture 31 |
| 7 | Appendix P M1, Part 4.4 | Every run started at concrete | `cpaEntryStage` from primary-KC mastery and the last first-unaided stage; pinned on the run (`lesson_v2_runs.cpa_entry_stage`, 0215); skipped stages restore like attempted ones, are never graded (`CPA_STAGE_SKIPPED`); `entry_stage` rides the receipt | `courseLessonEvidence.ts`, `learn.ts`, `v2LessonDocument.ts` |
| 8 | Appendix P Part 8; Appendix C 1.4 | No parity, coverage, pre/post or A/B | Grade route takes the browser scorer's advisory verdict (never graded with) and stores `client_agree`; the browser reads answers with the canonical scorer on the one synced semantic payload (`v2ScorerPayload.ts`); `item_phase` and `variant` segment fields; a committed tap/locale coverage snapshot (`teaching-visual-coverage.mjs`, in spec:check); 0215 aggregates; staff panel section | `v2ScorerPayload.ts`, `learningQaSignals.ts`, `LearningQaSignals.tsx`, `LessonRoute.tsx` |
| 9 | Appendix C 1.3 | No B.1/B.2/B.4 signals, no defect escapes | Server-only events (placement commit ok/failed, prerequisite refused/passed, lesson update required, scorer parity miss), 0217 event CHECK and practice mapping, `learning_qa_rates`, `content_defect_escapes` with an audited recorder and a rate; staff entry form | `insights.ts`, `learn.ts`, `placement.ts`, `admin.ts`, 0217 |
| 10 | Appendix P M2, $2, L12 | No count-on, no count-up sequence, no cue ticks | Count-on hops on the whole-number line (graded as a hop sequence); making change records the count said after each coin, with `count_from_zero` diagnosed; message lists carry cues and Core stores cue hits beside d-prime | scorer, `NumberLineBoard.tsx`, `familyBoards.tsx`; fixtures 36-37 |
| 11-12 | Bible 05 §5; Appendix P Parts 5-6 | No KaTeX | katex 0.18.9 (MIT, pinned), loaded lazily by the shared `MathExpression`; worked steps may carry whitelisted TeX notation and a function machine may declare notation for the learner's rule (`visual.math-notation.v1` in all three copies); spokenText is the accessible name, pt-BR decimals render as `{,}`; the fraction-and-exponent worked example is the audit state (`workedexample?notation=1`) | `pizarron/MathExpression.tsx`, `WorkedExampleBoard.tsx`, `FunctionMachineBoard.tsx` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15810): `database/scripts/verify-learning-r2-postgres.py` applies all 217 migrations and passes 8 checks (widened receipt CHECK accepts and refuses; entry-stage column; the five 0215 aggregates; QA events and rates; audited defect escapes; the v2 manifest gate rows and function body).
- Core: `forge-v2:check` 120 rows, 210/210 graded segments pass the behaviour gate; focused vitest (lesson document, age scope, scorers, build scorers, chart model, learn route incl. parity and CPA entry, learning QA signals, placement, insights, quality); full `eslint .` clean; type-check clean.
- Forge: v2 emit, carried gates, release tests; every red-team plan blocks on its own gate; lint and type-check clean.
- Frontend: focused vitest (contracts, boards, charts, notation, lesson route, staff panel); lint of `src/rebuild` and the lesson route clean; type-check clean.
- Root: `spec:check`, `secrets:check`, i18n gate, `instruments:check`, gate-parity tool and its test.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Adult reach per kind.** The adult pathway opens only where Appendix P's money use applies to adults (listed above); fraction, place-value, bar-model, schema and function-machine representations stay child-only.
2. **Unit-price tolerance.** A typed unit price meets within half a hundredth of the exact rational value (a rounded cent); the key stores the exact rational.
3. **Count from zero is a review.** Right coins counted from zero are graded review with `count_from_zero` (the rule is to count up from the price).
4. **M1 entry thresholds.** pKnown < 0.6 concrete, < 0.85 pictorial, otherwise abstract; the last first-unaided stage can only raise the entry. Concrete when either read fails.
5. **Carried gate 3.** Only the market currency's facts.yaml denominations are accepted for real-currency trays; USD and BRL trays block until their facts are recorded.
6. **Gate 17 red team.** A v2 plan cannot carry a reward field, so the blocking case is proven on a raw document in a unit test; plans exercise its review path.
7. **KaTeX pre-render.** Forge does not pre-render TeX server-side (katex is a frontend dependency only); the browser renders lazily with the plain expression as fallback.
8. **QA events and consent.** The B.1/B.2/B.4 events ride the existing learning-quality practice and consent gate, so rates exclude learners without analytics consent.

### Migrations (renumbered by the orchestrator at merge)

- `0215_v2_learning_signals_r2.sql` (contract by classifier, widening in fact: apply before this Core release)
- `0216_v2_manifest_carried_gates.sql` (contract: after the Forge release that attests the carried gates)
- `0217_learning_qa_events.sql` (contract by classifier, widening in fact: apply before this Core release)

### What remains

- Browser matrices and `audit:rebuild` (text-fit, proportion and copy-budget over the new boards, charts and the notation state) at merge.
- Screenshots of the new boards were not taken in the lane.
- USD and BRL denomination facts for real-currency trays (gate 3).

### F2-learning-finish (lane close)

- Synced with `codex/spec-migration-s02` (already up to date, no conflicts).
- Adversarial pass over the 12 gaps: rebuilt UI imports only shared controls (no legacy component), every new component declares `data-copy-role`, new copy exists in en-US, es-MX and pt-BR, and the new admin routes sit behind `requireRole(admin)` plus `manage_content`.
- The full unit suites found two lane defects, now fixed: three class names without a stylesheet rule (`lf-chart-box--step`, `lf-math-katex`, `lf-math-fallback`; design-classes test) and a test helper typed too narrowly for the M8 slots answer (backend `type-check`).
- Final local gates: type-check, lint and full unit suite green in backend (3238 passed, 1 skipped), frontend (3065 passed) and coursegen (830 passed); database `npm test` 48 passed; root `spec:check`, `secrets:check`, `tools:test` and the i18n gate green.
- Status of every lane row: implemented and locally verified, not accepted, not released, not pushed.
