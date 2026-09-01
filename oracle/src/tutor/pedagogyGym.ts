import { PedagogicalController, type PedagogyEvent } from './controller.js';
import { selectSkill } from './skills.js';
import type { Strategy } from '../context/schema.js';
import type { SessionPlanEntry } from '../core/client.js';

/*
 * THE SIMULATED-STUDENT GYM — V4 harness backlog (ROADMAP.md "Remaining
 * harness phases", /ORACLE.md §20). Governance: the harness doc's own §15.1,
 * "nothing autonomous reaches a child" — this module is BACKSTAGE ONLY. It
 * never runs against a real learner, never writes anything, and has no
 * caller anywhere in the live session path (`ws/`, `orchestrator.ts`'s
 * per-turn methods never import it). It exists to let a person iterating on
 * pedagogy (a threshold, a new strategy, a skill file) see the effect on a
 * POPULATION of learner behaviours before any of it ships.
 *
 * HOW THIS DIFFERS FROM ITS TWO SIBLINGS, DELIBERATELY, RATHER THAN
 * DUPLICATING EITHER:
 *
 * - `scripts/verify-pedagogy.ts` drives the same REAL `PedagogicalController`
 *   this module does, but against FIXED, hand-scripted event sequences that
 *   never react to what the controller just decided — it is a REGRESSION
 *   gate for specific transcripts the product has actually produced. This
 *   module's students are REACTIVE: each one decides its next answer from
 *   the strategy the controller just chose, closing the loop the way a real
 *   session does, so it can explore behaviour verify-pedagogy's fixed scripts
 *   structurally cannot reach (e.g. "what happens across SIXTEEN turns of a
 *   fast-guesser under a strategy that keeps switching").
 * - `scripts/converse.ts` runs the REAL orchestrator against a REAL,
 *   BILLED model, judging the PROSE the tutor produces (does it praise a
 *   wrong answer, does it greet twice). This module never calls a model —
 *   it drives only the deterministic controller, the same "no network, hits
 *   nothing, costs nothing" posture verify-pedagogy already has — because a
 *   gym meant to be run often, while iterating, must not cost money or need
 *   a provider key to be useful.
 *
 * The four SEQUENCE-level properties below (`sequenceProblems`) are the same
 * ones verify-pedagogy.ts checks, restated here rather than imported: that
 * file exists as a stable, narrowly-scoped GATE against specific fixed
 * scripts, and this module's reactive driving loop is a different enough
 * shape (a student that reads back the controller's own last decision) that
 * folding the two together would make the gate's own file responsible for
 * two different kinds of test authoring. The PROPERTIES are shared on
 * purpose — a sequence defect verify-pedagogy's fixed scripts do not happen
 * to trigger is still the same class of defect when a reactive student
 * triggers it.
 */

/** What a simulated student sees before deciding how to answer. */
export interface StudentContext {
  /** 0-based position in this scenario's run. */
  turnIndex: number;
  /** The strategy the controller chose on the PREVIOUS turn, or null on the very first turn. */
  lastStrategy: Strategy | null;
}

export type StudentModel = (ctx: StudentContext) => PedagogyEvent;

function activityResult(correct: boolean, latencyMs: number, misconceptionCode: string | null = null): PedagogyEvent {
  return { kind: 'activity_result', correct, misconceptionCode, attemptNumber: 1, latencyMs };
}

/** Strategies that ASK rather than TEACH — the same set `controller.ts`'s own no-progress guardrail watches for the questioning bands. */
const QUESTIONING_STRATEGIES: ReadonlySet<Strategy> = new Set(['SOCRATIC', 'FLUENCY', 'PROBE', 'SPACED']);

const NORMAL_LATENCY_MS = 4_000;
const GUESS_LATENCY_MS = 300;
const CONFIDENT_LATENCY_MS = 1_500;
const HESITANT_LATENCY_MS = 9_000;

/**
 * Four reactive learner archetypes. Small on purpose (AGENTS.md's own
 * "smallest genuinely useful piece" — a cross-product over starting mastery,
 * plan shape and attempt-count dynamics is a real, larger follow-up, left
 * for when this first slice earns it, not built speculatively now).
 */
