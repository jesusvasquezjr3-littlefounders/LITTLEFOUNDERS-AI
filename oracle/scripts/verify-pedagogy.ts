/*
 * `npm run verify:pedagogy` — DRIVE THE CONTROLLER, DON'T READ IT.
 *
 * WHY THIS EXISTS. Every §9.2 guardrail was a pure function with a passing
 * unit test, and two of them were wrong in a way no unit test could see. A unit
 * test asks "given this state, is the next strategy correct?" — and the answer
 * was yes, every time. The defect was in the SEQUENCE:
 *
 *   six straight failures  →  RESCUE DIRECT RESCUE DIRECT RESCUE DIRECT
 *
 * Every one of those transitions is individually correct. Together they are a
 * child being bounced between emotional support and direct instruction on
 * alternating turns, forever. The rule that produced it ("never two RESCUEs in
 * a row") was written to PREVENT an erratic experience and delivered one.
 *
 * The sibling defect was the mirror image: a guardrail whose threshold could
 * never be reached, so it read like protection and was dead code. Only running
 * a learner through it shows the difference between a rule that fires and a
 * rule that merely exists.
 *
 * So this drives the real controller through learner profiles that a real
 * session produces, and asserts properties of the WHOLE SEQUENCE. It is cheap,
 * deterministic, hits no network and costs nothing — the entire thing is the
 * controller's own arithmetic.
 *
 * It is not a replacement for the unit tests. It is the gate for the class of
 * defect they structurally cannot catch.
 */

import process from 'node:process';
import { PedagogicalController } from '../src/tutor/controller.js';
import type { PedagogyEvent } from '../src/tutor/controller.js';
import type { SessionPlanEntry } from '../src/core/client.js';

const KC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const PREREQ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0';

function entry(overrides: Partial<SessionPlanEntry> = {}): SessionPlanEntry {
  return {
    kcId: KC,
    kcKey: 'money.make-change-counting-up',
    skillKey: 'financial-education/making-change',
    reason: 'frontier',
    pKnown: 0.5,
    targetDifficulty: 2,
    objective: 'Dar el cambio correcto contando desde el precio.',
    prereqKcIds: [PREREQ],
    misconceptions: [{ code: 'adds-instead-of-counts-up', hint: 'Cuenta hacia arriba.' }],
    ...overrides,
  };
}

const WRONG: PedagogyEvent = {
  kind: 'activity_result',
  correct: false,
  misconceptionCode: null,
  attemptNumber: 1,
};
const RIGHT: PedagogyEvent = { ...WRONG, correct: true };
const SHRUG: PedagogyEvent = { kind: 'conversation_turn' };

/**
 * A learner profile is a script of turns. Forty seconds apart is a realistic
 * spoken pace, and it matters: it is far enough to keep clearing the churn
 * cap's sixty-second window, which is why the cap could not catch the
 * oscillation this file exists to detect.
 */
interface Profile {
  name: string;
  /** What the learner does, turn by turn. */
  turns: PedagogyEvent[];
  plan: SessionPlanEntry[];
}

const TURN_GAP_MS = 40_000;
const START = 1_756_000_000_000;

function repeat(event: PedagogyEvent, n: number): PedagogyEvent[] {
  return Array.from({ length: n }, () => event);
}

const PROFILES: Profile[] = [
  {
    name: 'a learner who cannot do it at all',
    turns: repeat(WRONG, 10),
    plan: [entry({ pKnown: 0.8 })],
  },
  {
    name: 'a learner who answers "no sé" and nothing else',
    turns: repeat(SHRUG, 10),
    plan: [entry({ pKnown: 0.8 })],
  },
  {
    name: 'a learner who goes quiet in the middle of a good session',
    turns: [RIGHT, RIGHT, ...repeat(SHRUG, 6), RIGHT],
    plan: [entry({ pKnown: 0.5 })],
  },
  {
    name: 'a learner who slumps, recovers, and slumps again',
    turns: [...repeat(WRONG, 4), RIGHT, RIGHT, ...repeat(WRONG, 4)],
    plan: [entry({ pKnown: 0.8 })],
  },
  {
    name: 'a learner who is simply getting it',
    turns: repeat(RIGHT, 8),
    plan: [entry({ pKnown: 0.5 }), entry({ pKnown: 0.5, kcKey: 'money.budget-basics' })],
  },
  {
    name: 'a learner with a diagnosed wrong idea',
    turns: [
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      ...repeat(WRONG, 3),
      RIGHT,
    ],
    plan: [entry({ pKnown: 0.7 })],
  },
];

interface Problem {
  profile: string;
  detail: string;
}

/**
 * A B A B — the same two strategies trading places turn after turn. This is the
 * shape that shipped, and no rule about a single transition can see it.
 */
