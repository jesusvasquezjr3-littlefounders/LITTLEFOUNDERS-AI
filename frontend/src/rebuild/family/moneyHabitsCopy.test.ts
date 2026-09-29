import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/moneyHabits.json';
import es from '../../i18n/es-MX/moneyHabits.json';
import pt from '../../i18n/pt-BR/moneyHabits.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.4 copy contract (D.13-D.16): every string fits its Copy Budget role
 * (Bible 06) in all three locales, the files carry identical keys, and the
 * controlled glossary holds (owner log §5): coins never money; "Tutor" only
 * for the verified parent (never the Mentor); no job/trabajo; no em dash; no
 * percentage anywhere a child reads (D.11: the usual split is "out of 10").
 * The honesty lines (D.7) say coins stay in the app. The child's surfaces are
 * checked against the youngest band, the teen's own-place lines against
 * 13-17, and the Tutor's against adults.
 */

const BANDS: Record<string, AgeBand> = {
  split: '6-9', usualSplit: '6-9', goalProgress: '6-9', goalProgressTutor: 'adult', nextGoal: '6-9', goals: '6-9',
  share: '6-9', shareTeen: '13-17', destinations: 'adult',
};

const ROLE: Record<string, Record<string, CopyRole>> = {
  split: {
    heading: 'heading', usual: 'body', use: 'action', change: 'action', save: 'option', spend: 'option', share: 'option', more: 'action', less: 'action',
    left: 'data', placed: 'data', toGoal: 'body', noGoal: 'option', submit: 'action', saving: 'action', cancel: 'action', mismatch: 'body',
    result: 'body', frozen: 'body', failed: 'body', loading: 'body', retry: 'action', ready: 'data', splitNow: 'action',
  },
  usualSplit: {
    open: 'action', close: 'action', heading: 'heading', body: 'body', tenths: 'data', suggested: 'action', submit: 'action', saving: 'action',
    saved: 'body', mustBe10: 'body', failed: 'body', loading: 'body', retry: 'action',
  },
  goalProgress: { of: 'data', own: 'data', bonus: 'data', family: 'data', allOwn: 'data', label: 'data' },
  goalProgressTutor: { of: 'data', own: 'data', bonus: 'data', family: 'data', allOwn: 'data', label: 'data' },
  nextGoal: {
    milestone: 'heading', reached: 'heading', prompt: 'prompt', name: 'body', target: 'body', start: 'action', starting: 'action', notNow: 'action',
    started: 'body', later: 'body', invalid: 'body', failed: 'body',
  },
  goals: {
    heading: 'heading', empty: 'body', name: 'body', target: 'body', create: 'action', creating: 'action', created: 'body', invalid: 'body',
    archive: 'action', archiveConfirm: 'body', keep: 'action', archived: 'body', reached: 'option', loading: 'body', failed: 'body', retry: 'action',
  },
  share: {
    heading: 'heading', body: 'body', honest: 'body', available: 'data', where: 'body', amount: 'body', give: 'action', giving: 'action', pledged: 'body',
    empty: 'body', historyHeading: 'heading', waiting: 'option', given: 'option', returned: 'option', note: 'data', takeBack: 'action', takenBack: 'body',
    notEnough: 'body', invalid: 'body', loading: 'body', failed: 'body', retry: 'action', charity: 'option', gift: 'option', community: 'option', frozen: 'body', coins: 'data',
  },
  shareTeen: {
    body: 'body', honest: 'body', empty: 'body', addHeading: 'heading', placeName: 'body', kind: 'body', add: 'action', added: 'body', limit: 'body',
    remove: 'action', removed: 'body', markGiven: 'action', whatHappened: 'prompt', saveGiven: 'action', givenNotice: 'body', noteRequired: 'body',
    invalidPlace: 'body',
  },
  destinations: {
    open: 'action', close: 'action', heading: 'heading', body: 'body', honest: 'body', placeName: 'body', kind: 'body', add: 'action', added: 'body',
    limit: 'body', remove: 'action', removed: 'body', empty: 'body', waitingHeading: 'heading', waiting: 'data', noneWaiting: 'body', markGiven: 'action',
    whatHappened: 'prompt', giveBack: 'action', whyBack: 'prompt', confirm: 'action', cancel: 'action', noteRequired: 'body', givenNotice: 'body',
    returnedNotice: 'body', doneLine: 'data', returnedLine: 'data', invalid: 'body', loading: 'body', failed: 'body', retry: 'action', charity: 'option',
    gift: 'option', community: 'option', usualSplit: 'data',
  },
};

