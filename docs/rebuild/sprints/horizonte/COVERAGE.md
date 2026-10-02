# Horizonte Visual: coverage of the 52 pieces

This table lists every Horizonte Visual piece (F0.1 to F4.9), the Core segment types it registers, its answer shape, its age scope, the catalogue entries it covers and an honest implementation status. It is read from the source, not from the plan: segment types come from the per-pack capability literals that Core spreads into its capabilities map (`HORIZONTE_CAPABILITIES`, the `*_CAPABILITIES` literals held in parity with the browser and Forge copies by `agent/tools/check-v2-lesson-capability-parity.mjs`), age scopes from each pack `contract.ts`, catalogue entries from the piece specs (`node C:/lf-wt/hz-specs/piece.js <id>`) and status from the lane docs in this folder.

Written 2026-10-02 on branch `feat/horizonte-visual`. Counts in the tool snapshot below are produced by `node agent/tools/teaching-visual-coverage.mjs` and pinned by its `--check` and its test.

## How to read the status

- **implemented**: built in every layer the piece needs (Core model and scorer, browser board, Forge guidance and gate, three-locale copy, fixtures and tests) and covering the catalogue entries it claims, as far as the lane docs say.
- **partial**: built, but a catalogue entry the piece claims, or a part of the piece itself, is not built. The note names it.
- **missing**: nothing built. No piece is in this state.

Status count: 43 implemented, 9 partial, 0 missing.

**Implemented is not accepted and not released.** Every status below means "built and locally tested with focused checks". No piece has product acceptance, a requirement row closed, or a release. The only real-browser look at any board is a headless Chrome render of the 19 `com` fixtures at 900 and 390 px (no drag, no screen reader, no device). Everywhere else the 64 px hit size, text fit, drag on touch, reduced motion, spoken text and the declared chunk budgets are unmeasured: the harness runs in jsdom, which has no layout.

## The 52 pieces

Catalogue entries use the spec ids: `2:` is the 2D catalogue, `m:` the math catalogue, `3:` the top-25 3D list. The catalogue files are the owner's and live in `C:/lf-wt/hz-specs`, not in this repository, so entries are cited by id. Ages are the Core `contract.ts` scope; a trailing `+` means the adult pathway is allowed.

