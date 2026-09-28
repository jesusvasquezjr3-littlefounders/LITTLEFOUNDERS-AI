import { describe, expect, it } from 'vitest';
import en from '../../i18n/en-US/familyGovernance.json';
import es from '../../i18n/es-MX/familyGovernance.json';
import pt from '../../i18n/pt-BR/familyGovernance.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';
import { TIP_IDS, POLICY_CLASSES, BRIDGE_MOMENTS } from './governanceApi';
import { SCOPE_NOT, SCOPE_TEACHES } from './ScopeStatement';

/*
 * S07.7 copy contract (D.19-D.23): every string fits its Copy Budget role
 * (Bible 06) in all three locales, the files carry identical keys, and the
 * controlled glossary holds (owner log §5): coins, never money, except where
 * the copy names real money to say it does not move or to bridge out of the
 * app; "Tutor" only for the verified parent; the AI is the Mentor; no em
 * dash, no exclamation (nothing here celebrates). The child's research note
 * is written to the youngest band (6-9), the bridge to teens, the rest to
 * adults. No tip or line claims proof (Block D Part 4).
 */

type Group = keyof typeof en;
const BANDS: Record<Group, AgeBand> = {
  coaching: 'adult', tips: 'adult', reflection: 'adult', pricing: 'adult', limitNote: 'adult', scope: 'adult', dataPolicy: 'adult', research: 'adult',
  myResearch: '6-9', bridge: '13-17', researchAtEighteen: 'adult',
};
const TIP_ROLE: Record<string, CopyRole> = { title: 'heading', body: 'body', why: 'body' };
const ROLE: Record<Exclude<Group, 'tips'>, Record<string, CopyRole>> = {
  coaching: { label: 'data', why: 'action', whyNote: 'body', dismiss: 'action', failed: 'body' },
  reflection: { prompt: 'prompt', hint: 'body', continue: 'action', share: 'action', useAsReason: 'action', back: 'action' },
  pricing: { open: 'action', close: 'action', contribution: 'body', bonus: 'body', promise: 'body' },
  limitNote: { open: 'action', reason: 'body', review: 'body' },
  scope: {
    heading: 'heading', intro: 'body', open: 'action', close: 'action', teachesHeading: 'heading', earning: 'body', splitting: 'body', goals: 'body',
    asking: 'body', notHeading: 'heading', credit: 'body', debt: 'body', compounding: 'body', risk: 'body', why: 'body',
  },
  dataPolicy: {
    heading: 'heading', lead: 'body', open: 'action', close: 'action', photos: 'body', records: 'body', coins: 'body', insights: 'body', research: 'body',
    erasure: 'body', sharing: 'body', failed: 'body',
  },
  research: {
    open: 'action', close: 'action', heading: 'heading', what: 'body', how: 'body', never: 'body', stop: 'body', yes: 'action', on: 'body', months: 'body',
    paused: 'body', stopButton: 'action', confirm: 'prompt', confirmYes: 'action', confirmNo: 'action', saved: 'body', deleted: 'body', failed: 'body', loading: 'body',
  },
  myResearch: { heading: 'heading', body: 'body', stop: 'body', button: 'action', confirm: 'prompt', yes: 'action', no: 'action', stopped: 'body', failed: 'body' },
  // H-25 (GAP-FIX-R2): the young adult's own answer after the Tutor's yes lapsed at 18.
  researchAtEighteen: {
    heading: 'heading', lapsed: 'body', ask: 'prompt', what: 'body', how: 'body', yes: 'action', no: 'action', self: 'body',
    stopButton: 'action', confirm: 'prompt', confirmYes: 'action', confirmNo: 'action', joined: 'body', deleted: 'body', failed: 'body',
  },
  bridge: {
    heading: 'heading', intro: 'body', first_pay: 'heading', first_account: 'heading', first_budget: 'heading', arrived: 'action', undo: 'action',
    first_pay1: 'body', first_pay2: 'body', first_pay3: 'body', first_account1: 'body', first_account2: 'body', first_account3: 'body',
    first_budget1: 'body', first_budget2: 'body', first_budget3: 'body', splitHeading: 'heading', amount: 'body', splitResult: 'data', splitNote: 'body', failed: 'body',
  },
};

const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const sample = (text: string) => text.replace(/\{name\}/g, 'Ana').replace(/\{days\}/g, '400').replace(/\{count\}/g, '3').replace(/\{date\}/g, 'June 1, 2026')
  .replace(/\{(save|spend|share)\}/g, '25');
const flat = (file: typeof en) => Object.entries(file).flatMap(([group, strings]) => group === 'tips'
  ? Object.entries(strings as Record<string, Record<string, string>>).flatMap(([id, t]) => Object.entries(t).map(([k, v]) => [`tips.${id}.${k}`, v] as const))
  : Object.entries(strings as Record<string, string>).map(([k, v]) => [`${group}.${k}`, v] as const));
const roleOf = (key: string): CopyRole => {
  const [group, a, b] = key.split('.');
  return group === 'tips' ? TIP_ROLE[b!]! : ROLE[group as Exclude<Group, 'tips'>][a!]!;
};

