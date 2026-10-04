# Lane doc: solids (F4.1 solid viewer, F4.2 cube nets, F4.3 stacked cubes)

The geometry pack of the Horizonte Visual. It owns the only 3D board in the programme (the lazy solid viewer, allowed by OD-35)
and the pure geometry engine that the space1 and space2 lanes build on. Procedure: [RECIPE.md](./RECIPE.md).

| Item | F4.1 solid viewer | F4.2 cube nets | F4.3 stacked cubes |
|---|---|---|---|
| Segment type | `geometry.solid-viewer.v2` | `geometry.cube-net.v2` | `geometry.cube-stack.v2` |
| Ages | 7 to 12 | 7 to 12 | 6 to 12 |
| ICAP level | Active | Constructive | Constructive |
| Answer shape | choice plus numeric text | arrangement (F0.3) | arrangement (F0.3) |
| Rendering | lazy 3D chunk, SVG fallback | SVG | SVG isometric, no WebGL |

Adult pathway: refused for all three (`adult: false`).

## Engine API (read this first, space1 and space2)

Everything below is pure TypeScript with no DOM, no three.js and no randomness. It lives in
`backend/src/services/horizonte/solids/` and the sync tool ships it to the browser as `*.generated.ts` next to the boards
(`node agent/tools/sync-v2-horizonte.mjs`). Import it from there; never hand-edit a generated copy. In another lane, import it from
`../solids/model.generated`, `../solids/projection.generated`, `../solids/stack.generated`, `../solids/net.generated`.
A backend or Forge file may import `./model.js` and friends directly (the Forge cannot import across services: it keeps its own copy of
whatever logic it needs, see the Forge section).

### `model.ts` (the four solids)

| Export | Meaning |
|---|---|
| `SOLID_IDS`, `SolidId` | `cube`, `prism` (triangular), `pyramid` (square base), `cylinder` |
| `SOLID_COUNTS` | the teaching counts: cube 6/12/8, prism 5/9/6, pyramid 5/8/5, cylinder 3/2/0 (faces/edges/vertices) |
| `COUNT_KINDS`, `CountKind`, `countOf(solid, kind)` | the three countable things |
| `solidsWithCount(kind, count, among?)` | which solids have N of a kind; "which has 9 edges" has one answer |
| `solidMesh(id)` | `{ vertices, corners, faces, edges }`, counter-clockwise faces, y up, unit-sized, at most about 150 triangles |
| `meshCounts(mesh)` | the counts a mesh really has; a test pins it equal to `SOLID_COUNTS` |
| `describeSolid(id)` | faces, edges, vertices plus flat and curved faces and edges: the source of the table and text view |
| `faceNormal`, `faceCentroid` | outward unit normal and centre of a face |

The cylinder has 3 faces (two flat circles and one curved surface), 2 curved edges (the rims) and no vertices. Its 24 side quads are a
tessellation only: their shared lines are `smooth` edges, never counted, drawn only as silhouettes.

### `projection.ts` (fixed views, projection, labels)

| Export | Meaning |
|---|---|
| `SolidView { yaw: 0..3, pitch: 0..2 }` | twelve fixed views: four quarter turns by three pitches (level, isometric corner, from above) |
| `DEFAULT_VIEW`, `VIEW_KEYS`, `viewKey`, `parseViewKey`, `isSolidView` | the closed view vocabulary (`corner-0`, `level-2`, `top-1`, ...) |
| `stepView(view, 'left' \| 'right' \| 'up' \| 'down')` | one arrow key is one snap. Left and right wrap round the four yaws; up and down change the pitch and clamp |
| `ARROW_STEPS` | `ArrowLeft/Right/Up/Down` to a `ViewStep` |
| `viewBasis(view)` | the screen axes in world space (right, up, toward the camera) |
| `projectPoint(point, view, lens)` | world point to a 240 by 240 scene, y down. `ORTHOGRAPHIC_LENS` for the SVG, `PERSPECTIVE_LENS` for the 3D overlay |
| `cameraPose(view, distance)` | the 3D camera position and up vector for a view (a cut, never a tween) |
| `composeScene(solid, view, { lens?, labels? })` | flat drawing data: front-facing `polygons` (with a `shade` of 0 to 3, no colours), `edges` (visible and hidden, with `kind`), and `labels` |
| `labelNames(solid, mode)` | the label list a table or a screen reader reads: numbers for faces and edges, letters for vertices |
| `LabelMode` | `none`, `faces`, `edges`, `vertices` |

