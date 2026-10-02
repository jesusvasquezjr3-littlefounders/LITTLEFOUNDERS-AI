# Lane doc: space2 (F4.7 surfaces, F4.8 globe with routes, F4.9 AR "see it on your table" pilot)

The second space pack of the Horizonte Visual. It builds on the solids engine (F4.1): the surface is drawn and turned with the solids
projection and its twelve fixed views, so there is no second 3D engine. Procedure: [RECIPE.md](./RECIPE.md). Engine API:
[solids.md](./solids.md).

| Item | F4.7 surface | F4.8 globe | F4.9 AR table pilot |
|---|---|---|---|
| Segment type | `math.surface.v2` | `geography.globe-route.v2` | `space.ar-table.v2` |
| Catalogue rows | [3:9], [3:10], [m:D44], [m:G19], [m:G20] | [3:12] | [3:24] |
| Ages | 15 to 17 | 12 to 17 | 13 to 17 |
| Adult pathway | allowed | allowed | allowed |
| ICAP level | Active | Active | Active |
| Answer shape | choice | choice | none (not scored) |
| Rendering | lazy SVG board on the solids projection, 2D slice under a slider | lazy SVG board, d3-geo orthographic globe, land loaded lazily | lazy board, turnable SVG wireframe always shown, WebXR only behind the gate |
| Declared chunk budget (gzip) | 18 KB | 40 KB | 14 KB (the WebXR session module is a second lazy chunk) |

The AR pilot is ungraded ("Sin calificacion"): it has no rubric, no scorer and no key, and Core keys and grades only
`grading: 'server'` segments, so it can never gate progress.

## READ THIS FIRST: the AR pilot must not be turned on before legal and pediatric review

F4.9 touches a camera and the audience includes minors (ages 13 to 17). It ships closed and stays closed until the owner has had a
**legal review and a pediatric review** of the pilot, and until verified guardian consent is wired in (see Owner follow-ups). Nothing
in this lane enables it. The gate (`arPilotGate` in `backend/src/services/horizonte/space2/ar.ts`, copied to the browser as
`ar.generated.ts`) is closed by default on every count:

| Condition | Result when missing |
|---|---|
| The feature flag is on (`VITE_HORIZONTE_AR_PILOT === 'true'` at build time; unset means off) | `off` |
| The learner is a whole-number age of at least 13 (`AR_PILOT_MIN_AGE`) | `age` |
| The learner's own consent is recorded | `consent` |
| For a learner under 18 (`AR_ADULT_AGE`), a guardian's consent is recorded too | `guardian` |

`isArPilotEnabled(input)` is `arPilotGate(input) === 'open'`. Called with nothing it is false. The first closed reason wins, so a
missing flag reveals nothing about the learner. A test proves each branch: default off, flag alone is not enough, age 12 is closed with
everything else on, learner consent alone is closed for a 13 year old, an adult needs no guardian, and a non-integer or missing age is
closed (`space2.test.ts` in the backend and `space2.test.tsx` in the browser).

Safeguards built into the board (`ArTableBoard.tsx`, `ar/arPilot.ts`, `ar/arSession.ts`). The two files under `space2/ar/` are the
only ones in the pack allowed to import the 3D renderer (OD-32 names `horizonte/space2/ar/` in `SOLIDS_BRIDGE_PREFIXES`), and a test pins
that no other file in the pack imports `three`:

- Default environment: flag from the build variable, consent `null`, age `null`. **Nothing records consent yet**, so a production build
  cannot open the gate even with the flag on. Consent and the learner's age are injected through `ArPilotContext`
  (`ArPilotEnvironment.consent` and `.age`). When no age is supplied the board gates on the lesson's age floor
  (`eligibility.minimum_age`, 13 or more for this step), which is never above the learner's real age: that can only keep the gate closed
  (a minor needs guardian consent, so an adult with only their own consent stays closed until the app supplies the age).
- The browser's camera permission is asked only after an explicit in-app consent panel ("See on table", then a panel with "Allow camera"
  and a decline). Before that no `navigator.xr.requestSession` call is made; a test fails the board if `start` or `requestSession` runs
  before the learner allows it.
