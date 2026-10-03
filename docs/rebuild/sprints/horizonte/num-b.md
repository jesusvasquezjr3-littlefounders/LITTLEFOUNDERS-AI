# Lane doc: num-b (F1.4 arrays and area, F1.5 ratio line and tape, F1.6 fraction wall and operations)

Three number-sense visuals for multiplication, division, ratio and fractions, all in the same three layers as the golden slice.
Procedure: [RECIPE.md](./RECIPE.md). Pattern: [golden.md](./golden.md).

| Item | F1.4 | F1.5 | F1.6 |
|---|---|---|---|
| Segment type | `math.array-area.v2` | `math.ratio-line.v2` | `math.fraction-wall.v2` |
| Visuals | `array`, `area-model`, `area-division` | `double-number-line`, `ratio-tape` | `fraction-wall`, `fraction-bars`, `fraction-product`, `fraction-measure` |
| Ages | 8 to 12 (array 8 to 12; area model and area division are 10 to 12 only, by the Forge gate) | 10 to 12 | 8 to 12 (equivalent fractions 8 to 12; add, subtract, multiply and divide are 10 to 12 only, by the Forge gate) |
| ICAP level | Constructive | Constructive | Constructive |
| Answer shape | `{ value: string }` plus the scaffold fields below | `{ value: string }` plus the scaffold fields below | fraction on grid: `{ n: number, d: number }`, whole numbers, 0 meaning nothing entered |
| Private key | `{ value }` | `{ value }` | `{ n, d }` |
| Capabilities | `visual.array-area.v1`, `operation.tap-cells.v1`, `operation.drag-chips.v1`, `operation.number-input.v1` | `visual.ratio-line.v1`, `operation.drag-chips.v1`, `operation.number-input.v1` | `visual.fraction-wall.v1`, `operation.tap-cells.v1`, `operation.drag-chips.v1`, `operation.number-input.v1` |
| Chunk budget (declared, not measured) | 20 KB gzipped | 20 KB gzipped | 24 KB gzipped |
| Rendering | in-house SVG and CSS grid; no third-party code | same | same |

## Behaviour

- **Array (F1.4).** A rows-by-columns array of up to 10 by 10 dots. The learner can tap a row to count it (a scaffold that is not graded) and types the total.
- **Multiplication box (F1.4, 10 to 12).** A rectangle `across` by `down` (across 11 to 99). The learner cuts the across side at a tick, which splits the box into two partial products, types each partial and then the total. Ticks sit at half the side and at multiples of ten; any sound split is accepted.
- **Missing-area division (F1.4, 10 to 12).** A rectangle with a known area (the dividend) and one known side (the divisor). The learner cuts the unknown side into friendly pieces, types the partial quotients and then the missing side.
- **Double number line (F1.5).** Two aligned lines with the base pair (for example 3 coins to 2 pencils) and one given value on one line. The learner places the scale marker (a scaffold) and types the matching value on the other line. Units come from a closed list, so the payload is the same in every language.
- **Ratio tape (F1.5).** A tape cut into `a + b` equal boxes shared by two parts and a whole. The learner types the value of one box (a self-check, not graded) and then the value of the asked part.
- **Fraction wall, equivalent (F1.6).** Rows of equal cells for the starting fraction and the asked denominator. The learner shades cells on the asked row, by tapping, by moving the shade handle or by typing numerator and denominator. The response must be in the asked form.
- **Fraction bars, add and subtract (F1.6, 10 to 12).** Two bars with different denominators. A common-parts toggle recuts both into the lowest common denominator; the learner types the result as a numerator and a denominator.
- **Product grid, multiply (F1.6, 10 to 12).** A grid of `(b + 1) x (d + 1)` strips and cells. The learner shades the columns and rows and reads the overlap. The status never names the overlap in words.
- **Measuring tiles, divide (F1.6, 10 to 12).** A unit bar, the length to measure and tiles of the divisor. The learner adds and removes tiles, then types the result, which is rational: the left fraction is always larger than the right.
- **Every drag has a keyboard and tap path.** Handles are 64 px; a `Move to` menu lists the same targets as the drop zones. The clear action is `cell-0` on the wall.
- **Equivalent.** Every board has a live status line and a Show-as-table toggle. The table footers show only numbers the learner derived or numbers that are public, never the answer.
- **Grading.** Core holds the rubric; the payload never carries it. The browser sends the response and shows what Core returns. With no rubric (the browser scorer) the verdict is `valid` or `invalid` only.

## Scorer ladder (all three types)

| Verdict | When |
|---|---|
| `invalid` | malformed segment, response or key (a key nobody can reach is refused before the untouched check), a visual that does not match its payload, extra fields, a number out of range |
| `valid` | nothing entered yet, and every well-formed response when there is no rubric |
| `review` | a well-formed answer that is not the key; diagnostic `value` |
| `met` | equals the key; score 100, diagnostic `none` |

Fractions: for add, subtract, multiply and divide any form equal to the result counts (`14/24` is as good as `7/12`). For `equivalent` only the asked denominator counts.

## Files

