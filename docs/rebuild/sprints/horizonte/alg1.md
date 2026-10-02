# Lane doc: alg1 (F2.1 algebra tiles, F2.2 algebra cards, F2.3 area model)

Three Horizonte Visual pieces for the early algebra sequence. Each is complete in all three layers (Core, browser, Forge).
Procedure: [RECIPE.md](./RECIPE.md). Shared answer shape: F0.3 `arrangement.slots`. Solvability: F0.4.

| Item | F2.1 algebra tiles | F2.2 algebra cards | F2.3 area model |
|---|---|---|---|
| Catalogue rows | D02, B27 | D06 | D09 (distribute), D10 (expand, factor), D11 (complete the square) |
| Segment type | `math.algebra-tiles.v2` | `math.algebra-cards.v2` | `math.area-model.v2` |
| Visuals | `algebra-tiles`, `signed-tiles` | `algebra-cards` | `area-distribute`, `area-binomial`, `area-square` |
| Ages | 11 to 15 | 10 to 14 | 13 to 17 |
| Adult pathway | refused | refused | refused |
| ICAP level | Constructive | Constructive | Constructive |
| Answer shape | `{ slots: { mat, zero } }` | `{ slots: { left, right, bin, tray } }` | `{ slots: { tray, cell-r-c \| row-n, col-n \| corner, constant } }` |
| Capabilities | `visual.algebra-tiles.v1`, `operation.drag-chips.v1`, `operation.pair-tiles.v1`, `visual.math-notation.v1` | `visual.algebra-cards.v1`, `operation.drag-chips.v1`, `operation.balance-cards.v1`, `visual.math-notation.v1` | `visual.area-model.v1`, `operation.drag-chips.v1`, `operation.fill-cells.v1`, `visual.math-notation.v1` |
| Chunk budget | 30 KB gzipped declared | 30 KB gzipped declared | 30 KB gzipped declared |
| Rendering | in-house SVG, no third-party code | in-house SVG, no third-party code | in-house SVG, no third-party code |

## Segment types added

`math.algebra-tiles.v2`, `math.algebra-cards.v2`, `math.area-model.v2`, registered through the three `alg1` pack stubs
(backend `horizonte/alg1/index.ts`, frontend `horizonte/alg1/index.ts` with `boards.tsx`, Forge `v2/horizonte/alg1.ts`). The
capability literals are identical in the three services and `check-v2-lesson-capability-parity.mjs` passes.

## Behaviour

- **Tiles (F2.1).** The public payload is the six tile counts `{ counts: { sq-pos, sq-neg, bar-pos, bar-neg, unit-pos, unit-neg } }`,
  never the zero pairs. The learner moves a tile group between the Mat and the Zero set; a zero pair is one positive and one negative
  tile of the same kind, so tiles go to the zero set in pairs and come back in pairs. The answer is unique: every zero pair in the zero
  set, the rest on the mat. A negative tile is drawn with a dashed outline and a drawn minus, so sign is never colour alone. With no
  opposite left, a chip stays enabled and a "no pair" note appears, so a disabled chip never reveals the answer.
- **Cards (F2.2).** An equation as cards (`x + 3 = 7`) plus supply cards. Only additive moves exist: a supply card is added to both
  sides at once, and a card and its opposite on one side cancel into the Bin. The goal is the unknown alone on one side with every
  other card reduced. The disguise fades `picture` (boxes and counters, no notation), `mixed`, `notation` (real notation, no picture).
  The key lists each reachable isolation as `{ left, right }`, so a mirror image is accepted only where that isolation exists.
- **Area model (F2.3).** The edges carry factors and the cells the partial products, so a(b+c), (x+a)(x+b), factoring and completing
  the square are one picture. A face is `degree:coefficient` (`1:3` is 3x). `cells` places the products, `edges` places the factors of
  four given products, `square` places the corner and the constant of x^2+bx+c. Pieces swap on a cell, and a wrong piece can be replaced.
- **Equivalents.** Every board has a live status line, a "Show as table" toggle, and a keyboard path for every drag: pick a chip, then
  choose its place in the "Move to" menu. Handles and chips are 64 px. Authored `notation` renders through `MathExpression` with its
  authored `spokenText`; derived math is never rendered.
- **Grading.** Core holds the private rubric; the payload never carries it. The browser sends `{ slots }` and shows what Core returns.

## Scorer ladder

| Verdict | When |
|---|---|
| `invalid` | malformed response, an unknown or repeated piece, a state the board rules out (tiles: zero set not balanced per kind; cards: a state that breaks the equation or a Bin that does not cancel; area: more than one piece in a cell or edge), or a malformed or unreachable rubric |
| `valid` | the untouched start (and, without a rubric as in the browser, any well-formed response) |
| `review` | changed and legal but not a key solution; diagnostic by class |
| `met` | a key solution, compared by class (pieces of one class are interchangeable); score 100 |

The browser has no rubric, so its generated scorer says only `valid` or `invalid` and never `met`. Working-space slots (`tray`, `bin`)
are excluded from the comparison.

## Files

