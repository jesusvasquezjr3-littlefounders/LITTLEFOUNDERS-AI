import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const NUM_A_CAPABILITIES = {
  'math.rekenrek.v2': ['visual.rekenrek.v1', 'operation.slide-beads.v1', 'operation.drag-chips.v1', 'operation.move-menu.v1'],
  'math.abacus.v2': ['visual.abacus.v1', 'operation.slide-beads.v1', 'operation.drag-chips.v1', 'operation.move-menu.v1'],
  'math.number-line.empty.v2': ['visual.empty-number-line.v1', 'operation.draw-jumps.v1'],
  'math.number-line.zoom.v2': ['visual.zoom-number-line.v1', 'operation.zoom-in.v1', 'operation.place-point.v1'],
  'math.clock.v2': ['visual.analog-clock.v1', 'operation.set-hands.v1'],
  'math.ruler.v2': ['visual.ruler.v1', 'operation.stretch-bar.v1'],
  'math.pan-balance.v2': ['visual.pan-balance.v1', 'operation.drag-chips.v1', 'operation.move-menu.v1'],
} as const;

const NUM_A_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: 'math.rekenrek.v2',
    lines: [
      'math.rekenrek.v2: ages 6-9 only. The prompt is one imperative sentence of at most 10 words that names the goal as a bead state (show seven, make ten on the top row), never the count to slide.',
      'math.rekenrek.v2: two rows of ten beads, start as two counts from 0 to 10. Ask to build a number out of fives and ones; the target differs from the start and may need beads moved back.',
    ],
  },
  {
    type: 'math.abacus.v2',
    lines: [
      'math.abacus.v2: ages 6-12. The prompt is one imperative sentence of at most 12 words that names the number to show or the change to make (add 20), never the digits to set.',
      'math.abacus.v2: one to four rods, one digit 0-9 per rod, most significant first. Keep the number of digits equal in the start and the target.',
    ],
  },
  {
    type: 'math.number-line.empty.v2',
    lines: [
      'math.number-line.empty.v2: ages 6-12. The prompt names a start and an end on the line in one imperative sentence of at most 12 words (jump from 47 to 73), never the jumps.',
      'math.number-line.empty.v2: give two to six distinct jump sizes from 1, 2, 5, 10, 20, 50, 100 and a cap of at most 8 jumps. The end must be reachable inside the cap and the line runs 0 to 1000.',
    ],
  },
  {
    type: 'math.number-line.zoom.v2',
    lines: [
      'math.number-line.zoom.v2: ages 10-12 only. The prompt names the decimal to place and says to zoom in, in one imperative sentence of at most 14 words.',
      'math.number-line.zoom.v2: a window of at most 20 whole numbers and a depth of 1 (tenths) or 2 (hundredths). The target is a whole number of the finest grid (3.47 is 347 at depth 2), inside the window.',
    ],
  },
  {
    type: 'math.clock.v2',
    lines: [
      'math.clock.v2: ages 6-12. The prompt names a time or a time that passes in one imperative sentence of at most 12 words, never the hand angles.',
      'math.clock.v2: the start and the target are minutes after 12:00 (0 to 719) whose minute part is a multiple of the step 1, 5, 15 or 30. Use step 15 or 30 for ages 6-7.',
    ],
  },
  {
    type: 'math.ruler.v2',
    lines: [
      'math.ruler.v2: ages 6-12. The prompt asks for a bar of a length in the unit (cm or in) in one imperative sentence of at most 10 words, never the mark to stop on.',
      'math.ruler.v2: the bar starts at a mark that is not always zero; the target is a mark after it, so the length is the target minus the start mark. Keep every mark at 12 or fewer.',
    ],
  },
  {
    type: 'math.pan-balance.v2',
    lines: [
      'math.pan-balance.v2: ages 6-12. The prompt asks to balance the pans or to make one pan heavier by a number, in one imperative sentence of at most 12 words, never which weights to move.',
      'math.pan-balance.v2: up to four fixed weights on each pan and one to six loose weights of 1 to 20. The target is the left total minus the right total (0 is balanced) and must be reachable from the loose weights.',
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const record = (value: unknown): Record<string, unknown> | undefined => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);
const inRange = (value: unknown, min: number, max: number): value is number => whole(value) && value >= min && value <= max;
const counts = (value: unknown, length: number | undefined, min: number, max: number): value is number[] =>
  Array.isArray(value) && (length === undefined ? value.length >= 1 && value.length <= 4 : value.length === length) && value.every((entry) => inRange(entry, min, max));

const LINE_MAX = 1000;
const JUMP_SIZES = [1, 2, 5, 10, 20, 50, 100];
const CLOCK_STEPS = [1, 5, 15, 30];
const RULER_MAX = 12;
const MAX_WEIGHT = 20;

/** Every number a jump list within the cap can end on, by breadth-first search over the allowed sizes. */
function reachableLandings(start: number, sizes: readonly number[], max: number): Set<number> {
  const seen = new Set<number>([start]);
  let frontier = [start];
  for (let step = 0; step < max; step += 1) {
    const next: number[] = [];
    for (const at of frontier) for (const size of sizes) for (const to of [at - size, at + size]) {
      if (to >= 0 && to <= LINE_MAX && !seen.has(to)) { seen.add(to); next.push(to); }
    }
    frontier = next;
  }
  return seen;
}

/** Every left-minus-right difference the loose weights can make: each one stays in the tray or goes on either pan. */
function reachableDifferences(base: number, weights: readonly number[]): Set<number> {
  let seen = new Set<number>([base]);
  for (const weight of weights) {
    const next = new Set<number>();
    for (const difference of seen) { next.add(difference); next.add(difference + weight); next.add(difference - weight); }
    seen = next;
  }
  return seen;
}

const sum = (list: readonly number[]): number => list.reduce((total, weight) => total + weight, 0);
const weightList = (value: unknown, min: number, max: number): value is number[] => Array.isArray(value) && value.length >= min && value.length <= max && value.every((weight) => inRange(weight, 1, MAX_WEIGHT));

interface Check {
  visual: string;
  /** A message when the public payload breaks a rule of the piece. */
  payload: (payload: Record<string, unknown> | undefined) => string | undefined;
  /** A message when the private target is malformed, unreachable or no change. */
  target: (payload: Record<string, unknown>, target: unknown) => string | undefined;
}

const CHECKS: Readonly<Record<string, Check>> = {
  'math.rekenrek.v2': {
    visual: 'rekenrek',
    payload: (payload) => (counts(payload?.start, 2, 0, 10) ? undefined : 'The rekenrek start is two bead counts, each a whole number from 0 to 10'),
    target: (payload, target) => {
      if (!counts(target, 2, 0, 10)) return 'The rekenrek target must be two bead counts, each a whole number from 0 to 10';
      return target.every((count, index) => count === (payload.start as number[])[index]) ? 'The rekenrek target must differ from the start' : undefined;
    },
  },
  'math.abacus.v2': {
    visual: 'abacus',
    payload: (payload) => (counts(payload?.start, undefined, 0, 9) ? undefined : 'The abacus start is one to four rod digits, each a whole number from 0 to 9'),
    target: (payload, target) => {
      const start = payload.start as number[];
      if (!counts(target, start.length, 0, 9)) return 'The abacus target must have one digit from 0 to 9 per rod of the start';
      return target.every((digit, index) => digit === start[index]) ? 'The abacus target must differ from the start' : undefined;
    },
  },
  'math.number-line.empty.v2': {
    visual: 'empty-number-line',
    payload: (payload) => {
      const sizes = payload?.sizes;
      const fine = inRange(payload?.start, 0, LINE_MAX) && inRange(payload?.max, 1, 8) && Array.isArray(sizes) && sizes.length >= 2 && sizes.length <= 6
        && new Set(sizes).size === sizes.length && sizes.every((size) => JUMP_SIZES.includes(size as number));
      return fine ? undefined : 'The empty number line needs a start from 0 to 1000, two to six distinct sizes from 1, 2, 5, 10, 20, 50, 100 and a cap of 1 to 8 jumps';
    },
    target: (payload, target) => {
      if (!inRange(target, 0, LINE_MAX)) return 'The empty number line target must be a whole number from 0 to 1000';
      if (target === payload.start) return 'The empty number line target must differ from the start';
      return reachableLandings(payload.start as number, payload.sizes as number[], payload.max as number).has(target) ? undefined : 'The empty number line target cannot be reached inside the jump cap with those sizes';
    },
  },
  'math.number-line.zoom.v2': {
    visual: 'zoom-number-line',
    payload: (payload) => {
      const fine = inRange(payload?.low, 0, LINE_MAX) && inRange(payload?.high, 0, LINE_MAX) && inRange(payload?.depth, 1, 2) && inRange(payload?.start, 0, LINE_MAX)
        && (payload!.high as number) > (payload!.low as number) && (payload!.high as number) - (payload!.low as number) <= 20 && (payload!.start as number) >= (payload!.low as number) && (payload!.start as number) <= (payload!.high as number);
      return fine ? undefined : 'The zoom number line needs a window of at most 20 whole numbers, a depth of 1 or 2, and a start inside the window';
    },
    target: (payload, target) => {
      const scale = 10 ** (payload.depth as number);
      if (!whole(target) || target < (payload.low as number) * scale || target > (payload.high as number) * scale) return 'The zoom number line target must be a whole number of the finest grid inside the window';
      return target === (payload.start as number) * scale ? 'The zoom number line target must differ from the start' : undefined;
    },
  },
  'math.clock.v2': {
    visual: 'analog-clock',
    payload: (payload) => {
      const fine = inRange(payload?.start, 0, 719) && whole(payload?.step) && CLOCK_STEPS.includes(payload.step) && ((payload.start as number) % 60) % payload.step === 0;
      return fine ? undefined : 'The clock needs a start from 0 to 719 minutes and a step of 1, 5, 15 or 30 that the start minute sits on';
    },
    target: (payload, target) => {
      if (!inRange(target, 0, 719) || ((target % 60) % (payload.step as number)) !== 0) return 'The clock target must be a time from 0 to 719 minutes whose minute part is a multiple of the step';
      return target === payload.start ? 'The clock target must differ from the start' : undefined;
    },
  },
  'math.ruler.v2': {
    visual: 'ruler',
    payload: (payload) => {
      const fine = (payload?.unit === 'cm' || payload?.unit === 'in') && inRange(payload.max, 4, RULER_MAX) && inRange(payload.from, 0, (payload.max as number) - 1) && inRange(payload.start, payload.from as number, payload.max as number);
      return fine ? undefined : 'The ruler needs a unit of cm or in, a bar that starts at a mark before the last, and at most 12 marks';
    },
    target: (payload, target) => {
      if (!inRange(target, (payload.from as number) + 1, payload.max as number)) return 'The ruler target must be a whole mark after the bar start and on the ruler';
      return target === payload.start ? 'The ruler target must differ from the start' : undefined;
    },
  },
  'math.pan-balance.v2': {
    visual: 'pan-balance',
    payload: (payload) => (weightList(payload?.left, 0, 4) && weightList(payload?.right, 0, 4) && weightList(payload?.weights, 1, 6) ? undefined : 'The pan balance needs up to four fixed weights per pan and one to six loose weights, each from 1 to 20'),
    target: (payload, target) => {
      const base = sum(payload.left as number[]) - sum(payload.right as number[]);
      if (!whole(target)) return 'The pan balance target must be a whole number: the left total minus the right total';
      if (target === base) return 'The pan balance target must differ from the difference with every loose weight in the tray';
      return reachableDifferences(base, payload.weights as number[]).has(target) ? undefined : 'The pan balance target cannot be made with those loose weights';
    },
  },
};

/** Gate 4 (solvability): the public payload obeys its piece, the visual matches, and the private target is reachable and is a change. */
function numAGates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const check = typeof segment.type === 'string' && Object.hasOwn(CHECKS, segment.type) ? CHECKS[segment.type]! : undefined;
    if (!check) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const payload = record(segment.payload);
    const broken = check.payload(payload);
    if (broken !== undefined) { problems.push({ gate: 4, segmentId, message: broken }); continue; }
    if ((segment.visual as { type?: unknown } | undefined)?.type !== check.visual) problems.push({ gate: 4, segmentId, message: `The ${String(segment.type)} visual must be ${check.visual}` });
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? (answerKeys[segmentId] as { target?: unknown } | null) : undefined;
    if (key === undefined) continue;
    const message = check.target(payload!, key?.target);
    if (message !== undefined) problems.push({ gate: 4, segmentId, message });
  }
  return problems;
}

export const numA = {
  id: 'num-a',
  capabilities: NUM_A_CAPABILITIES,
  guidance: NUM_A_GUIDANCE,
  gates: numAGates,
} as const satisfies ForgeHorizontePack;
