import en from '@/i18n/en-US/familyAutonomy.json';
import es from '@/i18n/es-MX/familyAutonomy.json';
import pt from '@/i18n/pt-BR/familyAutonomy.json';
import type { Level } from '@/rebuild/family/familyAutonomyApi';

/** S07.5 copy for the rebuilt ladder and decision surfaces (D.17, D.18), by the app's resolved locale. */
export function familyAutonomyCopy(locale: string | undefined): typeof en {
  return locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
}

export function levelNames(copy: typeof en): Record<Level, string> {
  return { 1: copy.levels.name1, 2: copy.levels.name2, 3: copy.levels.name3 };
}
