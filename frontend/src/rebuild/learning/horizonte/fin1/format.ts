import type { Locale } from '../../../design/copyBudget';
import { pluralUnit } from '../../../design/plural';

/*
 * Display and speech helpers shared by the three fin1 boards. Every figure the boards print comes from the pure model in
 * integer cents or whole basis points; this file only writes it for a locale. `$` is the generic currency sign of the
 * Horizonte finance pieces: no real currency is implied.
 */

const decimals = (locale: Locale, minimum: number, maximum: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: minimum, maximumFractionDigits: maximum });

/** Cents as an amount: 267301 -> "$2,673.01" (pt-BR "$2.673,01"). `whole` drops the cents when there are none. */
export function money(cents: number, locale: Locale, whole = false): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${whole && abs % 100 === 0 ? decimals(locale, 0, 0).format(abs / 100) : decimals(locale, 2, 2).format(abs / 100)}`;
}

const MARKET_CURRENCY: Readonly<Record<Locale, string>> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

/** Cents in the learner's market currency, cents shown only when there are some: 1250 -> "$12.50" (en-US, es-MX), "R$ 12,50" (pt-BR); 1200 -> "$12". */
export function localMoney(cents: number, locale: Locale): string {
  const places = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: MARKET_CURRENCY[locale], minimumFractionDigits: places, maximumFractionDigits: places }).format(cents / 100);
}

/** Whole basis points as a percent: 2682 -> "26.82%", 700 -> "7%". */
export const percent = (bps: number, locale: Locale): string => `${decimals(locale, 0, 2).format(bps / 100)}%`;

/** A count of tenths as a decimal: 103 -> "10.3". */
export const tenths = (count: number, locale: Locale): string => decimals(locale, 1, 1).format(count / 10);

/** Replaces each `{name}` in a copy string. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));

/** "1 year" / "0 years"; pt-BR counts 0 as singular ("0 ano"). */
export const yearsText = (words: { yearOne: string; yearMany: string }, n: number, locale: Locale): string => fill(pluralUnit(locale, n, { one: words.yearOne, other: words.yearMany }), { n });

const WORDS = {
  'en-US': { dollar: ['dollar', 'dollars'], cent: ['cent', 'cents'], and: 'and', minus: 'minus', percent: 'percent' },
  'es-MX': { dollar: ['dólar', 'dólares'], cent: ['centavo', 'centavos'], and: 'con', minus: 'menos', percent: 'por ciento' },
  'pt-BR': { dollar: ['dólar', 'dólares'], cent: ['centavo', 'centavos'], and: 'e', minus: 'menos', percent: 'por cento' },
} as const;

function speak(cents: number, locale: Locale, major: readonly [string, string]): string {
  const words = WORDS[locale];
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  const part = (count: number, unit: readonly [string, string]) => `${decimals(locale, 0, 0).format(count)} ${count === 1 ? unit[0] : unit[1]}`;
  const text = rest === 0 ? part(whole, major) : whole === 0 ? part(rest, words.cent) : `${part(whole, major)} ${words.and} ${part(rest, words.cent)}`;
  return cents < 0 ? `${words.minus} ${text}` : text;
}

/** The amount as it is read aloud: "7,612 dollars and 26 cents". Used in aria labels, never as visible text. */
export const spokenMoney = (cents: number, locale: Locale): string => speak(cents, locale, WORDS[locale].dollar);

const MARKET_MAJOR = {
  'en-US': ['dollar', 'dollars'], 'es-MX': ['peso', 'pesos'], 'pt-BR': ['real', 'reais'],
} as const satisfies Record<Locale, readonly [string, string]>;

/** `localMoney` as it is read aloud: "12 pesos con 50 centavos", "1 real", "12 dollars and 50 cents". */
export const spokenLocalMoney = (cents: number, locale: Locale): string => speak(cents, locale, MARKET_MAJOR[locale]);

/** The rate as it is read aloud: "26.82 percent". */
export const spokenPercent = (bps: number, locale: Locale): string => `${decimals(locale, 0, 2).format(bps / 100)} ${WORDS[locale].percent}`;

/** Evenly thins a series to at most `limit` points, always keeping the first and the last. */
export function thin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  const out: T[] = [];
  for (let index = 0; index < limit; index += 1) out.push(items[Math.round((index * (items.length - 1)) / (limit - 1))]!);
  return out;
}

export interface ChartBox { width: number; height: number; left: number; right: number; top: number; bottom: number }
export const CHART: ChartBox = { width: 320, height: 180, left: 8, right: 8, top: 10, bottom: 14 };

/** Maps a point of a series onto the chart's plot area; `maxX` and `maxY` span the full axes, `minY` is the axis floor. */
export function plot(box: ChartBox, x: number, y: number, maxX: number, maxY: number, minY = 0): { x: number; y: number } {
  const w = box.width - box.left - box.right;
  const h = box.height - box.top - box.bottom;
  return { x: box.left + (maxX <= 0 ? 0 : (x / maxX) * w), y: box.top + h - (maxY <= minY ? 0 : ((y - minY) / (maxY - minY)) * h) };
}

export const polyline = (points: readonly { x: number; y: number }[]): string => points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