export const STUDENT_ARCHETYPES: Record<string, StudentModel> = {
  /**
   * Answers correctly under a CONCRETE strategy (something is SHOWN) and
   * wrongly under an OPEN one (something is ASKED). Exercises whether the
   * controller actually rescues a learner stuck being questioned rather
   * than taught, across many more turns than any single fixed script tests.
   */
  'needs directness': ({ lastStrategy }) => {
    const open = lastStrategy !== null && QUESTIONING_STRATEGIES.has(lastStrategy);
    return activityResult(!open, NORMAL_LATENCY_MS);
  },
  /**
   * Wrong AND fast (guess-shaped) whenever asked an open question; correct
   * at an ordinary pace under a concrete one. Exercises the guess detector's
   * interaction with strategy-switching: a guess must never set a
   * misconception code (controller.ts's `answeredWithoutReading`), and this
   * archetype produces one on nearly every questioning turn.
   */
  'guesses under pressure': ({ lastStrategy }) => {
    const open = lastStrategy !== null && QUESTIONING_STRATEGIES.has(lastStrategy);
    return open ? activityResult(false, GUESS_LATENCY_MS) : activityResult(true, NORMAL_LATENCY_MS);
  },
  /**
   * A baseline/control: wrong twice, then reliably correct, regardless of
   * strategy — an ordinary session should simply complete.
   *
   * FOUND BY THIS ARCHETYPE, 2026-09-01 (a real gap in the shipped
   * controller, not fixed here — see `pedagogyGym.test.ts`'s own
   * `KNOWN_GAPS` for the full mechanism and why it is out of this lane's
   * scope): `decide()`'s difficulty computation resets to
   * `entry.targetDifficulty` on any turn that is correct but resolves to an
   * ORDINARY strategy (neither a support strategy nor high-mastery) — so
   * this archetype's very first correct answer, arriving right after two
   * wrong ones held difficulty down, visibly jumps difficulty back up.
   * `npm run gym:pedagogy` reports this every run, by design; it is a real,
   * named, tracked finding, not noise to silence.
   */
  'steady improver': ({ turnIndex }) => activityResult(turnIndex >= 2, NORMAL_LATENCY_MS),
  /**
   * Always correct, but reliably slow after an initial fast run — the
   * "correcto + latencia alta -> dominio frágil, no promover" case
   * (blueprint §8.3, `controller.ts`'s `answeredHesitantly`). No fixed
   * script in verify-pedagogy.ts runs long enough, at a consistent enough
   * pace, to show whether mastery is EVER wrongly declared on fragile
   * evidence — this archetype is built specifically to test that.
   *
   * FOUND BY THIS ARCHETYPE, 2026-09-01 (a real gap, not fixed here — see
   * `pedagogyGym.test.ts`'s `KNOWN_GAPS`): it IS eventually promoted.
   * `answeredHesitantly` compares against an UNBOUNDED, self-inclusive
   * median of every correct latency ever seen for the KC, so once enough
   * turns at this archetype's consistent slow pace accumulate, that pace
   * itself becomes the median and the 2x-median check can no longer fire —
   * mathematically guaranteed for ANY constant-latency slow phase run long
   * enough, independent of how extreme the original fast/slow gap was.
   */
  'fragile hesitant': ({ turnIndex }) =>
    activityResult(true, turnIndex < 3 ? CONFIDENT_LATENCY_MS : HESITANT_LATENCY_MS),
};

const GYM_KC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const GYM_PREREQ = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0';

function entry(overrides: Partial<SessionPlanEntry> = {}): SessionPlanEntry {
  return {
    kcId: GYM_KC,
    kcKey: 'money.make-change-counting-up',
    skillKey: 'financial-education/making-change',
    reason: 'frontier',
    pKnown: 0.3,
    targetDifficulty: 2,
    objective: 'Dar el cambio correcto contando desde el precio.',
    prereqKcIds: [GYM_PREREQ],
    misconceptions: [{ code: 'adds-instead-of-counts-up', hint: 'Cuenta hacia arriba.' }],
    ...overrides,
  };
}

