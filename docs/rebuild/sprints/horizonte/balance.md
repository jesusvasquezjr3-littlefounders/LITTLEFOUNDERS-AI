# Lane doc: balance (F1.8 equation balance, F1.15 visual proofs)

Two teaching pieces that share one pack: a scale that stays level while the learner does the same thing on both pans, and
figures made of rigid pieces that are cut and rearranged so an area formula can be seen before it is used. Procedure:
[RECIPE.md](./RECIPE.md). Exemplar: [golden.md](./golden.md).

| Item | Value |
|---|---|
| Catalogue rows | F1.8 equation balance; F1.15 visual proofs: E43 (Pythagoras), E44 (sum of odds), E23 (parallelogram), E24 (triangle), E25 (trapezoid), E26 (circle area), E27 (circumference and pi); `cat-math.md` |
| Segment types | `math.equation-balance.v2` (F1.8), `math.visual-proof.v2` (F1.15) |
| Visuals | F1.8 `equation-balance`; F1.15 `parallelogram-area`, `triangle-area`, `trapezoid-area`, `circle-area`, `circumference-unroll`, `pythagoras-proof`, `odd-sum-proof` |
| Ages | F1.8 10 to 14 (`{ ages: [10, 14], adult: false }`); F1.15 10 to 15 (`{ ages: [10, 15], adult: false }`); the Pythagoras fixture is offered only at 13 to 15 |
| ICAP level | Constructive, both pieces |
| Answer shape | F1.8 `{ steps: RouteOp[], answer: string }`: the ordered operation ids and x as canonical decimal text. F1.15 `{ choice: ProofChoice, value: string }`: the predicted formula id and the typed value as canonical decimal text |
| Rendering | in-house SVG, a pure model per piece, no third-party code; the equation is KaTeX through the shared `MathExpression` with author-written spoken text |
| Capabilities | F1.8 `visual.equation-balance.v1`, `operation.balance-ops.v1`, `operation.number-input.v1`, `visual.math-notation.v1`; F1.15 `visual.visual-proof.v1`, `operation.drag-pieces.v1`, `operation.predict-choice.v1`, `operation.number-input.v1` |
| Chunk budget | 14 KB gzipped declared for `BalanceBoard`, 18 KB for `ProofBoard`; not yet measured (see Known issues) |

## Behaviour

**F1.8 equation balance.**

- The payload is `{ start: { l: { x, u }, r: { x, u } }, ops: string[] }`: a scale that holds `a x + b = c x + d`, with x-blocks and
  unit counters on each pan (x up to 8, units up to 30), plus the operations offered. The answer x never ships.
- One move at a time, always on both pans: take 1 x, take 1 unit, add 1 unit, or divide by 2, 3, 4 or 5 (only when every count on the
  scale divides). A move that does not fit is greyed out. Drag a chip onto the scale, tap the chip and then the scale, or pick a chip and
  choose "On the scale" in the "Move to" menu (the keyboard path). The same chips are the only way to act; there is no free-form drag.
- Two "one pan only" moves (take 1 unit from the left or right pan) tip the scale on purpose, to show why the rule is "the same on
  both". While tipped the equation line says so, every other move is greyed, Check is disabled, and Undo levels the scale again. A slip
  is never part of the submitted route.
- The learner reaches "x = n" (x alone on one pan, a number alone on the other), then types x. The number field stays disabled until x
  is alone. Check sends `{ steps, answer }`.
- **Equivalent.** A live line states what is on each pan and whether the scale is level, and "Show as table" opens a table of x-blocks
  and units per pan. The equation shows as KaTeX when the scale is level, with spoken text built from copy ("3 x plus 2 equals x plus 8").

**F1.15 visual proofs.** "Se predice antes de ver."

- The payload is one shape per visual (for example `{ base, height, slant, choices }` for the parallelogram) with 3 to 5 formula
  choices that are never marked. The key is `{ choice, value }` and never ships.
- **Predict first.** The pieces and the number field stay locked until the learner picks a formula. The hint says so in words.
- **Then move the pieces.** Each movable group is a chip ("Left triangle: at start"). Drag it onto the figure, tap the chip and then the
  figure, or use "Move to" with "Where it fits" and "Back to start". Pieces slide and turn between two fixed poses; they are never
  stretched, so the area is the same before and after. The circle also asks how many slices (one of the authored counts).