describe('Family governance copy (S07.7)', () => {
  it('has identical keys in every locale, each with a declared role and band, and copy for every id the code uses', () => {
    const keys = (file: typeof en) => flat(file).map(([k]) => k).sort();
    expect(keys(es as typeof en)).toEqual(keys(en));
    expect(keys(pt as typeof en)).toEqual(keys(en));
    for (const [key] of flat(en)) expect(roleOf(key), key).toBeDefined();
    expect(Object.keys(en).sort()).toEqual(Object.keys(BANDS).sort());
    expect(Object.keys(en.tips).sort()).toEqual([...TIP_IDS].sort());
    for (const id of POLICY_CLASSES) expect(en.dataPolicy[id]).toBeTruthy();
    for (const id of [...SCOPE_TEACHES, ...SCOPE_NOT]) expect(en.scope[id]).toBeTruthy();
    for (const m of BRIDGE_MOMENTS) for (const s of ['', '1', '2', '3']) expect(en.bridge[`${m}${s}` as keyof typeof en.bridge]).toBeTruthy();
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the Copy Budget in ${locale}`, () => {
      for (const [key, text] of flat(file as typeof en)) {
        const band = BANDS[key.split('.')[0] as Group];
        expect(checkCopy(sample(text), roleOf(key), { locale: locale as Locale, ageBand: band, surface: 'app' }), key).toEqual([]);
      }
    });

    it(`keeps the controlled glossary in ${locale}`, () => {
      const all = flat(file as typeof en);
      const text = all.map(([, v]) => v).join(' \n ');
      expect(text).not.toMatch(/—/);
      expect(text).not.toMatch(/!/);
      expect(text).not.toMatch(/\b(job|trabajo|emprego|accept|aceptar|aceitar|streak freeze|bot|assistant|asistente|assistente)\b/i);
      // Real money is named only to say it does not move (the scope intro).
      for (const [key, value] of all) {
        if (key !== 'scope.intro') expect(value, key).not.toMatch(/\b(money|dinero|dinheiro)\b/i);
      }
      // The AI is the Mentor, named only where the data policy says what it never receives.
      for (const [key, value] of all) if (key !== 'dataPolicy.sharing') expect(value, key).not.toMatch(/\bMentor\b/);
      // "Tutor" is the verified parent: only the child's own research note and the young adult's lapse note name them.
      for (const [key, value] of all) if (key !== 'myResearch.body' && key !== 'researchAtEighteen.lapsed') expect(value, key).not.toMatch(/\bTutor\b/);
      // Nothing is marketed as proven (Block D Part 4 governance boundary).
      expect(text).not.toMatch(/\b(proven|prove[sn]?|scientifically|guarantee[sd]?|comprobad[oa]|demostrad[oa]|comprovad[oa]|cientificamente|científicamente|garantiza\w*|garant\w*)\b/i);
      // No percentage reaches a child or a teen.
      for (const [key, value] of all) if (key.startsWith('myResearch') || key.startsWith('bridge')) expect(value, key).not.toMatch(/%|percent|porcentaje|porcentagem/i);
    });

    it(`keeps each first view inside its band's budget in ${locale}`, () => {
      const f = file as typeof en;
      const adult = firstViewLimit({ locale: locale as Locale, ageBand: 'adult', surface: 'app' })!;
      const young = firstViewLimit({ locale: locale as Locale, ageBand: '6-9', surface: 'app' })!;
      const teen = firstViewLimit({ locale: locale as Locale, ageBand: '13-17', surface: 'app' })!;
      const tipViews = Object.values(f.tips).map((t) => [f.coaching.label, t.title, t.body, f.coaching.why, f.coaching.dismiss]);
      const views: [number, string[]][] = [
        ...tipViews.map((v) => [adult, v] as [number, string[]]),
        [adult, [f.scope.heading, f.scope.open, f.scope.intro]],
        [adult, [f.dataPolicy.heading, f.dataPolicy.open, f.dataPolicy.lead]],
        [adult, [f.research.heading, f.research.close, f.research.what, f.research.how, sample(f.research.never), f.research.stop, sample(f.research.yes)]],
        [adult, [sample(f.reflection.prompt), f.reflection.hint, f.reflection.continue, f.reflection.share, f.reflection.back]],
        [young, [f.myResearch.heading, f.myResearch.body, f.myResearch.stop, f.myResearch.button]],
        [adult, [f.researchAtEighteen.heading, f.researchAtEighteen.lapsed, f.researchAtEighteen.what, f.researchAtEighteen.how,
          f.researchAtEighteen.ask, f.researchAtEighteen.yes, f.researchAtEighteen.no]],
        [teen, [f.bridge.heading, f.bridge.intro, f.bridge.first_pay, f.bridge.first_account, f.bridge.first_budget, f.bridge.arrived, f.bridge.arrived, f.bridge.arrived]],
      ];
      for (const [limit, view] of views) expect(wordCount(view.join(' ')), view[1]).toBeLessThanOrEqual(limit);
    });

    it(`names the four things the practice does not teach in ${locale}`, () => {
      const f = file as typeof en;
      const pattern: Record<string, [RegExp, RegExp, RegExp, RegExp]> = {
        'en-US': [/credit/i, /debt/i, /compound interest/i, /risk/i],
        'es-MX': [/crédito/i, /deuda/i, /interés compuesto/i, /riesgo/i],
        'pt-BR': [/crédito/i, /dívida/i, /juros compostos/i, /risco/i],
      };
      const [credit, debt, compounding, risk] = pattern[locale]!;
      expect(f.scope.credit).toMatch(credit);
      expect(f.scope.debt).toMatch(debt);
      expect(f.scope.compounding).toMatch(compounding);
      expect(f.scope.risk).toMatch(risk);
    });
  }
});
