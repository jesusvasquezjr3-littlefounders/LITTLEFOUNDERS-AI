# Pedagogy fixes: the answer-leak gate, the rekenrek seven prompt, the coverage-one-half goal

Lane `pedagogy` (fixer round on the integration branch `feat/horizonte-visual`). Three confirmed review findings, three commits, no new segment type.

| Finding | Severity | Commit | What changed |
|---|---|---|---|
| CP-1 | medium | `139a1401` | One shared Forge gate refuses a prompt, help step or label that writes the keyed answer |
| CP-2 | low | `d3b1e2ec` | The rekenrek seven prompt no longer writes the keyed bead state |
| CP-3 | low | `4d9c7b5c` | `coverage-one-half` asks for 93 of 100 with key level 99, so a lower level really misses |

## CP-1: one gate for "the prompt never writes the answer"

About 15 guidance lines across the packs promise that the prompt, the help steps and the labels never write the keyed answer. Only a few packs checked it
(alg2 for the expression and surface-formula reference, a handful of others for their own shapes). A board whose prompt hands over the figure ships to a child as
a free "met", and no gate would have said so.

### What was built

`coursegen/src/v2/horizonte/answerLeak.ts` reads the keyed answer of each Horizonte segment and looks for it in the prompt, every help step and every label.
`horizontePieceGates` (`index.ts`) runs it after the pack gates, so `runV2DocumentGates` and the emit path both get it. It reports gate 8 (clarity), because the
pack gates already own gate 4 (solvability). It runs only where the caller holds the private keys, and only on segment types of the Horizonte capability map, so the
red-team and non-Horizonte documents are untouched.

How a key is read:

- A number is written when the text has that numeral. A decimal comma and a decimal point are one numeral (0,5 equals 0.5), and a thousands mark does not split it
  (1,000 equals 1000). Zero never counts: it is the usual "none" and the usual start.
- An answer part that holds several numbers (a bead pair, a fraction, a target object) is written only when every one of them is. A prompt that says "5" in
  "Slide 5 beads" alone does not write the pair [5, 2]; "Slide 5 beads on top and 2 below" does.
- `{n, d}` is one part (a fraction). Every other top-level field of a key is its own part.
- A reference or a string with operator characters (a formula, an expression) is written when the text holds it with spaces removed and a decimal comma
  turned into a point. This reuses the check alg2 already had; `withoutSpaces` and `commaToPoint` moved into `answerLeak.ts` and alg2 imports them.
- The name of a shape or an option letter is read only in the fields that pick one of the board's own options (`solid`, `pick`, `choice`). A one-letter option
  that is also a word in English, Spanish or Portuguese (a, e, i, o, u, y) is never read as a letter.
- A word that the text only offers is not written ("Does the price go up or down?" offers "up"). The offered-word rule covers or, o and ou, so the Spanish and
  Portuguese forms read the same way.
- The tree board (`prob.tree.v2`) is built from head counts that live in the chip ids of its first solution (`n-10` is 10). The text never writes one of them.
- Not an answer, so never read: `solutions`, `required`, `tolerance`, `review`, `parameter_tolerance`, `parameter_review`, `family`.

Types whose goal IS a number the learner is told ("show 47", "jump from 47 to 73", "the median is 6") are listed in `GOAL_STATED` and keep their numerals:
`math.ten-frame.v2`, `math.number-line.empty.v2`, `math.number-line.zoom.v2`, `math.clock.v2`, `math.ruler.v2`, `math.fraction-circles.v2`, `stats.dot-plot.v2`,
`stats.normal.v2`, `stats.binomial.v2`, `stats.clt.v2`. A function graph with no marks is the same, because its pack requires the prompt to write every nonzero
target value. A function graph with marks must not write the target.

Two types keep their own prompt check: `math.expression-editor.v2` and `math.surface-formula.v2` already refuse a prompt that writes the reference, so the shared gate
reads only their help steps and labels and the prompt problem is reported once.

### Files

| File | Change |
|---|---|
| `coursegen/src/v2/horizonte/answerLeak.ts` | New. `answerLeakGates`, `answerParts`, `numeralsOf`, `GOAL_STATED`, `withoutSpaces`, `commaToPoint` |
| `coursegen/src/v2/horizonte/index.ts` | Imports the gate; `HORIZONTE_TYPES` from the capability map; `horizontePieceGates` appends it |
| `coursegen/src/v2/horizonte/alg2.ts` | Imports `withoutSpaces` and `commaToPoint` instead of keeping its own copies |
| `coursegen/src/__tests__/horizonte/answerLeak.test.ts` | New, 21 tests |

