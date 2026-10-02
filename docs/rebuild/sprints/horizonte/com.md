# Lane doc: com (F2.16 networks and counting, F2.17 unit circle and calculus, F2.18 bits and logic gates)

Three Horizonte Visual pieces, four segment types, built in all three layers on the golden-pack template. F2.16 and F2.18 answer by arrangement
(F0.3), so they share one slot-board engine in the browser and one slot model in Core. F2.17 answers by a choice plus a grid integer on the
Plano (the explorer shape), so it shares one explorer kit.
Procedure: [RECIPE.md](./RECIPE.md). Answer shapes: [F0.3-answer-shapes.md](./F0.3-answer-shapes.md). Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

Status: implemented and tested locally on branch `hz/com`. Not accepted, not released. See "Not verified" below.

| Item | F2.16 | F2.17 trig | F2.17 calculus | F2.18 |
|---|---|---|---|---|
| Catalogue rows | J01, J03, J08, J09 | F02, F03 | G04, G05, G10, G11 | J21, J12 |
| Segment type | `math.network-count.v2` | `trig.unit-circle.v2` | `calculus.explorer.v2` | `computing.bits-gates.v2` |
| Visuals | `graph`, `shortest-path`, `choice-tree`, `pascal` | `unit-circle`, `circle-wave` | `secant`, `derivative-link`, `riemann`, `accumulation` | `bits`, `gates` |
| Ages | 10 to 17 and adult | 15 to 17 and adult | 15 to 17 and adult | 10 to 17 and adult |
| Forge bands | 10-12, 13-17, adult | 13-17, adult | 13-17, adult | 10-12, 13-17, adult |
| Copy Budget band | 10-12 | 13-17 | 13-17 | 10-12 |
| ICAP level | Constructive | Constructive | Constructive | Constructive |
| Answer shape | arrangement | choice plus grid integer | choice plus grid integer | arrangement |
| Response | `{ slots: { slotId: [pieceId] } }` | `{ predict, value? }` | `{ predict, value? }` | `{ slots: { slotId: [pieceId] } }` |
| Private key | `{ solutions: SlotMap[] }`, 1 to 8 examples | `{ predict, value }` | `{ predict, value }` | `{ solutions: SlotMap[] }`, 1 to 8 examples |
| Capabilities | `visual.network-count.v1`, `operation.drag-chips.v1`, `operation.tap-place.v1` | `visual.unit-circle.v1`, `operation.drag-point.v1`, `operation.predict-choice.v1`, `visual.math-notation.v1` | `visual.calculus-explorer.v1`, `operation.drag-point.v1`, `operation.parameter-slider.v1`, `operation.predict-choice.v1`, `operation.number-input.v1`, `visual.math-notation.v1` | `visual.bits-gates.v1`, `operation.drag-chips.v1`, `operation.tap-place.v1` |
| Chunk budget (declared) | 20 KB gzipped | 16 KB gzipped | 18 KB gzipped | 16 KB gzipped |
| Solvability checker (F0.4) | yes | yes | yes | yes |

Segment types added: `math.network-count.v2`, `trig.unit-circle.v2`, `calculus.explorer.v2`, `computing.bits-gates.v2`. They are registered
through the pack stubs in Core (`backend/src/services/horizonte/com/`), the browser (`frontend/.../horizonte/com/`) and the Forge
(`coursegen/src/v2/horizonte/com.ts`). The four `COM_CAPABILITIES` literals are identical in the three services (the per-pack parity gate passes).
The 15+ eligibility of F2.17 is carried by lesson eligibility: the Forge document holds the band alone, so the gate checks bands (13-17 and adult).

## Behaviour

- **F2.16 map.** A graph of 3 to 7 places joined by bridges or roads. Two tasks. `odd`: put every place with an odd number of bridges in the
  `odd` zone (a computed set, so Konigsberg is answered by counting, not by recall). `trail`: put the bridges in the order of one walk that
  crosses every bridge once, in `walk`; a walk is read in order, so each chip says its place in the line.