| Id | Piece | Pack | Segment types (Core capabilities map) | Answer shape | Ages | Catalogue entries covered | Status |
|---|---|---|---|---|---|---|---|
| F0.1 | Per-board lazy loading | base | none | none (no contract change) | n/a | none | **implemented**: Every board is a `React.lazy` chunk behind one registry (`horizonte/registry.tsx`, `boardTypes.ts`); each declares a chunk budget. No production build has measured any budget. |
| F0.2 | Plano primitive | plano | none | none (primitive; boards own their answer) | n/a | 2:T02 | **implemented**: Shared SVG plane with handles, points, polylines and regions. Model and component tests only; no browser, screen reader or touch check. Not a pack: it has no segment type. |
| F0.3 | New answer shapes | base | none | defines `number.tolerance`, `points.set`, `curve.parameters`, `arrangement.slots` | n/a | none | **implemented**: One pure module (`v2AnswerShapes.ts`) with byte copies in the browser and Forge (`sync-v2-answer-shapes.mjs`). No UI of its own. alg2 adds a fifth, `expression`, inside its own scorer; it is not in the shared registry. |
| F0.4 | Solvability checker in Forge | base | none | none (Forge gate) | n/a | none | **partial**: Engine, built-in checkers and 21 of the 64 pack types (alg1, com, fin1 except `money.rate-return.v2`, fin2, solids, space1, space2 except the AR pilot) register a checker. The other 11 packs rely on the gate-4 function inside their own Forge pack file. |
| F0.5 | Per-piece quality harness | base | none | none (shared tests) | n/a | none | **implemented**: `assertScorerContract` (Core), `assertBoardContract` and `fixtureCoverage.test.tsx` (browser), `audit.json` per pack. jsdom cannot measure layout, so hit size is a declared attribute plus a CSS rule, not a measurement. |
| F1.0 | Twelve reading charts | charts (Core chart model) | `visual.chart.v2` | none (display; graded charts use a choice id) | 10+ for 6 kinds, 13+ for 6 kinds | 2:A12, 2:A13, 2:D04, 2:C20, 2:N12, 2:N27, 2:K01, 2:C02, 2:C04, 2:F10, 2:D10, 2:D07 | **implemented**: 12 kinds join the closed chart schema (58 in total). Forge emits all 12 in three locales. Timeline is gated 10+ where the catalogue said 6-9. No visual pass in a real browser. |
| F1.1 | Ten frame and double ten frame | golden | `math.ten-frame.v2` | `{ counts: number[] }`, integer per frame | 6-9 | m:A03, m:A04 | **implemented**: Ten frame and double frame in one type. 64 px hit size not measured in a browser. |
| F1.2 | Rekenrek and abacus | num-a | `math.rekenrek.v2`, `math.abacus.v2` | rekenrek `{ beads: [row1, row2] }`; abacus `{ digits: number[] }` | rekenrek 6-9; abacus 6-12 | m:A05, m:A06 | **implemented** |
| F1.3 | Empty and zoomable number line | num-a | `math.number-line.empty.v2`, `math.number-line.zoom.v2` | empty `{ jumps: number[] }`; zoom `{ units: number }` | number-line.empty 6-12; number-line.zoom 10-12 | m:A12, m:A13, m:C14, 2:T03 | **partial**: Jump drawing and zoom-and-place are built. Ordering several numbers on the line (the "order close decimals" rows) is not: it needs a second answer shape. |
| F1.4 | Arrays and area model (multiply and divide) | num-b | `math.array-area.v2` | `{ value: string }` plus scaffold fields | 8-12 | m:B09, m:B10, m:B19, 2:T14 | **implemented**: Array, multiplication box and missing-area division. Area model and division are 10-12 only (Forge gate). |
| F1.5 | Double number line and ratio tape | num-b | `math.ratio-line.v2` | `{ value: string }` plus scaffold fields | 10-12 | m:C19, m:C21 | **implemented**: Tape box-value self-check is not graded. |
| F1.6 | Fraction wall and operations | num-b | `math.fraction-wall.v2` | `{ n, d }`, whole numbers on a grid | 8-12 | m:C03, m:C08, m:C09, m:C10, 2:Q15, 2:T13 | **partial**: Wall, bars, product and measure visuals are built (add, subtract, multiply, divide are 10-12 only). There is no circular fraction visual (the fraction-circles row). |
| F1.7 | Clock, ruler and pan balance | num-a | `math.clock.v2`, `math.ruler.v2`, `math.pan-balance.v2` | clock `{ minutes }`; ruler `{ end }`; pan balance `{ pans: number[] }` | 6-12 | m:A23, m:A25, m:A26 | **partial**: The ruler stretches a bar the learner builds; the measure-a-given-object mode is not built (needs a second answer shape). |
| F1.8 | Equation balance | balance | `math.equation-balance.v2` | `{ steps: RouteOp[], answer: string }` | 10-14 | m:D01, 2:T18 | **implemented** |
| F1.9 | Linked table, graph and equation | plane1 | `alg.slope-triangle.v2`, `alg.rate-of-change.v2`, `alg.linked-views.v2` | integer on a grid | slope-triangle 13-17; rate-of-change 13-17; linked-views 12-17 | m:D15, m:D16, m:D18 | **implemented**: Rate axes are generic ("Step", "Value"); authored axis names need a new contract version. |
| F1.10 | Compound interest: predict, slide, reveal | fin1 | `money.compound-interest.v2` | `{ predict, rate, years, explain? }` | 10-17+ | 2:N10 | **implemented**: Generic `$`; names no product or bank. |
| F1.11 | Break-even and cost structure | plane1 | `fin.break-even.v2`, `fin.cost-structure.v2`, `fin.margin-markup.v2` | integer on a grid | 12-17+ | 2:N08, m:N09, m:N28, m:N10 | **implemented** |
| F1.12 | Supply and demand with shifts | plane1 | `econ.market-shift.v2`, `econ.elasticity.v2` | market shift: choice plus grid integer; elasticity: grid integer | 13-17+ | 2:N09, m:N13 | **implemented**: Demand is a straight line; kinked demand and cross elasticity are out of scope. |
| F1.13 | Mean as balance point and dot plot | stats1 | `stats.dot-plot.v2`, `stats.balance-point.v2` | dot plot `{ dots: number[] }`; balance point `{ pivot }` | 10-14 | m:H06, m:H03, m:H07, 2:C06 | **implemented**: Dot axes 0-100, 4-20 steps. |
| F1.14 | Normal and binomial with sliders | stats1 | `stats.normal.v2`, `stats.binomial.v2`, `stats.clt.v2` | normal `{ mean, sd }`; binomial `{ n, pct }`; mean of draws `{ n }` | 14-17+ | m:H22, m:H23, m:H25 | **implemented**: The mean of draws is exact (convolution), not a simulation the learner watches build up. |
| F1.15 | Visual proofs and cut-and-rearrange | balance | `math.visual-proof.v2` | `{ choice, value }` | 10-15 | m:E43, m:E44, m:E23, m:E24, m:E25, m:E26, m:E27 | **implemented**: The Pythagoras visual is a dissection into two squares, not a rotation proof of the general case, and is offered 13-15 only. |
| F2.1 | Algebra tiles and zero pairs | alg1 | `math.algebra-tiles.v2` | arrangement `{ slots: { mat, zero } }` | 11-15 | m:D02, m:B27 | **implemented**: Six tile classes, at most 24 tiles. |
| F2.2 | Cards to isolate the unknown | alg1 | `math.algebra-cards.v2` | arrangement `{ slots: { left, right, bin, tray } }` | 10-14 | m:D06 | **implemented**: Additive moves only; cards never merge. |
| F2.3 | Area model: expand, factor, complete the square | alg1 | `math.area-model.v2` | arrangement `{ slots: { tray, cells, edges, square } }` | 13-17 | m:D09, m:D10, m:D11 | **implemented**: Degree up to 2, coefficients up to 99. |
| F2.4 | Function with sliders and transformations | alg2 | `math.function-graph.v2` | `{ family, params }` (curve parameters) | 12-17 | m:D14, m:D27, m:D12, 2:T01 | **implemented**: Line, parabola and exponential. Tolerances and `by: curve` exist in Core but Forge does not author them. |
| F2.5 | Systems of equations on a graph | alg2 | `math.line-system.v2` | `{ points }` (point set) | 13-17 | m:D19 | **implemented** |
| F2.6 | Equation editor and equivalence checker | alg2 | `math.expression-editor.v2` | `{ steps: string[] }` (expression) | 13-17+ | m:D42, m:D43, m:D04, m:D05 | **implemented**: One variable, bounded grammar. A decimal comma is not accepted in es-MX and pt-BR. |
| F2.7 | Geoboard and area by squares | geom2 | `math.geoboard.v2`, `math.area-squares.v2` | `{ points: { x, y }[] }` (point set) | 8-12 | m:E02, m:E22 | **implemented** |
| F2.8 | Tessellations, symmetry and transformations | geom2 | `math.transform.v2`, `math.tessellation.v2` | `{ points: { x, y }[] }` (point set) | 8-15 | m:E06, m:E07, m:E09, m:E10 | **partial**: Reflection, rotation, translation and dilation are built. The lane doc offers the dilation and bump-tile fixtures at 13-17, wider than the 8-15 contract scope shown here. Tessellations are translation-only, so Escher-style tiles that need a turn or flip are not expressible. |
| F2.9 | Probability tree and Bayes | prob | `prob.tree.v2`, `prob.bayes.v2` | tree: arrangement of branch counts; Bayes: numeric text | 13-17+ | m:H14, m:H29 | **implemented**: Populations up to 10000; cells are very small past about 6700. |
| F2.10 | Interactive regression with residuals | prob | `prob.regression.v2` | curve parameters | 14-17+ | m:H11 | **implemented**: No fit statistics shown by design. |
| F2.11 | Time value of money and annuities | fin1 | `money.time-value.v2` | `{ slots, value? }` (arrangement plus number) | 14-17+ | m:N04, m:N05, m:N25 | **implemented** |
| F2.12 | Effective rate, credit card, NPV and IRR | fin1 | `money.rate-return.v2` | `{ value, final? }` (number with tolerance) | 15-17+ | m:N21, m:N22, m:N08 | **implemented**: No F0.4 checker is registered for this type. |
| F2.13 | Financial statement and cash flow | fin2 | `money.cash-flow.v2` | arrangement `{ slots }` | 13-17+ | 2:N19 | **implemented**: Whole units, no decimals. |
| F2.14 | Decision matrices | fin2 | `reasoning.decision-grid.v2` | arrangement `{ slots }` | 12-17+ | 2:N16, 2:N17, 2:N24, 2:Q20, 2:R08 | **implemented**: SWOT, Eisenhower, two-by-two, decision matrix and canvas; fixed block names. |
| F2.15 | Gantt, kanban and timeline | fin2 | `plan.schedule-board.v2` | arrangement `{ slots }` | 12-17+ | 2:F14, 2:O20 | **implemented**: At most 10 tasks. |
| F2.16 | Networks and counting | com | `math.network-count.v2` | arrangement `{ slots }` | 10-17+ | m:J01, m:J03, m:J08, m:J09 | **implemented**: Rendered in headless Chrome at 900 and 390 px (no drag, no screen reader). |
| F2.17 | Unit circle, secant and Riemann sum | com | `trig.unit-circle.v2`, `calculus.explorer.v2` | `{ predict, value? }` (choice plus grid integer) | 15-17+ | m:F02, m:F03, m:G04, m:G05, m:G10, m:G11 | **implemented**: Degree-3 polynomials with whole coefficients. Rendered in headless Chrome only. |
| F2.18 | Bits and logic gates | com | `computing.bits-gates.v2` | arrangement `{ slots }` | 10-17+ | m:J12, m:J21 | **implemented**: Rendered in headless Chrome only. |
| F3.0 | Seed protocol and attempt token | sim1 (with `backend/src/services/horizonte/seed`) | none | none (server seed: `attempt_seeds`, `retry_attempt_seed`) | n/a | none | **implemented**: HMAC seed derived from the verified attempt token (`horizonteAttemptSeed.ts`, reusing `LESSON_ATTEMPT_SECRET`), with a pure PRNG and protocol under `horizonte/seed`. `POST /v2-runs` returns `attempt_seeds` and `/grade` returns `retry_attempt_seed`. Deploy Core before the browser; Forge must not publish a seeded type until Core is live. |
| F3.1 | Simulated chance | sim1 | `math.chance-sim.v2`, `math.galton-sim.v2` | `{ seed, run length }` (server seed) | chance-sim 10-14; galton-sim 14-17+ | m:H18, m:H19, m:H20, m:H33 | **implemented**: Coin, die, spinner, Galton board and random walk. There is no separate running-average chart and no many-runs overlay for the walk. The staff preview cannot grade seeded segments. |
| F3.2 | Confidence intervals and resampling | sim1 | `stats.coverage-sim.v2`, `stats.bootstrap-sim.v2` | `{ seed, run length }` (server seed) | 16-17+ | m:H26, m:H28 | **implemented**: Coverage uses one fixed sample count (100 intervals). |
| F3.3 | Live a year or twenty with compressed time | sim2 | `money.life-sim.v2` | `{ seed, choice }` (server seed) | 13-17+ | m:N24, m:N30, m:H30 | **implemented**: Fixed counts (100 futures, 2 to 5 chapters, 3 to 8 choices). The chart clips the top 5 percent of values; the table has the real numbers. The staff preview cannot grade a seeded segment. |
| F4.1 | Solids engine | solids | `geometry.solid-viewer.v2` | `{ solid, count }` (choice plus number text) | 7-12 | 3:1 | **implemented**: Four solids. The lazy 3D chunk (the one WebGL board, OD-32) has never been loaded in a real WebGL context; the SVG fallback is tested in jsdom. |
| F4.2 | Foldable cube nets | solids | `geometry.cube-net.v2` | arrangement (slots `cell0..5` or `g{col}x{row}`) | 7-12 | 3:2, m:E29, m:E30 | **partial**: Cube nets in label and complete modes. Surface area is a display line, not a graded answer, and nets of other polyhedra are not built. |
| F4.3 | Cubes with counting and views | solids | `geometry.cube-stack.v2` | arrangement (slots `c{col}r{row}`) | 6-12 | 3:3, 3:6, 3:23, m:E31, m:E37 | **implemented** |
| F4.4 | Mental rotation | space1 | `geometry.mental-rotation.v2` | `{ pick, angle }` | 6-17+ | 3:4, m:E38 | **implemented**: One axis per question, at most 10 cubes. |
| F4.5 | Plane sections and Platonic solids | space1 | `geometry.solid-section.v2` | `{ pick }` or `{ value }` | 11-17+ | 3:5, 3:18, m:E35, m:E36, m:E33 | **partial**: Sections of the cube, tetrahedron and octahedron, Euler counts and square-pyramid volume. No cone volume, no cylinder sections, no Archimedean solids; the learner turns the solid but cannot drag the plane. |
| F4.6 | Market stall and scaled coin stacks | space1 | `money.market-stall.v2`, `money.coin-stack.v2` | stall: arrangement; stack: `{ value }` | market-stall 7-12; coin-stack 7-17+ | 3:7, 3:8 | **implemented**: Stall has at most 5 items. Stack thicknesses are teaching approximations (coin 2 mm, bill 0.1 mm). |
| F4.7 | Surfaces: compound interest and profit | space2 | `math.surface.v2` | `{ choice }` | 15-17+ | 3:9, 3:10, m:D44, m:G19, m:G20 | **partial**: Two money surfaces (compound interest, profit) on a grid with a slice slider. No free-form z = f(x, y), no partial derivatives or gradient, no gradient descent. |
| F4.8 | Globe with remittance and trade routes | space2 | `geography.globe-route.v2` | `{ choice }` | 12-17+ | 3:12 | **implemented**: Fixed 110 m coastline (no borders, no country labels) and a gazetteer of 16 places. Checked in jsdom only. |
| F4.9 | AR "see it on your table" pilot | space2 | `space.ar-table.v2` | none (ungraded: no rubric, scorer or key) | 13-17+ | 3:24 | **partial**: The always-shown turnable wireframe fallback and the default-off gate with age and consent checks are built. The WebXR session (`ar/arSession.ts`) has never run on a device. Legal and pediatric review is required before `VITE_HORIZONTE_AR_PILOT` is ever turned on. |

