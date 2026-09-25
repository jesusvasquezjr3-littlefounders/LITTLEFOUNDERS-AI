import en from '@/i18n/en-US/coinAccount.json';
import es from '@/i18n/es-MX/coinAccount.json';
import pt from '@/i18n/pt-BR/coinAccount.json';
import regEn from '@/i18n/en-US/moneyRegister.json';
import regEs from '@/i18n/es-MX/moneyRegister.json';
import regPt from '@/i18n/pt-BR/moneyRegister.json';
import type { CoinAccountCopy } from '@/rebuild/banking/CoinAccount';
import type { TutorFreezeCopy } from '@/rebuild/banking/TutorFreeze';
import type { MoneyRegister } from '@/rebuild/family/moneyRegister';
import { moneyHabitsCopy } from './moneyHabitsCopy';

/** S07.6 (D.7, D.12) copy for the rebuilt coin account, by the app's resolved locale and the reader's register. */
export function coinAccountCopy(locale: string | undefined, register: MoneyRegister): CoinAccountCopy {
  const all = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  return all[register];
}

export function tutorFreezeCopy(locale: string | undefined): TutorFreezeCopy {
  return (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).tutor;
}

export function moneyRegisterCopy(locale: string | undefined): typeof regEn {
  return locale === 'es-MX' ? regEs : locale === 'pt-BR' ? regPt : regEn;
}

/**
 * The S07.4 money-habit copy in a reader's register (D.12): the usual-split
 * count line and the goal-progress line change with age; every other string
 * is the same at every age.
 */
export function moneyHabitsInRegister(locale: string | undefined, register: MoneyRegister) {
  const base = moneyHabitsCopy(locale);
  const overlay = moneyRegisterCopy(locale);
  return {
    ...base,
    usualSplit: { ...base.usualSplit, ...overlay.usualSplit[register] },
    goalProgress: { ...base.goalProgress, ...overlay.goalProgress[register] },
  };
}

/** The transition register's bridge line for the per-ten bonus; no other register has one. */
export function bonusScaffold(locale: string | undefined, register: MoneyRegister): string | null {
  return register === 'transition' ? moneyRegisterCopy(locale).bonus.transition.scaffold : null;
}
