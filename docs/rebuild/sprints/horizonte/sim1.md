# Lane doc: sim1 (F3.0 seeded run protocol, F3.1 simulated chance, F3.2 confidence intervals and bootstrap)

Four simulation boards on the Horizonte Visual and the protocol that makes them gradable on the server. Procedure:
[RECIPE.md](./RECIPE.md). Pattern copied from [golden.md](./golden.md) and [stats1.md](./stats1.md). Solvability follows
[F0.4-solvability.md](./F0.4-solvability.md).

| Item | Value |
|---|---|
| Catalogue rows | H18, H19, H20, H33 (F3.1: coin, die, spinner, Galton board, random walk, law of large numbers); H26, H28 (F3.2: coverage of intervals, bootstrap) |
| Pieces | F3.0 (seed and attempt-token protocol), F3.1 (chance, Galton), F3.2 (coverage, bootstrap) |
| Segment types | `math.chance-sim.v2`, `math.galton-sim.v2` (F3.1); `stats.coverage-sim.v2`, `stats.bootstrap-sim.v2` (F3.2) |
| Visuals | `chance-sim`, `galton-sim`, `coverage-sim`, `bootstrap-sim` |
| Capability literals | each type needs `visual.<name>.v1`, `operation.seeded-run.v1`, `operation.parameter-slider.v1`, `operation.show-table.v1` |
| Ages | chance `{ ages: [10, 14], adult: false }`; Galton `{ ages: [14, 17], adult: true }`; coverage and bootstrap `{ ages: [16, 17], adult: true }` |
| ICAP level | Active, all four |
| Rendering | in-house SVG, native range inputs and buttons; no chart library, no third-party code. The only randomness is the seeded generator |
| Chunk budgets | 14 KB each (gzipped, declared) |
| Answer shape | server seed (the answer carries the seed Core issued and how long the run was) |

## F3.0: the seeded run protocol

A simulation is only gradable if the server can replay exactly what the learner saw. The learner's browser cannot be trusted to report a
result, so it reports only the inputs: the seed it was given and how much it ran. Core replays the run from that seed and decides.

1. **Seed.** `deriveAttemptSeed` (`backend/src/services/horizonteAttemptSeed.ts`) is HMAC-SHA256 under a subkey of `LESSON_ATTEMPT_SECRET`
   (domain `littlefounders.horizonte.attempt-seed.v1`), over the length-prefixed fields lesson, segment, learner, nonce (`jti`) and issue
   time. It is a pure function of the **verified** attempt token. It is 64 lowercase hex characters (256 bits).
2. **No new state.** A resume re-signs the same nonce and expiry, so it gives the same seed. A miss mints a new nonce, so a new seed.
   The nonce is burned by the existing `recordV2LessonGrade` receipts, so the seed is single use exactly as the token is. There is no table, no
   migration and no new environment secret.
3. **Delivery.** `POST /v2-runs` (start and resume) returns `attempt_seeds` next to `attempt_tokens`, for seeded segments only. A miss on `/grade`
   returns `retry_attempt_seed` next to `retry_attempt_token`. The seed is never in the lesson document, the answer key or any response
   before the attempt is issued.
4. **Grading.** Core passes `{ seed }`, derived from the verified token, to the scorer as the `attempt`. The response carries its own seed
   and it must equal Core's (constant-time compare). A seed the browser names that is not this attempt's is `invalid`. The sampled
   response used at publish time is graded under a fixed attempt (`SAMPLE_ATTEMPT`, 64 zeros).
5. **Fail closed.** A seeded kind graded with a rubric but no attempt is `invalid` (so the staff preview, which grades without an attempt,
   cannot grade a seeded segment). The browser registry shows "upgrade required" for a seeded type when no seed has been provided by the
   `AttemptSeedProvider`, so an old Core never sees a seeded answer.
6. **One generator.** `seed/prng.ts` is sfc32 on the seed (eight seed words mixed into the state, then a warm-up), with an unbiased
   `below(n)` by rejection sampling. It is pure and has no clock and no `Math.random`. It lives in Core, and the sync tool copies it byte for
   byte to `frontend/.../horizonte/seed/*.generated.ts` so the browser draws the same stream. Golden vectors are pinned in
   `backend/src/__tests__/horizonte/seed.test.ts` and are also checked against an independent BigInt implementation over a long stream.

Deploy order: **Core first, then the browser.** A browser that sends a seeded segment to an old Core fails closed on the 400, and a new
browser against an old Core shows "upgrade required" instead of a board that cannot be graded. Forge must not publish a seeded type
until Core is live.

