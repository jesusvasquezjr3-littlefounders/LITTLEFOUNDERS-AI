import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/teenWallet.json';
import es from '../../i18n/es-MX/teenWallet.json';
import pt from '../../i18n/pt-BR/teenWallet.json';
import { checkCopy, firstViewLimit, wordCount, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.2 copy contract (D.3): every teen-wallet string fits its Copy Budget
 * role for the 13-17 band (Bible 06) in all three locales, the three files
 * carry identical keys, the first view fits its budget, and the controlled
 * glossary holds (owner log §5): coins never money; save/spend/share in the
 * glossary's words; "Tutor" only for the verified parent; no "withdraw", no
 * "streak freeze", no AI wording, no em dash.
 */

const ACTIONS = new Set(['open', 'retry', 'close', 'submit', 'create', 'confirmMove', 'move', 'archive', 'use', 'invite', 'copy', 'confirm', 'reject',
  'openTasks', 'saving', 'inviting', 'copied']);
const HEADINGS = new Set(['title', 'heading']);
const OPTIONS = new Set(['save', 'spend', 'share', 'allowance', 'gift', 'earned', 'toSpend', 'toSave', 'reached', 'archived', 'noGoal',
  'income', 'reward', 'goalMove', 'task', 'familyReward', 'tutorCorrection', 'tutorGoalMove', 'familyAllowance', 'bonus']);
const DATA = new Set(['total', 'progress', 'price', 'simulation', 'left', 'done', 'note', 'verified', 'rejected', 'revoked', 'pendingOther']);

function roleOf(key: string): CopyRole {
  if (DATA.has(key)) return 'data';
  if (HEADINGS.has(key)) return 'heading';
  if (ACTIONS.has(key)) return 'action';
  if (OPTIONS.has(key)) return 'option';
  return 'body';
}

const fillAll = (text: string) => text.replace('{n}', '12').replace('{saved}', '4').replace('{target}', '10').replace('{goal}', 'Headphones')
  .replace('{name}', 'Ana').replace('{note}', 'gift')
  .replace('{save}', '6').replace('{spend}', '4').replace('{share}', '2');
const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;

describe('teen wallet copy', () => {
  it('has identical key sets in every locale', () => {
    const keys = (file: typeof en) => Object.entries(file).flatMap(([group, strings]) => Object.keys(strings).map((key) => `${group}.${key}`)).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the teen Copy Budget in ${locale}`, () => {
      for (const [group, strings] of Object.entries(file)) {
        for (const [key, text] of Object.entries(strings as Record<string, string>)) {
          expect(checkCopy(fillAll(text), roleOf(key), { locale: locale as Locale, ageBand: '13-17', surface: 'app' }), `${group}.${key}`).toEqual([]);
        }
      }
    });

    it(`keeps the first view (header, balance, section buttons) inside its budget in ${locale}`, () => {
      const firstView = [file.page.title, file.page.sub, file.page.simulation, fillAll(file.page.total), file.page.save, file.page.spend, file.page.share,
        file.income.open, file.goals.open, file.rewards.open, file.history.open, file.parents.open];
      const words = firstView.reduce((sum, text) => sum + wordCount(text), 0);
      expect(words).toBeLessThanOrEqual(firstViewLimit({ locale: locale as Locale, ageBand: '13-17', surface: 'app' })!);
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = Object.values(file).flatMap((strings) => Object.values(strings as Record<string, string>)).join(' \n ');
      expect(all).not.toMatch(/—/);
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|withdraw|retirar|sacar|bank account|interest|interés|juros|invest|invertir|investir|streak|racha|sequência)\b/i);
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente|Mentor|AI|IA)\b/);
      expect(all).not.toMatch(/!/);
    });
  }

  it('names coins and the glossary pockets in every locale', () => {
    expect(en.page.total).toContain('coins');
    expect(es.page.total).toContain('monedas');
    expect(pt.page.total).toContain('moedas');
    expect([en.page.save, en.page.spend, en.page.share]).toEqual(['Save', 'Spend', 'Share']);
    expect([es.page.save, es.page.spend, es.page.share]).toEqual(['Ahorrar', 'Gastar', 'Compartir']);
    expect([pt.page.save, pt.page.spend, pt.page.share]).toEqual(['Poupar', 'Gastar', 'Compartilhar']);
    expect([es.income.allowance, pt.income.allowance]).toEqual(['Domingo', 'Mesada']);
  });

  it('says "Tutor" only for a verified parent (after the teen confirms them)', () => {
    for (const file of Object.values(files)) {
      const withTutor = Object.entries(file).flatMap(([group, strings]) => Object.entries(strings as Record<string, string>)
        .filter(([, text]) => /\bTutor\b/.test(text)).map(([key]) => `${group}.${key}`));
      expect(withTutor.sort()).toEqual(['history.note', 'history.tutorCorrection', 'history.tutorGoalMove', 'parents.confirmed', 'parents.verified'].sort());
    }
  });
});
