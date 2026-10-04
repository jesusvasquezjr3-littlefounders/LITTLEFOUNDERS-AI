import { issue, result, searchAssignments, verifyUniqueOrCovered, type SolvabilityChecker, type SolvabilityContext, type SolvabilityIssue, type SolvabilityResult } from '../solvability.js';
import { keysAre, range, whole, type Rec } from './comShared.js';

/*
 * F2.17 trigonometry and calculus explorers. Hand-mirrored from backend/src/services/horizonte/com/{trig,calculus,explorer}.ts.
 * The answer is one choice (a prediction) and one whole number the learner finds by exploring; the key is the model's own
 * computed answer, so it is checked for equality, never trusted.
 */

export const TRIG_VISUALS = ['unit-circle', 'circle-wave'] as const;
export const CALCULUS_VISUALS = ['secant', 'derivative-link', 'riemann', 'accumulation'] as const;
export type TrigVisual = (typeof TRIG_VISUALS)[number];
export type CalculusVisual = (typeof CALCULUS_VISUALS)[number];
type Visual = TrigVisual | CalculusVisual;

export const isTrigVisual = (value: unknown): value is TrigVisual => typeof value === 'string' && (TRIG_VISUALS as readonly string[]).includes(value);
export const isCalculusVisual = (value: unknown): value is CalculusVisual => typeof value === 'string' && (CALCULUS_VISUALS as readonly string[]).includes(value);

interface Truth { predict: string; value: number }

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/* ── trigonometry ── */

const LEVELS = ['zero', 'half', 'root2', 'root3', 'one'] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_VALUE: Readonly<Record<Level, number>> = { zero: 0, half: 0.5, root2: Math.SQRT1_2, root3: Math.sqrt(3) / 2, one: 1 };
const ANGLE_STEPS = [5, 10, 15, 30] as const;
const COS_SIDES = ['upper', 'lower'] as const;
const SIN_SIDES = ['right', 'left'] as const;
const SLOPES = ['rising', 'falling'] as const;
const QUADRANTS = ['quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4', 'axis'] as const;
const TIMES = ['times-1', 'times-2'] as const;
const EPS = 1e-9;
const TURN = Array.from({ length: 360 }, (_, degree) => degree);
type Trig = 'cos' | 'sin';
interface TrigPayload { fn: Trig; level: Level; sign: 1 | -1; narrow?: string; step: number; start: number }

const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const trigAt = (fn: Trig, degrees: number): number => (fn === 'cos' ? Math.cos(rad(degrees)) : Math.sin(rad(degrees)));
const trigSlope = (fn: Trig, degrees: number): number => (fn === 'cos' ? -Math.sin(rad(degrees)) : Math.cos(rad(degrees)));
const quadrantOf = (degrees: number): string => (degrees % 90 === 0 ? 'axis' : `quadrant-${Math.floor(degrees / 90) + 1}`);

/** The two trig payloads in one shape: `fn` is the function (`ask` on the circle), `narrow` picks one of two angles (`side` or `slope`). */
function trigOf(visual: TrigVisual, payload: Rec): TrigPayload {
  return {
    fn: (visual === 'unit-circle' ? payload.ask : payload.fn) as Trig,
    level: payload.level as Level,
    sign: payload.sign as 1 | -1,
    ...((visual === 'unit-circle' ? payload.side : payload.slope) !== undefined ? { narrow: (visual === 'unit-circle' ? payload.side : payload.slope) as string } : {}),
    step: payload.step as number,
    start: payload.start as number,
  };
}

/** Whether the angle is one the task allows: the level is reached and the side (or the slope) matches. */
function fits(visual: TrigVisual, payload: Rec, degrees: number): boolean {
  const trig = trigOf(visual, payload);
  if (Math.abs(trigAt(trig.fn, degrees) - trig.sign * LEVEL_VALUE[trig.level]) >= EPS) return false;
  if (trig.narrow === undefined) return true;
  if (visual === 'unit-circle') {
    const side = trigAt(trig.fn === 'cos' ? 'sin' : 'cos', degrees);
    return trig.narrow === 'upper' || trig.narrow === 'right' ? side > EPS : side < -EPS;
  }
  const slope = trigSlope(trig.fn, degrees);
  return trig.narrow === 'rising' ? slope > EPS : slope < -EPS;
}

const anglesOf = (visual: TrigVisual, payload: Rec): number[] => TURN.filter((degrees) => fits(visual, payload, degrees));

