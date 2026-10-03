# Lane doc: stats1 (F1.13 dot plot and balance point, F1.14 normal curve, binomial bars and mean of draws)

Five Stats boards on the Horizonte Visual, one pack, all grading on the server against a private key. Procedure:
[RECIPE.md](./RECIPE.md). Pattern copied from [golden.md](./golden.md).

| Item | Value |
|---|---|
| Catalogue rows | C06, H03, H07 (dot plot: median, mode, mean), H06 (balance point), H22 (normal), H23 (binomial), H25 (central limit theorem) |
| Pieces | F1.13 (dot plot, balance point), F1.14 (normal, binomial, mean of draws) |
| Segment types | `stats.dot-plot.v2`, `stats.balance-point.v2` (F1.13); `stats.normal.v2`, `stats.binomial.v2`, `stats.clt.v2` (F1.14) |
| Visuals | `dot-plot`, `balance-point`, `normal-curve`, `binomial-bars`, `sampling-mean` |
| Ages | F1.13 `{ ages: [10, 14], adult: false }`; F1.14 `{ ages: [14, 17], adult: true }` |
| ICAP level | Active, all five |
| Rendering | in-house SVG, native range inputs; no chart library, no randomness |
| Chunk budgets | dot plot 14 KB, balance 12 KB, normal 14 KB, binomial 14 KB, mean of draws 14 KB (gzipped, declared) |

## Behaviour and answer shapes

Every payload is public and carries no answer. The key lives only in Core as `{ target: ... }`.

| Type | Payload | The learner | Answer sent | Key (private) |
|---|---|---|---|---|
| `stats.dot-plot.v2` | `{ axis, dots, measure, moves }` | moves at most `moves` dots (1 or 2) until the mean, median or mode is the number in the prompt | `{ dots: number[] }` | `{ target }`, a whole value on the axis |
| `stats.balance-point.v2` | `{ axis, dots, pivot }` | slides the pivot until the beam is level | `{ pivot }` | `{ target }`, the integer mean of the dots |
| `stats.normal.v2` | `{ axis, start: { mean, sd }, sdMax, band: { rule, low, high } }` | sets the mean and spread so `low` to `high` is `rule` standard deviations either side of the mean | `{ mean, sd }` | `{ target: { mean, sd } }` |
| `stats.binomial.v2` | `{ nMax, start: { n, pct }, goal: { mean, variance } }` | sets n and the chance (5% grid) until the mean and variance match the goal | `{ n, pct }` | `{ target: { n, pct } }` |
| `stats.clt.v2` | `{ weights, nMax, start: { n }, goal: { shrink } }` | sets the sample size until the spread of the mean is `shrink` times smaller | `{ n }` | `{ target: { n } }` |

- **Dot plot.** A dot moves three ways: drag its chip onto a column, tap a chip then a column, or the Move to menu (the keyboard path,
  which lists only the values that keep the move count within the limit). Moved dots carry a ring and the status line states the
  measure and "Moves used: n of m". A tie has no mode and the line says "none". The table lists the non-empty values.
- **Balance point.** The pivot is a slider with step buttons. The beam tips toward the heavier side with a minimum visible tilt and
  the status line writes both pulls and "Tips left", "Tips right" or "Level", so level is never colour alone. The table lists each
  dot's distance from the pivot and the net.
- **Normal.** Mean and spread sliders. The band edges and the share inside the band are written as numbers. The vertical scale
  comes from the axis span only, so the curve height never gives the answer away.
- **Binomial.** n and chance sliders. The bars are scaled to their own tallest bar and the mean marker moves. The status line writes
  the mean and variance, and the table lists every count with its chance.
- **Mean of draws.** Two panels on one axis: one draw and the mean of n draws. The spread band narrows while the centre stays put.
  The status line writes the spread of one draw, the spread of the mean, and the times-smaller factor.

## Scorer ladder (same for all five)

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields, a value off its grid or axis, a broken rule (dot plot: a changed dot count or more dots moved than allowed), or a malformed, inconsistent or unreachable key |
| `valid` | the untouched start (and, without a rubric as in the browser, any well-formed response) |
| `review` | changed and rule-respecting but not the key; diagnostic `value` |
| `met` | the key; score 100, diagnostic `none` |

Scorers are pure, total and deterministic and work in whole numbers: the dot plot compares the mean times the count, twice the median
and the single mode; the binomial uses `n * pct` and `n * pct * (100 - pct)` against `100 * mean` and `10000 * variance`. Solvability is checked
twice: in the contract (a segment whose goal has no exact answer does not parse) and in the scorer (a key that is not the one answer is `invalid`).
The browser has no rubric, so its generated scorer can say only `valid` or `invalid`.

Solvers: dot plot is a breadth-first search over count vectors (at most 12 dots on 21 steps with 2 moves, under ten thousand states);
balance is the integer mean; normal is the band midpoint and width over `2 * rule`; binomial is `pct = 100 - 100 * variance / mean`
and `n = 100 * mean / pct`; mean of draws is `n = shrink * shrink`.

## Files