- **F2.16 cheapest route.** A weighted map with a start and a goal. The learner places the places of a route in `route`, in order, from the start
  to the goal. The answer is graded by the rule (a connected route from start to goal whose total is the lowest), so every tied cheapest route
  is `met`; the board shows the running cost, and a "Show steps" view walks Dijkstra's method one settled place at a time. The `cheapest-tie`
  fixture has two equal cheapest routes.
- **F2.16 choice tree.** 2 to 4 items, pick 2 or 3. The board draws the tree and lists every leaf as a chip. `order` mode keeps every outcome
  (the answer is computed). `group` mode keeps one outcome per team because the order does not matter, so the learner keeps a set. A `first`
  option fixes who comes first ("Ana always wins gold").
- **F2.16 Pascal.** 5 to 10 rows. Every cell is a toggle, 64 px. The learner colours the multiples of 2 to 5. The slot is `row-N` and the
  cell is `rRcC` (row and column from 0). Rows beyond what fits scroll sideways inside their own box rather than shrinking the targets.
- **F2.17 unit circle.** The learner predicts a quadrant, then drags a point on the circle (a step of 5, 10, 15 or 30 degrees) to find an
  angle where cos or sin has a given value and side. The answer is the quadrant plus the whole-number angle. A point can never leave the circle.
- **F2.17 circle to wave.** The learner predicts whether the wave hits a given height once or twice in a turn, then drags the point to find the
  angle on the rising or falling side. The circle and the wave are drawn together and stay linked.
- **F2.17 secant to tangent.** Drag the second point of a secant toward the first; the learner predicts the sign of the slope (positive,
  negative or zero), then enters the slope at the point (the whole number the derivative gives at `a`).
- **F2.17 f and f' linked.** Two stacked plots: the curve and its slope graph, with a dot on the slope graph that follows the mark on the curve.
  The learner predicts whether the curve is rising or falling between its two flat spots, then finds the x of the peak or the trough.
- **F2.17 Riemann sums.** The learner predicts whether the estimate is too small or too big, then raises n (a slider with a number readout and
  plus and minus buttons) until the estimate is within a tolerance of the true area, and answers with the first n that gets there. Methods: left,
  right, midpoint, trapezoid.
- **F2.17 fundamental theorem.** The curve and its running area stacked. The learner predicts whether the area is growing, shrinking or flat when
  it hits the target, then moves the mark to the x where the area so far equals the target.
- **F2.18 bits.** A row of 4 to 8 switches, each with its place value. The learner sets the switches so the row shows a target number; the
  total is shown live. The answer is the set of switches on, in slot `bits-on`.
- **F2.18 gates.** A wired circuit with 1 to 3 inputs, 1 to 5 empty gate positions and a tray of at most 7 gates (AND, OR, NOT, XOR, NAND, NOR).
  The learner places gates so the lamp follows a truth table. The table shows the goal, what the circuit gives now and whether each row
  matches. A gate must fit its position (a NOT takes one wire, the others two).
- **Equivalents.** Every drag has a keyboard alternative. Chips use a "Move to" menu (tap-place) and the same placement function as the drag.
  Points move with the arrow keys, Home and End. Pascal cells and switches are buttons with `aria-pressed`. Sliders are native range inputs
  with a number readout. Every board has a "Show as table" toggle or an always-visible table (truth table), plus a live text line that says the
  same facts as the picture. All handles are 64 px. Motion sits under `prefers-reduced-motion: no-preference`. Colours come from tokens, and
  no colour is the only carrier of meaning (zones, steps and chips carry names and numbers).
- **Math is spoken.** F2.17 renders every formula through `MathExpression` with a `spokenText` (built in `notation.ts`: polynomials, slope
  rules, integrals, area so far, trig equations), so assistive technology reads "the integral from 0 to 3 of f of x" rather than TeX. F2.16 and
  F2.18 have no TeX; their numbers are plain text.

