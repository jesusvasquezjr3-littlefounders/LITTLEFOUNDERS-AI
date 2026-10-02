# Lane doc: plane1 (F1.9 linked table-graph-equation, F1.11 break-even and cost structure, F1.12 supply and demand)

Eight boards on the shared Plano (F0.2), one pack, all grading on the server against a private key. Procedure:
[RECIPE.md](./RECIPE.md). Pattern copied from [golden.md](./golden.md) and [stats1.md](./stats1.md). No board draws a second plane:
every figure is `<Plano>` through the one `PlaneFigure` wrapper.

| Item | Value |
|---|---|
| Catalogue rows | D15 (slope triangle), D16 (slope as a rate), D18 (linked table, graph and equation), N08 and N09 (break-even), N28 (cost structure), N10 (margin and markup), N09 and N13 (market shift), N13 (elasticity) |
| Pieces | F1.9 (slope triangle, rate of change, linked views), F1.11 (break-even, cost structure, margin and markup), F1.12 (market shift, elasticity) |
| Segment types | `alg.slope-triangle.v2`, `alg.rate-of-change.v2`, `alg.linked-views.v2` (F1.9); `fin.break-even.v2`, `fin.cost-structure.v2`, `fin.margin-markup.v2` (F1.11); `econ.market-shift.v2`, `econ.elasticity.v2` (F1.12) |
| Visuals | `slope-triangle`, `rate-table-graph`, `linked-views`, `break-even`, `cost-structure`, `margin-markup`, `market-shift`, `elasticity` |
| Ages | slope triangle and rate of change `{ ages: [13, 17], adult: false }`; linked views `{ ages: [12, 17], adult: false }`; break-even, cost structure, margin and markup `{ ages: [12, 17], adult: true }`; market shift and elasticity `{ ages: [13, 17], adult: true }` |
| ICAP level | Active, all eight |
| Answer shape | integer on a grid; market shift is choice plus integer on a grid |
| Rendering | the shared Plano (SVG), native range inputs through the design system `Slider`; no chart library, no randomness |
| Chunk budgets | 12 KB for six boards, 14 KB for linked views and market shift (gzipped, declared) |

## Behaviour and answer shapes

Every payload is public and carries no answer. The key lives only in Core as `{ target: ... }`. Each type has one `solveX` function that
the contract refine, the scorer and the Forge gate share (the Forge copy is hand-mirrored), so a segment that has no exact answer does not parse.

| Type | Payload | The learner | Answer sent | Key (private) |
|---|---|---|---|---|
| `alg.slope-triangle.v2` | `{ grid, line: { from, to }, run, start }` | drags the top corner of a triangle (locked to its column) or uses the rise slider until the triangle sits on the line | `{ rise }` as a whole number | `{ target }`, the rise for the run |
| `alg.rate-of-change.v2` | `{ grid, origin, rate, at, start }` | moves a graph point to the value reached at a later step, reading the table beside the graph | `{ y }` | `{ target }`, `origin.y + rate * (at - origin.x)` |
| `alg.linked-views.v2` | `{ grid, given: [point, point], start: { m, b } }` | edits the intercept and the slope (two handles, two sliders) until the line passes every row of the table | `{ m, b }` | `{ target: { m, b } }` |
| `fin.break-even.v2` | `{ fixed, price, unit, maxUnits, start }` | moves a units marker along the revenue and cost curves to where they meet | `{ units }` | `{ target }`, `fixed / (price - unit)` |
| `fin.cost-structure.v2` | `{ fixed, variable, maxUnits, goal: { average }, start }` | moves a units marker along the average cost curve until it reaches the goal | `{ units }` | `{ target }`, `fixed / (goal.average - variable)` |
| `fin.margin-markup.v2` | `{ cost, basis, percent, maxPrice, start }` | sets the price that earns the markup (on cost) or the margin (on price) | `{ price }` | `{ target }`, the whole price |
| `econ.market-shift.v2` | `{ pMax, qMax, demand: { a, b }, supply: { c, d }, shift: { curve, by }, start }` | picks Goes up or Goes down, then sets the new price on the shifted curves | `{ direction, price }` | `{ target: { direction, price } }` |
| `econ.elasticity.v2` | `{ pMax, demand: { a, b }, goal: { num, den }, start }` | slides the price along a demand line until the elasticity is the goal fraction | `{ price }` | `{ target }`, `num * a / (b * (num + den))` |