- Support is probed with `isSessionSupported('immersive-ar')`, which never opens the camera and never prompts, and only when the gate is open.
- No camera frame is stored or transmitted. The session asks for `immersive-ar` with the required feature `hit-test` and the optional
  `local-floor`, and for nothing that exposes pixels (no `camera-access` feature, no raw camera buffer). The browser draws the device's view
  itself; the pilot draws only the object and a reticle over it. A source scan test forbids `camera-access`, `getUserMedia`, `fetch`,
  `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB` and canvas read-back (`toDataURL`, `toBlob`,
  `getImageData`, `readPixels`) in `ArTableBoard.tsx`, `ar/arPilot.ts`, `ar/arSession.ts` and `ar.generated.ts`.
- No third-party AR SDK: native WebXR where the device has it (`navigator.xr`), otherwise the non-AR fallback. The only dependency
  used is `three`, already in the app for the Mentor stage and the solids viewer.
- The fallback is always on screen and is the full feature: a turnable wireframe drawn on the solids projection (arrow keys or four
  buttons, one fixed view at a time) and a size table in whole centimetres and millilitres (a real table, the show-as-table control).
  Where the gate is closed, or the device has no AR, the learner sees the fallback and nothing else; the "See on table" button does not
  appear.
- Leaving AR (the browser's own control, the learner's end, or unmounting the board) ends the session, stops the animation loop and
  releases every GPU resource.
- Nothing from this pack reaches the Oracle context: the `.strict()` 14-field context is untouched.

## Segment contracts

Capability literals (identical in `space2/capabilities.ts` on the backend and the browser and in `coursegen/src/v2/horizonte/space2.ts`;
`node agent/tools/check-v2-lesson-capability-parity.mjs` pins them):

| Segment type | Capabilities |
|---|---|
| `math.surface.v2` | `visual.surface.v1`, `operation.read-surface.v1`, `operation.slice-surface.v1` |
| `geography.globe-route.v2` | `visual.globe-route.v1`, `operation.rotate-globe.v1`, `operation.compare-routes.v1` |
| `space.ar-table.v2` | `visual.ar-table.v1`, `operation.view-object.v1`, `operation.optional-ar.v1` |

Visual descriptors: `{ type: 'surface' | 'globe-route' | 'ar-table' }`. Payloads are strict (`contract.ts`); every payload is also read by
a pure reader (`surface.ts`, `globe.ts`, `ar.ts`) and checked by a rule, so a question that has no single answer is refused at authoring time.

### F4.7 `math.surface.v2` (a third real variable)

- Payload: `{ surface, ask, options }`.
  - `surface` is `{ kind: 'compound', principalCents, ratesBps[3..6], terms[3..7] }` (rate by term gives an amount) or
    `{ kind: 'profit', unitCostCents, fixedCents, prices[3..6], units[3..7] }` (price by quantity gives a profit). Axis lists rise strictly.
  - `ask` is `{ kind: 'highest' }`, `{ kind: 'lowest' }` or `{ kind: 'reach', targetCents }`.
  - `options` are 2 to 4 grid cells `{ id: a..d in order, x, y }`, all different.
- Money is whole cents with integers only. One year of interest is `floor((amount x (10000 + bps) x 2 + 10000) / 20000)` (rounded half up), applied
  once per year, so Core and the browser agree to the cent. Profit is `units x (price - unitCost) - fixed`.
- Authoring rules (`surfaceProblem`): the surface is not flat (a one-dollar principal at 0 to 2 basis points is flat and is refused), and
  exactly one option is the highest, the lowest, or the only one that reaches the target.
- Response `{ choice }`, rubric `{ choice: 'a'..'d' }` (strict). Ladder: `invalid` (malformed, or an id that is not an option), `valid`
  (blank, or any well-formed answer without a rubric), `met` (the right option), `review` (a wrong option).
- Board: the grid is drawn as a mesh on the solids projection (`projectPoint`), turned through the twelve fixed views by arrow keys or four
  buttons. A slice slider (a range input, plus step buttons) holds one input still and draws the 2D curve of the other, which is what makes
  the surface legible. "Hold" chips choose which input stays still. Each option is a chip that marks its cell on the mesh and the slice.
  The table view lists every grid value in the learner's money format.

