import { add, cmp, div, eq, mul, neg, q, sub, toDecimal, type Q } from './rational.js';
import { range, unique, type HzBuilder, type HzSpace, type Json } from './shared.js';

type Expr =
  | { k: 'n'; v: Q }
  | { k: 'v'; name: 'x' | 'y' }
  | { k: 'neg'; a: Expr }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; a: Expr; b: Expr }
  | { k: 'pow'; a: Expr; e: number };

type Tok = { t: 'n'; whole: string; frac: string } | { t: 'v'; name: 'x' | 'y' } | { t: 'o'; ch: string } | { t: '(' | ')' };

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

function lex(text: string): Tok[] | null {
  const out: Tok[] = [];
  let at = 0;
  while (at < text.length) {
    const ch = text[at]!;
    if (ch === ' ') { at += 1; continue; }
    if (isDigit(ch)) {
      let end = at;
      while (isDigit(text[end])) end += 1;
      const whole = text.slice(at, end);
      let frac = '';
      if (text[end] === '.' || text[end] === ',') {
        let stop = end + 1;
        while (isDigit(text[stop])) stop += 1;
        if (stop === end + 1) return null;
        frac = text.slice(end + 1, stop);
        end = stop;
      }
      if (whole.length + frac.length > 6) return null;
      out.push({ t: 'n', whole, frac });
      at = end;
      continue;
    }
    if (ch === 'x' || ch === 'X') out.push({ t: 'v', name: 'x' });
    else if (ch === 'y' || ch === 'Y') out.push({ t: 'v', name: 'y' });
    else if ('+-*/^'.includes(ch)) out.push({ t: 'o', ch });
    else if (ch === '(' || ch === ')') out.push({ t: ch });
    else return null;
    at += 1;
  }
  return out;
}

class Refuse extends Error {}

function read(text: string): Expr | null {
  if (text.length > 48) return null;
  let start = 0;
  while (text[start] === ' ') start += 1;
  if (text[start] === 'z' || text[start] === 'Z') {
    let next = start + 1;
    while (text[next] === ' ') next += 1;
    if (text[next] !== '=') return null;
    start = next + 1;
  }
  const tokens = lex(text.slice(start));
  if (!tokens || tokens.length === 0) return null;
  let at = 0;
  const peek = (): Tok | undefined => tokens[at];
  const fail = (): never => { throw new Refuse(); };
  const sum = (): Expr => {
    let left = term();
    for (;;) {
      const token = peek();
      if (token?.t !== 'o' || (token.ch !== '+' && token.ch !== '-')) return left;
      at += 1;
      left = { k: 'bin', op: token.ch, a: left, b: term() };
    }
  };
  const term = (): Expr => {
    let left = signed();
    for (;;) {
      const token = peek();
      if (token?.t === 'o' && (token.ch === '*' || token.ch === '/')) { at += 1; left = { k: 'bin', op: token.ch, a: left, b: signed() }; }
      else if (token && (token.t === 'v' || token.t === '(')) left = { k: 'bin', op: '*', a: left, b: power() };
      else if (token?.t === 'n') return fail();
      else return left;
    }
  };
  const signed = (): Expr => {
    const token = peek();
    if (token?.t === 'o' && (token.ch === '-' || token.ch === '+')) { at += 1; const inner = signed(); return token.ch === '-' ? { k: 'neg', a: inner } : inner; }
    return power();
  };
  const power = (): Expr => {
    const base = atom();
    const token = peek();
    if (token?.t !== 'o' || token.ch !== '^') return base;
    at += 1;
    const exponent = tokens[at];
    at += 1;
    if (exponent?.t !== 'n' || exponent.frac !== '') return fail();
    const value = Number(exponent.whole);
    const after = peek();
    if (value > 6 || (after?.t === 'o' && after.ch === '^')) return fail();
    return { k: 'pow', a: base, e: value };
  };
  const atom = (): Expr => {
    const token = tokens[at];
    at += 1;
    if (!token) return fail();
    if (token.t === 'n') return { k: 'n', v: q(BigInt(token.whole + token.frac), 10n ** BigInt(token.frac.length)) };
    if (token.t === 'v') return { k: 'v', name: token.name };
    if (token.t !== '(') return fail();
    const inner = sum();
    if (tokens[at]?.t !== ')') return fail();
    at += 1;
    return inner;
  };
  try {
    const expr = sum();
    return at === tokens.length ? expr : null;
  } catch (error) {
    if (error instanceof Refuse) return null;
    throw error;
  }
}

const ZERO = q(0);
const ONE = q(1);

interface Slope { v: Q; dx: Q; dy: Q }

