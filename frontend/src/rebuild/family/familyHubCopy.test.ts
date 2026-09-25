import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/familyHub.json';
import es from '../../i18n/es-MX/familyHub.json';
import pt from '../../i18n/pt-BR/familyHub.json';
import { checkCopy, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.1 copy contract: every Family Hub lifecycle string fits its Copy Budget
 * role (Bible 06) in all three locales, the three files carry identical keys,
 * and the controlled glossary holds (owner log §5): coins, never money; no
 * "withdraw" (no action leaves the simulation); no em dash. The child-facing
 * history is checked against the youngest band; guardian surfaces against
 * the adult band.
 */

const ACTIONS = new Set(['title', 'close', 'retry', 'confirm', 'reject', 'leave', 'keep', 'leaveConfirm', 'submit', 'moveOut', 'deliver', 'open']);
const OPTIONS = new Set(['save', 'spend', 'share', 'add', 'remove', 'toSpend', 'toSave', 'you', 'unnamed', 'byYou', 'byOther', 'kindAdjust', 'kindGoal',
  'earned', 'allowance', 'bonus', 'spent', 'correction', 'fromGoal', 'requested', 'approved', 'denied', 'fulfilled', 'rewardUntitled', 'verified', 'rejected', 'revoked']);
const HEADINGS = new Set(['heading', 'adjustHeading', 'goalsHeading', 'rewardsHeading', 'historyHeading']);
const DATA = new Set(['goalSaved', 'note']);

function roleOf(group: string, key: string): CopyRole {
  if (DATA.has(key)) return 'data';
  if (HEADINGS.has(key) || (group === 'guardianRequests' && key === 'title')) return 'heading';
  if (ACTIONS.has(key)) return 'action';
  if (OPTIONS.has(key) && !(group === 'coGuardians' && ['rejected', 'revoked'].includes(key))) return 'option';
  return 'body';
}

const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;

describe('Family Hub lifecycle copy', () => {
  it('has identical key sets in every locale', () => {
    const keys = (file: typeof en) => Object.entries(file).flatMap(([group, strings]) => Object.keys(strings).map((key) => `${group}.${key}`)).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the Copy Budget in ${locale}`, () => {
      for (const [group, strings] of Object.entries(file)) {
        const ageBand: AgeBand = group === 'walletActivity' ? '6-9' : 'adult';
        for (const [key, text] of Object.entries(strings as Record<string, string>)) {
          const filled = text.replace('{name}', 'Ana').replace('{saved}', '4').replace('{target}', '10').replace('{note}', 'gift');
          expect(checkCopy(filled, roleOf(group, key), { locale: locale as Locale, ageBand, surface: 'app' }), `${group}.${key}`).toEqual([]);
        }
      }
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = Object.values(file).flatMap((strings) => Object.values(strings as Record<string, string>)).join(' \n ');
      expect(all).not.toMatch(/—/);
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|withdraw|retirar dinero|sacar dinheiro|bank account|interest|interés|juros)\b/i);
      // "Tutor" is only ever the verified parent; the AI Mentor never appears in these flows.
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente)\b/i);
    });
  }

  it('names coins in every locale where a quantity is shown', () => {
    expect(en.walletCorrections.goalSaved).toContain('coins');
    expect(es.walletCorrections.goalSaved).toContain('monedas');
    expect(pt.walletCorrections.goalSaved).toContain('moedas');
  });
});