Backend `backend/src/services/horizonte/stats1/`: `model.ts` (dots, balance), `distributions.ts` (normal, binomial, population and mean of draws),
`contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test: `backend/src/__tests__/horizonte/stats1.test.ts`.

Browser `frontend/src/rebuild/learning/horizonte/stats1/`: generated `contract|model|distributions|scorer|fixtures.generated.ts` (never hand-edited),
`capabilities.ts`, `copy.ts`, `boards.tsx`, `shared.tsx`, `DotPlotBoard.tsx`, `BalanceBoard.tsx`, `NormalBoard.tsx`, `BinomialBoard.tsx`,
`CltBoard.tsx`, `stats1.css`, `audit.json`, `stats1Boards.test.tsx`.

Forge `coursegen/src/v2/horizonte/stats1.ts` (capabilities, authoring guidance, gate-4 solvability checks hand-mirrored from Core);
test `coursegen/src/__tests__/horizonte/stats1.test.ts`.

Fixtures (8): `dot-plot-median`, `dot-plot-mode` (10-12), `dot-plot-mean` (13-17), `balance-level` (10-12), `normal-95`, `normal-68`,
`binomial-fair`, `clt-shrink` (13-17). Preview: `?screen=fixture&seg=hz:stats1:<fixture>&age=<band>`.

## Decisions

- **Exact numbers.** Every check is in whole numbers, so a float never decides a verdict. The only floats are drawing and reading
  aids (the curve, the bars), and none of them is graded.
- **Pictures do not leak.** The normal y-scale uses the axis span, the binomial and the mean-of-draws panels scale to their own tallest bar,
  and the dot plot marks the measure of the current dots, never the target.
- **Prompts carry the numbers.** The dot plot target, the normal band edges, the binomial goal and the shrink factor are written in
  the prompt in digits; the Forge gate refuses a prompt that omits them. Normal prompts must say "either side of the mean" (or the es-MX and
  pt-BR wording), which is what makes the width a whole number of spreads.
- **Handles.** Each distinct dot value has one 64 px chip wrapped in `span.lf-hz-handle`; every board has the Move to menu or step buttons and
  a table toggle plus a text equivalent line.
- **Harness.** `boardContract.tsx` now resolves an input's name from its `<label for>` as well as `aria-label` and `aria-labelledby`.
  The design system `Slider` is named by a `label`, and the check failed on a correctly labelled range input. One line, no other behaviour changes.
- **Copy.** Strings use the default 6-9 Copy Budget band (the strictest), `data` for numbers and statuses; es-MX and pt-BR are native text.
- **Motion.** One transition (the balance beam tilt) under `prefers-reduced-motion: no-preference`, using the duration and easing tokens.

## Status

Implementation: complete in all five layers (Core pack, browser copies, boards, Forge, lane doc). Local verification: Core pack test (16),
frontend board contract and interaction tests (23, including all three locales and the board contract for every fixture),
Forge test (12), the capability parity gate, the copy gate and the sync check. Acceptance and release: not done; they belong to the owner and the
coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement. Everything below was reasoned from the code and jsdom, not looked at.

## Known issues and limits

- **No visual verification.** The SVG layout, label collisions at narrow widths, the beam tilt, the 64 px hit size and the contrast of the
  chosen tokens have not been seen in a browser. jsdom cannot measure layout.
- **The mean of draws is exact, not simulated.** The distribution of the mean is built by convolution, so the picture is identical on every
  render and nothing is random. A learner does not "draw samples and watch a histogram build up"; if the owner wants that, it needs a seeded
  generator and an accepted trade-off on replay.
- **Narrow widths.** The SVG scales down with the viewport, so axis labels and edge labels shrink and can collide on a phone. Dot columns
  get narrow with a wide axis (up to 21 values); the chips and the Move to menu are the accessible route there, not the columns.
- **Binomial grid.** The chance moves in 5% steps and n is at most 40, so a goal needs an exact pair on that grid. Goals that do not have one
  do not parse; an author has to pick from the grid.
- **Axis bounds.** Dot axes are 0 to 100 and 4 to 20 steps wide; curve axes are 0 to 200 and at least 10 steps wide; spreads are whole numbers
  up to 30. Larger data needs a new contract version.
- **Normal and mean of draws read as numbers, not as areas.** The share inside the band uses the exact normal integral, but the board never
  asks the learner to estimate an area.

## Owner follow-ups

- Look at all eight fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off.
- Decide whether the mean of draws should become a seeded simulation (the learner draws samples) or stay exact.
- Review the es-MX and pt-BR strings with a native speaker (they are native-written, not machine copies, but not reviewed).
- Accept and release the two pieces (F1.13, F1.14) in the sprint record.

## Fix round

- **Dark mode.** The stats charts set their text (axis ticks, edge labels), the moved-dot ring and the beam with `var(--ink)`, a constant
  (`#11132a`) that does not flip under `data-theme="dark"`. On the dark chart ground (`--sunken`) the contrast was about 1.1 to 1 (the Atlas counted
  9 to 14 low-contrast items per stats board in dark against 2 to 3 in light, and the beam was invisible). The three uses in `stats1.css` now use
  `var(--content)`, the theme-flipping foreground the other rebuild charts use (`.lf-stats-chart` sets `color: var(--content)`; SVG text follows
  through `currentColor`). No hex, rgb or colour keyword is left in `stats1.css`; a test in `stats1Boards.test.tsx` pins both.
