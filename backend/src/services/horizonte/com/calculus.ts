import { exactKeys, isWhole } from './arrange.js';

/* F2.17 calculus: a secant closing in on a tangent (G04), f and f' linked (G05), Riemann sums (G10) and the fundamental theorem (G11). */

export const COEFF_MAX = 9;
export const SECANT_A_MAX = 3;
export const SLOPE_MAX = 20;
export const ROOT_MAX = 3;
export const DOMAIN_X = 4;
export const RIEMANN_N_MAX = 40;
export const RIEMANN_METHODS = ['left', 'right', 'midpoint', 'trapezoid'] as const;
export const EXTREMA = ['max', 'min'] as const;

export const SIGN_OPTIONS = ['positive', 'negative', 'zero'] as const;
export const DIRECTION_OPTIONS = ['rising', 'falling'] as const;
export const ERROR_OPTIONS = ['too-small', 'too-big'] as const;
export const GROWTH_OPTIONS = ['growing', 'shrinking', 'flat'] as const;

export type Coeffs = [number, number, number, number];
export interface SecantPayload { coeffs: Coeffs; a: number }
export interface DerivativeLinkPayload { lead: 1 | -1; roots: [number, number]; base: number; ask: (typeof EXTREMA)[number] }
export interface RiemannPayload { coeffs: Coeffs; from: number; to: number; method: (typeof RIEMANN_METHODS)[number]; tolerance: number }
export interface AccumulationPayload { coeffs: Coeffs; from: number; to: number; target: number }

const isCoeffs = (value: unknown): value is Coeffs => Array.isArray(value) && value.length === 4 && value.every((c) => isWhole(c, -COEFF_MAX, COEFF_MAX));

export const evalPoly = (c: readonly number[], x: number): number => c[0]! + x * (c[1]! + x * (c[2]! + x * c[3]!));
export const slopeAt = (c: readonly number[], x: number): number => c[1]! + x * (2 * c[2]! + x * 3 * c[3]!);
/** The exact area under the polynomial from `from` to `to`, times twelve, so it stays a whole number. */
export function areaTwelfths(c: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let k = 0; k < 4; k += 1) total += c[k]! * (to ** (k + 1) - from ** (k + 1)) * (12 / (k + 1));
  return total;
}
export const areaOf = (c: readonly number[], from: number, to: number): number => areaTwelfths(c, from, to) / 12;
const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/* ── secant ── */

export function secantProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['coeffs', 'a']) || !isCoeffs(payload.coeffs) || !isWhole(payload.a, -SECANT_A_MAX, SECANT_A_MAX)) return 'A secant payload holds four whole coefficients and a whole point';
  if (Math.abs(slopeAt(payload.coeffs, payload.a)) > SLOPE_MAX) return `The slope at the point stays within ${SLOPE_MAX} either way`;
  if (payload.coeffs[2] === 0 && payload.coeffs[3] === 0) return 'A straight line has no secant to close in';
  return null;
}

/** The slope of the secant from `a` to `a + h`. */
export const secantSlope = (c: readonly number[], a: number, h: number): number => (evalPoly(c, a + h) - evalPoly(c, a)) / h;

/* ── derivative link ── */

export function derivativeLinkProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['lead', 'roots', 'base', 'ask'])) return 'A linked graphs payload holds a lead, two roots, a base and what to find';
  if (payload.lead !== 1 && payload.lead !== -1) return 'The lead is 1 or -1';
  const roots = payload.roots;
  if (!Array.isArray(roots) || roots.length !== 2 || !roots.every((r) => isWhole(r, -ROOT_MAX, ROOT_MAX)) || roots[1] - roots[0] < 2) return `The two roots are whole numbers within ${ROOT_MAX}, at least 2 apart`;
  if (!isWhole(payload.base, -5, 5)) return 'The base is a whole number from -5 to 5';
  if (payload.ask !== 'max' && payload.ask !== 'min') return 'The task asks for the max or the min';
  return null;
}

export const derivativeCoeffs = (p: DerivativeLinkPayload): number[] => [p.base, p.lead * p.roots[0] * p.roots[1], (-p.lead * (p.roots[0] + p.roots[1])) / 2, p.lead / 3];
export const derivativeAt = (p: DerivativeLinkPayload, x: number): number => p.lead * (x - p.roots[0]) * (x - p.roots[1]);

/* ── Riemann sums ── */

export function riemannProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['coeffs', 'from', 'to', 'method', 'tolerance']) || !isCoeffs(payload.coeffs)) return 'A Riemann payload holds four whole coefficients, an interval, a method and a tolerance';
  if (!isWhole(payload.from, -3, 6) || !isWhole(payload.to, -3, 6) || payload.to - payload.from < 2 || payload.to - payload.from > 8) return 'The interval is whole numbers from -3 to 6, 2 to 8 wide';
  if (!(RIEMANN_METHODS as readonly unknown[]).includes(payload.method)) return 'The method is left, right, midpoint or trapezoid';
  if (typeof payload.tolerance !== 'number' || !(payload.tolerance >= 0.01 && payload.tolerance <= 20) || Math.abs(payload.tolerance * 100 - Math.round(payload.tolerance * 100)) > 1e-9) return 'The tolerance is from 0.01 to 20, in hundredths';
  const p = payload as unknown as RiemannPayload;
  for (let i = 0; i <= (p.to - p.from) * 20; i += 1) if (evalPoly(p.coeffs, p.from + i / 20) < 0) return 'The curve stays above the axis on the interval';
  return riemannTruth(p) === null ? 'The error keeps one sign, and the first n within the tolerance is clear, and it stays within' : null;
}

export function riemannApprox(p: Pick<RiemannPayload, 'coeffs' | 'from' | 'to' | 'method'>, n: number): number {
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

export const riemannError = (p: RiemannPayload, n: number): number => riemannApprox(p, n) - areaOf(p.coeffs, p.from, p.to);

/** The fewest rectangles whose estimate lands within the tolerance, and the sign of the error all along; null when either is unclear. */
export function riemannTruth(p: RiemannPayload): { n: number; sign: 'too-small' | 'too-big' } | null {
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

/* ── accumulation ── */

export function accumulationProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['coeffs', 'from', 'to', 'target']) || !isCoeffs(payload.coeffs)) return 'An accumulation payload holds four whole coefficients, an interval and a target';
  if (!isWhole(payload.from, -4, 3) || !isWhole(payload.to, -4, 8) || payload.to - payload.from < 3 || payload.to - payload.from > 8) return 'The interval is whole numbers, 3 to 8 wide, starting from -4 to 3 and ending by 8';
  if (!isWhole(payload.target, -99, 99) || payload.target === 0) return 'The target is a whole number from -99 to 99, never zero';
  return accumulationTruth(payload as unknown as AccumulationPayload) === null ? 'Exactly one whole number on the interval gives the target' : null;
}

/** The whole numbers x after `from` where the accumulated area equals the target. */
export function accumulationHits(p: AccumulationPayload): number[] {
  const hits: number[] = [];
  for (let x = p.from + 1; x <= p.to; x += 1) if (areaTwelfths(p.coeffs, p.from, x) === 12 * p.target) hits.push(x);
  return hits;
}

export function accumulationTruth(p: AccumulationPayload): { x: number; growth: (typeof GROWTH_OPTIONS)[number] } | null {
  const hits = accumulationHits(p);
  if (hits.length !== 1) return null;
  const rate = sign(evalPoly(p.coeffs, hits[0]!));
  return { x: hits[0]!, growth: rate > 0 ? 'growing' : rate < 0 ? 'shrinking' : 'flat' };
}

export { sign as signOf };