## Behaviour and answer shapes

Every payload is public and carries no answer. The key lives only in Core as `{ target: ... }`.

| Type | Payload | The learner | Answer sent | Key (private) |
|---|---|---|---|---|
| `math.chance-sim.v2` | `{ machine: { kind: coin or die or spinner, weights }, event, stops, tolerance, minTrials }` | runs the machine for a chosen number of trials until the share of the event is within the tolerance of its chance | `{ seed, trials }` | `{ target: { num, den } }`, the exact reduced chance of the event |
| `math.galton-sim.v2` | `{ view: board or walk, rows, rightPct, bin, stops, tolerance, minBalls }` | drops balls (or runs walkers) and reads the share that ends in one bin | `{ seed, balls }` | `{ target: { num, den } }`, the exact chance of the bin |
| `stats.coverage-sim.v2` | `{ truth: { num, den }, levels, sizes, start: { level, size }, goal: { covered } }` | picks a confidence level and a sample size until at least `goal.covered` of 100 intervals cover the truth | `{ seed, level, size }` | `{ target: { level } }`, the lowest level that reaches the goal reliably |
| `stats.bootstrap-sim.v2` | `{ axis, data, level, stops, tolerance, minResamples }` | resamples the data (with replacement) until the interval settles near its true edges | `{ seed, resamples }` | `{ target: { low, high } }`, the exact bootstrap edges |

- **Chance.** A coin, a die or a spinner with weights (2 to 8 faces, weights 1 to 12) and an event on it. The learner picks a run length from
  the stops. The share of the event converges on its chance, and the status line writes the count, the share and the chance gap. The chance
  is always in a band from 1/20 to 19/20, so the share is never a degenerate 0 or 1.
- **Galton.** A board of 3 to 10 rows, or a random walk of the same steps, with a right chance from 10 to 90 in tens. The bins fill as balls
  fall, the status line writes the counts, and the table lists every bin with its count and share.
- **Coverage.** 100 intervals of a chosen level and size, drawn from a population with a known true share. Each interval is drawn as a bar
  and marked covers or misses with a symbol and the word, never colour alone. A Wald interval, `p-hat +/- z sqrt(p-hat (1 - p-hat) / n)`, at
  50, 80, 90, 95 or 99.
- **Bootstrap.** A small sample of 4 to 10 values; each resample draws the same number of values with replacement and keeps the sum of the
  resample; the percentile interval (80, 90 or 95) is read off the sorted sums.

Every board has a keyboard path for every control (all controls are native `range` inputs or buttons, there is no drag), 64 px targets, a
show-as-table toggle with a text equivalent, `spokenText` on the math, reduced motion, tokens only and a neutral board (no answer-bearing hue
or position before the run).

## Scorer ladder (same for all four)

| Verdict | When |
|---|---|
| `invalid` | malformed response or extra fields; a seed that is not this attempt's; a run length that is not a stop; a level or size that is not a choice; or a malformed, inconsistent or unsolvable key |
| `valid` | the run not started (0 trials, 0 balls, 0 resamples, or the untouched start choice); without a rubric as in the browser, any well-formed response |
| `review` | the run started but short of the floor, or off the key by more than the tolerance (coverage: fewer covers than the goal); diagnostic `value` |
| `met` | the seeded run, replayed by Core, meets the key at or past the floor; score 100, diagnostic `none` |

Core's `horizonteGrade` returns null for both `invalid` and `valid`, which is HTTP 400 "Invalid answer for this lesson segment". Only a miss
(`review`) and a hit (`met`) are gradable, so a run that has not started cannot be sent and never burns a nonce. A miss returns a fresh token
and a fresh seed, so a retry is a genuinely new run.

Exact math. Every verdict is an integer comparison, so a float never decides it: a chance is a reduced fraction, a tolerance check is
`|hits * den - num * trials| * 100 <= tolerance * den * trials` in BigInt, a Wald cover is the exact
`(k b - a n)^2 n 10^6 <= z^2 k (n - k) b^2`, and the bootstrap edges are indices into the sorted integer sums. The only floats are drawing aids
(the bars, the interval ends) and the solvability estimates below.

## Solvability (F0.4, gate 4)

A key is solvable when the learner can reach it with a run the server will accept, at an overwhelming chance:

