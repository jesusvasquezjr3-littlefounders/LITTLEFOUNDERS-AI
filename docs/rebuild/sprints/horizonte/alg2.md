# Lane doc: alg2 (F2.4 function with sliders and transformations, F2.5 systems of equations on a graph, F2.6 equation editor with an equivalence checker)

Three boards, one pack, all grading on the server against a private key. Procedure: [RECIPE.md](./RECIPE.md). Pattern copied from
[plane1.md](./plane1.md) and [alg1.md](./alg1.md). F2.4 and F2.5 reuse the two answer shapes that already exist (`curve.parameters` and
`points.set`). F2.6 needs a shape that does not exist yet, so this lane adds one: `expression`.

| Item | Value |
|---|---|
| Catalogue rows | D14, D27, D12 and T01 (function with sliders, transformations, exponential growth), D19 (systems of equations), D42, D43, D04 and D05 (equation editor: expand, factor, solve) |
| Pieces | F2.4 (function graph), F2.5 (line system), F2.6 (expression editor) |
| Segment types | `math.function-graph.v2` (F2.4), `math.line-system.v2` (F2.5), `math.expression-editor.v2` (F2.6) |
| Visuals | `function-graph`, `line-system`, `expression-editor` |
| Ages | function graph `{ ages: [12, 17], adult: false }`; line system `{ ages: [13, 17], adult: false }`; expression editor `{ ages: [13, 17], adult: true }` |
| ICAP level | Constructive, all three |
| Answer shapes | `curve.parameters` (graph), `points.set` (system), `expression` (editor, new, lives in the alg2 scorer) |
| Rendering | the shared Plano (SVG) for the two graph boards, native range inputs and steppers, KaTeX for the editor lazily through `MathExpression` (not in the board chunk); no chart library, no randomness |
| Chunk budgets | 14 KB, 14 KB and 16 KB (gzipped, declared, not measured) |
| Capabilities | graph `visual.function-graph.v1`, `operation.parameter-slider.v1`, `operation.show-table.v1`; system `visual.line-system.v1`, `operation.drag-point.v1`, `operation.move-menu.v1`, `operation.show-table.v1`; editor `visual.expression-editor.v1`, `operation.type-expression.v1`, `operation.step-check.v1` |

## Behaviour and answer shapes

Every payload is public and carries no answer. The key lives only in Core. Each type has one payload reader and one solvability check
(`readGraphPayload`, `readSystemPayload`, `expressionTaskProblem`) that the contract refine, the scorer and the Forge gate share, so a
segment with no reachable answer does not parse.

| Type | Payload | The learner | Answer sent | Key (private) |
|---|---|---|---|---|
| `math.function-graph.v2` | `{ curve, form?, start, sliders, window, marks? }` | moves the sliders of a line (m, b), a parabola (a, b, c, or a, h, k in vertex form) or an exponential (a, b) until the curve passes through the marks | `{ family, params }` | `{ family, target }` |
| `math.line-system.v2` | `{ lines, window, grid, start }` | moves one marker per crossing of two or three lines onto the crossings | `{ points }` | `{ required: [crossings] }` |
| `math.expression-editor.v2` | `{ task, given, form, variable }` | types a chain of lines, one step each, from the given to the finished form | `{ steps: string[] }` | `{ reference }` |

- **Function graph.** The plane draws the curve and the marks, and one slider per parameter moves it. Marks are whole points at different
  x: at least two for a line or an exponential, at least three for a parabola, or none (then the prompt writes the target values in digits).
  Vertex form is shown as `a (x - h)^2 + k` but sent as the standard parameters, so one key serves both forms. The `a` slider of a vertex form
  skips 0, and an exponential's base slider stays above 0. A slider has at most 400 steps. Every slider has a keyboard path through the native
  range input, and a table of points sits under the Plano toggle.
- **Line system.** The window edges sit on grid lines (the grid is anchored at 0), and every crossing lies inside the window, on the grid.
  There is one marker per crossing. The pointer drag, a segmented marker picker and two steppers (x and y) are the keyboard path, with a
  table of the lines and the markers as the text equivalent.
- **Expression editor.** Up to 8 lines; each line is parsed and compared with the line above. The board draws the notation under every line
  that reads (KaTeX, spoken in words through `MathExpression`) and writes "same value as the line above" or "not the same" beside it, or
  the one sentence that says why a line cannot be read (brackets, power, symbols, decimal comma, two equals signs, too long). Check stays off
  until every non-blank line reads. The board submits the non-blank trimmed lines, never the given.

## The expression shape and the engine

The `expression` shape lives in the alg2 scorer (`alg2/expression.ts`), not in the shared `v2AnswerShapes.ts`. It has a response
`{ steps: string[] }` and a rubric `{ reference }`.

- **No evaluation of learner text.** There is no `eval`, no `Function`, no regular expression over learner text and no property lookup by a
  learner-chosen name. A hand-written tokenizer and parser build a tree; everything after that works on the tree.