`composeScene` culls back faces (a convex solid needs no depth sort), draws hidden edges as `hidden: true` only where no visible edge
covers them, and drops a label that would sit within 11 units of a visible one. Label numbers and letters are stable across views, so
"face 2" is the same face in every view. The orthographic scene and the perspective scene share the same camera maths, which is why the
3D chunk can overlay HTML labels computed here instead of running its own projection.

### `stack.ts` (stacked cubes)

Grid convention: `heights[row][col]`, row 0 at the back, the last row at the front, column 0 at the left, 2 by 2 or 3 by 3, at most 3
cubes a cell.

| Export | Meaning |
|---|---|
| `Heights`, `isHeights`, `emptyHeights`, `stackTotal`, `sameHeights` | the model |
| `frontView`, `sideView`, `planView`, `viewsOf` | front: tallest per column, left to right. Side: seen from the right, left to right is front to back. Plan: 1 where a column stands |
| `StackGoal { front?, side?, plan? }`, `isStackGoal`, `matchesGoal(heights, goal)` | the public goal: views to match |
| `solveStack(goal, size, maxHeight?, limit?)` | exhaustive and exact: `{ count, minimum, maximum, fewest[] }`. At most 4^9 stacks, so no heuristic |
| `stackSlotId(col, row)` (`c{col}r{row}`), `stackContext(size)`, `stackToSlots`, `slotsToStack` | the F0.3 arrangement plumbing: one repeatable `cube` piece, a slot per cell holding up to 3 cubes |
| `composeStackScene(heights)` | the isometric drawing: `{ width, height, ground, cubes[] }`, cubes sorted back to front with `top`, `front`, `side` polygons. Pure SVG, no WebGL |

### `net.ts` (cube nets)

| Export | Meaning |
|---|---|
| `FACE_NAMES`, `FaceName`, `OPPOSITE` | `top`, `bottom`, `front`, `back`, `left`, `right` |
| `NetCell [col, row]`, `NetGrid`, `NET_GRID_LIMITS`, `cellsOf`, `isNetGrid`, `inGrid` | net geometry on a grid of at most 5 by 4 |
| `foldNormals(cells)` | folds the squares into a cube corner (first square faces the viewer) and returns the outward normals; null when disconnected or two squares collide |
| `isCubeNet(cells)` | six connected squares that fold without overlap: exactly the eleven cube nets (pinned by a test over every placement on a 5 by 4 grid) |
| `allLabellings(cells)`, `labelSolutions(cells, fixed)` | the 24 consistent namings of a net; two fixed neighbours leave exactly one |
| `completions(fixed, grid, add, limit?)` | exhaustive: every way to complete a partial net |
| `surfaceArea(edge)` | `6 * edge * edge` |
| `netSlotId`, `gridSlotId`, `parseGridSlot`, `slotsToLabelling`, `slotsToCells` | the F0.3 arrangement plumbing for the two net modes |

### Viewer component (browser, `frontend/src/rebuild/learning/horizonte/solids/`)

`SolidViewer` is the one reusable surface. A lane that needs a solid on screen imports it lazily inside its own board and passes:

```ts
interface SolidViewerProps {
  solid: SolidId;
  view: SolidView;                       // controlled; use DEFAULT_VIEW first
  onViewChange: (view: SolidView) => void;
  labels: LabelMode;                     // 'none' by default; the viewer does not own a label control
  name: string;                          // accessible name, written by the caller in the learner's language
  description: string;                   // text equivalent (faces, edges, vertices) for the table and screen reader
  renderMode?: 'auto' | 'svg' | 'webgl'; // 'auto' follows the Mentor stage fallback policy; tests force 'svg'
}
```

- Render policy (`useSolidRenderMode`) mirrors the Mentor stage: SVG when `probe.webgl === 'none'`, when `pickInitialTier(probe) === 'low'`,
  when `navigator.connection.saveData` is set, or when the learner prefers reduced motion. Otherwise the WebGL chunk loads.