The 52 pieces claim 146 catalogue entries (each entry is claimed by one piece). Pieces without entries are foundations: F0.1, F0.3, F0.4, F0.5 and F3.0.

## Segment types by pack

Core registers 64 Horizonte segment types in 18 packs, on top of 48 older v2 types. Each of the 64 has a lazy board in the browser and a strict contract in Core (the coverage tool checks both).

| Pack | Types | Segment types |
|---|---|---|
| alg1 | 3 | `math.algebra-cards.v2`, `math.algebra-tiles.v2`, `math.area-model.v2` |
| alg2 | 3 | `math.expression-editor.v2`, `math.function-graph.v2`, `math.line-system.v2` |
| balance | 2 | `math.equation-balance.v2`, `math.visual-proof.v2` |
| com | 4 | `calculus.explorer.v2`, `computing.bits-gates.v2`, `math.network-count.v2`, `trig.unit-circle.v2` |
| fin1 | 3 | `money.compound-interest.v2`, `money.rate-return.v2`, `money.time-value.v2` |
| fin2 | 3 | `money.cash-flow.v2`, `plan.schedule-board.v2`, `reasoning.decision-grid.v2` |
| geom2 | 4 | `math.area-squares.v2`, `math.geoboard.v2`, `math.tessellation.v2`, `math.transform.v2` |
| golden | 1 | `math.ten-frame.v2` |
| num-a | 7 | `math.abacus.v2`, `math.clock.v2`, `math.number-line.empty.v2`, `math.number-line.zoom.v2`, `math.pan-balance.v2`, `math.rekenrek.v2`, `math.ruler.v2` |
| num-b | 3 | `math.array-area.v2`, `math.fraction-wall.v2`, `math.ratio-line.v2` |
| plane1 | 8 | `alg.linked-views.v2`, `alg.rate-of-change.v2`, `alg.slope-triangle.v2`, `econ.elasticity.v2`, `econ.market-shift.v2`, `fin.break-even.v2`, `fin.cost-structure.v2`, `fin.margin-markup.v2` |
| prob | 3 | `prob.bayes.v2`, `prob.regression.v2`, `prob.tree.v2` |
| sim1 | 4 | `math.chance-sim.v2`, `math.galton-sim.v2`, `stats.bootstrap-sim.v2`, `stats.coverage-sim.v2` |
| sim2 | 1 | `money.life-sim.v2` |
| solids | 3 | `geometry.cube-net.v2`, `geometry.cube-stack.v2`, `geometry.solid-viewer.v2` |
| space1 | 4 | `geometry.mental-rotation.v2`, `geometry.solid-section.v2`, `money.coin-stack.v2`, `money.market-stall.v2` |
| space2 | 3 | `geography.globe-route.v2`, `math.surface.v2`, `space.ar-table.v2` |
| stats1 | 5 | `stats.balance-point.v2`, `stats.binomial.v2`, `stats.clt.v2`, `stats.dot-plot.v2`, `stats.normal.v2` |