Backend `backend/src/services/horizonte/alg1/`: `arrange.ts` (shared placement grading), `tiles.ts`, `cards.ts`, `area.ts`,
`contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test `backend/src/__tests__/horizonte/alg1.test.ts` (22 tests).

Browser `frontend/src/rebuild/learning/horizonte/alg1/`: generated `arrange|tiles|cards|area|contract|scorer|fixtures.generated.ts`,
`capabilities.ts`, `copy.ts`, `shared.tsx`, `boards.tsx`, `TilesBoard.tsx`, `CardsBoard.tsx`, `AreaBoard.tsx`, `AlgebraBoards.css`,
`audit.json`, `Alg1Boards.test.tsx` (23 tests, runs `assertBoardContract` for all nine fixtures).

Forge `coursegen/src/v2/horizonte/alg1.ts` (capabilities, authoring guidance, gate 4, three registered solvability checkers); test
`coursegen/src/__tests__/horizonte/alg1.test.ts` (12 tests). The checkers register through `coursegen/src/v2/solvabilityPacks.ts`.

Fixtures (nine): `signed-zero-pairs`, `simplify-tiles`, `box-picture`, `box-mixed`, `box-notation`, `distribute`, `expand`, `factor`,
`complete-square`. Preview: `?screen=fixture&seg=hz:alg1:<fixture id>&age=<band>`, for example
`?screen=fixture&seg=hz:alg1:box-picture&age=10-12`.

## Forge

- **Guidance.** Three lines per type, appended to the author prompt only when a skeleton uses the type.
- **Gate 4 (`gates`).** Each payload is re-read independently of Core (Forge cannot import backend code): shape and bounds; the visual
  matches the payload (`signed-tiles` only for 1 tiles, `area-distribute` for one row, `area-binomial` for two rows or edges,
  `area-square` for square); `notation.tex`, after whitespace removal, equals the board written as an expression; cards need a
  notation unless the disguise is `picture`; across one document the card disguise never moves back (picture, mixed, notation).
- **Solvability checkers (F0.4).** Tiles: at least one zero pair and the one reduced answer. Cards: every subset of the supply cards
  is tried, giving one to eight distinct isolations, none of them the start. Area: the derived placements (a fixed set for `cells`
  and `square`, a bounded `searchAssignments` over the pool for `edges`), one to eight, and the pool must hold every needed piece.
  With a private key, the key is compared with the derived set both ways (`rubric-gap`, `rubric-accepts-invalid`). The key is judged
  only by the checkers, not repeated in `gates`, because both run in the same gate 4.

## Decisions

- **Class ids, not piece ids, in the key.** The key is one to eight slot maps of class ids (F0.3), so interchangeable pieces need no
  ordering. Class ids satisfy `^[a-z0-9][a-z0-9._:-]{2,100}$` (for example `unit-pos`, `pos-3`, `1:3`).
- **Cards are not merged.** Each card is one signed integer 1 to 9 and only an exact opposite cancels, so `+3` and `-5` never combine.
  Key right sides such as `neg-3, pos-7` stay separate, and a mirror image is accepted only where the isolation exists as written.
- **Tile chips stay enabled without an opposite.** A disabled chip would reveal the answer; a `noPair` note is shown instead.
- **Nested drop targets.** The cards equation wrapper is the only drop target for supply cards; tap-to-cancel is handled in the chip
  wrapper so a drop never fires twice.
- **Disguise fade is a lesson-level rule.** Core grades each cards segment alone; the order picture, mixed, notation is a Forge gate.
- **Copy.** Non-data entries sit in the 10 to 12 Copy Budget band. es-MX and pt-BR are written natively, not translated from English.
- **Colour and motion.** Tokens only; the board is neutral. Positive tiles use `--sky-strong`, negative tiles a dashed `--ink` stroke
  plus a drawn minus. The only motion is an outline-colour transition under `prefers-reduced-motion: no-preference`.

## Limits

- Tiles: at most 12 per class and 24 in total; six classes only (no x^2 y or other symbols).
- Cards: at most 4 cards a side, 6 supply cards, numbers 1 to 9, additive moves only (no multiplication or division, no merging).
- Area: coefficients up to 99, degree up to 2; `cells` has one or two rows and two or three columns (two rows only with two columns);
  `edges` has four product faces and a pool of 4 to 10; `square` has an even b from 2 to 18, c from -30 to 30, c not equal to (b/2)^2,
  and a pool of 2 to 8 numbers; at most 8 right answers per board.
- Ages are fixed per piece (see the table); AR and camera stay default-off for minors; Oracle's strict 14-field context is untouched.

## Implemented, not verified, not accepted, not released

- **Implemented.** The three pieces across Core, browser and Forge as above.
- **Verified locally (focused only).** Backend `alg1.test.ts`, frontend `Alg1Boards.test.tsx`, Forge `alg1.test.ts` and
  `v2Solvability.test.ts`; `sync-v2-horizonte.mjs --check`; `check-v2-lesson-capability-parity.mjs`; one `type-check` per touched service.
- **Not verified.** No real-browser run: 64 px hit size, drag on touch, text fit, reduced motion and the lazy chunk size (declared 30 KB
  each) are not measured, because jsdom cannot measure layout. No screen-reader pass of the `spokenText` or the table equivalents. No
  `test:all`, `tools:test`, `verify:*`, `audit:*` or `spec:check` run (the coordinator owns the push gate).
- **Not accepted.** No owner or teacher review of the pedagogy (disguise ladder, wording, the examples), and no native-speaker review of
  es-MX and pt-BR.
- **Not released.** Nothing is pushed or deployed; no requirement row or sprint record was edited.

## Owner follow-ups

- Review the pedagogy and the three-language copy with a native speaker per locale before acceptance.
- Run the real-browser audit of the nine fixtures (hit size, text fit, proportion, Copy Budget) and measure the three chunks against 30 KB.
- Decide whether cards should ever merge numbers (for example `+3` and `-5` into `-2`); today they never do.
- Decide whether the card disguise should be graded across a lesson in Core, not only gated in the Forge.
- Update `docs/rebuild/SPRINTS.md` and `REQUIREMENTS.md` once, at the push gate.

## Observation at the time of writing

`harness/fixtureCoverage.test.tsx` and `check-horizonte-copy.mjs` fail on the `plano` pack, whose copy and fixtures were not yet
registered in the shared base when this lane started. The alg1 audit file and fixtures are consistent with the coverage test.
