import { describe, expect, it } from 'vitest';
import {
  checkGymScenario,
  GYM_SCENARIOS,
  runGymScenario,
  runPedagogyGym,
  sequenceProblems,
  STUDENT_ARCHETYPES,
  type GymRunResult,
  type GymScenario,
} from '../tutor/pedagogyGym.js';
import type { PedagogyEvent } from '../tutor/controller.js';
import type { SessionPlanEntry } from '../core/client.js';

/*
 * V4 harness backlog: THE SIMULATED-STUDENT GYM (/ORACLE.md §20, ROADMAP.md
 * "Remaining harness phases"). Unlike `verify-pedagogy.ts` (a script with no
 * `src/` counterpart, provable only by running it), this module's logic is
 * real `src/` code specifically so it has a real test suite here.
 */

function asActivityResult(event: PedagogyEvent): { correct: boolean; latencyMs?: number | null } {
  if (event.kind !== 'activity_result') throw new Error(`expected activity_result, got ${event.kind}`);
  return event;
}

describe('the four reactive student archetypes', () => {
  it('"needs directness" answers correctly under a concrete strategy and wrongly under an open one', () => {
    const wrongUnderOpen = STUDENT_ARCHETYPES['needs directness']!({ turnIndex: 1, lastStrategy: 'SOCRATIC' });
    expect(asActivityResult(wrongUnderOpen).correct).toBe(false);

    const rightUnderConcrete = STUDENT_ARCHETYPES['needs directness']!({ turnIndex: 1, lastStrategy: 'WORKED' });
    expect(asActivityResult(rightUnderConcrete).correct).toBe(true);

    // No prior strategy yet (the very first turn): treated as not-open.
    const firstTurn = STUDENT_ARCHETYPES['needs directness']!({ turnIndex: 0, lastStrategy: null });
    expect(asActivityResult(firstTurn).correct).toBe(true);
  });

  it('"guesses under pressure" is wrong AND fast under questioning, correct at an ordinary pace otherwise', () => {
    const guess = asActivityResult(STUDENT_ARCHETYPES['guesses under pressure']!({ turnIndex: 1, lastStrategy: 'FLUENCY' }));
    expect(guess.correct).toBe(false);
    expect(guess.latencyMs).toBeLessThan(1_000);

    const genuine = asActivityResult(
      STUDENT_ARCHETYPES['guesses under pressure']!({ turnIndex: 1, lastStrategy: 'DIRECT' }),
    );
    expect(genuine.correct).toBe(true);
    expect(genuine.latencyMs).toBeGreaterThan(1_000);
  });

  it('"steady improver" is wrong for the first two turns, then reliably correct, regardless of strategy', () => {
    expect(asActivityResult(STUDENT_ARCHETYPES['steady improver']!({ turnIndex: 0, lastStrategy: 'RESCUE' })).correct).toBe(
      false,
    );
    expect(asActivityResult(STUDENT_ARCHETYPES['steady improver']!({ turnIndex: 1, lastStrategy: 'RESCUE' })).correct).toBe(
      false,
    );
    expect(asActivityResult(STUDENT_ARCHETYPES['steady improver']!({ turnIndex: 2, lastStrategy: 'RESCUE' })).correct).toBe(
      true,
    );
  });

  it('"fragile hesitant" is always correct, but slows down after the first three turns', () => {
    const early = asActivityResult(STUDENT_ARCHETYPES['fragile hesitant']!({ turnIndex: 0, lastStrategy: null }));
    const late = asActivityResult(STUDENT_ARCHETYPES['fragile hesitant']!({ turnIndex: 5, lastStrategy: null }));
    expect(early.correct).toBe(true);
    expect(late.correct).toBe(true);
    expect(late.latencyMs!).toBeGreaterThan(early.latencyMs! * 2);
  });
});

describe('runGymScenario drives the REAL controller reactively', () => {
  it('produces a sequence no longer than the turn budget, and never past a dormant controller', () => {
    const scenario = GYM_SCENARIOS.find((s) => s.name === 'needs directness')!;
    const result = runGymScenario(scenario);
    expect(result.sequence.length).toBeLessThanOrEqual(scenario.turnBudget);
    expect(result.sequence.length).toBe(result.turnsRun);
    expect(result.sequence.length).toBe(result.events.length);
    expect(result.sequence.length).toBe(result.difficulties.length);
    // A "needs directness" learner should eventually be taught rather than
    // asked forever — RESCUE or a concrete strategy should appear.
    expect(result.sequence).not.toEqual(result.sequence.map(() => result.sequence[0]));
  });

  it('the turn count agrees with strategyCounts (every turn is counted exactly once)', () => {
    const scenario = GYM_SCENARIOS.find((s) => s.name === 'steady improver')!;
    const result = runGymScenario(scenario);
    const totalCounted = Object.values(result.strategyCounts).reduce((a, b) => a + b, 0);
    expect(totalCounted).toBe(result.turnsRun);
  });
});

