import { add, div, eq, isInteger, isZero, mul, neg, q, ZERO, ONE, type Q } from './rational.js';

export type Poly = Q[];
export type Line = { kind: 'expression'; poly: Poly } | { kind: 'equation'; left: Poly; right: Poly };

const trim = (poly: Poly): Poly => { const out = [...poly]; while (out.length > 0 && isZero(out[out.length - 1]!)) out.pop(); return out; };
const plus = (a: Poly, b: Poly): Poly => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, index) => add(a[index] ?? ZERO, b[index] ?? ZERO)));
const minus = (a: Poly, b: Poly): Poly => plus(a, b.map(neg));
const times = (a: Poly, b: Poly): Poly => {
  if (a.length === 0 || b.length === 0) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((left, i) => b.forEach((right, j) => { out[i + j] = add(out[i + j]!, mul(left, right)); }));
  return trim(out);
};

class Reader {
  index = 0;
  constructor(private readonly text: string, private readonly variable: string) {}
  private peek(): string | undefined { while (this.text[this.index] === ' ') this.index += 1; return this.text[this.index]; }
  done(): boolean { return this.peek() === undefined; }

  sum(): Poly {
    let left = this.product();
    for (;;) {
      const next = this.peek();
      if (next !== '+' && next !== '-') return left;
      this.index += 1;
      const right = this.product();
      left = next === '+' ? plus(left, right) : minus(left, right);
    }
  }

  private product(): Poly {
    let left = this.unary();
    for (;;) {
      const next = this.peek();
      if (next === '*') { this.index += 1; left = times(left, this.unary()); }
      else if (next === '/') {
        this.index += 1;
        const bottom = this.unary();
        if (bottom.length !== 1) throw new RangeError('division');
        left = left.map((coefficient) => div(coefficient, bottom[0]!));
      } else if (next === this.variable || next === '(') left = times(left, this.power());
      else return left;
    }
  }

  private unary(): Poly {
    const next = this.peek();
    if (next === '-') { this.index += 1; return this.unary().map(neg); }
    if (next === '+') { this.index += 1; return this.unary(); }
    return this.power();
  }

  private power(): Poly {
    const base = this.atom();
    if (this.peek() !== '^') return base;
    this.index += 1;
    const digits = /^\d+/.exec(this.text.slice(this.index));
    if (!digits) throw new RangeError('exponent');
    this.index += digits[0].length;
    let result: Poly = [ONE];
    for (let step = 0; step < Number(digits[0]); step += 1) result = times(result, base);
    return result;
  }

  private atom(): Poly {
    const next = this.peek();
    if (next === undefined) throw new RangeError('end');
    if (next === '(') {
      this.index += 1;
      const inner = this.sum();
      if (this.peek() !== ')') throw new RangeError('unbalanced');
      this.index += 1;
      return inner;
    }
    if (next === this.variable) { this.index += 1; return [ZERO, ONE]; }
    const number = /^\d+(\.\d+)?/.exec(this.text.slice(this.index));
    if (!number) throw new RangeError('symbol');
    this.index += number[0].length;
    const [whole, fraction = ''] = number[0].split('.');
    return trim([q(BigInt(`${whole}${fraction}`), 10n ** BigInt(fraction.length))]);
  }
}

function side(text: string, variable: string): Poly | null {
  try {
    const reader = new Reader(text, variable);
    const poly = reader.sum();
    return reader.done() ? poly : null;
  } catch { return null; }
}

/** A line as the editor's subset reads it (whole and decimal numbers, one variable, + - * / ^ and brackets), or null when it does not read. */
export function readLine(text: string, variable: string): Line | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > 64) return null;
  const parts = text.split('=');
  if (parts.length > 2) return null;
  const sides = parts.map((part) => side(part, variable));
  if (sides.some((poly) => poly === null)) return null;
  return parts.length === 1 ? { kind: 'expression', poly: sides[0]! } : { kind: 'equation', left: sides[0]!, right: sides[1]! };
}

const same = (a: Poly, b: Poly): boolean => a.length === b.length && a.every((coefficient, index) => eq(coefficient, b[index]!));

/** Same value for expressions; for equations, the differences are proportional by a nonzero factor. */
export function equivalent(a: Line, b: Line): boolean {
  if (a.kind === 'expression' && b.kind === 'expression') return same(a.poly, b.poly);
  if (a.kind !== 'equation' || b.kind !== 'equation') return false;
  const first = minus(a.left, a.right); const second = minus(b.left, b.right);
  if (first.length === 0 || second.length === 0) return first.length === second.length;
  if (first.length !== second.length) return false;
  const factor = div(second[0]!, first[0]!);
  return first.every((coefficient, index) => eq(mul(coefficient, factor), second[index]!)) && !isZero(factor);
}

export const wholeCoefficients = (poly: Poly): boolean => poly.every(isInteger);

/** An integer polynomial printed with its terms from the highest degree down (or the lowest up), `x^2+5x+6`. */
export function printPoly(poly: Poly, variable: string, descending = true): string {
  const terms = poly.map((coefficient, degree) => ({ coefficient, degree })).filter((term) => !isZero(term.coefficient));
  if (terms.length === 0) return '0';
  const ordered = descending ? terms.reverse() : terms;
  return ordered.map(({ coefficient, degree }, index) => {
    const size = coefficient.n < 0n ? -coefficient.n : coefficient.n;
    const body = degree === 0 ? String(size) : `${size === 1n ? '' : size}${variable}${degree === 1 ? '' : `^${degree}`}`;
    return `${coefficient.n < 0n ? '-' : index === 0 ? '' : '+'}${body}`;
  }).join('');
}

export const polyOf = (line: Line): Poly | null => (line.kind === 'expression' ? line.poly : null);
export const differenceOf = (line: Line): Poly | null => (line.kind === 'equation' ? minus(line.left, line.right) : null);
export const plusConstant = (poly: Poly, amount: Q): Poly => plus(poly, trim([amount]));
export const scaled = (poly: Poly, factor: Q): Poly => trim(poly.map((coefficient) => mul(coefficient, factor)));
