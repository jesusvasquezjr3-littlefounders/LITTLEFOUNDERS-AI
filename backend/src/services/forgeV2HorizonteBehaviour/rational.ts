export interface Q { n: bigint; d: bigint }

const abs = (value: bigint): bigint => (value < 0n ? -value : value);
const gcd = (a: bigint, b: bigint): bigint => { let x = abs(a); let y = abs(b); while (y !== 0n) { [x, y] = [y, x % y]; } return x; };

export function q(n: bigint | number, d: bigint | number = 1n): Q {
  const top = BigInt(n); const bottom = BigInt(d);
  if (bottom === 0n) throw new RangeError('zero denominator');
  const g = gcd(top, bottom) || 1n;
  return bottom < 0n ? { n: -top / g, d: -bottom / g } : { n: top / g, d: bottom / g };
}

export const ZERO = q(0);
export const ONE = q(1);
export const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
export const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const cmp = (a: Q, b: Q): number => { const left = a.n * b.d; const right = b.n * a.d; return left < right ? -1 : left > right ? 1 : 0; };
export const eq = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
export const isZero = (a: Q): boolean => a.n === 0n;
export const isInteger = (a: Q): boolean => a.d === 1n;

/** A plain decimal text ("-12.5") as an exact rational, or null. */
export function fromDecimal(text: unknown): Q | null {
  if (typeof text !== 'string' || !/^-?(0|[1-9]\d{0,14})(\.\d{1,12})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  return q((negative ? -1n : 1n) * BigInt(`${whole}${fraction}`), 10n ** BigInt(fraction.length));
}

/** The exact decimal text of a rational with a finite expansion of at most 12 places, or null. */
export function toDecimal(value: Q): string | null {
  for (let places = 0; places <= 12; places += 1) {
    const scale = 10n ** BigInt(places);
    if ((value.n * scale) % value.d !== 0n) continue;
    const scaled = (value.n * scale) / value.d;
    const digits = abs(scaled).toString().padStart(places + 1, '0');
    const whole = digits.slice(0, digits.length - places);
    const fraction = digits.slice(digits.length - places);
    return `${scaled < 0n ? '-' : ''}${whole}${places > 0 ? `.${fraction}` : ''}`;
  }
  return null;
}