- The viewer renders one canvas, `SceneCanvas` with a perspective camera, no shadows, DPR at most 1.5, one draw call per solid, under 10 k
  triangles, a cut (not a tween) between views. Labels are HTML over the canvas.
- Keyboard: the viewer is a focusable group. Arrow keys call `stepView`; four direction buttons give the same moves by tap.
  Every move is announced in a polite live region (for example "Corner view, turn 1 of 4").
- It never touches the Mentor stage: it imports only `tutor-scene/SceneCanvas`, `tutor-scene/quality`, never `TutorStage`, and a
  lesson never shows a viewer and the Mentor stage canvas at the same time.

## OD-35 notes (the one lazy 3D board)

- The 3D code (three.js through React Three Fiber) sits in one lazy chunk, `SolidScene3D`, imported only by `SolidViewer` and only
  when `renderMode` resolves to `webgl`. The board entry that lessons register stays under the 60 KB gzip board budget; the three.js
  chunk is shared with the Mentor stage dependency graph and is documented, not counted, in the board budget.
- Only `solids/**` imports the 3D renderer. No other lane may import `SceneCanvas` or `three`.
- The SVG fallback is the full feature set, not a degraded one: labels, views, table. It is what runs in tests and on low-power
  devices, and the WebGL path adds only shading and depth.
- No decoration: a neutral board, flat tokens, no celebration. The solid is drawn in a single hue per face shade from the tokens.

## Pieces and catalogue rows

| Piece | Catalogue rows | What it is |
|---|---|---|
| F4.1 SOLIDS ENGINE | [3:1] | The pure solids model, the twelve fixed views, the SVG orthographic projection and the lazy 3D viewer with the SVG fallback. The segment `geometry.solid-viewer.v2` asks the learner to pick the solid that has a stated count of faces, edges or vertices and then to count one of the other kinds on it. |
| F4.2 FOLDABLE CUBE NETS | [3:2], [m:E29], [m:E30] | `geometry.cube-net.v2`, two modes. `label` names the squares of a given net (the folded cube in the same board shows what a name means). `complete` finishes a partial net so it folds into a cube. The surface-area readout (`6 x edge x edge`) sits next to the net. |
| F4.3 STACKED CUBES | [3:3], [3:6], [3:23], [m:E31], [m:E37] | `geometry.cube-stack.v2`: build a stack on a 2 by 2 or 3 by 3 grid so the front, side and plan views match, counting the cubes; `fewest` asks for the smallest number that shows the views. A pure SVG isometric drawing, no WebGL at all. |

## Segment contracts

Capability literals (identical in `solids/capabilities.ts` on the backend and the browser and in `coursegen/src/v2/horizonte/solids.ts`;
`node agent/tools/check-v2-lesson-capability-parity.mjs` pins them):

| Segment type | Capabilities | Ages | Adult |
|---|---|---|---|
| `geometry.solid-viewer.v2` | `visual.solid-viewer.v1`, `operation.fixed-views.v1`, `operation.choose-and-count.v1` | 7 to 12 | refused |
| `geometry.cube-net.v2` | `visual.cube-net.v1`, `operation.place-faces.v1`, `operation.fold-net.v1` | 7 to 12 | refused |
| `geometry.cube-stack.v2` | `visual.cube-stack.v1`, `operation.stack-cubes.v1`, `operation.linked-views.v1` | 6 to 12 | refused |

All three are `grading: 'server'`; the visual descriptor is `{ type: 'solid-viewer' | 'cube-net' | 'cube-stack' }`. Payloads are strict
(`contract.ts`), and every payload is also checked by a rule (`rules.ts`) so a key that no learner could meet is refused at authoring time.

### F4.1 `geometry.solid-viewer.v2`

- Payload: `{ solids: SolidId[] (2 to 4, each once), find: { kind, count }, report: kind }`. `find.kind` and `report` differ.
  "Which solid has `find.count` of `find.kind`" must have exactly one answer among `solids`; the learner then counts `report` on it.
- Response: `{ solid: string, count: string }` (a choice plus a numeric text). Rubric: `{ solid, count }`, which must equal the
  answer the payload implies (a drifting key is `invalid`, never accepted).
