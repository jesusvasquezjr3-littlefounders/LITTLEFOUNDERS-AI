# Lane doc: fin2 (F2.13 financial statement and cash flow, F2.14 decision grids, F2.15 schedule boards)

Three Horizonte Visual pieces built in all three layers on the golden-pack template. Every answer is an arrangement (F0.3), so all three
share one slot-board engine in the browser and one slot model in Core.
Procedure: [RECIPE.md](./RECIPE.md). Answer shapes: [F0.3-answer-shapes.md](./F0.3-answer-shapes.md). Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

Status: implemented and tested locally on branch `hz/fin2`. Not accepted, not released. See "Not verified" below.

| Item | F2.13 | F2.14 | F2.15 |
|---|---|---|---|
| Catalogue rows | N19 | N16, N17, N24, Q20, R08 | F14, O20 |
| Segment type | `money.cash-flow.v2` | `reasoning.decision-grid.v2` | `plan.schedule-board.v2` |
| Visuals | `statement-board` | `swot`, `eisenhower`, `two-by-two`, `decision-matrix`, `business-canvas` | `gantt`, `kanban`, `timeline` |
| Ages | 13 to 17 and adult (`{ ages: [13, 17], adult: true }`) | 12 to 17 and adult | 12 to 17 and adult |
| Copy Budget band | 13-17 | 13-17 (Eisenhower fixture also at 10-12) | 13-17 (timeline fixture also at 10-12) |
| ICAP level | Constructive | Constructive | Constructive |
| Answer shape | arrangement (F0.3 `arrangement`) | arrangement | arrangement |
| Response | `{ slots: { slotId: [pieceId] } }` | same | same |
| Private key | `{ solutions: SlotMap[] }`, 1 to 8 solutions | same | same |
| Capabilities | `visual.statement-board.v1`, `operation.drag-chips.v1`, `operation.tap-place.v1` | `visual.decision-grid.v1`, `operation.drag-chips.v1`, `operation.tap-place.v1` | `visual.schedule-board.v1`, `operation.drag-chips.v1`, `operation.tap-place.v1` |
| Chunk budget (declared) | 14 KB gzipped | 16 KB gzipped | 16 KB gzipped |
| Solvability checker (F0.4) | yes | yes | yes |

Segment types added: `money.cash-flow.v2`, `reasoning.decision-grid.v2`, `plan.schedule-board.v2`. They are registered through the pack stubs in
Core (`backend/src/services/horizonte/fin2/`), the browser (`frontend/.../horizonte/fin2/`) and the Forge (`coursegen/src/v2/horizonte/fin2.ts`).
The three `FIN2_CAPABILITIES` literals are identical (the per-pack parity gate passes).

## Behaviour

- **F2.13 statement board.** 5 to 12 items, each a named amount per month, are placed on five lines: earned, passive, expenses, assets and
  liabilities. A sixth zone holds one goal token, "goal met" or "goal short". The learner decides the verdict by placing the token. The goal is
  passive income greater than expenses, so equal totals are short of the goal. Assets and liabilities are values, never added to the monthly
  lines. The chart shows live totals of earned, passive and expenses.
- **F2.14 grid.** One board, five shapes. SWOT, Eisenhower and the business model canvas are authored sorts (the key is the author's
  placement). The two-by-two shows each idea at a point on two named axes and asks for its quadrant, so the key is computed from the points. The
  decision matrix shows scores and weights and asks the learner to rank the options, highest weighted total first, in `rank-1` to `rank-n`
  (capacity 1 each), so the key is computed from the scores. The matrix never prints the weighted totals.
- **F2.15 schedule.** A Gantt places each task on its start period under a deadline and optional worker limit (a task bar spans its duration). A
  timeline places tasks on steps (one task per step) under prerequisites and optional due steps. A kanban moves tasks that are not done between
  todo and doing under a work-in-progress limit; the board is the tasks that can start now in doing, the rest in todo. Gantt and timeline are graded by a rule
  (`scheduleMet`), so every schedule that keeps the order, the deadline and the workers is `met`; the kanban has one answer.
- **Equivalents.** Every drag has a keyboard alternative: pieces are chips with a "Move to" menu (tap-place), and the engine places by keyboard
  and pointer with the same function. Every chart has a "Show as table" toggle and a live text line. All handles are 64 px. Motion sits under
  `prefers-reduced-motion: no-preference`. Colours come from tokens and no colour is the only carrier of meaning (zones carry names).
- **No TeX, so no `spokenText`.** Amounts are localised currency text and totals are plain numbers, so the boards render no `MathExpression` and
  pass no `spokenText`. This is a deliberate deviation from the "spokenText for math" line of the piece brief: there is no math expression to speak.
  The chart `aria-label`, the live text line and the table carry the numbers for assistive technology instead.

## Scorer ladders

