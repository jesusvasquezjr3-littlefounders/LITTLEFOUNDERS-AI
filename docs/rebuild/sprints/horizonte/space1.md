# Lane doc: space1 (F4.4 mental rotation, F4.5 plane sections and Platonic solids, F4.6 market stall and coin stacks)

Three Horizonte Visual pieces built in all three layers on the golden-pack template. The solids lane owns the WebGL engine; this pack stays in
pure SVG and uses the solids lane only as a vocabulary (cube, tetrahedron, octahedron, the cut-plane idea), not as an import.
Procedure: [RECIPE.md](./RECIPE.md). Answer shapes: [F0.3-answer-shapes.md](./F0.3-answer-shapes.md). Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

Status: implemented and tested locally on branch `hz/space1`. Not accepted, not released. See "Not verified" below. The fix round at the end of
this file (`hz/fx-space1`) extends F4.5, fixes the 375 px layout and the dark-mode ink; where the text above says 14 fixtures or no cone, cylinder,
Archimedean solid or sliding plane, the fix round supersedes it.

| Item | F4.4 | F4.5 | F4.6 |
|---|---|---|---|
| Segment types | `geometry.mental-rotation.v2` | `geometry.solid-section.v2` | `money.market-stall.v2`, `money.coin-stack.v2` |
| Visuals | `mental-rotation` | `solid-section` | `market-stall`, `coin-stack` |
| Ages | 6 to 17 and adult | 11 to 17 and adult | stall 7 to 12 (no adult); stack 7 to 17 and adult |
| Copy Budget band | 6-9, 10-12, 13-17 | 10-12, 13-17 | stall 6-9, 10-12; stack 6-9, 10-12, 13-17 |
| ICAP level | Constructive | Active | stall Constructive; stack Active |
| Answer shape | pick one target and a turn (discrete angle) | pick a shape, slide a plane, or type a whole number | stall arrangement (F0.3); stack typed whole number |
| Response | `{ pick, angle }` | `{ pick }`, `{ offset }` or `{ value }` | stall `{ slots: { itemId: ['item'] } }`; stack `{ value }` |
| Private key | `{ pick, angles }` | `{ pick }` or `{ target }` | stall `{ solutions: SlotMap[] }`, 1 to 8; stack `{ target }` |
| Capabilities | `visual.mental-rotation.v1`, `operation.turn-figure.v1`, `operation.pick-match.v1` | `visual.solid-section.v1`, `operation.turn-solid.v1`, `operation.choose-and-type.v1`, `operation.slide-plane.v1` (fix round) | `visual.market-stall.v1`, `operation.buy-items.v1`, `operation.tap-place.v1`; `visual.coin-stack.v1`, `operation.set-count.v1`, `operation.read-scale.v1` |
| Chunk budget (declared) | 16 KB gzipped | 24 KB gzipped (was 18 before the fix round) | stall 14 KB, stack 14 KB gzipped |
| Solvability checker (F0.4) | yes | yes | yes (both types) |

Segment types added: `geometry.mental-rotation.v2`, `geometry.solid-section.v2`, `money.market-stall.v2`, `money.coin-stack.v2`. They are registered
through the pack stubs in Core (`backend/src/services/horizonte/space1/`), the browser (`frontend/.../horizonte/space1/`) and the Forge
(`coursegen/src/v2/horizonte/space1.ts`). The four `SPACE1_CAPABILITIES` literals are identical in the three services (the parity gate passes).

## Behaviour

- **F4.4 mental rotation.** A figure of 3 to 10 unit cubes in a 3 by 3 by 3 box is drawn in an isometric SVG. The author fixes one axis (`up`,
  `side` or `depth`) and 1 to 3 targets labelled a, b, c. The learner turns the figure about that axis in stops of 0, 90, 180 and 270 degrees
  and picks the target it matches. The answer is discrete: the target and the angle. With several targets, the right target with a wrong turn is
  `partial`; with one target a wrong turn is `value`. A distractor is a mirror image or a changed shape, never a turn of the figure. A target equal
  to the figure as it stands, two equal targets, a distractor that is also a turn, or a disconnected figure is refused by the payload rules.
