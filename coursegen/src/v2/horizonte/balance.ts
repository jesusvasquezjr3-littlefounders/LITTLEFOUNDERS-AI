import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

/* Must stay identical to the Core and browser literals: `check-v2-lesson-capability-parity.mjs` compares the three. */
export const BALANCE_CAPABILITIES = {
  'math.equation-balance.v2': ['visual.equation-balance.v1', 'operation.balance-ops.v1', 'operation.number-input.v1', 'visual.math-notation.v1'],
  'math.visual-proof.v2': ['visual.visual-proof.v1', 'operation.drag-pieces.v1', 'operation.predict-choice.v1', 'operation.number-input.v1'],
} as const;

const BALANCE = 'math.equation-balance.v2';
const PROOF = 'math.visual-proof.v2';

const BALANCE_GUIDANCE: readonly ForgeGuidance[] = [{
  type: BALANCE,
  lines: [
    `${BALANCE}: ages 10-14 only. The prompt is at most two sentences that name the goal (keep the scale level, do the same on both pans, find x), never the answer, the route or a step count.`,
    `${BALANCE}: payload.start is the two pans as { l: { x, u }, r: { x, u } } (x-blocks 0-8, unit counters 0-30, x on at least one pan, the two x counts different so x has one value). payload.ops are distinct ids from sub-x, sub-unit, add-unit, div-2, div-3, div-4, div-5 (the route moves) and slip-left, slip-right (one pan only, which tips the scale and teaches why).`,
    `${BALANCE}: offer only moves a route can use plus at most one slip. Every start must be solvable with the offered route moves (a division only when every count divides), and the key is { "x": whole number 0-99 } that makes both pans equal. Never put the key or a worked route in the segment.`,
  ],
}, {
  type: PROOF,
  lines: [
    `${PROOF}: ages 10-15 (the Pythagoras visual only 13-15). The learner predicts the formula before seeing the pieces move, so the prompt asks for a prediction and never states the formula, the value or the word area before the pieces move.`,
    `${PROOF}: pick the visual that matches the formula: parallelogram-area, triangle-area, trapezoid-area, circle-area, circumference-unroll, pythagoras-proof, odd-sum-proof. payload holds that visual's measures (parallelogram base, height, slant; triangle base, height, apex; trapezoid top, bottom, height, offset; circle radius and sectors; circumference diameter; pythagoras legs a and b of a whole triple; odd-sum n from 3 to 7) plus 3-5 distinct formula choices from that visual's pool, the right one among them, never marked.`,
    `${PROOF}: circle area and circumference use pi as 3.14, said in the prompt. The key is { "choice": the right formula id, "value": the exact value as plain decimal text } and must match the figure: area base x height, half of that for the triangle, half the sum of the bases x height, 3.14 x radius x radius, 3.14 x diameter, the long side of the triple, n x n.`,
  ],
}];

const whole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const keysOf = (value: Record<string, unknown>) => Object.keys(value).sort().join();
const problem = (segmentId: string, message: string): GateProblem => ({ gate: 4, segmentId, message });
const idOf = (segment: Record<string, unknown>) => (typeof segment.id === 'string' ? segment.id : '(segment)');
const keyOf = (answerKeys: Record<string, unknown> | undefined, segmentId: string): unknown =>
  (answerKeys && Object.hasOwn(answerKeys, segmentId) ? answerKeys[segmentId] : undefined);

/* ---------- F1.8: a route must exist ---------- */

type Pan = { x: number; u: number };
type Scale = { l: Pan; r: Pan };
const ROUTE_OPS = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'div-3', 'div-4', 'div-5'] as const;
const SLIP_OPS = ['slip-left', 'slip-right'] as const;
const MAX_X = 8;
const MAX_UNITS = 30;
const MAX_ANSWER = 99;
const MAX_STEPS = 16;