### F4.8 `geography.globe-route.v2`

- Payload: `{ routes, ask, sendCents }`. `routes` are 2 to 4 `{ id: a..d in order, from, to, feeBps, flatCents }` between places of a fixed
  gazetteer of 16 (`PLACES`: Mexico City, Los Angeles, Houston, New York, Bogota, Sao Paulo, Lisbon, Madrid, Lagos, Nairobi,
  Johannesburg, Dubai, Mumbai, Manila, Tokyo, Sydney). `ask` is `shortest`, `longest` or `cheapest`. `sendCents` is 1000 to 500000.
- Distance is the haversine on a sphere of radius 6371 km, rounded to whole kilometres. Fee is `floor((send x bps x 2 + 10000) / 20000) + flat`
  in whole cents.
- Authoring rules (`globeProblem`): each route joins two different places, each corridor appears once, and exactly one route wins. A
  distance question must be won by at least 2 percent over the runner-up (`distanceMarginPermille: 20`), so a rounding or engine difference
  can never change the answer; a cheapest question needs a unique least fee.
- Response `{ choice }`, rubric `{ choice: 'a'..'d' }`. Ladder as F4.7.
- Board: d3-geo orthographic projection with `clipAngle(90)`, the land from the Natural Earth 110 m topology, a graticule, each route as
  a great-circle arc, and the places and route tags on the near side only. Arrow keys turn the globe (30 degrees round, 20 degrees up or
  down, clamped at 80 degrees so the poles stay readable); four buttons do the same. A route chip selects that route and turns the globe
  to its great-circle midpoint. The table view lists each route with distance in km and fee in money.
- Assumption: the table and the route chips show the numbers the question needs (a cheapest question cannot be answered without the fee
  terms), as the solids facts table does; the learner still has to compute and compare.

### F4.9 `space.ar-table.v2`

- Payload `{ object }` with `object` one of `litre-box` (10 x 10 x 10 cm), `cereal-box` (20 x 30 x 7), `soup-can` (7 x 10 x 7, a cylinder) or
  `shoebox` (31 x 12 x 19). The step has no key and no answer ladder; the fixture's rubric is empty on purpose. Age scope 13 to 17 plus adult.

## Pieces and fixtures

| Fixture | Piece | Ages (lesson, eligibility) | Key |
|---|---|---|---|
| `time-beats-rate` | F4.7 compound interest, 2 to 8 percent over 5 to 20 years, "which ends with the most" | 13-17, 15 to 17 | `c` |
| `price-and-units` | F4.7 profit, "at least $100" (a reach question) | 13-17, 15 to 17 | `d` |
| `nearest-route` | F4.8 shortest of four routes from Mexico City | 10-12, 12 | `b` |
| `cheapest-corridor` | F4.8 least fee sending $200 from Los Angeles (the shortest route is not the cheapest) | 13-17, 13 to 17 | `b` |
| `object-on-the-table` | F4.9 a one litre box at true size | 13-17, 13 to 17 | none |

## Files per layer

| Layer | Path | Content |
|---|---|---|
| Backend | `backend/src/services/horizonte/space2/` | `surface`, `globe`, `ar` (pure models and the pilot gate), `scorer`, `contract` (segments, rubrics, age scope), `fixtures` (5), `capabilities`, `index` |
| Backend tests | `backend/src/__tests__/horizonte/space2.test.ts` | models, scorer ladders, contract refusals, fixture ladders, age scope, the AR gate |
| Browser | `frontend/src/rebuild/learning/horizonte/space2/` | generated copies (`surface`, `globe`, `ar`, `scorer`, `contract`, `fixtures`), `capabilities.ts`, `boards.tsx`, `SurfaceBoard`, `GlobeBoard`, `ArTableBoard`, `TurnStage`, `ar/arPilot`, `ar/arSession`, `landLoader`, `geoModules.d.ts`, `copy.ts`, `spaceText.ts`, `space2.css`, `audit.json`, tests |
| Browser tests | `space2.test.tsx` (38), `landLoader.test.ts` (1, real coastlines) | the contract harness for all five fixtures, copy in three locales, every keyboard path, the AR gate and flow with an injected environment, the forbidden-API source scan |
| Forge | `coursegen/src/v2/horizonte/space2.ts`, `space2Geometry.ts`, `coursegen/src/__tests__/horizonte/space2.test.ts` | guidance, gate 4, two solvability checkers, the Forge's own pure model copy |
| Shared (one line) | `coursegen/src/v2/solvabilityPacks.ts` | `import './horizonte/space2.js';` so the checkers register |