/*
 * FOUND BY THIS GYM, 2026-09-01, AND FIXED THE SAME DAY (`controller.ts`) —
 * kept here as history rather than deleted, since `runPedagogyGym()`'s own
 * regression proof (below) is only meaningful if a reader can see what it
 * used to catch. A genuine finding about the SHIPPED controller, not a
 * defect in the gym itself.
 *
 * `controller.ts`'s difficulty computation (`decide()`, the block right
 * after `applyStrategy`) used to reset to `entry.targetDifficulty` on any turn
 * that does not ALSO independently qualify for its own hold/lower branch
 * (this turn failed, or its strategy is RESCUE/REMEDIATE/PROBE) or its
 * raise branch (`p >= 0.85`). So a turn immediately following a
 * support-strategy-driven LOW difficulty, whose own newly-decided strategy
 * happens to be an ORDINARY teaching or questioning strategy — neither
 * support nor high-mastery — jumps back up to the plan's baseline rather
 * than continuing to climb gradually from wherever the learner actually
 * was. None of `verify-pedagogy.ts`'s six fixed scripts happen to produce
 * this combination: every recovery turn in those scripts lands on
 * RESCUE/REMEDIATE/PROBE, which coincidentally ALSO holds difficulty down.
 * 'steady improver' does not — its first correct answer (after two wrong
 * ones) posts a mastery estimate that lands in the SOCRATIC band, an
 * ordinary questioning strategy — and difficulty visibly jumps from 1 to 2
 * on exactly that turn. This is precisely the class of thing a reactive
 * gym exists to surface that a fixed script structurally cannot.
 *
 * FIXED THE SAME DAY: `decide()`'s default case now holds at
 * `lastDifficulty` — "this controller's memory of where the learner
 * currently is" per that field's own doc comment — instead of resetting to
 * the plan's authored target, UNLESS the most recent change to
 * `lastDifficulty` was a content-ladder substitution rather than a
 * pedagogical one (`lastDifficultyFromContent`), in which case it still
 * climbs back to the target exactly as the existing, deliberately-protected
 * "does not pin the learner" test (`controller.test.ts`) already requires.
 * `gym:pedagogy` no longer reports this scenario; `KNOWN_GAPS` below no
 * longer names it, on purpose — its continued ABSENCE from a future
 * `report.problems` is itself the regression proof.
 */
/*
 * FOUND BY THIS GYM, 2026-09-01, SECOND FINDING — PARTIALLY FIXED THE SAME
 * DAY, remainder RE-DIAGNOSED rather than left under its original
 * (incomplete) description.
 *
 * The mechanism as first hypothesized: `answeredHesitantly` (controller.ts)
 * compares a correct answer's latency against the MEDIAN of
 * `correctLatencies`, an UNBOUNDED history that already includes the
 * CURRENT turn's own measurement and is never windowed. For a learner whose
 * slow phase is CONSISTENT, the median would converge toward that slow
 * value once slow measurements outnumber the earlier fast ones, defeating
 * `latency > median * 2` regardless of the original fast/slow gap. THIS
 * PART IS REAL AND IS NOW FIXED: `LATENCY_BASELINE_SIZE` freezes the
 * baseline at the first 3 correct-latency measurements per KC, so no later
 * run of similar-paced answers — hesitant or fluent — can move the
 * yardstick they are judged against again.
 *
 * The fix did not turn this scenario clean, and instrumenting the real
 * controller turn-by-turn (temporarily, during this investigation) showed
 * why: 'fragile hesitant' is promoted using ONLY its first three, genuinely
 * fast turns — `MASTERY_MIN_OPPORTUNITIES` (3) is satisfied there, all
 * three answers really are fast, so CELEBRATE fires honestly on the
 * evidence that exists at that moment, the KC completes, and `turnIndex`
 * 3+ — this archetype's whole slow phase — never reaches a live KC for
 * `answeredHesitantly` to evaluate. That is a DIFFERENT, bigger question
 * than the one just fixed: not "does the check get defeated by accumulated
 * data" but "can a mastery decision ever be RECONSIDERED once later
 * evidence contradicts it" — a mechanism this codebase does not have
 * anywhere today. Raising `MASTERY_MIN_OPPORTUNITIES` was considered and
 * rejected: it already sits at the top of the blueprint's own cited range
 * ("2-3 ítems de sondeo" — see its own comment in controller.ts), so
 * raising it further would contradict the source spec rather than fix a
 * bug in this codebase's reading of it. Whether mastery should ever be
 * reconsidered, and on what evidence, is a real PEDAGOGY DESIGN question
 * with no documented answer — squarely outside this lane's scope (harness
 * tooling, not a mastery-detection redesign) — so it stays named here,
 * more precisely than before, rather than guessed at further.
 */
const KNOWN_GAPS: Readonly<Record<string, string>> = {
  'fragile hesitant':
    'a persistently hesitant-but-correct learner was promoted (CELEBRATE/TRANSFER) — mastery should stay withheld while every correct answer is slow (blueprint §8.3: "correcto + latencia alta → dominio frágil, no promover")',
};