export interface GymScenario {
  name: string;
  student: StudentModel;
  plan: SessionPlanEntry[];
  turnBudget: number;
  /**
   * A property specific to THIS scenario, beyond the four generic ones every
   * scenario shares (`sequenceProblems`). Optional: most archetypes need
   * nothing beyond the shared properties.
   */
  extraCheck?: (result: GymRunResult) => string[];
}

/** The gym's own default population — every archetype above, run long enough to show whether it ever settles or stalls. */
export const GYM_SCENARIOS: GymScenario[] = Object.entries(STUDENT_ARCHETYPES).map(([name, student]) => ({
  name,
  student,
  plan: [entry()],
  turnBudget: 16,
  ...(name === 'fragile hesitant'
    ? {
        extraCheck: (result: GymRunResult): string[] =>
          result.sequence.includes('CELEBRATE') || result.sequence.includes('TRANSFER')
            ? [
                'a persistently hesitant-but-correct learner was promoted (CELEBRATE/TRANSFER) — mastery ' +
                  'should stay withheld while every correct answer is slow (blueprint §8.3: "correcto + ' +
                  'latencia alta → dominio frágil, no promover")',
              ]
            : [],
      }
    : {}),
}));

export interface GymRunResult {
  scenario: string;
  sequence: Strategy[];
  difficulties: number[];
  events: PedagogyEvent[];
  strategyCounts: Record<string, number>;
  /** Whether the plan actually completed (the controller went dormant) within the turn budget. */
  completed: boolean;
  turnsRun: number;
  turnBudget: number;
}

/**
 * Fixed, arbitrary but deterministic clock — matches verify-pedagogy.ts's own
 * choice: forty seconds apart is a realistic spoken pace, far enough to keep
 * clearing the churn cap's own sixty-second window on every turn, which is
 * what makes a real thrash defect visible here rather than masked by the cap.
 */
const START_MS = 1_756_000_000_000;
const TURN_GAP_MS = 40_000;

/**
 * DRIVE IT THE WAY THE ORCHESTRATOR DRIVES IT (verify-pedagogy.ts's own
 * lesson, restated): `decide()` returns CELEBRATE unconditionally once the
 * plan is exhausted, and every real call site is guarded by
 * `controller.active`. Stopping the loop the instant `active` goes false is
 * what keeps a completed plan reading as an outcome, never as a tail of
 * congratulations for a learner who said nothing more.
 */
export function runGymScenario(scenario: GymScenario): GymRunResult {
  const controller = new PedagogicalController(scenario.plan);
  const sequence: Strategy[] = [];
  const difficulties: number[] = [];
  const events: PedagogyEvent[] = [];
  let lastStrategy: Strategy | null = null;

  for (let i = 0; i < scenario.turnBudget; i += 1) {
    if (!controller.active) break;
    const event = scenario.student({ turnIndex: i, lastStrategy });
    const decision = controller.decide(event, START_MS + i * TURN_GAP_MS);
    sequence.push(decision.strategy);
    difficulties.push(decision.difficulty);
    events.push(event);
    lastStrategy = decision.strategy;
  }

  const strategyCounts: Record<string, number> = {};
  for (const strategy of sequence) strategyCounts[strategy] = (strategyCounts[strategy] ?? 0) + 1;

  return {
    scenario: scenario.name,
    sequence,
    difficulties,
    events,
    strategyCounts,
    completed: !controller.active,
    turnsRun: sequence.length,
    turnBudget: scenario.turnBudget,
  };
}

/** A B A B — the same two strategies trading places turn after turn (verify-pedagogy.ts's own detector, restated — see this file's header for why it is not imported instead). */
function alternation(seq: readonly string[]): string | null {
  for (let i = 0; i + 3 < seq.length; i += 1) {
    const [a, b, c, d] = [seq[i]!, seq[i + 1]!, seq[i + 2]!, seq[i + 3]!];
    if (a !== b && a === c && b === d) return `${a} ↔ ${b} from turn ${i + 1}`;
  }
  return null;
}

const STALL_QUESTIONING: ReadonlySet<string> = new Set(['SOCRATIC', 'FLUENCY', 'PROBE']);

/**
 * The four sequence-level properties every scenario shares, regardless of
 * archetype: no thrash, rescue used as an interruption rather than a
 * strategy, difficulty never rising after a failure, and no more than three
 * consecutive turns spent asking a learner who is making no progress.
 */