function slope(expr: Expr, x: Q, y: Q): Slope {
  switch (expr.k) {
    case 'n': return { v: expr.v, dx: ZERO, dy: ZERO };
    case 'v': return { v: expr.name === 'x' ? x : y, dx: expr.name === 'x' ? ONE : ZERO, dy: expr.name === 'y' ? ONE : ZERO };
    case 'neg': { const a = slope(expr.a, x, y); return { v: neg(a.v), dx: neg(a.dx), dy: neg(a.dy) }; }
    case 'pow': {
      const a = slope(expr.a, x, y);
      if (expr.e === 0) return { v: ONE, dx: ZERO, dy: ZERO };
      let low = ONE;
      for (let step = 1; step < expr.e; step += 1) low = mul(low, a.v);
      const factor = mul(q(expr.e), low);
      return { v: mul(low, a.v), dx: mul(factor, a.dx), dy: mul(factor, a.dy) };
    }
    case 'bin': {
      const a = slope(expr.a, x, y);
      const b = slope(expr.b, x, y);
      if (expr.op === '+') return { v: add(a.v, b.v), dx: add(a.dx, b.dx), dy: add(a.dy, b.dy) };
      if (expr.op === '-') return { v: sub(a.v, b.v), dx: sub(a.dx, b.dx), dy: sub(a.dy, b.dy) };
      if (expr.op === '*') return { v: mul(a.v, b.v), dx: add(mul(a.dx, b.v), mul(a.v, b.dx)), dy: add(mul(a.dy, b.v), mul(a.v, b.dy)) };
      const under = mul(b.v, b.v);
      return { v: div(a.v, b.v), dx: div(sub(mul(a.dx, b.v), mul(a.v, b.dx)), under), dy: div(sub(mul(a.dy, b.v), mul(a.v, b.dy)), under) };
    }
  }
}

const at = (expr: Expr, x: Q, y: Q): Slope | null => { try { return slope(expr, x, y); } catch { return null; } };

/* ── what a learner can type in a box ── */

function number(text: string): Q | null {
  const body = text.trim();
  if (body.length === 0 || body.length > 24) return null;
  const match = /^([+\-−])?(\d{1,9})(?:([.,])(\d{1,9})|\/(\d{1,9}))?$/.exec(body);
  if (!match) return null;
  const sign = match[1] === '-' || match[1] === '−' ? -1n : 1n;
  if (match[3]) return q(sign * BigInt(match[2]! + match[4]!), 10n ** BigInt(match[4]!.length));
  if (match[5]) return BigInt(match[5]) === 0n ? null : q(sign * BigInt(match[2]!), BigInt(match[5]));
  return q(sign * BigInt(match[2]!));
}

const spellings = (value: Q): string[] => {
  const negative = value.n < 0n;
  const top = negative ? -value.n : value.n;
  const sign = negative ? '-' : '';
  const out = [`${sign}${top}${value.d === 1n ? '' : `/${value.d}`}`];
  const decimal = toDecimal(value);
  if (decimal !== null && decimal.length <= 12) out.push(decimal, decimal.replace('.', ','), ` ${decimal} `);
  if (value.d === 1n) out.push(`${sign}${top}.0`, `${sign}${top * 2n}/2`, ...(negative ? [`−${top}`] : [`+${top}`]));
  return unique(out);
};

const fresh = (value: Q, key: readonly Q[]): boolean => key.every((entry) => !eq(entry, value));

const wrongAround = (value: Q): Q[] => [add(value, ONE), sub(value, ONE), mul(value, q(2)), neg(value), add(value, q(1, 2)), ZERO, q(7), q(100)];

const BAD_NUMBERS = ['abc', '1e2', '--1', '1.', '.5', '1/0', '1 2', '1,2,3', '1/2/3', '1234567890', '+-1', 'x', '12345678901234567890123456', '0x10'];

const blank = (count: number): string[] => Array.from({ length: count }, () => '');

function numbers(key: Q[], other: Q | null, lengthOf: (answer: string[]) => number): HzSpace {
  const one = key.length === 1;
  const boxes = key.map((value, index) => {
    const swapped = key.length === 2 ? key[1 - index]! : other;
    const near = unique([...wrongAround(value), ...(swapped ? [swapped] : [])].filter((entry) => fresh(entry, [value])).map((entry) => JSON.stringify(entry, (_k, item) => (typeof item === 'bigint' ? String(item) : item))))
      .map((text) => { const parsed = JSON.parse(text) as { n: string; d: string }; return q(BigInt(parsed.n), BigInt(parsed.d)); });
    return [...spellings(value), ...near.flatMap((entry) => spellings(entry).slice(0, 1))];
  });
  const answers = one ? boxes[0]!.map((text) => [text]) : boxes[0]!.flatMap((first) => boxes[1]!.map((second) => [first, second]));
  const right = (answer: string[]): boolean[] => answer.map((text, index) => { const value = number(text); return value !== null && eq(value, key[index]!); });
  return {
    inRange: answers.map((answer) => ({ answer })),
    invalid: [
      ...BAD_NUMBERS.map((text) => ({ answer: Array.from({ length: key.length }, () => text) })),
      ...(one ? [] : [{ answer: ['1', 'abc'] }, { answer: ['abc', '1'] }]),
      { answer: [] }, { answer: Array.from({ length: key.length + 1 }, () => '1') }, { answer: key.length === 2 ? ['1'] : ['1', '1'] },
      { answer: Array.from({ length: key.length }, () => 1) }, { answer: Array.from({ length: key.length }, () => null) }, { answer: 'x' }, { answer: null },
      { answer: Array.from({ length: key.length }, () => '1'), extra: 1 }, { value: '1' }, {}, null, [], 'x',
    ],
    initial: { answer: blank(lengthOf([])) },
    expectMet: (response) => right(response.answer).every(Boolean),
    expectDiagnostic: (response) => {
      const hits = right(response.answer);
      const texts = response.answer as string[];
      if (key.length === 2) {
        if (hits.some(Boolean)) return 'partial';
        const first = number(texts[0]!);
        const second = number(texts[1]!);
        return first && second && eq(first, key[1]!) && eq(second, key[0]!) ? 'structure' : 'value';
      }
      if (other === null) return 'value';
      const value = number(texts[0]!);
      return value !== null && eq(value, other) ? 'structure' : 'value';
    },
  };
}