- chance and Galton: the run at the last stop lands inside the tolerance at 5 standard deviations (`SOLVE_SIGMAS`), the floor is at least 20
  and not the first stop, and the stops are 3 to 8 rising counts;
- coverage: `solveCoverage` finds the lowest level with a size that reaches the goal with chance `1 - 1e-5` (the exact binomial tail over the
  exact per-sample cover chance); the key must be that level and above the start, so a lucky run at a lower level never counts as met;
- bootstrap: `bootstrapSolvable` checks the tail at `1e-5` for both edges at the last stop; the key must equal the exact edges.

The same checks run in three places: the contract (a payload that cannot be solved does not parse), the scorer (a key that is not the one
answer is `invalid`), and Forge gate 4 (`coursegen/src/v2/horizonte/sim1.ts`, hand-mirrored from Core, reported as a `GateProblem` with the
segment id and a message the author can act on).

## Files

Backend `backend/src/services/horizonte/seed/`: `prng.ts`, `protocol.ts`. Backend `backend/src/services/horizonteAttemptSeed.ts`
(`deriveAttemptSeed`). Backend `backend/src/services/horizonte/sim1/`: `model.ts` (chance, Galton), `interval.ts` (coverage, bootstrap), `contract.ts`, `scorer.ts`,
`fixtures.ts`, `capabilities.ts`, `index.ts`. Shared files changed: `routes/learn.ts` (the `attemptSeedsField` helper, `attempt_seeds`, passing the
attempt to the grader, `retry_attempt_seed`), `services/v2LessonDocument.ts` (`gradeV2Visual(..., attempt?)`), `services/horizonte/index.ts`,
`services/horizonte/types.ts`, `services/horizonte/harness/scorerContract.ts`. Tests: `backend/src/__tests__/horizonte/seed.test.ts` (14),
`sim1.test.ts` (20), `seedRoute.test.ts` (4, the protocol over HTTP with the real routes).

Browser `frontend/src/rebuild/learning/horizonte/`: `attemptSeed.tsx` (the provider), generated `seed/{prng,protocol}.generated.ts`, generated
`sim1/{contract,model,interval,scorer,fixtures}.generated.ts` (never hand-edited), `sim1/{capabilities,copy,boards,shared}`, `ChanceBoard.tsx`,
`GaltonBoard.tsx`, `CoverageBoard.tsx`, `BootstrapBoard.tsx`, `sim1.css`, `audit.json`, `sim1Boards.test.tsx` (29). Seed plumbing in
`horizonte/{contract,registry,previewDocument}`, `harness/boardContract.tsx`, `learning/{LessonDocumentView,AuthenticatedLessonDocument}.tsx`,
`routes/app/learn/LessonRoute.tsx` and `preview/registry/learn.tsx`.

Forge `coursegen/src/v2/horizonte/sim1.ts` (capabilities, three lines of authoring guidance per type, gate-4 checks); test
`coursegen/src/__tests__/horizonte/sim1.test.ts` (17).

Fixtures (10): `chance-coin-heads`, `chance-die-six`, `chance-spinner-event` (10-12); `galton-board`, `galton-walk`, `galton-biased`,
`coverage-three-fifths`, `coverage-one-half`, `bootstrap-six-values`, `bootstrap-eight-values` (13-17). Each carries a fixed seed and
the full ladder (invalid, valid, review, met). Preview: `?screen=fixture&seg=hz:sim1:<fixture>&age=<band>`; `audit.json` lists all ten for the
audit lane.

## Decisions

- **Seed from the token, not from a table.** It removes a migration, a cleanup job and a new secret. The cost is that the seed lifetime is
  the token lifetime (the existing TTL), which is what a nonce already has.
- **Report inputs, never outputs.** The answer holds the seed and the run length, so there is nothing for the browser to forge but a length
  from a fixed list of stops. The server cannot be told that a run "met" the key.
- **Stops are a fixed list and there is a floor.** A learner picks from 3 to 8 run lengths, so the work Core replays is bounded (at most 5000
  trials, 3000 balls, 3000 resamples, 100 intervals of at most 400 draws). The floor stops a lucky short run from counting as met.
- **Wald intervals.** They are what a learner at 16 meets first, and their known weakness (under-coverage at small n) is a real thing to
  see on the board: a small size with a 95 level can cover fewer than 95 of 100. Solvability uses the exact cover chance of that same
  interval, so the key is always honest about what the board will show.
- **Percentile bootstrap with exact edges.** The key is the exact edge of the sorted sums (computed by exact enumeration of the resample sums
  distribution), and the run is met when its edges are within a tolerance of those, so more resamples genuinely converge.