/** Every rule of a trig payload except that exactly one angle fits: the search proves that part. */
function trigShapeProblem(visual: TrigVisual, payload: unknown): string | null {
  const key = visual === 'unit-circle' ? 'ask' : 'fn';
  const narrow = visual === 'unit-circle' ? 'side' : 'slope';
  if (!keysAre(payload, [key, 'level', 'sign', 'step', 'start'], [narrow])) {
    return visual === 'unit-circle' ? 'A unit circle payload holds what to ask, a level, a sign, a step and a start' : 'A wave payload holds the function, a level, a sign, a step and a start';
  }
  if (payload[key] !== 'cos' && payload[key] !== 'sin') return 'The function is cosine or sine';
  if (!(LEVELS as readonly unknown[]).includes(payload.level)) return 'The level is zero, a half, root two, root three or one';
  if (payload.sign !== 1 && payload.sign !== -1) return 'The sign is 1 or -1';
  if (payload.level === 'zero' && payload.sign !== 1) return 'Zero carries no sign';
  if (!(ANGLE_STEPS as readonly unknown[]).includes(payload.step)) return 'The angle step is 5, 10, 15 or 30 degrees';
  if (!whole(payload.start, 0, 359) || payload.start % (payload.step as number) !== 0) return 'The start angle is a whole multiple of the step, below 360';
  const options: readonly unknown[] = visual === 'unit-circle' ? (payload[key] === 'cos' ? COS_SIDES : SIN_SIDES) : SLOPES;
  if (payload.level === 'one') {
    if (payload[narrow] !== undefined) return visual === 'unit-circle' ? 'A level of one has a single angle, so it names no side' : 'A peak or a trough has no slope to name';
  } else if (!options.includes(payload[narrow])) {
    return visual === 'unit-circle' ? (payload[key] === 'cos' ? 'A cosine level names the upper or the lower half' : 'A sine level names the right or the left half') : 'A level below the peak names a rising or a falling wave';
  }
  return null;
}

/** The rules that follow once the angles are known. */
function trigAnglesProblem(visual: TrigVisual, payload: Rec, found: readonly number[]): string | null {
  if (found.length !== 1) return visual === 'unit-circle' ? 'Exactly one angle fits the level and the side' : 'Exactly one angle fits the level and the slope';
  if (found[0]! % (payload.step as number) !== 0) return 'The answer is a whole multiple of the step';
  if (found[0] === payload.start) return 'The start angle is not the answer';
  return null;
}

function trigProblem(visual: TrigVisual, payload: unknown): string | null {
  return trigShapeProblem(visual, payload) ?? trigAnglesProblem(visual, payload as Rec, anglesOf(visual, payload as Rec));
}

function trigTruth(visual: TrigVisual, payload: Rec): Truth {
  const angle = anglesOf(visual, payload)[0]!;
  return { predict: visual === 'unit-circle' ? quadrantOf(angle) : payload.level === 'one' ? 'times-1' : 'times-2', value: angle };
}

/* ── calculus ── */

const COEFF_MAX = 9;
const SLOPE_MAX = 20;
const ROOT_MAX = 3;
const DOMAIN_X = 4;
const RIEMANN_N_MAX = 40;
const RIEMANN_METHODS = ['left', 'right', 'midpoint', 'trapezoid'] as const;
const SIGN_OPTIONS = ['positive', 'negative', 'zero'] as const;
const DIRECTION_OPTIONS = ['rising', 'falling'] as const;
const ERROR_OPTIONS = ['too-small', 'too-big'] as const;
const GROWTH_OPTIONS = ['growing', 'shrinking', 'flat'] as const;
type Coeffs = [number, number, number, number];
interface SecantPayload { coeffs: Coeffs; a: number }
interface LinkPayload { lead: 1 | -1; roots: [number, number]; base: number; ask: 'max' | 'min' }
interface RiemannPayload { coeffs: Coeffs; from: number; to: number; method: (typeof RIEMANN_METHODS)[number]; tolerance: number }
interface AccumulationPayload { coeffs: Coeffs; from: number; to: number; target: number }

const isCoeffs = (value: unknown): value is Coeffs => Array.isArray(value) && value.length === 4 && value.every((c) => whole(c, -COEFF_MAX, COEFF_MAX));
const evalPoly = (c: readonly number[], x: number): number => c[0]! + x * (c[1]! + x * (c[2]! + x * c[3]!));
const slopeAt = (c: readonly number[], x: number): number => c[1]! + x * (2 * c[2]! + x * 3 * c[3]!);

