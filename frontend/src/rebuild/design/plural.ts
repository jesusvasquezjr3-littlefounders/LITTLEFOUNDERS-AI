import type { Locale } from './copyBudget';

/*
 * Plurals from the locale's own rules (Appendix P Part 5: pt-BR puts 0 in the
 * "one" category, and plurals follow ICU/CLDR categories, never string
 * concatenation on `n === 1`; Bible 05 §5: numbers, currencies and plurals
 * come from Intl with the full locale). A form keyed by CLDR category is
 * chosen with Intl.PluralRules; a category the copy does not carry (es-MX and
 * pt-BR "many" for millions) falls back to "other".
 */

export type PluralForms = { one: string; other: string } & Partial<Record<'zero' | 'two' | 'few' | 'many', string>>;

const rules = new Map<string, Intl.PluralRules>();
function rulesFor(locale: Locale): Intl.PluralRules {
  let found = rules.get(locale);
  if (!found) {
    found = new Intl.PluralRules(locale);
    rules.set(locale, found);
  }
  return found;
}

/** The unit word for `n` in this locale (the number itself is formatted by the caller). */
export function pluralUnit(locale: Locale, n: number, forms: PluralForms): string {
  const category = rulesFor(locale).select(n);
  return (forms as Record<string, string | undefined>)[category] ?? forms.other;
}

/** `n` formatted for the locale, then its unit word: "0 moeda" (pt-BR), "0 coins" (en-US). */
export function pluralAmount(locale: Locale, n: number, forms: PluralForms, format: Intl.NumberFormat = new Intl.NumberFormat(locale)): string {
  return `${format.format(n)} ${pluralUnit(locale, n, forms)}`;
}