## Chart kinds (F1.0)

`backend/src/services/v2ChartModel.ts` exports 58 chart kinds: 25 core, 21 situational and 12 reading (F1.0). The reading kinds are `dot-plot`, `dumbbell`, `xy-heatmap`, `timeline`, `scatter-regression`, `funnel` (10+), `error-bars`, `density-plot`, `violin-plot`, `parallel-coordinates`, `lorenz-curve` and `fan-chart` (13+). Chart segments are `visual.chart.v2` with `visual.type` set to the kind. Forge emits 12 of 12 reading kinds in all three locales, and 30 of 58 kinds overall.

## Coverage tool snapshot

`backend/src/services/teachingVisualCoverage.generated.ts` (regenerate with `node agent/tools/teaching-visual-coverage.mjs`, check with `--check`, tests in `agent/tools/teaching-visual-coverage.test.mjs`). The staff learning-quality panel reads it through `learningQaSignals.ts`.

| Metric | Value |
|---|---|
| Chart kinds | 58 (25 core, 21 situational, 12 reading) |
| Reading kinds emitted by Forge in three locales | 12 of 12 |
| Horizonte packs | 18 |
| Horizonte segment types | 64 (64 with a lazy board, 64 with a contract) |
| Drag interactions with a tap and keyboard alternative | 28 of 28 (5 pointer-capture handlers, 23 drag-place hooks that need the Move to menu) |
| Older Core v2 kinds emitted in three locales | 48 of 48 (Core map only; the Horizonte packs are not emitted through plan fixtures) |