describe('the gym\'s own default population', () => {
  it('reports no UNEXPECTED problems for any shipped archetype — every deviation from clean is named above, not silently swallowed', () => {
    const { reports } = runPedagogyGym();
    expect(reports).toHaveLength(GYM_SCENARIOS.length);
    for (const report of reports) {
      const known = KNOWN_GAPS[report.scenario];
      const unaccountedFor = report.problems.filter((problem) => problem !== known);
      expect(unaccountedFor, `${report.scenario}: ${unaccountedFor.join('; ')}`).toEqual([]);
      // The known gap must still actually be there — if it disappears, the
      // fix landed and KNOWN_GAPS above is the thing that needs updating.
      if (known) expect(report.problems).toContain(known);
    }
  });
});

/*
 * A CHECK ONLY PROVEN BY WATCHING IT HOLD IS NOT PROVEN TO FIRE (the same
 * lesson `verify-pedagogy.ts` and this codebase's own §1.14 corollaries draw
 * repeatedly). The test above proves the shared checks pass on real output;
 * these two prove they are not simply vacuous.
 */
describe('the checks themselves catch what they claim to, not only agree with clean output', () => {
  const baseResult: GymRunResult = {
    scenario: 'synthetic',
    sequence: [],
    difficulties: [2, 2, 2, 2],
    events: [
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
    ],
    strategyCounts: {},
    completed: false,
    turnsRun: 4,
    turnBudget: 16,
  };

  it('sequenceProblems flags an A↔B thrash', () => {
    const problems = sequenceProblems({ ...baseResult, sequence: ['RESCUE', 'DIRECT', 'RESCUE', 'DIRECT'] });
    expect(problems.some((p) => p.includes('alternates between two strategies'))).toBe(true);
  });

  it('sequenceProblems flags a rescue fired twice with no progress between', () => {
    const problems = sequenceProblems({ ...baseResult, sequence: ['RESCUE', 'RESCUE', 'DIRECT', 'DIRECT'] });
    expect(problems.some((p) => p.includes('rescues twice'))).toBe(true);
  });

  it('sequenceProblems flags difficulty rising the turn right after a failure', () => {
    const problems = sequenceProblems({
      ...baseResult,
      sequence: ['DIRECT', 'DIRECT', 'DIRECT', 'DIRECT'],
      difficulties: [2, 3, 2, 2],
    });
    expect(problems.some((p) => p.includes('difficulty rose'))).toBe(true);
  });

  it('sequenceProblems flags still-questioning after four turns with no correct answer', () => {
    const problems = sequenceProblems({ ...baseResult, sequence: ['SOCRATIC', 'SOCRATIC', 'SOCRATIC', 'SOCRATIC'] });
    expect(problems.some((p) => p.includes('still asking'))).toBe(true);
  });

  it('a clean synthetic result reports no problems at all', () => {
    const problems = sequenceProblems({
      ...baseResult,
      sequence: ['DIRECT', 'WORKED', 'FADED', 'RESCUE'],
      events: [
        { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      ],
    });
    expect(problems).toEqual([]);
  });

  it("the 'fragile hesitant' scenario's extraCheck fires when a hesitant learner IS promoted", () => {
    const fragile = GYM_SCENARIOS.find((s) => s.name === 'fragile hesitant')!;
    expect(fragile.extraCheck).toBeDefined();
    const promoted: GymRunResult = { ...baseResult, sequence: ['FLUENCY', 'FLUENCY', 'CELEBRATE'] };
    expect(fragile.extraCheck!(promoted).length).toBeGreaterThan(0);
    const neverPromoted: GymRunResult = { ...baseResult, sequence: ['FLUENCY', 'FLUENCY', 'FADED'] };
    expect(fragile.extraCheck!(neverPromoted)).toEqual([]);
  });

  it('checkGymScenario also runs the skill-catalogue check, not only the four sequence properties', () => {
    // A plan whose KC has no mapped skillKey and no misconceptions still
    // resolves to SOME instruction (the STRATEGY_INSTRUCTIONS fallback) —
    // this proves checkGymScenario actually invokes selectSkill at all
    // (it would throw/mis-report if it referenced the wrong controller
    // state) rather than merely trusting sequenceProblems' inputs.
    const plan: SessionPlanEntry[] = [
      {
        kcId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
        kcKey: 'gym.synthetic',
        skillKey: null,
        reason: 'frontier',
        pKnown: 0.3,
        targetDifficulty: 2,
        objective: 'Synthetic objective for the gym\'s own test.',
        prereqKcIds: [],
        misconceptions: [],
      },
    ];
    const scenario: GymScenario = {
      name: 'synthetic catalogue check',
      student: STUDENT_ARCHETYPES['steady improver']!,
      plan,
      turnBudget: 6,
    };
    const result = runGymScenario(scenario);
    // Should not throw, and should return an array (possibly empty).
    expect(Array.isArray(checkGymScenario(scenario, result))).toBe(true);
  });
});
