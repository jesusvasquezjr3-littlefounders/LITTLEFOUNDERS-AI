/**
 * Horizonte F2.6: the expression engine behind the equation editor. Pure and import-free, so a byte copy is valid in the
 * browser (synced) and in Forge (copied, pinned by a test). It never evaluates learner text: it tokenizes by character code,
 * parses with a bounded recursive descent into a small AST, and decides equivalence by exact rational sampling.
 *
 * Bounds (a hostile or careless input costs a bounded amount of work, never a hang): 64 characters, 64 AST nodes, nesting
 * depth 12, literals of at most 9 digits, integer exponents 0 to 6 on a single `^`, polynomial degree at most 12, and every
 * rational kept under 4096 bits. There is no regular expression over learner text and no property lookup by learner name.
 *
 * Equivalence: both sides are evaluated at the same 33 fixed points (integers -12 to 12 plus eight fractions) in exact
 * rational arithmetic. A polynomial of degree at most 12 that agrees at 33 points is identical, so for the polynomial
 * expressions this editor teaches the check is a proof, not a probe. Two equations are equivalent when their differences
 * (left minus right) are proportional by one nonzero factor.
 */

export const EXPRESSION_LIMITS = {
  maxChars: 64, maxNodes: 64, maxDepth: 12, maxDigits: 9, maxExponent: 6, maxDegree: 12, maxBits: 4096, maxLines: 8, minDefined: 8,
} as const;

export type ExpressionTaskKind = 'rewrite' | 'solve';
export type ExpressionForm = 'expanded' | 'factored' | 'isolated' | 'separated';
export const EXPRESSION_FORMS: Readonly<Record<ExpressionTaskKind, readonly ExpressionForm[]>> = {
  rewrite: ['expanded', 'factored'],
  solve: ['isolated', 'separated'],
};

export interface Rat { readonly n: bigint; readonly d: bigint }

export type Node =
  | { readonly k: 'num'; readonly v: Rat; readonly text: string }
  | { readonly k: 'var' }
  | { readonly k: 'neg'; readonly a: Node }
  | { readonly k: 'add' | 'sub' | 'mul' | 'div'; readonly a: Node; readonly b: Node }
  | { readonly k: 'pow'; readonly a: Node; readonly e: number };

export type ParseError =
  | 'empty' | 'too-long' | 'bad-char' | 'bad-number' | 'unexpected' | 'unbalanced'
  | 'unknown-symbol' | 'too-complex' | 'bad-exponent' | 'two-equals';

export type Parsed =
  | { readonly ok: true; readonly kind: 'expression'; readonly expr: Node }
  | { readonly ok: true; readonly kind: 'equation'; readonly left: Node; readonly right: Node }
  | { readonly ok: false; readonly error: ParseError; readonly at: number };

/* ── exact rationals ──────────────────────────────────────────────────────── */

class Stop { constructor(readonly reason: 'undefined' | 'large') {} }
class ParseFail { constructor(readonly error: ParseError, readonly at: number) {} }

const LIMIT = 1n << BigInt(EXPRESSION_LIMITS.maxBits);
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
  const g = gcd(n, d);
  const sign = d < 0n ? -1n : 1n;
  return { n: sign * (n / g), d: sign * (d / g) };
}

const addR = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const subR = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mulR = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
const divR = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
const negR = (a: Rat): Rat => ({ n: -a.n, d: a.d });
const isZero = (a: Rat): boolean => a.n === 0n;
const sameR = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d;

function powR(base: Rat, exponent: number): Rat {
  let result = ONE;
  for (let step = 0; step < exponent; step += 1) result = mulR(result, base);
  return result;
}

/* ── tokenizer ────────────────────────────────────────────────────────────── */

type Token =
  | { readonly t: 'num'; readonly text: string; readonly at: number }
  | { readonly t: 'var'; readonly at: number }
  | { readonly t: 'op'; readonly ch: '+' | '-' | '*' | '/' | '^'; readonly at: number }
  | { readonly t: '(' | ')' | '='; readonly at: number };

const isDigit = (code: number): boolean => code >= 48 && code <= 57;
/* A decimal separator is a point or a comma written between two digit runs, once per number: `0,5` reads as 0.5, `1,5,2` does not read. */
const POINT = 46;
const COMMA = 44;

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
  const fraction = text.length - dot - 1;
  return rat(BigInt(text.slice(0, dot) + text.slice(dot + 1)), 10n ** BigInt(fraction));
}