/** The exact area under the polynomial from `from` to `to`, times twelve, so it stays a whole number. */
function areaTwelfths(c: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let k = 0; k < 4; k += 1) total += c[k]! * (to ** (k + 1) - from ** (k + 1)) * (12 / (k + 1));
  return total;
}
const areaOf = (c: readonly number[], from: number, to: number): number => areaTwelfths(c, from, to) / 12;

function secantProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['coeffs', 'a']) || !isCoeffs(payload.coeffs) || !whole(payload.a, -3, 3)) return 'A secant payload holds four whole coefficients and a whole point';
  if (Math.abs(slopeAt(payload.coeffs, payload.a)) > SLOPE_MAX) return `The slope at the point stays within ${SLOPE_MAX} either way`;
  if (payload.coeffs[2] === 0 && payload.coeffs[3] === 0) return 'A straight line has no secant to close in';
  return null;
}

function linkProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['lead', 'roots', 'base', 'ask'])) return 'A linked graphs payload holds a lead, two roots, a base and what to find';
  if (payload.lead !== 1 && payload.lead !== -1) return 'The lead is 1 or -1';
  const roots = payload.roots;
  if (!Array.isArray(roots) || roots.length !== 2 || !roots.every((r) => whole(r, -ROOT_MAX, ROOT_MAX)) || (roots[1] as number) - (roots[0] as number) < 2) return `The two roots are whole numbers within ${ROOT_MAX}, at least 2 apart`;
  if (!whole(payload.base, -5, 5)) return 'The base is a whole number from -5 to 5';
  if (payload.ask !== 'max' && payload.ask !== 'min') return 'The task asks for the max or the min';
  return null;
}

function riemannApprox(p: Pick<RiemannPayload, 'coeffs' | 'from' | 'to' | 'method'>, n: number): number {
  const h = (p.to - p.from) / n;
  const f = (x: number) => evalPoly(p.coeffs, x);
  let sum = 0;
  if (p.method === 'trapezoid') {
    sum = (f(p.from) + f(p.to)) / 2;
    for (let i = 1; i < n; i += 1) sum += f(p.from + i * h);
  } else {
    const shift = p.method === 'left' ? 0 : p.method === 'right' ? 1 : 0.5;
    for (let i = 0; i < n; i += 1) sum += f(p.from + (i + shift) * h);
  }
  return sum * h;
}

const riemannError = (p: RiemannPayload, n: number): number => riemannApprox(p, n) - areaOf(p.coeffs, p.from, p.to);

/** The fewest rectangles whose estimate lands within the tolerance, and the sign of the error all along; null when either is unclear. */
function riemannTruth(p: RiemannPayload): { n: number; sign: 'too-small' | 'too-big' } | null {
  const slack = 1e-6 * Math.max(1, p.tolerance);
  let first = 0;
  let direction = 0;
  for (let n = 1; n <= RIEMANN_N_MAX; n += 1) {
    const error = riemannError(p, n);
    if (Math.abs(error) < 1e-9) return null;
    if (direction === 0) direction = sign(error);
    else if (sign(error) !== direction) return null;
    const inside = Math.abs(error) <= p.tolerance;
    if (Math.abs(Math.abs(error) - p.tolerance) < slack) return null;
    if (inside && first === 0) first = n;
    if (!inside && first !== 0) return null;
  }
  if (first < 2) return null;
  return { n: first, sign: direction > 0 ? 'too-big' : 'too-small' };
}

/** Every rule of a Riemann payload except the clear first n: the search and the truth prove that part. */
function riemannShapeProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['coeffs', 'from', 'to', 'method', 'tolerance']) || !isCoeffs(payload.coeffs)) return 'A Riemann payload holds four whole coefficients, an interval, a method and a tolerance';
  if (!whole(payload.from, -3, 6) || !whole(payload.to, -3, 6) || payload.to - payload.from < 2 || payload.to - payload.from > 8) return 'The interval is whole numbers from -3 to 6, 2 to 8 wide';
  if (!(RIEMANN_METHODS as readonly unknown[]).includes(payload.method)) return 'The method is left, right, midpoint or trapezoid';
  if (typeof payload.tolerance !== 'number' || !(payload.tolerance >= 0.01 && payload.tolerance <= 20) || Math.abs(payload.tolerance * 100 - Math.round(payload.tolerance * 100)) > 1e-9) return 'The tolerance is from 0.01 to 20, in hundredths';
  const p = payload as unknown as RiemannPayload;
  for (let i = 0; i <= (p.to - p.from) * 20; i += 1) if (evalPoly(p.coeffs, p.from + i / 20) < 0) return 'The curve stays above the axis on the interval';
  return null;
}

