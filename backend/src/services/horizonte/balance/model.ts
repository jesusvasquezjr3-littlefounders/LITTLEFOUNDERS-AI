/*
 * F1.8 equation balance. A scale holds `a x + b = c x + d`: each pan carries x-blocks and unit-counters. The learner
 * does one operation at a time and the same one on both pans, so the scale stays level; an operation done on one pan
 * only (a slip) tips it. Everything here is pure and total: the scorer, the board and the Forge gate all share it.
 */
export const BALANCE_MAX_X = 8;
export const BALANCE_MAX_UNITS = 30;
export const BALANCE_MAX_STEPS = 16;
export const BALANCE_MAX_ANSWER = 99;
export const BALANCE_TILT_DEGREES = 12;

export type Pan = { readonly x: number; readonly u: number };
/** `skew` is 0 while level, +1 when the left pan rose (it lost weight alone) and -1 when the right pan rose. */
export type Scale = { readonly l: Pan; readonly r: Pan; readonly skew: 0 | 1 | -1 };
export type StartScale = { readonly l: Pan; readonly r: Pan };

/** The closed operation vocabulary. Route operations keep the scale level; slips are shown to teach, never graded as a route. */
export const ROUTE_OPS = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'div-3', 'div-4', 'div-5'] as const;
export const SLIP_OPS = ['slip-left', 'slip-right'] as const;
export const BALANCE_OPS = [...ROUTE_OPS, ...SLIP_OPS] as const;
export type RouteOp = (typeof ROUTE_OPS)[number];
export type SlipOp = (typeof SLIP_OPS)[number];
export type BalanceOp = (typeof BALANCE_OPS)[number];

const whole = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function isPan(value: unknown): value is Pan {
  return plain(value) && Object.keys(value).sort().join() === 'u,x' && whole(value.x, BALANCE_MAX_X) && whole(value.u, BALANCE_MAX_UNITS);
}
export function isStartScale(value: unknown): value is StartScale {
  return plain(value) && Object.keys(value).sort().join() === 'l,r' && isPan(value.l) && isPan(value.r) && value.l.x + value.r.x >= 1;
}
export const isRouteOp = (value: unknown): value is RouteOp => typeof value === 'string' && (ROUTE_OPS as readonly string[]).includes(value);
export const isBalanceOp = (value: unknown): value is BalanceOp => typeof value === 'string' && (BALANCE_OPS as readonly string[]).includes(value);
/** The operations a piece offers: distinct ids from the vocabulary, at least one that moves the route. */
export function isOfferedOps(value: unknown): value is readonly BalanceOp[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= BALANCE_OPS.length && value.every(isBalanceOp)
    && new Set(value).size === value.length && value.some(isRouteOp);
}

export const levelScale = (start: StartScale): Scale => ({ l: start.l, r: start.r, skew: 0 });
const divisor = (op: RouteOp): number => Number(op.slice('div-'.length));

/** Whether the operation can be done on this scale: the pans must hold what it takes away or divide evenly. */
export function canApply(scale: Scale, op: BalanceOp): boolean {
  if (scale.skew !== 0) return false;
  const { l, r } = scale;
  switch (op) {
    case 'sub-x': return l.x >= 1 && r.x >= 1;
    case 'sub-unit': return l.u >= 1 && r.u >= 1;
    case 'add-unit': return l.u < BALANCE_MAX_UNITS && r.u < BALANCE_MAX_UNITS;
    case 'slip-left': return l.u >= 1;
    case 'slip-right': return r.u >= 1;
    default: {
      const n = divisor(op);
      const all = [l.x, l.u, r.x, r.u];
      return all.every((value) => value % n === 0) && all.some((value) => value > 0);
    }
  }
}

