export const CLOCK_MINUTES = 720;
export const CLOCK_STEPS: readonly number[] = [1, 5, 15, 30];
export const RULER_UNITS: readonly string[] = ['cm', 'in'];
export const RULER_MAX = 12;
export const BALANCE_MAX_WEIGHT = 20;
export const BALANCE_MAX_LOOSE = 6;
export const BALANCE_MAX_FIXED = 4;
export const PAN_TRAY = 0;
export const PAN_LEFT = 1;
export const PAN_RIGHT = 2;

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const record = (value: unknown): Record<string, unknown> | undefined => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);

export interface ClockSetup { start: number; step: number }

/** A time is whole minutes after 12:00 on a 12-hour face (0 to 719), and its minute part is a multiple of the hand's step. */
export const isClockMinutes = (value: unknown, step: number): value is number => whole(value) && value >= 0 && value < CLOCK_MINUTES && (value % 60) % step === 0;

export function clockSetup(payload: unknown): ClockSetup | undefined {
  const value = record(payload);
  if (!value || !whole(value.step) || !CLOCK_STEPS.includes(value.step) || !isClockMinutes(value.start, value.step)) return undefined;
  return { start: value.start, step: value.step };
}

export const clockTargetReachable = (setup: ClockSetup, target: unknown): target is number => isClockMinutes(target, setup.step) && target !== setup.start;

/** Hour 1 to 12 (the face shows 12, not 0) and the minute part. */
export const clockParts = (minutes: number): { hour: number; minute: number } => ({ hour: Math.floor(minutes / 60) % 12 || 12, minute: minutes % 60 });
export const clockMinutes = (hour: number, minute: number): number => (hour % 12) * 60 + minute;
export const clockText = (minutes: number): string => { const { hour, minute } = clockParts(minutes); return `${hour}:${String(minute).padStart(2, '0')}`; };

/** Hand angles in degrees clockwise from 12; the hour hand creeps with the minutes, as a real one does. */
export const handAngles = (minutes: number): { hour: number; minute: number } => ({ hour: (minutes / CLOCK_MINUTES) * 360, minute: ((minutes % 60) / 60) * 360 });

/** The minute hand at an angle, snapped to the step. 60 wraps to 0. */
export const minuteAtAngle = (degrees: number, step: number): number => {
  const raw = Math.round((((degrees % 360) + 360) % 360) / 6);
  return (Math.round(raw / step) * step) % 60;
};

export interface RulerSetup { unit: string; from: number; start: number; max: number }

export function rulerSetup(payload: unknown): RulerSetup | undefined {
  const value = record(payload);
  if (!value || typeof value.unit !== 'string' || !RULER_UNITS.includes(value.unit) || !whole(value.from) || !whole(value.start) || !whole(value.max)) return undefined;
  if (value.max < 4 || value.max > RULER_MAX || value.from < 0 || value.from >= value.max || value.start < value.from || value.start > value.max) return undefined;
  return { unit: value.unit, from: value.from, start: value.start, max: value.max };
}

/** The bar's far end sits on a whole mark, never before where the bar starts. */
export const isRulerEnd = (setup: RulerSetup, value: unknown): value is number => whole(value) && value >= setup.from && value <= setup.max;
export const rulerTargetReachable = (setup: RulerSetup, target: unknown): target is number => isRulerEnd(setup, target) && target > setup.from && target !== setup.start;

export interface BalanceSetup { left: readonly number[]; right: readonly number[]; weights: readonly number[] }

const weightList = (value: unknown, min: number, max: number): value is number[] =>
  Array.isArray(value) && value.length >= min && value.length <= max && value.every((weight) => whole(weight) && weight >= 1 && weight <= BALANCE_MAX_WEIGHT);

/** The public setup of a pan balance: up to four fixed weights on each pan and one to six loose weights to place. */
export function balanceSetup(payload: unknown): BalanceSetup | undefined {
  const value = record(payload);
  if (!value || !weightList(value.left, 0, BALANCE_MAX_FIXED) || !weightList(value.right, 0, BALANCE_MAX_FIXED) || !weightList(value.weights, 1, BALANCE_MAX_LOOSE)) return undefined;
  return { left: value.left, right: value.right, weights: value.weights };
}

/** One entry per loose weight: 0 in the tray, 1 on the left pan, 2 on the right pan. */
export const isPans = (setup: BalanceSetup, value: unknown): value is number[] =>
  Array.isArray(value) && value.length === setup.weights.length && value.every((pan) => pan === PAN_TRAY || pan === PAN_LEFT || pan === PAN_RIGHT);

const sum = (list: readonly number[]): number => list.reduce((total, weight) => total + weight, 0);

export function panTotals(setup: BalanceSetup, pans: readonly number[]): { left: number; right: number } {
  let left = sum(setup.left);
  let right = sum(setup.right);
  pans.forEach((pan, index) => { if (pan === PAN_LEFT) left += setup.weights[index]!; else if (pan === PAN_RIGHT) right += setup.weights[index]!; });
  return { left, right };
}

/** Left minus right: 0 is balanced, positive means the left pan is heavier. */
export const panDifference = (setup: BalanceSetup, pans: readonly number[]): number => { const { left, right } = panTotals(setup, pans); return left - right; };
export const untouchedPans = (setup: BalanceSetup): number[] => setup.weights.map(() => PAN_TRAY);

/** Every difference the loose weights can make: each is left in the tray, put on the left, or put on the right. */
export function reachableDifferences(setup: BalanceSetup): ReadonlySet<number> {
  let seen = new Set<number>([sum(setup.left) - sum(setup.right)]);
  for (const weight of setup.weights) {
    const next = new Set<number>();
    for (const difference of seen) { next.add(difference); next.add(difference + weight); next.add(difference - weight); }
    seen = next;
  }
  return seen;
}

export const balanceTargetReachable = (setup: BalanceSetup, target: unknown): target is number =>
  whole(target) && target !== panDifference(setup, untouchedPans(setup)) && reachableDifferences(setup).has(target);

/** Which way the beam leans: -1 left pan down, 1 right pan down, 0 level. */
export const beamLean = (difference: number): -1 | 0 | 1 => (difference > 0 ? -1 : difference < 0 ? 1 : 0);
