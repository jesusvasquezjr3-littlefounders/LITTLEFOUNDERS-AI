import en from '@/i18n/en-US/familyMoney.json';
import es from '@/i18n/es-MX/familyMoney.json';
import pt from '@/i18n/pt-BR/familyMoney.json';

/** S07.3 copy for the rebuilt Family Hub money surfaces, by the app's resolved locale. */
export function familyMoneyCopy(locale: string | undefined): typeof en {
  return locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
}

/** The chore's kind and coins as one short line for the child's and the Tutor's task lists (D.10). */
export function choreKindLine(locale: string | undefined, kind: 'contribution' | 'bonus' | undefined, coins: number): string {
  const copy = familyMoneyCopy(locale).choreKind;
  const amount = coins === 0 ? copy.noCoins : coins === 1 ? copy.oneCoin : copy.coins.replace('{count}', String(coins));
  return `${kind === 'contribution' ? copy.contribution : copy.bonus} · ${amount}`;
}