- Ladder: `invalid` (malformed, a solid that is not listed, a count that is not a number), `valid` (blank fields, or any well-formed
  answer without a rubric), `met` (both right), `review` with `partial` (one of the two) or `value` (neither).
- Sample: the blank response. Age scope above.

### F4.2 `geometry.cube-net.v2`

- Payload `label`: `{ mode: 'label', cells: [col,row] x6, fixed: [{ cell, name }] (1 to 3), edge }`. The net must be one of the eleven.
  The fixed names must leave exactly one naming of the other squares (two fixed neighbours always do), which `labelSolutions` checks.
- Payload `complete`: `{ mode: 'complete', grid: { cols, rows }, fixed: [col,row] (2 to 5), edge }` on a grid of at most 5 by 4. At least one
  completion must exist; several are allowed and every one is a valid key.
- Response and rubric: the F0.3 arrangement shape. `label`: slots `cell0..cell5`, one face name each (`top`, `bottom`, `front`, `back`,
  `left`, `right`). `complete`: slots `g{col}x{row}` holding the repeatable piece `square`. Rubric `{ solutions: [slots...] }`.
- Ladder: `invalid` (malformed, a given square or name moved, a name used twice, a square off the grid); `valid` (only the given squares,
  or no rubric); `met` (a correct naming, or six squares that fold into a cube, judged on the geometry and not on the key);
  `review` with `partial`, `miss` (right so far, not finished), `value`, `false_alarm` (more than six squares) or `structure` (six
  squares that do not fold).
- The surface-area readout is a derived display (`surfaceArea(edge)`), not a graded field in this release.

### F4.3 `geometry.cube-stack.v2`

- Payload: `{ size: 2 | 3, start: heights (rows of columns, at most 3 cubes a cell), goal: { front?, side?, plan? }, fewest }`. Heights are
  `heights[row][col]`, row 0 at the back. The goal needs at least one view; `solveStack` must find a solution; with `fewest` the key is
  the minimum.
- Response and rubric: the F0.3 arrangement shape on slots `c{col}r{row}`, each holding up to three of the repeatable piece `cube`.
- Ladder: `invalid` (malformed, a slot off the grid, a cell above three cubes); `valid` (the start untouched, or no rubric); `met` (every
  goal view matches, with the fewest cubes when asked); `review` with `partial` (some views), `value` (none) or `false_alarm`
  (the views match but there are more cubes than the minimum).
- The linked views (front, side, plan) are drawn next to the isometric stack and update as cubes are added; the table view lists the
  same numbers in text.

## Files per layer

| Layer | Path | Content |
|---|---|---|
| Backend | `backend/src/services/horizonte/solids/` | `model`, `projection`, `stack`, `net` (engine), `rules` (payload readers and authoring checks), `scorer`, `contract` (segments, rubrics, age scope), `fixtures` (6), `capabilities`, `index` |
| Backend tests | `backend/src/__tests__/horizonte/solids.test.ts`, `solidsEngine.test.ts` | engine geometry, scorer ladders, contract refusals, fixture ladders, age scope |
| Browser | `frontend/src/rebuild/learning/horizonte/solids/` | generated copies (`model`, `projection`, `stack`, `net`, `rules`, `scorer`, `contract`, `fixtures`), `capabilities.ts`, `boards.tsx`, the viewer (`SolidViewer`, `SolidViewerBoard`, `SolidScene3D`, `SolidSvg`, `renderMode`), the net boards (`CubeNetBoard`, `NetLabelBoard`, `NetCompleteBoard`, `NetArea`, `FoldedCube`, `netFold`), the stack board (`CubeStackBoard`, `StackViews`), `copy.ts`, `solidsText.ts`, `solids.css`, `audit.json`, tests |
| Forge | `coursegen/src/v2/horizonte/solids.ts`, `solidsGeometry.ts`, `coursegen/src/__tests__/horizonte/solids.test.ts` | guidance, gate 4, three solvability checkers, the Forge's own pure geometry copy |
| Shared (one line) | `coursegen/src/v2/solvabilityPacks.ts` | `import './horizonte/solids.js';` so the checkers register |
| Shared (earlier in this lane) | `agent/tools/check-product-spec.mjs` and its test | the scene-canvas ban now allows `solids/**`, the only place OD-35 permits it |