- **Slope triangle.** The corner moves with the arrow keys (one grid step, Shift multiplies it, Home and End jump), with a slider and its
  step buttons, or by tapping. The status line writes run, rise and the slope as a fraction and a decimal; the fraction is spoken "n over d".
- **Rate of change.** A table of steps and values sits beside the graph and follows the point. The axes are the generic "Step" and "Value".
- **Linked views.** One equation, one table and one graph, always the same line. The equation is written plain (`y = 2x + 3`) and spoken as
  words through `role="img"` and `aria-label`. Page Up and Page Down switch between the intercept and the slope handle; the two sliders are
  the alternative when the handles overlap.
- **Break-even and cost structure.** The status line writes units, revenue, cost and profit (or total and average cost and the goal), and a
  facts line states the stand or the setup. The marker moves along the row with every arrow, Home and End.
- **Margin and markup.** Price slider along a percent curve; the status line writes the markup on cost and the margin on price side by side, so
  the learner reads the two bases and never has to guess which one the prompt asks for.
- **Market shift.** Demand and supply as price against quantity, plus the shifted curve. The marker is the price; the status line writes the
  quantity demanded and supplied and says Shortage, Surplus or Balanced. Check stays off until a direction is chosen, even when the price moved.
- **Elasticity.** The price slides along the demand line. The status line writes price, quantity, elasticity and the kind (Inelastic, Unit
  elastic, Elastic), and the goal is written as a number or a spoken fraction.

## Scorer ladder (same for all eight)

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields, a value off its grid or axis, or a malformed, inconsistent or unreachable key |
| `valid` | the untouched start (and, without a rubric as in the browser, any well-formed response) |
| `review` | well-formed and changed but not the key; score 0, diagnostic `value` |
| `met` | the key; score 100, diagnostic `none` |

Scorers are pure, total, deterministic and work in whole numbers: every payload is built so the answer is an integer (a fixed cost that does
not divide by the profit per unit does not parse). The browser has no rubric, so its generated scorer says only `valid` or `invalid`;
Core does the met and review grading.

## Files

Backend `backend/src/services/horizonte/plane1/`: `model.ts` (grid, slope triangle, rate, linked views), `finance.ts` (break-even, cost
structure, margin and markup), `market.ts` (market shift, elasticity), `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`.
Test: `backend/src/__tests__/horizonte/plane1.test.ts`.

Browser `frontend/src/rebuild/learning/horizonte/plane1/`: generated `contract|model|finance|market|scorer|fixtures.generated.ts` (never
hand-edited), `capabilities.ts`, `copy.ts`, `boards.tsx`, `shared.tsx`, `SlopeTriangleBoard.tsx`, `RateOfChangeBoard.tsx`,
`LinkedViewsBoard.tsx`, `BreakEvenBoard.tsx`, `CostStructureBoard.tsx`, `MarginMarkupBoard.tsx`, `MarketShiftBoard.tsx`, `ElasticityBoard.tsx`,
`plane1.css`, `audit.json`, `plane1Boards.test.tsx`.

Forge `coursegen/src/v2/horizonte/plane1.ts` (capabilities, authoring guidance, gate-4 solvability checks hand-mirrored from Core);
test `coursegen/src/__tests__/horizonte/plane1.test.ts`.

Fixtures (12): `slope-triangle-run`, `slope-triangle-gentle`, `rate-of-change-steps`, `linked-views-line` (10-12), `break-even-stand` (10-12),
`cost-structure-average`, `markup-price` (10-12), `margin-price`, `market-shift-demand`, `market-shift-supply`, `elasticity-unit`,
`elasticity-half` (the others 13-17). Preview: `?screen=fixture&seg=hz:plane1:<fixture>&age=<band>`.

## Decisions

- **Row mapping.** N08 (break-even point) and N09 (break-even in a table) are one board, `fin.break-even.v2`. N28 is `fin.cost-structure.v2`,
  N10 is `fin.margin-markup.v2` with a `basis` of markup or margin. N09 and N13 on the demand side are `econ.market-shift.v2`; the type is not
  `econ.supply-demand.v2`, which already exists in the catalogue, so there is no name collision.
