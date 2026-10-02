# Lane doc: fin1 (F1.10 compound interest, F2.11 time value and annuities, F2.12 effective rate, credit card, NPV and IRR)

Three finance pieces of the Horizonte Visual, built in all three layers on the golden-pack template.
Procedure: [RECIPE.md](./RECIPE.md). Answer shapes: [F0.3-answer-shapes.md](./F0.3-answer-shapes.md). Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

| Item | F1.10 | F2.11 | F2.12 |
|---|---|---|---|
| Segment type | `money.compound-interest.v2` | `money.time-value.v2` | `money.rate-return.v2` |
| Visuals | `compound-interest` | `time-value` | `effective-rate`, `card-payoff`, `cash-flow` |
| Ages | 10 to 17 and adult (`{ ages: [10, 17], adult: true }`) | 14 to 17 and adult | 15 to 17 and adult |
| Copy Budget band | 10-12 | 13-17 | 13-17 |
| ICAP level | Constructive | Constructive | Constructive |
| Answer shape | prediction option, two slider integers, an explanation id | an arrangement on a timeline (F0.3 `arrangement`) plus a typed number (F0.3 `number.tolerance`) | a typed number (F0.3 `number.tolerance`) |
| Response | `{ predict, rate, years, explain? }` | `{ slots, value? }` | `{ value, final? }` |
| Private key | `{ predictOption, explainId }` | `{ solutions, tolerance, review? }` | `{ target, tolerance?, review? }` |
| Capabilities | `visual.compound-growth.v1`, `operation.predict-option.v1`, `operation.slide-rate-years.v1`, `operation.explain-pick.v1` | `visual.timeline.v1`, `operation.drag-chips.v1`, `operation.type-number.v1` | `visual.rate-case.v1`, `operation.scrub-case.v1`, `operation.type-number.v1` |
| Chunk budget (declared) | 14 KB gzipped | 16 KB gzipped | 18 KB gzipped |
| Solvability checker (F0.4) | yes | yes | none: a typed number has no search to prove, gate 4 holds the model answer |

## Behaviour

- **F1.10 predict, slide, reveal.** The learner picks the predicted value of one deposit (3 to 5 options) before anything moves. The rate
  and years sliders are disabled until a prediction is made, start at their minimum and are 64 px handles with a keyboard step alternative.
  The board draws two curves (compound and simple interest), a live value line, and a public challenge ("reach X within N years"). The
  last step asks why the curve bends (an explanation pick). A Reveal button (enabled after a prediction) opens the real figure, moves the sliders to the fixed case and states whether the prediction was near, so the reveal always follows a commitment.
- **F2.11 timeline.** Order tasks place 2 to 5 payments with different amounts on yearly slots (receive: worth the most today; pay: cost the
  least at the end). Annuity tasks place 2 to 5 equal payments at the end or at the start of each year. Each payment shows the measure the task
  does NOT ask for, so the typed answer is always one step away from what is on the board. After placing, the learner types the worth.
- **F2.12 four cases.** `effective` (nominal rate and compounding periods; a dial of periods), `card` (balance, APR, minimum percent, floor;
  a month scrubber, answer is months or total interest), `npv` (a rate dial; the net value is never shown), `irr` (a rate dial in tenths of a
  percent; the net value is never shown). The learner types the figure and, for the scrubbing cases, can also read it off the scrubber.
- **Equivalents.** Every drag has a keyboard alternative (chips plus a "Move to" menu, sliders with step buttons), every chart has a "Show as
  table" toggle and a live text line, and the amounts and rates in aria labels use `spokenMoney` and `spokenPercent` (words, not symbols).
- **Neutral board and tokens.** The boards use design tokens only, no colour is the sole carrier of meaning, and CSS motion sits under
  `prefers-reduced-motion: no-preference` and lasts at most 250 ms.

## Scorer ladders

