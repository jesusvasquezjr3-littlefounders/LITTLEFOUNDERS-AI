/**
 * Typed numeric text, exactly as the browser submits it (`parseLocaleNumber` yields a canonical decimal: no grouping,
 * a '.' separator, no leading or trailing zeros). The scorer accepts only that form, so "3,0" or " 3" is malformed.
 */
export type Rational = { readonly n: bigint; readonly d: bigint };

const CANONICAL = /^(-?)(0|[1-9]\d{0,11})(?:\.(\d{0,8}[1-9]))?$/;

/** The exact value of a canonical decimal, or null for anything else (including "-0"). */
export function canonicalRational(text: unknown): Rational | null {
  if (typeof text !== 'string') return null;
  const match = CANONICAL.exec(text);
  if (!match) return null;
  const fraction = match[3] ?? '';
  const magnitude = BigInt(`${match[2]}${fraction}`);
  if (magnitude === 0n && match[1] === '-') return null;
  return { n: match[1] ? -magnitude : magnitude, d: 10n ** BigInt(fraction.length) };
}

export const sameRational = (a: Rational, b: Rational): boolean => a.n * b.d === b.n * a.d;

/** An exact `numerator / denominator` of whole numbers, as a Rational. */
export const ratio = (numerator: number, denominator = 1): Rational => ({ n: BigInt(numerator), d: BigInt(denominator) });

/** The canonical decimal of a Rational whose denominator divides a power of ten, or null (never rounds). */
export function canonicalText(value: Rational): string | null {
  for (let places = 0; places <= 8; places += 1) {
    const scale = 10n ** BigInt(places);
    if ((value.n * scale) % value.d !== 0n) continue;
    const scaled = (value.n * scale) / value.d;
    const sign = scaled < 0n ? '-' : '';
    const digits = (scaled < 0n ? -scaled : scaled).toString().padStart(places + 1, '0');
    const whole = digits.slice(0, digits.length - places);
    const fraction = digits.slice(digits.length - places);
    return `${sign}${whole}${places ? `.${fraction}` : ''}`;
  }
  return null;
}