const RIEMANN_UNCLEAR = 'The error keeps one sign, and the first n within the tolerance is clear, and it stays within';
const riemannProblem = (payload: unknown): string | null => riemannShapeProblem(payload) ?? (riemannTruth(payload as RiemannPayload) === null ? RIEMANN_UNCLEAR : null);

function accumulationShapeProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['coeffs', 'from', 'to', 'target']) || !isCoeffs(payload.coeffs)) return 'An accumulation payload holds four whole coefficients, an interval and a target';
  if (!whole(payload.from, -4, 3) || !whole(payload.to, -4, 8) || payload.to - payload.from < 3 || payload.to - payload.from > 8) return 'The interval is whole numbers, 3 to 8 wide, starting from -4 to 3 and ending by 8';
  if (!whole(payload.target, -99, 99) || payload.target === 0) return 'The target is a whole number from -99 to 99, never zero';
  return null;
}

/** The whole numbers x after `from` where the accumulated area equals the target. */
const accumulationHits = (p: AccumulationPayload): number[] => range(p.from + 1, p.to).filter((x) => areaTwelfths(p.coeffs, p.from, x) === 12 * p.target);
const ACCUMULATION_UNIQUE = 'Exactly one whole number on the interval gives the target';
const accumulationProblem = (payload: unknown): string | null => accumulationShapeProblem(payload) ?? (accumulationHits(payload as AccumulationPayload).length === 1 ? null : ACCUMULATION_UNIQUE);

/* ── the piece ── */

/** Returns the first rule the payload breaks for this visual, or null. Total on any input. */
export function explorerProblem(visual: unknown, payload: unknown): string | null {
  switch (visual) {
    case 'unit-circle':
    case 'circle-wave': return trigProblem(visual, payload);
    case 'secant': return secantProblem(payload);
    case 'derivative-link': return linkProblem(payload);
    case 'riemann': return riemannProblem(payload);
    case 'accumulation': return accumulationProblem(payload);
    default: return 'This kind has no such visual';
  }
}

function explorerOptions(visual: Visual): readonly string[] {
  switch (visual) {
    case 'unit-circle': return QUADRANTS;
    case 'circle-wave': return TIMES;
    case 'secant': return SIGN_OPTIONS;
    case 'derivative-link': return DIRECTION_OPTIONS;
    case 'riemann': return ERROR_OPTIONS;
    default: return GROWTH_OPTIONS;
  }
}

/** The whole numbers the answer may take, both ends included. */
function explorerRange(visual: Visual, payload: Rec): readonly [number, number] {
  switch (visual) {
    case 'unit-circle':
    case 'circle-wave': return [0, 359];
    case 'secant': return [-SLOPE_MAX, SLOPE_MAX];
    case 'derivative-link': return [-DOMAIN_X, DOMAIN_X];
    case 'riemann': return [1, RIEMANN_N_MAX];
    default: return [payload.from as number, payload.to as number];
  }
}

/** What the model says: the one prediction and the one number that are right. Only for a payload that passed `explorerProblem`. */
function explorerTruth(visual: Visual, payload: Rec): Truth {
  switch (visual) {
    case 'unit-circle':
    case 'circle-wave': return trigTruth(visual, payload);
    case 'secant': {
      const p = payload as unknown as SecantPayload;
      const slope = slopeAt(p.coeffs, p.a);
      return { predict: slope > 0 ? 'positive' : slope < 0 ? 'negative' : 'zero', value: slope };
    }
    case 'derivative-link': {
      const p = payload as unknown as LinkPayload;
      const [low, high] = p.roots;
      return { predict: p.lead > 0 ? 'falling' : 'rising', value: p.ask === 'max' ? (p.lead > 0 ? low : high) : (p.lead > 0 ? high : low) };
    }
    case 'riemann': { const truth = riemannTruth(payload as unknown as RiemannPayload)!; return { predict: truth.sign, value: truth.n }; }
    default: {
      const p = payload as unknown as AccumulationPayload;
      const x = accumulationHits(p)[0]!;
      const rate = sign(evalPoly(p.coeffs, x));
      return { predict: rate > 0 ? 'growing' : rate < 0 ? 'shrinking' : 'flat', value: x };
    }
  }
}

