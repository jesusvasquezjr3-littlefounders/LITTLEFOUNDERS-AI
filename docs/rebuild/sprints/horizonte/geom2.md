# Lane doc: geom2 (F2.7 geoplano and area by squares, F2.8 tessellations, symmetry and transformations)

Two teaching pieces that share one pack and one answer shape: the learner builds a set of whole-number points on a lattice. F2.7 is a
rubber band on a geoboard and shaded squares inside an outline; F2.8 is the image of a figure under a move, and copies of a tile
slid across a floor. Procedure: [RECIPE.md](./RECIPE.md). Exemplar: [golden.md](./golden.md).

| Item | Value |
|---|---|
| Catalogue rows | F2.7: E02 (geoplano), E22 (area by squares); F2.8: E06 (tessellations), E07 (reflection and symmetry), E09 (rotation), E10 (translation and dilation); `cat-math.md` |
| Segment types | `math.geoboard.v2` and `math.area-squares.v2` (F2.7), `math.transform.v2` and `math.tessellation.v2` (F2.8) |
| Visuals | F2.7 `geoboard`, `area-squares`; F2.8 `transform-plane`, `symmetry-mirror`, `tessellation` |
| Ages | F2.7 8 to 12 (`{ ages: [8, 12], adult: false }`); F2.8 8 to 15 (`{ ages: [8, 15], adult: false }`); the dilation and the bump-tile fixtures are offered only at 13 to 17 |
| ICAP level | Constructive, both pieces |
| Answer shape | point set (F0.3), always `{ points: { x, y }[] }` of whole numbers: geoboard the band's pegs in order; area-squares the shaded cells; transform the image's vertices in figure order; tessellation the anchor of each placed copy |
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

- The payload is `{ floor, tile }`: a floor of cells (at most 24 copies' worth) and a connected tile of 2 to 6 cells that is only slid, never
  turned. Whether a cover exists is checked when the lesson is published.
- A cursor handle names the anchor, the translation applied to the tile. Tap a cell, or press Enter or Space on the cursor ("Place tile"),
  to put a copy there. Tapping a cell that a copy already covers removes that copy ("Remove last" and "Reset" also work). The cursor tile
  is previewed as an outline.
- A copy that leaves the floor or overlaps another is refused with a sentence ("That tile does not fit there"), never accepted silently.
- Check sends the anchors. The floor is covered when every cell is under a copy.
- **Equivalent.** The status line says how many copies are placed and how many cells are left; "Show as table" lists each copy with its anchor.

## Scorer ladder

| Verdict | Geoboard | Area squares | Transform | Tessellation |
|---|---|---|---|---|
| `invalid` | malformed response or extra fields; a peg off the board or repeated; a band that crosses itself; with a rubric, a malformed key | not a set of distinct cells on the grid; with a rubric, a key that is not the squares inside the outline | not distinct whole-number points on the plane; with a rubric, a key that is not the image under the move | a copy that leaves the floor or overlaps another; with a rubric, a key whose copy count does not match the floor |
| `valid` | no band yet, and (without a rubric, as in the browser) any well-formed band | nothing shaded, and any well-formed shading without a rubric | the corners left on the figure, and any well-formed answer without a rubric | no copy placed, and any legal placement without a rubric |
| `review` | a band that is not the key; diagnostic `value` (area wrong) or `miss` (area right, figure wrong) | `miss`, `false_alarm`, `partial` or `value` from the point-set grader | `miss`, `false_alarm`, `partial` or `value` from the point-set grader | legal copies that leave part of the floor open; diagnostic `partial` |
| `met` | the right area, and the named figure when the task names one; score 100, diagnostic `none` | exactly the squares inside the outline | exactly the image | every floor cell covered |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/geom2/`: `geometry.ts` (lattice points, area in half squares, simple-polygon test, corner-based
shape matching), `geoboardModel.ts`, `areaModel.ts`, `transformModel.ts`, `tessellationModel.ts` (translation-only solver),
`contract.ts` (strict Zod payloads, rubrics, age scope), `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test:
`backend/src/__tests__/horizonte/geom2.test.ts`, which runs `assertScorerContract` for all four types.

Browser `frontend/src/rebuild/learning/horizonte/geom2/`: generated `contract|fixtures|scorer|geometry|geoboardModel|areaModel|transformModel|tessellationModel.generated.ts`,
`capabilities.ts`, `copy.ts`, `boards.tsx`, `boardKit.tsx` (shared frame, status line, table, outline helpers), `geom2.css`,
`GeoboardBoard.tsx`, `AreaSquaresBoard.tsx`, `TransformBoard.tsx`, `TessellationBoard.tsx`, `audit.json`, and the test
`geom2Boards.test.tsx` (runs `assertBoardContract`).

Forge `coursegen/src/v2/horizonte/geom2.ts` (capabilities, authoring guidance for all four types, gate-4 `geom2Gates`); test
`coursegen/src/__tests__/horizonte/geom2.test.ts`.

Fixtures: geoboard `geoboard-area-six`, `geoboard-right-triangle`; area `area-l-shape`, `area-staircase`; transform `reflect-triangle`,
`translate-parallelogram`, `rotate-quarter`, `mirror-half`, `dilate-center` (13 to 17); tessellation `tile-domino`, `tile-l`, `tile-bump`
(13 to 17). Preview: `?screen=fixture&seg=hz:geom2:geoboard-area-six&age=6-9`.

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
- **Translation-only tessellations.** A copy is slid, never turned or flipped, so the answer is just the list of anchors and the solver
  is an exact cover by translations. Turning and flipping tiles is a possible follow-up; it needs a richer answer than `{ points }`.
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
  outline, the image follows the move, an exact cover exists), so `solvabilityPacks.ts` stays untouched.
- **Payload identical in every locale.** Labels, rules and prompts live in board copy and the fixture's locale map, never in the segment.
- **Shared file.** `plano/Plano.tsx` gained an optional `tableToggle` prop (default `true`) and `data-hz-roving` on handle sliders. Both are
  backward compatible and every Plano test still passes.
- **Copy.** All strings carry a `data-copy-role`; es-MX and pt-BR are native text, not translations of the English, and avoid gendered
  agreement by putting the state after a colon.

## Known issues

- Hit size is declared and enforced in CSS but jsdom cannot measure layout; a real-browser check of the 64 px handles and of the four
  drawings belongs to the coordinator's audit pass. No screenshot was taken in this lane.
- The chunk budgets (12 KB gzipped each) are declared, not measured; `npm --prefix frontend run build` gives the real sizes.
- Tessellations are translation-only (see Decisions); a tile that needs a turn or a flip to cover a floor is not expressible yet.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.
- `fixtureCoverage.test.tsx` fails on `feat/horizonte-visual` for reasons outside this lane: the F0.2 `plano/` folder has an `index.ts`, so the test
  counts it as a pack that must register fixtures. geom2's own fixtures and `audit.json` were checked separately (the audit ids and ages match
  the fixtures, and all 12 load in en-US, es-MX and pt-BR).