function tokenize(text: string, variable: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 32) { i += 1; continue; }
    if (isDigit(code)) {
      let whole = i;
      while (whole < text.length && isDigit(text.charCodeAt(whole))) whole += 1;
      let end = whole;
      const mark = text.charCodeAt(whole);
      if (mark === POINT || mark === COMMA) {
        end = whole + 1;
        while (end < text.length && isDigit(text.charCodeAt(end))) end += 1;
        if (end === whole + 1) throw new ParseFail('bad-number', i);
      }
      const after = text.charCodeAt(end);
      if (after === POINT || after === COMMA) throw new ParseFail('bad-number', end);
      const digits = (whole - i) + (end > whole ? end - whole - 1 : 0);
      if (digits > EXPRESSION_LIMITS.maxDigits) throw new ParseFail('bad-number', i);
      const written = end > whole ? `${text.slice(i, whole)}.${text.slice(whole + 1, end)}` : text.slice(i, end);
      tokens.push({ t: 'num', text: canonicalNumber(written), at: i });
      i = end;
      continue;
    }
    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)) {
      const lower = String.fromCharCode(code >= 97 ? code : code + 32);
      if (lower !== variable) throw new ParseFail('unknown-symbol', i);
      tokens.push({ t: 'var', at: i });
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
      case 61: tokens.push({ t: '=', at: i }); break;
      case POINT: case COMMA: throw new ParseFail('bad-number', i);
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
  constructor(private readonly tokens: readonly Token[], private readonly budget: { nodes: number }) {}

  private peek(): Token | undefined { return this.tokens[this.index]; }
  private take(): Token | undefined { const token = this.tokens[this.index]; this.index += 1; return token; }
  private at(): number { return this.peek()?.at ?? this.tokens[this.tokens.length - 1]?.at ?? 0; }

  private make(node: Node): Node {
    this.budget.nodes += 1;
    if (this.budget.nodes > EXPRESSION_LIMITS.maxNodes) throw new ParseFail('too-complex', this.at());
    return node;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > EXPRESSION_LIMITS.maxDepth) throw new ParseFail('too-complex', this.at());
  }

  /** The whole side must be consumed, otherwise a stray token is reported. */
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
      } else if (token && (token.t === 'var' || token.t === '(')) {
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
    if (!Number.isInteger(value) || value > EXPRESSION_LIMITS.maxExponent) throw new ParseFail('bad-exponent', exponent.at);
    const next = this.peek();
    if (next?.t === 'op' && next.ch === '^') throw new ParseFail('bad-exponent', next.at);
    return this.make({ k: 'pow', a: base, e: value });
  }

  private atom(): Node {
    const token = this.take();
    if (!token) throw new ParseFail('unexpected', this.at());
    if (token.t === 'num') return this.make({ k: 'num', v: numberValue(token.text), text: token.text });
    if (token.t === 'var') return this.make({ k: 'var' });
    if (token.t === '(') {
      const inner = this.sum();
      const close = this.take();
      if (close?.t !== ')') throw new ParseFail('unbalanced', close?.at ?? token.at);
      return inner;
    }
    throw new ParseFail(token.t === ')' ? 'unbalanced' : 'unexpected', token.at);
  }
}

/** Parses one line of learner text. Total: any input gives a result, never a throw. */
export function parseExpression(input: unknown, variable: string): Parsed {
  try {
    if (typeof input !== 'string') return { ok: false, error: 'empty', at: 0 };
    if (input.length > EXPRESSION_LIMITS.maxChars) return { ok: false, error: 'too-long', at: EXPRESSION_LIMITS.maxChars };
    if (typeof variable !== 'string' || variable.length !== 1 || variable.charCodeAt(0) < 97 || variable.charCodeAt(0) > 122) return { ok: false, error: 'unknown-symbol', at: 0 };
    const tokens = tokenize(input, variable);
    if (tokens.length === 0) return { ok: false, error: 'empty', at: 0 };
    const equals = tokens.flatMap((token, position) => (token.t === '=' ? [position] : []));
    const budget = { nodes: 0 };
    if (equals.length === 0) return { ok: true, kind: 'expression', expr: new Parser(tokens, budget).parseAll() };
    if (equals.length > 1) return { ok: false, error: 'two-equals', at: tokens[equals[1]!]!.at };
    const split = equals[0]!;
    const left = new Parser(tokens.slice(0, split), budget).parseAll();
    const right = new Parser(tokens.slice(split + 1), budget).parseAll();
    return { ok: true, kind: 'equation', left, right };
  } catch (error) {
    if (error instanceof ParseFail) return { ok: false, error: error.error, at: error.at };
    return { ok: false, error: 'too-complex', at: 0 };
  }
}