### Board behaviour (all three)

- Lazy boards: `boards.tsx` registers one lazy entry per type (budgets declared: viewer 16 KB, net 18 KB, stack 14 KB gzip; ICAP
  active, constructive, constructive). The 3D chunk is a second lazy import behind the viewer and loads only in `webgl` mode.
- Keyboard alternative on every interaction: arrow keys step the viewer (four direction buttons do the same by tap); every net and stack
  cell is a button (a tap toggles a square, names a square from the tray, or cycles a stack cell through 0 to 3 cubes), and the pieces
  can also be moved by the shared F0.3 drag helper. Grid cells and drag handles are 64 px (`--hz-hit`, `data-hz-hit="64"`). Show-as-table
  is a real table (counts, names, heights, views) with the same numbers as the drawing.
- Reduced motion: the viewer draws the SVG and never tweens (a view change is a cut); the only transitions are colour fades inside
  `prefers-reduced-motion: no-preference`.
- Tokens only (`solids.css`), a neutral board, no celebration; copy in en-US, es-MX and pt-BR with `data-copy-role` on every string
  (`copy.ts`, `solidsText.ts`).

## Forge pack

- Guidance: three line-sets (one per type): the ages, the count table, the key shapes, the "exactly one match" rule, the eleven nets, the
  two net modes, the stack views and the `fewest` rule.
- Gate 4: visual descriptor type, prompt of at most 24 words, payload read errors named in plain words, and the structural checks below.
- Solvability checkers (registered through `registerSolvabilityChecker`):
  - viewer: 0 matches is `no-solution`, more than 1 is `ambiguous-solution`; the key `{solid, count}` is compared to the derived answer.
  - net: the cells are one of the eleven nets and fit the grid, `label` has exactly one naming, `complete` has at least one completion,
    every key solution contains the fixed squares and folds (a key that does not is `rubric-accepts-invalid`).
  - stack: the goal has a solution, the start is not already the answer, with `fewest` the key equals the minimum.
- The Forge keeps its own geometry copy because it cannot import across services; a test pins it to the backend's counts (216 cube-net
  placements on a 5 by 4 grid, the same as the backend test).

## Decisions made without asking (assumptions)

1. Cylinder faces count as 3 (two flat, one curved), edges as 2 (the rims), vertices as 0: the teaching count. Its 24 side quads are a tessellation only.
2. "Prism" is the triangular prism and "pyramid" the square-based pyramid. The four solids give distinct counts for the searched kinds
   often enough to write unambiguous questions, and the Forge checker refuses any question that has zero or several matching solids.
3. Views are twelve fixed snaps, never a free orbit: it is keyboard-operable, stable under reduced motion and the same on the SVG and the 3D chunk.
4. Net grid at most 5 by 4, edge 1 to 20 (`NET_EDGE_LIMIT` in `rules.ts`); eleven nets and 24 namings, searched exhaustively, so every answer is exact.
5. Stack grid 2 by 2 or 3 by 3 and at most 3 cubes a cell: at most 4^9 stacks, so the solver is exact (no heuristic) and runs in the browser.
6. The stack drawing is isometric SVG with no WebGL (the brief for F4.3); only the viewer may load the 3D chunk (OD-35).
7. AR and camera for minors stay default-off; nothing in this pack reaches the Oracle context (the `.strict()` 14-field context is untouched).

## Status

Implemented (all three pieces): the pure engine and its tests, the three segment types with strict payloads, rubrics and age scope, the
three scorers with their ladders, six fixtures with ladders, the generated browser copies, the lazy boards with keyboard alternative,
table view and reduced motion, copy in three locales, the Forge guidance, gate 4 and solvability checkers, the audit manifest.

Checks run on the final tree (focused only): the backend solids tests, the coursegen solids tests, the frontend solids tests, the
generated-copy check, the capability parity check, one type-check each for backend, coursegen and frontend. Counts are in the hand-off.

NOT verified, NOT accepted, NOT released:

- No browser or visual audit was run (no Playwright, no dev server, by the lane rules): the boards have never been looked at in a real
  browser, and the 3D chunk has not been loaded in a real WebGL context. A person must look at the three boards at 360 px, 768 px and
  1280 px, in light and dark, with reduced motion on and off, before acceptance.