| Piece | `invalid` | `valid` | `review` | `met` |
|---|---|---|---|---|
| F1.10 | malformed response, unknown option or explanation id, slider out of 1-12 percent or 1-40 years, malformed key or payload | no `explain` yet (still exploring), and any well-formed response without a rubric | with `explain`: one part wrong is `miss`, two `partial`, three `value` | prediction is the option nearest the true value, the sliders reach the challenge, and the explanation is `interest-on-interest`; score 100 |
| F2.11 | unknown slot or piece, a payment on a bad year, a key solution that is not sound, a malformed tolerance | placed and well formed, no rubric | arrangement wrong (`miss`, `partial`, `false_alarm`) or number outside tolerance (`tolerance`, `value`); both wrong is `value` | best arrangement and the number within tolerance; score 100 |
| F2.12 | not a plain decimal, outside the case's range, a key whose target is not the model answer | well formed, no rubric | outside tolerance but inside the review band (`tolerance`), or far (`value`) | within tolerance; score 100 |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Maths contract

- **Money is integer cents; rates are whole basis points** (F1.10 sliders are whole percents). Every figure is exact (BigInt in Forge, exact
  rational arithmetic in the model) and is rounded half up once, at the end, never per step.
- **Compound value** is `principal * (1 + r)^n`, from the closed form, so 30 years at 7% on $1,000 is exactly 7,612.26.
- **Time value** moves each dated payment by `(1 + r)^(target year - payment year)` in one exact sum. Annuity end is years 1 to n, annuity
  start is years 0 to n-1; the "future" worth is read at the horizon (n).
- **Effective rate** is `(1 + nominal / m)^m - 1`, rounded to the basis point.
- **Credit card** schedule: monthly charge = balance x APR / 12, payment = max(charge + minimum percent x balance, floor) capped at what is
  owed, at most 600 months; the case is refused when it does not clear in 600 months.
- **NPV** is the exact discounted sum minus the outlay at a whole-basis-point rate. **IRR** is found by exact bisection on half basis points
  and rounded half up to the basis point; it needs inflows that beat the outlay and a break-even rate below 100 percent.
- `$` is a generic currency sign: no real currency is implied.

Golden values (pinned in the backend, browser and Forge tests):

| Case | Value |
|---|---|
| `compound-thirty` ($1,000, 7%, 30 years) | 7,612.26 |
| `receive-three` (6%, receive 1,000 / 2,000 / 3,000, best order) | worth today 5,449.80 |
| `pay-four` (8%, pay 1,500 / 500 / 1,000 / 2,000, best order) | worth at year 4 5,416.26 |
| `annuity-end` (6%, 1,000 x 3 at year ends) | worth today 2,673.01 |
| `annuity-start` (6%, 1,000 x 3 at year starts) | worth at year 3 3,374.62 |
| `effective-monthly` (24% nominal, monthly) | 26.82 percent |
| `card-months` ($2,000, 18%, 1% and $25 floor) | 131 months |
| `card-interest` ($5,000, 24%, 1% and $25 floor) | 8,886.94 interest |
| `npv-project` (10%, outlay 10,000, flows 4,000 / 5,000 / 6,000) | 2,276.48 |
| `irr-project` (same flows) | 21.65 percent |

## Files

