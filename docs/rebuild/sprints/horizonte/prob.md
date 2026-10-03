# Lane doc: prob (F2.9 probability tree and Bayes, F2.10 regression with squares)

Three Probability boards on the Horizonte Visual, one pack, all grading on the server against a private key. Procedure:
[RECIPE.md](./RECIPE.md). Pattern copied from [golden.md](./golden.md) and [stats1.md](./stats1.md).

| Item | Value |
|---|---|
| Catalogue rows | H14 (probability tree), H29 (Bayes with natural frequencies), H11 (regression and residuals) |
| Pieces | F2.9 (tree, Bayes), F2.10 (regression) |
| Segment types | `prob.tree.v2`, `prob.bayes.v2` (F2.9); `prob.regression.v2` (F2.10) |
| Visuals | `prob-tree`, `natural-frequencies`, `regression-residuals` |
| Ages | tree and Bayes `{ ages: [13, 17], adult: true }`; regression `{ ages: [14, 17], adult: true }` |
| ICAP level | Constructive, all three |
| Answer shapes | tree: an arrangement of counts on branches; Bayes: numeric text; regression: curve parameters |
| Rendering | in-house SVG, native range inputs, a text field, KaTeX for the equation through the shared `MathExpression`; no chart library, no randomness |
| Chunk budgets | tree 18 KB, Bayes 16 KB, regression 18 KB (gzipped, declared) |

## Behaviour and answer shapes

Every payload is public and carries no answer. The key lives only in Core.

| Type | Payload | The learner | Answer sent | Key (private) |
|---|---|---|---|---|
| `prob.tree.v2` | `{ population, prior, hit, alarm, chips }` | places each head count on its branch of the tree | `{ slots: { <branch>: [chipId] } }` | `{ solutions: [{ has, lacks, has-pos, has-neg, lacks-pos, lacks-neg }] }`, one chip id `n-<count>` per branch |
| `prob.bayes.v2` | `{ population, prior, hit, alarm, ask }` | reads, from the four head counts, the chance that a person with one result truly has it | `{ value }`, locale-free number text | `{ target, tolerance: { absolute }, review? }` |
| `prob.regression.v2` | `{ size, points, start: { slope, intercept } }` | moves a line until the squares on the points are as small as possible | `{ family: 'line', params: { m, b } }` | `{ family, target: { m, b }, parameter_tolerance: { absolute }, parameter_review? }` |

Shares are written as `{ part, whole }` ("9 in 10"). The line is counted in tenths in the payload (`start`); the answer is text (`"0.8"`).

- **Tree.** The three shares are written as facts above the tree. Six branches (have it, do not have it, and each of those split by a
  positive or negative result) are drop targets; the tray holds the six head counts and one to four tempting extras. A count moves three
  ways: drag its chip onto a branch, tap a chip then a branch, or the Move to menu (the keyboard path, which lists every other branch and
  "Back to the tray" when the chip is placed). A branch holds one chip and a chip sits on one branch; placing a chip on a taken branch
  returns the old one to the tray. Placed chips stay in the tray as labelled handles ("10 people on Have it"), so the handle is always
  there to pick up again. The status line writes "Placed: n of 6" and the table lists branch, share and count.
- **Bayes.** The same population drawn person by person in a grid of four groups (have it or not, positive or not), with the four head
  counts written in a legend and the people who got the asked result outlined (outline and legend text, never colour alone). The learner
  types the chance as a percent, a decimal or a fraction; the field echoes how Core will read it ("Reads as 0.25") before Check, and says
  why when the text is not a chance. The table lists the four counts and has no totals, because a total would hand over the denominator.
- **Regression.** A square scatter plot, a line, and a square on each point whose side is the point's vertical distance to the line (it
  turns inward at the right edge; a point on the line has no square). Two sliders move the slope and the intercept in steps of a tenth,
  each with Less and More buttons. The status line writes the slope, the intercept and the sum of the squares, the equation is written
  with KaTeX and spoken in words (`y equals minus 0.7 x plus 1.5`), and the table lists each point with its place on the line, residual and
  square, and the total.

