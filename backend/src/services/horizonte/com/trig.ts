import { exactKeys, isWhole } from './arrange.js';

/* F2.17 trigonometry: the unit circle (F02) and the circle unrolled into a wave (F03). Every special angle is a whole number of degrees. */

export const LEVELS = ['zero', 'half', 'root2', 'root3', 'one'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_VALUE: Readonly<Record<Level, number>> = { zero: 0, half: 0.5, root2: Math.SQRT1_2, root3: Math.sqrt(3) / 2, one: 1 };
export const ANGLE_STEPS = [5, 10, 15, 30] as const;
export const COS_SIDES = ['upper', 'lower'] as const;
export const SIN_SIDES = ['right', 'left'] as const;
export const SLOPES = ['rising', 'falling'] as const;
export const QUADRANT_OPTIONS = ['quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4', 'axis'] as const;
export const TIMES_OPTIONS = ['times-1', 'times-2'] as const;

export type Trig = 'cos' | 'sin';
export interface UnitCirclePayload { ask: Trig; level: Level; sign: 1 | -1; side?: (typeof COS_SIDES)[number] | (typeof SIN_SIDES)[number]; step: (typeof ANGLE_STEPS)[number]; start: number }
export interface CircleWavePayload { fn: Trig; level: Level; sign: 1 | -1; slope?: (typeof SLOPES)[number]; step: (typeof ANGLE_STEPS)[number]; start: number }

const EPS = 1e-9;
const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const TURN = Array.from({ length: 360 }, (_, degree) => degree);

export const levelValue = (level: Level, sign: 1 | -1): number => sign * LEVEL_VALUE[level];
export const trigAt = (fn: Trig, degrees: number): number => (fn === 'cos' ? Math.cos(rad(degrees)) : Math.sin(rad(degrees)));
/** The slope of the wave at an angle, per radian. */
export const trigSlope = (fn: Trig, degrees: number): number => (fn === 'cos' ? -Math.sin(rad(degrees)) : Math.cos(rad(degrees)));

/** The whole-degree angles in one turn where `fn` reaches the level; the side or the slope picks one of the two. */
function anglesFor(fn: Trig, level: Level, sign: 1 | -1, filter: (degrees: number) => boolean): number[] {
  const target = levelValue(level, sign);
  return TURN.filter((degrees) => Math.abs(trigAt(fn, degrees) - target) < EPS && filter(degrees));
}

function commonProblem(payload: Record<string, unknown>, keyFn: 'ask' | 'fn'): string | null {
  if (payload[keyFn] !== 'cos' && payload[keyFn] !== 'sin') return 'The function is cosine or sine';
  if (!(LEVELS as readonly unknown[]).includes(payload.level)) return 'The level is zero, a half, root two, root three or one';
  if (payload.sign !== 1 && payload.sign !== -1) return 'The sign is 1 or -1';
  if (payload.level === 'zero' && payload.sign !== 1) return 'Zero carries no sign';
  if (!(ANGLE_STEPS as readonly unknown[]).includes(payload.step)) return 'The angle step is 5, 10, 15 or 30 degrees';
  if (!isWhole(payload.start, 0, 359) || payload.start % (payload.step as number) !== 0) return 'The start angle is a whole multiple of the step, below 360';
  return null;
}

export function unitCircleProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['ask', 'level', 'sign', 'step', 'start'], ['side'])) return 'A unit circle payload holds what to ask, a level, a sign, a step and a start';
  const bad = commonProblem(payload, 'ask');
  if (bad) return bad;
  const ask = payload.ask as Trig;
  const level = payload.level as Level;
  const sides: readonly unknown[] = ask === 'cos' ? COS_SIDES : SIN_SIDES;
  if (level === 'one') { if (payload.side !== undefined) return 'A level of one has a single angle, so it names no side'; }
  else if (!sides.includes(payload.side)) return ask === 'cos' ? 'A cosine level names the upper or the lower half' : 'A sine level names the right or the left half';
  const found = unitCircleAngles(payload as unknown as UnitCirclePayload);
  if (found.length !== 1) return 'Exactly one angle fits the level and the side';
  if (found[0]! % (payload.step as number) !== 0) return 'The answer is a whole multiple of the step';
  if (found[0] === payload.start) return 'The start angle is not the answer';
  return null;
}

export function unitCircleAngles(payload: UnitCirclePayload): number[] {
  const other = payload.ask === 'cos' ? 'sin' : 'cos';
  return anglesFor(payload.ask, payload.level, payload.sign, (degrees) => {
    if (payload.side === undefined) return true;
    const side = trigAt(other, degrees);
    return payload.side === 'upper' || payload.side === 'right' ? side > EPS : side < -EPS;
  });
}

export function circleWaveProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['fn', 'level', 'sign', 'step', 'start'], ['slope'])) return 'A wave payload holds the function, a level, a sign, a step and a start';
  const bad = commonProblem(payload, 'fn');
  if (bad) return bad;
  if (payload.level === 'one') { if (payload.slope !== undefined) return 'A peak or a trough has no slope to name'; }
  else if (!(SLOPES as readonly unknown[]).includes(payload.slope)) return 'A level below the peak names a rising or a falling wave';
  const found = circleWaveAngles(payload as unknown as CircleWavePayload);
  if (found.length !== 1) return 'Exactly one angle fits the level and the slope';
  if (found[0]! % (payload.step as number) !== 0) return 'The answer is a whole multiple of the step';
  if (found[0] === payload.start) return 'The start angle is not the answer';
  return null;
}

export function circleWaveAngles(payload: CircleWavePayload): number[] {
  return anglesFor(payload.fn, payload.level, payload.sign, (degrees) => {
    if (payload.slope === undefined) return true;
    const slope = trigSlope(payload.fn, degrees);
    return payload.slope === 'rising' ? slope > EPS : slope < -EPS;
  });
}

/** Which quadrant an angle falls in, or the axis it sits on. */
export const quadrantOf = (degrees: number): (typeof QUADRANT_OPTIONS)[number] => (degrees % 90 === 0 ? 'axis' : (`quadrant-${Math.floor(degrees / 90) + 1}` as (typeof QUADRANT_OPTIONS)[number]));
