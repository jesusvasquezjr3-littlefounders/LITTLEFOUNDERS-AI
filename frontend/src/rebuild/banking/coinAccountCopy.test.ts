import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/coinAccount.json';
import es from '../../i18n/es-MX/coinAccount.json';
import pt from '../../i18n/pt-BR/coinAccount.json';
import regEn from '../../i18n/en-US/moneyRegister.json';
import regEs from '../../i18n/es-MX/moneyRegister.json';
import regPt from '../../i18n/pt-BR/moneyRegister.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * S07.6 copy contract (D.7, D.8, D.12).
 * - D.12: each register's strings fit the Copy Budget of that register's band
 *   (young 6-9, transition 10-12, teen 13-17; the Tutor's card is adult), and
 *   the registers really differ: numbers (no percentage below the teen
 *   register), tone and detail. Every register carries the same honesty lines.
 * - D.7: the card is always a practice card whose coins stay in the app; the
 *   limit says when it is checked; the freeze says nothing is lost. No string
 *   promises safety, protection, a guarantee, a real bank or a real card.
 * - Glossary (owner log §5): coins, never money; "Tutor" only for the parent;
 *   approve, never accept. "Freeze" is the name of the card control (D.1),
 *   never a streak freeze.
 */

type Group = 'young' | 'transition' | 'teen' | 'tutor';
const BAND: Record<Group, AgeBand> = { young: '6-9', transition: '10-12', teen: '13-17', tutor: 'adult' };
const ROLE: Record<string, CopyRole> = {
  heading: 'heading', practice: 'body', coinsOnly: 'body', frozen: 'body', notFrozen: 'body', byYou: 'body', byTutor: 'body', byChild: 'body',
  whileFrozen: 'body', whatHolds: 'action', holdRewards: 'body', holdSplits: 'body', holdCredits: 'body', holdShare: 'body', nothingLost: 'body', noCoinsMoved: 'body',
  freeze: 'action', unfreeze: 'action', onlyTutor: 'body', pockets: 'heading', save: 'body', spend: 'body', share: 'body', coins: 'data',
  pocketDetail: 'data', limitHeading: 'heading', limitWeekly: 'body', limitMonthly: 'body', limitWhy: 'body', limitWhen: 'body', monthHeading: 'heading',
  earned: 'body', spent: 'body', saved: 'body', given: 'body', adjusted: 'body', waiting: 'body', waitingFrozen: 'body', noAccount: 'body',
  loading: 'body', failed: 'body', retry: 'action', frozenNotice: 'body', unfrozenNotice: 'body', changeFailed: 'body', lineTask: 'body',
  lineReward: 'body', lineAllowance: 'body', lineBonus: 'body', lineShared: 'body', lineReturned: 'body', lineFixed: 'body', lineGoal: 'body',
  lineOther: 'body', confirmFreeze: 'prompt', confirm: 'action', cancel: 'action', view: 'body', bandYoung: 'data', bandTransition: 'data', bandTeen: 'data',
};
const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const overlays = { 'en-US': regEn, 'es-MX': regEs, 'pt-BR': regPt } as const;
const sample = (text: string) => text.replace(/\{count\}/g, '7').replace(/\{total\}/g, '40').replace(/\{pct\}/g, '35').replace(/\{name\}/g, 'Ana')
  .replace(/\{band\}/g, 'ages 10-12').replace(/\{(remaining|used|cap|left|saved|target)\}/g, '12');
const strings = (file: typeof en, group: Group) => Object.entries(file[group] as Record<string, string>);

describe('Coin account copy (S07.6)', () => {
  it('has identical key sets in every locale, each key with a declared role', () => {
    const keys = (file: typeof en) => (['young', 'transition', 'teen', 'tutor'] as Group[]).flatMap((g) => Object.keys(file[g]).map((k) => `${g}.${k}`)).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
    for (const key of keys(en)) expect(ROLE[key.split('.')[1]!], key).toBeDefined();
    const overlayKeys = (file: typeof regEn) => JSON.stringify(Object.entries(file).map(([k, v]) => [k, Object.entries(v).map(([r, s]) => [r, Object.keys(s)])]));
    expect(overlayKeys(regEs)).toBe(overlayKeys(regEn));
    expect(overlayKeys(regPt)).toBe(overlayKeys(regEn));
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits each register's Copy Budget band in ${locale}`, () => {
      for (const group of ['young', 'transition', 'teen', 'tutor'] as Group[]) {
        for (const [key, text] of strings(file, group)) {
          expect(checkCopy(sample(text), ROLE[key]!, { locale: locale as Locale, ageBand: BAND[group], surface: 'app' }), `${group}.${key}`).toEqual([]);
        }
      }
      const reg = overlays[locale as keyof typeof overlays];
      const band = { young: '6-9', transition: '10-12', teen: '13-17' } as const;
      for (const [register, set] of Object.entries(reg.usualSplit)) {
        expect(checkCopy(sample(set.body), 'body', { locale: locale as Locale, ageBand: band[register as keyof typeof band], surface: 'app' })).toEqual([]);
      }
      expect(checkCopy(reg.bonus.transition.scaffold, 'body', { locale: locale as Locale, ageBand: '10-12', surface: 'app' })).toEqual([]);
    });

    it(`frames numbers by register in ${locale} (D.12)`, () => {
      const reg = overlays[locale as keyof typeof overlays];
      for (const group of ['young', 'transition'] as const) {
        const all = [...strings(file, group).map(([, t]) => t), ...Object.values(reg.usualSplit[group]), reg.goalProgress[group].of].join(' ');
        expect(all, group).not.toMatch(/%|\{pct\}%|percent|porcentaje|porcentagem/i);
      }
      expect(reg.usualSplit.young.tenths).not.toContain('{pct}');
      expect(reg.usualSplit.transition.scale).toMatch(/\{pct\}.*100/);
      expect('scale' in reg.usualSplit.young).toBe(false);
      expect(reg.usualSplit.teen.tenths).toBe('{pct}%');
      expect(reg.goalProgress.teen.of).toContain('{pct}%');
      expect(reg.goalProgress.transition.of).toContain('{left}');
      expect(file.teen.limitWeekly).toContain('{pct}%');
      expect(file.transition.limitWeekly).toContain('{cap}');
      expect(file.young.limitWeekly).not.toMatch(/\{cap\}|\{used\}/);
      expect('pocketDetail' in file.young).toBe(false);
    });

    it(`gives each register its own tone in ${locale} (D.12)`, () => {
      const differs = (key: keyof typeof en.young) => new Set([file.young[key], file.transition[key], file.teen[key]]).size;
      expect(differs('coinsOnly')).toBe(3);
      expect(differs('limitWeekly')).toBe(3);
      expect(file.transition.limitWeekly).toMatch(/7/);
      expect(file.transition.limitMonthly).toMatch(/30/);
      expect(differs('limitWhy')).toBe(3);
      expect(differs('nothingLost')).toBe(3);
      expect(differs('holdSplits')).toBe(3);
    });

    it(`states only what the system enforces in ${locale} (D.7)`, () => {
      for (const group of ['young', 'transition', 'teen'] as const) {
        expect(file[group].coinsOnly, group).toMatch(/app/);
        // The limit is enforced when a reward is asked for (the redemption insert guard), over a rolling window.
        expect(file[group].limitWhen, group).toMatch(/ask|pides|pede/i);
      }
      expect(file.tutor.practice).toMatch(/app/);
      expect(file.tutor.noCoinsMoved).toBeTruthy();
      const all = (['young', 'transition', 'teen', 'tutor'] as Group[]).flatMap((g) => strings(file, g).map(([, t]) => t)).join(' \n ');
      expect(all).not.toMatch(/\b(guarantee[sd]?|garantiza\w*|garante\w*|secure[sd]?|segur[oa]s?|protect\w*|proteg\w*|insured|asegurad\w*|FDIC|real card|tarjeta real|cartão real)\b/i);
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = (['young', 'transition', 'teen', 'tutor'] as Group[]).flatMap((g) => strings(file, g).map(([, t]) => t)).join(' \n ');
      expect(all).not.toMatch(/—|!/);
      expect(all).not.toMatch(/\b(money|dinero|dinheiro|pesos|reais|dollars?|interest|interés|juros|job|trabajo|emprego|invest|invertir|investir|accept|aceptar|aceitar)\b/i);
      expect(all).not.toMatch(/\b(bot|assistant|asistente|assistente|Mentor|streak)\b/i);
    });

    it(`keeps the child's first view inside its band's first-view budget in ${locale}`, () => {
      for (const group of ['young', 'transition', 'teen'] as const) {
        const c = file[group];
        // The card, its freeze and what a freeze holds: the view above the pockets.
        const view = [c.heading, c.practice, c.notFrozen, c.coinsOnly, c.whileFrozen, c.holdRewards, c.holdSplits, c.holdCredits, c.holdShare,
          c.nothingLost, c.freeze];
        const limit = firstViewLimit({ locale: locale as Locale, ageBand: BAND[group], surface: 'app' })!;
        expect(wordCount(view.join(' ')), group).toBeLessThanOrEqual(limit);
      }
    });
  }
});
