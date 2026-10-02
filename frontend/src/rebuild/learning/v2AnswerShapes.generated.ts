export const V2_ANSWER_SHAPE_IDS = ['number.tolerance', 'points.set', 'curve.parameters', 'arrangement.slots'] as const;
export type V2AnswerShapeId = (typeof V2_ANSWER_SHAPE_IDS)[number];
export type ShapeVerdict = 'invalid' | 'valid' | 'review' | 'met';
export type ShapeDiagnostic = 'none' | 'structure' | 'value' | 'partial' | 'miss' | 'false_alarm' | 'tolerance';
export interface ShapeGrade { verdict: ShapeVerdict; diagnostic: ShapeDiagnostic }

export const V2_ANSWER_SHAPE_LIMITS = {
  numberText: 32, maxPoints: 64, maxRequiredPoints: 32, coordinateMagnitude: 100_000, maxSnap: 1_000,
  curveSamples: 16, sampleMagnitude: 10, maxPieces: 64, maxSlots: 32, maxCapacity: 32, maxSolutions: 8,
} as const;

export const V2_CURVE_FAMILIES = ['line', 'quadratic', 'exponential'] as const;
export type V2CurveFamily = (typeof V2_CURVE_FAMILIES)[number];
export type V2CurveCompare = 'parameters' | 'curve' | 'either' | 'both';

export interface V2Tolerance { absolute?: string; relative_bps?: number }
export interface NumberToleranceContext { minimum?: string; maximum?: string }
export interface NumberToleranceResponse { value: string }
export interface NumberToleranceRubric { target: string; tolerance?: V2Tolerance; review?: V2Tolerance }

export interface V2Point { x: number; y: number }
export interface PointSetContext { minimumX: number; maximumX: number; minimumY: number; maximumY: number; step?: number; maxPoints?: number }
export interface PointSetResponse { points: V2Point[] }
export interface PointSetRubric { required: V2Point[]; forbidden?: V2Point[]; snap?: number; extra?: 'forbid' | 'allow' }

export interface CurveRange { minimum: string; maximum: string }
export interface CurveParametersContext { families?: V2CurveFamily[]; ranges?: Record<string, CurveRange> }
export interface CurveParametersResponse { family: V2CurveFamily; params: Record<string, string> }
export interface CurveParametersRubric {
  family: V2CurveFamily; target: Record<string, string>; by?: V2CurveCompare;
  parameter_tolerance?: V2Tolerance; parameter_review?: V2Tolerance;
  samples?: number[]; curve_tolerance?: V2Tolerance; curve_review?: V2Tolerance;
}

export type SlotMap = Record<string, string[]>;
export interface ArrangementContext { pieceIds: string[]; slotIds: string[]; capacities?: Record<string, number>; repeatable?: boolean }
export interface ArrangementResponse { slots: SlotMap }
export interface ArrangementRubric { solutions: SlotMap[]; ordered?: boolean }

const ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;
const DECIMAL = /^-?(0|[1-9]\d{0,14})(\.\d{1,12})?$/;
const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;

const INVALID: ShapeGrade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: ShapeGrade = { verdict: 'valid', diagnostic: 'none' };
const MET: ShapeGrade = { verdict: 'met', diagnostic: 'none' };
const review = (diagnostic: ShapeDiagnostic): ShapeGrade => ({ verdict: 'review', diagnostic });

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return required.every((name) => Object.hasOwn(value, name)) && Object.keys(value).every((name) => required.includes(name) || optional.includes(name));
}

function wholeIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function ids(value: unknown, minimum: number, maximum: number): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum && value.every((item) => typeof item === 'string' && ID.test(item))
    && new Set(value).size === value.length;
}

interface Rat { n: bigint; d: bigint }
const ZERO: Rat = { n: 0n, d: 1n };

function parseRat(value: unknown): Rat | null {
  if (typeof value !== 'string' || value.length > V2_ANSWER_SHAPE_LIMITS.numberText) return null;
  if (DECIMAL.test(value)) {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    return { n: BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n), d: 10n ** BigInt(fraction.length) };
  }
  if (FRACTION.test(value)) {
    const negative = value.startsWith('-');
    const [top, bottom] = (negative ? value.slice(1) : value).split('/');
    return { n: BigInt(top!) * (negative ? -1n : 1n), d: BigInt(bottom!) };
  }
  return null;
}

