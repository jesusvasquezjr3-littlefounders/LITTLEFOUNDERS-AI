# Lane doc: num-a (F1.2 rekenrek and abacus, F1.3 number lines and ordering, F1.7 clock, ruler, measuring and pan balance)

Nine Number pieces for ages 6 to 9, most of them also open to 10 to 12. Large targets, no reading load, every instruction also
available as spoken text. Built on the `golden` pattern ([golden.md](./golden.md), [RECIPE.md](./RECIPE.md)); every piece is
complete in all three layers. The ordering line and the ruler reading were added in the fix round (see the end of this document).

| Item | Value |
|---|---|
| Catalogue rows | A05 (rekenrek), A06 (abacus), A12 (empty number line, and placing given numbers), A13 (zoomable number line), A14 and A23 (clock), A15 and A25 (ruler), A16 and A26 (pan balance), C14 (decimals on a line), 2:T03 and "order close decimals" (placing given numbers on a line); `cat-math.md` |
| ICAP level | Active, all nine |
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
| `math.number-line.order.v2` | `order-number-line` | 6 to 12 | `{ slots: { "m-<mark>": ["n-<units>"] } }`, the F0.3 `arrangement.slots` shape: one piece per mark | `visual.order-number-line.v1`, `operation.place-numbers.v1`, `operation.drag-chips.v1`, `operation.move-menu.v1` |
| `math.ruler.measure.v2` | `ruler-measure` | 6 to 12 | `{ value: "<length>" }`, the F0.3 `number.tolerance` shape: the length read off the ruler, whole units | `visual.ruler-measure.v1`, `operation.read-length.v1` |

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
- **Order the numbers on a line (F1.3; A12, A13, C14, 2:T03).** Payload `{ scale, low, step, count, values }`: `count` equal gaps (4 to
  20) of `step` units from `low`, two to six distinct given numbers that each sit on a mark. `scale` 0 is whole numbers, 1 tenths, 2
  hundredths, and every number is whole units of that grid (0.45 is 45 at scale 2), so nothing is compared as a float. Only the two
  ends and the middle mark are labelled. Tap a number and then a mark, drag it, or pick it and use "Move to" with `Tray` or any `Mark
  n`. Check opens only when every number is placed; Reset puts them all back. A status line and "Show as table" state each number's
  mark, in the learner's language (pt-BR writes 0,45). The scorer checks every position.
- **Measure a given object (F1.7).** Payload `{ unit, object, from, to, max }`: a pencil or a paper strip drawn from a near mark to a far
  mark of a ruler (at most 12 marks, cm or in). The learner reads its length with a stepper that starts at 0 and checks. The answer
  is the reported length, whole units; Core holds the key (`to` minus `from`). The object may start on any mark, so reading the far
  mark is a likely wrong answer; the board submits what is read and Core marks it `review`, with no special feedback. A status line and "Show as table" give the same drawing
  in words.
- **Equivalent on every board.** A live status line writes the state in words and numbers ("Row 1: 7 (5 + 2). Row 2: 2. Total: 9"), and
  "Show as table" opens a table with the same state. Both are spoken text for the instruction's state, in the learner's language.

