# Lane doc: geom2 (F2.7 geoplano and area by squares, F2.8 tessellations, symmetry and transformations)

Two teaching pieces that share one pack and one answer shape: the learner builds a set of whole-number points on a lattice. F2.7 is a
rubber band on a geoboard and shaded squares inside an outline; F2.8 is the image of a figure under a move, and copies of a tile
slid, turned or flipped across a floor. Procedure: [RECIPE.md](./RECIPE.md). Exemplar: [golden.md](./golden.md).

| Item | Value |
|---|---|
| Catalogue rows | F2.7: E02 (geoplano), E22 (area by squares); F2.8: E06 (tessellations), E07 (reflection and symmetry), E09 (rotation), E10 (translation and dilation); `cat-math.md` |
| Segment types | `math.geoboard.v2` and `math.area-squares.v2` (F2.7), `math.transform.v2` and `math.tessellation.v2` (F2.8) |
| Visuals | F2.7 `geoboard`, `area-squares`; F2.8 `transform-plane`, `symmetry-mirror`, `tessellation` |
| Ages | F2.7 8 to 12 (`{ ages: [8, 12], adult: false }`); F2.8 8 to 15 (`{ ages: [8, 15], adult: false }`); every fixture sits inside the Core scope for its type (see Fix round) |
| ICAP level | Constructive, both pieces |
| Answer shape | point set (F0.3), `{ points: { x, y }[] }` of whole numbers: geoboard the band's pegs in order; area-squares the shaded cells; transform the image's vertices in figure order; tessellation the anchor of each placed copy, plus `motions` (`slide`, `turn` or `flip` for each copy) only when the floor offers more than a slide |
| Rendering | the shared Plano SVG plane (F0.2) with the points, polylines, regions and handles layers; one pure model per type, no third-party code |
| Capabilities | geoboard `visual.geoboard.v1`, `operation.tap-pegs.v1`; area-squares `visual.area-squares.v1`, `operation.shade-cells.v1`; transform `visual.transform-plane.v1`, `visual.symmetry-mirror.v1`, `operation.drag-point.v1`; tessellation `visual.tessellation.v1`, `operation.place-tile.v1` |
| Chunk budget | 12 KB gzipped declared for each of the four boards; not yet measured (see Known issues) |

## Behaviour

**Coordinates.** Everything is a whole number. A cell is named by its lower-left corner, so cell `(2, 1)` covers x 2 to 3 and y 1 to 2.
The plane draws y upward, as in a coordinate plane. Areas are held in half squares (`area2`) so a triangle on a geoboard has an exact
whole-number area (a right triangle with legs 4 and 2 is `area2 = 8`, four squares).

**F2.7 geoplano (`math.geoboard.v2`).**

- The payload is `{ size }`, a square board of 3 to 8 pegs a side. The target area and the optional named figure never ship.
- The learner stretches a rubber band over pegs: tap a peg, or move the cursor handle with the arrow keys and press Enter or Space (the
  "Place peg" button does the same). "Undo" removes the last peg and "Reset" clears the band. Tapping a peg already on the band takes it off the band.
- Three or more pegs close the band into a polygon and the status line reads out its pegs. A band that crosses itself is flagged in
  words ("The band crosses itself") and Check stays disabled until it is untangled.
- Check sends `{ points }`. The tasks ask for an area ("make a shape of 6 squares") and sometimes a figure (right triangle,
  rectangle, parallelogram, trapezoid); several different bands can be correct.

**F2.7 area by squares (`math.area-squares.v2`).**

- The payload is `{ columns, rows, outline }`: a grid of up to 8 by 8 with a closed lattice outline of at most 32 cells inside. The
  squares inside the outline are the key and are never in the payload.
- Tap a square to shade it and tap again to clear it, or move the cursor handle and press Space or Enter ("Shade square" does the same).
- Check sends the shaded cells. A square inside the outline that is left out is a `miss`; a shaded square outside it is a `false_alarm`.
- **Equivalent.** The status line gives the count shaded so far, and "Show as table" opens a row-by-row count with a total.

**F2.8 transformations (`math.transform.v2`).**

- The payload is `{ extent, figure, move }`: a plane from `-extent` to `extent` (3 to 10), a simple polygon of 3 to 6 corners, and
  one move: `translate { dx, dy }`, `reflect { across, at }` (a vertical, horizontal, diagonal or anti-diagonal line), `rotate { degrees,
  about }` (quarter turns) or `dilate { num, den, about }` (a ratio of two numbers from 1 to 4). The rule is stated in words and the
  mirror line or centre is drawn.
