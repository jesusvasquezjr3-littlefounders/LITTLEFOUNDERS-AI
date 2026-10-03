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
(the fix round added the spaces, so only the five seeded simulations still fail closed; see below). Putting the
rows in the shared `emitted.json` turned Core red: `forge-v2:check` failed at 264 of 453 graded segments, and three backend suites that
read `emitted.json` failed (among them `v2SegmentFeedback`), as did `npm run test` there, whose first step is that check.

The split keeps both gates honest without touching Core or weakening a test: `emitted.json` and `fixtures/plans/` are byte-identical to
before (141 rows, 264 of 264 graded segments pass), and the Horizonte rows are validated by the same Core strict parser on demand:

```
npm --prefix coursegen run v2:emit -- --horizonte --write-fixture
npm --prefix backend run forge-v2:check -- ../coursegen/src/v2/fixtures/emitted-horizonte.json
```

Measured at the first merge: Core's strict contract accepted all 111 documents; the only failures were the 189 graded segments with
"no behaviour space defined for this kind" (0 of 189 pass, no other problem). Measured after the fix round on the current 114 rows: the
strict contract and the feedback rules accept every row, and 225 of 240 graded segments pass the behaviour gate; the 15 that do not are the
five seeded simulations in three markets, still "no behaviour space defined for this kind" (see Fix round). To promote the Horizonte plans
into the shared fixture, Core still needs a decision on those five kinds (a behaviour space, or an explicit, reviewed exemption); then move
the files into `fixtures/plans/` and refresh `emitted.json`.

## Solvability (gate 4, riding gate 1)

Of the 69 Horizonte types, 26 register an F0.4 checker and 43 do not (re-derived from the emitted file with the registry loaded, not copied
from an earlier count). Registered: fin1 2, fin2 3, alg1 3, com 4, solids 4, space1 4, space2 3, and, added by the fix round,
`math.equation-balance.v2`, `math.function-graph.v2` and `math.expression-editor.v2` (the registry also holds the two money boards that shipped
before Horizonte, 28 in all). `solvabilityPacks.ts` imports each pack that registers
(an existing test enforces it). The other 43 types rely on the gate-4 function inside their own pack file. The table below says, for each of
them, why no separate checker was written and which function enforces what.

What "enforced by the pack gate" means here: the gate refuses a payload that is malformed or has no answer, and, when the emitter gives it
the private key, refuses a key that is not the answer the payload implies. That is a key-versus-payload proof. It is not a uniqueness,
ambiguity or dead-end proof, and without the key (release-time verification of stored documents) only the public half runs.

