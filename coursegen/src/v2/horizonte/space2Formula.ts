/**
 * F4.7 (fix round): a free-form surface z = f(x, y), read from text, with its partial derivatives, its gradient and a small
 * gradient-descent walk. Pure and import-free, so a byte copy is valid in the browser (synced) and in Forge (copied, pinned
 * by a test). The text is typed by an author in Forge or by a learner in the board; it is never evaluated as code: there is no
 * eval, no Function, no regular expression over the text and no lookup of a property by a name from the text. It is tokenized
 * by character code, parsed by a bounded recursive descent into a small tree and walked with exact rational arithmetic.
 *
 * Bounds (a hostile or careless input costs a bounded amount of work, never a hang): 48 characters, 48 tree nodes, nesting
 * depth 10, number literals of at most 6 digits, integer exponents 0 to 6 on a single `^`, every rational under 1000 bits, and
 * at most 400 evaluations in one metered task (a 9 by 9 grid is 81 and a 12-step walk is 13).
 *
 * Partial derivatives are exact, not estimated: every evaluation carries the value together with its two partials (forward-mode
 * differentiation over rationals), so the quotient rule and the power rule need no symbolic algebra and no tree growth.
 *
 * Decimal comma: a comma between two digits is a decimal mark (0,5 is one half) in a formula and in a typed number, so a
 * learner on a Spanish or Portuguese keyboard is never refused for the mark their locale writes. Anywhere else a comma is refused.
 */

export const FORMULA_LIMITS = {
  maxChars: 48, maxNodes: 48, maxDepth: 10, maxDigits: 6, maxExponent: 6, maxBits: 1000, maxEvaluations: 400,
  maxNumberChars: 24, maxNumberDigits: 9,
  coordinate: 9, spanMin: 2, spanMax: 8, maxSteps: 12, minSteps: 3, through: { min: 2, max: 3 }, heightAbs: 999,
  keyPlaces: 3, keyAbs: 100_000, rateNumerator: 99, rateDenominator: 100,
} as const;

export const FORMULA_KINDS = ['slope', 'gradient', 'walk', 'build'] as const;
export type FormulaKind = (typeof FORMULA_KINDS)[number];

export interface Rat { readonly n: bigint; readonly d: bigint }

export type Node =
  | { readonly k: 'num'; readonly v: Rat; readonly text: string }
  | { readonly k: 'x' | 'y' }
  | { readonly k: 'neg'; readonly a: Node }
  | { readonly k: 'add' | 'sub' | 'mul' | 'div'; readonly a: Node; readonly b: Node }
  | { readonly k: 'pow'; readonly a: Node; readonly e: number };

export type ParseError = 'empty' | 'too-long' | 'bad-char' | 'bad-number' | 'unexpected' | 'unbalanced' | 'unknown-symbol' | 'too-complex' | 'bad-exponent';
export type FormulaParse = { readonly ok: true; readonly expr: Node } | { readonly ok: false; readonly error: ParseError; readonly at: number };

/* ── exact rationals ──────────────────────────────────────────────────────── */

class Stop { constructor(readonly reason: 'undefined' | 'large') {} }
class ParseFail { constructor(readonly error: ParseError, readonly at: number) {} }

const LIMIT = 1n << BigInt(FORMULA_LIMITS.maxBits);
const ZERO: Rat = { n: 0n, d: 1n };
const ONE: Rat = { n: 1n, d: 1n };
const abs = (value: bigint): bigint => (value < 0n ? -value : value);

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) { const rest = x % y; x = y; y = rest; }
  return x;
}

function rat(n: bigint, d: bigint): Rat {
  if (d === 0n) throw new Stop('undefined');
  if (abs(n) > LIMIT || abs(d) > LIMIT) throw new Stop('large');
  const g = gcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: sign * (n / g), d: sign * (d / g) };
}

const addR = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const subR = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mulR = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
const divR = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
const negR = (a: Rat): Rat => ({ n: -a.n, d: a.d });

function powR(base: Rat, exponent: number): Rat {
  let result = ONE;
  for (let step = 0; step < exponent; step += 1) result = mulR(result, base);
  return result;
}

export const ratFromInt = (value: number): Rat => ({ n: BigInt(value), d: 1n });
export const ratEquals = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d;
/** Negative, zero or positive: the sign of a minus b. */
export const ratCompare = (a: Rat, b: Rat): number => { const gap = a.n * b.d - b.n * a.d; return gap < 0n ? -1 : gap > 0n ? 1 : 0; };
export const ratIsInteger = (a: Rat): boolean => a.d === 1n;