- **Choice plus integer.** The choice of the F1.12 answer shape is the `direction` of the market shift, sent with the price in one payload and
  graded as one key. Elasticity has no choice field: its prompt asks for the price at a stated elasticity, and the kind label is a reading aid.
- **Ages.** F1.9 is 12-17 as a piece, but D15 and D16 need fractions and a slope as a ratio, so those two types start at 13; linked views keeps
  12. D18's catalogue range of 10-17 is therefore narrowed to 12-17.
- **Pictures do not print the answer.** No board shows a "correct" cue. Reading the graph is the exercise, so the status line writes the values
  at the marker; at the answer the profit is 0, the elasticity equals the goal and so on. That is a numeric reading, the same one the learner
  makes from the curves.
- **Handles.** Plano handles are 64 px slider handles with a tap and keyboard alternative: arrows, Shift for a bigger step, Home and End, Page
  Up and Page Down between handles, and a native `Slider` with step buttons in the control strip. Every board has the Plano table toggle and
  a text equivalent line (`data-hz-text-equivalent`).
- **Math for the ear.** The equation and the fractions are plain text with `role="img"` and an `aria-label` that says them as words ("y equals
  2 x plus 3", "2 over 3"); the spoken words come from the pack copy in all three locales. No KaTeX.
- **One locale source.** Plano reads its locale from the rebuild environment, which is the lesson locale in production. The board also forces
  Plano's own words from the document locale (`PlaneFigure` takes a `locale`), so the table button and the live text never disagree with the
  rest of the board, even when no `RebuildRoot` wraps it.
- **Copy.** Strings use the default band of the Copy Budget, `data` for numbers and statuses, native es-MX and pt-BR text. Four prompts were
  cut to the sentence and word limits after the board harness flagged them.
- **Motion.** None. The board adds no transition of its own, and Plano's motion is already inside `prefers-reduced-motion: no-preference`.

## Status

Implementation: complete in all five layers (Core pack, browser copies, boards, Forge, lane doc). Local verification: Core pack test (18),
frontend board contract and interaction tests (38, including all three locales and the board contract for every board), Forge test (13),
type-check of backend, coursegen and frontend, the capability parity gate, the copy gate and the sync check. Acceptance and release: not done;
they belong to the owner and the coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement, no screen reader. Everything below was reasoned from the code and jsdom, not
looked at.

## Known issues and limits

- **No visual or screen-reader verification.** The curve layout, label collisions at narrow widths, the 64 px hit size, the contrast of the
  chosen tokens and the spoken wording have not been seen or heard.
- **Handles can overlap.** In linked views the intercept and the slope handles can sit near each other; the sliders and Page Up and Page Down
  are the way out. Nothing nudges the handles apart.
- **Generic rate axes.** The rate board labels its axes "Step" and "Value" so one board serves every rate story; a lesson that needs "Day" and
  "Cups" needs an extra payload field in a new contract version.
- **Plano marks only the active handle as a tab stop.** The other handles are reached with Page Up and Page Down, and the board harness wants a
  marker on a focusable element that is not in the tab order. `PlaneFigure` sets `data-hz-roving` on every handle after render. The right
  home is Plano itself (see follow-ups).
- **Plano's live text has no `data-copy-role`.** The board status line is `data` and counted; Plano's own live region is not marked.
- **Number formatting inside Plano** follows the environment locale, not the document locale. They are the same in production.
- **Axis bounds.** Grids are 4 to 12 across and -24 to 24 up; slopes are -9 to 9; prices to 60 (400 for a shelf price), units to 60, demand
  and supply intercepts to 300. Larger data needs a new contract version.
- **Elastic demand is a straight line,** so elasticity is a function of the price only. Kinked demand and cross elasticity are out of scope.

## Owner follow-ups

- Look at all twelve fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off,
  and listen to the equation and the fractions with a screen reader.
- Move the `data-hz-roving` marker on non-active handles and a `data-copy-role` on the live region into Plano (shared, so not changed in this lane).
- Decide whether the rate board needs authored axis names.
- Review the es-MX and pt-BR strings with a native speaker (they are native-written, not machine copies, but not reviewed).
- Accept and release the three pieces (F1.9, F1.11, F1.12) in the sprint record.