## Scorer ladder (same for all three)

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields, a chip that is not in the tray, a chip used twice or two chips on one branch, a chance that is not a number from 0 to 1, a slope or intercept outside the sliders, or (with a rubric) a key that is not the one answer of its payload |
| `valid` | nothing placed, the field left empty, or the line left where it started; and, without a rubric as in the browser, any well-formed response |
| `review` | answered, but not the key; diagnostic `value` |
| `met` | tree: every head count on its own branch; Bayes: within the allowance of the exact share; regression: within a twentieth of the best slope and of the best intercept; score 100, diagnostic `none` |

Scorers are pure, total and deterministic and work in exact arithmetic: a rational type on `BigInt` (`rational.ts`) holds shares, chances and
the least squares fit, so a float never decides a verdict. The tree is grown in whole people (every share must land on whole people and the six
counts must differ, which is what lets chips be told apart by value). Solvability is checked twice: in the contract (a payload with no single
answer does not parse) and in the scorer (a key that is not the one answer is `invalid`). The browser has no rubric, so its generated scorer can say
only `valid` or `invalid`.

Solvers: the tree key is the grown tree; the Bayes key is the head count of those who have it and got the asked result over everyone with that
result, which must lie between 1 in 20 and 19 in 20; the regression key is the exact least squares line, which must have both numbers on the tenths
grid inside the slider ranges (`-3` to `3`, `-5` to `15`), with the points not all on one line and the start away from the best line. A typed chance
is read as a percent, a decimal (point or comma) or a fraction and reduced to a locale-free text by `readChance`.

## Files