| Type | Pack | Why solvability is trivially true or already proved | Enforced by (gate 4) |
|---|---|---|---|
| `math.ten-frame.v2` | golden | Reachable by rule, not by search: one frame only adds counters, so the target may not be below the start; two frames keep the total. The gate refuses a target that breaks the rule or equals the start. | `goldenGates` |
| `math.rekenrek.v2` | num-a | Direct manipulation of beads: any pair of counts from 0 to 10 is reachable. The gate refuses a target that equals the start or is out of range. | `numAGates` |
| `math.abacus.v2` | num-a | Direct manipulation: any digit from 0 to 9 on every rod is reachable. Same gate rules as the rekenrek. | `numAGates` |
| `math.number-line.zoom.v2` | num-a | Zooming and dragging reach any mark of the finest grid inside the window; the target must be one and must differ from the start. | `numAGates` |
| `math.clock.v2` | num-a | The hands reach any time whose minute part is a multiple of the step; the gate refuses any other target. | `numAGates` |
| `math.ruler.v2` | num-a | The bar can be dragged to any whole mark after its start; the gate refuses a target off the ruler or equal to the start. | `numAGates` |
| `math.number-line.empty.v2` | num-a | Computed, not assumed: `reachableLandings` enumerates every landing inside the jump cap with the offered sizes, and the target must be one of them. | `numAGates` |
| `math.pan-balance.v2` | num-a | Computed: `reachableDifferences` enumerates every left-minus-right difference the loose weights can make, and the target must be one of them. | `numAGates` |
| `math.number-line.order.v2` | num-a | The key must be the one arrangement the values force (each number on the mark that holds its value, nothing else), so there is nothing to search. `orderParts` also refuses an order line already in ascending order. | `numAGates` |
| `math.ruler.measure.v2` | num-a | A typed reading with no search: the key must equal the far mark minus the near mark drawn in the payload. | `numAGates` |
| `math.array-area.v2` | num-b | One answer follows from the payload (`arrayAreaKind`); a payload that is not a valid array, multiplication box or missing-area division is refused, and so is a different key. | `numBGates` |
| `math.fraction-circles.v2` | num-b | One answer follows from the payload (`circleAnswer`); the operands share a denominator and the sum stays within the whole. A key that differs is refused. | `numBGates` |
| `math.fraction-wall.v2` | num-b | One answer follows from the payload (`fractionAnswer`, reduced); an operand that cannot give a proper result is refused, and so is a different key. | `numBGates` |
| `math.ratio-line.v2` | num-b | One answer follows from the payload (`ratioAnswer`) for a double number line or a ratio tape; a payload with no whole answer is refused, and so is a different key. | `numBGates` |
| `math.geoboard.v2` | geom2 | Exhaustive over a bounded board (3 to 8 pegs a side): `bandExists` must find a band with the keyed area and figure. It runs only when the key is present, so release-time verification cannot repeat it. | `geom2Gates` |
| `math.area-squares.v2` | geom2 | The key must be exactly the squares inside the public outline, which the gate counts itself; an outline that is not a simple band on the grid lines is refused. | `geom2Gates` |
| `math.transform.v2` | geom2 | The key must be the image of the figure under the public move, which the gate computes; an image off the pegs, outside the plane or equal to the figure is refused. | `geom2Gates` |
| `math.tessellation.v2` | geom2 | Exact cover by backtracking (`solvable`, under a work budget that refuses when it runs out): the tile must cover the floor under the motions the payload allows. It reads the public payload only, so it also runs without a key. The key is the floor cells divided by the tile cells. | `geom2Gates` |
| `math.visual-proof.v2` | balance | The key choice and value are derived from the figure geometry (pi as 3.14); the visual and payload must be one of the seven proof figures. | `balanceGates` |
| `stats.dot-plot.v2` | stats1 | `reachable` is a breadth-first search over single-dot moves (the payload allows 1 or 2) for the keyed measure; a start that already has it is refused. Runs only with a key. | `stats1Gates` |
| `stats.balance-point.v2` | stats1 | The key must be the mean of the dots, which must be a whole position; the pivot must start away from it. | `stats1Gates` |
| `stats.normal.v2` | stats1 | `solveNormal` derives the one mean and spread from the band; the key must equal them and the curve must start away from them. | `stats1Gates` |
| `stats.binomial.v2` | stats1 | `solveBinomial` derives the one count and percent that give the goal mean and variance on the 5-step grid; none or several is refused. | `stats1Gates` |
| `stats.clt.v2` | stats1 | The answer is the shrink factor squared and must fit the sample cap; the key must equal it. | `stats1Gates` |
| `alg.slope-triangle.v2` | plane1 | One whole answer derived from the payload alone (`solveSlope`), so the check also runs without a key; a payload with none is refused. The prompt must name the numbers the learner needs. | `plane1Gates` |
| `alg.rate-of-change.v2` | plane1 | One whole answer derived from the payload (`solveRate`); same rules. | `plane1Gates` |
| `alg.linked-views.v2` | plane1 | One slope and intercept derived from the two given points (`solveLinked`); the key must equal them. | `plane1Gates` |
| `fin.break-even.v2` | plane1 | One whole answer derived from the payload (`solveBreakEven`); same rules. | `plane1Gates` |
| `fin.cost-structure.v2` | plane1 | One whole answer derived from the payload (`solveCost`); same rules. | `plane1Gates` |
| `fin.margin-markup.v2` | plane1 | One whole answer derived from the cost and percent (`solveMarkup`); same rules. | `plane1Gates` |
| `econ.market-shift.v2` | plane1 | One direction and price derived from the shift (`solveMarket`); the key must equal them. | `plane1Gates` |
| `econ.elasticity.v2` | plane1 | One whole answer derived from the goal fraction (`solveElastic`); same rules as the other plane1 numbers. | `plane1Gates` |
| `prob.tree.v2` | prob | One arrangement: the six counts all differ so each has one branch, and the key must be that single arrangement. | `probGates` |
| `prob.bayes.v2` | prob | The answer is the exact share from the counts, between 1 in 20 and 19 in 20; the key target must equal it, the tolerance is at most 0.01 and the review band is wider and at most 0.1. | `probGates` |
| `prob.regression.v2` | prob | The best-fit line is an exact rational that must land on the tenths grid inside the sliders; collinear points and a start on the line are refused. With a key, the target must be that line, the tolerance at most 0.05. | `probGates` |
| `math.line-system.v2` | alg2 | The payload is the lines and the markers. With a key, each key point must be a crossing of two lines, there is one per marker, they are all different, and the markers must start away from them. | `alg2Gates` (`systemGate`) |
| `money.rate-return.v2` | fin1 | A typed number: the key must equal the model answer (`rateAnswer`), with no search to prove (the comment above `compoundChecker` in `fin1.ts` says so). | `fin1Gates` |
| `space.ar-table.v2` | space2 | Ungraded: grading is none and there is no rubric or key, so there is nothing to solve. The gate refuses a graded AR step. | `space2Gates` |
| `math.chance-sim.v2` | sim1 | Seeded. The key is the exact reduced chance of the event; `solvableAt` refuses a tolerance so tight that a full run would miss it by luck. | `sim1Gates` |
| `math.galton-sim.v2` | sim1 | Seeded. The key is the exact binomial chance of the bin; the same luck check on the last stop. | `sim1Gates` |
| `stats.coverage-sim.v2` | sim1 | Seeded. `solveCoverage` finds the lowest level that reaches the goal reliably; it must exist and sit above the start level. | `sim1Gates` |
| `stats.bootstrap-sim.v2` | sim1 | Seeded. The key is the exact edges of the middle percent of the data; `bootstrapSolvable` is the luck check on the last stop. | `sim1Gates` |
| `money.life-sim.v2` | sim2 | Seeded. `analyse` derives the answer set (every choice that reaches the goal reliably under the scenario rule) and refuses a payload where no choice reaches it, a choice that reaches it only by luck, or a start that already solves it; the key must be exactly the answer set. | `sim2Gates` |

