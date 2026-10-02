# Lane doc: num-a (F1.2 rekenrek and abacus, F1.3 number lines, F1.7 clock, ruler and pan balance)

Seven Number pieces for ages 6 to 9, most of them also open to 10 to 12. Large targets, no reading load, every instruction also
available as spoken text. Built on the `golden` pattern ([golden.md](./golden.md), [RECIPE.md](./RECIPE.md)); every piece is
complete in all three layers.

| Item | Value |
|---|---|
| Catalogue rows | A05 (rekenrek), A06 (abacus), A12 (empty number line), A13 (zoomable number line), A14 and A23 (clock), A15 and A25 (ruler), A16 and A26 (pan balance), C14 (decimals on a line); `cat-math.md` |
| ICAP level | Active, all seven |
| Rendering | in-house SVG with a pure TS model; no third-party code |
| Chunk budget | 24 KB gzipped declared per board, one lazy chunk each |
| Grading | server-authoritative: Core holds the target, the payload never carries it |

## Segment types

| Segment type | Visual | Ages | Answer | Capabilities |
|---|---|---|---|---|
| `math.rekenrek.v2` | `rekenrek` | 6 to 9 | `{ beads: [row1, row2] }`, beads slid in each row (0 to 10) | `visual.rekenrek.v1`, `operation.slide-beads.v1`, `operation.drag-chips.v1`, `operation.move-menu.v1` |
| `math.abacus.v2` | `abacus` | 6 to 12 | `{ digits: number[] }`, one digit (0 to 9) per rod, one to four rods | `visual.abacus.v1`, `operation.slide-beads.v1`, `operation.drag-chips.v1`, `operation.move-menu.v1` |
| `math.number-line.empty.v2` | `empty-number-line` | 6 to 12 | `{ jumps: number[] }`, signed jump sizes in order | `visual.empty-number-line.v1`, `operation.draw-jumps.v1` |
| `math.number-line.zoom.v2` | `zoom-number-line` | 10 to 12 | `{ units: number }`, the marker as a whole number on the finest grid | `visual.zoom-number-line.v1`, `operation.zoom-in.v1`, `operation.place-point.v1` |
| `math.clock.v2` | `analog-clock` | 6 to 12 | `{ minutes: number }`, minutes after 12:00 (0 to 719) | `visual.analog-clock.v1`, `operation.set-hands.v1` |
| `math.ruler.v2` | `ruler` | 6 to 12 | `{ end: number }`, the mark the bar ends on | `visual.ruler.v1`, `operation.stretch-bar.v1` |
| `math.pan-balance.v2` | `pan-balance` | 6 to 12 | `{ pans: number[] }`, per loose weight 0 tray, 1 left pan, 2 right pan | `visual.pan-balance.v1`, `operation.drag-chips.v1`, `operation.move-menu.v1` |

Every scope is `adult: false`; any other band or the adult pathway is refused by Core and by the browser. The capability literal is
`NUM_A_CAPABILITIES` and is in parity across Core, the browser and the Forge.

## Behaviour

- **Rekenrek (A05).** Two rows of ten beads in blocks of five (5 and 10 read as blocks). Payload `{ start: [a, b] }`. Tap a bead to slide
  it and every bead before it; tap a slid bead to slide it and the beads after it back. Chips "Slide one bead", "Slide a block of
  five", "Slide one back", "Slide five back" drag onto a row (or tap the chip, then the row). Keyboard path: pick a chip, then "Move to"
  and choose the row. A chip that cannot move anywhere is disabled; counts stay between 0 and 10.
- **Abacus (A06).** One to four rods, a five bead and four one beads each, place names from the rod count (ones, tens, hundreds,
  thousands). Payload `{ start: [digits] }`. Tap a bead to set the rod; chips "Add one", "Take one", "Add five", "Take five" drag onto a
  rod, with the same "Move to" path. A move that would leave 0 to 9 is ignored.