/** The nearest double, for drawing only (never for a verdict). */
export function ratToNumber(a: Rat): number {
  const whole = a.n / a.d;
  const rest = a.n - whole * a.d;
  return Number(whole) + Number(rest) / Number(a.d);
}

/** Is the value a terminating decimal of at most `places` digits, that is, can a learner type it exactly? */
export const isTypable = (a: Rat, places: number = FORMULA_LIMITS.keyPlaces): boolean => (10n ** BigInt(places)) % a.d === 0n;

/** The value rounded half away from zero to `places` decimals, as text with a point, trailing zeros removed. `exact` is false when it was rounded. */
export function ratDecimal(a: Rat, places: number = FORMULA_LIMITS.keyPlaces): { text: string; exact: boolean } {
  const scale = 10n ** BigInt(places);
  const scaled = (abs(a.n) * scale * 2n + a.d) / (a.d * 2n);
  const exact = (abs(a.n) * scale) % a.d === 0n;
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(places, '0').replace(/0+$/, '');
  const sign = a.n < 0n && scaled !== 0n ? '-' : '';
  return { text: `${sign}${whole}${fraction ? `.${fraction}` : ''}`, exact };
}

/** The canonical text of a key value: a whole number, or a decimal a learner can type; anything else is a fraction. */
export function ratText(a: Rat): string {
  if (ratIsInteger(a)) return a.n.toString();
  return isTypable(a) ? ratDecimal(a).text : `${a.n}/${a.d}`;
}

/* ── typed numbers ────────────────────────────────────────────────────────── */

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

/**
 * Reads one typed number: an optional sign, then whole digits, a decimal part after a point or a comma, or a fraction a/b.
 * At most 24 characters and 9 digits a part; no exponent, no thousands mark, no spaces inside. Total: anything else is null.
 */
export function readNumber(input: unknown): Rat | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (text.length === 0 || text.length > FORMULA_LIMITS.maxNumberChars) return null;
  let at = 0;
  let negative = false;
  const first = text.charCodeAt(0);
  if (first === 45 || first === 0x2212 || first === 43) { negative = first !== 43; at = 1; }
  const scan = (): number => { let end = at; while (end < text.length && isDigit(text.charCodeAt(end))) end += 1; return end; };
  const wholeEnd = scan();
  if (wholeEnd === at || wholeEnd - at > FORMULA_LIMITS.maxNumberDigits) return null;
  const whole = text.slice(at, wholeEnd);
  at = wholeEnd;
  const sign = negative ? -1n : 1n;
  if (at === text.length) return rat(sign * BigInt(whole), 1n);
  const mark = text.charCodeAt(at);
  at += 1;
  const partEnd = scan();
  if (partEnd === at || partEnd !== text.length || partEnd - at > FORMULA_LIMITS.maxNumberDigits) return null;
  const part = text.slice(at);
  if (mark === 46 || mark === 44) return rat(sign * BigInt(whole + part), 10n ** BigInt(part.length));
  if (mark === 47 && BigInt(part) !== 0n) return rat(sign * BigInt(whole), BigInt(part));
  return null;
}

/* ── tokenizer ────────────────────────────────────────────────────────────── */

type Token =
  | { readonly t: 'num'; readonly text: string; readonly at: number }
  | { readonly t: 'x' | 'y'; readonly at: number }
  | { readonly t: 'op'; readonly ch: '+' | '-' | '*' | '/' | '^'; readonly at: number }
  | { readonly t: '(' | ')'; readonly at: number };

function canonicalNumber(raw: string): string {
  const dot = raw.indexOf('.');
  const whole = dot < 0 ? raw : raw.slice(0, dot);
  const fraction = dot < 0 ? '' : raw.slice(dot);
  let start = 0;
  while (start < whole.length - 1 && whole.charCodeAt(start) === 48) start += 1;
  return whole.slice(start) + fraction;
}

function numberValue(text: string): Rat {
  const dot = text.indexOf('.');
  if (dot < 0) return rat(BigInt(text), 1n);
  return rat(BigInt(text.slice(0, dot) + text.slice(dot + 1)), 10n ** BigInt(text.length - dot - 1));
}