Backend `backend/src/services/horizonte/fin1/`: `model.ts`, `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test:
`backend/src/__tests__/horizonte/fin1.test.ts` (golden values, ladders, malformed input, rubric soundness, harness).

Browser `frontend/src/rebuild/learning/horizonte/fin1/`: generated `contract|model|scorer|fixtures.generated.ts`, `capabilities.ts`, `format.ts`
(`money`, `percent`, `spokenMoney`, `spokenPercent`, chart helpers), `copy.ts`, `boards.tsx`, `CompoundBoard.tsx`, `TimeValueBoard.tsx`,
`RateBoard.tsx`, `Fin1Boards.css`, `audit.json`, `index.ts`, `Fin1Boards.test.tsx` (21 board-harness tests).

Forge `coursegen/src/v2/horizonte/fin1.ts` (capabilities, authoring guidance, gate-4 `fin1Gates`, the F0.4 `compoundChecker` and
`timeValueChecker`); test `coursegen/src/__tests__/horizonte/fin1.test.ts` (25 tests). `coursegen/src/v2/solvabilityPacks.ts` imports the module so
its checkers register.

Fixtures (10): `compound-thirty`, `receive-three`, `pay-four`, `annuity-end`, `annuity-start`, `effective-monthly`, `card-months`,
`card-interest`, `npv-project`, `irr-project`. Preview: `?screen=fixture&seg=hz:fin1:compound-thirty&age=10-12` (the others use `age=13-17`).

## Forge gate 4 and solvability

- **F1.10.** One option is strictly nearest the true value (a tie is refused); some slider position reaches the challenge and the
  fixed case does not already reach it; the key is exactly `{ predictOption, explainId }` with the nearest option and `interest-on-interest`.
  The solvability checker also warns (review) when more than 60 percent of the 12 x 40 slider positions meet the challenge, since it then tests nothing.
- **F2.11.** Amounts differ (one best order); the listed order is not already the best; the key lists the best arrangement only, with a well-formed
  tolerance and a review band that is not narrower. The checker searches every permutation inside the node budget and names a
  `budget-exceeded` finding rather than passing an unproven board.
- **F2.12.** The compounding must change the rate by at least one basis point after rounding; the card must clear within 600 months; the IRR must
  exist below 100 percent; the key target must equal the model answer; an IRR tolerance is at least 0.1 (the dial moves in tenths).
- **Independent model.** Forge cannot import Core, so `fin1.ts` carries a compact BigInt copy of the maths, pinned to the same golden values in the
  Forge test, so a bug in one copy cannot hide in the other.

## Decisions

- **Rounding.** Half up, once per figure, at the end (see Maths contract). Per-step rounding is never used.
- **The prediction counts toward `met`** (F1.10): a wrong part maps to review with `miss`, `partial` or `value`, so the learner is never marked
  met on a lucky slider alone.
- **Draft states.** F1.10 submits as a draft until `explain` is set; F2.11 until the number is typed; F2.12 is final when the learner marks it.
  A draft is `valid` (browser) and is never scored `met` there.
- **F2.11 shows the other measure.** Each payment shows the measure the task does not ask for (future worth when asking for the present worth, and
  the reverse), so the typed answer is one step away, not copied from the board.
- **F2.12 ranges.** Effective: dial of periods 1, 2, 4, 12, 52, 365. Card: months 0 to 600. NPV: rate dial 0 to 30 percent, step 50, 10 or 1 basis points
  by the task's own rate. IRR: dial in tenths 0 to 100 percent. NPV and IRR never show the net value, only the cash flows.
- **Scrubbing boards reveal the answer at the slider end** (effective, card). This is the intended trade-off: the learner still has to read it and
  type it, and the typed value is what is graded.
- **F1.10 sliders start at the minimum and stay disabled until a prediction is made**, so the prediction cannot be copied from the curve.
- **NPV and IRR prompts do not list the flows**; the board shows them, which keeps every prompt within the Copy Budget.
- **Type ids** are `money.compound-interest.v2`, `money.time-value.v2`, `money.rate-return.v2` and are registered through the pack stubs in
  Core, the browser and the Forge; the three capability literals are identical in all three copies (parity gate).
- **Solvability registration** is for F1.10 and F2.11 only; F2.12 is a typed number and its soundness is the gate-4 model check.
- **Copy.** Every string carries `data-copy-role`; es-MX and pt-BR are written natively (pt-BR groups thousands with a point, so `$1.000`), and prompts stay
  under the band's word limit (20 words en-US, 25 es-MX and pt-BR outside bands 6-9).
- **Accessibility text.** Amounts and rates in aria labels are spoken forms ("7,612 dollars and 26 cents", "26.82 percent"), never symbols.

## Known issues

- Hit size is declared and enforced in CSS but jsdom cannot measure layout; a real-browser check of the 64 px handles belongs to the
  coordinator's audit pass.
- The finance pieces teach the standard formulas with a generic `$`; they are not financial advice and name no product, bank or real card.
- Chunk budgets (14, 16, 18 KB gzipped) are declared, not measured here: no build was run in this lane.