/* ── exact evaluation and equivalence ─────────────────────────────────────── */

type Outcome = { readonly state: 'ok'; readonly value: Rat } | { readonly state: 'undefined' } | { readonly state: 'large' };

function evalNode(node: Node, x: Rat): Rat {
  switch (node.k) {
    case 'num': return node.v;
    case 'var': return x;
    case 'neg': return negR(evalNode(node.a, x));
    case 'add': return addR(evalNode(node.a, x), evalNode(node.b, x));
    case 'sub': return subR(evalNode(node.a, x), evalNode(node.b, x));
    case 'mul': return mulR(evalNode(node.a, x), evalNode(node.b, x));
    case 'div': return divR(evalNode(node.a, x), evalNode(node.b, x));
    case 'pow': return powR(evalNode(node.a, x), node.e);
  }
}

function attempt(run: () => Rat): Outcome {
  try { return { state: 'ok', value: run() }; } catch (error) {
    if (error instanceof Stop) return { state: error.reason === 'large' ? 'large' : 'undefined' };
    return { state: 'large' };
  }
}

/** Deterministic sample points, built once: integers -12..12 and eight fractions, 33 in all. */
export const SAMPLE_POINTS: readonly Rat[] = (() => {
  const points: Rat[] = [];
  for (let value = -12; value <= 12; value += 1) points.push({ n: BigInt(value), d: 1n });
  for (const [n, d] of [[1, 2], [-1, 2], [3, 2], [-3, 2], [2, 3], [-5, 3], [7, 4], [11, 5]] as const) points.push({ n: BigInt(n), d: BigInt(d) });
  return points;
})();

/** true: the same value everywhere; false: they differ; null: undecidable (too large, or defined at too few points). */
export function sameExpression(a: Node, b: Node): boolean | null {
  let defined = 0;
  for (const point of SAMPLE_POINTS) {
    const left = attempt(() => evalNode(a, point));
    const right = attempt(() => evalNode(b, point));
    if (left.state === 'large' || right.state === 'large') return null;
    if (left.state !== right.state) return false;
    if (left.state === 'ok' && right.state === 'ok') {
      defined += 1;
      if (!sameR(left.value, right.value)) return false;
    }
  }
  return defined >= EXPRESSION_LIMITS.minDefined ? true : null;
}

function differenceAt(left: Node, right: Node, point: Rat): Outcome {
  return attempt(() => subR(evalNode(left, point), evalNode(right, point)));
}

/** Two equations are equivalent when left-minus-right of one is a nonzero constant multiple of the other's. */
export function sameEquation(a: { left: Node; right: Node }, b: { left: Node; right: Node }): boolean | null {
  let defined = 0;
  let factor: Rat | null = null;
  for (const point of SAMPLE_POINTS) {
    const first = differenceAt(a.left, a.right, point);
    const second = differenceAt(b.left, b.right, point);
    if (first.state === 'large' || second.state === 'large') return null;
    if (first.state !== second.state) return false;
    if (first.state !== 'ok' || second.state !== 'ok') continue;
    defined += 1;
    if (isZero(first.value)) {
      if (!isZero(second.value)) return false;
      continue;
    }
    try {
      const ratio = divR(second.value, first.value);
      if (isZero(ratio)) return false;
      if (factor === null) factor = ratio;
      else if (!sameR(factor, ratio)) return false;
    } catch { return null; }
  }
  return defined >= EXPRESSION_LIMITS.minDefined ? true : null;
}

/* ── polynomials, for the form checks ─────────────────────────────────────── */

class NotPolynomial extends Error {}
type Poly = Rat[];

function trim(poly: Poly): Poly {
  while (poly.length > 0 && isZero(poly[poly.length - 1]!)) poly.pop();
  return poly;
}

