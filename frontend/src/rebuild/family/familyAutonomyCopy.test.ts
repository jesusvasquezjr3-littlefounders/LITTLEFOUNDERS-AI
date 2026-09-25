import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/familyAutonomy.json';
import es from '../../i18n/es-MX/familyAutonomy.json';
import pt from '../../i18n/pt-BR/familyAutonomy.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.5 copy contract (D.17, D.18): every string fits its Copy Budget role
 * (Bible 06) in all three locales, the files carry identical keys, and the
 * controlled glossary holds (owner log §5): coins never money; "Tutor" only
 * for the verified parent (never the Mentor); approve, never accept; no
 * job/trabajo; no em dash; no percentage anywhere a child reads. The child's
 * surfaces are checked against the youngest band (6-9), the Tutor's against
 * adults. Nothing celebrates (OD-7): no exclamation on a level.
 */

const BANDS: Record<string, AgeBand> = {
  levels: '6-9', levelsTutor: 'adult', myLevel: '6-9', notes: '6-9', childCodes: '6-9', choreDone: '6-9', rewardAsk: '6-9',
  notYet: 'adult', queue: 'adult', ladder: 'adult',
};

const ROLE: Record<string, Record<string, CopyRole>> = {
  levels: { name1: 'data', name2: 'data', name3: 'data', label: 'data', unlock1: 'body', unlock2: 'body', unlock3: 'body', preapproved: 'body', always: 'body' },
  levelsTutor: { unlock1: 'body', unlock2: 'body', unlock3: 'body', preapproved: 'body', always: 'body' },
  myLevel: {
    heading: 'heading', approved: 'data', age: 'body', days: 'body', share: 'body', ready: 'body', ask: 'action', why: 'prompt', send: 'action',
    sending: 'action', cancel: 'action', asked: 'body', pending: 'body', top: 'body', stepDown: 'action', stepDownPrompt: 'prompt', confirm: 'action',
    stay: 'action', steppedDown: 'body', byTutor: 'body', byYou: 'body', byStaff: 'body', bySystem: 'body', loading: 'body', failed: 'body', retry: 'action',
  },
  notes: {
    heading: 'heading', empty: 'body', sent_back: 'option', cancelled: 'option', denied: 'option', declined: 'option', questioned: 'option', approved: 'option',
    self_logged: 'option', preapproved: 'option', confirmed: 'option', granted: 'option', revisit: 'body', talk: 'action', talkAsked: 'body', failed: 'body',
    retry: 'action', loading: 'body',
  },
  childCodes: { not_finished: 'option', redo: 'option', not_suitable: 'option', talk_first: 'option', save_more: 'option', later_date: 'option', practice_more: 'option' },
  choreDone: { markDone: 'action', marking: 'action', addNote: 'action', notePrompt: 'prompt', cancel: 'action', counted: 'body', sent: 'body', failed: 'body' },
  rewardAsk: {
    ask: 'action', asking: 'action', why: 'prompt', saved_for_it: 'option', treat: 'option', need_it: 'option', for_someone: 'option', other: 'option',
    note: 'body', send: 'action', cancel: 'action', pickOne: 'body', approved: 'body', asked: 'body', limit: 'body', hold: 'body', failed: 'body',
  },
  notYet: {
    why: 'prompt', not_finished: 'option', redo: 'option', not_suitable: 'option', talk_first: 'option', save_more: 'option', later_date: 'option',
    practice_more: 'option', reason: 'prompt', hint: 'body', tooVague: 'body', pickCode: 'body', revisit: 'body', revisitInvalid: 'body', send: 'action',
    sending: 'action', cancel: 'action',
  },
  queue: {
    heading: 'heading', empty: 'body', chores: 'heading', rewards: 'heading', says: 'data', wants: 'data', saved_for_it: 'option', treat: 'option',
    need_it: 'option', for_someone: 'option', other: 'option', photo: 'data', needsPhoto: 'data', cost: 'data', approve: 'action', sendBack: 'action',
    remove: 'action', deny: 'action', open: 'heading', reviews: 'heading', reviewsBody: 'body', selfLogged: 'data', preapproved: 'data', looksGood: 'action',
    question: 'action', talk: 'heading', talkPattern: 'body', talkChild: 'body', talkTip: 'body', talked: 'action', dismiss: 'action', levels: 'heading',
    levelAsk: 'data', grant: 'action', done: 'body', failed: 'body', loading: 'body', retry: 'action',
  },
  ladder: {
    open: 'action', close: 'action', heading: 'heading', body: 'body', limit: 'body', limitValue: 'data', limitCap: 'body', more: 'action', less: 'action',
    saveLimit: 'action', next: 'heading', age: 'data', approved: 'data', share: 'data', days: 'data', ready: 'body', notReady: 'body', noBirthDate: 'body',
    top: 'body', moveUp: 'action', moveDown: 'action', lowerTo: 'data', history: 'heading', change: 'data', byYou: 'data', byTutor: 'data', byChild: 'data',
    byStaff: 'data', bySystem: 'data', saved: 'body', failed: 'body', loading: 'body', retry: 'action',
  },
};

const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const sample = (text: string) => text.replace(/\{count\}/g, '7').replace(/\{min\}/g, '10').replace(/\{days\}/g, '60').replace(/\{name\}/g, 'Ana')
  .replace(/\{title\}/g, 'Dishes').replace(/\{note\}/g, 'I dried them').replace(/\{reason\}/g, 'Saved for it').replace(/\{level\}/g, 'Small steps')
  .replace(/\{date\}/g, 'October 1').replace(/\{(from|to)\}/g, 'Small steps').replace(/\{max\}/g, '100');

describe('Family autonomy and decision copy (S07.5)', () => {
  it('has identical key sets in every locale, each with a declared role and band', () => {
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
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|dollars?|freeze|congelar|congelamento|frozen|job|trabajo|emprego|accept|aceptar|aceitar)\b/i);
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente|Mentor)\b/i);
      expect(all).not.toMatch(/%|percent|porcentaje|porcentagem/i);
      // No celebration here (OD-7): a new level is not a milestone.
      expect(all).not.toMatch(/!/);
    });

    it(`names coins wherever an amount is shown, in ${locale}`, () => {
      const coin = { 'en-US': 'coins', 'es-MX': 'monedas', 'pt-BR': 'moedas' }[locale as Locale];
      for (const text of [file.queue.cost, file.ladder.limitValue, file.levels.preapproved, file.levels.unlock3, file.levelsTutor.preapproved]) expect(text).toContain(coin);
    });

    it(`keeps the child's first views inside the 6-9 first-view budget in ${locale}`, () => {
      const limit = firstViewLimit({ locale: locale as Locale, ageBand: '6-9', surface: 'app' })!;
      // "My level" labels the section for assistive technology; the level name is the visible heading.
      const level = [sample(file.levels.label), file.levels.unlock2, sample(file.levels.preapproved), sample(file.myLevel.approved), file.myLevel.ask, file.myLevel.stepDown];
      const reward = [file.rewardAsk.why, file.rewardAsk.saved_for_it, file.rewardAsk.treat, file.rewardAsk.need_it, file.rewardAsk.for_someone,
        file.rewardAsk.other, file.rewardAsk.note, file.rewardAsk.send, file.rewardAsk.cancel];
      const note = [file.notes.heading, 'Dishes', file.notes.denied, file.childCodes.save_more, sample(file.notes.revisit), file.notes.talk];
      for (const view of [level, reward, note]) expect(wordCount(view.join(' '))).toBeLessThanOrEqual(limit);
    });
  }
});