Backend `backend/src/services/horizonte/num-b/`: `arrayAreaModel.ts`, `ratioLineModel.ts`, `fractionWallModel.ts`, `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test: `backend/src/__tests__/horizonte/num-b.test.ts`.

Browser `frontend/src/rebuild/learning/horizonte/num-b/`: generated `*.generated.ts` (six files, from the sync tool), `capabilities.ts`, `copy.ts`, `boards.tsx`, `boardKit.tsx`, `ArrayAreaBoard.tsx|css`, `RatioLineBoard.tsx|css`, `FractionWallBoard.tsx|css`, `numB.css`, `audit.json`, `num-b.test.tsx`.

Forge `coursegen/src/v2/horizonte/num-b.ts` (capabilities, authoring guidance per type, gate-4 `numBGates`); test `coursegen/src/__tests__/horizonte/num-b.test.ts`.

Fixtures (segment id equals fixture id): `array-rows-columns`, `area-box`, `area-division`, `double-line-scale`, `tape-share`, `wall-equivalent`, `bars-add`, `bars-subtract`, `product-grid`, `measure-fit`.
Preview: `?screen=fixture&seg=hz:num-b:array-rows-columns&age=6-9`. `audit.json` lists the ten fixtures (6 to 9 for the array and the equivalent wall, 10 to 12 for the rest).

## Decisions

- **Plain-text spoken labels.** Math is spoken as plain text, for example "three fourths"; no KaTeX is loaded in a board chunk.
- **Locale-neutral payloads.** Units are a closed enum, and copy lives in the browser, so one payload serves en-US, es-MX and pt-BR.
- **Fraction answer shape.** `{ n, d }` whole numbers, 0 meaning nothing entered, with a `{ n, d }` rubric. The existing `math.number-line.fraction.v2` ("n/d" text) is a separate type and is untouched.
- **Array-area and ratio answers are strings** with a blank state, so a learner can clear a field and the scorer can tell nothing from zero.
- **Scaffolds that are not graded:** array row counting, the ratio marker, the tape box-value self-check, the area split (any sound split is accepted, ticks are only friendly cut points), the common-parts toggle, the multiply shading and the measure tiles. The scorer checks that each is well formed, never that it is right.
- **Compare (C03).** The aligned rows of the wall and the table cover the comparison half of the catalogue row; there is no separate compare type.
- **Own `NumField`.** The boards use `boardKit.NumField` and not the shared `NumberAnswer`: the harness `accessibleName` ignores `<label for>` and the shared component passes no `aria-label`. See the owner follow-ups.
- **Gate 4 lives in the pack.** `numBGates` re-implements the model validators locally (Forge cannot import from the backend): payload validity, the visual that matches the payload, the age band, and, when a key is passed, its shape and that it equals the answer the public numbers determine. No engine solvability checker is registered, so `solvabilityPacks.ts` is untouched.
- **Copy.** All strings are written to the strictest Copy Budget (6 to 9); es-MX and pt-BR are native text, not copies of the English.
- **Colour and motion.** Tokens only; the two parts use sky and mint, the overlap uses berry, and state is always also text. Motion is a background-colour transition under `prefers-reduced-motion: no-preference`.

## Known issues and owner follow-ups

- Chunk budgets are estimates; no production build was run in this lane.
- Hit size is declared and enforced in CSS, but jsdom cannot measure layout; a real-browser check of the 64 px handles and of the 36 rem wall at phone width belongs to the coordinator's audit pass.
- Lint (jsx-a11y) was not run in this lane; the commit gate runs it.
- `NumberAnswer` in the shared kit should pass an `aria-label` (or the harness `accessibleName` should read `<label for>`); then the boards can drop `NumField`.
- Base issue, not from this lane: the `plano` pack folder is not registered in `fixtures.ts` (three failures in `harness/fixtureCoverage.test.tsx`) and its `copy.ts` exports no single `*_COPY` object (`check-horizonte-copy.mjs` fails on it).
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.

## Fix round

Two jobs: a dark-mode defect in the three original boards, and the missing circular fraction visual of F1.6.

### What changed

- **Dark mode.** The text colour of `ArrayAreaBoard.css`, `FractionWallBoard.css` and `RatioLineBoard.css` used `var(--ink)`, which is a constant and stays dark in the dark theme. It is now `var(--content)`, the token that flips with the theme. No `--ink` is left in the pack.
- **New segment type `math.fraction-circles.v2` (F1.6 circles).** A circle cut into equal slices that the learner shades by tap or keyboard. It is a new type, not a new mode of the wall, because capabilities are static per type in the hand-written Core and browser maps and a new type fails closed. Ages 8 to 12 for the type; the Forge gate holds add and subtract to 10 to 12, as it does for the wall operations. ICAP Constructive. Capabilities: `visual.fraction-circles.v1`, `operation.tap-cells.v1`, `operation.number-input.v1` (no drag, so no handles). Chunk budget declared at 20 KB gzipped.
- **Four operations, one visual type (`fraction-circles`).**
  - `show` (ages 8 to 12): `{op, fraction: [n, d]}`. The learner picks how many parts to cut the circle into (2, 3, 4, 5, 6, 8, 10 or 12) and shades parts. The response is the circle itself, `{n: shaded, d: cut}`, and only the exact form counts (3 parts of 4, not 6 of 8).
  - `compare` (ages 8 to 12): `{op, left: [a, d], right: [c, d]}`, one denominator and different numerators. The learner shades both circles to their names, then picks the one with more. The response is the chosen circle, `{n: its shaded parts, d}`; any equal form of the larger fraction is `met`.
  - `add` and `subtract` (ages 10 to 12): `{op, left: [a, d], right: [c, d]}`, one denominator; the sum never passes one whole and the difference is positive. Two given circles, a work circle (empty for add, holding the left amount for subtract) and the typed result `{n, d}`; any equal form is `met`, lowest terms is the convention.
- **Answer shape and key.** `{n, d}` whole numbers, 0 meaning nothing entered, with a `{n, d}` rubric, the same as the wall. The rubric stays private; the browser copy of the scorer says only `valid` or `invalid`.
- **Interaction.** Every slice is a focusable SVG button named "Your circle: part 3 of 4" (or First, Second, Work circle). Tapping part k shades parts 1 to k, and tapping the last shaded part takes one back. "Shade one more" and "Shade one less" buttons and the cut buttons give a keyboard and large-target path. There is a live status line, a Show-as-table toggle (rows: item, parts, shaded) and a reset. Sky, mint and berry hues; state is always also text.
- **Copy.** About 40 keys in `copy.ts` in en-US, es-MX and pt-BR, each with a `data-copy-role`, written to the 6 to 9 Copy Budget.
- **Forge.** `coursegen/src/v2/horizonte/num-b.ts` carries guidance for the type and a gate-4 check: payload validity (one denominator from the list, proper fractions, add within one whole, subtract in order, compare with unequal numerators), the `fraction-circles` visual, the age band for add and subtract, and the key (exact form for show, any equal form otherwise). Plans `51` (show, compare) and `52` (add, subtract) carry the four pieces and `emitted-horizonte.json` is regenerated.
- **Files.**
  - Backend: `fractionCirclesModel.ts` (new), plus `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`; `fractionWallModel.ts` now exports its small helpers.
  - Browser: `fractionCirclesModel.generated.ts` (from the sync tool), `FractionCirclesBoard.tsx|css`, `boards.tsx`, `copy.ts`, `audit.json`, `capabilities.ts`; `useFractionText` and `FractionFields` moved from the wall board into `boardKit.tsx` so both boards share them.
  - Forge: `num-b.ts` and its test.
  - Tests: `backend/src/__tests__/horizonte/num-b.test.ts`, `frontend/.../num-b/num-b.test.tsx`, `coursegen/src/__tests__/horizonte/num-b.test.ts`.
- **Fixtures** (segment id equals fixture id): `circles-show` (6 to 9), `circles-compare` (6 to 9), `circles-add` (10 to 12), `circles-subtract` (10 to 12). Preview: `?screen=fixture&seg=hz:num-b:circles-show&age=6-9`.
- **Counts.** The Horizonte segment types are now 65, not 64. The hard-coded 64 in `agent/tools/teaching-visual-coverage.test.mjs` and `backend/src/__tests__/learningQaSignals.test.ts` is 65 and `teachingVisualCoverage.generated.ts` was regenerated. `COVERAGE.md` was not edited; the coordinator must re-sum it.

### What is still limited

- **Compare scores only the chosen circle.** The response is the fraction on the circle the learner picks, so the shading of the other circle is not scored. A learner who picks the larger circle with its correct shading is `met` whatever the other circle holds.
- **The work circle in add and subtract is scratch.** It is never sent; Core grades only the typed fraction. A learner can shade it wrongly and still type the right result.
- **`show` wants the exact form.** Six parts of eight does not count for three quarters; this is on purpose, so the learner chooses both numbers, and the hint names the cut and the shading.
- **Narrow slices are small touch targets.** At 12 parts a slice is about 40 px wide at the rim and narrower near the centre. The one-more and one-less buttons are the large-target path, and no pointer drag is involved.
- **Like denominators only.** The circles cover shade, compare and add or subtract with one denominator. Unlike denominators, multiplication and division stay on the bars, grid and tiles.
- **The Forge age rule is narrower than Core.** Core's age scope is per type (8 to 12); only the Forge gate keeps add and subtract to 10 to 12.
- **Chunk budget is an estimate.** No production build was run.

### What is not verified

- No real-browser run: the 40 vw circle at phone width, slice hit sizes, focus-ring look and the hue contrast were not measured. jsdom cannot measure layout.
- The dark-mode fix is by token only. No dark-theme screenshot of the original three boards or of the circles was taken.
- Lint (jsx-a11y) was not run in this lane.
- `COVERAGE.md` was not re-summed and the catalogue rows (m:C03, m:C08, m:C09, m:C10, 2:Q15, 2:T13) are not re-marked.
- What ran: the focused backend, browser and Forge tests of this pack, the capability parity gate, the coverage tool test, and one `type-check` per touched service after the merge.