function tokenize(text: string, from: number): Token[] {
  const tokens: Token[] = [];
  let i = from;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 32) { i += 1; continue; }
    if (isDigit(code)) {
      let whole = i;
      while (whole < text.length && isDigit(text.charCodeAt(whole))) whole += 1;
      let end = whole;
      const mark = text.charCodeAt(whole);
      if (mark === 46 || mark === 44) {
        end = whole + 1;
        while (end < text.length && isDigit(text.charCodeAt(end))) end += 1;
        if (end === whole + 1) throw new ParseFail('bad-number', i);
      }
      const digits = (whole - i) + (end > whole ? end - whole - 1 : 0);
      if (digits > FORMULA_LIMITS.maxDigits) throw new ParseFail('bad-number', i);
      tokens.push({ t: 'num', text: canonicalNumber(`${text.slice(i, whole)}${end > whole ? `.${text.slice(whole + 1, end)}` : ''}`), at: i });
      i = end;
      continue;
    }
    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)) {
      const lower = code >= 97 ? code : code + 32;
      if (lower !== 120 && lower !== 121) throw new ParseFail('unknown-symbol', i);
      tokens.push({ t: lower === 120 ? 'x' : 'y', at: i });
      i += 1;
      continue;
    }
    switch (code) {
      case 43: tokens.push({ t: 'op', ch: '+', at: i }); break;
      case 45: case 0x2212: tokens.push({ t: 'op', ch: '-', at: i }); break;
      case 42: case 0xd7: case 0xb7: tokens.push({ t: 'op', ch: '*', at: i }); break;
      case 47: case 0xf7: tokens.push({ t: 'op', ch: '/', at: i }); break;
      case 94: tokens.push({ t: 'op', ch: '^', at: i }); break;
      case 40: tokens.push({ t: '(', at: i }); break;
      case 41: tokens.push({ t: ')', at: i }); break;
      case 44: case 46: throw new ParseFail('bad-number', i);
      default: throw new ParseFail('bad-char', i);
    }
    i += 1;
  }
  return tokens;
}

/* ── parser ───────────────────────────────────────────────────────────────── */

class Parser {
  private index = 0;
  private depth = 0;
  private nodes = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  private peek(): Token | undefined { return this.tokens[this.index]; }
  private take(): Token | undefined { const token = this.tokens[this.index]; this.index += 1; return token; }
  private at(): number { return this.peek()?.at ?? this.tokens[this.tokens.length - 1]?.at ?? 0; }

  private make(node: Node): Node {
    this.nodes += 1;
    if (this.nodes > FORMULA_LIMITS.maxNodes) throw new ParseFail('too-complex', this.at());
    return node;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > FORMULA_LIMITS.maxDepth) throw new ParseFail('too-complex', this.at());
  }

  /** The whole text must be consumed, otherwise a stray token is reported. */
  parseAll(): Node {
    if (this.tokens.length === 0) throw new ParseFail('empty', 0);
    const node = this.sum();
    const rest = this.peek();
    if (rest) throw new ParseFail(rest.t === ')' ? 'unbalanced' : 'unexpected', rest.at);
    return node;
  }

  private sum(): Node {
    this.enter();
    let left = this.product();
    for (;;) {
      const token = this.peek();
      if (token?.t !== 'op' || (token.ch !== '+' && token.ch !== '-')) break;
      this.take();
      const right = this.product();
      left = this.make({ k: token.ch === '+' ? 'add' : 'sub', a: left, b: right });
    }
    this.depth -= 1;
    return left;
  }

  private product(): Node {
    let left = this.unary();
    for (;;) {
      const token = this.peek();
      if (token?.t === 'op' && (token.ch === '*' || token.ch === '/')) {
        this.take();
        const right = this.unary();
        left = this.make({ k: token.ch === '*' ? 'mul' : 'div', a: left, b: right });
      } else if (token && (token.t === 'x' || token.t === 'y' || token.t === '(')) {
        left = this.make({ k: 'mul', a: left, b: this.power() });
      } else if (token?.t === 'num') {
        throw new ParseFail('unexpected', token.at);
      } else break;
    }
    return left;
  }

  private unary(): Node {
    const token = this.peek();
    if (token?.t === 'op' && (token.ch === '-' || token.ch === '+')) {
      this.take();
      this.enter();
      const inner = this.unary();
      this.depth -= 1;
      return token.ch === '-' ? this.make({ k: 'neg', a: inner }) : inner;
    }
    return this.power();
  }

  private power(): Node {
    const base = this.atom();
    const token = this.peek();
    if (token?.t !== 'op' || token.ch !== '^') return base;
    this.take();
    const exponent = this.take();
    if (exponent?.t !== 'num' || exponent.text.includes('.')) throw new ParseFail('bad-exponent', exponent?.at ?? this.at());
    const value = Number(exponent.text);
    if (!Number.isInteger(value) || value > FORMULA_LIMITS.maxExponent) throw new ParseFail('bad-exponent', exponent.at);
    const next = this.peek();
    if (next?.t === 'op' && next.ch === '^') throw new ParseFail('bad-exponent', next.at);
    return this.make({ k: 'pow', a: base, e: value });
  }

  private atom(): Node {
    const token = this.take();
    if (!token) throw new ParseFail('unexpected', this.at());
    if (token.t === 'num') return this.make({ k: 'num', v: numberValue(token.text), text: token.text });
    if (token.t === 'x' || token.t === 'y') return this.make({ k: token.t });
    if (token.t === '(') {
      const inner = this.sum();
      const close = this.take();
      if (close?.t !== ')') throw new ParseFail('unbalanced', close?.at ?? token.at);
      return inner;
    }
    throw new ParseFail(token.t === ')' ? 'unbalanced' : 'unexpected', token.at);
  }
}

