# Lane doc: sim2 (F3.3 live a year or twenty with compressed time)

One simulation board of the Horizonte Visual, built in all three layers on the seeded run protocol of [sim1.md](./sim1.md). Procedure:
[RECIPE.md](./RECIPE.md). Solvability follows [F0.4-solvability.md](./F0.4-solvability.md).

| Item | Value |
|---|---|
| Catalogue rows | N24 (a portfolio over time, a Monte Carlo of futures), N25 (retirement spending), N30 and H30 (insurance and expected value) |
| Piece | F3.3 |
| Segment type | `money.life-sim.v2` |
| Visual | `life-sim` |
| Capability literal | `visual.life-sim.v1`, `operation.seeded-run.v1`, `operation.parameter-slider.v1`, `operation.show-table.v1` |
| Ages | `{ ages: [13, 17], adult: true }` |
| Copy Budget band | 13-17 |
| ICAP level | Active |
| Rendering | in-house SVG (two fans at most), native range input and buttons; no chart library. The only randomness is the seeded generator |
| Chunk budget | 16 KB (gzipped, declared, not measured) |
| Answer shape | server seed: `{ seed, choice }` |
| Private key | `{ target: { answers: number[] } }` |

## Behaviour

The learner lives one of four scenarios for 2 to 5 chapters (a chapter is 1 to 4 years, so a run is 4 to 20 years) and sees 100 seeded
futures at once. One slider walks over 3 to 8 choices; the same 100 futures are replayed under each choice, so moving the slider changes
only what the choice does, never the luck. A future is drawn green when it ends at or above the target with its cash never below the floor,
and dashed berry otherwise. The status line says how many of 100 succeed and how many are needed.

| Scenario | The choice | One chapter | Answer rule |
|---|---|---|---|
| `portfolio` | percent of savings held in stocks | stocks earn the outcome return, the rest grows 10 percent; the chapter's saving is added first | the highest reliable choice |
| `retirement` | whole amount spent each chapter | what is left after spending earns the outcome return (a mixed fund) | the highest reliable choice |
| `insurance` | percent of the cost that is covered | pay 20 per covered point, bear the rest of the outcome's cost | the lowest reliable choice |
| `life` | percent of pay sent to debt | the rest of the pay goes to cash less the outcome's cost; a shortfall is borrowed; cash earns 2 percent and debt costs 25 percent | every reliable choice |

Each chapter one of 8 equally likely outcomes happens (`prng.below(8)`), drawn per future and chapter from the attempt seed. The same draws
are used for every choice (common random numbers). The 8 outcomes of every scenario are public and listed in a table: a return in percent
(portfolio, retirement) or a cost in money (insurance, life). Money is whole units of the generic `$`; every step truncates toward zero.

The `life` board draws two charts: the worth (cash less debt) against the target, and the cash against the floor, because the floor rule
is about cash while the target is about worth. The other scenarios have one chart, where worth and cash are the same number.

Equivalents: the slider is a native range input with Less and More buttons (there is no drag); a status line states the count in words; a
show-as-table toggle opens the choice, the eight outcomes and a scrollable table of all 100 futures (final worth, lowest balance, succeeds).
Money in aria labels is written out in words (`spokenMoney`). The y axis is the same for every choice and clips the highest 5 percent of values
at the top, so the fan does not jump. Tokens only, no celebration inside the board, motion only a stroke transition under
`prefers-reduced-motion: no-preference` at the component duration.

## Scorer ladder

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields; a seed that is not this attempt's; a choice that is not offered; a rubric whose answers are not the exact computed answer set; a payload with no clean answer; a rubric with no attempt |
| `valid` | the start choice untouched; without a rubric (the browser, advisory) any well-formed response |
| `review` | a changed choice that is not an answer, or an answer that the seeded 100 futures do not carry to the goal; diagnostic `value` |
| `met` | the choice is in the answer set and the seeded 100 futures succeed at least `goal` times, exactly as the board counts them; score 100 |

The browser has no rubric, so its generated scorer can say only `valid` or `invalid`. Core's `horizonteGrade` returns null for `invalid` and
`valid`, so an untouched start cannot be sent.

