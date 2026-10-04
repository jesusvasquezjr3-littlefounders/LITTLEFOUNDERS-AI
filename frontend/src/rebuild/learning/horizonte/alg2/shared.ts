import type { Locale } from '../../../design/copyBudget';
import type { PlanoPoint } from '../plano';
import type { DecimalMark } from './expression.generated';
import type { Dec, GraphFamily, GraphForm, GraphWindow, PlaneLine, Slider } from './model.generated';

export const fmt = (locale: Locale, value: number, digits = 2): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);

/** The decimal mark of a locale: a comma in pt-BR, a point in en-US and es-MX (Intl, so it follows the platform's CLDR data). */
export function decimalMarkOf(locale: Locale): DecimalMark {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value === ',' ? ',' : '.';
}

/** A point as `(x, y)`; where the decimal mark is a comma the pair is split by a semicolon so `(0,5; 1,5)` still reads as two numbers. */
export const pairText = (locale: Locale, x: number, y: number): string => `(${fmt(locale, x)}${decimalMarkOf(locale) === ',' ? '; ' : ', '}${fmt(locale, y)})`;

export const slots = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

/* A slider number has at most three decimals, so every value is a whole number of thousandths: exact, no float drift. */

export const thousandths = (value: Dec): bigint => value.n * (1000n / value.d);

export function thousandthsText(value: bigint): string {
  const negative = value < 0n;
  const size = negative ? -value : value;
  const whole = size / 1000n;
  const fraction = (size % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${negative && size !== 0n ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** A slider as a row of whole steps: step 0 is its minimum, `steps` its maximum. */
export interface Track { min: bigint; step: bigint; steps: number }

export const trackOf = (slider: Slider): Track => {
  const min = thousandths(slider.min);
  const step = thousandths(slider.step);
  return { min, step, steps: Number((thousandths(slider.max) - min) / step) };
};

export const stepOf = (track: Track, value: Dec): number => Number((thousandths(value) - track.min) / track.step);

export const textAt = (track: Track, step: number): string => thousandthsText(track.min + BigInt(step) * track.step);

/* An equation as data: digits, letters and signs written from the exact slider text. */

function term(locale: Locale, value: number, symbol: string, first: boolean): string {
  if (value === 0) return '';
  const size = Math.abs(value);
  const body = symbol && size === 1 ? symbol : `${fmt(locale, size, 3)}${symbol}`;
  if (first) return value < 0 ? `-${body}` : body;
  return ` ${value < 0 ? '-' : '+'} ${body}`;
}

const sum = (locale: Locale, terms: ReadonlyArray<readonly [number, string]>): string => {
  let out = '';
  for (const [value, symbol] of terms) out += term(locale, value, symbol, out === '');
  return out === '' ? '0' : out;
};

/** `y = ...` for the slider values (their text), in the form the sliders are in. */
export function equationText(locale: Locale, curve: GraphFamily, form: GraphForm, values: ReadonlyMap<string, string>): string {
  const n = (name: string) => Number(values.get(name) ?? '0');
  if (curve === 'line') return `y = ${sum(locale, [[n('m'), 'x'], [n('b'), '']])}`;
  if (curve === 'quadratic' && form === 'vertex') {
    const a = n('a'); const h = n('h'); const k = n('k');
    const lead = a === 1 ? '' : a === -1 ? '-' : fmt(locale, a, 3);
    const inner = h === 0 ? 'x' : `(x ${h < 0 ? '+' : '-'} ${fmt(locale, Math.abs(h), 3)})`;
    return `y = ${lead}${inner}²${term(locale, k, '', false)}`;
  }
  if (curve === 'quadratic') return `y = ${sum(locale, [[n('a'), 'x²'], [n('b'), 'x'], [n('c'), '']])}`;
  const a = n('a'); const b = n('b');
  return `y = ${a === 1 ? '' : `${fmt(locale, a, 3)} · `}${fmt(locale, b, 3)}^x`;
}

/** The two ends of a line a x + b y = c where it meets the window; empty when it misses the window. */
export function clipLine(line: PlaneLine, window: GraphWindow): PlanoPoint[] {
  const { a, b, c } = line;
  const { xMin, xMax, yMin, yMax } = window;
  const epsilon = 1e-9;
  const found: PlanoPoint[] = [];
  const push = (x: number, y: number) => {
    const inside = x >= xMin - epsilon && x <= xMax + epsilon && y >= yMin - epsilon && y <= yMax + epsilon;
    if (inside && !found.some((other) => Math.abs(other.x - x) < epsilon && Math.abs(other.y - y) < epsilon)) found.push({ x, y });
  };
  if (b !== 0) { push(xMin, (c - a * xMin) / b); push(xMax, (c - a * xMax) / b); }
  if (a !== 0) { push((c - b * yMin) / a, yMin); push((c - b * yMax) / a, yMax); }
  return found.slice(0, 2);
}