/** Where the formula itself starts: a leading `z =` (any spacing, any case) is allowed and skipped; any other use of z is an unknown symbol. */
function formulaStart(text: string): number {
  let at = 0;
  while (at < text.length && text.charCodeAt(at) === 32) at += 1;
  const code = text.charCodeAt(at);
  if (code !== 122 && code !== 90) return 0;
  let next = at + 1;
  while (next < text.length && text.charCodeAt(next) === 32) next += 1;
  if (text.charCodeAt(next) !== 61) throw new ParseFail('unknown-symbol', at);
  return next + 1;
}

/** Parses the text of f(x, y), with or without a leading `z =`. Total: any input gives a result, never a throw. */
export function parseFormula(input: unknown): FormulaParse {
  try {
    if (typeof input !== 'string') return { ok: false, error: 'empty', at: 0 };
    if (input.length > FORMULA_LIMITS.maxChars) return { ok: false, error: 'too-long', at: FORMULA_LIMITS.maxChars };
    const tokens = tokenize(input, formulaStart(input));
    if (tokens.length === 0) return { ok: false, error: 'empty', at: 0 };
    return { ok: true, expr: new Parser(tokens).parseAll() };
  } catch (error) {
    if (error instanceof ParseFail) return { ok: false, error: error.error, at: error.at };
    return { ok: false, error: 'too-complex', at: 0 };
  }
}

/* ── exact evaluation with partial derivatives ────────────────────────────── */

export interface Meter { used: number }
export const newMeter = (): Meter => ({ used: 0 });

export type Evaluation =
  | { readonly ok: true; readonly z: Rat; readonly dx: Rat; readonly dy: Rat }
  | { readonly ok: false; readonly reason: 'undefined' | 'large' | 'budget' };

interface Dual { readonly v: Rat; readonly dx: Rat; readonly dy: Rat }

function dual(node: Node, x: Rat, y: Rat): Dual {
  switch (node.k) {
    case 'num': return { v: node.v, dx: ZERO, dy: ZERO };
    case 'x': return { v: x, dx: ONE, dy: ZERO };
    case 'y': return { v: y, dx: ZERO, dy: ONE };
    case 'neg': { const a = dual(node.a, x, y); return { v: negR(a.v), dx: negR(a.dx), dy: negR(a.dy) }; }
    case 'add': { const a = dual(node.a, x, y); const b = dual(node.b, x, y); return { v: addR(a.v, b.v), dx: addR(a.dx, b.dx), dy: addR(a.dy, b.dy) }; }
    case 'sub': { const a = dual(node.a, x, y); const b = dual(node.b, x, y); return { v: subR(a.v, b.v), dx: subR(a.dx, b.dx), dy: subR(a.dy, b.dy) }; }
    case 'mul': {
      const a = dual(node.a, x, y);
      const b = dual(node.b, x, y);
      return { v: mulR(a.v, b.v), dx: addR(mulR(a.dx, b.v), mulR(a.v, b.dx)), dy: addR(mulR(a.dy, b.v), mulR(a.v, b.dy)) };
    }
    case 'div': {
      const a = dual(node.a, x, y);
      const b = dual(node.b, x, y);
      const square = mulR(b.v, b.v);
      return { v: divR(a.v, b.v), dx: divR(subR(mulR(a.dx, b.v), mulR(a.v, b.dx)), square), dy: divR(subR(mulR(a.dy, b.v), mulR(a.v, b.dy)), square) };
    }
    case 'pow': {
      const a = dual(node.a, x, y);
      if (node.e === 0) return { v: ONE, dx: ZERO, dy: ZERO };
      const lower = powR(a.v, node.e - 1);
      const factor = mulR(ratFromInt(node.e), lower);
      return { v: mulR(lower, a.v), dx: mulR(factor, a.dx), dy: mulR(factor, a.dy) };
    }
  }
}