function capped(poly: Poly): Poly {
  if (poly.length - 1 > EXPRESSION_LIMITS.maxDegree) throw new Stop('large');
  return poly;
}

const polyAdd = (a: Poly, b: Poly, sign: 1 | -1): Poly => {
  const out: Poly = [];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? ZERO;
    const right = b[index] ?? ZERO;
    out.push(sign === 1 ? addR(left, right) : subR(left, right));
  }
  return trim(out);
};

function polyMul(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  capped(out);
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] = addR(out[i + j]!, mulR(a[i]!, b[j]!));
  return trim(out);
}

function polyOf(node: Node): Poly {
  switch (node.k) {
    case 'num': return trim([node.v]);
    case 'var': return [ZERO, ONE];
    case 'neg': return polyOf(node.a).map(negR);
    case 'add': return capped(polyAdd(polyOf(node.a), polyOf(node.b), 1));
    case 'sub': return capped(polyAdd(polyOf(node.a), polyOf(node.b), -1));
    case 'mul': return capped(polyMul(polyOf(node.a), polyOf(node.b)));
    case 'pow': {
      const base = polyOf(node.a);
      let result: Poly = [ONE];
      for (let step = 0; step < node.e; step += 1) result = capped(polyMul(result, base));
      return result;
    }
    case 'div': {
      const bottom = polyOf(node.b);
      if (bottom.length === 0) throw new Stop('undefined');
      if (bottom.length !== 1) throw new NotPolynomial();
      return polyOf(node.a).map((coefficient) => divR(coefficient, bottom[0]!));
    }
  }
}

/** Coefficients from the constant term up, or null when the expression is not a polynomial in the variable. */
export function toPolynomial(node: Node): Rat[] | null {
  try { return polyOf(node); } catch { return null; }
}

/* ── form checks ──────────────────────────────────────────────────────────── */

const isWholeLiteral = (node: Node): boolean => node.k === 'num' && !node.text.includes('.');

/** A number as a finished answer: a literal, a negated literal, or a lowest-terms fraction of whole literals. */
function isPlainNumber(node: Node): boolean {
  const inner = node.k === 'neg' ? node.a : node;
  if (inner.k === 'num') return true;
  if (inner.k !== 'div' || !isWholeLiteral(inner.a) || !isWholeLiteral(inner.b)) return false;
  const top = (inner.a as { v: Rat }).v.n;
  const bottom = (inner.b as { v: Rat }).v.n;
  return bottom > 1n && gcd(top, bottom) === 1n;
}

function plainValue(node: Node): Rat | null {
  if (!isPlainNumber(node)) return null;
  const outcome = attempt(() => evalNode(node, ZERO));
  return outcome.state === 'ok' ? outcome.value : null;
}

function isVariablePower(node: Node): number | null {
  if (node.k === 'var') return 1;
  if (node.k === 'pow' && node.a.k === 'var' && node.e >= 2) return node.e;
  return null;
}

/** The degree of a finished term (a number, `c`, `x^k`, `cx^k`, or such a term over a whole number), or null. */
function termDegree(node: Node): number | null {
  const body = node.k === 'neg' ? node.a : node;
  if (body.k === 'neg') return null;
  if (isPlainNumber(body)) return 0;
  const power = isVariablePower(body);
  if (power !== null) return power;
  if (body.k === 'mul') {
    const coefficient = plainValue(body.a);
    const inner = isVariablePower(body.b);
    if (coefficient === null || inner === null || isZero(coefficient) || sameR(coefficient, ONE) || sameR(coefficient, negR(ONE))) return null;
    return inner;
  }
  if (body.k === 'div' && isWholeLiteral(body.b) && (body.b as { v: Rat }).v.n > 1n) {
    const top = body.a;
    const inner = isVariablePower(top);
    if (inner !== null) return inner;
    if (top.k === 'mul' && isWholeLiteral(top.a)) {
      const degree = isVariablePower(top.b);
      const numerator = (top.a as { v: Rat }).v.n;
      if (degree !== null && numerator > 1n && gcd(numerator, (body.b as { v: Rat }).v.n) === 1n) return degree;
    }
  }
  return null;
}