const isPan = (value: unknown): value is Pan => plain(value) && keysOf(value) === 'u,x' && whole(value.x, 0, MAX_X) && whole(value.u, 0, MAX_UNITS);
const isStart = (value: unknown): value is Scale => plain(value) && keysOf(value) === 'l,r' && isPan(value.l) && isPan(value.r) && value.l.x + value.r.x >= 1;
const solved = ({ l, r }: Scale) => (l.x === 1 && l.u === 0 && r.x === 0) || (r.x === 1 && r.u === 0 && l.x === 0);

function step(scale: Scale, op: string): Scale | null {
  const { l, r } = scale;
  switch (op) {
    case 'sub-x': return l.x >= 1 && r.x >= 1 ? { l: { x: l.x - 1, u: l.u }, r: { x: r.x - 1, u: r.u } } : null;
    case 'sub-unit': return l.u >= 1 && r.u >= 1 ? { l: { x: l.x, u: l.u - 1 }, r: { x: r.x, u: r.u - 1 } } : null;
    case 'add-unit': return l.u < MAX_UNITS && r.u < MAX_UNITS ? { l: { x: l.x, u: l.u + 1 }, r: { x: r.x, u: r.u + 1 } } : null;
    default: {
      const n = Number(op.slice('div-'.length));
      const all = [l.x, l.u, r.x, r.u];
      return all.every((count) => count % n === 0) && all.some((count) => count > 0)
        ? { l: { x: l.x / n, u: l.u / n }, r: { x: r.x / n, u: r.u / n } } : null;
    }
  }
}

/** The value x takes at the end of the shortest route made of the offered route moves, or null when none isolates x. */
function routeValue(start: Scale, offered: readonly string[]): number | null {
  const ops = offered.filter((op) => (ROUTE_OPS as readonly string[]).includes(op));
  const keyOfScale = ({ l, r }: Scale) => `${l.x},${l.u},${r.x},${r.u}`;
  const seen = new Set([keyOfScale(start)]);
  let frontier: Scale[] = [start];
  for (let depth = 0; depth < MAX_STEPS && frontier.length > 0; depth += 1) {
    const next: Scale[] = [];
    for (const scale of frontier) {
      for (const op of ops) {
        const after = step(scale, op);
        if (after === null || seen.has(keyOfScale(after))) continue;
        seen.add(keyOfScale(after));
        if (solved(after)) return after.l.x === 1 ? after.r.u : after.l.u;
        next.push(after);
      }
    }
    frontier = next;
  }
  return null;
}

function balanceProblems(segment: Record<string, unknown>, answerKeys?: Record<string, unknown>): GateProblem[] {
  const segmentId = idOf(segment);
  const payload = segment.payload;
  if (!plain(payload) || keysOf(payload) !== 'ops,start' || !isStart(payload.start)) return [problem(segmentId, 'The balance start is two pans, each with x-blocks 0-8 and units 0-30, and x on at least one pan')];
  const ops = payload.ops;
  const vocabulary: readonly string[] = [...ROUTE_OPS, ...SLIP_OPS];
  if (!Array.isArray(ops) || ops.length < 1 || !ops.every((op) => typeof op === 'string' && vocabulary.includes(op)) || new Set(ops).size !== ops.length
    || !ops.some((op) => (ROUTE_OPS as readonly string[]).includes(op as string))) return [problem(segmentId, 'The balance offers distinct known operations, at least one that keeps the scale level')];
  const found: GateProblem[] = [];
  if ((segment.visual as { type?: unknown } | undefined)?.type !== 'equation-balance') found.push(problem(segmentId, 'The balance visual must be equation-balance'));
  const start = payload.start;
  if (solved(start)) return [...found, problem(segmentId, 'The balance start already has x alone')];
  if (start.l.x === start.r.x) found.push(problem(segmentId, 'The two pans need different x counts, or x has no single value'));
  const key = keyOf(answerKeys, segmentId);
  if (key === undefined) return found;
  const route = routeValue(start, ops as string[]);
  if (route === null) found.push(problem(segmentId, 'No route of the offered operations leaves x alone: the puzzle cannot be solved'));
  if (!plain(key) || keysOf(key) !== 'x' || !whole(key.x, 0, MAX_ANSWER)) found.push(problem(segmentId, 'The balance key is { x } with x a whole number from 0 to 99'));
  else {
    if (start.l.x * key.x + start.l.u !== start.r.x * key.x + start.r.u) found.push(problem(segmentId, 'The balance key x does not make the two pans equal'));
    else if (route !== null && route !== key.x) found.push(problem(segmentId, 'The balance route ends at a different x than the key'));
  }
  return found;
}