/** The height and both partial derivatives at (x, y), exactly. A metered call counts as one evaluation against the meter's budget. */
export function evaluate(expr: Node, x: Rat, y: Rat, meter?: Meter): Evaluation {
  if (meter) {
    meter.used += 1;
    if (meter.used > FORMULA_LIMITS.maxEvaluations) return { ok: false, reason: 'budget' };
  }
  try {
    const result = dual(expr, x, y);
    return { ok: true, z: result.v, dx: result.dx, dy: result.dy };
  } catch (error) {
    return { ok: false, reason: error instanceof Stop ? error.reason : 'large' };
  }
}

/* ── the window and the grid ──────────────────────────────────────────────── */

export interface FormulaWindow { xMin: number; xMax: number; yMin: number; yMax: number }
export interface Cell { x: number; y: number }

const range = (low: number, high: number): number[] => Array.from({ length: high - low + 1 }, (_, step) => low + step);
export const windowXs = (window: FormulaWindow): number[] => range(window.xMin, window.xMax);
export const windowYs = (window: FormulaWindow): number[] => range(window.yMin, window.yMax);
export const inWindow = (window: FormulaWindow, x: number, y: number): boolean => x >= window.xMin && x <= window.xMax && y >= window.yMin && y <= window.yMax;

export interface FormulaGrid { xs: number[]; ys: number[]; values: Array<Array<Rat | null>>; low: number; high: number }

/** The height at every whole point of the window (null where the formula is undefined), one row per y. Null when the budget runs out. */
export function formulaGrid(expr: Node, window: FormulaWindow, meter: Meter = newMeter()): FormulaGrid | null {
  const xs = windowXs(window);
  const ys = windowYs(window);
  const values: Array<Array<Rat | null>> = [];
  for (const y of ys) {
    const row: Array<Rat | null> = [];
    for (const x of xs) {
      const found = evaluate(expr, ratFromInt(x), ratFromInt(y), meter);
      if (!found.ok && found.reason === 'budget') return null;
      row.push(found.ok ? found.z : null);
    }
    values.push(row);
  }
  const numbers = values.flat().flatMap((value) => (value ? [ratToNumber(value)] : []));
  return { xs, ys, values, low: numbers.length ? Math.min(...numbers) : 0, high: numbers.length ? Math.max(...numbers) : 0 };
}

export type Vec3 = [number, number, number];
export const FORMULA_HALF_WIDTH = 0.7;
export const FORMULA_HALF_HEIGHT = 0.5;

/** A place on the drawn surface: x runs left to right, y runs front to back, the height runs up, all inside the same box as the money surfaces. */
export function worldPoint(window: FormulaWindow, x: number, y: number, height: number, low: number, high: number): Vec3 {
  const rise = high - low;
  return [
    -FORMULA_HALF_WIDTH + (2 * FORMULA_HALF_WIDTH * (x - window.xMin)) / (window.xMax - window.xMin),
    rise === 0 ? 0 : -FORMULA_HALF_HEIGHT + (2 * FORMULA_HALF_HEIGHT * (height - low)) / rise,
    FORMULA_HALF_WIDTH - (2 * FORMULA_HALF_WIDTH * (y - window.yMin)) / (window.yMax - window.yMin),
  ];
}

/** The grid as world points (null where undefined) for the solids projection. */
export function formulaMesh(grid: FormulaGrid, window: FormulaWindow): Array<Array<Vec3 | null>> {
  return grid.ys.map((y, yi) => grid.xs.map((x, xi) => {
    const value = grid.values[yi]![xi];
    return value ? worldPoint(window, x, y, ratToNumber(value), grid.low, grid.high) : null;
  }));
}

/* ── the gradient-descent walk ────────────────────────────────────────────── */

export interface WalkPoint { x: Rat; y: Rat; z: Rat; dx: Rat; dy: Rat }
export type Walk = { readonly ok: true; readonly path: WalkPoint[] } | { readonly ok: false; readonly reason: 'undefined' | 'large' | 'budget'; readonly path: WalkPoint[] };
export interface WalkRate { n: number; d: number }

/** Step k moves from p to p - rate x gradient(p), downhill; the path holds the start and every step up to `steps`, each with its height and slopes. */
export function walkPath(expr: Node, start: Cell, rate: WalkRate, steps: number, meter: Meter = newMeter()): Walk {
  const path: WalkPoint[] = [];
  let x = ratFromInt(start.x);
  let y = ratFromInt(start.y);
  let factor: Rat;
  try { factor = rat(BigInt(rate.n), BigInt(rate.d)); } catch { return { ok: false, reason: 'undefined', path }; }
  for (let step = 0; step <= steps; step += 1) {
    const found = evaluate(expr, x, y, meter);
    if (!found.ok) return { ok: false, reason: found.reason, path };
    path.push({ x, y, z: found.z, dx: found.dx, dy: found.dy });
    if (step < steps) {
      try { x = subR(x, mulR(factor, found.dx)); y = subR(y, mulR(factor, found.dy)); } catch { return { ok: false, reason: 'large', path }; }
    }
  }
  return { ok: true, path };
}