Reading the table: five rows are direct manipulation where every in-range target is reachable (rekenrek, abacus, zoom, clock, ruler), so the
only rules are range and "differs from the start"; the ten frame adds one rule about adding counters. Rows with a computed reachable set
(empty number line, pan balance, geoboard, dot plot, tessellation) already carry an exact or bounded search inside the pack, which is the proof
a new checker would repeat; the geoboard and dot plot searches run only when a key exists. The remaining rows have one answer the payload
forces, and the gate recomputes it; for plane1, the checks of the payload run without a key and only the comparison with the key needs one. `geometry.solid-net.v2` is not in this table: it is
registered in `solids.ts` (label has exactly one answer, a complete net needs at least one fitting completion and at least one net ruled out,
the area key is the surface area).

Guard: `v2Emit.test.ts` corrupts the private key of every server-graded Horizonte segment three ways (add one, negate, triple) and
requires gate 1 or 4 to refuse at least one corruption for every kind. All 63 graded kinds did at the first merge, and the test was green in
the fix round's coursegen run over the plans as they stand. This proves that a key is checked against the payload, not that the instance is
unique or free of dead ends; that proof exists only for the 26 registered types.

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
- Superseded by the fix round: Core now has a behaviour space for every graded Horizonte kind except the five seeded simulations, and a
  coursegen test and a backend test read `emitted-horizonte.json` (see Fix round). At the first merge neither existed.
- `forge:release-gates:check` and `forge:v2:dry-run` were not run. The push gate has not run. No requirement row or sprint entry is closed.
- No live generation, publication or Vault write happened.

## Limits