function sumLeaves(node: Node, out: Node[]): void {
  if (node.k === 'add' || node.k === 'sub') { sumLeaves(node.a, out); sumLeaves(node.b, out); } else out.push(node);
}

/** Expanded and collected: a sum of finished terms with no two of the same degree. */
function isExpanded(node: Node): boolean {
  const leaves: Node[] = [];
  sumLeaves(node, leaves);
  const seen = new Set<number>();
  for (const leaf of leaves) {
    const degree = termDegree(leaf);
    if (degree === null || seen.has(degree)) return false;
    seen.add(degree);
  }
  return leaves.length === 1 ? true : !leaves.some((leaf) => leaf.k === 'num' && isZero(leaf.v));
}

function factorsOf(node: Node, out: Node[]): void {
  if (node.k === 'mul') { factorsOf(node.a, out); factorsOf(node.b, out); } else out.push(node);
}

function integerCoefficients(poly: Poly): bigint[] {
  let common = 1n;
  for (const coefficient of poly) common = (common / gcd(common, coefficient.d)) * coefficient.d;
  return poly.map((coefficient) => (coefficient.n * common) / coefficient.d);
}

function isSquare(value: bigint): boolean {
  if (value < 0n) return false;
  if (value < 2n) return true;
  let low = 1n;
  let high = value;
  while (low <= high) {
    const mid = (low + high) / 2n;
    const square = mid * mid;
    if (square === value) return true;
    if (square < value) low = mid + 1n; else high = mid - 1n;
  }
  return false;
}

/** A bracketed sum is finished when no whole number, no x and (for a quadratic) no pair of whole-number brackets can be taken out of it. */
function isFinishedSum(factor: Node): boolean {
  const sum = factor.k === 'pow' ? factor.a : factor;
  if (sum.k !== 'add' && sum.k !== 'sub') return false;
  if (!isExpanded(sum)) return false;
  const poly = toPolynomial(sum);
  if (!poly || poly.length < 2 || isZero(poly[0]!)) return false;
  const whole = integerCoefficients(poly);
  if (whole.reduce((common, coefficient) => gcd(common, coefficient), 0n) !== 1n) return false;
  if (whole.length === 3 && isSquare(whole[1]! * whole[1]! - 4n * whole[2]! * whole[0]!)) return false;
  return true;
}

function isFactored(node: Node): boolean {
  const factors: Node[] = [];
  factorsOf(node, factors);
  if (factors.length === 1) return factors[0]!.k === 'pow' && isFinishedSum(factors[0]!);
  let numbers = 0;
  let powers = 0;
  let sums = 0;
  for (const [index, raw] of factors.entries()) {
    const factor = raw.k === 'neg' && index === 0 && raw.a.k !== 'neg' ? raw.a : raw;
    if (isPlainNumber(factor)) {
      const value = plainValue(raw);
      if (value === null || isZero(value) || sameR(value, ONE) || sameR(value, negR(ONE))) return false;
      numbers += 1;
    } else if (isVariablePower(factor) !== null) {
      powers += 1;
    } else if (isFinishedSum(factor)) sums += 1;
    else return false;
  }
  return numbers <= 1 && powers <= 1 && sums >= 1;
}

/** Does this parsed line already have the shape the task asks for? */
export function satisfiesForm(parsed: Parsed, form: ExpressionForm): boolean {
  if (!parsed.ok) return false;
  if (parsed.kind === 'expression') return form === 'expanded' ? isExpanded(parsed.expr) : form === 'factored' ? isFactored(parsed.expr) : false;
  const { left, right } = parsed;
  if (form === 'isolated') return (left.k === 'var' && isPlainNumber(right)) || (right.k === 'var' && isPlainNumber(left));
  if (form === 'separated') return (termDegree(left) === 1 && isPlainNumber(right)) || (termDegree(right) === 1 && isPlainNumber(left));
  return false;
}

/* ── tasks, lines and keys ────────────────────────────────────────────────── */

export interface ExpressionTask { task: ExpressionTaskKind; given: string; form: ExpressionForm; variable: string }

const kindOf = (task: ExpressionTaskKind): 'expression' | 'equation' => (task === 'rewrite' ? 'expression' : 'equation');

