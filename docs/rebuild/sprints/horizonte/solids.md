# Lane doc: solids (F4.1 solid viewer, F4.2 cube nets, F4.3 stacked cubes)

The geometry pack of the Horizonte Visual. It owns the only 3D board in the programme (the lazy solid viewer, allowed by OD-32)
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

## OD-32 notes (the one lazy 3D board)

- The 3D code (three.js through React Three Fiber) sits in one lazy chunk, `SolidScene3D`, imported only by `SolidViewer` and only
  when `renderMode` resolves to `webgl`. The board entry that lessons register stays under the 60 KB gzip board budget; the three.js
  chunk is shared with the Mentor stage dependency graph and is documented, not counted, in the board budget.
- Only `solids/**` imports the 3D renderer. No other lane may import `SceneCanvas` or `three`.
- The SVG fallback is the full feature set, not a degraded one: labels, views, table. It is what runs in tests and on low-power
  devices, and the WebGL path adds only shading and depth.
- No decoration: a neutral board, flat tokens, no celebration. The solid is drawn in a single hue per face shade from the tokens.

## Segment contracts

Filled in per piece below as each lands. Capability literals live in each pack's `capabilities.ts` and in
`coursegen/src/v2/horizonte/solids.ts`, in parity.

## Status

Engine API committed (this document). Boards, scorers, fixtures, copy and Forge checks follow in the same lane.
