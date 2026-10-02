import type { Locale } from '../../../design/copyBudget';

/*
 * Display and speech helpers of the life-sim board. Every figure comes from the pure model in whole money; this file only writes
 * it for a locale. `$` is the generic Horizonte currency sign: no real currency is implied.
 */

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let known = formats.get(key);
  if (!known) { known = new Intl.NumberFormat(locale, options); formats.set(key, known); }
  return known;
}

export const count = (locale: Locale, value: number): string => numberFormat(locale, { maximumFractionDigits: 0 }).format(Object.is(value, -0) ? 0 : value);

/** Replaces each `{name}` in a copy string. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (found, name: string) => String(values[name] ?? found));

/** Whole money as an amount: 12500 -> "$12,500", -300 -> "-$300". */
export const money = (locale: Locale, value: number): string => `${value < 0 ? '-' : ''}$${count(locale, Math.abs(value))}`;

/** The same on a chart axis, short: 12500 -> "$12.5K". */
export const compactMoney = (locale: Locale, value: number): string => `${value < 0 ? '-' : ''}$${numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(value))}`;

/** A return in percent with its sign: 6 -> "+6%", -30 -> "-30%", 0 -> "0%". */
export const signedPercent = (locale: Locale, value: number): string => `${numberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(value)}%`;

const WORDS = {
  'en-US': { unit: ['dollar', 'dollars'], minus: 'minus' },
  'es-MX': { unit: ['dólar', 'dólares'], minus: 'menos' },
  'pt-BR': { unit: ['dólar', 'dólares'], minus: 'menos' },
} as const;

/** The amount as it is read aloud: "12,500 dollars". Used in aria labels, never as visible text. */
export function spokenMoney(locale: Locale, value: number): string {
  const words = WORDS[locale];
  const abs = Math.abs(value);
  const text = `${count(locale, abs)} ${abs === 1 ? words.unit[0] : words.unit[1]}`;
  return value < 0 ? `${words.minus} ${text}` : text;
}

const STEPS = [1, 2, 5] as const;

/** The smallest 1, 2 or 5 times a power of ten that cuts `span` into at most `parts` steps. */
export function niceStep(span: number, parts: number): number {
  if (!(span > 0)) return 1;
  for (let power = 1; ; power *= 10) {
    for (const step of STEPS) if (span / (step * power) <= parts) return step * power;
  }
}

export interface Axis { low: number; high: number; ticks: number[] }

/** A y axis on whole multiples of a nice step that covers `low` to `high` in at most `parts` steps. */
export function axisOf(low: number, high: number, parts = 4): Axis {
  const step = niceStep(high - low, parts);
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= last; value += step) ticks.push(value);
  return { low: first, high: last === first ? first + step : last, ticks };
}

/** The value below which `share` of the values lie (nearest rank); `values` need not be sorted. */
export function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))] as number;
}