- **F4.5 sections and solids.** One board, three modes (five after the fix round: `cone` and `slide` joined, and `section`, `euler` and `volume` grew; see the end of this file). `section`: a translucent cube, tetrahedron or octahedron is cut by a plane
  (`normal . p = offset / 4`, the solid centred at the origin, cube corners at plus or minus 1); the learner names the shape of the cut from 2 to 4
  options. The cut is computed, never authored (`sectionShape`), and an option set that also contains a second true name (a square is also a
  rectangle) is refused through the `ALSO_TRUE` map. `euler`: one of the five Platonic solids is shown with one of V, E, F hidden, and the learner
  types it from V minus E plus F equals 2. `volume`: a square pyramid with a side and a height; the learner types the volume. The pyramid volume is
  side squared times height over 3 and is only offered when that is a whole number. Typing the prism volume (the one-third forgotten) is
  `review` with diagnostic `structure`.
- **F4.6 market stall.** 2 to 5 items, each with a price and a stock of 1 to 9, and one of three goals: `exact` (the basket costs the total),
  `change` (the basket costs what was paid minus the change) and `most` (the biggest bag a budget buys, so the most items, cheapest first). The
  learner taps an item to carry it and places it into the basket, or uses the "Move to" menu. Grading is by predicate (`basketMeets`), so every
  basket that meets the goal is `met`; the key lists 1 to 8 example baskets that the gates check against the same predicate.
- **F4.6 coin stack.** A stack of coins or bills drawn to scale beside reference marks (a phone, a book, a desk, a door). The learner sets the
  count with a slider handle or the "Move to" menu. The goal is either an amount of money (`amount`) or a height in millimetres (`height`). A coin
  is 2 mm thick and a bill 0.1 mm; the count handle moves on a `step` grid up to `max` (at most 40 positions), so the answer is always one of
  the handle's positions. The board prints the thickness and worth of one piece.
- **Equivalents.** Every drag has a keyboard or tap alternative. The rotation dial and the stack slider are `role="slider"` handles with
  arrow-key steps and a "Move to" menu; the solid stage turns by drag, arrow keys and four view buttons; the stall uses tap-to-carry and a
  "Move to" menu; counts and volumes are typed. Every board has a "Show as table" toggle and a live text line. All handles are 64 px. Motion sits under
  `prefers-reduced-motion: no-preference` and uses the 250 ms token. Colours come from tokens, and no meaning rides on colour alone.
- **`spokenText`.** The Euler rule V minus E plus F equals 2 renders through `MathExpression` with `spokenText` in the learner's locale. The
  volume, the stack and the stall carry plain localised numbers, money and lengths, with spoken forms (`spokenMoney`, `spokenLength`) in the
  stack's live status; they have no TeX, so no `spokenText` applies. The rotation has no math expression.

## Scorer ladders

| Piece | `invalid` | `valid` | `review` | `met` |
|---|---|---|---|---|
| F4.4 | malformed, a target the question lacks, an angle off the four stops, a malformed key | angle 0, no target picked, or no rubric yet | wrong target (`value`); right target, wrong turn (`partial` with several targets, else `value`) | the target and an angle that carries the figure onto it; score 100 |
| F4.5 section | malformed, a shape not among the options, a malformed key | nothing picked yet, or no rubric | another listed shape (`value`) | the shape the plane cuts |
| F4.5 euler, volume, cone | malformed, not a whole number, outside 0 to 30 (counts, Platonic) or 0 to 90 (counts, Archimedean) or 0 to 1728 (volume, cone), a malformed key | nothing typed yet, or no rubric | a wrong number (`value`); the prism volume of a pyramid (`structure`) | the hidden count or the volume |
| F4.5 slide | malformed, an offset off the slider (beyond the clamped range) | no rubric, or the plane has not left its start | the cut at the offset is another listed shape (`value`) or no clean cut (`miss`) | the cut at the offset is the target shape |
| F4.6 stall | malformed, an item the stall does not sell, a piece that is not an item, more than the stock, a key basket that does not meet the goal | empty or partly filled basket, or no rubric | under the total (`miss`) or over it (`false_alarm`); for `most`, over the budget (`false_alarm`) or short of the most items (`miss`) | the basket meets the goal, whichever items make it |
| F4.6 stack | malformed, not a whole number, off the step grid, above `max`, a key that is not the answer | blank or 0, or no rubric | too few (`miss`) or too many (`false_alarm`) | the count that makes the amount or the height |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Model rules (the contract both gates and scorers share)

- **Rotation.** Axis one of `up`, `side`, `depth`. Figure: 3 to 10 cells, every coordinate 0 to 2, connected through shared faces. Targets: 1 to 3
  connected figures, none equal to the figure as it stands and none equal to another. Exactly one target is the figure turned about the axis
  (every matching angle among 90, 180 and 270 goes in the key, so a symmetric figure may list several); every other target is not a turn of the
  figure about any axis, so the answer is unique.