## Scorer ladder

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields, a value outside the piece's range, a wrong length, a clock minute off the step, a ruler end off the ruler, or a malformed or unreachable rubric target |
| `valid` | the untouched start (an empty board for the order line, a reading of 0 for the ruler reading, which is never a score), and any well-formed response when there is no rubric (the browser copy) |
| `review` | changed and well formed but not the target; diagnostic `value` |
| `met` | equals the target; for the empty line the landing number, for the pan balance the pan difference, for the order line every given number on the mark of its value (the key holds exactly one solution), for the ruler reading the length of the drawn object; diagnostic `none` |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/num-a/`: `beads-model.ts`, `line-model.ts`, `measure-model.ts`, `order-model.ts`,
`read-model.ts`, `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts` (20 fixtures). Test
`backend/src/__tests__/horizonte/num-a.test.ts` (runs the scorer harness; 26 tests).

Browser `frontend/src/rebuild/learning/horizonte/num-a/`: generated
`beads-model|line-model|measure-model|order-model|read-model|contract|scorer|fixtures.generated.ts`, `capabilities.ts`, `copy.ts`,
`boardKit.tsx`, `boards.tsx`, `RekenrekBoard.tsx`, `AbacusBoard.tsx`, `EmptyLineBoard.tsx`, `ZoomLineBoard.tsx`, `ClockBoard.tsx`,
`RulerBoard.tsx`, `PanBalanceBoard.tsx`, `OrderLineBoard.tsx`, `RulerMeasureBoard.tsx`, `NumShared.css` (the four board-layout rules
every board loads), `Rekenrek.css`, `NumberLine.css`, `Order.css`, `Measure.css`, `audit.json`, and the tests `Rekenrek.test.tsx`
(rekenrek, abacus), `NumberLine.test.tsx` (empty line, zoom, order line), `Measure.test.tsx` (clock, ruler, pan balance, ruler
reading), `Tokens.test.ts` (theme-flipping tokens only), each board test running `assertBoardContract` for its fixtures (77 board
tests).

Forge `coursegen/src/v2/horizonte/num-a.ts` (capabilities, authoring guidance, gate-4 solvability `numAGates`, which reads the
document's age band); test `coursegen/src/__tests__/horizonte/num-a.test.ts` (14 tests). Committed plans: the two new types are in
`coursegen/src/v2/fixtures/plans-horizonte/49-v2-hz-num-a-6-9-6-9.json` and `50-v2-hz-num-a-10-12-10-12.json`, and
`emitted-horizonte.json` was regenerated from them.

Fixtures: `rekenrek-seven`, `rekenrek-ten`, `abacus-forty-seven`, `abacus-add-twenty`, `jump-up`, `jump-back`, `zoom-tenths`,
`zoom-hundredths`, `clock-half-past`, `clock-later`, `ruler-six`, `ruler-inches`, `balance-it`, `balance-heavier`, `order-tens`,
`order-teens`, `order-tenths`, `order-hundredths`, `measure-pencil`, `measure-strip`, all listed once in `audit.json` with their age
band (the zoom fixtures, `order-tenths`, `order-hundredths` and `measure-strip` use `10-12`). Preview:
`?screen=fixture&seg=hz:num-a:rekenrek-seven&age=6-9`.

## Decisions

- **Age scope wider than "6 to 9" for five pieces.** The brief says ages 6 to 9 mostly. Abacus, empty line, clock, ruler and pan balance
  also serve 10 to 12 (place value, elapsed time and measurement keep appearing there). Rekenrek stays 6 to 9. The zoom line is 10 to 12
  only, because decimals on a line are taught from about age 10. This follows the catalogue rows; the owner can narrow any scope in
  `NUM_A_AGE_SCOPE` and the browser capability map follows from the sync.
- **Spoken text without per-locale payloads.** Payloads are locale-identical, so the spoken form of an instruction lives in the
  localized `aria-label`s (every bead, weight and button has one) and in the live status line, which is a `role="status"` region. The
  prompt itself is the author's text in the document; the harness checks that every name exists in all three locales.
- **Handles.** Rekenrek, abacus, pan balance and the order line have `.lf-hz-handle` chips (`data-hz-hit="64"`) with the "Move to" menu.
  The empty and zoom number lines, the clock and both rulers have no drag handle: they use tap-on-the-line plus steppers or 64 px buttons, so there is nothing to
  drag and nothing to give a keyboard alternative for.
- **Stepper, not Slider.** The design `Slider` range input has no accessible name by the harness's definition. `Stepper` names both of
  its buttons ("Marker: One tick right") and writes its value as text.
- **Empty line is not to scale.** Jumps are drawn in the order made at equal width, so the arcs are readable on a phone and the
  picture never suggests a measurement. The number under each tick is the truth.
- **Zoom answer in integers.** The answer is whole units of the finest grid, so grading is exact. The decimal text uses the learner's
  locale (3,47 in pt-BR) and is display only.
- **Ordering and measuring, built in the fix round.** The first round did not build a placing-numbers-on-a-line task or a
  measure-a-given-object ruler mode, on the belief that each needed a new answer shape. Neither does: the order line reuses the F0.3
  `arrangement.slots` shape and the ruler reading reuses `number.tolerance`. `math.ruler.v2` still measures a bar the learner builds;
  `math.ruler.measure.v2` is the reading mode. See the fix round for what each still does not do.
- **Chunk budget.** 24 KB gzipped is declared for each board; the real size has not been measured (see Known issues).
- **Colour and motion.** Rows, rods, jump directions and pans use `--sky` and `--mint`, and the zoom marker `--berry` (with `-strong`, `-soft`,
  `-ridge`); state is also stated in text and in `aria-pressed`, never colour alone. Motion is only inside `prefers-reduced-motion:
  no-preference`: a bead fill transition and a jump arc drawing in, both `--dur-component` with `--ease-standard`.

## Status

Implemented: backend models, scorer, rubric, 20 fixtures, 26 tests; the nine boards and their copy in en-US, es-MX and pt-BR; the
Forge pack with authoring guidance and a solvability gate, 14 tests, and the two new types in the committed Forge plans; the generated
browser scorer; `audit.json`; 77 board tests (contract, interaction, tables, locales, theme tokens).

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
- On a narrow screen the beads, the zoom line, the ruler and the order line sit in a horizontally scrolling container with a minimum
  width rather than shrinking below a tappable size. Before the fix round the rules that make that container (`.lf-num-board`,
  `.lf-num-scroll`, `.lf-num-status`, `.lf-num-tray`) lived only in `Rekenrek.css`, which only the rekenrek and the abacus imported, so the other five boards (both number lines, the
  clock, the ruler, the pan balance) had none of them; they are now in `NumShared.css`, which every board imports.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.

## Fix round

A completion round on the merged pack: two pieces the first round did not build, a layout defect on the older boards, and a dark-mode
audit. Branch `hz/fx-numa`; everything is local.

### What changed

- **F1.3, order the numbers on a line.** New segment `math.number-line.order.v2` (visual `order-number-line`). Backend `order-model.ts`
  holds the pure model (marks, placement, key check); the scorer wraps the F0.3 `arrangement.slots` shape, so no new answer shape was
  added. The key is `{ solutions: [slotMap] }` with exactly one solution, slot `m-<mark>` and piece `n-<units>`. Board
  `OrderLineBoard.tsx`: tap a number then a mark, drag, or "Move to" (`Tray` and every `Mark n`); a number pressed while another is in
  hand takes that place (swap, or the occupant goes back to the tray); 64 px handles; status line and table. Fixtures `order-tens`,
  `order-teens` (6 to 9) and `order-tenths`, `order-hundredths` (10 to 12; the latter is a close-decimals window from 0.30 to 0.50).
- **F1.7, measure a given object.** New segment `math.ruler.measure.v2` (visual `ruler-measure`). Backend `read-model.ts`; the scorer
  wraps the F0.3 `number.tolerance` shape, so again no new shape. The key is `{ target: "<to minus from>" }`. Board
  `RulerMeasureBoard.tsx`: a pencil or a strip drawn on a ruler with dashed guides to the marks it touches, and a stepper for the
  reading that starts at 0. Fixtures `measure-pencil` (6 to 9, 0 to 7 cm) and `measure-strip` (10 to 12, 2 to 8 in).
- **Age scope.** Both types are ages 6 to 12, `adult: false`, in `NUM_A_AGE_SCOPE`; Core and the browser refuse any other band. Decimal
  order lines (`scale` 1 or 2) are for 10 to 12 only; the Forge gate refuses them in a 6 to 9 document. The three capability
  literals (Core, browser, Forge) carry the same two new entries.
- **Narrow screens.** `NumShared.css` now holds the four layout rules that every board needs, and every board imports it (see Known
  issues for the cause). The order line scrolls horizontally with a 64 px minimum cell width (21 marks at most).
- **Dark mode.** A search of every num-a stylesheet and board for the constant `var(--ink)`, hex and rgb literals and `white`/`black`
  found none, so there was nothing to replace; the two new stylesheets were written with flipping tokens only. `Tokens.test.ts` now
  fails if any num-a stylesheet or board brings one in. No missing token is known. Disabled-button contrast is a shared design rule
  and is not changed here.
- **Forge.** Guidance for both types (age scope, prompt length, key shape), gate-4 checks (payload, visual, key against the drawing,
  list not already in ascending order, decimals only in a 10 to 12 document), 7 new tests, and both types in the committed plans 49
  and 50 with `emitted-horizonte.json` regenerated.
- **Pins.** `teachingVisualCoverage.generated.ts` was regenerated (66 segment types, 66 boards, 66 contracts, 29 drag interactions all
  with an alternative) and `agent/tools/teaching-visual-coverage.test.mjs` now expects 66.

### Decisions

- **The untouched start is never a score.** An empty order board and a reading of 0 are `valid`, never `met`, so a learner cannot
  pass by pressing Check on the start, and the scorer sample for each type is the start state.
- **Integer, non-negative, marks only.** The order line has no zoom and no free position: every number sits on a mark, so there is no
  float comparison and no tolerance. A window that does not start at 0 is allowed (0.30 to 0.50).
- **One solution.** The key has exactly one solution because every number has exactly one mark; a key that disagrees with the
  drawing is refused at gate 4 and by the scorer as a malformed key.
- **A reading is any whole number from 1 to the end of the ruler.** The board does not hint that the far mark is the wrong answer when
  the object starts away from 0; it submits and Core marks it `review`.
- **Swap, not refuse.** A number dropped on an occupied mark takes it and the occupant goes to the tray or, if it was carried from a
  mark, to the carried number's mark; pressing a placed number while carrying drops the carried one there.

### Still limited

- "Mark n" counts from the left end starting at 0, so a keyboard learner works out the mark from the visible step and the labelled
  ends; only the ends and the middle are labelled on purpose. The status line and the table state the result in numbers.
- The order line has no zoom: it cannot show numbers that need a finer grid than the line draws. Close decimals are handled by a
  window that starts away from 0, not by zooming.
- The ruler reading takes whole units only; no half marks, no fractions, no millimetres.
- Up to 20 gaps and 6 numbers on the order line; a longer line scrolls.
- The Forge plans carry one order line and one reading per band; the author guidance is the only description of how to vary them.

### Not verified

- No real-browser run: the 64 px size, the scrolling of a 21-mark line, the look of the pencil and the strip, focus rings and the
  dark-mode appearance are untested because jsdom cannot measure layout or resolve theme tokens. The token test is a source check,
  not a rendering check.
- No bundle measurement: the 24 KB budget declared for each new board is not measured.
- No `audit:*`, text-fit, proportion or Copy Budget browser audit, no screenshots, no screen-reader pass; the unit harness checks the
  Copy Budget on every string in the three locales.
- The three locales' text is written natively but has not been read by a native speaker.
- Not accepted by the owner or a learner test; not released. `SPRINTS.md`, `REQUIREMENTS.md` and `COVERAGE.md` are left to the
  checkpoint.
