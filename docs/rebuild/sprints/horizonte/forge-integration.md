# Lane doc: Forge integration (coursegen)

The merge of the 18 Horizonte Forge packs into `coursegen/`, and the work that was needed so the merged tree emits, gates and tests all 64
Horizonte segment types (69 after the later merges and the fix round, see [Fix round](#fix-round-fx-forge)). Pack procedure: [RECIPE.md](./RECIPE.md).
Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

| Item | Value |
|---|---|
| Area | `coursegen/` (Forge), v2 emitter, gates, fixtures |
| Pieces covered | every Horizonte pack: golden, num-a, num-b, balance, stats1, plane1, fin1, fin2, alg1, alg2, geom2, prob, com, sim1, sim2, solids, space1, space2 |
| Segment types added | 64 at the first merge; 69 now (the merges of `feat/horizonte-visual` during the fix round brought `math.number-line.order`, `math.ruler.measure`, `math.fraction-circles`, `geometry.solid-net` and `math.surface-formula`; the fix round itself added no segment type). At the first merge: 64 (golden 1, num-a 7, num-b 3, balance 2, stats1 5, plane1 8, fin1 3, fin2 3, alg1 3, alg2 3, geom2 4, prob 3, com 4, sim1 4, sim2 1, solids 3, space1 4, space2 3). Each is registered once, through its pack, in `horizonte/index.ts` |
| Status | Implemented and locally verified in the worktree. Not accepted, not released, not pushed |

## What the merged tree needed

The packs were built as neutral-payload kinds: the payload holds only ids, enums and numbers (identical in every market), and the learner
text lives in the prompt, the help ladder, the feedback banner, a `labels` record (payload id to localized name, 60 characters at most)
and, for algebra boards, a `notation` (neutral TeX plus a localized spoken form). The v2 emitter and gates of the day assumed that
every string sat inside the payload, so a Horizonte plan could not be written. The change keeps every existing kind byte-identical.

| File | Change |
|---|---|
| `src/v2/contract.ts` | `V2Segment` gains optional `labels` and `notation`. `hasNeutralPayload(type)` is built from `HORIZONTE_FORGE_CAPABILITIES`; it gates every exemption below without widening the global `isNonCopyKey` |
| `src/v2/plan.ts` | A plan segment may carry `notation: { tex }` (neutral). Only a Horizonte kind may; any other kind is refused at parse time. The copy schema documents `labels` and `notation.spokenText` |
| `src/v2/emit.ts` | For a neutral kind the payload is emitted as planned and `labels` and `notation` lift next to it (`horizonteExtras`). Any other copy key is a gate-1 problem. A notation needs its TeX and a spokenText in all three markets, or none. The "payload strings must come from copy" check skips neutral kinds |
| `src/v2/gates.ts` | Text blocks for a neutral kind are the prompt, help, feedback and each label (role option); the payload is not walked as copy |
| `src/v2/carriedGates.ts` | The carried gates read a neutral kind's visible text the same way (prompt, help, feedback, labels) |
| `src/v2/horizonte/num-b.ts` | Two `no-explicit-any` casts replaced by typed shapes (lint error reported by the com lane) |
| `src/v2/cli.ts` | `v2:emit --horizonte [--write-fixture]` runs the Horizonte plans and writes their own fixture file |
| `src/__tests__/v2Emit.test.ts` | Coverage is now the union of the two plan directories; a new block covers the Horizonte plans (see Tests) |
| `src/v2/fixtures/plans-horizonte/` | 37 new plans, `48-` to `84-`, one segment per Horizonte type (64 segments, 63 server-graded) at the first merge; the directory now holds 38 files, because the merges added `85-v2-hz-space2-13-17-15-17-formula.json`, and the plans cover 69 types |
| `src/v2/fixtures/emitted-horizonte.json` | 111 documents (37 lessons by 3 markets) at the first merge; 114 rows now (38 lessons by 3 markets, 69 types, 68 of them server-graded), emitted from those plans |

Hooks confirmed in place: `horizonteGuidanceFor` in `author.ts` (import L26, use L73), `horizontePieceGates` in `gates.ts` (import L53, call
L218), and `HORIZONTE_FORGE_CAPABILITIES` in `contract.ts` (L15 and L71). The three hand-mirrored capability maps are in parity
(`node agent/tools/check-v2-lesson-capability-parity.mjs`), and every `sync-v2-*.mjs --check` is green.

## Why the Horizonte plans live in their own directory

`v2Emit.test.ts` demands that the committed plans cover every segment kind of the contract, so 64 kinds needed plans. They are not in
`fixtures/plans/` because Core's interactive-behaviour gate (`checkV2Behaviour`, run by `npm --prefix backend run forge-v2:check` and by
`forge:v2:dry-run`) had no behaviour space for any Horizonte kind at the first merge and fails closed on a graded segment of an unmodelled kind
(the fix round added the spaces for 63 kinds and the behaviour round the five seeded simulations, so every graded kind has one now; see below). Putting the
rows in the shared `emitted.json` turned Core red: `forge-v2:check` failed at 264 of 453 graded segments, and three backend suites that
read `emitted.json` failed (among them `v2SegmentFeedback`), as did `npm run test` there, whose first step is that check.

The split keeps both gates honest without touching Core or weakening a test: `emitted.json` and `fixtures/plans/` are byte-identical to
before (141 rows, 264 of 264 graded segments pass), and the Horizonte rows are validated by the same Core strict parser on demand:

```
npm --prefix coursegen run v2:emit -- --horizonte --write-fixture
npm --prefix backend run forge-v2:check -- ../coursegen/src/v2/fixtures/emitted-horizonte.json
```

Measured at the first merge: Core's strict contract accepted all 111 documents; the only failures were the 189 graded segments with
"no behaviour space defined for this kind" (0 of 189 pass, no other problem). Measured after the fix round on the 114 rows: the
strict contract and the feedback rules accepted every row, and 225 of 240 graded segments passed the behaviour gate; the 15 that did not were the
five seeded simulations in three markets, "no behaviour space defined for this kind" (see Fix round). The behaviour round then gave those five
kinds a space (`forgeV2HorizonteBehaviour/seeded.ts`): the same 114 rows pass the strict contract and **240 of 240** graded segments pass the
behaviour gate (64,341 states). The 15 failing segments are gone. Nothing in the behaviour gate now blocks promoting the Horizonte plans into
the shared fixture (move the files into `fixtures/plans/` and refresh `emitted.json`); that move is not made here, because it changes the
shared fixture that Core's own tests read (see Owner follow-ups).

The five seeded kinds are graded by Core against the learner's own attempt, which the gate never has. The space therefore grades them with one
fixed synthetic seed, `GATE_ATTEMPT`, used only inside the gate's own grading calls; a seeded kind graded without an attempt is still `invalid`
(it fails closed), so the seed cannot leak into a learner's grade. One fixture note from that round: the `coverage-one-half` fixture was trivially
met (since fixed: goal 93, key level 99), and it is not in `emitted-horizonte.json`, so it affects none of the 240 segments.

## Solvability (F0.4, riding gate 1)

Of the 69 Horizonte types, 68 register an F0.4 checker and one does not: `space.ar-table.v2`, which is ungraded (grading is none, there is no key
or rubric, so there is nothing to solve; `space2Gates` refuses a graded AR step). The registry holds 70 types: those 68 and the two money boards
that shipped before Horizonte (`money.coin-tray.v2` and `money.making-change.v2`, in `solvabilityBuiltins.ts`). The count was re-derived for this
document by loading `solvabilityPacks.ts` and reading `registeredSolvabilityTypes()`, not copied from an earlier count. History: 26 of the 69
before the solvability round (fin1 2, fin2 3, alg1 3, com 4, solids 4, space1 4, space2 3, and the fix round's equation-balance, function-graph
and expression-editor); the round registered 42 more.

| Checker file in `coursegen/src/v2/horizonte/` | Registers | Types |
|---|---|---|
| `solvability-num.ts` | golden 1, num-a 9, num-b 4 | 14 |
| `solvability-plane.ts` | plane1 8, fin1 `money.rate-return.v2`, alg2 `math.line-system.v2` | 10 |
| `solvability-stats.ts` | stats1 5, prob 3 | 8 |
| `solvability-geom.ts` | geom2 4, balance `math.visual-proof.v2` | 5 |
| `solvability-sims.ts` | sim1 4, sim2 1 | 5 |
| `solids.ts` | solids 4 | 4 |
| `space1.ts` | space1 4 | 4 |
| `com.ts` (with `comNetwork.ts`, `comExplorer.ts`, `comCircuits.ts`) | com 4 | 4 |
| `alg1.ts`, `fin2.ts`, `space2.ts` | alg1 3, fin2 3, space2 3 | 9 |
| `fin1.ts`, `solvability-alg2.ts` | fin1 2, alg2 2 | 4 |
| `solvability-balance.ts` | balance `math.equation-balance.v2` | 1 |

`solvabilityPacks.ts` imports every one of these files (an existing test enforces it). Findings ride gate 1 with the `solvability/<code>:`
prefix; every checker reads the public payload for what it fixes and compares with the private key only when the emitter supplies it, so the
release-time run (no key) still proves the board. The pack's own gate-4 function (`numAGates`, `plane1Gates`, and so on) is unchanged and still
proves key versus payload at emit time; the registered checker adds the proofs it names below.

Measured on the committed fixture (`emitted-horizonte.json`, 114 rows): every one of its 240 graded segments has a registered checker, and
`runSolvabilityGate` over all 114 rows returns zero findings both with the private keys (emit time) and without them (release time), in about a
second. The coursegen test `v2HorizonteFixture.test.ts` runs the same two passes.

What each proof means in the table: **solvable** is that at least one answer exists and is reachable from the payload; **unique** is one answer,
or a key that covers every accepted answer (`rubric-gap`, `rubric-accepts-invalid`); **not already solved** is that the untouched start does not
meet the goal; **no dead end** is that no reachable state strands the learner, either searched or argued as the row says; **budget** is counted
work from `context.nodeBudget` (default 200,000, cap 2,000,000) that reports `budget-exceeded` and never "it is fine". "n/a" means the grader
takes one final state, so the proof cannot arise. A proof a row does not name is not made by that checker. Row text is taken from each pack's
lane doc; the test counts quoted there were not re-run for this page.

| Type | Pack | Checker file | What it proves | What stays unproven |
|---|---|---|---|---|
| `math.ten-frame.v2` | golden | `solvability-num.ts` | **Solvable**, **not already solved**: a search over the learner's moves (one frame: add a counter or take back one the learner added; two frames: move a counter across, each at most 10) finds a board other than the start. With a key the target is one whole count per frame, is reached, and is not the start; the whole reachable graph is built and every board still reaches it (**no dead end**). **Unique**: n/a. **Budget**: counted | Frame count against the visual and the total-unchanged rule (they stay in `goldenGates`); the prompt against the target; chips and cell taps reach the same boards, so one move set is modelled |
| `math.rekenrek.v2` | num-a | `solvability-num.ts` | **Solvable**, **not already solved**, **no dead end** from one search (each row slides to any count from 0 to 10, every move reversible). **Unique**: n/a. **Budget**: counted | Which of the equivalent bead states "show seven" means (the key picks one; the checker proves it is reachable and not the start); the prompt against the target |
| `math.abacus.v2` | num-a | `solvability-num.ts` | The same three proofs per rod (the heaven bead toggles by 5, earth beads set the ones of the same half, all ten digits connect; each rod on its own graph, the budget shared across rods). **Unique**: n/a. **Budget**: counted | Reading the prompt as a number and the rod count against it; the bead rule is re-derived, not shared with the board |
| `math.number-line.empty.v2` | num-a | `solvability-num.ts` | **Solvable**, **not already solved**: the state is the landing spot and the jumps used (listed sizes, either direction, inside 0 to 1000, at most `max` jumps); `reachableLandings` gives `no-solution` when no list lands on the target. **Unique**: n/a (any jump list that ends there counts, by design). **Budget**: counted | Whether the prompt asks for a particular jump list; a full jump cap is a dead end only without Reset, and Reset is modelled as always available |
| `math.number-line.zoom.v2` | num-a | `solvability-num.ts` | **Solvable**, **not already solved**, **no dead end** over zoom level, marker and anchors (step, zoom in, zoom out); a sweep test shows every grid point of every committed shape is reachable. **Unique**: n/a. **Budget**: counted | Dragging the marker (the same positions as the finest level, not searched); the decimal reading against the prompt |
| `math.number-line.order.v2` | num-a | `solvability-num.ts` | **Solvable** by direct placement; **not already solved** (the board starts empty); **unique** with a key: exactly one solution and it equals the arrangement the numbers force (`ambiguous-solution`, or `rubric-gap` plus `rubric-accepts-invalid`). **No dead end**: argued, not enumerated (each direct placement raises the count of correct pieces). **Budget**: counted | A search over every drag to a wrong mark; the tray order and the age band for decimal lines (they stay in `numAGates`) |
| `math.clock.v2` | num-a | `solvability-num.ts` | **Solvable**, **not already solved**, **no dead end**: the hour stepper (1 to 12) and the minute stepper in the payload's `step` reach every time from 0 to 719. **Unique**: n/a. **Budget**: counted | Dragging the hands and tapping the face; the prompt time against the key |
| `math.ruler.v2` | num-a | `solvability-num.ts` | The same three proofs over the end stepper, one mark at a time, from the bar's start to the last mark. **Unique**: n/a. **Budget**: counted | The prompt against the target |
| `math.ruler.measure.v2` | num-a | `solvability-num.ts` | **Solvable**: the answer is the far mark minus the near mark (at least 1, so the untouched reading 0 never solves) and the reading stepper reaches it from 0 and back. **Unique** with a key: the text must be exactly that length. **Budget**: counted | That the drawn pencil or strip really sits on those marks (a rendering fact); whole units only |
| `math.pan-balance.v2` | num-a | `solvability-num.ts` | **Solvable**: `reachableDifferences` gives `no-solution` when no placement of the loose weights makes the key difference. **Not already solved**: the accepted set is non-empty and does not contain the all-in-tray start. **Unique**: n/a (any placement with that difference counts). **Budget**: counted | Which difference the prompt asks for ("make both sides equal" means 0); a fractional or non-number key is `impossible-state` |
| `math.array-area.v2` | num-b | `solvability-num.ts` | **Solvable** and **unique**: counting the payload the learner's way gives exactly `arrayAreaAnswer` (`no-solution` on a different count). With a key it must be exactly `{ value }` and equal it. **Not already solved**: the untouched response is incomplete; **no dead end** is vacuous because typing is always available. **Budget**: counted | The scaffold fields (tapped cells, cuts, chips) are neither graded nor searched; the prompt against the visual kind and the age rule (they stay in `numBGates`) |
| `math.ratio-line.v2` | num-b | `solvability-num.ts` | **Solvable** and **unique**: a search over every whole value from 1 to 11,988 keeps those that satisfy the ratio; exactly one must remain (`no-solution`, `ambiguous-solution`) and equal `ratioAnswer`. A key is exactly `{ value }` and equal it. Start and dead end as above. **Budget**: counted | The prompt against the visual (which line, which unit) |
| `math.fraction-wall.v2` | num-b | `solvability-num.ts` | **Solvable**: every `{ n, d }` from 1 to 999 that the grader accepts is enumerated and the set is non-empty. **Unique** as a value (exact form for `equivalent`, any form of the value otherwise); a key naming another value is `rubric-gap` plus `rubric-accepts-invalid`. Start and dead end as above. **Budget**: counted | The wall, bar, product and measure drawings against the payload; like or unlike denominators, proper fractions and the age rule (they stay in `numBGates`); the prompt against the target |
| `math.fraction-circles.v2` | num-b | `solvability-num.ts` | The same enumeration with `circleAnswer` (show, compare, add, subtract), the same key rules, start and dead end. **Budget**: counted | Pointer and one-more or one-less slice interactions (typing is the proven path); the shading and cut state is not graded; like denominators and the age rule stay in `numBGates` |
| `math.visual-proof.v2` | balance | `solvability-geom.ts` | **Solvable**: 3 to 5 distinct formula ids from the figure's pool with the right one among them; the measures pass `proofPayloadFault`. **Unique**: a distractor that gives the same number as the right formula on this figure is a blocking `ambiguous-solution` (new; the pack gate accepts those figures). **Not already solved**: the start has no choice or value, which grades `valid`, never `met`. **No dead end**: choice and number change freely. **Budget**: none (at most five choices and seven figures) | Whether the visual on the segment matches the payload's figure (a checker never sees the visual; gate 4 checks it); the Pythagoras value is the long side `c` while coincidence is judged on `a^2 + b^2` |
| `math.equation-balance.v2` | balance | `solvability-balance.ts` | **Solvable** and **unique**: the public pans fix one x that is a whole number from 0 to 99 (x on neither pan, pans true for every x or for no x, an x outside the range, and a start already solved are refused), and a search over the offered route moves, 16 at most, must leave x alone (a slip never counts as progress). With a key, `{ x }` must cover that x. **Budget**: counted; an exhausted budget is a budget finding, never "unsolvable" | A route longer than 16 offered moves is refused, not weighed; slips are never expanded, so a stranding after a slip is not searched |
| `math.geoboard.v2` | geom2 | `solvability-geom.ts` | **Solvable**: the payload is exactly `{ size }`, 3 to 8; without a key every area from 1 to the full board has a simple band and every fitting triangle and parallelogram is enumerated; with a key, `area2` is in range and the named figure exists at that area. **Unique**: n/a by design (the accepted set is non-empty). **Not already solved**: an untouched board grades `valid`. **No dead end**: pegs can be retapped. **Budget**: counted (`budget-exceeded`) | Whether the prompt's figure wording matches the key; a key reachable only by a tilted band passes here, while gate 4 and Core's axis-anchored sample refuse it. A wide figure name on a board whose only band is the stricter figure is a REVIEW `ambiguous-solution` |
| `math.area-squares.v2` | geom2 | `solvability-geom.ts` | **Solvable** and **unique**: the squares inside a valid outline are one set (`cellsInside`), cross-checked against the shoelace area (none is `no-solution`, more than 32 is `too-large`). A key `{ required }` is compared point by point (a missing square is `rubric-gap`, an extra one `rubric-accepts-invalid`). **Not already solved**: nothing is shaded. **No dead end**: shading toggles | Nothing about the board beyond the prompt text |
| `math.transform.v2` | geom2 | `solvability-geom.ts` | **Solvable** and **unique**: the image is a function of the public move (`imageOf`), the grader compares an unordered set so corner order is never a second answer, and injectivity is checked (defensive). **Not already solved**: an image equal to the figure is refused. **No dead end**: a dragged point can be dragged again. A key `{ required }` is checked per point | The `symmetry-mirror` rule needs the segment's visual, which a checker never sees; the pack gate keeps it |
| `math.tessellation.v2` | geom2 | `solvability-geom.ts` | **Solvable**: the pack's exact-cover search under `context.nodeBudget` with the listed moves (no cover is `no-solution`; running out of steps is `budget-exceeded`, never `no-solution`). **Unique** in the copy count (floor cells divided by tile cells), not in the cover; a key `{ copies }` goes through `checkRubricCoverage`. **Not already solved**: an empty floor is refused. **No dead end**: a placed copy can be lifted. **Budget**: counted | Which moves the learner will think to try; the checker's budget is larger than the pack's fixed 60,000, so it can prove a cover the pack refuses as out of steps |
| `stats.dot-plot.v2` | stats1 | `solvability-stats.ts` | **Solvable**: a search over every arrangement within the move cap finds a whole value of the measure other than the start's; with a key the target is a whole number on the axis and `reachable()` reaches it in the cap. **Not already solved**: the start does not meet the target. **Unique**: n/a (many arrangements meet one target). **No dead end**: argued (the cap counts dots moved from the start, so every move can be undone). **Budget**: counted | The payload alone cannot name the one target, only the set of reachable targets; dead ends are argued, not enumerated (a back-edge search would cost about 58 thousand moves on the largest plot) |
| `stats.balance-point.v2` | stats1 | `solvability-stats.ts` | **Solvable** and **unique**: a pivot search over every whole position finds exactly one where the pulls cancel (`no-solution` for a non-whole mean, `ambiguous-solution` for several). **Not already solved**: the pivot starts off the balance point. A key is `{ target }` and equals it. **Budget**: counted | Dead ends are argued (a slider with no cap), not searched |
| `stats.normal.v2` | stats1 | `solvability-stats.ts` | **Solvable** and **unique**: a search over every mean and spread the sliders offer finds exactly one curve with the band edges `rule` spreads either side of the mean, and `solveNormal` agrees. **Not already solved**. A key is `{ target: { mean, sd } }` and equals it. **Budget**: counted | Dead ends are argued (two sliders over whole steps), not searched |
| `stats.binomial.v2` | stats1 | `solvability-stats.ts` | **Solvable** and **unique**: a search over every count and every percent on the 5-step grid finds exactly one pair with the goal mean and variance, and `solveBinomial` agrees. **Not already solved**. A key is `{ target: { n, pct } }`. **Budget**: counted | Dead ends are argued (independent sliders), not searched |
| `stats.clt.v2` | stats1 | `solvability-stats.ts` | **Solvable** and **unique**: the spread of one draw is computed in whole numbers and a search over 1 to `nMax` finds exactly one sample size (k squared). **Not already solved**. A key is `{ target: { n } }`. **Budget**: counted. **Tightening**: a population with all its weight on one value is `ambiguous-solution`, where the pack gate accepts it | Dead ends are argued (one slider), not searched |
| `prob.tree.v2` | prob | `solvability-stats.ts` | **Solvable** and **unique**: a placement search over the tray, checking the tree's relations as each branch fills, finds exactly one tree (two chips with the same count are refused). **Not already solved**: the tray starts empty. A key `{ solutions }` (at most 64 trees) must equal the set of valid placements (`rubric-gap`, `rubric-accepts-invalid`). **Budget**: counted | Dead ends are argued (a chip can be dragged back), not enumerated |
| `prob.bayes.v2` | prob | `solvability-stats.ts` | **Solvable**: the chance is an exact fraction of whole head counts and sits between 1 in 20 and 19 in 20. **Unique**, **not already solved**, **no dead end**: n/a (one number to type, no start state or move). With a key: the target equals the fraction, the tolerance is at most 0.01, the review band is wider and at most 0.1. **Tightening**: no distractor (a mix-up of the grid cells) that differs from the answer may sit inside the tolerance. **Budget**: fixed work, one division of whole counts | Nothing beyond the rendering and the prompt |
| `prob.regression.v2` | prob | `solvability-stats.ts` | **Solvable** and **unique**: the closed form (`exactFit`) and a search over every slider line must agree, on a slider position and inside the sliders; not an exact fit; one minimum (`ambiguous-solution` on a tie). **Not already solved**: the start is not the best line. A key carries `target`, a tolerance of at most 0.05 that admits exactly one slider line. **Budget**: counted per slider line | Dead ends are argued (two sliders in tenths, no cap); a tie cannot occur on valid input and the search proves it only for each plot it sees |
| `alg.slope-triangle.v2` | plane1 | `solvability-plane.ts` | **Solvable**, **unique**, **not already solved**, **no dead end** (reachable on the slider), **budget** (one node per control position): rise 0 to `yMax - from.y` is scanned with a goal predicate written again from the task, and exactly one position that is not the start must meet it and equal the solver's answer. The key is exactly `{ target }` with the right value; a supplied `prompt` must name the run | Prompt wording beyond naming the run; the triangle sitting on the line as drawn |
| `alg.rate-of-change.v2` | plane1 | `solvability-plane.ts` | The same five proofs over `y` from `yMin` to `yMax` (`y == origin.y + rate * (at - origin.x)`); the prompt must name the step | Prompt wording beyond naming the step; that the table beside the graph shows the same values |
| `alg.linked-views.v2` | plane1 | `solvability-plane.ts` | The same five proofs over slope -9 to 9 by intercept `yMin` to `yMax`: the line through both table rows is the only one | A table row that is a non-record is reported as a range error, not as its own finding; the plain-English equation and its spoken form |
| `fin.break-even.v2` | plane1 | `solvability-plane.ts` | The same five proofs over units 0 to `maxUnits` (`price * u == fixed + unit * u`) | The facts line and status text; the Break-even word in the prompt |
| `fin.cost-structure.v2` | plane1 | `solvability-plane.ts` | The same five proofs over units 1 to `maxUnits` (`fixed + variable * u == goal.average * u`) | The same as break-even |
| `fin.margin-markup.v2` | plane1 | `solvability-plane.ts` | The same five proofs over price 0 to `maxPrice`, above cost (markup on cost or margin on price equals `percent`) | Whether the `basis` word in the prompt is the one the learner reads; the two bases shown side by side are the only guard |
| `econ.market-shift.v2` | plane1 | `solvability-plane.ts` | The same five proofs over two scans of price 0 to `pMax` (before and after the shift); the direction is the sign of the move; a key direction of `unset` is `rubric-gap` | Prompt wording; the shifted curve drawn as the task says; the Shortage and Surplus text |
| `econ.elasticity.v2` | plane1 | `solvability-plane.ts` | The same five proofs over price 1 to `pMax` (`den * b * price == num * (a - b * price)`, quantity above zero) | Prompt wording; the Inelastic, Unit elastic and Elastic words |
| `money.compound-interest.v2` | fin1 | `fin1.ts` | **Solvable**: some rate and years on the sliders reach the challenge (none is `no-solution`; most positions meeting it is a REVIEW `vacuous-rubric`). **Unique**: one predicted option is nearest the true value (a tie is `ambiguous-solution`). **Not already solved**: the fixed case does not meet the challenge. **Budget**: counted. A key must name the nearest option and the explanation `interest-on-interest` | No dead-end proof; prompt wording and the slider layout |
| `money.time-value.v2` | fin1 | `fin1.ts` | **Solvable** and **unique**: an order task values every order of the payments (one budget unit each; equally good orders are `ambiguous-solution`); an annuity derives the one timing. **Not already solved**: the listed order is not already the best. A key `{ solutions }` must hold the best arrangement and nothing else. **Budget**: counted | No dead-end proof |
| `money.rate-return.v2` | fin1 | `solvability-plane.ts` | Per case (effective, card, NPV, IRR): the payload reads, the model answer fits its answer box, the key target equals the model answer, and no decoy (nominal rate, flat interest, undiscounted gain, simple average return) lands inside the band (a REVIEW without a key, a block with one). IRR: a rate below 100 percent exists and some dial position is within the tolerance (else `dead-end`). **Budget**: counted | The decoy list is a heuristic and a different wrong figure inside the band is not found; the segment's optional `prompt` is not read; the IRR dial step is taken from the board source, not tested; the 600-month and answer-box limits are defensive and unreachable |
| `math.algebra-tiles.v2` | alg1 | `alg1.ts` | **Solvable** and **unique**: at least one zero pair and the one reduced answer, by a budgeted `searchAssignments`. With a key, the derived set is compared both ways (`rubric-gap`, `rubric-accepts-invalid`). **Budget**: counted | The key is judged only by the checker, not repeated in `alg1Gates`; the disguise and notation rules are gate 4 |
| `math.algebra-cards.v2` | alg1 | `alg1.ts` | **Solvable**, **unique or covered**, **not already solved**: every subset of the supply cards is tried, giving one to eight distinct isolations, none of them the start; the key is compared both ways. **Budget**: counted | Cards never merge (each is one signed integer 1 to 9 and only an exact opposite cancels), so the proof holds for that move rule only |
| `math.area-model.v2` | alg1 | `alg1.ts` | **Solvable**, **unique or covered**: the derived placements (a fixed set for `cells` and `square`, a bounded `searchAssignments` over the pool for `edges`), one to eight, and the pool must hold every needed piece; the key is compared both ways. **Budget**: counted | The same split between checker and gate 4 as the tiles |
| `math.line-system.v2` | alg2 | `solvability-plane.ts` | **Solvable** and **unique**: a scan of every grid point of the window (doubled coordinates, so a half step is exact) counts the points on two or more lines; that count equals the number of markers. **Not already solved**: the markers do not start on the crossings. **No dead end**: every crossing is a grid point inside the window. **Budget**: one node per grid point. A key is exactly `{ required: [{ x, y }, ...] }` | The crossings are fixed by the lines and the pack's reader already derives them, so the scan is a second derivation, not an independent source of truth; the segment's `prompt` is not read |
| `math.function-graph.v2` | alg2 | `solvability-alg2.ts` | **Solvable**: a curve of the family (line, quadratic, exponential) on the sliders goes through every mark (derived for a line and a quadratic, a scan of the base slider for an exponential). **Not already solved**: the start is not the only such curve. **Budget**: counted, for the exponential scan only. Never reads the key | Uniqueness is not tested as its own proof; a graph with no marks has nothing to prove, and a graph whose answer only the key names cannot be proven at release time |
| `math.expression-editor.v2` | alg2 | `solvability-alg2.ts` | **Solvable**: a solve task is one linear equation with an answer (identical sides are `ambiguous-solution`, a constant difference or a degree above 1 is `no-solution`); a rewrite is a polynomial and a factored rewrite is not a single term. **Not already solved**: the shared model's `expressionTaskProblem` refuses a given that already has the finished form. **Budget**: none (closed form). Never reads the key | Whether a factored rewrite exists for an irreducible single bracket is not decided; what a stored rubric accepts is not checked here |
| `math.network-count.v2` | com | `com.ts` (`comNetwork.ts`) | `duplicate-id` and `dangling-reference` first. `odd` and the order-mode tree and Pascal have one derived answer (no search). A trail, a route and a group tree are predicate-graded searches that need one solution (`no-solution` otherwise), and every key example is checked against the rule (`rubric-accepts-invalid`). **Budget**: counted | Uniqueness in the predicate-graded modes (the scorer grades by the rule, so the key lists examples); a Pascal payload with no multiple is `impossible-state` |
| `trig.unit-circle.v2` | com | `com.ts` (`comExplorer.ts`) | **Solvable** and **unique**: the answer is computed, the 360 whole angles are scanned through `verifyUniqueOrCovered`, and the key must equal the model (`impossible-state` otherwise). **Budget**: counted | Start and dead-end proofs are not made |
| `calculus.explorer.v2` | com | `com.ts` (`comExplorer.ts`) | Riemann scans the whole values of n through `verifyUniqueOrCovered`; accumulation scans the x values of its interval (`no-solution` when nothing meets the target, `ambiguous-solution` when two values do); the secant and linked graphs have one derived answer and need no scan; the key must equal the model. **Budget**: counted | Start and dead-end proofs are not made |
| `computing.bits-gates.v2` | com | `com.ts` (`comCircuits.ts`) | Bits proves the target is reachable and the key sums to it. Gates searches placements of tray gates over the positions and requires one that reproduces the truth table (`no-solution` otherwise); a `loose` run reads an unsolvable circuit as `no-solution`. **Budget**: counted | Uniqueness of a gate arrangement (the scorer grades by the rule); start and dead end are not proven |
| `money.cash-flow.v2` | fin2 | `fin2.ts` | The statement has nothing to search (the key is authored), so the checker proves the payload, the key shape and that the goal token matches the totals | No search, so no uniqueness, start or dead-end proof; no budget spent |
| `reasoning.decision-grid.v2` | fin2 | `fin2.ts` | **Solvable**, **unique or covered**: the visual is inferred from the payload (points mean two-by-two, criteria and scores mean decision matrix) or from the key's slot names; two-by-two and decision matrix search the board's arrangements and the key must cover every solution (`rubric-gap`) and accept only solutions (`rubric-accepts-invalid`). A tie is `ambiguous-solution` (no key) or `rubric-gap`; coincident two-by-two points are a REVIEW `overlap`. **Budget**: counted | A SWOT, Eisenhower or canvas grid without a key is proven by the payload alone; start and dead end are not proven |
| `plan.schedule-board.v2` | fin2 | `fin2.ts` | `duplicate-id` and `dangling-reference` on the prerequisites first. A Gantt over start periods, a timeline over distinct steps in topological order and a kanban over todo and doing are searched; Gantt and timeline are predicate-graded (one solution needed, key examples checked against the rules); the kanban key must equal the one valid board. **Budget**: counted | Uniqueness of a Gantt or timeline (graded by rule); start and dead end are not proven |
| `geometry.solid-viewer.v2` | solids | `solids.ts` | **Solvable** and **unique**: zero matching solids is `no-solution`, several is `ambiguous-solution`, and a question that counts the thing it searches by is `impossible-state`. A key `{ solid, count }` is compared to the derived answer. **Budget**: none counted (a closed form over the listed solids) | Start and dead end are not proven |
| `geometry.cube-net.v2` | solids | `solids.ts` | By mode. Label: exactly one naming of the faces (`no-solution`, `ambiguous-solution`) and key coverage. Complete: at least one completion exists and every key solution folds into a cube with the placed squares. Area: the six squares are a cube net that fits the grid, and the key is the computed surface area. **Budget**: none counted (eleven nets and 24 namings searched exhaustively) | Whether the learner finds the net by the route the prompt implies |
| `geometry.solid-net.v2` | solids | `solids.ts` | Label has exactly one answer; a complete net needs at least one fitting completion and at least one net ruled out; the area key is the surface area. **Budget**: none counted | Label mode takes its key from the rubric, which Core already validated against the real labellings; complete mode re-derives the pack's unfolding convention rather than simulating a fold |
| `geometry.cube-stack.v2` | solids | `solids.ts` | **Solvable**: some stack of the grid shows the views (`no-solution` otherwise). **Not already solved**: the start is not the answer and holds at least one cube. With `fewest`, the key equals the minimum, and every key solution must show every view. **Budget**: none counted (exact, at most 4^9 stacks) | Dead ends are not proven |
| `geometry.mental-rotation.v2` | space1 | `space1.ts` | **Solvable** and **unique**: no target that matches by turning is `no-solution`; two or more matching targets, or a distractor that also matches, is `ambiguous-solution`; a key whose angles or pick differ from the computed ones is `rubric-gap` or `rubric-accepts-invalid`. **Budget**: none counted | Start and dead end are not proven; the geometry is a self-contained copy (`space1Geometry.ts`), pinned to Core's by tests rather than shared |
| `geometry.solid-section.v2` | space1 | `space1.ts` | **Solvable** and **unique**: a missing cut, or options lacking the cut, is `no-solution`; an option that is also true is `ambiguous-solution`. `euler` and `volume` prove the answer from the payload (a Platonic solid that breaks V minus E plus F equals 2 is `impossible-state`); a key that is not that answer is a rubric finding. **Budget**: none counted | The same as the rotation row |
| `money.market-stall.v2` | space1 | `space1.ts` | **Solvable**: an unreachable total or a budget that buys nothing is `no-solution`; a budget that buys the whole stall is `impossible-state`; every key basket must be fillable from the stall and meet the goal (`rubric-accepts-invalid`). **Budget**: none counted | The key lists examples, not every solution, because the scorer grades by predicate, so there is no `rubric-gap` for the stall |
| `money.coin-stack.v2` | space1 | `space1.ts` | One derived answer: null is `no-solution`, an answer outside one step to `max` is `out-of-bounds`, anything else wrong is `impossible-state`. **Budget**: none counted | Start and dead end are not proven |
| `math.surface.v2` | space2 | `space2.ts` | **Solvable** and **unique**: a tie or a margin miss is `ambiguous-solution`, an unreachable target is `no-solution`, a flat surface is `impossible-state`; the key `{ choice }` is compared to the derived answer (`rubric-gap` plus `rubric-accepts-invalid`). **Budget**: none counted | Start and dead end are not proven |
| `geography.globe-route.v2` | space2 | `space2.ts` | **Solvable** and **unique**: a route to itself is `impossible-state`, a repeated corridor is `duplicate-id`, a distance winner inside the 2 percent margin or a tie is `ambiguous-solution`; the key `{ choice }` is compared to the derived answer. **Budget**: none counted | Start and dead end are not proven |
| `math.surface-formula.v2` | space2 | `space2.ts` | The payload is read with the shared formula engine (`space2Formula.ts`): a walk that never reaches the line is `no-solution` and a malformed or undefined task is `impossible-state`. The key must be `{ key }` (one exact number as text per box) equal to the derived answer, or `{ reference }` for a build, whose formula must pass through every dot (`rubric-accepts-invalid` otherwise). **Budget**: the engine's own evaluation meter (400 evaluations), not `context.nodeBudget` | Start and dead end are not proven |
| `space.ar-table.v2` | space2 | none | Not registered: ungraded, with no key or rubric, so there is nothing to solve. `space2Gates` refuses a graded AR step | Nothing to prove |
| `math.chance-sim.v2` | sim1 | `solvability-sims.ts` | **Solvable**: the chance is rebuilt from the machine and event (5 to 95 percent), and a run at the last stop must clear the pack's 5-sigma rule and an exact binomial miss of at most 1e-4 (`no-solution`). **Unique**: one exact reduced fraction as the key; the stop just below the floor must not already be reliable (`ambiguous-solution`). **Not already solved**: the floor is never the first stop, so the untouched start can never meet it. **No dead end**: Reset and Run are always available. **Budget**: counted, one unit per trial of the last stop and the stop below the floor | The learner's actual seeded run (Core grades against a seed the gate never has), any stop between the floor and the last, the prompt writing the tolerance in digits (pack gate), and whether the tolerance is pedagogically fair |
| `math.galton-sim.v2` | sim1 | `solvability-sims.ts` | The same five proofs with the exact binomial bin chance (`binChance`) and the same last-stop and floor rules; **budget** at most about 6,000 units | The seeded run; the prompt naming the bin and the tolerance (pack gate); the board and walk rendering |
| `stats.coverage-sim.v2` | sim1 | `solvability-sims.ts` | **Solvable**: `solveCoverage` finds a level that reaches the goal with probability at least 1 - 1e-5 (`no-solution`). **Unique**: the key is exactly that lowest level; a lower cell the board accepts on at least 99 percent of seeds is only a REVIEW `ambiguous-solution`. **Not already solved**: the answer sits above the start level and the start cell does not reach the goal on 99 percent of seeds or more. **No dead end**: sliders are reversible. **Budget**: counted, at most about 25,000 units | The learner's seeded 100 intervals; cells that reach the goal on between 1 - 1e-5 and 99 percent of seeds (accepted, not flagged); the prompt naming the goal |
| `stats.bootstrap-sim.v2` | sim1 | `solvability-sims.ts` | **Solvable**: the exact edges come from every possible resample, and the last stop must settle both within the tolerance with probability at least 1 - 1e-5 (`bootstrapSolvable`). **Unique**: the key is the exact `{ low, high }`, and the stop below the floor must not already settle both (`ambiguous-solution`). **Not already solved**: the floor is a stop of at least 50 and never the first. **No dead end**: Reset and Resample are always available. **Budget**: counted, at most about 56,000 units | The seeded run; the pack's rank rule at very small resample counts; the prompt writing the floor and the level |
| `money.life-sim.v2` | sim2 | `solvability-sims.ts` | **Solvable**: every history of every choice is enumerated (8 outcomes per chapter) and at least one choice reaches the goal with probability at least 1 - 1e-5 under the scenario rule (`no-solution`). **Unique**: a choice between 1e-4 and 1 - 1e-5 is `ambiguous-solution`; the key must be exactly the answer list in the order of the choices. **Not already solved**: the start choice is not an answer. **No dead end**: the slider is reversible and every chapter replays from the same start. **Budget**: counted, 37,448 units on the largest board (8 choices, 5 chapters) | The learner's seeded 100 futures (the replay decides `met` or `review`); whether the money model is realistic; the prompt writing the goal in digits (pack gate); the spacing of the choices |

Where a checker is stricter than its pack gate (so a payload the gate accepted can now be refused or flagged): `stats.clt.v2` (all weight on one
value), `prob.bayes.v2` (the distractor rule), `math.visual-proof.v2` (a coincident distractor blocks), the seeded simulations (the floor must bind;
a lower cell that is nearly always met is flagged), and `math.geoboard.v2` and `math.tessellation.v2` (REVIEW and a larger budget). No fixture row is
affected; that was measured above.

What no checker proves, in any row: the rendering (layout, hit size, contrast, motion, the screen reader), the locale text and the tone, how long a
learner takes, or whether the private key was written from the same wrong reading as the payload. Checkers also tie their model to the pack by
import or to Core by a pinned copy, so a later change to Core's scorer is caught by the pack tests, not by the checker.

Guard: `v2Emit.test.ts` corrupts the private key of every server-graded Horizonte segment three ways (add one, negate, triple) and
requires gate 1 or 4 to refuse at least one corruption for every kind. All 63 graded kinds did at the first merge, and the test was green in
the fix round's coursegen run over the plans as they stand; it was not re-run for this page. That test proves a key is checked against the
payload; uniqueness and dead ends are proven only where a row above says so, which is now 68 types, not 26.

## Authoring and gate findings that shaped the fixtures

- Gate 19 (feedback): a graded step for ages 10 and up needs `feedback.met`, and feedback may not contain a digit the step does not show.
  The fixture feedback is therefore digit-free and written per pack in the three markets.
- Gate 16 (regional): pt-BR prices read `R$ N`, never `$N`, in titles and prompts.
- Gate 12 (tone): the word "job" is a never-use term, so the weekend pay lesson reads "Weekend pay".
- Gate 2 (vocabulary) needs the taxonomy, so every plan uses `course_id: financial-education` with a real pathway of that course.

## Tests

| Command | Result |
|---|---|
| `npm --prefix coursegen run type-check` | green (first merge; the fix round re-run is under Fix round) |
| `npm --prefix coursegen run lint` | green |
| `npm --prefix coursegen run test` (capped at 3 threads and forks) | First merge: 80 files, 1220 tests, green (the fix round re-ran a focused subset, listed under Fix round). Includes `src/__tests__/horizonte` (281), `v2Emit` (44), `v2Solvability`, `v2CarriedGates`, `v2Release`, `releaseEvaluate`, `glossary`, the contract, gates and author suites |
| `npm --prefix backend run forge-v2:check` | OK at the first merge, 141 rows, 264 of 264 graded segments pass (the shared `emitted.json`, untouched) |
| backend `forgeV2Emitted`, `forgeV2Behaviour`, `v2AgeScope`, `v2ChartModel`, `v2ConceptBoards`, `v2SegmentFeedback` (vitest, read only) | 45 of 45 pass |
| `forge:release-gates:check` and `forge:v2:dry-run` | Not run, by instruction. Read instead: the release-gate parity script compares gate numbers only (the pack gates all use gate 4), so no new type can trip it; the dry-run emits `fixtures/plans/` and checks it with Core, which is unchanged and green |

New `v2Emit.test.ts` block ("the committed Horizonte plans"): zero-spend emit of every committed plan (37 at the first merge, 38 now), equality with `emitted-horizonte.json`,
payload identical in the three markets and rubric private (only `labels` and `notation` may ride beside the base fields), labels and
spoken notation lifted per market with neutral TeX, the corrupted-key guard, and refusal of a notation on a non-Horizonte kind, a
notation without its spoken text, and stray copy in a neutral kind.

## Not verified, not accepted, not released

- Fixture copy is synthesized for the gates, not authored for learners: the feedback banners, the es-MX briefs and the pt-BR and es-MX
  renderings have had no native review, and the fixtures were produced by a script, not by a model call.
- `notation.spokenText` is not scanned by the tone or vocabulary gates (it matches how the existing notation fields are skipped).
- Superseded by the fix round and the behaviour round: Core now has a behaviour space for every graded Horizonte kind, the five seeded
  simulations included, and a coursegen test and a backend test read `emitted-horizonte.json` (see Fix round and Behaviour round). At the
  first merge neither existed.
- `forge:release-gates:check` and `forge:v2:dry-run` were not run. The push gate has not run. No requirement row or sprint entry is closed.
- No live generation, publication or Vault write happened.

## Limits

- One segment per type per fixture: the plans prove that every kind emits and gates, not that a full lesson built from them is a good lesson.
- A neutral kind cannot take a string in its payload; a pack that needs a new localized field must route it through `labels` or `notation`.
- `labels` entries are 60 characters at most (Core's fin2 contract); `notation` TeX is 200 characters at most, spoken text 160.

## Owner follow-ups

- Decide whether to promote the Horizonte plans into the shared `fixtures/plans/` and `emitted.json`. The behaviour gate no longer blocks it (the
  five seeded simulations have a space, 240 of 240 graded segments pass), but the move changes the fixture that Core's own backend suites read.
  The `coverage-one-half` fixture was trivially met (since fixed in the pedagogy lane); it is not in the emitted file.
- Run `forge:v2:dry-run` and `forge:release-gates:check` once, at the push gate, on the final tree.
- Have the pack lanes replace fixture copy with authored lessons, and have a native reader review es-MX and pt-BR.
- Decide whether findings should keep riding gate 1 with the `solvability/<code>:` prefix or get a dedicated gate. A dedicated gate (gate 20)
  needs a database migration and a re-attestation of released content, so it is an owner decision.
- The 68 of 69 Horizonte types now register an F0.4 checker (see Solvability). The one that does not, `space.ar-table.v2`, is ungraded. What
  stays unproven is named per row: dead ends are argued rather than enumerated on the slider boards, and the rendering is outside every checker.

## Fix round (fx-forge)

Worktree `hz/fx-forge`, cut from `feat/horizonte-visual` and merged with it twice (`6d70b825`, `ed365f73`; the base was an ancestor again at the
end). Nothing is pushed, accepted or released. No new lane doc, no COVERAGE.md edit.

### What changed

| Area | Change |
|---|---|
| F0.4 solvability | Three checkers in `coursegen/src/v2/horizonte/`: `solvability-balance.ts` (`math.equation-balance.v2`: the x the public pans fix is derived, and the checker refuses x on neither pan, a start already solved, pans true for every x or for no x and an x that is not a whole number from 0 to 99; then a bounded search over the offered route moves, 16 at most, where a slip never counts as progress; with a key, the rubric must be `{ x }` and cover that x) and `solvability-alg2.ts` (`math.function-graph.v2`: the marks must pin one curve of the family that sits on the sliders and is away from the start, with a budgeted scan of the base slider for exponentials; `math.expression-editor.v2`: a solve task must be one linear equation, a rewrite must be a polynomial, and a factored rewrite is not a single term). They read the public payload, so they run at release time without a key, which the pack gates only partly do. Neither alg2 checker reads the key. Registered through `solvabilityPacks.ts`. Tests: `__tests__/horizonte/solvability-balance.test.ts` (11) and `solvability-alg2.test.ts` (14), with a comparison against the pack gate for small balance boards and against a brute force over the slider grid for lines |
| Per-type table | The Solvability section above was rewritten after the solvability round: one row per type, with the checker file, what it proves and what stays unproven. The fix round's own table had one row for each of the 43 types then unregistered |
| Behaviour space | `backend/src/services/forgeV2Behaviour.ts` gets one hook: its default branch asks `horizonteBehaviourSpace` (`backend/src/services/forgeV2HorizonteBehaviour/`, one module per pack plus `shared.ts`, `arrange.ts`, `rational.ts`). Each builder reads the public payload and the private rubric, derives its own key with an evaluator that shares no code with Core's scorer, enumerates the in-range states, the refused states and the untouched start, and states the diagnostic Core should store for each review state. A builder returns `null` (the gate fails closed) for anything it does not model: a missing field, an unknown mode or a payload with no single answer. Enumeration is capped (`SPACE_LIMIT` is 3,000 in `shared.ts`; the test asserts at most 6,000 in-range states per space) |
| Kinds modelled | 63 of the 69 Horizonte types at the end of the fix round. Left fail-closed then: the five seeded simulations (`math.chance-sim`, `math.galton-sim`, `stats.bootstrap-sim`, `stats.coverage-sim`, `money.life-sim`), which Core grades against an attempt the gate never has; the behaviour round has since modelled them (see below). `space.ar-table.v2` has no space because it is ungraded and the gate skips it |
| Newest pieces | The two merges added models for tessellation motions, number-line order, ruler reading, fraction circles, the space1 polyhedra and slide pieces, surface-formula (slope, gradient, walk and build tasks), cube-net area and all three modes of `geometry.solid-net.v2` (label, complete and area) |
| Coursegen test | `src/__tests__/v2HorizonteFixture.test.ts` (8 tests) reads `emitted-horizonte.json` as written: row identity, capabilities, rubric privacy, age and payload scope, every document gate with the private keys and the regional policy, the solvability gate at release time (no keys) and at emit time (with keys), and a negative test (stale capability list, leaked rubric, wrong key) |
| Backend tests | `src/__tests__/forgeV2HorizonteBehaviour.test.ts` (624 tests) holds every fixture of every modelled kind, in all three markets, to Core's own gate, replays each fixture's ladder through Core's grader, checks that wrong keys are refused by Core's contract and that the model catches scorer drift, and fails closed on payloads it cannot model. `src/__tests__/forgeV2HorizonteFixture.test.ts` (7 tests) runs `emitted-horizonte.json` through `checkForgeV2Rows` by relative path with no cross-package import, and skips when the file is absent |
| Counts | Emitted file: 114 rows, 38 lessons, 69 types, 240 graded segments over the three markets. Types: 69 (64 at the first merge); registered checkers then 26 and unregistered 43 (superseded: 68 registered and one unregistered after the solvability round, see Solvability) |

### Measured

| Check | Result |
|---|---|
| Behaviour gate, hand-built fixtures, en-US | 75 of 80 graded fixtures passed at the end of the fix round (0 of 189 before it, at the first merge); the 5 that failed were the seeded simulations (modelled since, see Behaviour round) |
| Behaviour gate, `emitted-horizonte.json` | At the end of the fix round: 225 of 240 graded segments passed, 64,236 states checked, pass rate 0.9375; the 15 failures were the five seeded kinds in three markets with only "no behaviour space defined for this kind". Now 240 of 240 and 64,341 states (see Behaviour round) |
| `npm --prefix backend run type-check` | green |
| `npm --prefix coursegen run type-check` | green |
| backend `forgeV2HorizonteBehaviour` and `forgeV2HorizonteFixture` (vitest, 3 threads and forks) | 631 of 631 |
| coursegen `v2HorizonteFixture`, `v2Solvability`, `v2Emit`, `v2CarriedGates`, `v2Release`, `src/__tests__/horizonte`, `src/v2` | 25 files, 508 tests, green |
| `node agent/tools/check-v2-lesson-capability-parity.mjs` | OK |
| eslint on the new and edited backend model and test files | clean |

### What is still limited

- The solvability checkers prove only what the public payload determines. A function graph with no marks has nothing for the checker to prove,
  and a graph whose answer only the key names cannot be proven at release time; the key-versus-payload half stays in the pack gate, at emit
  time. The equation-balance checker also reads the key when there is one; the two alg2 checkers never do.
- Expression editor: whether a factored rewrite exists for an irreducible single bracket is not decided; the checker refuses a single term and non-polynomials only, and a solve task that is not one linear equation.
- At the end of the fix round the sim1 and sim2 kinds were fail-closed in the behaviour gate. That limit is gone (see Behaviour round); joining the shared `emitted.json` is now an owner decision, not a gate failure.
- Core's contract already refuses a wrong key or a rubric that disagrees with the scorer, so a wrong-key tampering never reaches the behaviour
  gate. The model's own derivation is a second line that catches scorer-versus-model drift; the drift tests use edits Core still accepts.
- Some models are bounded or sampled rather than exhaustive: class-board BFS is bounded; the expression-editor vocabulary is a bounded set; geom2 states, tessellation covers, regression
  lines, trail, route, tree and pascal boards, gates, the cube-net complete mode, size-3 cube stacks and market-stall baskets are sampled.
  The function-graph builder returns null for rubrics with extra keys.
- Diagnostics are compared only on review states, as the gate does; a met state is not compared.
- Solid-net label mode takes its key from the rubric (Core's contract has already validated it against the real labellings), so it is a weaker independent check
  than the area and complete modes. Solid-net complete mode re-derives the pack's unfolding convention (face cycles, hinge slots, the sheet fit) rather than simulating a fold;
  it is a differential check, enumerated exhaustively, not a physical simulation.

### What is not verified

- Real browser behaviour: nothing here ran a page. At the end of the fix round the sim1 and sim2 kinds had no behaviour space and were not exercised by the gate; the behaviour round models them with a synthetic seed, which is a model of the grader, not a browser run.
- `forge:release-gates:check`, `forge:v2:dry-run` and the push gate were not run. No requirement row or sprint entry is closed.
- Fixture copy is still synthesized, not authored or natively reviewed.

## Behaviour round (supersedes the five fail-closed statements above)

Core's behaviour gate now has a space for the five seeded simulations (`math.chance-sim.v2`, `math.galton-sim.v2`, `stats.coverage-sim.v2`, `stats.bootstrap-sim.v2`,
`money.life-sim.v2`). On `emitted-horizonte.json`, `forge-v2:check` reports 240 of 240 graded segments passing (64,341 states), not 225 of 240, and every Horizonte graded
kind has a space. The earlier statements that the five kinds are left fail-closed, and that the file cannot join the shared `emitted.json` for that reason, no longer hold.
A seeded kind graded without an attempt is still `invalid`. See `behav.md`.

From the behaviour round (`behav.md`; not re-run in this pass): `emitted-horizonte.json` is 114 rows and 240 graded segments, 240 of 240 pass the behaviour gate (64,341 states), and
all 114 rows pass Core's strict contract (225 of 240 before). The fixture note from `behav.md` applies: the `coverage-one-half` fixture was trivially met (since fixed), and it is not in the emitted file.

## Solvability round (supersedes the 26 and 43 counts above)

The per-pack solvability rounds registered 42 more checkers (num 14, geom 5, stats 8, plane 10, sims 5), so 68 of the 69 Horizonte types register one (the 70th
registered type is not Horizonte: the registry also holds the two money boards). The Solvability section above is the current table. The "26 registered, 43 not" sentences in the
Fix round (the counts row and the old owner follow-up on the 43 types) describe the tree at that time only. The one type without a checker is the ungraded `space.ar-table.v2`.
A dedicated solvability gate is still not created: findings keep the `solvability/<code>:` prefix on gate 1.