export function sequenceProblems(result: GymRunResult): string[] {
  const { sequence, difficulties, events } = result;
  const problems: string[] = [];

  const thrash = alternation(sequence);
  if (thrash !== null) problems.push(`alternates between two strategies — ${thrash}`);

  let rescuesThisSlump = 0;
  events.forEach((event, i) => {
    const progressed = (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    if (progressed) rescuesThisSlump = 0;
    if (sequence[i] === 'RESCUE') rescuesThisSlump += 1;
    if (rescuesThisSlump > 1) problems.push(`rescues twice without the learner making progress (turn ${i + 1})`);
  });

  events.forEach((event, i) => {
    const failed = (event.kind === 'activity_result' || event.kind === 'voice_result') && !event.correct;
    if (failed && i + 1 < difficulties.length && difficulties[i + 1]! > difficulties[i]!) {
      problems.push(`difficulty rose from ${difficulties[i]} to ${difficulties[i + 1]} after a failure (turn ${i + 2})`);
    }
  });

  let sinceProgress = 0;
  events.forEach((event, i) => {
    const progressed = (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    sinceProgress = progressed ? 0 : sinceProgress + 1;
    if (sinceProgress >= 4 && STALL_QUESTIONING.has(sequence[i]!)) {
      problems.push(`still asking (${sequence[i]}) after ${sinceProgress} turns with no correct answer (turn ${i + 1})`);
    }
  });

  return problems;
}

/**
 * V4: every decision must resolve to a real didactic maneuver — the same
 * property verify-pedagogy.ts checks, re-run here because a REACTIVE student
 * visits (strategy, tier, pKnown, misconception) combinations a fixed script
 * never happens to produce, and a catalogue gap is a hole this gym exists to
 * surface before it reaches a real session.
 */
function skillCatalogueGaps(scenario: GymScenario): string[] {
  const controller = new PedagogicalController(scenario.plan);
  const usedSkillNames = new Set<string>();
  const problems: string[] = [];
  let lastStrategy: Strategy | null = null;

  for (let i = 0; i < scenario.turnBudget; i += 1) {
    if (!controller.active) break;
    const event = scenario.student({ turnIndex: i, lastStrategy });
    const decision = controller.decide(event, START_MS + i * TURN_GAP_MS);
    const skill = selectSkill({
      strategy: decision.strategy,
      tier: 2,
      pKnown: decision.pKnown,
      misconceptionCode: decision.misconceptionCode,
      usedSkillNames,
    });
    if (skill === null) {
      problems.push(`no skill in the catalogue for ${decision.strategy} at p=${decision.pKnown} (turn ${i + 1})`);
    } else {
      usedSkillNames.add(skill.name);
    }
    lastStrategy = decision.strategy;
  }
  return problems;
}

/** Every property a scenario must satisfy: the four shared ones, the catalogue check, and its own `extraCheck` if it declares one. */
export function checkGymScenario(scenario: GymScenario, result: GymRunResult): string[] {
  return [...sequenceProblems(result), ...skillCatalogueGaps(scenario), ...(scenario.extraCheck?.(result) ?? [])];
}

export interface GymReport {
  scenario: string;
  sequence: Strategy[];
  strategyCounts: Record<string, number>;
  turnsRun: number;
  turnBudget: number;
  completed: boolean;
  problems: string[];
}

/**
 * Runs every scenario given (the gym's own population by default) and
 * reports what happened. Pure and synchronous — no network, no model, no
 * randomness: the whole point is a tool cheap enough to run on every
 * pedagogy change, the same reason `verify:pedagogy` costs nothing.
 */
export function runPedagogyGym(scenarios: readonly GymScenario[] = GYM_SCENARIOS): { reports: GymReport[]; ok: boolean } {
  const reports = scenarios.map((scenario) => {
    const result = runGymScenario(scenario);
    const problems = checkGymScenario(scenario, result);
    return {
      scenario: scenario.name,
      sequence: result.sequence,
      strategyCounts: result.strategyCounts,
      turnsRun: result.turnsRun,
      turnBudget: result.turnBudget,
      completed: result.completed,
      problems,
    };
  });
  return { reports, ok: reports.every((report) => report.problems.length === 0) };
}