## Scorer ladders

| Piece | `invalid` | `valid` | `review` | `met` |
|---|---|---|---|---|
| F2.16, F2.18 (arrangement) | malformed payload, a piece off the board or over a slot capacity, a piece a slot cannot take (a gate in a position of another arity, a Pascal cell off its row), a malformed key (a key example that does not meet the rule) | nothing placed yet, and any well-formed placement when there is no rubric | placed, but the rule is not met (`miss`, `partial`, `false_alarm` from the arrangement ladder) | the placement meets the task's rule, whether or not it is one of the key's examples; score 100 |
| F2.17 (explorer) | malformed payload, a prediction that is not an option, a value outside the whole-number range, a key that is not the model's own answer | a prediction alone (no `value` yet), and any well-formed answer when there is no rubric | `value`: the number is wrong; `miss`: the number is right and the prediction is wrong | prediction and number both match the model; score 100 |

The key lists 1 to 8 examples for an arrangement and each must itself meet the rule (a wrong key is `invalid`, never a wrong grade). For an
explorer, the key `{ predict, value }` must equal what the model computes. The browser has no rubric, so its generated scorer can say only
`valid` or `invalid`; it never reports `met`.

## Model rules (the contract both gates and scorers share)

- **Graph.** 3 to 7 nodes on a 0 to 100 plane, at least 18 apart, with 2 to 9 bridges. Path: 2 to 12 roads, weights 1 to 9, at most 8 shortest
  routes. Tree: 2 to 4 items, pick 2 or 3, at most 24 leaves. Pascal: 5 to 10 rows, multiple 2 to 5, with at least one multiple on the board.
  Labels name every node, road and item. An `odd` graph has at least two odd places; a `trail` graph has a walk over every bridge
  (zero or two odd places).
- **Trig.** Step 5, 10, 15 or 30 degrees, start 0 to 359 on a step. The shape rules leave one angle to find.
- **Calculus.** Coefficients -9 to 9 (a cubic with whole coefficients). Secant `a` is -3 to 3. Derivative link: two roots -3 to 3 at least 2
  apart, base -5 to 5. Riemann: from and to -3 to 6, 2 to 8 wide, tolerance 0.01 to 20. Accumulation: from -4 to 3, to -4 to 8 (3 to 8 wide),
  target -99 to 99.
- **Bits.** 4 to 8 switches, target 1 to 2^bits - 1. **Gates.** 1 to 3 inputs, 1 to 5 positions, a tray of at most 7 (at least as many as
  positions), a truth table that is not all the same bit, every position feeding the output, and some placement of the tray that gives the table.
- A slot holds at most 64 pieces. Slot ids are `odd`, `walk`, `route`, `keep`, `bits-on`, the gate slot ids from the payload, and Pascal `row-N`.

## Files

Backend `backend/src/services/horizonte/com/`: `arrange.ts` (frame, context and arrangement helpers), `network.ts`, `trig.ts`, `calculus.ts`,
`circuits.ts` (the models), `explorer.ts` (the explorer truth), `contract.ts` (zod segment schemas), `capabilities.ts`, `scorer.ts`, `fixtures.ts`,
`index.ts`. Test: `backend/src/__tests__/horizonte/com.test.ts` (26, runs `assertScorerContract`).

Browser `frontend/src/rebuild/learning/horizonte/com/`: generated `arrange|network|trig|calculus|circuits|explorer|contract|scorer|fixtures.generated.ts`
(copied from Core by `node agent/tools/sync-v2-horizonte.mjs`), `capabilities.ts`, `copy.ts` (en-US, es-MX, pt-BR, `data-copy-role` on every
string), `format.ts`, `notation.ts`, `slotBoard.tsx|css` (shared arrangement engine), `specTable.tsx|css`, `explorerKit.tsx` and `explorer.css`
(shared explorer kit), `NetworkBoard.tsx|css`, `TrigBoard.tsx`, `CalculusBoard.tsx`, `CircuitsBoard.tsx|css`, `boards.tsx` (four lazy chunks),
`audit.json`, `index.ts`, `ComBoards.test.tsx` (44, runs `assertBoardContract` on all 19 fixtures in three locales).