const add = (a: Rat, b: Rat): Rat => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const sub = (a: Rat, b: Rat): Rat => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const mul = (a: Rat, b: Rat): Rat => ({ n: a.n * b.n, d: a.d * b.d });
const abs = (a: Rat): Rat => ({ n: a.n < 0n ? -a.n : a.n, d: a.d });
const cmp = (a: Rat, b: Rat): number => { const left = a.n * b.d; const right = b.n * a.d; return left < right ? -1 : left > right ? 1 : 0; };
const sign = (a: Rat): number => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
const intRat = (n: number): Rat => ({ n: BigInt(n), d: 1n });

function power(base: Rat, exponent: number): Rat {
  let result: Rat = { n: 1n, d: 1n };
  for (let step = 0; step < Math.abs(exponent); step += 1) result = mul(result, base);
  return exponent < 0 ? { n: result.d, d: result.n } : result;
}

interface Allowance { absolute: Rat; bps: bigint }

function parseTolerance(value: unknown): Allowance | null {
  if (!exactKeys(value, [], ['absolute', 'relative_bps'])) return null;
  let absolute = ZERO;
  if (value.absolute !== undefined) {
    const parsed = parseRat(value.absolute);
    if (!parsed || sign(parsed) < 0) return null;
    absolute = parsed;
  }
  let bps = 0n;
  if (value.relative_bps !== undefined) {
    if (!wholeIn(value.relative_bps, 0, 10_000)) return null;
    bps = BigInt(value.relative_bps);
  }
  return { absolute, bps };
}

function allowanceAt(allowance: Allowance, target: Rat): Rat {
  const relative: Rat = { n: abs(target).n * allowance.bps, d: abs(target).d * 10_000n };
  return cmp(relative, allowance.absolute) > 0 ? relative : allowance.absolute;
}

interface NumberBounds { minimum: Rat | null; maximum: Rat | null }

function parseNumberBounds(context: unknown): NumberBounds | null {
  if (context === undefined) return { minimum: null, maximum: null };
  if (!exactKeys(context, [], ['minimum', 'maximum'])) return null;
  const minimum = context.minimum === undefined ? null : parseRat(context.minimum);
  const maximum = context.maximum === undefined ? null : parseRat(context.maximum);
  if ((context.minimum !== undefined && !minimum) || (context.maximum !== undefined && !maximum)) return null;
  if (minimum && maximum && cmp(minimum, maximum) >= 0) return null;
  return { minimum, maximum };
}

function insideNumberBounds(value: Rat, bounds: NumberBounds): boolean {
  return (!bounds.minimum || cmp(value, bounds.minimum) >= 0) && (!bounds.maximum || cmp(value, bounds.maximum) <= 0);
}

interface NumberKey { target: Rat; met: Rat; near: Rat | null }

function parseNumberRubric(rubric: unknown, bounds: NumberBounds): NumberKey | null {
  if (!exactKeys(rubric, ['target'], ['tolerance', 'review'])) return null;
  const target = parseRat(rubric.target);
  if (!target || !insideNumberBounds(target, bounds)) return null;
  const tolerance = rubric.tolerance === undefined ? { absolute: ZERO, bps: 0n } : parseTolerance(rubric.tolerance);
  if (!tolerance) return null;
  const met = allowanceAt(tolerance, target);
  if (bounds.minimum && bounds.maximum && cmp(met, sub(bounds.maximum, bounds.minimum)) >= 0) return null;
  if (rubric.review === undefined) return { target, met, near: null };
  const band = parseTolerance(rubric.review);
  if (!band) return null;
  const near = allowanceAt(band, target);
  return cmp(near, met) > 0 ? { target, met, near } : null;
}

export function gradeNumberTolerance(response: unknown, rubric?: unknown, context?: unknown): ShapeGrade {
  const bounds = parseNumberBounds(context);
  if (!bounds || !exactKeys(response, ['value'])) return INVALID;
  const value = parseRat(response.value);
  if (!value || !insideNumberBounds(value, bounds)) return INVALID;
  if (rubric === undefined) return VALID;
  const key = parseNumberRubric(rubric, bounds);
  if (!key) return INVALID;
  const gap = abs(sub(value, key.target));
  if (cmp(gap, key.met) <= 0) return MET;
  return key.near && cmp(gap, key.near) <= 0 ? review('tolerance') : review('value');
}

