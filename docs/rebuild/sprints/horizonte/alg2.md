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
  the one sentence that says why a line cannot be read (brackets, power, symbols, a misplaced decimal mark, two equals signs, too long). Check stays off
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
- **Decimals.** A point or a comma, once per number (see the Fix round at the end). Anything else gives `bad-number`, and the board says so in the learner's language.

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
- **Decimal comma.** Accepted since the Fix round (below).
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
- Decided in the Fix round: the editor accepts a decimal comma in every locale.
- Fix the `plano` entry in `harness/fixtureCoverage.test.tsx` (shared, so not changed in this lane).
- Accept and release the three pieces (F2.4, F2.5, F2.6) in the sprint record.

## Fix round

Scope: a decimal comma for es-MX and pt-BR learners, a safety review of the expression parser, and the dark-mode ink of the three boards. Core,
the browser copies and the Forge copies stay in step (`sync-v2-horizonte.mjs --check`, the capability parity gate and the Forge byte pin are green).

### What changed

- **Decimal comma, in the pure tokenizer.** A number is `digits`, or `digits` then one `.` or `,` then `digits`. The comma is turned into a
  point inside `expression.ts`, so the parse tree, the grader (`scorer.ts`) and the equivalence sampling only ever see the point. The browser
  copy and the Forge copy follow through the sync tool and the byte copy. `0,5x`, `1,25` and `1.5` read. `1,5,2`, `1,5.2`, `1.5,2`, `,5`,
  `5,`, `1, 5`, `2,x` and `x,5` are `bad-number`: a comma is never a list separator, and nothing else in the grammar uses it.
- **No injection path.** A comma never reaches the output as text. `toLatex` and `toSpoken` are built from the tree; the only comma they can write is
  the fixed `{,}` KaTeX token (LaTeX) or the locale mark in the spoken words, chosen by a two-value type (`DecimalMark`), never by learner text.
- **Locale-formatted readouts.** The notation and the spoken reading of the editor take the locale mark (pt-BR writes `0,5`, en-US and es-MX
  write `0.5`, following CLDR through `Intl`). Point labels on the graph read `(0,5; 1,5)` where the mark is a comma, so a pair never looks like
  one number. Slider values and the status line already used `Intl`.
- **Editor message.** The unreadable-number sentence now says to use one decimal mark per number, like `0.5` or `0,5` (es-MX: `0.5 o 0,5`,
  pt-BR: `0,5 ou 0.5`).
- **Forge.** The prompt-leak check reads `0,5` and `0.5` as the same numeral, so a prompt cannot hide the reference answer behind the other
  mark. The authoring guidance still tells the Forge to write a point in the given and the reference, and says the board also reads a comma.
- **Dark mode.** The boards drew their text with `--ink`, which is the same dark navy in both themes (`tokens.css`). The readout now uses
  `--content`, and the line-state outlines use `--edge` and `--content`, all of which flip under `data-theme="dark"`. The shared `Plano` and the
  shared controls already used the flipping tokens.

### Parser safety review (no change needed beyond the tests)

- No `eval`, no `Function`, no dynamic `import`, no `RegExp` built from or run over learner text. A test scans the engine source for them.
- The tokenizer walks character codes in one pass, so there is no backtracking. The 64 character check runs before tokenizing.
- The recursive-descent parser has a node budget (64) and a depth budget (12). Exact BigInt rationals are capped at 4096 bits, digits at 9,
  exponents at 0 to 6 and the polynomial degree at 12. A fuzz test and a time ceiling pin the bounds on adversarial text (long runs of
  brackets, commas, signs, carets and digits).
- The regular expressions left in `model.ts` run on author-written or short, bounded strings, are anchored and have no nested quantifiers.

### What is still limited

- **`1,000` is one, not a thousand.** In en-US the comma is also a thousands mark, so `1,000` reads as `1.000`, which is 1. Teaching material
  that writes thousands with a comma in en-US must write the number without it. Digit grouping is not accepted in any locale.
- **es-MX shows a point.** CLDR gives es-MX a point as the decimal mark, so the notation and the readouts show `0.5` there. The learner can still
  type `0,5`. If the owner wants a comma shown in es-MX, `decimalMarkOf` is the single place to change.
- **Sliders and steppers are not text inputs.** They take no typed number, so the editor is the only field that needed the comma.
- **Disabled Check and Reset contrast.** In dark mode the disabled buttons measure between 2.3 and 2.7 against the surface. They are the shared
  `Button`, so this lane did not change them.
- **The Forge still authors a point.** It does not write a comma in the given or the reference; it only accepts one.

### What is not verified

- No real browser, no screenshot, no screen reader and no dark-mode visual check. The dark-mode fix is a token swap that was audited in the CSS
  and in jsdom, and was not looked at.
- The new es-MX and pt-BR strings were written by the lane and have not been reviewed by a native speaker.
- The new tests: backend `alg2.test.ts` (46), frontend `alg2Boards.test.tsx` (32) and Forge `alg2.test.ts` (19) pass. No full suite, browser
  gate or build ran in this lane.

## Solvability round

`math.line-system.v2` now has a Forge solvability checker (`coursegen/src/v2/horizonte/solvability-plane.ts`, registered from
`solvabilityPacks.ts`). `math.function-graph.v2` and `math.expression-editor.v2` were already covered and are unchanged. Tests:
`solvability-plane.test.ts` (43, shared with the other two packs).

| Type | Proven | Stays unproven |
|---|---|---|
| `math.line-system.v2` | **Solvable and unique:** a scan of every point of the grid in the window, in doubled coordinates so a half step is exact, counts the points that lie on two or more lines; that count equals the number of markers, so there is one set of spots that is the answer. **Not already solved:** the markers do not start on the crossings (`impossible-state`). **No dead end:** every crossing is a point of the grid inside the window, so a marker can be put on it. **Budget:** one node per grid point of the window, `budget-exceeded` when the context budget is smaller. **Key:** exactly `{ required: [{ x, y }, ...] }`; a required spot that is not a crossing is `rubric-accepts-invalid`, a missing or a repeated crossing is `rubric-gap`, a key the start already meets is `impossible-state`. | the crossings themselves, see below; prompt wording; the window, grid and marker layout; the marker picker and steppers as a keyboard path |

**Findings the system checker can raise.** The pack's own payload reader refuses first, and its message is classed: two copies of a line
(`ambiguous-solution`), a crossing count that differs from the markers (`ambiguous-solution` when there are more crossings than markers,
`no-solution` when fewer), two markers on one spot (`overlap`), a marker, crossing or window edge off the grid or the window
(`out-of-bounds`), and any other refusal (`impossible-state`). The scan then raises `no-solution` or `ambiguous-solution` if it finds a
different number of crossings from the markers.

**What this does not prove.**
- The crossings are fixed by the lines, and the pack's reader already derives them exactly. The lattice scan confirms that count and that each
  crossing is on the grid; it is a second derivation, not an independent source of truth about what the board shows.
- Prompt wording and locale. The line-system checker does not read the segment's `prompt` (it is optional in the engine), so a prompt that
  names the wrong lines is not caught.
- Layout, label collisions at narrow widths, the 64 px hit size, contrast, motion and the screen reader: no browser was started.
- Timing: how long a learner takes to place several markers is not measured.
- The Oracle context schema is unchanged and the checker reads nothing about the child.