- **Copy.** Strings are native in en-US, es-MX and pt-BR with `data-copy-role`, in the default Copy Budget band, `data` for numbers.
- **Motion.** A run is computed and drawn at once (nothing is animated by script). The only transition is the bar height, under `prefers-reduced-motion: no-preference`, using the component duration and easing tokens.

## Status

Implementation: complete in all layers (Core pack and protocol, route wiring, browser copies, four boards, seed plumbing in the lesson view,
Forge, lane doc). Local verification: backend seed (14), sim1 (20) and route (4) tests; frontend board tests (29) and board contract for every
fixture; Forge test (17, with 137 horizonte tests passing in coursegen and 225 in backend after merging the integration branch); one type-check each
for backend, frontend and coursegen; the capability parity gate, the copy gate and the sync check (all after the merge). Acceptance and
release: not done; they belong to the owner and the coordinator's audit pass.

Not verified: no real browser, no screenshot, no layout measurement. Nothing below was looked at; it was reasoned from the code and jsdom.

## Known issues and limits

- **No visual verification.** The SVG layout (Galton bins, the 100 interval bars, the bootstrap histogram), label collisions at narrow
  widths, the 64 px hit size, the contrast of the chosen tokens, and the feel of a long run have not been seen in a browser.
- **`checkV2Behaviour` has no behaviour space for any Horizonte kind.** `forgeV2Behaviour.ts` (called from `forgeV2Rows.ts`) does not model
  them, so the Forge row-level behaviour check does not exercise seeded types. The gate-4 checks above are the guard.
- **Staff preview cannot grade a seeded segment.** `staffLessonPreview.ts` grades without an attempt, so a seeded kind is `invalid` there. This
  is the fail-closed behaviour, not a regression; a preview that grades would need its own preview seed.
- **Seeds are tied to a token.** A learner who lets the token expire gets a fresh run on resume with a new seed, so a half-finished
  simulation is lost. That is intended (the run is cheap), but it is visible.
- **Coverage uses one fixed sample count.** 100 intervals is fixed (`SAMPLES`), so the goal is 50 to 99 of 100. A different count needs a new
  contract version.
- **Axis and data bounds.** Bootstrap axes are 0 to 100, 4 to 20 steps wide, data 4 to 10 whole values with at least 3 different; coverage
  truths are shares from 1/5 to 4/5 with a denominator up to 20, sizes 10 to 400.
- **`fixtureCoverage.test.tsx` fails on the integration branch for a reason outside this lane.** After merging `feat/horizonte-visual`, the
  harness treats the `plano` folder (the Plano primitive, which has an `index.ts` but is not a pack and has no fixtures) as a pack, so three
  of its tests throw on `HORIZONTE_FIXTURES.plano`. The loop stops there, before it reaches `sim1`, so a run restricted to `sim1` was used to
  confirm that its audit file and its fixture documents (all three locales) are in step. The audit lane module test, which covers every pack, passes.
- **Not covered by this lane.** The law of large numbers is the chance board over a long run; there is no separate running-average chart.
  A "show many runs at once" overlay for the walk is not built.

## Owner follow-ups

- Look at all ten fixtures in a real browser at phone, tablet and desktop widths, in all three locales and with reduced motion on and off,
  and check that a run of 5000 trials stays smooth on a low-end phone.
- Deploy Core before any browser that serves these types, and keep Forge from publishing a seeded type until Core is live. No new
  environment secret and no migration is needed (`LESSON_ATTEMPT_SECRET` is reused).
- Review the es-MX and pt-BR strings with a native speaker (they are native-written, not machine copies, but not reviewed).
- Decide whether the staff preview should grade seeded segments (it needs a preview seed) and whether `checkV2Behaviour` should learn the
  Horizonte kinds.

## Fix round

Dark-mode contrast fix for the F3.1 and F3.2 boards (chance, Galton board and walk, coverage, bootstrap). The seeded protocol, the model, the scorer
and the copy are unchanged.

- **Defect.** `sim1.css` painted the chart text, the markers, the pegs, the floor and the ghost line with `var(--ink)`. `--ink` is a constant (`#11132a`) and
  does not flip under `.lf-rebuild[data-theme="dark"]`, so the axis labels and place names sat on the dark `--sunken` ground at about 1.1:1 (the Atlas audit
  at 1280 px: 8 to 27 low-contrast elements per fixture in dark against 2 in light).