- **Section.** `section`: solid cube, tetrahedron or octahedron; plane normal components from -3 to 3, offset from -16 to 16 (in quarters); the plane
  must cut the solid, and the options (2 to 4, listed once) must include the cut and no other true name for it. `euler`: a Platonic solid
  and a hidden count among vertices, edges, faces. `volume`: side 2 to 12, height 1 to 12, side squared times height divisible by 3.
- **Stall.** 2 to 5 items from a fixed list of ten ids, price 1 to 2000, stock 1 to 9, totals at most 10000. `exact` and `change` need a basket that
  reaches the cost (`change` is paid minus change); `most` needs a budget that buys at least the cheapest item but not the whole stall. The
  response has one slot per item holding up to its stock, and every piece is the one repeatable piece `item`.
- **Stack.** `value` is in whole cents of a generic currency and `piece` is `coin` or `bill`. The answer is a whole count that is a multiple of
  `step`, between one step and `max`, and `max` has at most 40 grid positions. Height goals are in whole millimetres of the thickness above.

## Files

Backend `backend/src/services/horizonte/space1/`: `voxels.ts` (figure, turns, mirror, connectivity, congruence by turning, `voxelAxis`),
`polyhedra.ts` (Platonic and Archimedean meshes, plane sections, the cylinder cut, shape classification, Euler counts, pyramid volume, `ALSO_TRUE`), `rotationRules.ts`,
`sectionRules.ts`, `stall.ts`, `coins.ts` (the four models), `contract.ts` (zod segment schemas, rubrics, age scope), `capabilities.ts`,
`scorer.ts`, `fixtures.ts`, `index.ts`. Test: `backend/src/__tests__/horizonte/space1.test.ts` (39 after the fix round, runs `assertScorerContract`).

Browser `frontend/src/rebuild/learning/horizonte/space1/`: generated `contract|voxels|polyhedra|rotationRules|sectionRules|stall|coins|scorer|fixtures.generated.ts`,
`capabilities.ts`, `copy.ts` (en-US, es-MX, pt-BR, `data-copy-role` on every string), `space1Text.ts` (live text and `spokenText`),
`VoxelFigure.tsx`, `PolyStage.tsx` (shared SVG drawing), `MentalRotationBoard.tsx`, `SolidSectionBoard.tsx`, `MarketStallBoard.tsx`,
`CoinStackBoard.tsx`, `space1.css`, `boards.tsx` (four lazy chunks), `audit.json`, `index.ts`, `space1.test.tsx` (51 after the fix round, runs `assertBoardContract`
on all 23 fixtures; `cutFacts.ts` describes a cut without naming it).

Forge `coursegen/src/v2/horizonte/space1.ts` (capabilities, guidance, gate-4 `space1Gates`, the four F0.4 checkers `rotationChecker`,
`sectionChecker`, `stallChecker`, `coinChecker`) and `space1Geometry.ts` (a self-contained copy of the geometry, because the Forge cannot import
Core); test `coursegen/src/__tests__/horizonte/space1.test.ts` (29 after the fix round). `coursegen/src/v2/solvabilityPacks.ts` imports the module so the checkers register.

Fixtures (23 after the fix round, 14 originally; the fixture id is the preview key, and each segment id carries a mode prefix such as `rotation-`, `section-`, `euler-`, `volume-`, `stall-`, `coins-`): `turn-the-l`,
`pick-the-turned`, `turn-the-corner`, `cube-hexagon`, `tetrahedron-square`, `cube-edges`, `dodecahedron-faces`, `pyramid-third`, `exact-basket`,
`make-the-change`, `most-for-three`, `coins-as-tall-as-a-phone`, `coins-worth-fifteen`, `a-million-in-bills`, plus the nine of the fix round (listed there). Preview:
`?screen=fixture&seg=hz:space1:<fixture>&age=<band>`; `audit.json` lists all 23 with their age so the audit lane finds them.

## Forge gate 4 and solvability