- **Hard bounds.** 64 characters, 64 nodes, depth 12, 9 digits per number, exponents 0 to 6 on a single `^`, degree 12, 4096 bits in a
  rational, at most 8 lines. Anything beyond a bound is a named error (`too-long`, `too-complex`, `bad-exponent`, `bad-number` ...), never a
  crash and never a hang.
- **Equivalence by exact sampling.** Two expressions are compared at 33 deterministic sample points with exact rationals (BigInt, no
  floats). For polynomials of degree 12 or less that is a proof. The check is domain-sensitive: a point where one side is undefined and the
  other is defined means "not equal", so `x/x` is not `1`. It returns null (undecidable, treated as not the same) when fewer than 8 points are
  defined on both sides or when a value grows past the bit bound.
- **Equations.** Two equations are equivalent when their left-minus-right differences are proportional by a nonzero constant, so `3x = 15`
  and `x = 5` are the same equation and `x = 5` and `x = 6` are not.
- **Finished form.** `satisfiesForm` checks the structure of the last line: expanded (no brackets left, like terms combined), factored (a
  product of brackets with no further expansion), isolated (the variable alone on one side, the other side free of it), separated (the
  variable terms on one side, a plain number on the other).
- **Notation.** `toLatex` and `toSpoken` are built only from the parsed tree, never from the learner's text, so an unreadable line draws
  nothing. Spoken words come from the pack copy in all three locales.
- **Decimals.** The decimal separator is a point. A comma gives `bad-number`, and the board says so in the learner's language.

## Scorer ladder

| Verdict | Graph and system | Expression |
|---|---|---|
| `invalid` | malformed response or extra fields, a family other than the payload's, parameters off the sliders, a point off the grid or the window, a duplicate marker, or a malformed key, or a key the start already meets | malformed response, more than 8 lines, a line that does not parse as the task's kind, or a malformed key |
| `valid` | the untouched start (and, without a rubric as in the browser, any well-formed response) | the given alone as the only line, and any well-formed response without a rubric |
| `review` | moved but not the key; score 0, the diagnostic the answer shape reports (`curve.parameters` or `points.set`) | the chain breaks: `value` when a line is not the same as the one above and the last line is wrong, `structure` when the last line is right all the same, `partial` when every line follows but the last is not finished |
| `met` | the key; score 100, diagnostic `none` | every line follows from the one above and the last line is the finished form |

Scorers are pure, total and deterministic. The browser has no rubric, so its generated scorer says only `valid` or `invalid`; Core does the
`met` and `review` grading.

## Files

Backend `backend/src/services/horizonte/alg2/`: `model.ts` (exact decimals, curve families, graph and system payloads), `expression.ts` (the
bounded engine), `contract.ts`, `scorer.ts`, `fixtures.ts`, `capabilities.ts`, `index.ts`. Test: `backend/src/__tests__/horizonte/alg2.test.ts`
(43 tests).

Browser `frontend/src/rebuild/learning/horizonte/alg2/`: generated `contract|model|expression|scorer|fixtures.generated.ts` (never
hand-edited, from `node agent/tools/sync-v2-horizonte.mjs`), `capabilities.ts`, `copy.ts`, `shared.ts`, `boards.tsx`,
`FunctionGraphBoard.tsx`, `LineSystemBoard.tsx`, `ExpressionEditorBoard.tsx`, `alg2.css`, `audit.json`, `alg2Boards.test.tsx` (25 tests).

Forge `coursegen/src/v2/horizonte/alg2.ts` (capabilities, authoring guidance, gate-4 solvability checks), with `alg2Model.ts` and
`alg2Expression.ts`, which are byte copies of the backend `model.ts` and `expression.ts`; test `coursegen/src/__tests__/horizonte/alg2.test.ts`
(17 tests, including a byte pin of both copies against the backend files).

Fixtures (11): `graph-line-two-dots` (10-12), `graph-parabola-vertex`, `graph-parabola-standard`, `graph-growth-curve`,
`system-cross-two-lines`, `system-half-grid`, `system-triangle`, `expression-expand-product`, `expression-factor-trinomial`,
`expression-solve-isolate`, `expression-solve-separate` (the others 13-17). Preview:
`?screen=fixture&seg=hz:alg2:<fixture>&age=<band>`.

## Forge gate 4 (solvability)

Authoring guidance is written for the used types only. The gate rejects a wrong visual type or a missing payload, then checks the payload
with the same reader Core uses, and, when it holds the key for the segment, that the key is one answer the payload allows.

- **Graph.** The key is exactly `{ family, target }` with no tolerance. The family matches, the target is on the sliders (inside each range, on
  a step), every mark lies exactly on the target, a quadratic or exponential `a` is not 0, an exponential base is above 0 and not 1, and the
  curve starts away from the target. With no marks the prompt must write every nonzero target value in digits.
