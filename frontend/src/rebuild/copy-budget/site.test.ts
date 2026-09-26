import { describe, expect, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/*
 * `rebuild-site.json` (Lane 1): public site, sign-in, recovery, verification,
 * onboarding and the identity states. Every key group is budgeted here, with
 * the role its surface declares (06 §3): the public pages on the site budget
 * (06 §3.2: action 3, heading 8, body 25 words), the identity states and X2
 * on the app budget for the youngest band that can reach them (06 §3.1).
 * `brand` strings are the approved brand lines (06 §3.3) and are not counted.
 */

type Rule = (key: string) => CopyRole;

const SITE_GROUPS: Record<string, Rule> = {
  site: (key) => key === 'becomeTutor' ? 'brand'
    : ['startFree', 'starting', 'continue', 'login', 'openFamily', 'openApp'].includes(key) ? 'action' : 'body',
  landing: (key) => ['title', 'lead'].includes(key) ? 'brand' : key === 'factValue' ? 'data'
    : key.endsWith('Title') ? 'heading' : key.endsWith('Action') ? 'action' : 'body',
  howItWorks: (key) => key === 'title' || key.endsWith('Title') ? 'heading' : key.startsWith('option') ? 'option' : 'body',
  families: (key) => key === 'title' || key.endsWith('Title') ? 'heading'
    : ['exampleShow', 'exampleHide', 'approve', 'notNow'].includes(key) ? 'action'
      : ['save', 'spend', 'share'].includes(key) ? 'option' : 'body',
  faq: (key) => key === 'title' || key === 'closingTitle' || key.endsWith('.question') ? 'heading'
    : key === 'all' || key.startsWith('categories.') ? 'option' : key === 'emailUs' ? 'action' : 'body',
  legalPage: (key) => ['contents', 'noResults'].includes(key) ? 'heading' : ['terms', 'privacy', 'cookieSettings'].includes(key) ? 'action' : 'body',
  cookies: (key) => ['title', 'sheetTitle'].includes(key) || (key.endsWith('Title')) ? 'heading'
    : ['accept', 'reject', 'preferences', 'privacyLink', 'close'].includes(key) ? 'action' : 'body',
};

describe('rebuild-site copy budget', () => {
  for (const [locale, strings] of namespaceCopy('site')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['ageScreen', 'kidSuspended', ...Object.keys(SITE_GROUPS), 'routeError']);
      for (const [key, text] of Object.entries(strings.ageScreen as Record<string, string>)) {
        const role = key === 'title' ? 'heading' : ['continue', 'exit', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `ageScreen.${key}`);
      }
      for (const [key, text] of Object.entries(strings.kidSuspended as Record<string, string>)) {
        const role = key === 'title' ? 'heading' : 'body';
        expectFits(text.replace('{email}', 'informame@littlefounders.ai'), role, locale, '6-9', `kidSuspended.${key}`);
      }
      for (const [group, rule] of Object.entries(SITE_GROUPS)) {
        for (const [key, text] of flatten(strings[group]!)) expectFits(text, rule(key), locale, 'adult', `${group}.${key}`, 'site');
      }
      // X2 can reach a 6-9 learner (the lesson player), so it takes the app budget of the youngest band.
      for (const [key, text] of flatten(strings.routeError!)) {
        const role = key.endsWith('itle') ? 'heading' : key.endsWith('ody') ? 'body' : 'action';
        expectFits(text, role, locale, '6-9', `routeError.${key}`);
      }
    });
  }

  it('asks every FAQ question once and answers it in every locale', () => {
    const [, en] = namespaceCopy('site')[0]!;
    const ids = Object.keys((en.faq as { items: Record<string, unknown> }).items);
    for (const [, strings] of namespaceCopy('site')) {
      expect(Object.keys((strings.faq as { items: Record<string, unknown> }).items)).toEqual(ids);
    }
  });

  it('never promises more than "free to start" (OD-5) and never calls the AI a Tutor (OD-6)', () => {
    for (const [locale, strings] of namespaceCopy('site')) {
      for (const [key, text] of flatten(strings)) {
        expect(/free to stay|always free|forever free|gratis para (quedarte|siempre)|siempre gratis|grátis para (sempre|continuar)|sempre grátis/i.test(text), `${locale} ${key}: ${text}`).toBe(false);
        expect(/\b(AI|IA) Tutor\b|\bTutor (de )?IA\b|tutor that answers|tutor que responde/i.test(text), `${locale} ${key}: ${text}`).toBe(false);
      }
    }
  });
});