/* ── the payload ──────────────────────────────────────────────────────────── */

export interface Through { x: number; y: number; z: number }
export type FormulaTask =
  | { kind: 'slope'; expression: string; axis: 'x' | 'y'; at: Cell }
  | { kind: 'gradient'; expression: string; at: Cell }
  | { kind: 'walk'; expression: string; at: Cell; rate: WalkRate; below: number; maxSteps: number }
  | { kind: 'build'; through: Through[] };
export interface FormulaPayload { window: FormulaWindow; task: FormulaTask }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function readWindow(value: unknown): FormulaWindow | null {
  if (!isRecord(value) || !exactKeys(value, ['xMin', 'xMax', 'yMin', 'yMax'])) return null;
  const limit = FORMULA_LIMITS.coordinate;
  const { xMin, xMax, yMin, yMax } = value;
  if (!whole(xMin, -limit, limit) || !whole(xMax, -limit, limit) || !whole(yMin, -limit, limit) || !whole(yMax, -limit, limit)) return null;
  const { spanMin, spanMax } = FORMULA_LIMITS;
  return xMax - xMin >= spanMin && xMax - xMin <= spanMax && yMax - yMin >= spanMin && yMax - yMin <= spanMax ? { xMin, xMax, yMin, yMax } : null;
}

function readCell(value: unknown, window: FormulaWindow): Cell | null {
  if (!isRecord(value) || !exactKeys(value, ['x', 'y']) || !whole(value.x, window.xMin, window.xMax) || !whole(value.y, window.yMin, window.yMax)) return null;
  return { x: value.x, y: value.y };
}

const readExpression = (value: unknown): string | null => (typeof value === 'string' && parseFormula(value).ok ? value : null);

function readTask(value: unknown, window: FormulaWindow): FormulaTask | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'slope') {
    const expression = readExpression(value.expression);
    const at = readCell(value.at, window);
    return exactKeys(value, ['kind', 'expression', 'axis', 'at']) && expression !== null && at && (value.axis === 'x' || value.axis === 'y') ? { kind: 'slope', expression, axis: value.axis, at } : null;
  }
  if (value.kind === 'gradient') {
    const expression = readExpression(value.expression);
    const at = readCell(value.at, window);
    return exactKeys(value, ['kind', 'expression', 'at']) && expression !== null && at ? { kind: 'gradient', expression, at } : null;
  }
  if (value.kind === 'walk') {
    const expression = readExpression(value.expression);
    const at = readCell(value.at, window);
    const rate = value.rate;
    if (!exactKeys(value, ['kind', 'expression', 'at', 'rate', 'below', 'maxSteps']) || expression === null || !at || !isRecord(rate) || !exactKeys(rate, ['n', 'd'])) return null;
    if (!whole(rate.n, 1, FORMULA_LIMITS.rateNumerator) || !whole(rate.d, 1, FORMULA_LIMITS.rateDenominator) || rate.n > rate.d) return null;
    if (!whole(value.below, -FORMULA_LIMITS.heightAbs, FORMULA_LIMITS.heightAbs) || !whole(value.maxSteps, FORMULA_LIMITS.minSteps, FORMULA_LIMITS.maxSteps)) return null;
    return { kind: 'walk', expression, at, rate: { n: rate.n, d: rate.d }, below: value.below, maxSteps: value.maxSteps };
  }
  if (value.kind === 'build') {
    const list = value.through;
    if (!exactKeys(value, ['kind', 'through']) || !Array.isArray(list) || list.length < FORMULA_LIMITS.through.min || list.length > FORMULA_LIMITS.through.max) return null;
    const through: Through[] = [];
    for (const entry of list) {
      if (!isRecord(entry) || !exactKeys(entry, ['x', 'y', 'z']) || !whole(entry.z, -FORMULA_LIMITS.heightAbs, FORMULA_LIMITS.heightAbs)) return null;
      const cell = readCell({ x: entry.x, y: entry.y }, window);
      if (!cell) return null;
      through.push({ x: cell.x, y: cell.y, z: entry.z });
    }
    return new Set(through.map((point) => `${point.x},${point.y}`)).size === through.length ? { kind: 'build', through } : null;
  }
  return null;
}

/** Reads a payload strictly: exact keys, whole numbers in range, a window of 2 to 8 steps a side, and a formula that reads. */
export function readFormulaPayload(value: unknown): FormulaPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['window', 'task'])) return null;
  const window = readWindow(value.window);
  const task = window ? readTask(value.task, window) : null;
  return window && task ? { window, task } : null;
}