- One handle per image corner, each starting on the figure's own corner. Drag it, tap the plane to put the selected corner on the nearest
  lattice point, or move it with the arrow keys. The image polygon is drawn live in a second colour.
- Two corners on the same point are named in words and Check stays disabled. Check is also disabled until a corner has moved.
- **Equivalent.** The status line carries the rule and the position of every image corner; "Show as table" lists each corner with its
  figure and image coordinates.

**F2.8 tessellations (`math.tessellation.v2`).**

- The payload is `{ floor, tile, moves? }`: a floor of cells (at most 24 copies' worth), a connected tile of 2 to 6 cells and, optionally,
  the moves on offer (see Fix round). Without `moves` the tile is only slid. Whether a cover exists with the offered moves is checked when
  the lesson is published.
- A cursor handle names the anchor, the translation applied to the tile. Tap a cell, or press Enter or Space on the cursor ("Place tile"),
  to put a copy there. Tapping a cell that a copy already covers removes that copy ("Remove last" and "Reset" also work). The cursor tile
  is previewed as an outline.
- A copy that leaves the floor or overlaps another is refused with a sentence ("That tile does not fit there"), never accepted silently.
- Check sends the anchors, and the move of each copy when the floor offers more than a slide. The floor is covered when every cell is under a copy.
- **Equivalent.** The status line says how many copies are placed and how many cells are left; "Show as table" lists each copy with its anchor.

## Scorer ladder

| Verdict | Geoboard | Area squares | Transform | Tessellation |
|---|---|---|---|---|
| `invalid` | malformed response or extra fields; a peg off the board or repeated; a band that crosses itself; with a rubric, a malformed key | not a set of distinct cells on the grid; with a rubric, a key that is not the squares inside the outline | not distinct whole-number points on the plane; with a rubric, a key that is not the image under the move | a copy that leaves the floor or overlaps another, a move the floor does not offer; with a rubric, a key whose copy count does not match the floor |
| `valid` | no band yet, and (without a rubric, as in the browser) any well-formed band | nothing shaded, and any well-formed shading without a rubric | the corners left on the figure, and any well-formed answer without a rubric | no copy placed, and any legal placement without a rubric |
| `review` | a band that is not the key; diagnostic `value` (area wrong) or `miss` (area right, figure wrong) | `miss`, `false_alarm`, `partial` or `value` from the point-set grader | `miss`, `false_alarm`, `partial` or `value` from the point-set grader | legal copies that leave part of the floor open; diagnostic `partial` |
| `met` | the right area, and the named figure when the task names one; score 100, diagnostic `none` | exactly the squares inside the outline | exactly the image | every floor cell covered |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/geom2/`: `geometry.ts` (lattice points, area in half squares, simple-polygon test, corner-based
shape matching), `geoboardModel.ts`, `areaModel.ts`, `transformModel.ts`, `tessellationModel.ts` (copies by slide, half-turn or flip; exact-cover solver),
`contract.ts` (strict Zod payloads, rubrics, age scope), `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test:
`backend/src/__tests__/horizonte/geom2.test.ts`, which runs `assertScorerContract` for all four types.

Browser `frontend/src/rebuild/learning/horizonte/geom2/`: generated `contract|fixtures|scorer|geometry|geoboardModel|areaModel|transformModel|tessellationModel.generated.ts`,
`capabilities.ts`, `copy.ts`, `boards.tsx`, `boardKit.tsx` (shared frame, status line, table, outline helpers), `geom2.css`,
`GeoboardBoard.tsx`, `AreaSquaresBoard.tsx`, `TransformBoard.tsx`, `TessellationBoard.tsx`, `audit.json`, and the test
`geom2Boards.test.tsx` (runs `assertBoardContract`).

Forge `coursegen/src/v2/horizonte/geom2.ts` (capabilities, authoring guidance for all four types, gate-4 `geom2Gates`); test
`coursegen/src/__tests__/horizonte/geom2.test.ts`.

Fixtures: geoboard `geoboard-area-six`, `geoboard-right-triangle`; area `area-l-shape`, `area-staircase`; transform `reflect-triangle`,
`translate-parallelogram`, `rotate-quarter`, `mirror-half`, `dilate-center` (10 to 12); tessellation `tile-domino` (6 to 9), `tile-l`,
`tile-bump`, `tile-turn`, `tile-flip` (10 to 12). Preview: `?screen=fixture&seg=hz:geom2:geoboard-area-six&age=6-9`.

## Decisions

- **The model is public, the key is private.** The lattice geometry, the move arithmetic and the tiling rules are plain mathematics, so
  the generated browser copy carries them (the board needs them to draw the image and to refuse a tile that does not fit). Only the key
  (the target area, the squares inside the outline, the image points, the copy count) is server-side.
- **One answer shape, four meanings.** Every response is `{ points }`, graded by the shared point-set grader (`gradePointSet`) where a set is
  being compared, so the diagnostics (`miss`, `false_alarm`, `partial`) mean the same thing here as in the other plane packs.
- **Area in half squares.** `area2` keeps triangles on the geoboard exact without decimals. The prompts speak in whole squares, and the status line
  states the band as pegs.
- **A geoboard task is a goal, not a single band.** The key is an area and an optional figure, not a fixed set of pegs, and the sample
  comes from a small search (`findBand`), so a learner who reaches the area with a different band is still `met`. A named figure is
  matched by its corners, so a rectangle drawn from any starting peg counts.
- **Transform corners start on the figure.** A response that leaves every corner where the figure is stays `valid`, so an untouched board
  never grades as a wrong answer; the learner moves each corner to the image.
- **Tessellation pairings.** The first version was translation-only. The Fix round replaced it with per-copy moves; see Fix round.
- **Tap rounding.** A tap on a cell uses floor (the cell the finger is in); a tap for a peg or a corner uses round (the nearest lattice
  point). Taps are `click` events on the plot read through `getBoundingClientRect`, as in Plano.
- **Keyboard and tap alternatives.** Plano handles are `role="slider"` with arrow-key movement, so a drag is never the only way. Enter or
  Space on a handle runs the same action as its button (place a peg, shade a square, place a tile), and every board has Undo, Remove last
  or Reset buttons. Handles keep Plano's 64 px hit size.
- **No "Move to" menu.** The recipe's menu is for `data-hz-handle` pieces dragged between targets. These boards use Plano's slider
  handles on a lattice, whose arrow keys already reach every position, so a menu would only repeat them.
- **Text equivalent and table.** Each board has a live status line (`role="status"`, `data-hz-text-equivalent`) that states the facts in
  words and a "Show as table" toggle (`data-hz-table-toggle`) opening a real table. Plano's own table toggle is switched off with the new
  `tableToggle` prop, so there is one toggle, not two.
- **spokenText.** The math in the prompts and rules ("reflect across x = 3", "rotate 90 degrees about (0, 0)") is plain text, so the
  spoken form is the written form; no KaTeX is used.
- **Series colours.** The figure and the key use series 1, the learner's image series 2, the mirror line or centre series 3; the board
  itself is neutral. Every state is also stated in text, so colour is never the only channel.
- **Motion.** None. The boards never animate, so there is nothing to gate behind `prefers-reduced-motion`; `geom2.css` uses tokens only.
- **Dilation ratio.** `num` and `den` run from 1 to 4 and are shown as a factor or a fraction ("2", "3/2"); the key is exact because the
  figure and the centre are whole numbers and the factor is applied as a rational that must land on the lattice.
- **`symmetry-mirror`.** The capability is used for the reflections; a mirror line is drawn for vertical and horizontal lines and for the two
  diagonals, and the line equation is also written in the status line.
- **Solvability sits in the pack gate.** The Forge `gates` hook recomputes each key from its payload (the band exists, the cells are inside the
  outline, the image follows the move, an exact cover exists), so `solvabilityPacks.ts` stayed untouched in the first round. The F0.4 checkers for all four types came in the Solvability round below.
- **Payload identical in every locale.** Labels, rules and prompts live in board copy and the fixture's locale map, never in the segment.
- **Shared file.** `plano/Plano.tsx` gained an optional `tableToggle` prop (default `true`) and `data-hz-roving` on handle sliders. Both are
  backward compatible and every Plano test still passes.
- **Copy.** All strings carry a `data-copy-role`; es-MX and pt-BR are native text, not translations of the English, and avoid gendered
  agreement by putting the state after a colon.

## Known issues

- Hit size is declared and enforced in CSS but jsdom cannot measure layout; a real-browser check of the 64 px handles and of the four
  drawings belongs to the coordinator's audit pass. No screenshot was taken in this lane.
- The chunk budgets (12 KB gzipped each) are declared, not measured; `npm --prefix frontend run build` gives the real sizes.
- Tessellation moves are slide, half turn and left-to-right flip; see Fix round for what that leaves out.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.
- `fixtureCoverage.test.tsx` fails on `feat/horizonte-visual` for reasons outside this lane: the F0.2 `plano/` folder has an `index.ts`, so the test
  counts it as a pack that must register fixtures. geom2's own fixtures and `audit.json` were checked separately (the audit ids and ages match
  the fixtures, and all load in en-US, es-MX and pt-BR; 14 after the Fix round).