Forge `coursegen/src/v2/horizonte/com.ts` (capabilities, guidance, gate-4 `comGates`, the four F0.4 checkers) with the helpers `comShared.ts`,
`comNetwork.ts`, `comExplorer.ts`, `comCircuits.ts`; test `coursegen/src/__tests__/horizonte/com.test.ts` (33) over
`com.fixtures.ts` (19 entries). `coursegen/src/v2/solvabilityPacks.ts` imports `./horizonte/com.js` so the checkers register: this is the one shared
file touched.

Fixtures (19, segment id equals fixture id). Preview: `?screen=fixture&seg=hz:com:<id>&age=<band>`.

| Piece | Fixtures | `age` |
|---|---|---|
| F2.16 | `konigsberg`, `bridge-walk`, `cheapest-route`, `cheapest-tie`, `team-picks`, `podium`, `pascal-evens`, `pascal-threes` | `10-12` |
| F2.17 | `unit-circle-cos`, `unit-circle-sin`, `circle-wave`, `secant-slope`, `linked-graphs`, `riemann-sums`, `area-so-far` | `13-17` |
| F2.18 | `bits-ten`, `bits-byte`, `gates-xor`, `gates-alarm` | `10-12` |

For example `?screen=fixture&seg=hz:com:gates-alarm&age=10-12`. `audit.json` lists all 19 so the audit lane finds them.

## Forge gate 4 and solvability

- **Gate 4** (`comGates`) checks, per segment of the four types, in this order: the visual fits the type; the age band; the payload (strict, with
  the same rule text as Core); the labels; and, when a private key is held, the key (shape, then the domain rule). A bad payload stops the checks
  that depend on it. Messages are identical to Core's, and the age message reads "This kind is for age band X, not Y".
- **Network checker.** It reports `duplicate-id` and `dangling-reference` first. `odd` and the order-mode tree and Pascal have one derived
  answer, so they need no search and report nothing even with a tiny budget. A trail, a route and a group tree are predicate-graded searches that
  need one solution (`no-solution` otherwise) and check every key example against the rule (`rubric-accepts-invalid`). A Pascal payload with no
  multiple on the board is an `impossible-state`.
- **Explorer checker (trig and calculus).** The answer is computed, so the checker proves the key equals the model (`impossible-state`
  otherwise). Trig scans the 360 whole angles and Riemann the whole values of n through `verifyUniqueOrCovered`; accumulation scans the x values
  of its interval (`no-solution` when nothing meets the target, `ambiguous-solution` when two values do). The secant and the linked graphs have
  one derived answer and need no scan.
- **Circuit checker.** Bits proves the target is reachable and the key sums to it. Gates searches placements of tray gates over the positions
  and requires one that reproduces the truth table (`no-solution` otherwise); a `loose` run reads an unsolvable circuit as `no-solution`.
- **Budget.** Every search spends `context.nodeBudget`; an exhausted budget is a `budget-exceeded` finding, never a pass.
- **Independent model.** Forge cannot import Core, so the four helpers carry a hand-mirror of the models. Their tests pin the same 19 fixtures
  as the backend, so a bug in one copy cannot hide in the other.

## Decisions

- **Rule-graded arrangements.** A walk, a route, a group of outcomes or a circuit has many right answers. The scorer grades by the rule and the
  key lists examples that gates check against the same rule.
- **Explorers keep the answer computed.** A key is never trusted over the model: a key that differs from the model's truth is `invalid`.
- **Prediction first.** Every F2.17 board asks for a prediction before the number; a right number after a wrong prediction is `review/miss`, so
  the learner is told which half to rethink.