/* ---------- F1.15: the key must match the geometry it names ---------- */

type Visual = 'parallelogram-area' | 'triangle-area' | 'trapezoid-area' | 'circle-area' | 'circumference-unroll' | 'pythagoras-proof' | 'odd-sum-proof';
const FORMULAS: Readonly<Record<Visual, { correct: string; pool: readonly string[] }>> = {
  'parallelogram-area': { correct: 'base-height', pool: ['base-height', 'half-base-height', 'base-plus-height'] },
  'triangle-area': { correct: 'half-base-height', pool: ['base-height', 'half-base-height', 'base-plus-height'] },
  'trapezoid-area': { correct: 'half-sum-bases-height', pool: ['half-sum-bases-height', 'sum-bases-height', 'half-base-height'] },
  'circle-area': { correct: 'pi-r-squared', pool: ['pi-r-squared', 'pi-diameter', 'pi-radius', 'radius-squared'] },
  'circumference-unroll': { correct: 'pi-diameter', pool: ['pi-diameter', 'pi-r-squared', 'pi-radius', 'radius-squared'] },
  'pythagoras-proof': { correct: 'legs-squares-sum', pool: ['legs-squares-sum', 'legs-sum-squared', 'legs-sum', 'legs-product'] },
  'odd-sum-proof': { correct: 'n-times-n', pool: ['n-times-n', 'n-plus-n', 'n-times-two'] },
};
const PAYLOAD_KEYS: Readonly<Record<Visual, string>> = {
  'parallelogram-area': 'base,choices,height,slant', 'triangle-area': 'apex,base,choices,height', 'trapezoid-area': 'bottom,choices,height,offset,top',
  'circle-area': 'choices,radius,sectors', 'circumference-unroll': 'choices,diameter', 'pythagoras-proof': 'a,b,choices', 'odd-sum-proof': 'choices,n',
};
const isVisual = (value: unknown): value is Visual => typeof value === 'string' && Object.hasOwn(FORMULAS, value);
const isTriple = (a: number, b: number) => { const c = Math.round(Math.sqrt(a * a + b * b)); return c * c === a * a + b * b; };