export function sampleNumberTolerance(rubric: unknown, context?: unknown): NumberToleranceResponse | null {
  const bounds = parseNumberBounds(context);
  if (!bounds || !parseNumberRubric(rubric, bounds)) return null;
  return { value: (rubric as NumberToleranceRubric).target };
}

interface MicroPoint { x: bigint; y: bigint }
interface PointFrame { minimumX: bigint; maximumX: bigint; minimumY: bigint; maximumY: bigint; step: bigint | null; maxPoints: number; bounded: boolean }

function micro(value: unknown): bigint | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > V2_ANSWER_SHAPE_LIMITS.coordinateMagnitude) return null;
  const scaled = value * 1_000_000;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) > 1e-3 ? null : BigInt(rounded);
}

function parsePointFrame(context: unknown): PointFrame | null {
  const open: PointFrame = { minimumX: 0n, maximumX: 0n, minimumY: 0n, maximumY: 0n, step: null, maxPoints: V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints, bounded: false };
  if (context === undefined) return open;
  if (!exactKeys(context, ['minimumX', 'maximumX', 'minimumY', 'maximumY'], ['step', 'maxPoints'])) return null;
  const minimumX = micro(context.minimumX); const maximumX = micro(context.maximumX);
  const minimumY = micro(context.minimumY); const maximumY = micro(context.maximumY);
  if (minimumX === null || maximumX === null || minimumY === null || maximumY === null || minimumX >= maximumX || minimumY >= maximumY) return null;
  let step: bigint | null = null;
  if (context.step !== undefined) {
    step = micro(context.step);
    if (step === null || step <= 0n) return null;
  }
  let maxPoints: number = V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints;
  if (context.maxPoints !== undefined) {
    if (!wholeIn(context.maxPoints, 1, V2_ANSWER_SHAPE_LIMITS.maxPoints)) return null;
    maxPoints = context.maxPoints;
  }
  return { minimumX, maximumX, minimumY, maximumY, step, maxPoints, bounded: true };
}

function parsePoint(value: unknown, frame: PointFrame): MicroPoint | null {
  if (!exactKeys(value, ['x', 'y'])) return null;
  const x = micro(value.x); const y = micro(value.y);
  if (x === null || y === null) return null;
  if (frame.bounded) {
    if (x < frame.minimumX || x > frame.maximumX || y < frame.minimumY || y > frame.maximumY) return null;
    if (frame.step !== null && ((x - frame.minimumX) % frame.step !== 0n || (y - frame.minimumY) % frame.step !== 0n)) return null;
  }
  return { x, y };
}

function parsePointList(value: unknown, minimum: number, maximum: number, frame: PointFrame): MicroPoint[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
  const points: MicroPoint[] = [];
  for (const item of value) {
    const point = parsePoint(item, frame);
    if (!point) return null;
    points.push(point);
  }
  return points;
}

const squared = (a: MicroPoint, b: MicroPoint): bigint => (a.x - b.x) ** 2n + (a.y - b.y) ** 2n;

function distinctPoints(points: MicroPoint[]): boolean {
  return new Set(points.map((point) => `${point.x},${point.y}`)).size === points.length;
}

interface PointKey { required: MicroPoint[]; forbidden: MicroPoint[]; reach: bigint; allowExtra: boolean }

function parsePointRubric(rubric: unknown, frame: PointFrame): PointKey | null {
  if (!exactKeys(rubric, ['required'], ['forbidden', 'snap', 'extra'])) return null;
  const required = parsePointList(rubric.required, 1, V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints, frame);
  const forbidden = rubric.forbidden === undefined ? [] : parsePointList(rubric.forbidden, 0, V2_ANSWER_SHAPE_LIMITS.maxRequiredPoints, frame);
  if (!required || !forbidden) return null;
  let snap = 0n;
  if (rubric.snap !== undefined) {
    const parsed = micro(rubric.snap);
    if (parsed === null || parsed < 0n || parsed > BigInt(V2_ANSWER_SHAPE_LIMITS.maxSnap) * 1_000_000n) return null;
    snap = parsed;
  }
  if (rubric.extra !== undefined && rubric.extra !== 'forbid' && rubric.extra !== 'allow') return null;
  const apart = 4n * snap * snap;
  const everything = [...required, ...forbidden];
  for (let left = 0; left < required.length; left += 1) {
    for (let right = left + 1; right < everything.length; right += 1) {
      if (squared(required[left]!, everything[right]!) <= apart) return null;
    }
  }
  if (frame.bounded && required.length > frame.maxPoints) return null;
  return { required, forbidden, reach: snap * snap, allowExtra: rubric.extra === 'allow' };
}