### What the tests pin

- Every committed Horizonte row, in all three markets, writes none of its keyed answers, with the gate run on its own and through `horizontePieceGates`. A call with no
  keys reads nothing.
- The rekenrek pair (leaks only when both numbers are written), help and label leaks, formula and decimal-comma leaks, fractions, option letters and shapes, tree
  head counts, reference ownership by the pack (reported once), offered words, function graph with and without marks, scoping to Horizonte types, the `GOAL_STATED`
  list, and the key reader (`answerParts`, `numeralsOf`).
- Fail before, pass after: the CP-2 prompt is the first real leak the gate found. Run against the old rekenrek fixture it names `prompt writes the keyed answer`.

### Sweep result

The gate was run over the 81 committed segments across the three markets. It flagged the rekenrek seven prompt (CP-2, fixed in its own commit first) and
nothing else, so there are no false positives on the committed corpus. The flagged prompts of earlier iterations of the gate (an unmarked function graph, a market
that offers "up or down") are now explained by the rules above and pinned by tests.

## CP-2: the rekenrek seven prompt

The fixture prompt was "Slide 5 beads on top and 2 below." and the key is `[5, 2]`: the prompt wrote the whole key. A bare "Show seven" is not acceptable because
the grader is exact-state: [5, 2] is met and [2, 5] is a review, so a learner told only "seven" has no way to know which split is wanted. The prompt now reads
"Show seven with five on the top row." in en-US ("Muestra siete con cinco en la fila de arriba." in es-MX, "Mostre sete com cinco na fileira de cima." in pt-BR). It names
the top row only, so the second number (2) and the pair are left to the learner, and it maps to exactly one met state. It does still say "five" in words, which the gate
does not read (see the limits below); the learner must still work out that seven is five and two.

| File | Change |
|---|---|
| `backend/src/services/horizonte/num-a/fixtures.ts` | The prompt, in three locales |
| `frontend/src/rebuild/learning/horizonte/num-a/fixtures.generated.ts` | Regenerated with `node agent/tools/sync-v2-horizonte.mjs` |
| `coursegen/src/v2/fixtures/plans-horizonte/49-v2-hz-num-a-6-9-6-9.json` | The same prompt in the Forge plan (hand-maintained) |
| `coursegen/src/v2/fixtures/emitted-horizonte.json` | Regenerated with `npm run v2:emit -- --horizonte --write-fixture` (three lines, one for each market) |
| `backend/src/__tests__/horizonte/num-a.test.ts` | New test: no rekenrek prompt writes the keyed bead state, in every market |

## CP-3: `coverage-one-half` discriminates

The fixture asked for at least 85 of 100 intervals with the levels 90, 95 and 99, and the key was level 95. Level 90 reaches 85 on about 96% to 98% of seeds, so
the lowest offered choice already met the goal and the key level separated nothing. Core's behaviour gate reported it as "the rubric is trivially met", which is why
the fixture was kept out of `emitted-horizonte.json` and out of the behaviour tests' hard list.

Exact reach (chance that a seeded run of 100 intervals covers the truth at least goal times), truth 1/2, sizes 30, 100, 300:

| Goal | Key | Level 90 | Level 95 | Level 99 |
|---|---|---|---|---|
| 85 (old) | 95 | 96% to 99% | 99.98% to 100% | 100% |
| 93 (new) | 99 | 22% to 33% | 79% to 93% | 99.98% to 100% |
| 94 | none | no level reaches it reliably | | |

The fixture now asks for at least 93 with key level 99, in all three locales. The fixture seed also changed. It is test-only (Core derives a real attempt seed from a
token) and appears in no other file, and the old one had level 90 at size 100 covering 93 of 100, a lucky run that met the new goal. The new seed is the first of
`sha256("coverage-one-half:" + i)` for i = 0, 1, 2, ... whose level-90 sizes all miss 93 and whose level-99 sizes all meet it (i = 3: level 90 covers 92, 87 and 90;
level 95 covers 99, 92 and 93; level 99 covers 100, 99 and 99). `coverage-three-fifths` keeps goal 92, which is already the maximum a board of that truth can hold
(goal 94 has no key).

Two false claims are corrected:

- `backend/src/services/horizonte/sim1/interval.ts` (and its generated browser copy) said "a lucky run at a lower level never counts". Grading counts any cell whose
  seeded 100 intervals reach the goal, so a lucky run at a lower level is met, by design. The comment now says that, and that a fixture sets a goal a lower level
  misses on most seeds.