- The declared chunk budgets (16, 18, 14 KB) are declarations; no production build measured them.
- No text-fit, proportion or copy-budget audit was run on the new strings; copy parity across the three locales is pinned by a test only.
- Native-speaker review of es-MX and pt-BR is pending (copy is neutral and short; solid and face names follow school usage).
- Nothing is accepted against the SPEC and nothing is released. Requirement rows and `SPRINTS.md` are not touched by this lane.

## Known limits

- Four solids only; no truncated solids, no compound solids, no curved-surface area.
- The viewer chooses a solid and counts one kind on it; it does not ask for volume or area (space1 and space2 build on the engine for that).
- The surface-area line is a display. A graded surface-area answer needs a numeric segment around the net board and belongs to a later lane.
- Labels in the 3D chunk are HTML over the canvas computed with the same camera maths as the SVG; a label that would sit within 11 units of
  a visible one is dropped in both renderers, and the table view lists all of them.

## Owner follow-ups

1. Base-tip issue outside this lane: `frontend/src/rebuild/learning/horizonte/harness/fixtureCoverage.test.tsx` fails 3 of 4 tests at the
   `feat/horizonte-visual` tip (checked again after merging plane1). It treats every folder under `horizonte/` that has an `index.ts` as a
   pack, and `plano/` (the shared Plano primitive, F0.2, with its own `index.ts`) is not a pack: "plano: fixtures.ts registers plano", then
   `HORIZONTE_FIXTURES[pack]` is undefined for it in the other two tests. The owner of the harness should skip non-pack folders (for
   example by requiring a `contract` export or an `audit.json`) or register an empty list for `plano`. Not touched here: the file is shared
   and every lane sees the same failure. The solids pack is registered in `fixtures.ts`, has `audit.json` in step with its six fixtures,
   and the other 48 tests in the harness and solids folders pass.
2. Run the visual audit for the three boards and the 3D chunk (see NOT verified above), then measure the chunk budgets with a build.
3. Review the es-MX and pt-BR strings with a native reader.
4. After acceptance, update the sprint record and the requirement rows (not touched here).

## Fix round (unit fx-solids)

Branch `hz/fx-solids`, cut from `feat/horizonte-visual` after the first merge of this pack. This section supersedes the Status, Known
limits and fixture counts above where they disagree (the text above is the first round and is left as written). Two things were done:
F4.2 was completed, and the pack's frontend was fixed for dark mode.

### What changed

**Surface area is now a graded answer.** The learner computes it from the net. Core grades it with the same ladder as the other
numeric answers (`invalid`, `valid`, `review`, `met`; the key `{ target: "<n>" }` never rides in the public payload). Cube nets take
`mode: 'area'` (cells plus an edge; fixture `area-of-the-cube`, edge 3, key 54). The old worked line `6 x edge x edge = N` under the cube
net (`NetArea.tsx`) was deleted: it printed the graded answer. The area board draws the net with the lengths on its panels and
offers a table of panel, shape and lengths (never the area of a panel or the total); the answer is typed into one numeric field. A
fraction below 1 is `invalid`, and a value that is a sum of some of the face areas is reported as `miss` (a diagnostic for the
feedback, never shown as the answer).

**New segment type `geometry.solid-net.v2`** (scope ages 7 to 12, adult refused, ICAP Constructive; the fixtures put the pyramid
labelling in band 6-9 and the rest in band 10-12) for nets of a rectangular prism, a triangular prism and a square pyramid, in three modes next to the cube net:

| Mode | The learner | Answer and key shape |
|---|---|---|
| `label` | names the panels of a catalogue net | `{ slots: { panel0: [name], ... } }`; the key lists every panel |
| `complete` | hangs the missing faces on the given hinges so the net fits a sheet | `{ slots: { "bottom-front": ["front"], ... } }`; a slot is one hinge `"<faceA>-<faceB>"` (lower face index first) and the piece in it is the child face |
| `area` | computes the surface area from a net | `{ value }`, key `{ target }` |

