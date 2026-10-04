# Behaviour round: the five seeded simulations under Core's gate

Lane `behav` (packs sim1, sim2 and backend; Core only). A completion round on merged code.

## The problem

Core's interactive-behaviour gate (`checkV2Behaviour` in `backend/src/services/forgeV2Behaviour.ts`, run by `npm --prefix backend run forge-v2:check` and by
`forge:v2:dry-run`) fails closed on a graded kind it has no behaviour space for. After the fix round, 15 of the 240 graded segments in
`coursegen/src/v2/fixtures/emitted-horizonte.json` still reported "no behaviour space defined for this kind": the five seeded simulations
(`math.chance-sim.v2`, `math.galton-sim.v2`, `stats.coverage-sim.v2`, `stats.bootstrap-sim.v2`, `money.life-sim.v2`) in three locales. A seeded kind is graded against a
per-attempt seed that Core derives from a verified token, and the gate has no token, so it could not exercise them.

## What was built

The gate supplies its own attempt. It is a fixed, synthetic seed (`GATE_ATTEMPT`, 64 lowercase hex characters) held in `forgeV2Behaviour.ts`. It is not derived from
`LESSON_ATTEMPT_SECRET`, it is used only in the gate's own grading calls, and it never reaches a response, a token, a stored value or a message (the gate abbreviates
it as `<seed>` in problem text). The grader needed no change: `gradeV2Visual` already takes an optional last `attempt` argument.

Pieces:

- **Behaviour spaces for the five kinds** (`forgeV2HorizonteBehaviour/seeded.ts`). Each builder returns nothing when it is given no attempt, and nothing when the key
  disagrees with what the payload derives, so a wrong key still fails the gate with "no behaviour space defined".
- **The gate** (`forgeV2Behaviour.ts`) now carries the attempt on a space, passes it to every grading call, runs a hostile list, and checks the fail-closed rule.
- **Builder plumbing** (`forgeV2HorizonteBehaviour/index.ts`, `shared.ts`): `HzSpace` gains `attempt` and `hostile`; a builder receives the attempt as an optional fourth
  argument; `horizonteBehaviourSpace(segment, rubric, attempt?)`.

## Files

| File | Change |
|---|---|
| `backend/src/services/forgeV2HorizonteBehaviour/seeded.ts` | new: the five builders, the refused and hostile response generators |
| `backend/src/services/forgeV2HorizonteBehaviour/index.ts` | registers the five kinds, threads the attempt |
| `backend/src/services/forgeV2HorizonteBehaviour/shared.ts` | `HzSpace.attempt`, `HzSpace.hostile`, the builder signature |
| `backend/src/services/forgeV2Behaviour.ts` | `GATE_ATTEMPT`, attempt threading, hostile loop, no-attempt check, safe `shown()` for messages |
| `backend/src/__tests__/forgeV2HorizonteBehaviour.test.ts` | the "five kinds are the only gap" and "fail-closed" assertions are gone; per-kind suite added |
| `backend/src/__tests__/forgeV2HorizonteFixture.test.ts` | now expects 240 of 240 and a pass rate of 1; adds a fail-closed test per kind |
| `docs/rebuild/sprints/horizonte/sim1.md`, `sim2.md` | "Behaviour round" sections |

## What each space covers

Each space is graded through Core's real `gradeV2Visual` under the gate attempt.

- A full-length correct run is met (chance, Galton and bootstrap: the last stop; coverage: a level and size whose seeded intervals reach the goal; life-sim: an answer).
- A run too short, a run that stops where the answer is not reached, a level and size below the goal, a choice that is not an answer: review, with the diagnostic Core stores.
- Refused (must grade invalid): run not started, a run length that is not a stop, a wrong seed (another seed, the reversed seed, the publish sample), a malformed seed, a
  missing or extra field, the untouched start, a parameter off the slider grid.
- Hostile (never met, never a throw): `null`, scalars, arrays, a null-prototype object, a `__proto__` key, a 100,000-character seed, and each field dropped, nulled,
  wrapped, stringified, `Infinity`, `NaN`, `Number.MAX_VALUE`, negative or fractional.
- The all-met rule holds: a space where every state is met fails the gate.
- The fail-closed rule holds: the gate grades the first met response of every seeded space with no attempt and requires `null`.

Where the expectation comes from. Chance and Galton derive the target chance from the payload with BigInt fractions and compare the replayed hits by an integer test.
Bootstrap derives the exact edges with its own DP. Coverage and life-sim use the model's `solveCoverage` and `analyse` for the answer. The replay (the hit counts, the
covered count, the success count) is shared with the scorer, because the PRNG replay is the thing both sides must agree on.

## Result

- `npm --prefix backend run forge-v2:check -- ../coursegen/src/v2/fixtures/emitted-horizonte.json`: 240 of 240 graded segments pass (100%), 64,341 permitted states scored,
  114 rows pass the strict contract. Before this round: 225 of 240.
- Backend `npm run type-check`: clean.
- Focused tests (`forgeV2*`, `v2VisualScorer`, `horizonte/seed`, `horizonte/sim1`, `horizonte/sim2`): 800 pass.
- Per emitted board under the gate seed: chance 5 states (2 met), Galton 5 (2), coverage 15 (9), bootstrap 5 (3), life-sim 5 (1).

## Finding: `coverage-one-half` is trivially met (since fixed)

`coverage-one-half` (goal 85 of 100, levels 90, 95, 99) was met at every offered choice, under the gate seed and under its own fixture seed: the lowest offered level already
covers the truth about 90 times in 100. The gate rightly reported "the rubric is trivially met". It is not in `emitted-horizonte.json`, so it did not affect the 240 of 240.
The pedagogy lane raised the goal to 93 with key level 99 (`pedagogy-fixes.md`); the board now passes the gate, and a test still pins the failure for the old goal of 85.

## What is NOT verified

- The gate seed was picked once. That every emitted board is met at full length and has at least one review state under it was measured on the current 114 rows and on the
  authored fixtures; it is not proved for a board Forge might emit later. A new board can fail under it by chance. A failure names the board, and the cure is a content
  change, not a new seed.
- The tests check Core's grader against the spaces; they do not run the browser, the staff preview or a real attempt token. No page ran.
- `forge:v2:dry-run` was not run (it needs the Forge side and a provider path); only `forge-v2:check` was.
- The expectation for chance, Galton and bootstrap is independent of the scorer's tolerance code, but the hit counts it tests come from the shared PRNG replay. A bug in the
  PRNG would move both sides together; `seed/prng` has its own tests for that.

## Limits

- The gate is a publish-time check. It does not change how a real run is graded, how the staff preview is graded, or what the browser accepts.
- A seeded kind graded with no attempt is still `invalid`, in Core's grader and in the gate's own check.
- No segment type was added; the three capability maps are untouched. Oracle's context schema is untouched, and nothing here widens what reaches the model about a child.

## Owner follow-ups

- `coverage-one-half`: done in the pedagogy lane (goal 93, key level 99).
- Promote the Horizonte plans into the shared Forge fixture now that the gate passes them; `forge-integration.md` still describes the five kinds as fail-closed and the
  225 of 240 count.
- If Forge starts to emit a new seeded board, run `forge-v2:check` on it before review; a "trivially met" or "no behaviour space" message there is a content defect.