Backend `backend/src/services/horizonte/prob/`: `rational.ts` (exact fractions), `model.ts` (tree, shares, chance reading), `regression.ts` (points,
line in tenths, least squares), `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test: `backend/src/__tests__/horizonte/prob.test.ts`.

Browser `frontend/src/rebuild/learning/horizonte/prob/`: generated `contract|rational|model|regression|scorer|fixtures.generated.ts` (never hand-edited),
`capabilities.ts`, `copy.ts`, `boards.tsx`, `shared.tsx`, `bayesGrid.ts` (drawing plan of the Bayes grid, hand-written), `TreeBoard.tsx`, `BayesBoard.tsx`,
`RegressionBoard.tsx`, `prob.css`, `audit.json`, `probBoards.test.tsx`, `gridOutlines.test.tsx`.

Forge `coursegen/src/v2/horizonte/prob.ts` (capabilities, authoring guidance, gate-4 solvability checks hand-mirrored from Core); test
`coursegen/src/__tests__/horizonte/prob.test.ts`.

Fixtures (10, all ages 13-17): `tree-screening`, `tree-filter`, `tree-survey`, `bayes-screening`, `bayes-filter`, `bayes-checkup` (asks about the negative
result), `bayes-city` (10000 people), `regression-climb`, `regression-gentle`, `regression-fall`. Preview: `?screen=fixture&seg=hz:prob:<fixture>&age=13-17`.

## Decisions

- **Exact numbers.** Shares, counts, chances and the fit are rationals; the only floats are drawing aids. The regression keeps the line in tenths
  and compares in whole numbers (`10y - slope * x - intercept`, squared).
- **Pictures do not leak.** The tree shows only the shares; the Bayes legend writes the four counts but no total and the table has none; the
  regression shows the sum of the squares of the current line, never the best line.
- **Prompts carry no answer.** The tree prompt never writes a head count, the Bayes prompt never writes the number of people or the chance, and the
  regression prompt never writes the slope or the intercept. The Forge gate checks the payloads and keys, and the guidance says so.
- **Tree chips are told apart by value.** The six counts must all differ, so a chip id is `n-<count>` and the key needs no chip identity beyond that.
- **Placed chips stay in the tray.** A chip that sits on a branch is relabelled in place ("10 people on Have it") instead of vanishing, so there is
  always one handle per count, with a name that says where it is, and the keyboard path never has to look for a chip inside the SVG.
- **Chance reading is shared.** `readChance` lives in the pure model and is the one reader for the browser echo and the server scorer, so what the
  learner is shown is what Core compares. It accepts `25%`, `0.25`, `0,25` and `1/4`, rejects anything over 1, and answers a locale-free text.
- **Regression has no drag handles.** The sliders and their step buttons are the pointer, touch and keyboard path at once (V4), so the board has
  no `data-hz-handle` and no Move to menu. The 64 px rule applies to the sliders and buttons through the design system.
- **KaTeX through the shared component.** The equation uses `MathExpression` with author-written spoken text built from the locale's own words
  ("is equal to", "plus", "minus"); pt-BR gets its decimal comma from the component, and the plain fallback shows until KaTeX loads. The segment
  declares `visual.math-notation.v1`.
- **Hues.** Berry marks the people who have it and sky the people who do not; strong and soft variants separate positive from negative, and the
  asked people carry a heavy outline. No other hue is used, and nothing depends on colour alone (labels, legend and outline all say it).
- **Copy.** Every string carries a `data-copy-role` and is written natively in en-US, es-MX and pt-BR (not translated from one another); numbers and
  statuses use the `data` role. Counts of people use the locale's plural rules through `pluralUnit`. The copy gate and the board harness check the budget.
- **Motion.** Fill and stroke transitions on branches and squares under `prefers-reduced-motion: no-preference`, using the duration and easing tokens.

## Status

Implementation: complete in all five layers (Core pack, browser copies, boards, Forge, lane doc). Local verification: Core pack test (18), frontend board
contract and interaction tests (28, including all three locales and the board contract for every fixture), Forge test (15), the capability parity
gate, the copy gate and the sync check. Acceptance and release: not done; they belong to the owner and the coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement. Everything below was reasoned from the code and jsdom, not looked at.

## Known issues and limits

- **No visual verification.** The tree layout, label collisions on the edges at narrow widths, the waffle at 2000 people (about 9 units of 640 per cell), the
  residual squares at the plot edge, the 64 px hit size and the contrast of the chosen tokens have not been seen in a browser. jsdom cannot measure layout.
- **Tree labels shrink with the viewport.** The SVG scales down, so the edge labels and the counts inside branches get small on a phone; the status
  line, the tray and the table carry the same numbers.
- **Large populations.** The Bayes grid fills column by column in a fixed 2 to 1 shape and draws its cell lines at a step that keeps them 12 units apart at any population up to the 10000 the contract allows (see the Fix round).
- **Whole people only.** A share that would split a person does not parse, so authors pick populations that divide cleanly and need six different counts.
- **One tree.** There is no second answer for the tree (for example swapping the two result branches of one side); the arrangement is unique by construction.
- **Regression range.** Slope is -3 to 3 and intercept -5 to 15 in steps of a tenth; points sit on a grid of at most 20 by 20 with 4 to 12 points. A line
  that needs a slope outside the sliders has no valid payload. The intercept slider is 200 steps long, so the keyboard path is long for a far intercept.
- **Squares are clipped to the plot.** A square larger than the plot (a line far from the points) is cut at the frame, so its side is read from the table
  and the status line, not only from the drawing.
- **No fit statistics.** The board never shows the best line, R squared or a correlation; it asks only for the line that minimises the squares.
- **A pre-existing harness failure outside this lane.** `horizonte/harness/fixtureCoverage.test.tsx` treats the `plano` folder (the Plano primitive, which has
  an `index.ts` but is not a pack) as a pack and fails three tests on `HORIZONTE_FIXTURES.plano`. It is the same failure recorded in the sim1 lane doc and is
  not caused by this lane; the prob audit and fixture entries are checked by `probBoards.test.tsx` and the sync check instead.
- **Act warnings in tests.** `MathExpression` loads KaTeX asynchronously, so the regression tests print React `act` warnings. They do not fail a test.

## Owner follow-ups

- Look at all nine fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off, and read the
  Bayes grid at 1000 and 2000 people.
- Review the es-MX and pt-BR strings with a native speaker (they are native-written, not machine copies, but not reviewed), in particular "Lo tienen"
  and "Têm" as the name of the branch of people who have it.
- Decide whether `plano` should be excluded from the fixtureCoverage pack scan (a harness fix outside this lane).
- Accept and release the two pieces (F2.9, F2.10) in the sprint record.

## Fix round

What changed after the Atlas audit:

- **The Bayes grid keeps its cell lines at every population (10000 included).** The layout and line spacing now come from one pure drawing plan
  (`prob/bayesGrid.ts`, hand-written, not a generated copy of the Core model). A person is drawn exactly as before (the group blocks are still
  person-exact), but the cell lines are drawn at a step: every person while a person is at least 12 of 640 units wide (up to about 1180 people),
  then every 2 by 2 people (2000), then every 3 by 3 (10000). When a square holds more than one person the board writes it ("Each square holds 9
  people", `gridScale`, role `data`, three native strings, plural by the locale). The old cut-off at 5 units, which dropped the lines past about
  6700 people, is gone. The heavy outline round the asked people is thinned with the width of a person (`--lf-prob-heavy`, never wider than 60%
  of a person) so a group of a few dozen people is not drawn as a solid bar at 10000.
- **The scorer never sees the drawing.** The verdict reads only the payload (population, shares, ask) and the typed chance; `bayesGrid.ts` is not
  imported by the model, the scorer or the generated copies. A Core test grades the same chance at populations 1000 to 10000 and gets the same
  verdicts, and the largest author population (10000) is solvable.
- **A fixture for the top of the range.** `bayes-city` (10000 people, prior 1 in 50, hit 4 in 5, alarm 1 in 20, ask positive, key 16/65) joins the
  nine fixtures so the audit and the board tests draw the largest grid (10 fixtures now, all ages 13-17). Preview:
  `?screen=fixture&seg=hz:prob:bayes-city&age=13-17`.
- **Tests that fail if the outlines go.** `prob/gridOutlines.test.tsx` checks, for every population in the author range, that the plan keeps the lines at
  least 12 units apart; renders the board at 1000, 2000, 4000, 7000 and 10000 people and requires a cell layer (with a resolvable pattern whose
  lines run both ways and are at least 12 units apart) on every block of every group; and reads `prob.css` to require a visible stroke on the
  blocks, grid lines, squares, frame, edges and branch slots, and that the cell layer is never hidden.
- **Dark mode.** The charts set their text, frame, point, block and swatch strokes with `var(--ink)`, a constant (`#11132a`) that does not flip
  under `data-theme="dark"`, so on the dark ground the tick labels, edge labels and node counts were about 1.1 to 1. Every use in this pack now
  uses `var(--content)`, which flips with the theme (`.lf-prob-chart` sets `color: var(--content)`; the SVG text follows through `currentColor`).
  No hex, rgb or colour keyword is left in `prob.css`; a test pins it. The Atlas records for the three tree boards (22 low-contrast items in dark
  against 3 in light) and the three regression boards (20 to 24 against 2) were this defect; the bayes boards have no chart text and were already
  at the 2 disabled-button items of light mode.