- Series and marker hues (`--sky-strong`, `--mint-strong`, `--accent-strong`, `--primary-strong`) already flip with the theme and are unchanged.

Still limited, not verified: no browser was opened, so the new contrast was reasoned from the token values, not seen; the Atlas should be re-run on
the eight stats1 fixtures in dark at 1280 and 375. The disabled Reset, Check and Move to buttons keep their shared-control contrast (2.3 in light).

## Solvability round

F0.4 solvability checkers for the five stats1 pieces, registered in `coursegen/src/v2/horizonte/solvability-stats.ts` and imported from
`coursegen/src/v2/solvabilityPacks.ts`. Each one reads the public payload alone for everything the payload fixes and compares with the answer
key only when `context.answerKey` is present. The checkers reuse the pack's pure helpers by import (`dotAxis`, `dotsOf`, `measureMet`,
`reachable`, `solveNormal`, `onGrid`, `solveBinomial`, `curveAxis`, `inRange`, `sum`, now exported from `stats1.ts`, plus a new
`measureValue`) and check them against an independent search, so a bug in either side shows up as an "encodings disagree" finding instead of
passing quietly. The pack gates did not change; what they accept is the same, except where the table marks a tightening.

| Type | Proven from the payload alone | Proven against the key | Not proven, and why |
|---|---|---|---|
| `stats.dot-plot.v2` | The axis, dots, measure and move cap are valid; no dot is off the axis (`out-of-bounds`); walking every arrangement within the move cap (state-space search, depth = moves) finds at least one whole value of the measure other than the start's, else `no-solution`. | The target is a whole number on the axis, the start does not already meet it (`impossible-state`), and the pack's `reachable()` reaches it in the cap, else `no-solution`. | Uniqueness: several arrangements meet one target by design (the grade is the measure, not the arrangement), so the accepted set is "the arrangements within the cap whose measure is the target", which `reachable()` enumerates. Dead ends: the cap counts dots moved from the start, so every move can be undone and no arrangement is stuck; a back-edge search would cost about 58 thousand moves on the largest plot for a result that follows from that symmetry. The payload alone cannot name the one target, only the set of reachable targets. |
| `stats.balance-point.v2` | A pivot search over every whole position finds exactly one where the pulls on the two sides cancel (a different statement from the mean the pack uses): none is `no-solution` (a non-whole mean), more than one is `ambiguous-solution`. The pivot starts on the axis and not on the balance point. | The key is `{ target }` only, a whole position on the axis, and equals the balance point (`rubric-gap` or `rubric-accepts-invalid` otherwise). | Dead ends: the pivot is a slider over whole positions with no cap, so a wrong move is undone by another. |
| `stats.normal.v2` | The axis, `sdMax`, start and band are valid and on the axis. A search over every mean and spread the sliders offer finds exactly one curve with the band edges `rule` spreads either side of the mean (`no-solution` or `ambiguous-solution`), and the pack's `solveNormal` must agree. The start is not already the answer. | The key is `{ target: { mean, sd } }` with whole numbers inside the sliders and equals the one curve. | Dead ends: both sliders move over whole steps with no cap and nothing is spent. |
| `stats.binomial.v2` | `nMax`, start and goal are valid, the start sits on the 5 step grid. A search over every count and every percent on the grid finds exactly one pair with the goal mean and variance, else `no-solution` (a variance at or above the mean is named) or `ambiguous-solution`; the pack's `solveBinomial` must agree. The bars do not start on the answer. | The key is `{ target: { n, pct } }`, inside the sliders, and equals the one pair. | Dead ends: count and percent are independent sliders with no cap. |
| `stats.clt.v2` | The weights, `nMax`, start and shrink factor are valid. The spread of one draw is computed in whole numbers (`T*S2 - S1^2`, value i+1 per weight); shrinking the spread of the mean by k takes n = k squared, and the search over 1 to `nMax` finds exactly one n, else `no-solution` (k squared above `nMax`). The start is not already n. | The key is `{ target: { n } }`, inside 1 to `nMax`, and equals the one n. | Dead ends: the sample size is one slider with no cap. **Tightening:** a population with all its weight on one value has no spread, so every n "shrinks" it and the answer is not one n; the checker returns `ambiguous-solution` where the pack gate accepts it. |

Budget: every search spends `context.nodeBudget` per candidate and reports `budgetIssue(...)` on overflow. The largest dot plot (axis 0 to 20,
12 dots, 2 moves) stays under the default 200 000 nodes; a budget of 2 000 returns the budget finding in well under two seconds. The tests are in
`coursegen/src/__tests__/horizonte/solvability-stats.test.ts`: the committed fixtures through `runSolvabilityGate` with and without the key,
at least three adversarial mutations per type refused with the right code, a budget path, and the registry check.

Still limited, not verified: the checkers prove the payload and the key, not the rendering; no browser was opened in this round.
