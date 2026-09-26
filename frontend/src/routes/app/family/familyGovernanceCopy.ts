import en from '@/i18n/en-US/familyGovernance.json';
import es from '@/i18n/es-MX/familyGovernance.json';
import pt from '@/i18n/pt-BR/familyGovernance.json';

/** S07.7 copy for the rebuilt coaching, scope, data, research and bridge surfaces (D.19-D.23), by the app's resolved locale. */
export function familyGovernanceCopy(locale: string | undefined): typeof en {
  return locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
}