- Once every piece is in place the status line says what the figure became ("Now a rectangle, 6 by 4."), and the number field opens.
  Pythagoras and the odd-sum answer are whole numbers; areas and the circumference accept decimals in the learner's locale.
- pi is 3.14 for every circle question and the prompt says so, so the key is exact. The figure never prints a pi-based number.
- **Equivalent.** A live line states the measures and how many pieces have moved, and "Show as table" opens a measure and value table.

## Scorer ladder

| Verdict | F1.8 | F1.15 |
|---|---|---|
| `invalid` | malformed response or extra fields; more than 16 steps; a step that is a slip, not offered, or not possible in turn; answer text that is not a canonical decimal; with a rubric, a key the equation does not hold at or that no offered route solves | malformed response or extra fields; a choice the piece does not offer; value text that is not a canonical decimal; with a rubric, a key that does not match the geometry it names |
| `valid` | the untouched start, a route with no typed answer, and (without a rubric, as in the browser) any well-formed response | no prediction or no number yet, and (without a rubric) any well-formed response |
| `review` | a legal route or answer that is not the key; diagnostic `value` | a complete prediction that is not the key; diagnostic `value` |
| `met` | the route isolates x and the typed value is the key; score 100, diagnostic `none` | the right formula and the right value; score 100, diagnostic `none` |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Files