- **System.** One marker per crossing, markers start away from the crossings, the key is exactly the crossings, and each crossing lies on two
  of the lines.
- **Expression.** The task parses as the right kind and is not already finished, the key is `{ reference }`, the reference is equal in value to
  the given and has the finished form, and the prompt does not write the reference.

## Decisions

- **New shape in the lane, not in the shared registry.** `expression` is private to alg2 until a second pack needs it. Promoting it to
  `v2AnswerShapes.ts` is a shared change and an owner decision (see follow-ups).
- **Sampling, not symbolic algebra.** Exact-rational sampling is small enough to bound and test, is a proof for the polynomial tasks the board
  teaches, and fails closed (null) when it cannot decide. A computer algebra system would be a much larger surface for a learner-typed string.
- **Domain-sensitive equality.** `x/x` is not `1`. That is the honest answer for "same value", and it keeps a learner from cancelling a
  variable factor and being told the line still holds.
- **Forge copies, pinned.** plane1 hand-mirrors its checks. Here the model and the engine are large, so Forge holds byte copies and a test
  compares them with the backend files (after CRLF to LF). A drift fails the test instead of passing silently.
- **Keys are exact.** Forge writes `{ family, target }` and nothing else. Core supports tolerances, `by` and curve comparison, but Forge does
  not author them.
- **Marks pin the curve.** Two marks pin a line or an exponential, three pin a parabola, so a learner cannot meet the key with a different
  curve. With no marks the prompt names the numbers, which makes the board a "set these values" task rather than a "find the curve" task.
- **Vertex form is sent as standard parameters.** One key, one comparison, no second family.
- **One marker per crossing.** The system board never asks the learner to guess how many crossings there are. The marker count is part of
  the payload, and the key has the same count.
- **Browser scoring is advisory.** The generated scorer never says `met` (no rubric in the browser). The board only reads and compares; Core
  holds the finished-form key.
- **Ages.** Graph 12-17, system 13-17, editor 13-17 plus adults. `graph-line-two-dots` is the one fixture in the 10-12 band (eligibility
  age 12): a line, two marks and two sliders, so it is the gentlest entry to the board.
- **Motion.** None of its own. Plano's motion is already inside `prefers-reduced-motion: no-preference`.
- **Math for the ear.** Notation goes through `MathExpression` with a spoken text built from the parsed tree and the pack's words.

## Status

Implementation: complete in all layers (Core pack, browser copies, boards, Forge, lane doc). Local verification: Core pack test (43), frontend
board contract and interaction tests (25, all three locales and the board contract for every board), Forge test (17), type-check of backend,
coursegen and frontend, the capability parity gate, the copy gate and the sync check. Acceptance and release: not done; they belong to the owner
and the coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement, no screen reader. Everything above was reasoned from the code and jsdom,
not looked at.

## Known issues and limits

- **No visual or screen-reader verification.** Curve and marker layout, label collisions at narrow widths, the 64 px hit size, the contrast of
  the chosen tokens and the spoken math have not been seen or heard.
- **Chunk sizes are not measured.** The budgets (14, 14 and 16 KB gzipped) are declared in the contract metadata. A build with a size report
  has to confirm them.
- **Decimal comma is not accepted.** A pt-BR or es-MX learner who types `0,5x` gets a message that says to use a point. Accepting the comma
  needs a locale-aware parser and a decision about `1,5` against a list separator.
- **One variable, bounded grammar.** One lowercase letter, whole exponents 0 to 6, the operators `+ - * / ^` and brackets, at most 64
  characters and 8 lines. Functions (`sqrt`, `sin`), roots, inequalities and systems typed in the editor are out of scope.
- **Undecidable is not the same.** When fewer than 8 sample points are defined on both sides, the board says "not the same". That is safe, but
  a rational expression with a very small domain can be rejected although it is equal.
- **Forge writes less than Core reads.** Tolerances, `by: curve` and `by: either` exist in Core and are not authored by Forge.
- **Test noise.** The expression board tests print React `act` warnings from the lazily loaded `MathExpression`; they do not fail.
- **Pre-existing, outside this lane.** `harness/fixtureCoverage.test.tsx` fails on the integration branch for the `plano` primitive folder
  (`plano: fixtures.ts registers plano`, then `HORIZONTE_FIXTURES[pack] is not iterable`). alg2 passes when the suite is filtered to it.

## Owner follow-ups

- Look at all eleven fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off,
  and listen to the equations with a screen reader.
- Build the frontend with a size report and compare the three chunks with their budgets.
- Have a native speaker review the es-MX and pt-BR strings (they are native-written, not machine copies, but not reviewed).
- Decide whether the `expression` shape is promoted to the shared answer-shape registry.
- Decide whether the editor accepts a decimal comma in es-MX and pt-BR.
- Fix the `plano` entry in `harness/fixtureCoverage.test.tsx` (shared, so not changed in this lane).
- Accept and release the three pieces (F2.4, F2.5, F2.6) in the sprint record.