- `docs/rebuild/sprints/horizonte/sim1.md` made the same claim and now says the same. The "Finding, not fixed" bullet there, in `behav.md` and in
  `forge-integration.md` is marked as since fixed. The Forge guidance line in `coursegen/src/v2/horizonte/sim1.ts` now reads "a lower level misses on most seeds
  (a lucky run at a lower level is still met)".

### Files

| File | Change |
|---|---|
| `backend/src/services/horizonte/sim1/fixtures.ts` | Goal 93, key level 99, the prompt in three locales, the new fixture seed (four places) |
| `backend/src/services/horizonte/sim1/interval.ts` | The comment on `solveCoverage` |
| `frontend/src/rebuild/learning/horizonte/sim1/fixtures.generated.ts`, `interval.generated.ts` | Regenerated |
| `backend/src/__tests__/horizonte/sim1.test.ts` | Key 99 at goal 93, no key at 94, and a new test that every start-level size reaches the goal on under 40% of seeds and misses under the fixture seed |
| `backend/src/__tests__/forgeV2HorizonteBehaviour.test.ts` | `coverage-one-half` leaves the easy list; a goal of 85 is still pinned as "trivially met" through an edited copy; the shipped board passes the gate |
| `coursegen/src/__tests__/horizonte/sim1.test.ts`, `solvability-sims.test.ts` | The authored `half` example follows the fixture (goal 93, key 99) |
| `coursegen/src/v2/horizonte/sim1.ts` | One guidance line |
| `docs/rebuild/sprints/horizonte/sim1.md`, `behav.md`, `forge-integration.md` | The claim and the finding notes |

The new regression test fails against the old fixture (level 90 reaches the goal on far more than 40% of seeds) and passes now.

## Checks run

- `npm run type-check` once in backend, coursegen and frontend: clean.
- Backend (`VITEST_MAX_THREADS=3 VITEST_MAX_FORKS=3`): `horizonte/sim1`, `horizonte/num-a`, `forgeV2HorizonteBehaviour`, `forgeV2HorizonteFixture`: 787 pass.
- Coursegen: `horizonte/sim1`, `horizonte/solvability-sims`, `horizonte/answerLeak`, `v2HorizonteFixture`, `v2Emit`: 127 pass. The alg2 and space2 pack tests,
  which share a check with the gate: 59 pass. `v2Emit` holds the red-team documents, which the gate leaves alone.
- Frontend (`VITE_CACHE_DIR` set to the lane cache): `horizonte/sim1` and `horizonte/num-a`: 109 pass.
- `node agent/tools/check-v2-lesson-capability-parity.mjs`: OK. `node agent/tools/sync-v2-horizonte.mjs --check`: OK (121 files). No capability map changed.

## What is NOT verified

- No page ran, no browser, no Playwright, no screenshot. The frontend copies are generated and pinned by the sync check and the board tests, not looked at.
- The full gates (`test:all`, `tools:test`, `verify:*`, `audit:*`, `spec:check`) were not run: they belong to the push gate.
- The coverage reach table is exact binomial arithmetic from `interval.ts`; the seeded run each learner gets is a different seed every time, so a learner can still meet
  the goal at level 90 or 95 on a lucky run (roughly one attempt in three to five at level 90, more at level 95). That is the grading by design.
- The Forge plan for `coverage-one-half` was not added: only `coverage-three-fifths` is in `plans-horizonte/` and `emitted-horizonte.json`, so the emitted counts
  (114 rows, 240 graded segments) did not change.

## Limits of the leak gate

- A heuristic, backed by the sweep of the 81 committed segments. It is not a proof that no prompt can leak.
- Numbers spelled out in words ("five", "cinco") are not read.
- A prompt that writes only part of a tuple is not flagged (the all-parts rule). The abacus is the visible case: its key is [4, 7] and "Show 47" writes both digits as
  one numeral, which is not the numerals 4 and 7, so it is left alone; the board's goal there is the number itself.
- The offered-word rule knows or, o and ou only.
- It reads the prompt, the help steps and the labels of a segment. It does not read the feedback, the hint copy a board's component renders, or a localized string
  table of the browser.
- It runs in Forge only (`horizontePieceGates`). There is no Core-side mirror.

## Owner follow-ups

- Decide whether Core should mirror the leak gate: a lesson authored by hand never goes through Forge's gates.
- Add `coverage-one-half` to the Forge plans so the emitted fixture covers a coverage board whose key is level 99 and whose lower level misses.
- Have a native reader look at the new es-MX and pt-BR coverage prompt and at the rekenrek seven prompt.
- `coverage-three-fifths` still has a level-95 reach of 88% to 97% at goal 92. That is the maximum goal for that truth and levels, so it stays; a different truth or a
  different level set is a content decision.