- **Empty number line (A12).** Payload `{ start, sizes, max }`: the start number, the jump sizes the author allows (two to six of 1, 2,
  5, 10, 20, 50, 100) and a cap on jumps. One 64 px button per size forward and per size back; Undo takes back the last jump. The line
  is drawn in jump order, not to scale. A jump is disabled at the cap and when it would leave 0 to 1000.
- **Zoomable number line (A13, C14).** Payload `{ low, high, depth, start }`: a window of at most 20 whole numbers and one or two zoom
  levels (tenths, hundredths). The marker moves a tick at a time with the stepper or by tapping the line. "Zoom in" keeps the marker
  and shows one tick of the coarser level on each side; "Zoom out" puts the marker back on the coarser grid. The answer is integer
  units of the finest grid (3.47 is 347), so there is no float comparison anywhere.
- **Clock (A14, A23).** Payload `{ start, step }`: the start time in minutes after 12:00 and the step the minute hand moves in (1, 5, 15
  or 30). Hour and minute steppers (the keyboard path) and a tap on the face to point the minute hand; the minute follows the step.
- **Ruler (A15, A25).** Payload `{ unit, from, start, max }`: a bar that starts at a mark, in centimetres or inches. Stretch the far end
  with the stepper or by tapping the ruler; the tap rounds to the nearest mark. The answer is the mark the bar ends on.
- **Pan balance (A16, A26).** Payload `{ left, right, weights }`: fixed weights on each pan and up to six loose weights in a tray.
  Drag a weight (or tap it and then a pan, or "Move to" the left pan, tray or right pan). The beam tilts with the difference. The answer
  is where each weight sits; Core holds the target difference (left total minus right total), so every placement that makes it is met.
- **Equivalent on every board.** A live status line writes the state in words and numbers ("Row 1: 7 (5 + 2). Row 2: 2. Total: 9"), and
  "Show as table" opens a table with the same state. Both are spoken text for the instruction's state, in the learner's language.