Never hand-edit a `*.generated.ts`: change the backend file and run `node agent/tools/sync-v2-horizonte.mjs`.

### Board behaviour (all three)

- Lazy boards: `boards.tsx` registers one lazy entry per type with ICAP `active`. The globe's land is a second lazy import, so a globe
  with no coastlines yet is still a working sphere with its places and routes.
- Keyboard alternative on every interaction: arrow keys on the focused stage and four buttons for each turn, a slider with step buttons
  for the slice, chips for every choice. Handles and chips are 64 px (`--hz-hit`). Show-as-table is a real table with the same numbers as
  the drawing. No `draggable="true"` anywhere.
- Reduced motion: every view change is a cut; the only transitions are colour fades inside `prefers-reduced-motion: no-preference`.
- Tokens only (`space2.css`), a neutral board, no celebration; copy in en-US, es-MX and pt-BR with `data-copy-role` on every string
  (`copy.ts`, `spaceText.ts`). The prompts are at most 24 words.

## Forge pack

- Guidance: three line-sets (one per type): ages and eligibility floors, the payload shapes, the one-answer rules, the key shape
  `{ choice }`, and for the AR step "not scored, no key, never mention the camera".
- Gate 4: the visual descriptor, the grading (`server` for the two graded types, `none` for the AR step), the age band, the prompt length,
  a well-formed payload, and the one-answer rules (flat surface, tie, no option reaching the target, a route to itself, a repeated corridor,
  a distance winner inside the 2 percent margin, an unknown place or object).
- Solvability checkers (`registerSolvabilityChecker`): surface and globe. A tie or a margin miss is `ambiguous-solution`, an unreachable
  target is `no-solution`, a flat surface or a route to itself is `impossible-state`, a repeated corridor is `duplicate-id`, and the key
  `{ choice }` is compared to the derived answer (a wrong key is `rubric-gap` plus `rubric-accepts-invalid`). The AR step has no checker
  because it has no key.
- The Forge keeps its own model copy because it cannot import across services; a test pins the rounding, the grid values, the gazetteer
  distances and the fees to the backend's numbers.

## Dependencies and assets

- `d3-geo`, `topojson-client`, `topojson-server` and `topojson-simplify` are in `frontend` `dependencies` (the dev-to-prod move was
  done by the solids lane). `world-atlas` stays a devDependency: the land topology is imported as a bundled JSON module
  (`world-atlas/land-110m.json`, 55 KB raw) that Vite splits into its own lazy chunk at build time.
- **No asset-manifest row.** No public data file was added: the topology is part of the build, not a fetched asset, so nothing is registered
  in `frontend/src/rebuild/assets/manifest.json`. If a later change serves the topology from `public/`, register it then.
- No ambient `@types` packages: the d3-geo and topojson-client surface the board uses is declared in `geoModules.d.ts`.

## Decisions made without asking (assumptions)

1. The surface is a mesh on the solids projection, not a second 3D engine: the twelve fixed views are keyboard-operable, stable under
   reduced motion and need no WebGL. The 2D slice under a slider is part of the board, not an extra, because a mesh alone is hard to read.
2. Surface ages are 15 and up: compound interest across rates and terms is the first place a learner reads two inputs at once. The
   Forge holds the band alone, so a 13-17 lesson of it must carry an eligibility of 15.
