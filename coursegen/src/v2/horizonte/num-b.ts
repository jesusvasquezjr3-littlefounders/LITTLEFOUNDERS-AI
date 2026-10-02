import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const NUM_B_CAPABILITIES = {
  'math.array-area.v2': ['visual.array-area.v1', 'operation.tap-cells.v1', 'operation.drag-chips.v1', 'operation.number-input.v1'],
  'math.ratio-line.v2': ['visual.ratio-line.v1', 'operation.drag-chips.v1', 'operation.number-input.v1'],
  'math.fraction-wall.v2': ['visual.fraction-wall.v1', 'operation.tap-cells.v1', 'operation.drag-chips.v1', 'operation.number-input.v1'],
} as const;

const ARRAY_AREA = 'math.array-area.v2';
const RATIO_LINE = 'math.ratio-line.v2';
const FRACTION_WALL = 'math.fraction-wall.v2';

const RATIO_UNITS = ['coins', 'pencils', 'tickets', 'cups', 'minutes', 'pages', 'stickers', 'boxes'];
const WALL_DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];
const FRACTION_PART_MAX = 999;

const NUM_B_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: ARRAY_AREA,
    lines: [
      `${ARRAY_AREA}: three visuals, each with an exact payload and a matching visual type. "array": {rows, columns}, each 1 to 10 (ages 8-12). "area-model": {across, down}, across 11 to 99 and down 2 to 99 (ages 10-12 only). "area-division": {dividend, divisor}, divisor 2 to 12 and the dividend an exact multiple whose other side is 2 to 99 (ages 10-12 only).`,
      `${ARRAY_AREA}: the prompt names the task (find the total, find the product by cutting a side, find the missing side) and never states the answer. The learner picks the cut, so never ask for one particular split.`,
      `${ARRAY_AREA}: the private key is {"value": N}, with N the total, the product or the missing side as a whole number.`,
    ],
  },
  {
    type: RATIO_LINE,
    lines: [
      `${RATIO_LINE}: ages 10-12 only. "double-number-line": {units: [two different units], base: [a, b], given: {line: "top" or "bottom", value}}. The units come from the closed list ${RATIO_UNITS.join(', ')}; a and b are 1 to 12; value is the given line's base value times a whole scale of 2 to 12.`,
      `${RATIO_LINE}: "ratio-tape": {unit, parts: [a, b], whole, ask: "a" or "b"}. a and b are 1 to 9 and add to at most 12; whole is an exact multiple of a + b, at most 999, with one box worth at most 99. The prompt names the same two parts and the same unit in the document's language and never states the asked value.`,
      `${RATIO_LINE}: the private key is {"value": N}, with N the quantity on the other line, or the value of the asked part, as a whole number.`,
    ],
  },
  {
    type: FRACTION_WALL,
    lines: [
      `${FRACTION_WALL}: one payload per operation, each with its own visual. "equivalent" (visual fraction-wall, ages 8-12): {op, fraction: [n, d], denominator}, a proper fraction over ${WALL_DENOMINATORS.join(', ')} and a larger denominator that is a multiple of d.`,
      `${FRACTION_WALL}: ages 10-12 only for the rest, all with {op, left: [n, d], right: [n, d]} and proper fractions. "add" and "subtract" (fraction-bars) use denominators ${WALL_DENOMINATORS.join(', ')}. "multiply" (fraction-product) uses denominators 2 to 6. "divide" (fraction-measure) uses denominators 2 to 8. For subtract and divide the left fraction is larger than the right.`,
      `${FRACTION_WALL}: the private key is {"n": N, "d": D}, both whole numbers from 1 to 999. For "equivalent" it is the exact form over the asked denominator; for the other operations any form that equals the result works, and lowest terms is the convention. The prompt never states the result.`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const between = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, ...keys: string[]): boolean => Object.keys(value).sort().join() === [...keys].sort().join();
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const pair = (value: unknown): value is [unknown, unknown] => Array.isArray(value) && value.length === 2;

type Fraction = [number, number];

function arrayAreaKind(payload: unknown): 'array' | 'area-model' | 'area-division' | null {
  if (!record(payload)) return null;
  if (keysAre(payload, 'rows', 'columns')) return between(payload.rows, 1, 10) && between(payload.columns, 1, 10) ? 'array' : null;
  if (keysAre(payload, 'across', 'down')) return between(payload.across, 11, 99) && between(payload.down, 2, 99) ? 'area-model' : null;
  if (!keysAre(payload, 'dividend', 'divisor')) return null;
  const { dividend, divisor } = payload;
  return between(divisor, 2, 12) && between(dividend, 4, 1188) && dividend % divisor === 0 && between(dividend / divisor, 2, 99) ? 'area-division' : null;
}

function arrayAreaAnswer(payload: unknown): number | null {
  const kind = arrayAreaKind(payload);
  const value = payload as Record<string, number>;
  if (kind === 'array') return value.rows! * value.columns!;
  if (kind === 'area-model') return value.across! * value.down!;
  return kind === 'area-division' ? value.dividend! / value.divisor! : null;
}

function ratioKind(payload: unknown): 'double-number-line' | 'ratio-tape' | null {
  if (!record(payload)) return null;
  const unit = (value: unknown) => typeof value === 'string' && RATIO_UNITS.includes(value);
  if (keysAre(payload, 'units', 'base', 'given')) {
    const { units, base, given } = payload;
    if (!pair(units) || !unit(units[0]) || !unit(units[1]) || units[0] === units[1]) return null;
    if (!pair(base) || !between(base[0], 1, 12) || !between(base[1], 1, 12)) return null;
    if (!record(given) || !keysAre(given, 'line', 'value') || (given.line !== 'top' && given.line !== 'bottom') || !between(given.value, 1, 999)) return null;
    const scale = given.value / (base as number[])[given.line === 'top' ? 0 : 1]!;
    return Number.isInteger(scale) && scale >= 2 && scale <= 12 ? 'double-number-line' : null;
  }
  if (!keysAre(payload, 'unit', 'parts', 'whole', 'ask')) return null;
  const { parts, whole: total, ask } = payload;
  if (!unit(payload.unit) || (ask !== 'a' && ask !== 'b') || !pair(parts) || !between(parts[0], 1, 9) || !between(parts[1], 1, 9) || parts[0] + parts[1] > 12) return null;
  const boxes = parts[0] + parts[1];
  return between(total, boxes, 999) && total % boxes === 0 && total / boxes <= 99 ? 'ratio-tape' : null;
}

type RatioPayload = { given: { line: 'top' | 'bottom'; value: number }; base: [number, number]; whole: number; parts: [number, number]; ask: 'a' | 'b' };

function ratioAnswer(payload: unknown): number | null {
  const kind = ratioKind(payload);
  const value = payload as RatioPayload;
  if (kind === 'double-number-line') {
    const top = value.given.line === 'top';
    return (value.given.value / value.base[top ? 0 : 1]) * value.base[top ? 1 : 0];
  }
  return kind === 'ratio-tape' ? (value.whole / (value.parts[0] + value.parts[1])) * value.parts[value.ask === 'a' ? 0 : 1] : null;
}

function properFraction(value: unknown, denominator: (d: number) => boolean): value is Fraction {
  return pair(value) && whole(value[1]) && denominator(value[1]) && between(value[0], 1, value[1] - 1);
}

type Operation = 'equivalent' | 'add' | 'subtract' | 'multiply' | 'divide';
const VISUALS: Readonly<Record<Operation, string>> = { equivalent: 'fraction-wall', add: 'fraction-bars', subtract: 'fraction-bars', multiply: 'fraction-product', divide: 'fraction-measure' };

function fractionOp(payload: unknown): Operation | null {
  if (!record(payload) || typeof payload.op !== 'string' || !Object.hasOwn(VISUALS, payload.op)) return null;
  const op = payload.op as Operation;
  const wall = (d: number) => WALL_DENOMINATORS.includes(d);
  if (op === 'equivalent') {
    if (!keysAre(payload, 'op', 'fraction', 'denominator') || !properFraction(payload.fraction, wall) || !whole(payload.denominator) || !wall(payload.denominator)) return null;
    return payload.denominator > payload.fraction[1] && payload.denominator % payload.fraction[1] === 0 ? op : null;
  }
  if (!keysAre(payload, 'op', 'left', 'right')) return null;
  const bound = op === 'multiply' ? (d: number) => d >= 2 && d <= 6 : op === 'divide' ? (d: number) => d >= 2 && d <= 8 : wall;
  if (!properFraction(payload.left, bound) || !properFraction(payload.right, bound)) return null;
  const [a, b] = payload.left;
  const [c, d] = payload.right;
  return (op === 'subtract' || op === 'divide') && a * d <= c * b ? null : op;
}

function fractionAnswer(payload: unknown): { n: number; d: number } | null {
  const op = fractionOp(payload);
  if (op === null) return null;
  const value = payload as { fraction: Fraction; denominator: number; left: Fraction; right: Fraction };
  if (op === 'equivalent') return { n: (value.fraction[0] * value.denominator) / value.fraction[1], d: value.denominator };
  const [a, b] = value.left as Fraction;
  const [c, d] = value.right as Fraction;
  const [n, den] = op === 'add' ? [a * d + c * b, b * d] : op === 'subtract' ? [a * d - c * b, b * d] : op === 'multiply' ? [a * c, b * d] : [a * d, b * c];
  const divisor = gcd(n, den);
  return { n: n / divisor, d: den / divisor };
}

const NARROW = ['10-12'];
const WIDE = ['6-9', '10-12'];

/** Gate 4 (solvability and scope): a well-formed payload that fits its visual and age band, and a key a learner can reach. */
function numBGates(document: V2DocumentLike, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  const band = typeof document.age_band === 'string' ? document.age_band : null;
  for (const segment of segments) {
    const type = segment.type;
    if (type !== ARRAY_AREA && type !== RATIO_LINE && type !== FRACTION_WALL) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string) => problems.push({ gate: 4, segmentId, message });
    const visual = (segment.visual as { type?: unknown } | undefined)?.type;
    const payload = segment.payload;
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? { given: answerKeys[segmentId] } : undefined;
    let kind: string | null;
    let allowed = WIDE;
    if (type === ARRAY_AREA) {
      kind = arrayAreaKind(payload);
      if (kind === null) { problem('The array payload is not a valid array, multiplication box or missing-area division'); continue; }
      if (kind !== 'array') allowed = NARROW;
    } else if (type === RATIO_LINE) {
      kind = ratioKind(payload);
      if (kind === null) { problem('The ratio payload is not a solvable double number line or ratio tape'); continue; }
      allowed = NARROW;
    } else {
      const op = fractionOp(payload);
      kind = op === null ? null : VISUALS[op];
      if (op === null || kind === null) { problem('The fraction payload is not a solvable fraction task (check the operation, the denominators and the order of the fractions)'); continue; }
      if (op !== 'equivalent') allowed = NARROW;
    }
    if (visual !== kind) problem(`The visual type must be ${kind} for this payload`);
    if (band !== null && !allowed.includes(band)) problem(`This ${kind} piece is for age band ${allowed.join(' and ')}, not ${band}`);
    if (key === undefined) continue;
    if (type === FRACTION_WALL) {
      const expected = fractionAnswer(payload)!;
      const given = key.given;
      if (!record(given) || !keysAre(given, 'n', 'd') || !between(given.n, 1, FRACTION_PART_MAX) || !between(given.d, 1, FRACTION_PART_MAX)) { problem('The fraction key must be {n, d}, both whole numbers from 1 to 999'); continue; }
      const same = fractionOp(payload) === 'equivalent' ? given.n === expected.n && given.d === expected.d : given.n * expected.d === expected.n * given.d;
      if (!same) problem('The fraction key is not the result the payload determines');
      continue;
    }
    const expected = type === ARRAY_AREA ? arrayAreaAnswer(payload) : ratioAnswer(payload);
    const given = key.given;
    if (!record(given) || !keysAre(given, 'value') || !whole(given.value)) { problem('The key must be {value}, a whole number'); continue; }
    if (given.value !== expected) problem('The key is not the answer the payload determines');
  }
  return problems;
}

export const numB = {
  id: 'num-b',
  capabilities: NUM_B_CAPABILITIES,
  guidance: NUM_B_GUIDANCE,
  gates: numBGates,
} as const satisfies ForgeHorizontePack;