export function gradePointSet(response: unknown, rubric?: unknown, context?: unknown): ShapeGrade {
  const frame = parsePointFrame(context);
  if (!frame || !exactKeys(response, ['points'])) return INVALID;
  const points = parsePointList(response.points, 1, frame.maxPoints, frame);
  if (!points || !distinctPoints(points)) return INVALID;
  if (rubric === undefined) return VALID;
  const key = parsePointRubric(rubric, frame);
  if (!key) return INVALID;
  const matched = new Set<number>();
  let extra = 0; let forbiddenHits = 0;
  for (const point of points) {
    const index = key.required.findIndex((target) => squared(point, target) <= key.reach);
    if (index >= 0) {
      if (matched.has(index)) extra += 1;
      else matched.add(index);
    } else if (key.forbidden.some((target) => squared(point, target) <= key.reach)) forbiddenHits += 1;
    else extra += 1;
  }
  const missing = key.required.length - matched.size;
  const surplus = forbiddenHits > 0 || (extra > 0 && !key.allowExtra);
  if (missing === 0 && !surplus) return MET;
  if (missing > 0 && surplus) return review(matched.size > 0 ? 'partial' : 'value');
  return review(missing > 0 ? 'miss' : 'false_alarm');
}

export function samplePointSet(rubric: unknown, context?: unknown): PointSetResponse | null {
  const frame = parsePointFrame(context);
  if (!frame || !parsePointRubric(rubric, frame)) return null;
  return { points: (rubric as PointSetRubric).required.map((point) => ({ x: point.x, y: point.y })) };
}

function curveParameterNames(family: unknown): readonly string[] | null {
  switch (family) {
    case 'line': return ['m', 'b'];
    case 'quadratic': return ['a', 'b', 'c'];
    case 'exponential': return ['a', 'b'];
    default: return null;
  }
}

interface CurveFrame { families: readonly string[]; ranges: Map<string, { minimum: Rat; maximum: Rat }> }

function parseCurveFrame(context: unknown): CurveFrame | null {
  const ranges = new Map<string, { minimum: Rat; maximum: Rat }>();
  if (context === undefined) return { families: V2_CURVE_FAMILIES, ranges };
  if (!exactKeys(context, [], ['families', 'ranges'])) return null;
  let families: readonly string[] = V2_CURVE_FAMILIES;
  if (context.families !== undefined) {
    if (!Array.isArray(context.families) || context.families.length < 1 || new Set(context.families).size !== context.families.length
      || context.families.some((family) => curveParameterNames(family) === null)) return null;
    families = context.families as string[];
  }
  if (context.ranges !== undefined) {
    if (!isRecord(context.ranges)) return null;
    for (const name of Object.keys(context.ranges)) {
      const range = context.ranges[name];
      if (!['m', 'a', 'b', 'c'].includes(name) || !exactKeys(range, ['minimum', 'maximum'])) return null;
      const minimum = parseRat(range.minimum);
      const maximum = parseRat(range.maximum);
      if (!minimum || !maximum || cmp(minimum, maximum) >= 0) return null;
      ranges.set(name, { minimum, maximum });
    }
  }
  return { families, ranges };
}

type CurveParams = Rat[];

function parseCurveParams(family: string, value: unknown, frame: CurveFrame): CurveParams | null {
  const names = curveParameterNames(family);
  if (!names || !exactKeys(value, names)) return null;
  const params: CurveParams = [];
  for (const name of names) {
    const parsed = parseRat(value[name]);
    if (!parsed) return null;
    const range = frame.ranges.get(name);
    if (range && (cmp(parsed, range.minimum) < 0 || cmp(parsed, range.maximum) > 0)) return null;
    params.push(parsed);
  }
  if (family === 'exponential' && sign(params[1]!) <= 0) return null;
  return params;
}