/** The key of an explorer is `{ predict, value }` and must equal what the model computes. Only for a payload that passed `explorerProblem`. */
export function explorerKeyProblem(visual: unknown, payload: unknown, key: unknown): string | null {
  if (!isTrigVisual(visual) && !isCalculusVisual(visual)) return 'This kind has no such visual';
  if (explorerProblem(visual, payload) !== null) return 'The payload is malformed';
  if (!keysAre(key, ['predict', 'value']) || typeof key.predict !== 'string' || typeof key.value !== 'number' || !Number.isInteger(key.value)) return 'The key is { predict, value }: a prediction and a whole number';
  const options = explorerOptions(visual);
  if (!options.includes(key.predict)) return `The prediction is one of ${options.join(', ')}`;
  const [low, high] = explorerRange(visual, payload as Rec);
  if (key.value < low || key.value > high) return `The value is a whole number from ${low} to ${high}`;
  const truth = explorerTruth(visual, payload as Rec);
  return key.predict === truth.predict && key.value === truth.value ? null : 'The key must be the answer the model computes';
}

/* ── solvability ── */

const block = (message: string): SolvabilityResult => result([issue('impossible-state', message)]);

/** Searches the whole numbers in `values` for those that are the answer, so none, one or many read as no-solution, ok or ambiguous-solution. */
function findOne(subject: string, values: readonly number[], isAnswer: (value: number) => boolean, context: SolvabilityContext): SolvabilityResult {
  return verifyUniqueOrCovered((limit) => searchAssignments<number>({
    domains: [values],
    isSolution: (full) => isAnswer(full[0]!),
    key: (full) => String(full[0]),
    limit,
    maxNodes: context.nodeBudget,
  }), { subject });
}

function finish(subject: string, visual: Visual, payload: Rec, context: SolvabilityContext, searched: SolvabilityResult): SolvabilityResult {
  if (!searched.ok) return searched;
  const problems: SolvabilityIssue[] = [];
  const broken = explorerProblem(visual, payload);
  if (broken) problems.push(issue('impossible-state', `${subject}: ${broken}`));
  else if (context.answerKey !== undefined) {
    const wrong = explorerKeyProblem(visual, payload, context.answerKey);
    if (wrong) problems.push(issue('impossible-state', `${subject}: ${wrong}`));
  }
  return result([...searched.issues, ...problems], { ...(searched.stats ?? {}), keyed: context.answerKey === undefined ? 0 : 1 });
}

export function trigVisualOf(payload: Rec): TrigVisual | null {
  return payload.ask !== undefined ? 'unit-circle' : payload.fn !== undefined ? 'circle-wave' : null;
}

export const trigChecker: SolvabilityChecker = (segment, context) => {
  const payload = segment.payload;
  const visual = trigVisualOf(payload);
  if (visual === null) return block(`trigonometry segment ${segment.id}: the payload matches no visual (the unit circle has "ask", the wave has "fn")`);
  const subject = `${visual} ${segment.id}`;
  const shape = trigShapeProblem(visual, payload);
  if (shape) return block(`${subject}: ${shape}`);
  return finish(subject, visual, payload, context, findOne(subject, TURN, (degrees) => fits(visual, payload, degrees), context));
};

export function calculusVisualOf(payload: Rec): CalculusVisual | null {
  if (payload.lead !== undefined) return 'derivative-link';
  if (payload.method !== undefined) return 'riemann';
  if (payload.target !== undefined) return 'accumulation';
  return payload.a !== undefined ? 'secant' : null;
}

export const calculusChecker: SolvabilityChecker = (segment, context) => {
  const payload = segment.payload;
  const visual = calculusVisualOf(payload);
  if (visual === null) return block(`calculus segment ${segment.id}: the payload matches no visual (a secant has "a", linked graphs "lead", a Riemann sum "method", accumulation "target")`);
  const subject = `${visual} ${segment.id}`;
  if (visual === 'secant' || visual === 'derivative-link') {
    const broken = explorerProblem(visual, payload);
    if (broken) return block(`${subject}: ${broken}`);
    return finish(subject, visual, payload, context, result([], { solutions: 1 }));
  }
  if (visual === 'riemann') {
    const shape = riemannShapeProblem(payload);
    if (shape) return block(`${subject}: ${shape}`);
    const p = payload as unknown as RiemannPayload;
    const inside = (n: number) => Math.abs(riemannError(p, n)) <= p.tolerance;
    return finish(subject, visual, payload, context, findOne(subject, range(1, RIEMANN_N_MAX), (n) => inside(n) && (n === 1 || !inside(n - 1)), context));
  }
  const shape = accumulationShapeProblem(payload);
  if (shape) return block(`${subject}: ${shape}`);
  const p = payload as unknown as AccumulationPayload;
  return finish(subject, visual, payload, context, findOne(subject, range(p.from + 1, p.to), (x) => areaTwelfths(p.coeffs, p.from, x) === 12 * p.target, context));
};