Locale coverage of the Horizonte pack types is not measured through Forge `emitted.json`, because the packs have no committed v2 plan. Their three-locale copy parity is pinned by `check-horizonte-copy.mjs` and by the per-pack board tests.

## Known gaps

Catalogue entries a piece claims and the build does not cover:

- F1.3: ordering numbers on the line (needs a second answer shape).
- F1.6: circular fraction visual (the fraction-circles row).
- F1.7: measure-a-given-object ruler mode (needs a second answer shape).
- F2.8: tessellations that need a turn or flip (translation only).
- F4.2: graded surface area, nets of polyhedra other than the cube.
- F4.5: cone volume, cylinder sections, Archimedean solids.
- F4.7: free-form surfaces, gradient and gradient descent.
- F4.9: the WebXR session has never run on a device.

Engine and process gaps:

- F0.4: 21 of the 64 pack types register an F0.4 checker. The other 11 packs rely on the gate-4 function inside their own Forge pack file (the golden pack convention).
- Forge `checkV2Behaviour` has no behaviour space for any Horizonte kind, so the row-level behaviour check does not exercise them (sim1 and sim2 docs).
- The staff lesson preview grades without an attempt, so a seeded segment is `invalid` there (fail closed, by design).
- The com lane doc reports that `coursegen/src/__tests__/v2Emit.test.ts` ("cover every segment kind") fails across the Horizonte branch because about 50 segment types have no committed v2 plan. Forge owns it; it was not re-run for this document.

## Not verified, not accepted, not released

- No real-browser pass of any board except the headless `com` render above: phone, tablet and desktop widths, three locales, reduced motion, dark mode, touch drag.
- No screen-reader pass of any spoken text or table equivalent.
- No production build measured any chunk budget (the budgets are declared in each contract, 12 to 40 KB gzipped) or the total of a lesson.
- No native-speaker review of the es-MX and pt-BR strings.
- No text-fit, proportion or Copy Budget audit over the rendered boards; the audit lane has not run over the `audit.json` files.
- The push gate has not run. Nothing is accepted against the SPEC, no requirement row or `SPRINTS.md` entry is closed for these pieces, and nothing is pushed or deployed.
- Seeded types (F3.0 to F3.3) need Core live before any browser that serves them, and Forge must not publish one before that.
- The AR pilot (F4.9) stays default-off. Camera use for minors needs legal and pediatric review and verified guardian consent wired into `ArPilotEnvironment.consent` before the flag is turned on anywhere.