function curveY(family: string, params: CurveParams, x: number): Rat {
  const at = intRat(x);
  if (family === 'line') return add(mul(params[0]!, at), params[1]!);
  if (family === 'quadratic') return add(add(mul(params[0]!, mul(at, at)), mul(params[1]!, at)), params[2]!);
  return mul(params[0]!, power(params[1]!, x));
}

interface CurveKey {
  family: V2CurveFamily; target: CurveParams; by: V2CurveCompare; samples: number[];
  parameterMet: Allowance; parameterNear: Allowance | null; curveMet: Allowance; curveNear: Allowance | null;
}

const NO_TOLERANCE: Allowance = { absolute: ZERO, bps: 0n };

function parseCurveRubric(rubric: unknown, frame: CurveFrame): CurveKey | null {
  if (!exactKeys(rubric, ['family', 'target'], ['by', 'parameter_tolerance', 'parameter_review', 'samples', 'curve_tolerance', 'curve_review'])) return null;
  const family = rubric.family;
  if (typeof family !== 'string' || !frame.families.includes(family)) return null;
  const target = parseCurveParams(family, rubric.target, frame);
  if (!target) return null;
  if ((family === 'quadratic' || family === 'exponential') && sign(target[0]!) === 0) return null;
  if (family === 'exponential' && cmp(target[1]!, intRat(1)) === 0) return null;
  const by = rubric.by ?? 'parameters';
  if (by !== 'parameters' && by !== 'curve' && by !== 'either' && by !== 'both') return null;
  const usesParameters = by !== 'curve';
  const usesCurve = by !== 'parameters';
  const hasParameterKeys = rubric.parameter_tolerance !== undefined || rubric.parameter_review !== undefined;
  const hasCurveKeys = rubric.samples !== undefined || rubric.curve_tolerance !== undefined || rubric.curve_review !== undefined;
  if ((hasParameterKeys && !usesParameters) || (hasCurveKeys && !usesCurve) || (usesCurve && rubric.samples === undefined)) return null;
  const parameterMet = rubric.parameter_tolerance === undefined ? NO_TOLERANCE : parseTolerance(rubric.parameter_tolerance);
  const parameterNear = rubric.parameter_review === undefined ? null : parseTolerance(rubric.parameter_review);
  const curveMet = rubric.curve_tolerance === undefined ? NO_TOLERANCE : parseTolerance(rubric.curve_tolerance);
  const curveNear = rubric.curve_review === undefined ? null : parseTolerance(rubric.curve_review);
  if (!parameterMet || !curveMet || (rubric.parameter_review !== undefined && !parameterNear) || (rubric.curve_review !== undefined && !curveNear)) return null;
  for (const param of target) {
    if (parameterNear && cmp(allowanceAt(parameterNear, param), allowanceAt(parameterMet, param)) <= 0) return null;
  }
  let samples: number[] = [];
  if (usesCurve) {
    const given = rubric.samples;
    if (!Array.isArray(given) || given.length < 2 || given.length > V2_ANSWER_SHAPE_LIMITS.curveSamples || new Set(given).size !== given.length
      || given.some((item) => !wholeIn(item, -V2_ANSWER_SHAPE_LIMITS.sampleMagnitude, V2_ANSWER_SHAPE_LIMITS.sampleMagnitude))) return null;
    samples = given as number[];
    for (const x of samples) {
      const y = curveY(family, target, x);
      if (curveNear && cmp(allowanceAt(curveNear, y), allowanceAt(curveMet, y)) <= 0) return null;
    }
  }
  return { family: family as V2CurveFamily, target, by, samples, parameterMet, parameterNear, curveMet, curveNear };
}