- **A walk and a route are read in order.** Each chip says its place in the line, because an order cannot be read from a set of chips.
- **One slot-board engine and one explorer kit.** The two engines serve four boards, which keeps each lazy chunk small and the behaviour
  identical across pieces.
- **Wide tables scroll in their own box.** The table is wrapped in a keyboard-reachable scroll region, and on a phone its cell padding narrows so
  the truth table fits 390 px whole.
- **Age.** F2.17 starts at 15 (the lesson eligibility carries it). F2.16 and F2.18 start at 10, so their fixtures use the 10-12 band.
- **Type ids and capabilities** are the four above, in parity across Core, the browser and the Forge.
- **Copy.** Every string carries `data-copy-role`; es-MX and pt-BR are written natively, and decimals and units follow the locale.

## Not verified

- Checked in a real browser: all 19 fixtures rendered in headless Chrome against a Vite dev server at 900 and 390 px wide, with no console errors
  and no horizontal page scroll, and the images were looked at. Not checked: a real touch or pointer drag (the headless pass did not drag), a
  screen reader, and a real device.
- Chunk budgets (20, 16, 18, 16 KB gzipped) are declared, not measured: no production build was run.
- The full gates did not run (`test:all`, `tools:test`, `verify:*`, `audit:*`). Only focused tests, the parity, sync and copy checks, and one
  type-check per service ran.
- The audit lane has not run over `audit.json`.
- Native review of the es-MX and pt-BR copy by a person has not happened.

## Limits

- The choice tree reserves room for a name up to 18 characters; a longer name can run past the edge of the picture. The chips, the table and the
  text line always carry every name whole (labels are capped at 60 characters).
- Pascal rows wider than the screen scroll sideways, because every cell is a 64 px target. On a phone the triangle is cut at the right edge and
  the learner scrolls to reach the rest; the "Show as table" view reads the same cells row by row.
- The gate circuit is drawn in a fixed 6 px label size scaled to the picture, so its names are small on a phone; the position cards and the truth
  table beside it carry the same facts at body size.
- On a map the labels of crossing bridges can sit close together; each label has a halo so the number stays readable.
- Graphs are limited to 7 places and 9 bridges (12 roads on a route), and trees to 24 leaves, so every search finishes in the default node
  budget; a larger instance is refused by the payload rules.
- The calculus pieces use polynomials of degree 3 with whole coefficients. The slope and the extremum are whole numbers on a grid, so
  the learner never types a fraction.

## Known failures not caused by this lane

- `frontend/.../harness/fixtureCoverage.test.tsx` fails on `plano` (the plano pack is missing from the fixtures registry); the com fixtures
  were checked separately against `audit.json` and load in three locales.
- `coursegen/src/__tests__/v2Emit.test.ts` ("cover every segment kind") fails across the whole Horizonte branch: about 50 segment types have no
  committed v2 plan. It is not specific to com.
- `coursegen/src/v2/horizonte/num-b.ts` has two `no-explicit-any` lint errors at lines 92 and 126 (num-b lane).

## Owner follow-ups

- Run the audit lane over `com/audit.json` and review the 19 fixtures in a real browser at 10-12 and 13-17, with a real drag on a touch screen.
- Measure the four chunk sizes against the declared budgets at the first build.
- Have a native reader review the es-MX and pt-BR copy, especially the trig and calculus vocabulary.
- Fix the shared `.lf-math` rule in `pizarron.css` (`overflow-x: auto` on an inline-block): on Windows it shows a scrollbar beside tall KaTeX such
  as fractions and integrals. This lane works around it in `explorer.css` (`overflow-y: hidden` and padding) and does not touch the shared file.
- Look at the unit circle with the audit lane: the dotted ring and the `0` degree tag sit close together at the start angle.
- Decide whether lessons for F2.17 gate by eligibility 15 (the pieces assume it).
- Accept the pieces in `REQUIREMENTS.md` only after the browser pass; this lane records implementation only.