Exact math. Every verdict is an integer comparison; the dynamics are integer-only. The only floats are in the reliability dynamic program
`reachChance` (additions and products only, so it is identical on every machine) and in the drawing aids of the board.

## Solvability (F0.4, gate 4)

`analyse(payload)` enumerates all 8^T histories for every choice (at most 32768 each) and counts the successful ones (`waysOf`, exact). With
`q = ways / 8^T`, `reachChance` is the probability that 100 independent futures succeed at least `goal` times (an exact binomial tail).

- A choice is **reliable** when that probability is at least `1 - 1e-5`. It is a clear **miss** when it is at most `1e-4`.
- The answers are the reliable choices under the scenario rule above. Any choice that is neither reliable nor a clear miss is a payload
  problem ("reaches the goal by luck"), because the replay could then flip a verdict on some seeds. So is a payload with no answer, and
  a start choice that is already an answer.
- A key is `invalid` unless it is exactly the computed answer set. An answer is `met` only when the replayed futures also reach the goal; this
  is guaranteed with chance `1 - 1e-5` per seed by the rule above, and the tests check an answer under eight other seeds.

The same checks run in three places: the contract (a payload that does not solve does not parse), the scorer (a key that is not the answer set
is `invalid`), and Forge gate 4 (`coursegen/src/v2/horizonte/sim2.ts`, hand-mirrored from Core and reported as a `GateProblem`; a prompt that does
not write the goal in digits, for example "90 of 100 futures", is also refused).

## Files

Backend `backend/src/services/horizonte/sim2/`: `model.ts` (dynamics, futures, exact solution, payload rules), `contract.ts`, `scorer.ts`,
`fixtures.ts`, `capabilities.ts`, `index.ts`. Test `backend/src/__tests__/horizonte/sim2.test.ts` (17).

Browser `frontend/src/rebuild/learning/horizonte/sim2/`: generated `{contract,model,scorer,fixtures}.generated.ts` (never hand-edited),
`capabilities.ts`, `copy.ts`, `boards.tsx`, `format.ts`, `LifeSimBoard.tsx`, `LifeSimBoard.css`, `audit.json`, `sim2Boards.test.tsx` (17).

Forge `coursegen/src/v2/horizonte/sim2.ts` (capability literal, five lines of authoring guidance, gate-4 checks); test
`coursegen/src/__tests__/horizonte/sim2.test.ts` (8).

Fixtures (4, all 13-17): `life-portfolio-risk` (14-17, key `[25]`), `life-retirement-spend` (15-17, key `[15000]`), `life-insurance-cover` (14-17, key
`[85]`), `life-debt-or-save` (13-17, key `[30, 40, 50]`). Each carries a fixed seed and the full ladder. Preview:
`?screen=fixture&seg=hz:sim2:<fixture>&age=13-17`; `audit.json` lists all four for the audit lane.

No shared file was edited: the pack is registered through the stubs that were already wired in the three aggregators.

## Decisions

- **One type, four scenarios.** The four catalogue rows share the same loop (choose, replay 100 futures, count), so they share one type and one
  board. A scenario is a payload field, not a new segment type.
- **Answer is the choice, never the count.** The response holds the seed and the choice, so there is nothing for the browser to forge but a
  value from the list the payload offers. The server cannot be told that a run succeeded.
- **The payload field is `finish`, not `target`.** The scorer contract forbids a rubric key that is also a payload key, and the rubric key is
  `target`. The payload names the money to reach `finish` and the floor `floor`.
- **Choice lists dodge the borderline.** A hand-authored choice list must jump over the zone where success is neither near-certain nor near-
  impossible (for example 25 to 60 percent stocks, then 80). The gate refuses a list that does not, and the Forge guidance says so.
- **Common random numbers.** All choices see the same futures, so the slider never shows a change that is only luck, and the success count is
  monotone enough in the choice for the answer rules to be honest.
- **`Future.cushions`.** The model keeps the series the floor is judged on (the worth, or the cash of a life) beside the worth path, so the life
  chart can show the real floor test and the `lowest` number is the one the table prints.
- **Neutral until the learner moves.** The start choice is drawn with its green and dashed futures like any other, and Check stays disabled
  until the choice differs from the start, so the board never shows an answer-bearing state.