function alternation(seq: string[]): string | null {
  for (let i = 0; i + 3 < seq.length; i += 1) {
    const [a, b, c, d] = [seq[i]!, seq[i + 1]!, seq[i + 2]!, seq[i + 3]!];
    if (a !== b && a === c && b === d) return `${a} ↔ ${b} from turn ${i + 1}`;
  }
  return null;
}

/**
 * Strategies that ASK rather than TEACH. A learner making no progress must not
 * be left in one of these: it is the "endless questions" the transcripts show.
 */
const QUESTIONING = new Set(['SOCRATIC', 'FLUENCY', 'PROBE']);

/*
 * DRIVE IT THE WAY THE ORCHESTRATOR DRIVES IT.
 *
 * `decide()` returns CELEBRATE unconditionally once the plan is exhausted, and
 * the orchestrator never sees it because every call site is guarded by
 * `controller.active`. A first version of this file ignored that guard and
 * printed eight CELEBRATEs in a row for a learner who had gone quiet — a tutor
 * apparently congratulating a child for saying nothing. It was the harness, in
 * the same file written to catch harness mistakes.
 *
 * So the run stops where the product stops. A completed plan is an outcome, not
 * a sequence of turns.
 */
function run(profile: Profile): { seq: string[]; difficulties: number[]; events: PedagogyEvent[] } {
  const controller = new PedagogicalController(profile.plan);
  const seq: string[] = [];
  const difficulties: number[] = [];
  const events: PedagogyEvent[] = [];
  for (const [i, event] of profile.turns.entries()) {
    if (!controller.active) break;
    const decision = controller.decide(event, START + i * TURN_GAP_MS);
    seq.push(decision.strategy);
    difficulties.push(decision.difficulty);
    events.push(event);
  }
  return { seq, difficulties, events };
}

function check(profile: Profile): Problem[] {
  const { seq, difficulties, events } = run(profile);

  const problems: Problem[] = [];
  const push = (detail: string): void => void problems.push({ profile: profile.name, detail });

  const thrash = alternation(seq);
  if (thrash !== null) push(`alternates between two strategies — ${thrash}`);

  // Rescue is a reset; more than one per uninterrupted slump means it is being
  // used as a strategy rather than as an interruption.
  let rescuesThisSlump = 0;
  events.forEach((event, i) => {
    const progressed =
      (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    if (progressed) rescuesThisSlump = 0;
    if (seq[i] === 'RESCUE') rescuesThisSlump += 1;
    if (rescuesThisSlump > 1) push(`rescues twice without the learner making progress (turn ${i + 1})`);
  });

  // Difficulty must never rise on the turn after a failure.
  events.forEach((event, i) => {
    const failed =
      (event.kind === 'activity_result' || event.kind === 'voice_result') && !event.correct;
    if (failed && i + 1 < difficulties.length && difficulties[i + 1]! > difficulties[i]!) {
      push(`difficulty rose from ${difficulties[i]} to ${difficulties[i + 1]} after a failure (turn ${i + 2})`);
    }
  });

  /*
   * A learner who has produced no correct answer for four turns must have been
   * given scaffolding by now. Asking a fifth question of someone who has
   * answered none of the first four is the single complaint the owner's
   * transcripts make most often.
   */
  let sinceProgress = 0;
  events.forEach((event, i) => {
    const progressed =
      (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    sinceProgress = progressed ? 0 : sinceProgress + 1;
    if (sinceProgress >= 4 && QUESTIONING.has(seq[i]!)) {
      push(`still asking (${seq[i]}) after ${sinceProgress} turns with no correct answer (turn ${i + 1})`);
    }
  });

  return problems;
}

function main(): void {
  console.log('== Strategy sequences the controller produces for real learner profiles ==');
  console.log('');
  const all: Problem[] = [];
  for (const profile of PROFILES) {
    const { seq } = run(profile);
    const problems = check(profile);
    all.push(...problems);
    console.log(`  ${problems.length === 0 ? 'ok  ' : 'FAIL'}  ${profile.name}`);
    const completed = seq.length < profile.turns.length ? '  — plan completed, controller dormant' : '';
    console.log(`        ${seq.join(' ')}${completed}`);
    for (const problem of problems) console.log(`        ↳ ${problem.detail}`);
    /*
     * A profile that ends early tested fewer turns than it declares, and saying
     * so is the point: silently measuring three of ten turns and reporting "ok"
     * is how a gate certifies work it never did.
     */
    if (seq.length < profile.turns.length) {
      console.log(`        ↳ only ${seq.length} of ${profile.turns.length} turns ran before the plan was exhausted`);
    }
  }

  console.log('');
  if (all.length > 0) {
    console.log(`verify:pedagogy FAILED — ${all.length} sequence problem(s).`);
    console.log('Each rule may be individually correct; the sequence is what a child experiences.');
    process.exit(1);
  }
  console.log('verify:pedagogy OK — no thrash, no repeated rescue, no endless questioning.');
}

main();
