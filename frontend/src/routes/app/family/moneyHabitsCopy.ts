import en from '@/i18n/en-US/moneyHabits.json';
import es from '@/i18n/es-MX/moneyHabits.json';
import pt from '@/i18n/pt-BR/moneyHabits.json';

/** S07.4 copy for the rebuilt money-habit surfaces (D.13-D.16), by the app's resolved locale. */
export function moneyHabitsCopy(locale: string | undefined): typeof en {
  return locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
}