3. All money is integer cents; a year of interest is rounded half up each year (the way a statement does), not once at the end.
4. Globe distance questions need a 2 percent margin; fee questions need a unique least fee. Both are authoring rules, enforced in Core,
   the Forge gate and the solvability checker.
5. The gazetteer is fixed (16 places) so the board, Core and the Forge name a place only by an id they all know; there is no free text place.
6. The AR pilot is closed in every build until consent is wired and the reviews are done; the fallback is always shown so the lesson never
   depends on AR. Nothing in the pilot reaches the Oracle context.
7. The tables reveal the answers a question rests on (as the solids facts table does). The learner still compares and chooses.

## Status

Implemented (all three pieces): the pure models and their tests, the three segment types with strict payloads, rubrics and age scope, the
two scorers, five fixtures with ladders, the generated browser copies, the three lazy boards with keyboard alternative, table view and
reduced motion, copy in three locales, the AR gate with its default-off and age and consent tests, the Forge guidance, gate 4 and
solvability checkers, the audit manifest.

Checks run on the final tree (focused only): the backend space2 tests, the coursegen horizonte tests, the frontend horizonte tests, the
generated-copy check, the capability parity and Horizonte copy checks, one type-check each for backend, coursegen and frontend.

NOT verified, NOT accepted, NOT released:

- No browser or visual audit was run (no Playwright, no dev server, by the lane rules): the boards have never been looked at in a real
  browser. A person must look at the three boards at 360 px, 768 px and 1280 px, in light and dark, with reduced motion on and off, before
  acceptance. The globe in particular (land, arcs, near-side labels) was only checked in jsdom.
- `ar/arSession.ts` (the real WebXR session with three.js) is type-checked and source-scanned but **never run**: jsdom has no WebGL and no
  `navigator.xr`. It needs a test on a real AR-capable phone (hit-test, placement, leaving AR, resource release) before the pilot is
  considered at all.
- The declared chunk budgets (18, 40, 14 KB) are declarations; no production build measured them.
- No text-fit, proportion or copy-budget audit was run on the new strings; copy parity across the three locales is pinned by a test only.
- Native-speaker review of es-MX and pt-BR is pending (place names follow common usage in each locale).
- Nothing is accepted against the SPEC and nothing is released. Requirement rows and `SPRINTS.md` are not touched by this lane.

## Known limits

- One gazetteer of 16 places and a catalogue of four objects; no free text place, no custom object, no measured AR size.
- Surfaces have two inputs and one output on a grid of at most 6 by 7; no free-form function and no third axis control.
- The globe is a fixed 110 m coastline; no borders, no labels for countries, no night side.
- The AR pilot places one object on one horizontal surface; there is no multi-object scene, no anchors that persist, and no recording of any kind.

## Owner follow-ups

1. **Legal and pediatric review of the AR pilot, before the flag is ever turned on.** This covers the camera use, the audience of 13 to 17
   year olds, the consent wording, and where a session may run (home only, not school). Do not set `VITE_HORIZONTE_AR_PILOT=true` in any
   deployed environment until this is signed off.
2. Wire verified-guardian consent into `ArPilotEnvironment.consent` (provide it through `ArPilotContext` from the family and consent
   records). Until then the gate cannot open. Decide where consent is recorded and how it is withdrawn; this pack records nothing.
3. Test `ar/arSession.ts` on a real AR-capable phone with a browser that implements `immersive-ar` (browsers without `navigator.xr` get the
   fallback, by design), including ending the session and checking that the camera indicator goes off.
4. Run the visual audit for the three boards (see NOT verified above), then measure the chunk budgets with a build.
5. Review the es-MX and pt-BR strings with a native reader.
6. Base-tip issue outside this lane, still open: `frontend/src/rebuild/learning/horizonte/harness/fixtureCoverage.test.tsx` fails 3 of its
   4 tests at the `feat/horizonte-visual` tip because it treats the `plano/` folder (the shared Plano primitive, not a pack) as a pack.
   The space2 pack is registered in `fixtures.ts`, has an `audit.json` in step with its five fixtures, and passes every check the
   harness runs for it. See the solids lane doc, owner follow-up 1.
7. After acceptance, update the sprint record and the requirement rows (not touched here).
