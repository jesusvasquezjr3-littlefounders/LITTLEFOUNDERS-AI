import type { Locale } from '../../../design/copyBudget';
import { pluralUnit } from '../../../design/plural';
import { copyText } from '../copyText';
import { PITCH_NAMES, type SolidView } from '../solids/projection.generated';
import type { ArObjectId } from './ar.generated';
import { SPACE2_COPY } from './copy';
import { ratDecimal, type DecimalMark, type Rat, type SpokenWords } from './field.generated';
import type { PlaceId } from './globe.generated';
import { xAxis, yAxis, type SurfaceSpec } from './surface.generated';

export type SpaceText = { readonly [K in keyof typeof SPACE2_COPY]: string };

export const spaceText = (locale: Locale): SpaceText => copyText(SPACE2_COPY, locale);

/** Fills named slots such as `{x}` or `{n}`; an unknown slot stays as written. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (slot, key: string) => (key in values ? String(values[key]) : slot));

const CURRENCY: Readonly<Record<Locale, string>> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

/** Whole cents as money in the learner's own currency; the cents show only when there are some. */
export function money(cents: number, locale: Locale): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY[locale], minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export const count = (value: number, locale: Locale): string => new Intl.NumberFormat(locale).format(value);

/** Basis points as a percent: 450 is 4.5%. */
export const percent = (bps: number, locale: Locale): string => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(bps / 10000);

export const yearsText = (t: SpaceText, n: number, locale: Locale): string => fill(pluralUnit(locale, n, { one: t.yearOne, other: t.yearMany }), { n });
export const unitsText = (t: SpaceText, n: number, locale: Locale): string => fill(pluralUnit(locale, n, { one: t.unitOne, other: t.unitMany }), { n: count(n, locale) });

/** What the input on each axis of a surface is called. */
export const axisName = (t: SpaceText, spec: SurfaceSpec, axis: 'x' | 'y'): string =>
  spec.kind === 'compound' ? (axis === 'x' ? t.axisRate : t.axisTerm) : (axis === 'x' ? t.axisPrice : t.axisUnits);

/** The held-still wording of an axis: "Hold the rate". */
export const holdName = (t: SpaceText, spec: SurfaceSpec, axis: 'x' | 'y'): string =>
  spec.kind === 'compound' ? (axis === 'x' ? t.holdRate : t.holdTerm) : (axis === 'x' ? t.holdPrice : t.holdUnits);

export const outputName = (t: SpaceText, spec: SurfaceSpec): string => (spec.kind === 'compound' ? t.outAmount : t.outProfit);

/** One input value on an axis, written the way the learner reads it: 4%, 10 years, $3, 100 units. */
export function axisValue(t: SpaceText, spec: SurfaceSpec, axis: 'x' | 'y', index: number, locale: Locale): string {
  const value = (axis === 'x' ? xAxis(spec) : yAxis(spec))[index]!;
  if (spec.kind === 'compound') return axis === 'x' ? percent(value, locale) : yearsText(t, value, locale);
  return axis === 'x' ? money(value, locale) : unitsText(t, value, locale);
}

const PLACE_KEYS = {
  'mexico-city': 'placeMexicoCity', 'los-angeles': 'placeLosAngeles', houston: 'placeHouston', 'new-york': 'placeNewYork', bogota: 'placeBogota',
  'sao-paulo': 'placeSaoPaulo', lisbon: 'placeLisbon', madrid: 'placeMadrid', lagos: 'placeLagos', nairobi: 'placeNairobi', johannesburg: 'placeJohannesburg',
  dubai: 'placeDubai', mumbai: 'placeMumbai', manila: 'placeManila', tokyo: 'placeTokyo', sydney: 'placeSydney',
} as const satisfies Record<PlaceId, keyof typeof SPACE2_COPY>;
export const placeLabel = (t: SpaceText, place: PlaceId): string => t[PLACE_KEYS[place]];

const OBJECT_KEYS = { 'litre-box': 'objectLitreBox', 'cereal-box': 'objectCerealBox', 'soup-can': 'objectSoupCan', shoebox: 'objectShoebox' } as const satisfies Record<ArObjectId, keyof typeof SPACE2_COPY>;
export const objectLabel = (t: SpaceText, object: ArObjectId): string => t[OBJECT_KEYS[object]];

const PITCH_KEYS = { level: 'viewLevel', corner: 'viewCorner', top: 'viewTop' } as const;
export const viewLabel = (t: SpaceText, view: SolidView): string => t[PITCH_KEYS[PITCH_NAMES[view.pitch]]];

/** "Corner view. Turn 2 of 4": what a screen reader hears after every move. */
export const viewState = (t: SpaceText, view: SolidView): string => `${viewLabel(t, view)}. ${fill(t.viewTurn, { n: view.yaw + 1 })}`;

/** A latitude or longitude in whole degrees with its compass letter: 19° N, 99° W. */
export function degrees(t: SpaceText, value: number, axis: 'lat' | 'lon'): string {
  const letter = axis === 'lat' ? (value >= 0 ? t.dirNorth : t.dirSouth) : (value >= 0 ? t.dirEast : t.dirWest);
  return `${Math.abs(Math.round(value))}° ${letter}`;
}

/** The decimal mark the notation and the spoken reading use: pt-BR writes the comma, the other two locales the point. */
export const formulaMark = (locale: Locale): DecimalMark => (locale === 'pt-BR' ? ',' : '.');

/** The words a formula is read aloud with, in the learner's language. */
export const formulaWords = (t: SpaceText): SpokenWords => ({
  plus: t.spokenPlus, minus: t.spokenMinus, times: t.spokenTimes, over: t.spokenOver, power: t.spokenPower,
  open: t.spokenOpen, close: t.spokenClose, negative: t.spokenNegative,
});

/** An exact value as the learner reads it: up to 3 decimals in the locale's own mark, with a leading "≈" when it was rounded. */
export function ratShow(value: Rat, locale: Locale): string {
  const { text, exact } = ratDecimal(value, 3);
  const shown = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Number(text));
  return exact ? shown : `≈ ${shown}`;
}