export function isExpressionTask(value: unknown): value is ExpressionTask {
  if (typeof value !== 'object' || value === null) return false;
  const { task, given, form, variable } = value as Record<string, unknown>;
  return (task === 'rewrite' || task === 'solve') && typeof given === 'string' && typeof variable === 'string'
    && typeof form === 'string' && (EXPRESSION_FORMS[task] as readonly string[]).includes(form);
}

/** Why this public task cannot be played, or null: it parses with the right kind, and the given does not already have the finished shape. */
export function expressionTaskProblem(task: ExpressionTask): string | null {
  if (!(EXPRESSION_FORMS[task.task] as readonly string[]).includes(task.form)) return 'The form does not belong to the task';
  const given = parseExpression(task.given, task.variable);
  if (!given.ok) return `The given does not parse (${given.error})`;
  if (given.kind !== kindOf(task.task)) return task.task === 'rewrite' ? 'A rewrite task starts from an expression, not an equation' : 'A solve task starts from an equation';
  if (satisfiesForm(given, task.form)) return 'The given already has the finished form';
  return null;
}

/** Why this key cannot be the one answer of the task, or null: it parses, has the finished form and equals the given. */
export function expressionReferenceProblem(task: ExpressionTask, reference: unknown): string | null {
  const problem = expressionTaskProblem(task);
  if (problem) return problem;
  const key = parseExpression(reference, task.variable);
  if (!key.ok) return `The reference does not parse (${key.error})`;
  if (key.kind !== kindOf(task.task)) return 'The reference is not the same kind as the given';
  if (!satisfiesForm(key, task.form)) return 'The reference does not have the finished form';
  return sameParsed(parseExpression(task.given, task.variable), key) === true ? null : 'The reference is not equivalent to the given';
}

/** Equivalence of two parsed lines of the same kind; null when undecidable. */
export function sameParsed(a: Parsed, b: Parsed): boolean | null {
  if (!a.ok || !b.ok || a.kind !== b.kind) return null;
  if (a.kind === 'expression' && b.kind === 'expression') return sameExpression(a.expr, b.expr);
  if (a.kind === 'equation' && b.kind === 'equation') return sameEquation(a, b);
  return null;
}

export interface LineReport {
  /** Why the line cannot be read, or null. `kind` is an equation where an expression is wanted, or the reverse. */
  error: ParseError | 'kind' | 'complex' | null;
  /** The line has the same value (or solution) as the line above it; the first line is compared with the given. */
  same: boolean;
}

export interface LineAnalysis {
  wellFormed: boolean;
  chainSound: boolean;
  lines: LineReport[];
  parsed: Parsed[];
  given: Parsed;
}

/** Reads every line of a response and compares each with the one above. Null when the task's own given is unusable. */
export function analyseLines(task: ExpressionTask, lines: readonly unknown[]): LineAnalysis | null {
  const given = parseExpression(task.given, task.variable);
  if (!given.ok || given.kind !== kindOf(task.task) || lines.length < 1 || lines.length > EXPRESSION_LIMITS.maxLines) return null;
  const reports: LineReport[] = [];
  const parsed: Parsed[] = [];
  let previous: Parsed = given;
  for (const line of lines) {
    const current = parseExpression(line, task.variable);
    parsed.push(current);
    if (!current.ok) { reports.push({ error: current.error, same: false }); continue; }
    if (current.kind !== kindOf(task.task)) { reports.push({ error: 'kind', same: false }); continue; }
    const same = sameParsed(previous, current);
    if (same === null) { reports.push({ error: 'complex', same: false }); continue; }
    reports.push({ error: null, same });
    previous = current;
  }
  return {
    wellFormed: reports.every((report) => report.error === null),
    chainSound: reports.every((report) => report.same),
    lines: reports, parsed, given,
  };
}

/* ── notation for the board: only ever built from the parsed tree ─────────── */

const PREC = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 } as const;