The engine is `polynet.ts` (pure, no DOM, no randomness): a net is a spanning tree of hinges over the faces of a polyhedron, `unfold`
lays it flat and `convexOverlap` checks it. Catalogue nets: box `cross`, `column`, `strip`, `flag`; triangular prism `row`, `fan`,
`split`; pyramid `star`, `chain`, `pair`. Face order: box bottom, top, front, back, left, right; triangular prism bottom, back, slope,
left, right; pyramid bottom, back, right, front, left. Label mode needs exactly one labelling that keeps the given names. Complete
mode accepts every completion that fits the sheet (any spanning tree whose layout fits and does not overlap), not one fixed answer.
Authoring rules live in `rules.ts` (`readSolidNetPayload`, `solidNetProblem`); the scorer is `solidNetGrade` in `scorer.ts`.

**Tap and keyboard alternatives.** In label mode a name is dragged onto a panel, or tapped and then the panel tapped, or placed with
Move to; in complete mode a face is dragged, or tapped and then a hinge tapped, or placed with Move to. The whole answer can therefore
be made with no dragging and with the keyboard alone. The handles (64 px), the table toggle and the accessible names are held by
`assertBoardContract` in the board tests.

**Fold animation.** `FoldPlayer` folds the net into its solid. A button runs the fold as a 250 ms tween only under
`(prefers-reduced-motion: no-preference)`; with reduced motion, or with no `matchMedia`, it jumps to the end. A slider scrubs the fold in
steps (the keyboard path and the unhurried one), and a status line says flat, part way or closed. The fold is a preview and is never
graded. Every net board (cube net and solid net, in all modes) uses the same player.

**The 3D renderer import stays confined and lazy.** `SolidScene3D.tsx` is still the only importer of three.js in `horizonte/solids`, and
it is reached only through the lazy viewer board. The nets are SVG.

**Dark mode.** The pack's CSS and the 3D scene used the constant `--ink` (and a few literal colours) for text, lines and fills, so in
dark mode ink sat on a dark ground. They now use the theme-flipping `--content`, `--content-muted`, `--surface`, `--sunken` and
`--outline`. `darkMode.test.ts` scans every CSS and TSX file of the pack for `var(--ink)`, hex, rgb and similar colour functions, white,
black and `currentColor` fills, and checks that the 3D scene reads its palette from the themed host and follows a theme change.
`tokens.css` was not edited and no new token was needed.

**Forge.** Guidance for the cube net now covers the three modes (edge at least 2) and a new entry covers the solid net. Gate 4 checks
the solid-net payload and reports each finding. Two solvability checkers prove the question before it ships: the cube net (with the area
mode) and `geometry.solid-net.v2` (label: exactly one labelling; complete: the given hinges can be finished on the sheet, the sheet
rules at least one net out and no net is within 0.3 of a sheet side; area: the net exists and the area is a whole number up to the
limit; the key is judged against all of that). The Forge keeps pinned copies of the geometry (`solidsGeometry.ts`, `solidsPolynet.ts`,
`solidsNetRules.ts`); a test pins `solidsPolynet.ts` equal to the Core `polynet.ts` apart from its first two lines. Plans 77 (band
6-9: cube-net area, pyramid labelling) and 78 (band 10-12: box labelling, box completion, prism area) now exercise the new surface and
the emitted fixture was regenerated.

**Fixtures.** 16 now, up from 6: viewer 2 (`which-has-no-vertices`, `nine-edges`); cube nets 3 (`name-the-faces`, `finish-the-net`,
`area-of-the-cube`); solid nets 9 (`name-the-box`, `name-the-prism`, `name-the-pyramid`, `finish-the-box-net`, `finish-the-prism-net`,
`finish-the-pyramid-net`, `area-of-the-box`, `area-of-the-prism`, `area-of-the-pyramid`); stacks 2 (`staircase`, `two-by-two`). Each has a
ladder (`invalid`, `valid`, `met`) and an `audit.json` entry. Fixture prompts were shortened to meet the Copy Budget.

**Capabilities.** `geometry.cube-net.v2` and `geometry.solid-net.v2` both carry `operation.compute-area.v1`; the three services are in
parity (`check-v2-lesson-capability-parity.mjs`). The browser scorer copies were regenerated with `sync-v2-horizonte.mjs` and its
`--check` is clean.

### Still limited