export const taskExpression = (task: FormulaTask): string | null => (task.kind === 'build' ? null : task.expression);

export function taskFormula(task: FormulaTask): Node | null {
  const text = taskExpression(task);
  const parsed = text === null ? null : parseFormula(text);
  return parsed?.ok ? parsed.expr : null;
}

/** How many answer boxes the learner fills: one number for a slope or a step count, two for a gradient, one formula for a build. */
export const answerCount = (task: FormulaTask): number => (task.kind === 'gradient' ? 2 : 1);

/** Both partial derivatives at the task's point, exactly, or null for a build or a point where the formula is undefined. */
export function partialsAt(payload: FormulaPayload): { dx: Rat; dy: Rat } | null {
  const expr = taskFormula(payload.task);
  if (!expr || payload.task.kind === 'build') return null;
  const found = evaluate(expr, ratFromInt(payload.task.at.x), ratFromInt(payload.task.at.y), newMeter());
  return found.ok ? { dx: found.dx, dy: found.dy } : null;
}

/** How many of the given points a formula passes through exactly, or null when the text does not read. */
export function throughCount(text: unknown, through: readonly Through[]): number | null {
  const parsed = parseFormula(text);
  if (!parsed.ok) return null;
  const meter = newMeter();
  return through.filter((point) => {
    const found = evaluate(parsed.expr, ratFromInt(point.x), ratFromInt(point.y), meter);
    return found.ok && ratEquals(found.z, ratFromInt(point.z));
  }).length;
}

/** The first step (1 to maxSteps) at which a walk is at or below the line, or null when it never gets there. */
export function walkReach(path: readonly WalkPoint[], below: number): number | null {
  const line = ratFromInt(below);
  for (let step = 1; step < path.length; step += 1) if (ratCompare(path[step]!.z, line) <= 0) return step;
  return null;
}

/** The exact key of a slope, gradient or walk task, or null when it cannot be computed (a build has none: the points are the question). */
export function formulaKey(payload: FormulaPayload): Rat[] | null {
  const { task, window } = payload;
  if (task.kind === 'build') return null;
  const expr = taskFormula(task);
  if (!expr || !inWindow(window, task.at.x, task.at.y)) return null;
  const meter = newMeter();
  if (task.kind === 'walk') {
    const walk = walkPath(expr, task.at, task.rate, task.maxSteps, meter);
    const reach = walk.ok ? walkReach(walk.path, task.below) : null;
    return reach === null ? null : [ratFromInt(reach)];
  }
  const found = evaluate(expr, ratFromInt(task.at.x), ratFromInt(task.at.y), meter);
  if (!found.ok) return null;
  return task.kind === 'gradient' ? [found.dx, found.dy] : [task.axis === 'x' ? found.dx : found.dy];
}

/** The authoring rules a payload must meet beyond its shape: a formula defined on every whole point of the window and not flat, and a question with one exact answer a learner can type. */
export function formulaProblem(payload: FormulaPayload): string | null {
  const { task, window } = payload;
  if (task.kind === 'build') {
    if (new Set(task.through.map((point) => point.z)).size < 2) return 'The points must not all have the same height, or a flat surface would pass through them all';
    return null;
  }
  const expr = taskFormula(task);
  if (!expr) return 'The formula does not read';
  const grid = formulaGrid(expr, window);
  if (!grid) return 'The formula costs too much to evaluate';
  if (grid.values.some((row) => row.some((value) => value === null))) return 'The formula must be defined at every whole point of the window';
  if (grid.low === grid.high) return 'The surface must not be flat';
  const key = formulaKey(payload);
  if (!key) return task.kind === 'walk' ? 'The walk must reach the line within its steps' : 'The formula cannot be evaluated at the point';
  if (task.kind === 'walk') {
    const walk = walkPath(expr, task.at, task.rate, task.maxSteps);
    if (!walk.ok) return 'The walk cannot be computed exactly';
    if (walk.path.some((point) => !inWindow(window, ratToNumber(point.x), ratToNumber(point.y)))) return 'The walk must stay inside the window';
    if (ratCompare(walk.path[0]!.z, ratFromInt(task.below)) <= 0) return 'The walk must start above the line';
    if (key[0]!.n < 2n) return 'The walk must take at least 2 steps to reach the line';
    return null;
  }
  const limit = ratFromInt(FORMULA_LIMITS.keyAbs);
  if (key.some((value) => !isTypable(value) || ratCompare(value, limit) > 0 || ratCompare(value, { n: -limit.n, d: 1n }) < 0)) {
    return `The answer must be a number a learner can type exactly: at most ${FORMULA_LIMITS.keyPlaces} decimals and no more than ${FORMULA_LIMITS.keyAbs}`;
  }
  return null;
}