function texOf(node: Node, variable: string, point: string): { s: string; p: number } {
  switch (node.k) {
    case 'num': return { s: node.text.replace('.', point), p: PREC.atom };
    case 'var': return { s: variable, p: PREC.atom };
    case 'neg': {
      const inner = texOf(node.a, variable, point);
      return { s: `-${inner.p < PREC.neg ? `(${inner.s})` : inner.s}`, p: PREC.neg };
    }
    case 'add': case 'sub': {
      const left = texOf(node.a, variable, point);
      const right = texOf(node.b, variable, point);
      const wrap = node.k === 'sub' ? right.p <= PREC.add || node.b.k === 'neg' : node.b.k === 'neg';
      return { s: `${left.s}${node.k === 'add' ? '+' : '-'}${wrap ? `(${right.s})` : right.s}`, p: PREC.add };
    }
    case 'mul': {
      const left = texOf(node.a, variable, point);
      const right = texOf(node.b, variable, point);
      const leftText = left.p < PREC.mul ? `(${left.s})` : left.s;
      const wrapRight = right.p < PREC.mul || node.b.k === 'neg';
      const rightText = wrapRight ? `(${right.s})` : right.s;
      const explicit = !wrapRight && (node.b.k === 'num' || (node.a.k === 'num' && node.b.k === 'pow' && node.b.a.k === 'num'));
      return { s: explicit ? `${leftText}\\cdot ${rightText}` : `${leftText}${rightText}`, p: PREC.mul };
    }
    case 'div': return { s: `\\frac{${texOf(node.a, variable, point).s}}{${texOf(node.b, variable, point).s}}`, p: PREC.atom };
    case 'pow': {
      const base = texOf(node.a, variable, point);
      return { s: `${base.p < PREC.atom ? `(${base.s})` : base.s}^{${node.e}}`, p: PREC.pow };
    }
  }
}

export type DecimalMark = '.' | ',';

/** KaTeX source for a parsed line, with the locale's decimal mark. Built only from the tree (digits, the variable letter and fixed commands), never from learner text. */
export function toLatex(parsed: Parsed, variable: string, decimal: DecimalMark = '.'): string {
  if (!parsed.ok) return '';
  const point = decimal === ',' ? '{,}' : '.';
  return parsed.kind === 'expression' ? texOf(parsed.expr, variable, point).s : `${texOf(parsed.left, variable, point).s}=${texOf(parsed.right, variable, point).s}`;
}

export interface SpokenWords { plus: string; minus: string; times: string; over: string; power: string; equals: string; open: string; close: string; negative: string }

function spokenOf(node: Node, variable: string, words: SpokenWords, point: string): { s: string; p: number } {
  const group = (inner: { s: string; p: number }, below: number) => (inner.p < below ? `${words.open} ${inner.s} ${words.close}` : inner.s);
  switch (node.k) {
    case 'num': return { s: node.text.replace('.', point), p: PREC.atom };
    case 'var': return { s: variable, p: PREC.atom };
    case 'neg': return { s: `${words.negative} ${group(spokenOf(node.a, variable, words, point), PREC.neg)}`, p: PREC.neg };
    case 'add': case 'sub': {
      const right = spokenOf(node.b, variable, words, point);
      const wrap = node.k === 'sub' ? right.p <= PREC.add || node.b.k === 'neg' : node.b.k === 'neg';
      return { s: `${spokenOf(node.a, variable, words, point).s} ${node.k === 'add' ? words.plus : words.minus} ${wrap ? `${words.open} ${right.s} ${words.close}` : right.s}`, p: PREC.add };
    }
    case 'mul': {
      const right = spokenOf(node.b, variable, words, point);
      return { s: `${group(spokenOf(node.a, variable, words, point), PREC.mul)} ${words.times} ${right.p < PREC.mul || node.b.k === 'neg' ? `${words.open} ${right.s} ${words.close}` : right.s}`, p: PREC.mul };
    }
    case 'div': return { s: `${group(spokenOf(node.a, variable, words, point), PREC.mul)} ${words.over} ${group(spokenOf(node.b, variable, words, point), PREC.atom)}`, p: PREC.mul };
    case 'pow': return { s: `${group(spokenOf(node.a, variable, words, point), PREC.atom)} ${words.power} ${node.e}`, p: PREC.pow };
  }
}

/** A spoken reading of a parsed line, for assistive technology; the words come from the caller's locale. */
export function toSpoken(parsed: Parsed, variable: string, words: SpokenWords, decimal: DecimalMark = '.'): string {
  if (!parsed.ok) return '';
  const point = decimal === ',' ? ',' : '.';
  return parsed.kind === 'expression' ? spokenOf(parsed.expr, variable, words, point).s : `${spokenOf(parsed.left, variable, words, point).s} ${words.equals} ${spokenOf(parsed.right, variable, words, point).s}`;
}