- **Generic currency and no real instruments.** `$` is a sign, not a currency; the "fund" and "cover" are generic.

## Status

Implementation: complete in all layers (Core pack, browser copy of the model and scorer, board, Forge, lane doc). Local verification: backend
sim2 test (17), coursegen sim2 test (8), frontend board test (17, including the board contract in three locales for two fixtures and in en-US for
the rest); the Horizonte sync check, the capability parity gate and the copy gate; one type-check each for backend, frontend and coursegen after
merging `feat/horizonte-visual`. Acceptance and release: not done; they belong to the owner and the coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement, no measured chunk size. Nothing visual was looked at; it was reasoned from the
code and jsdom.

## Known issues and limits

- **No visual verification.** The two fans of 100 lines, the y-axis labels (22 px in a 640-wide box, compact money in es-MX and pt-BR can be wide),
  the 64 px hit size, the contrast of the green and berry strokes, the legend wrap at phone width and the stroke transition have not been seen.
- **The 5 percent clip.** The top of each chart clips the highest 5 percent of values across all choices, so a very lucky future is drawn flat
  along the top edge. The table has the real numbers.
- **The browser model carries the exact solver.** `model.generated.ts` includes `analyse` (up to 8 x 32768 histories). The board does not call it,
  so it should be tree-shaken from the chunk, but that was not measured.
- **Fixed counts.** 100 futures, 8 outcomes per chapter, 2 to 5 chapters and 3 to 8 choices are contract constants; a different count needs a new
  contract version. Goals are 50 to 99 of 100.
- **Authoring cost.** A new payload usually needs a short search over `finish`, `floor` and the choice list to land a clean answer set. The
  Forge gate reports the reason; there is no authoring tool that proposes values.
- **`checkV2Behaviour` has no behaviour space for any Horizonte kind** (as for sim1), so the gate-4 checks above are the guard.
- **Staff preview cannot grade a seeded segment** (it grades without an attempt, so the kind is `invalid` there: the fail-closed behaviour).

## Owner follow-ups

- Look at all four fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off.
- Measure the real gzipped chunk and adjust `chunkBudgetKb` (declared 16).
- Review the es-MX and pt-BR strings with a native speaker (native-written, not reviewed).
- Deploy Core before any browser that serves this type, and keep Forge from publishing it until Core is live (the same order as every seeded type).
- Decide whether insurance should also show the expected cost per choice as a number (the catalogue mentions expected value; the board shows the
  futures and the count, and the cost table lists the outcomes, but not the average).

## Fix round

Dark-mode contrast fix for the F3.3 life-simulation board. The seeded protocol, the model, the scorer and the copy are unchanged.

- **Defect.** `LifeSimBoard.css` set the chart `color` and the floor mark to `var(--ink)`, a constant (`#11132a`) that does not flip under
  `.lf-rebuild[data-theme="dark"]`. The money axis labels sat on the dark `--sunken` ground at about 1.1:1 (the Atlas audit at 1280 px: 13 to 27 low-contrast
  elements per fixture in dark against 2 in light).
- **Fix.** Both uses are now `var(--content)`, the theme-flipping foreground that `charts/TeachingChart` uses. The tick marks moved from `--outline`
  (1.5:1 in dark) to `--edge` (3.38:1 dark, 3.05:1 light); the grid stays on `--outline` as a faint guide.
- **Re-read.** No other hex, `rgb()`, `hsl()`, `white`, `black` or inline style exists in the pack's CSS or TSX. The board keeps its futures table
  (`data-hz-table`) and its `role="status"` text equivalent. Motion is a CSS-only stroke transition behind `prefers-reduced-motion: no-preference`.
- **Guard.** `sim2Boards.test.tsx` now fails if `LifeSimBoard.css` contains `var(--ink)`, a hex colour, `rgb()`, `hsl()`, `white` or `black`.

Still limited: checked by contrast arithmetic from `tokens.css`, not yet re-run through the Atlas audit or looked at in a browser. The Reset and Check
buttons at 2.3:1 in the light audit come from the shared button styles, not from this pack.