- The net catalogue and the face order ship in the browser bundle (the boards need them to draw), so a label key or a completion is
  derivable by reading the code. The rubric itself never rides in the public payload and grading stays on the server. This is the same
  trade as the cube net had in the first round.
- Panel and hinge targets drawn inside the SVG can be under 64 px on a phone. The chips, the fold slider and Move to are the accessible
  path and they meet 64 px.
- The fold preview does not orient the solid to a reference pose: it shows the panels rising and closing, with the panel number on each.
  In complete mode the fold of a partial net is a partial fold. Fold tags show panel numbers while label-mode panels show the learner's
  names once named; the table maps number to name.
- Tri-prism labelling has exactly one answer per net, so the given names are only anchors, and its complete mode is a weak constraint:
  22 of 30 candidate nets fit the sheet (box 3 of 15, pyramid 4 of 8). Authors should read that ratio before shipping a prism sheet.
- Overlap never happens through valid paths for these solids. The `structure` diagnostic is reached by a loop of faces not connected to
  the root or by going off the sheet; the overlap check itself is tested directly on `convexOverlap`.
- The sheet comparison is float based with a tolerance of 1e-6. The fixture sheets keep a margin of at least 0.3 from every net extent
  (measured at least 0.88), and the Forge flags a sheet closer than that as `out-of-bounds`.
- `areaDiagnosis` calls any subset sum of the face areas `miss`, so a lucky near answer is not told apart from a partial sum.
- A face name drawn inside a panel falls back to its number when it does not fit. Cube edges of 1 make labels overlap, so Core still
  accepts an edge of 1 but the Forge guidance and gate require at least 2.
- Area boards have no `data-hz-text-equivalent` status line; the table toggle plus the table is the equivalent. A cube area row says
  "Square" for each cell.
- The disabled `Button` of the shared design layer fails contrast in every pack's audit (about 2.3 to 1 in light, 2.7 to 1 in dark).
  It is a shared token issue and was not touched here.

### Not verified

- Only a spot check in a headless browser (seven captures with `capture-learn-preview.mjs`: `name-the-box` at 375 px in light and dark,
  `finish-the-box-net` at 375 px light and 1280 px dark, `area-of-the-prism`, `name-the-pyramid` and `area-of-the-cube` at 375 px). It
  showed the panels, the fold preview, the chips and the buttons flipping with the theme, and it found one defect that is fixed: the
  page's inherited `letter-spacing` was read in net units and spread a face name across its panel, so it collided with the lengths
  (`.lf-poly-svg` now resets it). The fix was re-captured for `finish-the-box-net` and `name-the-pyramid` only. Tests run in jsdom, so
  64 px hit areas, text fit and contrast are unmeasured. The 768 px width, the reduced-motion states, the `finish-the-prism-net`,
  `finish-the-pyramid-net` and area-of-the-box boards in the browser, and the 3D viewer were not looked at. A person must look at all of
  them at 360 px, 768 px and 1280 px, in light and dark, with reduced motion on and off.
- The first-view word budget and the browser text-fit, proportion and Copy Budget audits were not run. Copy parity and the Copy Budget
  of the strings were checked by `check-horizonte-copy.mjs` only.
- Chunk sizes were measured once with `vite build` on the merged tree (own chunk, gzipped, as RECIPE.md defines the budget): solid net
  board 3.7 KB, cube net board 3.6 KB, viewer board 3.0 KB, stack board 2.6 KB. A net board also pulls the pack's shared chunks (the
  area and fold code 4.1 KB and the engine chunk 5.9 KB gzipped), about 13.7 KB for the solid net in all. `chunkBudgetKb` for the two net
  boards was lowered from the declared 26 and 30 to 12 (the recipe default); the viewer and the stack keep their first-round
  declarations. The three.js chunk (734 KB, 190 KB gzipped) loads only from the viewer board. Nothing enforces these budgets
  automatically; they were read from the build output by hand.
- Native-speaker review of the new es-MX and pt-BR strings (net, panel, hinge, fold, area) is pending.
- Nothing here is accepted against the SPEC or released. `COVERAGE.md`, the requirement rows and `SPRINTS.md` are not edited by this
  unit; the coverage snapshot was regenerated and its segment-type pin moved by one.