- One segment per type per fixture: the plans prove that every kind emits and gates, not that a full lesson built from them is a good lesson.
- A neutral kind cannot take a string in its payload; a pack that needs a new localized field must route it through `labels` or `notation`.
- `labels` entries are 60 characters at most (Core's fin2 contract); `notation` TeX is 200 characters at most, spoken text 160.

## Owner follow-ups

- Decide how Core's behaviour gate treats the five seeded simulations (sim1 and sim2 explain why seeded kinds are hard): write a behaviour
  space that works without the learner's attempt, or approve a named exemption. Until then keep `emitted-horizonte.json` out of the shared
  fixture, because `forge-v2:check` on the shared file would fail on those 15 segments.
- Run `forge:v2:dry-run` and `forge:release-gates:check` once, at the push gate, on the final tree.
- Have the pack lanes replace fixture copy with authored lessons, and have a native reader review es-MX and pt-BR.
- Decide whether the 43 types without an F0.4 checker (table above) need one for uniqueness, ambiguity or dead ends. equation-balance is no
  longer on that list (the fix round registered it). The puzzle-like boards that remain are geoboard, tessellation, area-squares, transform
  and pan-balance; each has an exact search or a public derivation inside its pack gate, so the open question is only ambiguity.

## Fix round (fx-forge)

Worktree `hz/fx-forge`, cut from `feat/horizonte-visual` and merged with it twice (`6d70b825`, `ed365f73`; the base was an ancestor again at the
end). Nothing is pushed, accepted or released. No new lane doc, no COVERAGE.md edit.

### What changed

| Area | Change |
|---|---|
| F0.4 solvability | Three checkers in `coursegen/src/v2/horizonte/`: `solvability-balance.ts` (`math.equation-balance.v2`: the x the public pans fix is derived, and the checker refuses x on neither pan, a start already solved, pans true for every x or for no x and an x that is not a whole number from 0 to 99; then a bounded search over the offered route moves, 16 at most, where a slip never counts as progress; with a key, the rubric must be `{ x }` and cover that x) and `solvability-alg2.ts` (`math.function-graph.v2`: the marks must pin one curve of the family that sits on the sliders and is away from the start, with a budgeted scan of the base slider for exponentials; `math.expression-editor.v2`: a solve task must be one linear equation, a rewrite must be a polynomial, and a factored rewrite is not a single term). They read the public payload, so they run at release time without a key, which the pack gates only partly do. Neither alg2 checker reads the key. Registered through `solvabilityPacks.ts`. Tests: `__tests__/horizonte/solvability-balance.test.ts` (11) and `solvability-alg2.test.ts` (14), with a comparison against the pack gate for small balance boards and against a brute force over the slider grid for lines |
| Per-type table | The 43 unregistered types each have a row in the Solvability section above |
| Behaviour space | `backend/src/services/forgeV2Behaviour.ts` gets one hook: its default branch asks `horizonteBehaviourSpace` (`backend/src/services/forgeV2HorizonteBehaviour/`, one module per pack plus `shared.ts`, `arrange.ts`, `rational.ts`). Each builder reads the public payload and the private rubric, derives its own key with an evaluator that shares no code with Core's scorer, enumerates the in-range states, the refused states and the untouched start, and states the diagnostic Core should store for each review state. A builder returns `null` (the gate fails closed) for anything it does not model: a missing field, an unknown mode or a payload with no single answer. Enumeration is capped (`SPACE_LIMIT` is 3,000 in `shared.ts`; the test asserts at most 6,000 in-range states per space) |
| Kinds modelled | 63 of the 69 Horizonte types. Left fail-closed on purpose: the five seeded simulations (`math.chance-sim`, `math.galton-sim`, `stats.bootstrap-sim`, `stats.coverage-sim`, `money.life-sim`), which Core grades against an attempt the gate never has. `space.ar-table.v2` has no space because it is ungraded and the gate skips it |
| Newest pieces | The two merges added models for tessellation motions, number-line order, ruler reading, fraction circles, the space1 polyhedra and slide pieces, surface-formula (slope, gradient, walk and build tasks), cube-net area and all three modes of `geometry.solid-net.v2` (label, complete and area) |
| Coursegen test | `src/__tests__/v2HorizonteFixture.test.ts` (8 tests) reads `emitted-horizonte.json` as written: row identity, capabilities, rubric privacy, age and payload scope, every document gate with the private keys and the regional policy, the solvability gate at release time (no keys) and at emit time (with keys), and a negative test (stale capability list, leaked rubric, wrong key) |
| Backend tests | `src/__tests__/forgeV2HorizonteBehaviour.test.ts` (624 tests) holds every fixture of every modelled kind, in all three markets, to Core's own gate, replays each fixture's ladder through Core's grader, checks that wrong keys are refused by Core's contract and that the model catches scorer drift, and fails closed on payloads it cannot model. `src/__tests__/forgeV2HorizonteFixture.test.ts` (7 tests) runs `emitted-horizonte.json` through `checkForgeV2Rows` by relative path with no cross-package import, and skips when the file is absent |
| Counts | Emitted file: 114 rows, 38 lessons, 69 types, 240 graded segments over the three markets. Types: 69 (64 at the first merge); registered checkers 26; unregistered 43 |

### Measured

| Check | Result |
|---|---|
| Behaviour gate, hand-built fixtures, en-US | 75 of 80 graded fixtures pass (0 of 189 before the fix round at the first merge); the 5 that fail are the seeded simulations |
| Behaviour gate, `emitted-horizonte.json` | 225 of 240 graded segments pass, 64,236 states checked, pass rate 0.9375; the 15 failures are the five seeded kinds in three markets with only "no behaviour space defined for this kind" |
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
- sim1 and sim2 kinds are fail-closed in the behaviour gate, so `emitted-horizonte.json` cannot join the shared `emitted.json` yet.
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

- Real browser behaviour: nothing here ran a page. The sim1 and sim2 kinds have no behaviour space and were not exercised by the gate.
- `forge:release-gates:check`, `forge:v2:dry-run` and the push gate were not run. No requirement row or sprint entry is closed.
- Fixture copy is still synthesized, not authored or natively reviewed.

## Behaviour round (supersedes the five fail-closed statements above)

Core's behaviour gate now has a space for the five seeded simulations (`math.chance-sim.v2`, `math.galton-sim.v2`, `stats.coverage-sim.v2`, `stats.bootstrap-sim.v2`,
`money.life-sim.v2`). On `emitted-horizonte.json`, `forge-v2:check` reports 240 of 240 graded segments passing (64,341 states), not 225 of 240, and every Horizonte graded
kind has a space. The earlier statements that the five kinds are left fail-closed, and that the file cannot join the shared `emitted.json` for that reason, no longer hold.
A seeded kind graded without an attempt is still `invalid`. See `behav.md`.