/** Why a payload does not fit its visual, or null. */
function proofPayloadFault(visual: Visual, payload: unknown): string | null {
  if (!plain(payload) || keysOf(payload) !== PAYLOAD_KEYS[visual]) return 'The proof payload fields do not match the visual';
  const formulas = FORMULAS[visual];
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length < 3 || choices.length > 5 || new Set(choices).size !== choices.length
    || !choices.every((choice) => typeof choice === 'string' && formulas.pool.includes(choice)) || !choices.includes(formulas.correct)) return 'The proof choices must be 3-5 distinct formulas of this visual, with the right one among them';
  const p = payload;
  switch (visual) {
    case 'parallelogram-area': return whole(p.base, 2, 20) && whole(p.height, 1, 20) && whole(p.slant, 1, 19) && p.slant < p.base ? null : 'The parallelogram needs base 2-20, height 1-20 and a slant from 1 up to the base minus 1';
    case 'triangle-area': return whole(p.base, 1, 20) && whole(p.height, 1, 20) && whole(p.apex, 0, 20) && p.apex <= p.base ? null : 'The triangle needs base 1-20, height 1-20 and an apex from 0 up to the base';
    case 'trapezoid-area': return whole(p.top, 1, 19) && whole(p.bottom, 2, 20) && p.top < p.bottom && whole(p.height, 1, 20) && whole(p.offset, 0, 19) && p.offset <= p.bottom - p.top ? null : 'The trapezoid needs a top below the bottom, height 1-20 and an offset from 0 up to bottom minus top';
    case 'circle-area': {
      const sectors = p.sectors;
      return whole(p.radius, 1, 12) && Array.isArray(sectors) && sectors.length >= 2 && sectors.length <= 5
        && sectors.every((count, index) => whole(count, 4, 48) && count % 2 === 0 && (index === 0 || count > (sectors[index - 1] as number))) ? null : 'The circle needs radius 1-12 and 2-5 increasing even slice counts from 4 to 48';
    }
    case 'circumference-unroll': return whole(p.diameter, 1, 20) ? null : 'The circumference needs a diameter from 1 to 20';
    case 'pythagoras-proof': return whole(p.a, 3, 20) && whole(p.b, 3, 20) && isTriple(p.a, p.b) ? null : 'Pythagoras needs legs 3-20 that make a whole long side';
    case 'odd-sum-proof': return whole(p.n, 3, 7) ? null : 'The odd sum needs n from 3 to 7';
  }
}

/** The exact value text the visual asks for: area or length in hundredths, so pi = 3.14 stays exact. */
function proofValueText(visual: Visual, p: Record<string, number>): string {
  const hundredths = ((): number => {
    switch (visual) {
      case 'parallelogram-area': return p.base! * p.height! * 100;
      case 'triangle-area': return (p.base! * p.height! * 100) / 2;
      case 'trapezoid-area': return ((p.top! + p.bottom!) * p.height! * 100) / 2;
      case 'circle-area': return 314 * p.radius! * p.radius!;
      case 'circumference-unroll': return 314 * p.diameter!;
      case 'pythagoras-proof': return Math.round(Math.sqrt(p.a! * p.a! + p.b! * p.b!)) * 100;
      case 'odd-sum-proof': return p.n! * p.n! * 100;
    }
  })();
  const integer = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction === '' ? String(integer) : `${integer}.${fraction}`;
}

function proofProblems(segment: Record<string, unknown>, answerKeys?: Record<string, unknown>): GateProblem[] {
  const segmentId = idOf(segment);
  const visual = (segment.visual as { type?: unknown } | undefined)?.type;
  if (!isVisual(visual)) return [problem(segmentId, 'The proof visual must be one of the seven proof figures')];
  const fault = proofPayloadFault(visual, segment.payload);
  if (fault !== null) return [problem(segmentId, fault)];
  const key = keyOf(answerKeys, segmentId);
  if (key === undefined) return [];
  if (!plain(key) || keysOf(key) !== 'choice,value' || typeof key.choice !== 'string' || typeof key.value !== 'string') return [problem(segmentId, 'The proof key is { choice, value } with the value as plain decimal text')];
  const found: GateProblem[] = [];
  if (key.choice !== FORMULAS[visual].correct) found.push(problem(segmentId, 'The proof key names a formula that does not fit the figure'));
  const expected = proofValueText(visual, segment.payload as Record<string, number>);
  if (key.value !== expected) found.push(problem(segmentId, `The proof key value does not match the figure (the figure gives ${expected}, with pi as 3.14)`));
  return found;
}

/** Gate 4 (solvability): a balance has a route to x and a proof key matches the geometry it names. */
function balanceGates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  return segments.flatMap((segment) => {
    if (segment.type === BALANCE) return balanceProblems(segment, answerKeys);
    if (segment.type === PROOF) return proofProblems(segment, answerKeys);
    return [];
  });
}

export const balance = {
  id: 'balance',
  capabilities: BALANCE_CAPABILITIES,
  guidance: BALANCE_GUIDANCE,
  gates: balanceGates,
} as const satisfies ForgeHorizontePack;
