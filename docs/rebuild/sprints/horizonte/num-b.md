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
