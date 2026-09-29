import en from '@/i18n/en-US/moneyHabits.json';
import es from '@/i18n/es-MX/moneyHabits.json';
import pt from '@/i18n/pt-BR/moneyHabits.json';
import type { Split } from '@/rebuild/family/moneyHabitsApi';

/** S07.4 copy for the rebuilt money-habit surfaces (D.13-D.16), by the app's resolved locale. */
export function moneyHabitsCopy(locale: string | undefined): typeof en {
  return locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
}

/** The written result of a confirmed split (Bible 02 §9.2, K18): "Done: 5 to Save, 4 to Spend, 1 to Share." */
export function splitResultText(locale: string | undefined, split: Split): string {
  return moneyHabitsCopy(locale).split.result.replace(/\{(save|spend|share)\}/g, (_, bucket: keyof Split) => String(split[bucket]));
}
