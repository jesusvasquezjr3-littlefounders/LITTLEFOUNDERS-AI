# Lane doc: golden (F1.1, ten frame and double ten frame)

The exemplary vertical slice of the Horizonte Visual. It is complete in all three layers so every other lane can copy it.
Procedure: [RECIPE.md](./RECIPE.md).

| Item | Value |
|---|---|
| Catalogue rows | A03 (ten frame), A04 (double ten frame), `cat-math.md` |
| Segment type | `math.ten-frame.v2` |
| Visuals | `ten-frame` (one frame), `double-ten-frame` (two frames) |
| Ages | 6 to 9 only (`{ ages: [6, 9], adult: false }`); any other band or the adult pathway is refused by Core and by the browser |
| ICAP level | Active |
| Answer shape | integer on a grid: `{ counts: number[] }`, one whole count (0 to 10) per frame |
| Rendering | in-house SVG; drag chips plus tap cells; no third-party code |
| Capabilities | `visual.ten-frame.v1`, `operation.drag-chips.v1`, `operation.tap-cells.v1` |
| Chunk budget | 12 KB gzipped declared for `TenFrameBoard` |

## Behaviour

- **One frame (A03).** The public payload is `{ start: [6] }`. The learner adds counters toward a goal expressed as a frame state
  ("make ten"). Tap an empty cell to add a counter, tap the last counter they added to take it back, drag or tap a tray chip
  onto the frame, or pick a chip and choose Frame 1 in the "Move to" menu (the keyboard path). The start counters cannot be removed.
- **Two frames (A04).** The payload is `{ start: [8, 5] }`. Counters move between the frames and the total never changes; a frame
  holds at most 10. Tapping a cell moves one counter from or to the other frame; the chips are "Move one from frame N".
- **Equivalent.** A live line states the total and the empty cells, and "Show as table" opens a table of filled and empty cells per frame.
- **Grading.** Core holds `{ target: number[] }`; the payload never carries it. The browser sends `{ counts }` and shows what Core returns.

## Scorer ladder

| Verdict | When |
|---|---|
| `invalid` | malformed response, extra fields, a count outside 0 to 10, wrong number of frames, a move that breaks the rule (one frame: fewer counters than the start; two frames: a different total), or a malformed or unreachable rubric |
| `valid` | the untouched start (and, without a rubric as in the browser, any well-formed response) |
| `review` | changed and rule-respecting but not the target; diagnostic `value` |
| `met` | equals the target; score 100, diagnostic `none` |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/golden/`: `model.ts`, `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`.
Harness: `backend/src/services/horizonte/harness/scorerContract.ts`. Tests: `backend/src/__tests__/horizonte/golden.test.ts`,
`scorerContract.test.ts`.

Browser `frontend/src/rebuild/learning/horizonte/golden/`: generated `contract|model|scorer|fixtures.generated.ts`, `capabilities.ts`,
`copy.ts`, `boards.tsx`, `TenFrameBoard.tsx`, `TenFrameBoard.css`, `audit.json`, `TenFrameBoard.test.tsx`. Harness:
`horizonte/harness/boardContract.tsx`, tests `boardContract.test.tsx` and `fixtureCoverage.test.tsx`.

Forge `coursegen/src/v2/horizonte/golden.ts` (capabilities, authoring guidance, gate-4 `goldenGates`); test
`coursegen/src/__tests__/horizonte/golden.test.ts`.

Fixtures: `make-ten` (start 6, target 10, one frame) and `fill-first` (start 8 and 5, target 10 and 3, two frames).
Preview: `?screen=fixture&seg=hz:golden:make-ten&age=6-9`.

## Decisions

- **Tray chips and handles.** `ChoiceChip` passes no data attributes through, so every chip is wrapped in `span.lf-hz-handle` with
  `data-hz-handle` and `data-hz-hit="64"`; the shared CSS gives the wrapper and its button a 64 px minimum. The harness checks both.
- **Cell tap with a carried chip.** A cell click is ignored while a chip is carried so the frame's drop-target handler places it once.
- **Total grid, not trusted input.** The model predicates are total; the scorer re-checks the start from the public payload and never
  assumes the rubric is well formed. An unreachable target is a malformed key and scores `invalid`, never `met`.
- **Gate 4 in the Forge.** A key must have one whole count per frame, differ from the start, not fall below the start on one frame
  and keep the total on two; the visual must match the number of frames. The check sits in the pack, so `solvability.ts` is untouched.
- **Copy.** Strings are `data`, `heading`, `action`, `option` and `body` entries within the 6 to 9 Copy Budget; es-MX and pt-BR are
  native text, not copies of the English.
- **Colour.** Frame 1 counters use `--sky-strong`, frame 2 `--mint-strong`; a counter the learner added carries an extra ring and the
  state is also stated in text, so it is never colour alone.
- **Motion.** A single 250 ms background-colour hover transition under `prefers-reduced-motion: no-preference`; none otherwise.

## Known issues

- Hit size is declared and enforced in CSS but jsdom cannot measure layout; a real-browser check of the 64 px handles belongs to the
  coordinator's audit pass.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.

## Solvability round

The F0.4 solvability checker for the ten frame is registered in `coursegen/src/v2/horizonte/solvability-num.ts` (shared with the num-a and
num-b pieces) and imported from `coursegen/src/v2/solvabilityPacks.ts`. It reads the public payload alone for everything the payload fixes and
compares with the private key only when `context.answerKey` is present. It reuses the pack by import: `golden.ts` now exports `frameCounts`
and `total` (export-only; `goldenGates` accepts and refuses exactly what it did). Tests:
`coursegen/src/__tests__/horizonte/solvability-num.test.ts`.

| Type | Proven from the payload alone | Proven against the key | Not proven, and why |
|---|---|---|---|
| `math.ten-frame.v2` | **Malformed:** a start that is not one or two whole counts from 0 to 10 is `impossible-state`, never a throw. **Reach, not already solved:** with no key, a search over the learner's own moves (one frame: add a counter, or take back one the learner added, never below the start; two frames: move one counter to the other frame, each frame at most 10) must find a board that differs from the start, else `no-solution`. **Budget:** the search spends `context.nodeBudget` and returns `budgetIssue(...)` when it runs out. | **Solvable:** the key `{ target }` must be one whole count per frame and the same search must reach it (`no-solution`). **Not already solved:** a target equal to the start is `impossible-state`. **No dead end:** the whole reachable graph is built and every board must still reach the target (`dead-end`), so no move strands the learner. **Unique:** not applicable, the grader takes one final board (the key target), so ambiguity cannot arise. | The frame count against the visual type and the "total unchanged" rule stay with `goldenGates` (gate 4), which already refuses them. The prompt-to-target correspondence ("make ten" against a target of 10) is not proven; a reviewer reads it. Dragging chips and tapping cells reach the same boards, so one move set is modelled, not both input paths. |

Assumptions:

- The move rule is re-derived from the pack gate and the board, not shared code (the packages share none), so a later change to the
  board's rule is not caught here.
- Taking back a learner-added counter on a single frame is modelled as a move down to the start only; Reset and Undo are not separate moves.
- With a tiny budget the checker answers `budget-exceeded`; the default budget (200,000, capped at 2,000,000) proves the largest frame
  instance in a few dozen nodes.
- Still limited, not verified: the checker proves the payload and the key, not the rendering; no browser was opened in this round.