Backend `backend/src/services/horizonte/balance/`: `numeric.ts` (exact decimals), `model.ts` (F1.8 scale, operations, BFS route),
`proof.ts` (F1.15 figures, poses, formulas, key), `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test:
`backend/src/__tests__/horizonte/balance.test.ts`, which runs `assertScorerContract` for both types.

Browser `frontend/src/rebuild/learning/horizonte/balance/`: generated `contract|fixtures|scorer|model|numeric|proof.generated.ts`,
`capabilities.ts`, `copy.ts`, `boards.tsx`, `numberField.tsx`, `BalanceBoard.tsx|css`, `ProofBoard.tsx|css`, `audit.json`, tests
`BalanceBoard.test.tsx` and `ProofBoard.test.tsx` (both run `assertBoardContract`).

Forge `coursegen/src/v2/horizonte/balance.ts` (capabilities, authoring guidance for both types, gate-4 `balanceGates`); test
`coursegen/src/__tests__/horizonte/balance.test.ts`.

Fixtures: F1.8 `two-sides`, `x-on-right`, `divide-last`; F1.15 `parallelogram`, `triangle`, `trapezoid`, `circle-area`,
`circumference`, `pythagoras` (13 to 17), `odd-sum`. Preview: `?screen=fixture&seg=hz:balance:two-sides&age=10-12`.

## Decisions

- **The formula is in the browser scorer.** The scale model and the figure geometry are public mathematics, so the generated browser
  copy carries them (it needs the model to draw the board anyway). Only the key (x, or the right formula and value) is private and
  server-side; the browser still cannot say `met`.
- **pi is 3.14.** Stated in the prompt, so the circle area and the circumference are exact decimals (78.5, 21.98) and the typed text is
  compared as a rational, never as a float. `Math.PI` values from the geometry are never displayed.
- **Slips are refused in a route.** They exist only to tip the scale in the board. The scorer treats a slip step as `invalid`, so the
  key route is always made of level moves.
- **One drop target for F1.8.** The scale is the single target and the chips sit outside it. Two targets (one per pan) would suggest
  an operation on a single pan, which is exactly the misconception the piece exists to remove. A drop target is also never an
  ancestor of a chip, because the chip's own click would reach the target with a stale carried item.
- **Predict before see, enforced.** The F1.15 chips are disabled until a formula is chosen, and the number field opens only after
  every piece has moved. The order is the learning mechanism, not a courtesy.
- **Pack-local number field.** `numberField.tsx` reuses the shared locale-aware reading (`readNumberAnswer`) but names the input with
  `aria-label` because the board contract does not count `<label for>` as an accessible name, and so Reset can empty the field.
- **Solvability sits in the pack gate.** The Forge `gates` hook runs an inline breadth-first route search for F1.8 and recomputes the
  F1.15 value from the figure's own measures, so `solvabilityPacks.ts` stayed untouched in the first round. The F0.4 checker for F1.15 came in the Solvability round below (the
  F1.8 checker is `solvability-balance.ts`, from an earlier unit).
- **Payload identical in every locale.** Labels, figure names, formula names and the spoken text of the equation live in board copy
  keyed by id, never in the segment.
- **Copy.** All entries carry `band: '10-12'`, which has the same limits as 13 to 17; es-MX and pt-BR are native text. The status
  strings avoid gendered agreement by putting the state after a colon ("Left triangle: at start").
- **Colour.** x-blocks and the first piece group use the sky series, unit counters and the second group mint, the measured length berry.
  Every state is also stated in text.
- **Motion.** Beam, pan and piece transitions run only under `prefers-reduced-motion: no-preference`, with the component duration and
  standard easing tokens.

## Known issues

- Hit size is declared and enforced in CSS but jsdom cannot measure layout; a real-browser check of the 64 px handles and of the two
  drawings belongs to the coordinator's audit pass.
- The chunk budgets (14 KB and 18 KB gzipped) are declared, not measured; `npm --prefix frontend run build` gives the real sizes.
- `cat-math.md` is the owner's catalogue and is not in this repository; the rows are cited by id.
- The Pythagoras visual is a dissection into two squares, not a rotation proof of the general case; it is offered at 13 to 15 only.

## Solvability round

`math.visual-proof.v2` now registers a real F0.4 checker in `coursegen/src/v2/horizonte/solvability-geom.ts` (the file that holds the geom2
checkers; imported from `coursegen/src/v2/solvabilityPacks.ts`). It reads the public payload alone, so the release-time run with no key
proves everything the figure fixes, and it compares the key only when `context.answerKey` is present. The pack's own formula table, payload
rules and value text (`PROOF_FORMULAS`, `proofPayloadFault`, `proofValueText`) are exported from `balance.ts` and imported; the gate-4
behaviour of the pack is unchanged. The F1.8 equation-balance checker is `solvability-balance.ts` from an earlier unit and is not part of
this row. Tests: `coursegen/src/__tests__/horizonte/solvability-geom.test.ts` (41 tests, shared with the four geom2 types).

| Type | Solvable (learner's controls alone) | Unique, start, dead end | Codes | Not provable |
|---|---|---|---|---|
| `math.visual-proof.v2` | The figure is read from the payload's own key set (a checker never sees the visual): one of the seven. The choices are 3 to 5 distinct formula ids from that figure's pool and the right formula is among them (else `no-solution`). The measures pass the pack's `proofPayloadFault` (`out-of-bounds` when they are finite numbers outside the figure's range, `impossible-state` otherwise). With a key: `{ choice, value }` must be the right formula and the figure's value as plain decimal text. | Unique: one formula id is graded, and a distractor that gives the same number as the right formula on this figure (for example a parallelogram 2 by 2, a triangle 4 by 4, a circle of radius 1 or 2, a circumference of diameter 4) is a blocking `ambiguous-solution`, because a learner who picks it and types the right value is graded wrong. The pack gate accepts those figures; this is new. The value text is read as a number, like the grader, so `24.0` is the same key as `24`. Start: the payload holds only measures and unmarked choices, and the learner starts with no choice and no value, which grades `valid`, never `met`. Dead end: a choice and a number can be changed freely. | `impossible-state`, `out-of-bounds`, `no-solution`, `ambiguous-solution`, `duplicate-id`, `rubric-gap`, `rubric-accepts-invalid` | Whether the visual named on the segment matches the payload's figure (a checker never sees the visual; the pack gate checks it). The Pythagoras value is the long side `c`, while coincidence is judged on `a^2 + b^2`. |

### Decisions in the Solvability round

- **Coincident distractors block.** A choice that gives the right number is a real defect of the item, not a style point, and no existing
  fixture has one. If the owner prefers a review severity, the one-line change is in `proofChecker`.
- **No search, so no node budget issue.** The proof has at most five choices and seven figures; the stats report the choice count.