export function gradeCurveParameters(response: unknown, rubric?: unknown, context?: unknown): ShapeGrade {
  const frame = parseCurveFrame(context);
  if (!frame || !exactKeys(response, ['family', 'params'])) return INVALID;
  const family = response.family;
  if (typeof family !== 'string' || !frame.families.includes(family)) return INVALID;
  const params = parseCurveParams(family, response.params, frame);
  if (!params) return INVALID;
  if (rubric === undefined) return VALID;
  const key = parseCurveRubric(rubric, frame);
  if (!key) return INVALID;
  const sameFamily = family === key.family;
  const parameterGaps = sameFamily ? params.map((param, index) => abs(sub(param, key.target[index]!))) : [];
  const parametersWithin = (band: Allowance) => sameFamily && parameterGaps.every((gap, index) => cmp(gap, allowanceAt(band, key.target[index]!)) <= 0);
  const curveGaps = key.samples.map((x) => {
    const expected = curveY(key.family, key.target, x);
    return { gap: abs(sub(curveY(family, params, x), expected)), expected };
  });
  const curveWithin = (band: Allowance) => curveGaps.every((item) => cmp(item.gap, allowanceAt(band, item.expected)) <= 0);
  const usesParameters = key.by !== 'curve';
  const usesCurve = key.by !== 'parameters';
  const combine = (parameters: boolean, curve: boolean) => key.by === 'parameters' ? parameters : key.by === 'curve' ? curve : key.by === 'either' ? parameters || curve : parameters && curve;
  if (combine(usesParameters && parametersWithin(key.parameterMet), usesCurve && curveWithin(key.curveMet))) return MET;
  if (key.parameterNear !== null || key.curveNear !== null) {
    const parametersClose = usesParameters && parametersWithin(key.parameterNear ?? key.parameterMet);
    const curveClose = usesCurve && curveWithin(key.curveNear ?? key.curveMet);
    if (combine(parametersClose, curveClose)) return review('tolerance');
  }
  if (!sameFamily && usesParameters) return review('structure');
  const parameterHits = usesParameters ? parameterGaps.filter((gap, index) => cmp(gap, allowanceAt(key.parameterMet, key.target[index]!)) <= 0).length : 0;
  const sampleHits = usesCurve ? curveGaps.filter((item) => cmp(item.gap, allowanceAt(key.curveMet, item.expected)) <= 0).length : 0;
  return review(parameterHits + sampleHits > 0 ? 'partial' : 'value');
}

export function sampleCurveParameters(rubric: unknown, context?: unknown): CurveParametersResponse | null {
  const frame = parseCurveFrame(context);
  if (!frame || !parseCurveRubric(rubric, frame)) return null;
  const key = rubric as CurveParametersRubric;
  const names = curveParameterNames(key.family)!;
  return { family: key.family, params: Object.fromEntries(names.map((name) => [name, key.target[name]!])) };
}

interface ArrangementFrame { pieces: Set<string>; slots: string[]; capacity: Map<string, number>; repeatable: boolean }

function parseArrangementFrame(context: unknown): ArrangementFrame | null {
  if (!exactKeys(context, ['pieceIds', 'slotIds'], ['capacities', 'repeatable'])) return null;
  if (!ids(context.pieceIds, 1, V2_ANSWER_SHAPE_LIMITS.maxPieces) || !ids(context.slotIds, 1, V2_ANSWER_SHAPE_LIMITS.maxSlots)) return null;
  if (context.repeatable !== undefined && typeof context.repeatable !== 'boolean') return null;
  const slots = context.slotIds;
  const capacity = new Map<string, number>(slots.map((slot) => [slot, 1]));
  if (context.capacities !== undefined) {
    if (!isRecord(context.capacities)) return null;
    for (const slot of Object.keys(context.capacities)) {
      const value = context.capacities[slot];
      if (!capacity.has(slot) || !wholeIn(value, 1, V2_ANSWER_SHAPE_LIMITS.maxCapacity)) return null;
      capacity.set(slot, value);
    }
  }
  return { pieces: new Set(context.pieceIds), slots, capacity, repeatable: context.repeatable === true };
}

function parseSlotMap(value: unknown, frame: ArrangementFrame): Map<string, string[]> | null {
  if (!isRecord(value)) return null;
  const placed = new Map<string, string[]>(frame.slots.map((slot) => [slot, []]));
  const used = new Set<string>();
  let total = 0;
  for (const slot of Object.keys(value)) {
    if (!placed.has(slot)) return null;
    const pieces = value[slot];
    if (!Array.isArray(pieces) || pieces.length > frame.capacity.get(slot)!) return null;
    for (const piece of pieces) {
      if (typeof piece !== 'string' || !frame.pieces.has(piece)) return null;
      if (!frame.repeatable && used.has(piece)) return null;
      used.add(piece);
      total += 1;
    }
    placed.set(slot, [...pieces] as string[]);
  }
  return total > 0 ? placed : null;
}

interface ArrangementKey { solutions: Array<Map<string, string[]>>; ordered: boolean }