/* ── notation for the board: only ever built from the parsed tree ─────────── */

const PREC = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 } as const;
export type DecimalMark = '.' | ',';

function texOf(node: Node, mark: DecimalMark): { s: string; p: number } {
  switch (node.k) {
    case 'num': return { s: mark === ',' ? node.text.replace('.', '{,}') : node.text, p: PREC.atom };
    case 'x': case 'y': return { s: node.k, p: PREC.atom };
    case 'neg': {
      const inner = texOf(node.a, mark);
      return { s: `-${inner.p < PREC.neg ? `(${inner.s})` : inner.s}`, p: PREC.neg };
    }
    case 'add': case 'sub': {
      const left = texOf(node.a, mark);
      const right = texOf(node.b, mark);
      const wrap = node.k === 'sub' ? right.p <= PREC.add || node.b.k === 'neg' : node.b.k === 'neg';
      return { s: `${left.s}${node.k === 'add' ? '+' : '-'}${wrap ? `(${right.s})` : right.s}`, p: PREC.add };
    }
    case 'mul': {
      const left = texOf(node.a, mark);
      const right = texOf(node.b, mark);
      const leftText = left.p < PREC.mul ? `(${left.s})` : left.s;
      const wrapRight = right.p < PREC.mul || node.b.k === 'neg';
      const rightText = wrapRight ? `(${right.s})` : right.s;
      const explicit = !wrapRight && (node.b.k === 'num' || (node.a.k === 'num' && node.b.k === 'pow' && node.b.a.k === 'num'));
      return { s: explicit ? `${leftText}\\cdot ${rightText}` : `${leftText}${rightText}`, p: PREC.mul };
    }
    case 'div': return { s: `\\frac{${texOf(node.a, mark).s}}{${texOf(node.b, mark).s}}`, p: PREC.atom };
    case 'pow': {
      const base = texOf(node.a, mark);
      return { s: `${base.p < PREC.atom ? `(${base.s})` : base.s}^{${node.e}}`, p: PREC.pow };
    }
  }
}

/** KaTeX source for a parsed formula. Built only from the tree (digits, the letters x and y and fixed commands), never from the typed text. */
export function formulaLatex(expr: Node, mark: DecimalMark = '.'): string {
  return texOf(expr, mark).s;
}

export interface SpokenWords { plus: string; minus: string; times: string; over: string; power: string; open: string; close: string; negative: string }

function spokenOf(node: Node, words: SpokenWords, mark: DecimalMark): { s: string; p: number } {
  const group = (inner: { s: string; p: number }, below: number) => (inner.p < below ? `${words.open} ${inner.s} ${words.close}` : inner.s);
  switch (node.k) {
    case 'num': return { s: node.text.replace('.', mark), p: PREC.atom };
    case 'x': case 'y': return { s: node.k, p: PREC.atom };
    case 'neg': return { s: `${words.negative} ${group(spokenOf(node.a, words, mark), PREC.neg)}`, p: PREC.neg };
    case 'add': case 'sub': {
      const right = spokenOf(node.b, words, mark);
      const wrap = node.k === 'sub' ? right.p <= PREC.add || node.b.k === 'neg' : node.b.k === 'neg';
      return { s: `${spokenOf(node.a, words, mark).s} ${node.k === 'add' ? words.plus : words.minus} ${wrap ? `${words.open} ${right.s} ${words.close}` : right.s}`, p: PREC.add };
    }
    case 'mul': {
      const right = spokenOf(node.b, words, mark);
      return { s: `${group(spokenOf(node.a, words, mark), PREC.mul)} ${words.times} ${right.p < PREC.mul || node.b.k === 'neg' ? `${words.open} ${right.s} ${words.close}` : right.s}`, p: PREC.mul };
    }
    case 'div': return { s: `${group(spokenOf(node.a, words, mark), PREC.mul)} ${words.over} ${group(spokenOf(node.b, words, mark), PREC.atom)}`, p: PREC.mul };
    case 'pow': return { s: `${group(spokenOf(node.a, words, mark), PREC.atom)} ${words.power} ${node.e}`, p: PREC.pow };
  }
}

/** A spoken reading of a parsed formula, for assistive technology; the words and the decimal mark come from the caller's locale. */
export function formulaSpoken(expr: Node, words: SpokenWords, mark: DecimalMark = '.'): string {
  return spokenOf(expr, words, mark).s;
}
