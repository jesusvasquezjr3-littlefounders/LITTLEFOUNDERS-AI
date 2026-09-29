import type { Locale } from '../design/copyBudget';

/*
 * Bible 05 §6 (GAP-FIX-R5): a movable point on a fraction line is a slider
 * whose aria-valuetext names the fraction in the learner's language ("three
 * quarters", "tres cuartos", "três quartos"), not "3/4". The fraction is read
 * as written on the line (2/4 is "two quarters", never reduced), with a whole
 * part first when it reaches past one ("one and one quarter"). Denominators
 * run 1-12 and numerators up to two wholes, the M3 line's range.
 */

const CARDINALS: Record<Locale, readonly string[]> = {
  'en-US': ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  'es-MX': ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'],
  'pt-BR': ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'],
};
/** [singular, plural] unit names for denominators 2-12. */
const PARTS: Record<Locale, Record<number, readonly [string, string]>> = {
  'en-US': { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'],
    8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'], 11: ['eleventh', 'elevenths'], 12: ['twelfth', 'twelfths'] },
  'es-MX': { 2: ['medio', 'medios'], 3: ['tercio', 'tercios'], 4: ['cuarto', 'cuartos'], 5: ['quinto', 'quintos'], 6: ['sexto', 'sextos'], 7: ['séptimo', 'séptimos'],
    8: ['octavo', 'octavos'], 9: ['noveno', 'novenos'], 10: ['décimo', 'décimos'], 11: ['onceavo', 'onceavos'], 12: ['doceavo', 'doceavos'] },
  'pt-BR': { 2: ['meio', 'meios'], 3: ['terço', 'terços'], 4: ['quarto', 'quartos'], 5: ['quinto', 'quintos'], 6: ['sexto', 'sextos'], 7: ['sétimo', 'sétimos'],
    8: ['oitavo', 'oitavos'], 9: ['nono', 'nonos'], 10: ['décimo', 'décimos'], 11: ['onze avos', 'onze avos'], 12: ['doze avos', 'doze avos'] },
};
const AND: Record<Locale, string> = { 'en-US': 'and', 'es-MX': 'y', 'pt-BR': 'e' };
/** The whole number alone ("uno", not the apocopated "un" used before a noun). */
const WHOLE_ONE: Record<Locale, string> = { 'en-US': 'one', 'es-MX': 'uno', 'pt-BR': 'um' };

function cardinal(value: number, locale: Locale, alone: boolean): string {
  if (value === 1 && alone) return WHOLE_ONE[locale];
  return CARDINALS[locale][value] ?? String(value);
}

function properName(numerator: number, denominator: number, locale: Locale): string {
  const part = PARTS[locale][denominator];
  if (!part) return `${numerator}/${denominator}`;
  return `${cardinal(numerator, locale, false)} ${numerator === 1 ? part[0] : part[1]}`;
}

/** The spoken name of numerator/denominator in the locale; the plain fraction when it is outside the line's range. */
export function fractionName(numerator: number, denominator: number, locale: Locale): string {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 1 || denominator > 12 || numerator > 2 * denominator) {
    return `${numerator}/${denominator}`;
  }
  if (numerator === 0) return CARDINALS[locale][0]!;
  const wholes = Math.floor(numerator / denominator);
  const rest = numerator % denominator;
  if (denominator === 1 || rest === 0) return cardinal(wholes, locale, true);
  if (wholes === 0) return properName(rest, denominator, locale);
  return `${cardinal(wholes, locale, true)} ${AND[locale]} ${properName(rest, denominator, locale)}`;
}

/** A number a fraction line shows, written for the locale: a fraction as written, a decimal with the locale's separator. */
export function formatLineNumber(text: string, locale: Locale): string {
  if (text.includes('/')) return text;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Number(text));
}