| Piece | `invalid` | `valid` | `review` | `met` |
|---|---|---|---|---|
| F2.13 | malformed payload, a piece off the board or over a slot capacity, a malformed key (not every item placed once, or a goal token that does not match its own totals) | nothing placed yet, and any well-formed placement when there is no rubric | placed, but not equal to a key solution (`miss`, `partial`, `false_alarm` from the arrangement ladder) | equals a key solution; score 100 |
| F2.14 | same, plus a key that contradicts a computed grid (two-by-two quadrant, matrix ranking) or leaves a piece out | same | same | equals a key solution |
| F2.15 | same, plus a Gantt or timeline key solution that does not meet the rules, or a kanban key that is not the one board | same | same | Gantt and timeline: with a rubric, the placement meets the rules (`scheduleMet`), whether or not it is in the key. Kanban: equals the key |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`; it never reports `met`.

## Model rules (the contract both gates and scorers share)

- **Statement.** Payload `{ items: [{ id, amount }] }`, 5 to 12 items, amount a whole number from 1 to 999999, ids unique and never `goal`,
  `goal-met` or `goal-short`. Labels name every item. Frame: pieces are the items plus the two goal tokens; slots are the five lines (capacity
  = item count) and `goal` (capacity 1).
- **Grid.** Pieces 4 to 16 (SWOT, Eisenhower), 5 to 16 (canvas), 4 to 12 (two-by-two), 2 to 5 (decision matrix). Two-by-two adds one point per
  piece, each value a whole number from 1 to 9 and never 5 (so no point sits on an axis). Decision matrix adds 2 to 4 criteria (weight 1 to 5) and a
  whole 1 to 5 score matrix; every weighted total must differ. Labels name every piece, every criterion and the six two-by-two axis names.
- **Schedule.** 3 to 10 tasks, each with at most 3 prerequisites that name other tasks, and no cycles. Gantt: a duration (1 to 4) on every
  task, 3 to 10 periods, optional 1 to 3 workers, no `due`, and the longest chain fits the deadline. Timeline: no durations; optional `due` steps
  no larger than the task count. Kanban: a `done` list (1 to n-2 tasks, closed under prerequisites), a limit of 1 to 4, at least one ready task
  and at least one blocked task, and ready tasks never exceed the limit.

## Files

Backend `backend/src/services/horizonte/fin2/`: `slots.ts` (frame, context and arrangement helpers), `statement.ts`, `matrix.ts`, `schedule.ts`
(the three models), `placement.ts` (pure place, move and remove used by the board), `contract.ts` (zod segment schemas), `capabilities.ts`,
`scorer.ts`, `fixtures.ts`, `index.ts`. Tests: `backend/src/__tests__/horizonte/fin2.test.ts` (21, runs `assertScorerContract`) and
`fin2Placement.test.ts` (8).

Browser `frontend/src/rebuild/learning/horizonte/fin2/`: generated `contract|slots|statement|matrix|schedule|placement|scorer|fixtures.generated.ts`,
`capabilities.ts`, `copy.ts` (en-US, es-MX, pt-BR, `data-copy-role` on every string), `slotBoard.tsx` and `slotBoard.css` (shared engine),
`StatementBoard.tsx|css`, `MatrixBoard.tsx|css`, `ScheduleBoard.tsx|css`, `boards.tsx` (three lazy chunks), `audit.json`, `index.ts`,
`Fin2Boards.test.tsx` (23, runs `assertBoardContract` on all 10 fixtures).

Forge `coursegen/src/v2/horizonte/fin2.ts` (capabilities, guidance, gate-4 `fin2Gates`, the three F0.4 checkers `cashFlowChecker`,
`decisionGridChecker`, `scheduleBoardChecker`); test `coursegen/src/__tests__/horizonte/fin2.test.ts` (27). `coursegen/src/v2/solvabilityPacks.ts`
imports the module so the checkers register.

Fixtures (10, segment id equals fixture id): `cash-flow-short`, `cash-flow-met`, `grid-swot-stand`, `grid-eisenhower-week`,
`grid-two-by-two-ideas`, `grid-decision-spot`, `grid-canvas-lemonade`, `plan-gantt-opening`, `plan-kanban-opening`, `plan-timeline-opening`.
Preview: `?screen=fixture&seg=hz:fin2:cash-flow-short&age=13-17`. `grid-eisenhower-week` and `plan-timeline-opening` use `age=10-12`; the others
use `age=13-17`. `audit.json` lists all 10 so the audit lane finds them.

## Forge gate 4 and solvability

- **Gate 4** (`fin2Gates`) checks, per segment of the three types: the visual fits the type; the age band (`13-17` and `adult` for the cash
  flow; `10-12`, `13-17` and `adult` for the grid and the schedule); the payload (strict, ties in a decision matrix refused); the labels; and,
  when a private key is held, the key shape (`{ solutions }` only, 1 to 8 solutions, slots and pieces inside the frame, no piece twice, capacity
  respected, at least one piece per solution) and the domain rule (statement goal token, computed grid equality, schedule rules or the kanban board).
  Messages are identical to Core's.
- **Statement checker.** There is nothing to search (the key is authored), so it proves the payload, the key shape and that the goal token
  matches the totals.
- **Grid checker.** The F0.4 segment carries no visual, so the checker infers it from the payload (points mean two-by-two, criteria and scores mean
  decision matrix) or from the key's slot names (SWOT, Eisenhower, canvas). Two-by-two and decision matrix run a search over the board's own
  arrangements and require the key to cover every solution (`rubric-gap`) and accept only solutions (`rubric-accepts-invalid`). A decision matrix
  with a tie therefore reports `ambiguous-solution` (no key) or `rubric-gap` in the checker, while gate 4 refuses the payload outright. Two-by-two
  points that coincide raise an `overlap` finding at `review` severity, not a block.
- **Schedule checker.** It first reports `duplicate-id` and `dangling-reference` on the prerequisites, then searches: a Gantt over start periods, a
  timeline over distinct steps in topological order, a kanban over todo and doing. Gantt and timeline are predicate-graded, so the search needs one
  solution (`no-solution` otherwise) and the key is checked against the rules. The kanban search accepts only the board with every ready task in
  Doing, and the key must equal it (`rubric-gap` or `rubric-accepts-invalid` otherwise).
- **Budget.** Every search passes `context.nodeBudget`; an exhausted budget is a `budget-exceeded` finding, never a pass.
- **Independent model.** Forge cannot import Core, so `fin2.ts` carries a compact hand-mirror of the three models. Its tests pin the same ten
  fixtures as the backend, so a bug in one copy cannot hide in the other.

## Decisions

- **One slot-board engine.** The three boards share `slotBoard.tsx` (tray, zones, chips, "Move to" menu, table toggle) and differ only in their
  chart and zone layout, which keeps each lazy chunk small and the behaviour identical across pieces.
- **Goal as a token.** The statement's verdict is a placed token, not a button, so the answer stays an arrangement and the learner cannot get
  the verdict without doing the sort.
- **Rule-graded schedules.** A Gantt or timeline has many valid answers. Rather than enumerate them in the key (up to 8), the scorer grades by
  predicate and the key lists examples that the gates check against the same predicate.
- **Ties refused.** A decision matrix with equal weighted totals has no single ranking; gate 4 refuses it and the checker names it.
- **Points never on an axis.** Two-by-two coordinates are 1 to 9 and never 5, so the quadrant is never ambiguous.
- **Age.** Cash flow starts at 13 (money vocabulary of income and liabilities). The grid and the schedule start at 12, so a 10-12 lesson of them
  needs an eligibility of 12; two fixtures exercise that band. The Forge document carries the band only, so the gate checks bands.
- **Type ids and capabilities** are the three above, in parity across Core, the browser and the Forge.
- **Copy.** Every string carries `data-copy-role`; es-MX and pt-BR are written natively and money uses `Intl.NumberFormat` (USD, MXN, BRL).

## Not verified

- No real-browser or visual check: no screenshot, no Playwright, no dev server. The 64 px handles, the SVG layout, the table toggle and reduced
  motion are enforced by the board harness in jsdom, which cannot measure layout.
- Chunk budgets (14, 16, 16 KB gzipped) are declared, not measured: no build was run.
- The full gates did not run (`test:all`, `tools:test`, `verify:*`, `audit:*`, `spec:check`). Only focused tests, the parity, sync and copy
  checks, and one type-check per service ran.
- The audit lane has not run over `audit.json`; the fixtures were not rendered by it.
- Native review of the es-MX and pt-BR copy by a person has not happened.

## Limits

- Money is shown as whole units in the learner's locale currency (USD, MXN, BRL) with no decimals; amounts are whole numbers from 1 to 999999.
- The grid caps at 16 pieces (12 for the two-by-two, 5 options for the decision matrix) and the schedule at 10 tasks, so every search finishes in
  the default node budget; a larger instance is refused by the payload rules.
- The kanban start state is fixed by the payload (the `done` list); the learner moves the rest. The key is always the one valid board.
- The solvability checker infers the visual because the F0.4 segment has none. A SWOT, Eisenhower or canvas grid without a key is proven by
  the payload alone.
- A canvas has nine fixed blocks and the SWOT and Eisenhower four; custom block names are not supported.

## Owner follow-ups

- Run the audit lane over `fin2/audit.json` and review the ten fixtures in a real browser at 13-17 and 10-12.
- Measure the three chunk sizes against the declared budgets at the first build.
- Have a native reader review the es-MX and pt-BR copy.
- Decide whether the 10-12 band should open for the grid and the schedule in lessons (the pieces allow it from age 12).
- Accept the pieces in `REQUIREMENTS.md` only after the browser pass; this lane records implementation only.