Still limited, not verified:

- No browser was opened in this round: the new line spacing, the thinned outline, the scale note and the dark-mode contrast were reasoned from
  tokens and jsdom, not looked at. The Atlas should be re-run on `bayes-city` (10000) and a 2000-person grid at 375 and 1280.
- A square of lines is aligned to the top-left of the grid, so at a step above 1 the squares at the bottom and right edges, and any square that
  straddles two groups, hold fewer than the stated people or a mix; the note says what a full square holds.
- At 10000 people a group of a few dozen people is a column of cells four units wide; it is outlined and listed in the legend and the table, but
  it is small. The counts, not the drawing, are what the learner reads the chance from.
- The disabled Reset and Check buttons (2.3 in light, 2.7 in dark) are a shared control matter, not this pack.

## Solvability round

F0.4 solvability checkers for the three prob pieces, registered in `coursegen/src/v2/horizonte/solvability-stats.ts` (shared with the stats1 pieces)
and imported from `coursegen/src/v2/solvabilityPacks.ts`. Each one reads the public payload alone for everything the payload fixes and compares
with the answer key only when `context.answerKey` is present. The checkers reuse the pack's pure functions by import. `prob.ts` now exports
`inRange`, `hasOnly`, `Frac`, `frac`, `compare`, `readNumber`, `ZERO`, `Ratio`, `Basis`, `Counts`, `valuesOf`, `SLOTS` and `Point`, and gains
`growthOf` (the shared population, shares and head counts, which `growable` now wraps), `plotOf` (the points and grid, which `pointsOf` wraps),
`exactFit`, `asTenths`, `SLOPE_TENTHS` and `INTERCEPT_TENTHS` (`fitTenths` is rebuilt on them with the same behaviour). The pack gates did not
change; what they accept is the same, except where the table marks a tightening.

