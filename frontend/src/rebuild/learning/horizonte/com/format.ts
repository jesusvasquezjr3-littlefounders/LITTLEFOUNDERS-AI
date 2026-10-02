import type { Locale } from '../../../design/copyBudget';
import type { COM_COPY } from './copy';

/** Every authored string of the pack, resolved to one locale. */
export type Words = { readonly [K in keyof typeof COM_COPY]: string };

/** A copy string whose key is built at run time, such as a slot, a gate or an option name. */
export const word = (t: Words, key: string): string => (t as Readonly<Record<string, string>>)[key] ?? key;

/** A number in the learner's own notation (a decimal comma in es-MX and pt-BR), never negative zero. */
export const fmt = (locale: Locale, value: number, digits = 2): string => {
  const rounded = Number(value.toFixed(digits));
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(rounded === 0 ? 0 : rounded);
};

/** Fills the named `{slots}` of an authored string. Slots with no value stay as written, so a missing one is visible. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

/** A list on one line; the word for an empty list comes from the copy. */
export const list = (items: readonly string[], none: string): string => (items.length > 0 ? items.join(', ') : none);