## Fix round

Two defects were reported against the merged pack: fixtures offered outside the Core age scope, and tessellations that could only
translate. Both are fixed on this branch.

### Age scope

- **Cause.** `dilate-center` and `tile-bump` were audited and offered at band 13-17. Core scopes `math.transform.v2` and `math.tessellation.v2`
  to ages 8 to 15, and `horizonteAgeScopeProblem` requires the band to overlap the fixture's eligibility, so a fixture could not be both
  13-17 and inside the scope.
- **Fix.** Both fixtures moved to band 10-12 with eligibility 10 to 12, in the fixtures and in `audit.json` (the audit `age` must equal the
  fixture's `ageBand`). A band is a coarse label and cannot be narrower than the ages it names, so a fixture that must stay under 15 cannot
  carry 13-17.
- **Convention, stated once.** Eligibility is the Core gate and the band is a coarse label of it. The 6-9 fixtures carry eligibility 8 to 9
  because the scope starts at 8; num-b uses the same convention.
- **Pinned by a test.** `geom2.test.ts` checks, for every fixture, that the eligibility lies inside the Core scope of its segment type, that
  the top of its band does not pass the scope maximum and that `horizonteScopeProblem` returns null. The other ten fixtures were checked
  against the same map (geoboard and area-squares 8 to 12, transform and tessellation 8 to 15) and needed no change.
- The capability maps in Core, the browser and Forge were not touched and the parity check stays green.

### F2.8 tessellations with half-turn and flip pairings

- **Idea.** In an Escher-style tiling a tile edge is paired with a neighbour by a translation, a half-turn or a glide reflection. A copy is
  now the tile made by one of three moves and then slid to its anchor: `slide` (as it is), `turn` (half a turn about the middle of the tile's
  bounding box) or `flip` (a left-to-right mirror image about the same box). Which pairings a floor uses follows from which moves it needs.
- **Payload.** `{ floor, tile, moves? }`. `moves` is slide first and then turn, flip or both, each once, so it has 2 or 3 entries. Without it
  the floor is slide-only and every earlier payload and plan still validates unchanged.
- **Response.** `{ points }` as before, and `{ points, motions }` only when `moves` offers more than a slide. `motions` has one entry per
  point; a missing `motions` means every copy is slid. A motion that is not offered, a `motions` list of the wrong length or a `motions` field
  on a slide-only floor is `invalid`. The key is still `{ copies }`, the number of copies an exact cover takes, so the rubric did not change.
- **Model** (`tessellationModel.ts`, regenerated into the browser). `orientTile`, `copyCells`, `readCopies`, `placeCopies`, `solveCover`
  (fills the first open cell in x-then-y order trying each distinct oriented shape, 60,000 steps) and `floorFromCopies`. `placeTiles` and
  `solveTiling` remain as the slide-only forms. The tile still starts at the origin and the floor is whole copies, at most 24, inside 12 by 12.
- **Scorer.** `gradeTessellation` reads the copies and places them (`invalid` if one leaves the floor, overlaps another or uses a move not on
  offer), then grades the covered cells with the point-set diagnostics as before. The sample answer is the solver's cover and carries `motions`
  only when the floor offers more than a slide. The browser scorer copy has no rubric and still says only `valid` or `invalid`.
- **Board.** When the floor offers more than a slide, a "Move" group of 64 px choice chips appears (Slide, Half turn, Flip, `aria-pressed`,
  starting on Slide). The tile preview and the placed copies are drawn in the chosen orientation. A tap names the square the oriented tile's
  first square (leftmost, then lowest) lands on, so a copy does not depend on its bounding-box corner being free or being a hole in the tile. The
  keyboard cursor and the Place tile button use the same rule. A copy that does not fit gets the existing refusal sentence, which clears when
  the move changes. Reset returns to Slide. The status line adds the move and the table gains a Move column. Slide-only floors show no chips and
  submit exactly what they did before.
- **Copy.** New keys `tsMotion`, `colMove`, `moveSlide`, `moveTurn`, `moveFlip`, `tsMove` and `tsHintMoves` in en-US, es-MX and pt-BR, each
  with a `data-copy-role` and written to the strictest (6-9) budget.
- **Forge.** `geom2.ts` guidance now says the prompt must name what may be done to the tile and that `moves` is listed only when the floor
  needs them. The gate accepts `moves` and refuses a bad list ("The moves are slide first and then turn, flip or both, each once") and a floor
  the listed moves cannot cover, however it was built ("The tile cannot cover the floor by the moves listed").
- **Fixtures.** `tile-turn` (L-tromino, moves slide and turn, 4 copies on a 4 by 3 floor) and `tile-flip` (S-tetromino, moves slide and
  flip, 3 copies on an 8 by 2 floor), both band 10-12 with eligibility 10 to 12 and a ladder of `invalid` (overlapping copies), `valid`
  (nothing placed) and `met` (the cover, with `motions`). The bump, L and domino fixtures keep their slide-only payloads. Neither new floor
  can be covered by sliding alone, so the extra move is what makes it solvable.
- **Tests.** Backend `geom2.test.ts` (the motion model, the scorer ladder for each move, the age-scope check; 37 tests), the board tests in
  `geom2Boards.test.tsx` (chips only when the floor offers a move, a half turn, a flip, a refused turned copy, a keyboard placement, the table
  with its Move column, removal on tap, reset; 30 tests) and Forge `geom2.test.ts` (guidance, accepted and refused floors, every shape of bad
  `moves`; 16 tests).

### Decisions in this round

- **Per-copy moves, not a per-floor mode.** A cover may mix slides, turns and flips, which is what an edge pairing is. A single mode could not
  express a floor that needs a flip on one copy and a slide on the rest.
- **The wire stays additive.** `motions` appears only when it carries information, so no route, schema or plan changed and a slide-only answer
  is exactly the old one. The route still takes `answer: z.unknown()` and the scorer owns validation.
- **Where a fixture sits.** A fixture goes in the band whose ages sit inside the Core scope, not at the nearest label.

### Known limits after this round

- No real-browser check and no screenshot in this round either: jsdom cannot measure the 64 px hit size of the new chips or the drawing of a
  turned tile. The coordinator's audit pass should look at `tile-turn` and `tile-flip` in light and dark at 360 and 1280 px.
- The chunk budgets are still declared, not measured. `TessellationBoard` grew by the move group and the orientation code.
- `solveCover` stops after 60,000 steps and then reports no cover, so a large 24-copy floor with three moves could in principle be refused at
  publish time although a cover exists. The Forge gate repeats the same search with the same budget; no fixture comes near it.
- The flip is left to right only. A top-to-bottom mirror image is a flip followed by a half turn, which one copy cannot combine: the learner
  picks one move for each copy.
- The Atlas audit showed low-contrast samples (about 2.3 light and 2.7 dark) on Undo, Reset and Check. That is outside this unit and is left
  to the audit pass.

## Solvability round

The four geom2 types now register a real F0.4 checker in `coursegen/src/v2/horizonte/solvability-geom.ts` (imported from
`coursegen/src/v2/solvabilityPacks.ts`). Every checker reads the public payload alone for everything the payload fixes, so the release-time
run with no key still proves the board; the key is compared only when `context.answerKey` is present. The lattice, move, cover and shape
functions are the pack's own, exported from `geom2.ts` and imported (not copied), so a checker and its gate 4 cannot drift. What the pack
gates accept and refuse is unchanged: the only code edit in `geom2.ts` is that `solvable` is now `coverSearch(...).covered` at the same
60,000-step budget, and `coverSearch` also reports whether it ran out of steps. Tests:
`coursegen/src/__tests__/horizonte/solvability-geom.test.ts` (41 tests, shared with the visual-proof row in `balance.md`).

| Type | Solvable (learner's controls alone) | Unique, start, dead end | Codes | Not provable |
|---|---|---|---|---|
| `math.geoboard.v2` | The payload is exactly `{ size }`, 3 to 8. Without a key the checker proves every area from 1 to the full board `2(size-1)^2` has a simple band (a constructed column strip, checked with the pack's `simple` and `area2`) and enumerates every triangle and parallelogram that fits (each vector pair, judged by the pack's `isShape`). With a key: `area2` is in range and the named figure exists at that area. | Not unique by design: the key grades an area and optionally a figure, so many bands are accepted; the proof is that the accepted set is non-empty. Start: the learner holds no band and an untouched board grades `valid`. Dead end: pegs can always be retapped. A wide name (triangle, rectangle, parallelogram) on a board whose only band at that area is the stricter figure is a REVIEW `ambiguous-solution`. | `impossible-state`, `out-of-bounds`, `no-solution`, `ambiguous-solution` (review), `budget-exceeded` | Whether the prompt's wording of the figure matches the key. A key reachable only by a tilted band passes here, but gate 4 and Core's sample (an axis-anchored search) still refuse it. |
| `math.area-squares.v2` | The payload is exactly `{ columns, rows, outline }`; grid 2 to 8; 4 to 16 distinct whole corners inside the grid, every edge on a grid line, every listed point a real corner, outline simple. The squares inside are the pack's `cellsInside`; none is `no-solution`, more than 32 is `too-large`. | Unique: the squares inside an outline are one set, cross-checked against the shoelace area (a mismatch is `ambiguous-solution`). Key `{ required }` is compared as a set, point by point: a missing square is `rubric-gap`, an extra one `rubric-accepts-invalid`. Start: nothing is shaded. Dead end: shading toggles. | `impossible-state`, `out-of-bounds`, `too-large`, `no-solution`, `ambiguous-solution`, `rubric-gap`, `rubric-accepts-invalid`, `vacuous-rubric`, `duplicate-id` | Nothing about the board beyond the prompt text. |
| `math.transform.v2` | The payload is exactly `{ extent, figure, move }`; extent 3 to 10; the figure is 3 to 6 distinct, simple, in-plane corners; the move passes the pack's `moveProblem`. The image is the pack's `imageOf`: a corner between pegs is `no-solution`, one off the plane `out-of-bounds`. | Unique: the image is a function of the public move, and the grader compares an unordered set, so corner order is never a second answer. Injectivity is still checked (`ambiguous-solution`, defensive: every move the pack allows is injective). Start: an image equal to the figure is refused as already solved. Dead end: a dragged point can be dragged again. Key `{ required }` is checked per point against the image. | `impossible-state`, `out-of-bounds`, `no-solution`, `ambiguous-solution`, `rubric-gap`, `rubric-accepts-invalid`, `vacuous-rubric`, `duplicate-id` | The `symmetry-mirror` rule (whole figure on one side of a vertical or horizontal line) needs the segment's visual, which a checker never sees; the pack gate keeps it. |
| `math.tessellation.v2` | The payload is `{ floor, tile }` plus optional `moves` (pack `movesProblem` and `tileProblem`); the floor is 1 to 24 copies of cells inside 12 by 12, no cell twice (`overlap`). A floor that is not whole copies of the tile is `no-solution`. Otherwise the pack's exact-cover search runs on `context.nodeBudget` (default 200,000) with the listed moves: no cover is `no-solution`, and running out of steps is `budget-exceeded`, never `no-solution`. | The cover is not unique by design (any listed move on any copy) but the copy count is: every exact cover uses floor cells / tile cells copies, and a disagreement would be `ambiguous-solution` (defensive: no well-formed payload can produce one). Key `{ copies }` is checked with `checkRubricCoverage`. Start: the learner holds no copy; an empty floor is refused as already tiled. Dead end: a placed copy can be lifted. | `impossible-state`, `out-of-bounds`, `overlap`, `too-large`, `no-solution`, `ambiguous-solution`, `budget-exceeded`, `rubric-gap`, `rubric-accepts-invalid` | Which moves the learner will think to try. The checker's budget is larger than the pack's fixed 60,000, so it can prove a cover the pack refuses as out of steps (the "Known limits after this round" item on `solveCover`); the pack itself is unchanged. |

### Decisions in the Solvability round

- **The checker is truthful, so it can be more complete than the pack.** The geoboard reach is exhaustive; the pack's `bandExists` is an
  axis-anchored search. A test pins that the checker never reports `no-solution` for a key the pack accepts, and a brute force over every
  peg of the 3 to 6 peg boards pins each named figure and area.
- **One REVIEW, no new block, for the figure names.** A rectangle key on a board that only holds a square at that area grades the same
  bands as a square key, so it is flagged for review and not blocked: the fixture key `{ area2: 12 }` with no shape must stay clean.
- **Hostile payloads return findings, never throw.** Every field is read through the pack's own validators before any search; a floor of
  5,000 cells, a `NaN` size or a nested array is a blocking issue, never a `checker-error`.