- **Fix.** Every `var(--ink)` in the board (the chart `color`, which `currentColor` text inherits, and eight stroke and fill rules) is now `var(--content)`,
  the same theme-flipping foreground that `charts/TeachingChart` uses. The chart ground stays `--sunken`, which also flips, so both sides now flip together.
- **Faint non-text marks.** The non-target bars, the axis and the tick marks used `--outline` (1.2:1 on `--sunken` in light, 1.5:1 in dark, under the 3:1 that
  graphical marks need). They now use `--edge` (3.05:1 light, 3.38:1 dark). The grid stays on `--outline` because it is a faint guide, not information.
- **Re-read.** No other hex, `rgb()`, `hsl()`, `white`, `black` or inline style exists in the pack's CSS or TSX. Every board keeps its show-as-table
  (`data-hz-table`) and its `role="status"` text equivalent. Motion is a CSS-only transition behind `prefers-reduced-motion: no-preference`; no timer or
  animation frame drives the board.
- **Guard.** `sim1Boards.test.tsx` now fails if `sim1.css` contains `var(--ink)`, a hex colour, `rgb()`, `hsl()`, `white` or `black`.

Still limited: the dark rendering has been checked by contrast arithmetic from `tokens.css`, not yet re-run through the Atlas audit or looked at in a browser.
The two light-mode low-contrast items the audit lists for every fixture (the Reset and Check buttons at 2.3:1) come from the shared button styles, not from this pack.

## Behaviour round

Core's interactive-behaviour gate now has a behaviour space for the four sim1 kinds (`math.chance-sim.v2`, `math.galton-sim.v2`, `stats.coverage-sim.v2`,
`stats.bootstrap-sim.v2`). Before this round they were the "no behaviour space defined for this kind" failures: 12 of the 15 left after the fix round. The model,
the scorer, the fixtures and the copy are unchanged. The spaces live in `backend/src/services/forgeV2HorizonteBehaviour/seeded.ts`.

- **How the gate grades a seeded kind.** The gate supplies its own attempt, a fixed synthetic seed held in `forgeV2Behaviour.ts` (`GATE_ATTEMPT`). It is not derived
  from `LESSON_ATTEMPT_SECRET`, is used only in the gate's own `gradeV2Visual` calls (through the optional last argument that already existed), and never
  reaches a response, a token or a stored value. Every response the gate builds carries that seed, as a real run's response carries Core's.
- **Run kinds (chance, Galton, bootstrap).** One permitted state per stop of the run-length slider. The chance and Galton targets are derived from the payload
  (the machine and event, or the rows, the bias and the bin) and must equal the key, or no space is built. The verdict is an integer test of the replayed hits
  against that target, so the gate does not trust the scorer's own tolerance code. The bootstrap edges come from an independent exact DP over the data, read at the
  sorted-sum rank of the level. A too-short run (below the floor) and a run that misses the tolerance at full length are review states; the full run is met.
- **Coverage.** Every level and size pair except the untouched start is a permitted state, met iff the seeded 100 intervals cover the truth at least `goal.covered`
  times. The key must equal `solveCoverage` and be above the start level. The start itself, an off-list level, an off-list size and a missing field are refused.
- **Refused and hostile states.** Refused (must grade invalid): a run not started, a run length off the stops, a wrong seed (another seed, the reversed seed, the
  publish sample), a malformed seed (case, length, whitespace, a non-hex tail), a missing or extra field. Hostile (never met, never a throw): `null`, scalars,
  arrays, a null-prototype object, a `__proto__` key, a 100,000-character seed, and each field dropped, nulled, wrapped in an array or object, turned into a
  string, `Infinity`, `NaN`, `Number.MAX_VALUE`, negative or fractional.
- **All-met rule kept.** A space where every state is met fails the gate. Under the gate seed the emitted sim1 boards have 2 of 5 met (chance, Galton), 9 of 15
  (coverage) and 3 of 5 (bootstrap).
- **Fail-closed unchanged.** A seeded kind graded without an attempt is still `invalid` (the staff preview, a caller that holds no token). The gate asserts this
  itself on the first met response of every seeded space, and `horizonteBehaviourSpace` returns nothing when it is given no attempt.
- **Finding, not fixed.** `coverage-one-half` is trivially met: its lowest offered level (90) covers the truth about 90 times in 100, so a goal of 85 is reached at
  every offered choice under the gate seed and under the fixture's own seed. The gate reports it as "the rubric is trivially met", which is correct, and a
  test pins that. It is not in `emitted-horizonte.json`, so the 240 of 240 result is unaffected, but Forge cannot emit it as authored. The fix is content: a
  higher goal or a lower first level. That changes `fixtures.ts` and the generated frontend copy, so it is left to the sim1 owner.