## Scorer ladder

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields, a value outside the piece's range, a wrong length, a clock minute off the step, a ruler end off the ruler, or a malformed or unreachable rubric target |
| `valid` | the untouched start, and any well-formed response when there is no rubric (the browser copy) |
| `review` | changed and well formed but not the target; diagnostic `value` |
| `met` | equals the target; for the empty line the landing number, for the pan balance the pan difference; diagnostic `none` |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/num-a/`: `beads-model.ts`, `line-model.ts`, `measure-model.ts`, `contract.ts`, `scorer.ts`,
`fixtures.ts`, `capabilities.ts`, `index.ts` (14 fixtures). Test `backend/src/__tests__/horizonte/num-a.test.ts` (runs the scorer harness).

Browser `frontend/src/rebuild/learning/horizonte/num-a/`: generated `beads-model|line-model|measure-model|contract|scorer|fixtures.generated.ts`,
`capabilities.ts`, `copy.ts`, `boardKit.tsx`, `boards.tsx`, `RekenrekBoard.tsx`, `AbacusBoard.tsx`, `EmptyLineBoard.tsx`,
`ZoomLineBoard.tsx`, `ClockBoard.tsx`, `RulerBoard.tsx`, `PanBalanceBoard.tsx`, `Rekenrek.css`, `NumberLine.css`, `Measure.css`,
`audit.json`, and the tests `Rekenrek.test.tsx` (rekenrek, abacus), `NumberLine.test.tsx` (empty line, zoom), `Measure.test.tsx` (clock,
ruler, pan balance), each running `assertBoardContract` for its fixtures.

Forge `coursegen/src/v2/horizonte/num-a.ts` (capabilities, authoring guidance, gate-4 solvability `numAGates`); test
`coursegen/src/__tests__/horizonte/num-a.test.ts`.

Fixtures: `rekenrek-seven`, `rekenrek-ten`, `abacus-forty-seven`, `abacus-add-twenty`, `jump-up`, `jump-back`, `zoom-tenths`,
`zoom-hundredths`, `clock-half-past`, `clock-later`, `ruler-six`, `ruler-inches`, `balance-it`, `balance-heavier`, all listed once in
`audit.json` with their age band (the zoom fixtures use `10-12`). Preview: `?screen=fixture&seg=hz:num-a:rekenrek-seven&age=6-9`.

## Decisions

- **Age scope wider than "6 to 9" for five pieces.** The brief says ages 6 to 9 mostly. Abacus, empty line, clock, ruler and pan balance
  also serve 10 to 12 (place value, elapsed time and measurement keep appearing there). Rekenrek stays 6 to 9. The zoom line is 10 to 12
  only, because decimals on a line are taught from about age 10. This follows the catalogue rows; the owner can narrow any scope in
  `NUM_A_AGE_SCOPE` and the browser capability map follows from the sync.
- **Spoken text without per-locale payloads.** Payloads are locale-identical, so the spoken form of an instruction lives in the
  localized `aria-label`s (every bead, weight and button has one) and in the live status line, which is a `role="status"` region. The
  prompt itself is the author's text in the document; the harness checks that every name exists in all three locales.
- **Handles.** Rekenrek, abacus and pan balance have `.lf-hz-handle` chips (`data-hz-hit="64"`) with the "Move to" menu. The number
  lines, the clock and the ruler have no drag handle: they use tap-on-the-line plus steppers or 64 px buttons, so there is nothing to
  drag and nothing to give a keyboard alternative for.
- **Stepper, not Slider.** The design `Slider` range input has no accessible name by the harness's definition. `Stepper` names both of
  its buttons ("Marker: One tick right") and writes its value as text.
- **Empty line is not to scale.** Jumps are drawn in the order made at equal width, so the arcs are readable on a phone and the
  picture never suggests a measurement. The number under each tick is the truth.
- **Zoom answer in integers.** The answer is whole units of the finest grid, so grading is exact. The decimal text uses the learner's
  locale (3,47 in pt-BR) and is display only.
- **Not built.** No ordering-on-the-line task and no measure-an-object ruler mode: both need a second answer shape. The ruler measures a
  bar the learner builds.
- **Chunk budget.** 24 KB gzipped is declared for each board; the real size has not been measured (see Known issues).
- **Colour and motion.** Rows, rods, jump directions and pans use `--sky` and `--mint`, and the zoom marker `--berry` (with `-strong`, `-soft`,
  `-ridge`); state is also stated in text and in `aria-pressed`, never colour alone. Motion is only inside `prefers-reduced-motion:
  no-preference`: a bead fill transition and a jump arc drawing in, both `--dur-component` with `--ease-standard`.

## Status

Implemented: backend model, scorer, rubric, 14 fixtures, 17 tests; the seven boards and their copy in en-US, es-MX and pt-BR; the
Forge pack with authoring guidance and a solvability gate, 7 tests; the generated browser scorer; `audit.json`; 55 board tests
(contract, interaction, tables, locales).

Not yet verified, accepted or released:

- No real-browser run: the 64 px handle size, SVG layout on a phone, the wide-screen look and the focus rings are untested because
  jsdom cannot measure layout. The coordinator's audit pass owns this.
- No bundle measurement: the 24 KB chunk budgets are declared, not measured.
- No browser gate, text-fit, proportion or Copy Budget audit has been run on these boards (`audit:*` is the coordinator's). The unit
  harness checks the Copy Budget on every string.
- Not accepted by the owner or a learner test; not released. Recording these in `SPRINTS.md` and `REQUIREMENTS.md` is left to the
  checkpoint.

## Known issues

- `F0.4-solvability.md` is not in this worktree, so the Forge gate follows the golden pack's convention (one gate-4 function in the
  pack, `solvability.ts` untouched) and is checked against the same rules as the scorer.
- The clock face tap is a no-op where the face has no measured size (as in jsdom); the steppers are the tested path.
- On a narrow screen the beads and the zoom line sit in a horizontally scrolling container with a minimum width rather than shrinking
  below a tappable size.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.