/** The scale after the operation, or null when it cannot be done. */
export function applyOp(scale: Scale, op: BalanceOp): Scale | null {
  if (!canApply(scale, op)) return null;
  const { l, r } = scale;
  switch (op) {
    case 'sub-x': return { l: { x: l.x - 1, u: l.u }, r: { x: r.x - 1, u: r.u }, skew: 0 };
    case 'sub-unit': return { l: { x: l.x, u: l.u - 1 }, r: { x: r.x, u: r.u - 1 }, skew: 0 };
    case 'add-unit': return { l: { x: l.x, u: l.u + 1 }, r: { x: r.x, u: r.u + 1 }, skew: 0 };
    case 'slip-left': return { l: { x: l.x, u: l.u - 1 }, r, skew: 1 };
    case 'slip-right': return { l, r: { x: r.x, u: r.u - 1 }, skew: -1 };
    default: {
      const n = divisor(op);
      return { l: { x: l.x / n, u: l.u / n }, r: { x: r.x / n, u: r.u / n }, skew: 0 };
    }
  }
}

/** The scale after a whole route, or null when any step is not a route operation or cannot be done in turn. */
export function replay(start: StartScale, steps: readonly unknown[]): Scale | null {
  let scale: Scale | null = levelScale(start);
  for (const step of steps) {
    if (!isRouteOp(step)) return null;
    scale = applyOp(scale, step);
    if (scale === null) return null;
  }
  return scale;
}

/** The pan angle in degrees, positive when the left pan sits lower; the model has no hidden weight, so a slip decides it. */
export const tiltDegrees = (scale: Scale): number => (scale.skew === 0 ? 0 : -scale.skew * BALANCE_TILT_DEGREES);

/** x stands alone on one pan and a number alone on the other: "x = n" or "n = x". */
export function isSolved(scale: Scale): boolean {
  if (scale.skew !== 0) return false;
  const { l, r } = scale;
  return (l.x === 1 && l.u === 0 && r.x === 0) || (r.x === 1 && r.u === 0 && l.x === 0);
}
/** The number x equals once solved, or null. */
export function solvedValue(scale: Scale): number | null {
  if (!isSolved(scale)) return null;
  return scale.l.x === 1 ? scale.r.u : scale.l.u;
}

/** Whether `a x + b = c x + d` holds at x. */
export const holdsAt = (start: StartScale, x: number): boolean => start.l.x * x + start.l.u === start.r.x * x + start.r.u;

const stateKey = (scale: Scale): string => `${scale.l.x},${scale.l.u},${scale.r.x},${scale.r.u}`;

/**
 * The shortest route of offered route operations that isolates x, by breadth-first search; null when there is none
 * within the step limit. The solvability check for a key: a puzzle with no route is a defect, never a puzzle.
 */
export function solveRoute(start: StartScale, offered: readonly BalanceOp[], limit = BALANCE_MAX_STEPS): RouteOp[] | null {
  const ops = offered.filter(isRouteOp);
  const first = levelScale(start);
  if (isSolved(first)) return [];
  const seen = new Set([stateKey(first)]);
  let frontier: Array<{ scale: Scale; route: RouteOp[] }> = [{ scale: first, route: [] }];
  for (let depth = 0; depth < limit && frontier.length > 0; depth += 1) {
    const next: typeof frontier = [];
    for (const { scale, route } of frontier) {
      for (const op of ops) {
        const after = applyOp(scale, op);
        if (after === null) continue;
        const key = stateKey(after);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = [...route, op];
        if (isSolved(after)) return path;
        next.push({ scale: after, route: path });
      }
    }
    frontier = next;
  }
  return null;
}

/** A pan as TeX the notation whitelist accepts: "3x + 2", "x", "0". */
export function panTex(pan: Pan): string {
  const parts: string[] = [];
  if (pan.x > 0) parts.push(pan.x === 1 ? 'x' : `${pan.x}x`);
  if (pan.u > 0 || pan.x === 0) parts.push(String(pan.u));
  return parts.join(' + ');
}
export const equationTex = (scale: Scale | StartScale): string => `${panTex(scale.l)} = ${panTex(scale.r)}`;