Result on `emitted-horizonte.json`: `forge-v2:check` reports 240 of 240 graded segments passing, 64,341 states scored.

Still limited: the gate seed was chosen once, and that every emitted board is met at full length under it was measured, not proved. No page ran.

## Solvability round

Forge now registers a real F0.4 checker for all four types (`coursegen/src/v2/horizonte/solvability-sims.ts`, imported by `solvabilityPacks.ts`; tests in
`coursegen/src/__tests__/horizonte/solvability-sims.test.ts`). The checkers reuse the pack's pure functions (`sim1.ts` only gained `export` keywords; the gate,
the seed protocol and the scorers are untouched) and read the public payload alone for everything it fixes. The key is compared only when `answerKey` is present.
Core grades these types against a seeded run the gate never has, so the checkers prove what the payload and the exact model determine, never the learner's run.
Every slider and stop here is reversible, so no state can be a dead end and none is searched for. Findings ride gate 1 as `solvability/<code>:`.

| Type | Solvable | Unique | Not already solved | No dead end | Budget | Stays unproven |
| --- | --- | --- | --- | --- | --- | --- |
| `math.chance-sim.v2` | The chance is rebuilt from the machine and event (5% to 95%); a run at the last stop must clear the pack's 5 sigma rule and an exact binomial miss of at most 1e-4, else `no-solution` (a chance outside the band is `out-of-bounds`). | One derived answer, the exact reduced fraction: a wrong key is `rubric-gap` plus `rubric-accepts-invalid`, a malformed key `impossible-state`. The stop just below the floor must not already be reliable, else `ambiguous-solution` (the floor would not be what separates a right run). | The floor is a stop and never the first, so a run short of it always exists and the untouched start (no run) can never be met; a malformed floor is `impossible-state`. | Reset and Run are always available; nothing to search. | One unit per trial of the last stop and of the stop below the floor (at most about 10,000), else `budget-exceeded`. | The learner's actual seeded run, any stop between the floor and the last, the prompt writing the tolerance in digits (pack gate), and whether the tolerance is pedagogically fair. |
| `math.galton-sim.v2` | The bin chance is the exact binomial (`binChance`); same last-stop rule as chance. | Same: exact reduced fraction key, floor must bind. | Same: floor is a non-first stop, so the start can never be met. | Reset and Drop are always available. | Same units, at most about 6,000 (stops up to 3000). | The seeded run, the prompt naming the bin and the tolerance (pack gate), the board and walk rendering. |
| `stats.coverage-sim.v2` | `solveCoverage` must find a level that reaches the goal at some size with probability of at least 1 - 1e-5, else `no-solution`. | The key must be exactly that lowest level. Any cell that covers the goal is met by design, so a lower cell that the board accepts on at least 99% of seeds is only a `review` `ambiguous-solution` (it would otherwise fail the committed fixtures, which have such cells). | The answer must sit above the start level, and the start cell must not reach the goal on 99% of seeds or more, else `impossible-state`. | Sliders are reversible. | Twice the grid: levels times the sum of (size + 100), at most about 25,000. | The learner's seeded 100 intervals, lower cells that reach the goal on between 1 - 1e-5 and 99% of seeds (accepted, not flagged), and the prompt naming the goal. |
| `stats.bootstrap-sim.v2` | The exact edges come from every possible resample (exact sum table); the last stop must settle both edges within the tolerance with probability of at least 1 - 1e-5 (`bootstrapSolvable`), else `no-solution`. | The key must be the exact `{ low, high }`; the stop below the floor must not already settle both edges, else `ambiguous-solution`. | The floor is a stop of at least 50 and never the first; the start has no resamples. | Reset and Resample are always available. | Five sum tables (data times its top total) plus the last and below stops, at most about 56,000. | The seeded run, the pack's rank rule at very small resample counts, the prompt writing the floor and the level. |

Decisions: the floor-binds rule is stricter than the pack gate on purpose (a floor that separates nothing tells a correct learner they are wrong with no reason);
`tests` compare the checker with the pack gate over a grid and assert it never accepts what the pack refuses, and refuses what the pack accepts only for the
codes above. All 15 committed emitted segments of these four types and the authored examples pass with and without their keys.