| Type | Proven from the payload alone | Proven against the key | Not proven, and why |
|---|---|---|---|
| `prob.tree.v2` | The population, shares and tray are valid (`impossible-state`, `out-of-bounds`); every share gives whole head counts (`no-solution`); two chips with the same count are refused (`ambiguous-solution`, their ids would collide). A placement search over the tray, checking the tree's own relations as each branch fills (population splits by the prior, each side by its share), finds exactly one tree, else `no-solution` (a head count is missing from the tray) or `ambiguous-solution`; it must equal the head counts the pack's shares give. The tray starts empty, so the start is never solved. | The rubric is `{ solutions }` with at most 64 trees, each naming the six branches with one `n-<count>` chip. `checkRubricCoverage` proves the accepted set equals the set of valid placements: a missing tree is `rubric-gap`, a wrong one `rubric-accepts-invalid`. | Dead ends: a chip can be dragged back off a branch, so no placement is stuck. |
| `prob.bayes.v2` | The same population and shares must grow whole head counts. The chance asked for (positive or negative) is computed from those counts as a fraction and must sit inside 1 in 20 to 19 in 20 (`out-of-bounds`). | The rubric carries only `target`, `tolerance` and `review`; the target equals the exact fraction, the tolerance is at most 0.01, the review band is wider than the tolerance and at most 0.1. **Distractor rule:** no mix-up of the grid cells (the share of those who have it that test the same way, the share of those who lack it that do, the chance they lack it, the share who have it before any test) that differs from the answer may sit inside the tolerance. | Uniqueness and dead ends: there is one number to type and no start state or move, so there is nothing to be stuck in. **No budget use:** the chance is one division of whole counts, so the work is fixed and a budget of 1 changes nothing; a test pins that. |
| `prob.regression.v2` | The payload carries only the grid size, the points and the start line; the points are valid, in range and not all one x (`no-solution`). The best line is found in closed form by the pack (`exactFit`) and by trying every line the sliders offer (squares in hundredths, whole numbers): the closed form must be on a slider position (tenths, `no-solution` otherwise), inside the sliders (`out-of-bounds`), not an exact fit (`impossible-state`, no squares to shrink), and the one minimum (`ambiguous-solution` on a tie); the two encodings must agree. The start line is not the best line. | The rubric is `{ family: "line", target: { m, b }, parameter_tolerance, parameter_review? }`; the target equals the best line, the tolerance is at most 0.05, the review band is wider than the tolerance and at most 0.5, the tolerance admits exactly one slider line, and the start line is not already inside the tolerance. | Dead ends: both sliders move in tenths with no cap. Ties: the squares are strictly convex with at least three distinct x, so a tie cannot occur on valid input; the search proves it for every plot it sees. |

**Tightening (Bayes distractor rule).** The key must not accept a distractor, which the pack gate does not check. It uses only the tolerance (met) band,
not the review band, because a near-miss is by design a "review", not a "right". The committed fixtures pass.

Budget: the tree search spends `context.nodeBudget` per candidate and the regression search per slider line (61 by 201 positions), each reporting
`budgetIssue(...)` on overflow; both return the budget finding in well under a second at a small budget. The tests are in
`coursegen/src/__tests__/horizonte/solvability-stats.test.ts`: the committed fixtures through `runSolvabilityGate` with and without the key, at least
three adversarial mutations per type refused with the right code, a budget path (for Bayes, the fixed-work test), and the registry check.

Still limited, not verified: the checkers prove the payload and the key, not the rendering; no browser was opened in this round.