const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const sample = (text: string) => text.replace(/\{count\}/g, '7').replace(/\{title\}/g, 'Bike').replace(/\{name\}/g, 'Ana').replace(/\{pocket\}/g, 'Save')
  .replace(/\{saved\}/g, '20').replace(/\{target\}/g, '50').replace(/\{place\}/g, 'Food bank').replace(/\{note\}/g, 'We went').replace(/\{(save|spend|share)\}/g, '5');

describe('Money-habit copy (S07.4)', () => {
  it('has identical key sets in every locale, each with a declared role', () => {
    const keys = (file: typeof en) => Object.entries(file).flatMap(([group, strings]) => Object.keys(strings).map((key) => `${group}.${key}`)).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
    expect(keys(en)).toEqual(Object.entries(ROLE).flatMap(([group, roles]) => Object.keys(roles).map((key) => `${group}.${key}`)).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(BANDS).sort());
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the Copy Budget in ${locale}`, () => {
      for (const [group, strings] of Object.entries(file)) {
        for (const [key, text] of Object.entries(strings as Record<string, string>)) {
          expect(checkCopy(sample(text), ROLE[group]![key]!, { locale: locale as Locale, ageBand: BANDS[group]!, surface: 'app' }), `${group}.${key}`).toEqual([]);
        }
      }
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = Object.values(file).flatMap((strings) => Object.values(strings as Record<string, string>)).join(' \n ');
      expect(all).not.toMatch(/—/);
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|dollars?|withdraw|interest|interés|juros|freeze|congelar|congelamento|job|trabajo|emprego|invest|invertir|investir|donate|donar|doar)\b/i);
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente|Mentor)\b/i);
      // A child and a teen never read a percentage (D.11); the usual split is "out of 10".
      expect(all).not.toMatch(/%|percent|porcentaje|porcentagem/i);
    });

    it(`never promises that coins leave the app, in ${locale} (D.7)`, () => {
      expect(file.share.honest).toMatch(/app/);
      expect(file.shareTeen.honest).toMatch(/app/);
      expect(file.destinations.honest).toMatch(/never|nunca/i);
    });

    it(`keeps the teen's own-place copy free of "Tutor" (an unlinked teen has none) in ${locale}`, () => {
      expect(Object.values(file.shareTeen).join(' ')).not.toMatch(/Tutor/);
    });

    it(`keeps the child's first views inside the 6-9 first-view budget in ${locale}`, () => {
      const limit = firstViewLimit({ locale: locale as Locale, ageBand: '6-9', surface: 'app' })!;
      const split = [sample(file.split.heading), file.split.usual, file.split.save, '5', file.split.spend, '4', file.split.share, '1', file.split.use, file.split.change];
      const share = [file.share.heading, file.share.body, file.share.honest, sample(file.share.available), file.share.where, file.share.amount, file.share.give];
      const next = [sample(file.nextGoal.milestone), file.nextGoal.prompt, file.nextGoal.name, file.nextGoal.target, file.nextGoal.start, file.nextGoal.notNow];
      for (const view of [split, share, next]) expect(wordCount(view.join(' '))).toBeLessThanOrEqual(limit);
    });
  }

  it('names coins in every locale where a quantity is shown', () => {
    expect(en.share.available).toContain('coins');
    expect(es.share.available).toContain('monedas');
    expect(pt.share.available).toContain('moedas');
  });
});