function parseArrangementRubric(rubric: unknown, frame: ArrangementFrame): ArrangementKey | null {
  if (!exactKeys(rubric, ['solutions'], ['ordered'])) return null;
  if (rubric.ordered !== undefined && typeof rubric.ordered !== 'boolean') return null;
  const given = rubric.solutions;
  if (!Array.isArray(given) || given.length < 1 || given.length > V2_ANSWER_SHAPE_LIMITS.maxSolutions) return null;
  const solutions: Array<Map<string, string[]>> = [];
  for (const item of given) {
    const parsed = parseSlotMap(item, frame);
    if (!parsed) return null;
    solutions.push(parsed);
  }
  return { solutions, ordered: rubric.ordered === true };
}

function overlap(wanted: string[], have: string[]): number {
  const remaining = new Map<string, number>();
  for (const piece of wanted) remaining.set(piece, (remaining.get(piece) ?? 0) + 1);
  let shared = 0;
  for (const piece of have) {
    const left = remaining.get(piece) ?? 0;
    if (left > 0) { remaining.set(piece, left - 1); shared += 1; }
  }
  return shared;
}

export function gradeArrangement(response: unknown, rubric?: unknown, context?: unknown): ShapeGrade {
  const frame = parseArrangementFrame(context);
  if (!frame || !exactKeys(response, ['slots'])) return INVALID;
  const placed = parseSlotMap(response.slots, frame);
  if (!placed) return INVALID;
  if (rubric === undefined) return VALID;
  const key = parseArrangementRubric(rubric, frame);
  if (!key) return INVALID;
  let best: { shared: number; missing: number; extra: number } | null = null;
  for (const solution of key.solutions) {
    let shared = 0; let wanted = 0; let have = 0; let sameOrder = true;
    for (const slot of frame.slots) {
      const expected = solution.get(slot)!;
      const actual = placed.get(slot)!;
      shared += overlap(expected, actual);
      wanted += expected.length;
      have += actual.length;
      if (expected.length !== actual.length || expected.some((piece, index) => piece !== actual[index])) sameOrder = false;
    }
    const missing = wanted - shared;
    const extra = have - shared;
    if (missing === 0 && extra === 0 && (!key.ordered || sameOrder)) return MET;
    if (!best || shared > best.shared || (shared === best.shared && missing + extra < best.missing + best.extra)) best = { shared, missing, extra };
  }
  const outcome = best!;
  if (outcome.missing === 0 && outcome.extra === 0) return review('partial');
  if (outcome.shared === 0) return review('value');
  if (outcome.missing > 0 && outcome.extra > 0) return review('partial');
  return review(outcome.missing > 0 ? 'miss' : 'false_alarm');
}

export function sampleArrangement(rubric: unknown, context?: unknown): ArrangementResponse | null {
  const frame = parseArrangementFrame(context);
  if (!frame) return null;
  const key = parseArrangementRubric(rubric, frame);
  if (!key) return null;
  const first = key.solutions[0]!;
  return { slots: Object.fromEntries(frame.slots.filter((slot) => first.get(slot)!.length > 0).map((slot) => [slot, [...first.get(slot)!]])) };
}

export function isAnswerShapeId(value: unknown): value is V2AnswerShapeId {
  return typeof value === 'string' && (V2_ANSWER_SHAPE_IDS as readonly string[]).includes(value);
}

export function gradeAnswerShape(shape: V2AnswerShapeId, response: unknown, rubric?: unknown, context?: unknown): ShapeGrade {
  switch (shape) {
    case 'number.tolerance': return gradeNumberTolerance(response, rubric, context);
    case 'points.set': return gradePointSet(response, rubric, context);
    case 'curve.parameters': return gradeCurveParameters(response, rubric, context);
    case 'arrangement.slots': return gradeArrangement(response, rubric, context);
    default: return INVALID;
  }
}

export function answerShapeSample(shape: V2AnswerShapeId, rubric: unknown, context?: unknown): unknown {
  switch (shape) {
    case 'number.tolerance': return sampleNumberTolerance(rubric, context);
    case 'points.set': return samplePointSet(rubric, context);
    case 'curve.parameters': return sampleCurveParameters(rubric, context);
    case 'arrangement.slots': return sampleArrangement(rubric, context);
    default: return null;
  }
}