/* ── math.surface-formula.v2 ── */

const linear = (a: number, b: number, c: number): string => `(${a})+(${b})*x+(${c})*y`;

function build(task: Json, reference: unknown): HzSpace | null {
  const through = task.through as Array<{ x: number; y: number; z: number }>;
  if (!Array.isArray(through) || through.length < 2 || typeof reference !== 'string') return null;
  const hits = (text: string): number | null => {
    const expr = read(text.trim());
    if (!expr) return null;
    return through.filter((point) => { const found = at(expr, q(point.x), q(point.y)); return found !== null && eq(found.v, q(point.z)); }).length;
  };
  if (hits(reference) !== through.length) return null;
  const spelled = [reference, `z = ${reference}`, `z=${reference}`, `Z = ${reference}`, ` ${reference} `, ...(reference.length <= 24 ? [`(${reference})`, `${reference}+0`, `0+${reference}`, `-(-(${reference}))`, `1*(${reference})`] : [])];
  const guesses = [
    ...range(-3, 3).flatMap((a) => range(-3, 3).flatMap((b) => range(-3, 3).map((c) => linear(a, b, c)))),
    ...unique(through.map((point) => String(point.z))).map((text) => (text.startsWith('-') ? `(${text})` : text)),
    'x', 'y', 'x*y', 'x^2', 'x^2+y^2', 'x/2', '2x', 'xy+1', '0',
  ];
  const texts = unique([...spelled, ...guesses]).filter((text) => hits(text) !== null);
  return {
    inRange: texts.map((text) => ({ answer: [text] })),
    invalid: [
      'sin(x)', 'x +', '(x', 'x)', '2 3', 'x 2', 'w', 'x^y', 'x^1.5', 'x^2^3', 'x^7', '1,', '.5', 'z', 'z =', 'x = 1', 'z = z', 'x^-1', 'x**2', '2x3', 'x,y', 'x#', 'x+'.repeat(30) + 'x',
    ].map((text) => ({ answer: [text] })).concat([
      { answer: [] }, { answer: ['x', 'x'] }, { answer: [3] as unknown as string[] }, { answer: null as unknown as string[] }, { answer: 'x' as unknown as string[] },
      { answer: ['x'], extra: 1 } as { answer: string[] }, { reference: 'x' } as unknown as { answer: string[] }, {} as { answer: string[] }, null as unknown as { answer: string[] },
    ]),
    initial: { answer: [''] },
    expectMet: (response) => hits(response.answer[0]) === through.length,
    expectDiagnostic: (response) => ((hits(response.answer[0]) ?? 0) > 0 ? 'partial' : 'miss'),
  };
}

const formula: HzBuilder = (p, r) => {
  const task = p.task as Json;
  if (typeof task !== 'object' || task === null) return null;
  if (task.kind === 'build') return build(task, r.reference);
  const expr = typeof task.expression === 'string' ? read(task.expression) : null;
  if (!expr || !Number.isInteger(task.at?.x) || !Number.isInteger(task.at?.y)) return null;
  const here = at(expr, q(task.at.x), q(task.at.y));
  if (!here) return null;
  if (task.kind === 'slope') return numbers([task.axis === 'x' ? here.dx : here.dy], task.axis === 'x' ? here.dy : here.dx, () => 1);
  if (task.kind === 'gradient') return numbers([here.dx, here.dy], null, () => 2);
  if (task.kind !== 'walk') return null;
  const rate = q(task.rate.n, task.rate.d);
  let x = q(task.at.x);
  let y = q(task.at.y);
  let reach: number | null = null;
  for (let step = 1; step <= task.maxSteps && reach === null; step += 1) {
    const now = at(expr, x, y);
    if (!now) return null;
    x = sub(x, mul(rate, now.dx));
    y = sub(y, mul(rate, now.dy));
    const next = at(expr, x, y);
    if (!next) return null;
    if (cmp(next.v, q(task.below)) <= 0) reach = step;
  }
  return reach === null ? null : numbers([q(reach)], null, () => 1);
};

export const FORMULA_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.surface-formula.v2': formula,
};