- **Gate 4** (`space1Gates`) checks, per segment of the four types: the visual fits the type; the prompt is at most 24 words; the payload (strict
  read, then the type's rule: `rotationProblem`, `solidSectionProblem`, `stallProblem` plus `stallAnswer` not null, `coinProblem`). Messages match Core's.
- **Rotation checker.** No target that matches by turning is `no-solution`; two or more targets that match, or a distractor that also matches, is
  `ambiguous-solution`; any other shape problem is `impossible-state`. A key whose angles or pick differ from the computed ones is `rubric-gap`
  or `rubric-accepts-invalid`.
- **Section checker.** A cut that is missing, or options lacking the cut, is `no-solution`; an option that is also true is `ambiguous-solution`.
  `euler` and `volume` prove the answer from the payload (a Platonic solid that breaks V minus E plus F equals 2 is `impossible-state`); a key
  that is not that answer is a rubric finding.
- **Stall checker.** An unreachable total or a budget that buys nothing is `no-solution`; a budget that buys the whole stall is
  `impossible-state`; every key basket must be fillable from the stall and meet the goal (`rubric-accepts-invalid`). The key lists examples, not
  every solution, because the scorer grades by predicate, so there is no `rubric-gap` for the stall.
- **Stack checker.** An answer of null is `no-solution`, one outside one step to `max` is `out-of-bounds`, anything else wrong is `impossible-state`.
- **Independent model.** `space1Geometry.ts` is a copy. Its tests import the backend modules by relative path and compare them: 3 solids by 342
  plane normals by 9 offsets for `sectionShape`, every figure turn and matching angle, and neighbours of the stall and coin rules, so a drift in
  either copy fails a test.

## Decisions

- **SVG, not WebGL.** The solids lane owns WebGL. This pack draws isometric cubes and polyhedra in SVG, so it keeps the SVG-by-default rule and
  loads no 3D chunk.
- **A discrete answer for rotation.** The answer is a target and one of three angles, never a free-drag angle, so grading is exact and the
  keyboard alternative is the primary control.
- **Plane is authored, shape is computed.** The author gives the plane; the key is whatever `sectionShape` classifies. This removes the
  authoring error where a stated answer disagrees with the geometry, and `ALSO_TRUE` removes the ambiguity of a square among rectangles.
- **Predicate grading for the stall.** Many baskets reach a total, so the scorer grades by `basketMeets` and the key lists examples checked against it.
- **`most` is the cheapest-first count.** The biggest bag is the most items the budget buys; cheapest first is optimal for count, so the answer is
  the item count, not a particular basket.
- **Teaching thickness.** A coin is 2 mm and a bill 0.1 mm. Real thicknesses vary; the lane uses two round numbers so the scale arithmetic is
  clean and the board labels them as teaching sizes.
- **Generic currency.** The stack and the stall show money with the fin1 `format.ts` helper and name no real currency.
- **Age.** The stall stops at 12 (no adult scope); sections start at 11 (planes and Euler need the vocabulary); rotation opens from 6 with one
  target and an easy figure. Each fixture band falls inside its piece's scope.
- **Type ids and capabilities** are the four above, in parity across Core, the browser and the Forge.
- **Copy.** Every string carries `data-copy-role`; es-MX and pt-BR are written natively.

## Not verified

- No real-browser or visual check: no screenshot, no Playwright, no dev server. The 64 px handles, the isometric SVG layout, how legible a cut
  plane looks over a translucent solid, the table toggles and reduced motion are enforced by the board harness in jsdom, which cannot measure layout.
- Chunk budgets (16, 24, 14, 14 KB gzipped; the section board went from 18 to 24 in the fix round) are declared, not measured: no build was run.
- The full gates did not run (`test:all`, `tools:test`, `verify:*`, `audit:*`, `spec:check`, the Copy Budget audit over a rendered page). Only
  focused tests, the parity, sync and copy checks, and one type-check per service ran.
- The audit lane has not run over `audit.json`; the fixtures were not rendered by it.
- Native review of the es-MX and pt-BR copy by a person has not happened.

## Limits

- Superseded in part by the fix round below: the cylinder, the cone and five Archimedean solids now exist. The dodecahedron and the
  icosahedron still appear only in `euler` mode, and the cylinder is cut by formula, not by a mesh.
- The section is drawn as the cut polygon over a translucent solid, not as a true clipped solid. In `section` mode the plane is fixed by the author and the
  learner turns the solid; the plane slides only in `slide` mode (fix round).
- Volume covers the square pyramid and, since the fix round, the cone. Both need a whole answer, so side squared (or radius squared) times height
  must divide by 3.
- The rotation box is 3 by 3 by 3 with at most 10 cubes and one axis per question.
- The stall has 5 items at most and a stock of 9 at most. In the browser board, tapping a basket chip while carrying an item places the carried item
  instead of removing the chip; the "Move to" menu and the remove button are the exact controls.
- Stack thicknesses are teaching approximations (coin 2 mm, bill 0.1 mm). Heights read against four fixed reference marks.
- The Forge geometry is a copy pinned to Core by tests that import the backend by relative path; if Core changes, the tests fail until the copy
  follows.
- The browser scorer copy is advisory (valid or invalid); Core grades.

## Owner follow-ups

- Run the audit lane over `space1/audit.json` and review the 23 fixtures in a real browser at 6-9, 10-12 and 13-17, in particular the cut plane over
  the solid and the stack beside its reference marks.
- Measure the four chunk sizes against the declared budgets at the first build.
- Have a native reader review the es-MX and pt-BR copy.
- Decide whether the teaching thicknesses (coin 2 mm, bill 0.1 mm) should be labelled in the lesson text or only on the board.
- Decide whether the stall needs an adult scope.
- Accept the pieces in `REQUIREMENTS.md` only after the browser pass; this lane records implementation only.

## Fix round (fx-space1)

Branch `hz/fx-space1`, on top of `hz/space1` as merged into `feat/horizonte-visual`. Three jobs: finish F4.5, fix the pack at 375 px, fix the pack in
dark mode. No segment type was added; the new behaviour is new modes and enum members on `geometry.solid-section.v2`.

### What changed

- **Cone volume.** `sectionRules` mode `cone`: payload `{ radius 1..12, height 1..12 }` with radius squared times height divisible by 3, so the
  answer (a third of the cylinder, in units of pi) is whole. Response `{ value }`, key `{ target }`. Typing the cylinder's volume is `review` with
  diagnostic `structure`, the same ladder as the pyramid. The board draws the cone inside its cylinder and prints the cylinder's volume as a
  readout. The bound is the same 0 to 1728 as the pyramid.
- **Cylinder sections.** `section` mode accepts `cylinder` (radius 1, half height 1.5, standing on the y axis). The cut is computed by formula
  (circle, rectangle or ellipse) and never authored. `sectionProblem` refuses a plane whose cut runs into an end cap, because that is not one of
  the three named shapes. The board draws the cylinder as a ring of 48 strips with `PolyMesh.curved`, which sets `data-curved` on the stage so a test
  can tell it from a polyhedron. The text equivalent says how the plane runs (level, along the axis, or slanted) and never names the shape.
- **Archimedean solids.** `euler` mode accepts the truncated tetrahedron, the cuboctahedron, the truncated octahedron, the icosidodecahedron and the
  truncated icosahedron. The meshes are built from the Platonic ones by `truncated()` and `rectified()`, and a test checks V minus E plus F equals 2 for
  each. The typed bound is 0 to 90 for an Archimedean solid and stays 0 to 30 for a Platonic one (`eulerBounds(solid)`). They appear only in `euler`.
- **A plane the learner slides.** `slide` mode is a new answer shape with the capability `operation.slide-plane.v1` (appended to the F4.5 literal in
  Core, the browser and the Forge, in parity). Payload `{ solid, normal, start, target }`: the learner moves the plane along its normal until the cut is
  `target`. Response `{ offset }`, key `{ pick: target }`. The offset must lie on the slider, clamped to plus or minus 16 quarters. The scorer: `invalid`
  for an offset off the slider or malformed; `valid` with no rubric or while the plane is still at `start`; `met` when `slideCut(payload, offset)` is the
  target; `review` otherwise (diagnostic `value` for another listed shape, `miss` for a position with no clean cut). `slideProblem` refuses a start off the
  slider, a target no position gives, a start that already is the target, and a target whose answer is also true under `ALSO_TRUE` (ambiguous).
- **The slide board.** A 64 px handle (`role="slider"`, `aria-valuetext` is the position only) moves by pointer drag on the track, by Arrow keys (one
  step), Page keys (four steps, `OFFSET_UNIT`) and Home and End. The alternatives: "Plane back" and "Plane forward" buttons, a "Move to" menu of positions,
  and a table of every position and its cut. A `role="status"` line carries the text equivalent. It never names the shape: it gives the side count, and for
  four sides also the pairs of parallel sides, whether all sides are equal and whether all angles are right (`cutFacts.ts`, from `classifyPolygon`), so a
  square can be told from a rectangle without the word. Check enables once the plane has left its start; Reset returns it. The board never says
  `met`; the server grades.
- **Forge.** Capability literal and guidance for the cone, the cylinder, the Archimedean solids and the slide; `sectionIssues` (gate 4) and the section
  checker know the new cases; `space1Geometry.ts` mirrors the new geometry and the tests compare it with Core (the cylinder cut, the Archimedean
  counts, the cone, and every payload read, answered and judged as Core does). `emitted-horizonte.json` was re-emitted because the capability literal
  changed.
- **Nine fixtures** (23 in all), each in `audit.json`: `cone-third` (13-17), `cylinder-circle` (10-12), `cylinder-rectangle` (13-17),
  `cylinder-ellipse` (13-17), `truncated-icosahedron-faces` (13-17), `cuboctahedron-edges` (13-17), `slide-cube-hexagon` (10-12),
  `slide-tetrahedron-square` (13-17) and `slide-cylinder-ellipse` (13-17). Copy is in en-US, es-MX and pt-BR with `data-copy-role`.
- **Narrow screens.** At 375 px the lesson slot is 311 px wide and three `money.market-stall.v2` fixtures overflowed by 66 to 85 px. A new
  `TableScroll` (a focusable `role="region"` with a name, `overflow-x: auto`) now wraps the stall, the coin-stack and the rotation tables. The grid
  tracks of the rotation, section, Euler, volume, slide and coin boards are `minmax(0, 1fr)` so a wide child cannot stretch the slot, and below 30rem the
  table padding shrinks and the Euler counts wrap.
- **Dark mode.** `var(--ink)` is a constant and does not flip, so text and strokes drawn with it vanished on a dark surface. Every use in `space1.css` now
  uses `--content` or `--content-muted`, which flip. `tokens.css` and the shared design files were not touched. No `var(--ink)` remains under `space1/`.
- **Chunk budget.** `geometry.solid-section.v2` moved from 18 to 24 KB gzipped in `boards.tsx`. The estimate is the minified, gzipped sum of the board's
  source set (about 19.2 KB: board 4.0, `cutFacts` 0.6, `PolyStage` 1.1, `polyhedra` 4.5, `sectionRules` 1.7, `space1Text` 1.2, `copy` 6.5), rounded up with headroom.
- **Tests.** Core 39 (`space1.test.ts`, `assertScorerContract`), Forge 29, browser 51 (`assertBoardContract` on all 23 fixtures, plus the cone, cylinder,
  Archimedean and slide behaviour including es-MX).

### Still limited

- A cylinder cut that runs into an end cap is refused, not offered as a named shape; the slide board reports it as a clipped cut ("no clean cut").
- In `section` mode the readout counts the edges the plane crosses and gives no equal-side facts, because that would give the answer away. Only the
  slide board describes a four-sided cut in full.
- The Archimedean solids appear only in `euler`; sections and the slide still use the cube, tetrahedron, octahedron and cylinder.
- The cylinder is cut by formula and drawn as 48 strips; it is not a true curved surface.
- The slider is clamped to plus or minus 16 quarters, so with a large plane normal the slider can end before the plane leaves the solid.
- The Platonic Euler bound is unchanged at 0 to 30.
- The Forge geometry is still a mirror pinned by tests, now over the new cases too.
- The "Move to", Reset and Check buttons come from the shared `segmentKit` components, which this unit does not own. An earlier audit flagged their
  contrast (about 2.3:1 in one locale); that is not changed here.

### Not verified

- No browser, no Playwright, no screenshot. The 375 px fix and the dark-mode fix rest on reading the CSS and on jsdom tests, which cannot measure layout
  or contrast. The three stall fixtures were not re-measured at 311 px.
- The slide board and the curved cylinder were not seen: the handle's position on the track, the strip ring, the cut over the solid and the table
  at 311 px are untested visually.
- The 24 KB chunk budget is an estimate from a minified gzip of the sources, not a build measurement.
- The berry, sky and mint constants do not flip in dark mode; a calculation puts them near 3:1 against the dark surface, which was not measured on a render.
- The full gates did not run (`test:all`, `tools:test`, `verify:*`, `audit:*`, `spec:check`). What ran: the focused suites above, the capability parity
  script, the copy check, `sync-v2-horizonte --check`, and one type-check per touched service.
- A native reader has not reviewed the new es-MX and pt-BR copy.

### Owner follow-ups

- Other packs still use `var(--ink)` and have the same dark-mode defect: alg1, alg2, com, num-b, plane1, prob, sim1, sim2, solids, space2, stats1.
- Run the audit lane over `space1/audit.json` (23 fixtures) at 375 px, in light and dark, at 6-9, 10-12 and 13-17.
- Measure the section board's chunk at the first build against the 24 KB budget.
- Have a native reader review the new es-MX and pt-BR strings.
