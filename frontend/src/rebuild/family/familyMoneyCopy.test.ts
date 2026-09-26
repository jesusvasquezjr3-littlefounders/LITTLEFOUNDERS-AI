import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/familyMoney.json';
import es from '../../i18n/es-MX/familyMoney.json';
import pt from '../../i18n/pt-BR/familyMoney.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.3 copy contract (D.2, D.10, D.11): every string fits its Copy Budget
 * role (Bible 06) in all three locales, the files carry identical keys, and
 * the controlled glossary holds (owner log §5): coins never money; "rest
 * day", never "streak freeze"; no job/trabajo; no em dash. The child's
 * streak and the under-13 bonus are checked against the youngest band, the
 * teen bonus against 13-17, and the Tutor's surfaces against adults. The only
 * place "interest" may appear is the honest disclaimer that this is NOT a
 * bank interest rate (D.20).
 */

const BANDS: Record<string, AgeBand> = {
  choreComposer: 'adult', choreKind: '6-9', choreStreak: '6-9', streakPauses: 'adult', bonusSettings: 'adult', bonusYoung: '6-9', bonusTeen: '13-17',
};
const ACTIONS = new Set(['open', 'close', 'submit', 'cancel', 'retry', 'save', 'end', 'check']);
const HEADINGS = new Set(['heading', 'heading2', 'milestone', 'resting']);
const OPTIONS: Record<string, Set<string>> = {
  choreComposer: new Set(['contribution', 'bonus', 'none', 'weekly', 'photo']),
  choreKind: new Set(['contribution', 'bonus', 'noCoins', 'coins', 'oneCoin']),
  bonusSettings: new Set(['on', 'off']),
};
const DATA = new Set(['added', 'days', 'oneDay', 'best', 'restLeft', 'paused', 'total', 'current', 'restingBest', 'running', 'upcoming', 'example', 'mine', 'correct']);
const PROMPTS = new Set(['question']);

function roleOf(group: string, key: string): CopyRole {
  if (group === 'bonusYoung' && key === 'mine') return 'body';
  if (DATA.has(key)) return 'data';
  if (PROMPTS.has(key)) return 'prompt';
  if (HEADINGS.has(key)) return 'heading';
  if (ACTIONS.has(key)) return 'action';
  if (OPTIONS[group]?.has(key)) return 'option';
  return 'body';
}

const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const sample = (text: string) => text.replace(/\{name\}/g, 'Ana').replace(/\{title\}/g, 'Dishes').replace(/\{rate\}/g, '15').replace(/\{saved\}/g, '57')
  .replace(/\{bonus\}/g, '8').replace(/\{count\}/g, '7').replace(/\{date\}/g, 'Sep 30').replace(/\{start\}/g, 'Sep 1').replace(/\{end\}/g, 'Sep 5');

describe('Family Hub money copy (S07.3)', () => {
  it('has identical key sets in every locale', () => {
    const keys = (file: typeof en) => Object.entries(file).flatMap(([group, strings]) => Object.keys(strings).map((key) => `${group}.${key}`)).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
    expect(Object.keys(en).sort()).toEqual(Object.keys(BANDS).sort());
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the Copy Budget in ${locale}`, () => {
      for (const [group, strings] of Object.entries(file)) {
        for (const [key, text] of Object.entries(strings as Record<string, string>)) {
          expect(checkCopy(sample(text), roleOf(group, key), { locale: locale as Locale, ageBand: BANDS[group]!, surface: 'app' }), `${group}.${key}`).toEqual([]);
        }
      }
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = Object.entries(file).flatMap(([, strings]) => Object.entries(strings as Record<string, string>)
        .filter(([key]) => key !== 'notInterest').map(([, text]) => text)).join(' \n ');
      expect(all).not.toMatch(/—/);
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|withdraw|interest|interés|juros|freeze|congelar|congelamento|job|trabajo|emprego|invest|invertir|investir)\b/i);
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente)\b/i);
      // Streak copy never frames a lapse as a loss (Bible 02 §9.6 rule 4).
      expect(all).not.toMatch(/\b(lost|lose|broke your|perdiste|perdeu|perder)\b/i);
    });

    it(`says the bonus is not interest, honestly, in ${locale}`, () => {
      expect(file.bonusSettings.notInterest).toMatch(/interest|interés|juros/i);
      expect(file.bonusTeen.notInterest).toBe(file.bonusSettings.notInterest);
    });

    it(`never shows a percentage in the under-13 bonus in ${locale}`, () => {
      expect(Object.values(file.bonusYoung).join(' ')).not.toMatch(/%|\{rate\}/);
      expect(file.bonusYoung.rule).toMatch(/10/);
    });

    it(`keeps the child's first views inside the 6-9 first-view budget in ${locale}`, () => {
      const limit = firstViewLimit({ locale: locale as Locale, ageBand: '6-9', surface: 'app' })!;
      const young = [file.bonusYoung.heading, file.bonusYoung.rule, sample(file.bonusYoung.mine), sample(file.bonusYoung.next)];
      const streak = [file.choreStreak.heading, sample(file.choreStreak.days), file.choreStreak.alive, sample(file.choreStreak.best), sample(file.choreStreak.restLeft), sample(file.choreStreak.total)];
      for (const view of [young, streak]) expect(wordCount(view.join(' '))).toBeLessThanOrEqual(limit);
    });
  }

  it('names coins in every locale where the kind line shows a quantity', () => {
    expect(en.choreKind.coins).toContain('coins');
    expect(es.choreKind.coins).toContain('monedas');
    expect(pt.choreKind.coins).toContain('moedas');
  });
});
