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
  // M7, the public badge-link page (S10L.3): a stranger's view, on the site budget.
  badgeLanding: (key) => ['title', 'expiredTitle'].includes(key) ? 'heading' : key === 'howItWorks' ? 'action' : 'body',
  cookies: (key) => ['title', 'sheetTitle'].includes(key) || (key.endsWith('Title')) ? 'heading'
    : ['accept', 'reject', 'preferences', 'privacyLink', 'close'].includes(key) ? 'action' : 'body',
};

/*
 * Sign-in, recovery and verification (A1–A7, W2S.2) on the app budget (06 §3.1): the sign-in screens are read
 * by adults, teens and children signing in with a username. `privacy` is Legal's disclosure on the ID form (06
 * §3.3 `legal`), the support address is data. Onboarding (O1) is a guest's first screen, and a guest may be a child
 * under 13 who was refused at sign-up (A.2): it takes the youngest band's budget (options 5 words).
 */
const ACTIONS: Record<string, readonly string[]> = {
  authCommon: ['showPassword', 'hidePassword', 'google', 'backToLogin'],
  authLogin: ['submit', 'submitting', 'forgot', 'signup'],
  authSignup: ['submit', 'submitting', 'login', 'tryGuest', 'starting', 'why', 'close'],
  authForgot: ['submit', 'submitting'],
  authReset: ['submit', 'submitting', 'login', 'requestNew'],
  authCallback: [],
  authUpgrade: ['submit', 'submitting', 'later', 'login'],
  authVerify: ['retry', 'retrying', 'home', 'openFamily', 'ready', 'notNow', 'choosePhoto', 'changePhoto', 'submit', 'submitting', 'writeToUs'],
  onboardingFlow: ['back', 'continue', 'skip', 'saving', 'start', 'create', 'later'],
};
const IDENTITY_HEADINGS = new Set(['title', 'identity', 'document']);
const identityRole = (group: string, key: string): CopyRole => {
  if (group === 'authVerify' && key === 'privacy') return 'legal';
  if (group === 'authVerify' && key === 'supportEmail') return 'data';
  if (group === 'onboardingFlow' && key.startsWith('channels.')) return 'option';
  if (ACTIONS[group]!.includes(key)) return 'action';
  if (IDENTITY_HEADINGS.has(key) || key.endsWith('Title')) return 'heading';
  return 'body';
};

describe('rebuild-site copy budget', () => {
  for (const [locale, strings] of namespaceCopy('site')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['ageScreen', 'kidSuspended', ...Object.keys(SITE_GROUPS), 'routeError', ...Object.keys(ACTIONS)]);
      for (const group of Object.keys(ACTIONS)) {
        const band = group === 'onboardingFlow' ? '6-9' : 'adult';
        for (const [key, text] of flatten(strings[group]!)) {
          expectFits(text.replace('{current}', '2').replace('{total}', '5'), identityRole(group, key), locale, band, `${group}.${key}`);
        }
      }
      for (const [key, text] of Object.entries(strings.ageScreen as Record<string, string>)) {
        const role = key === 'title' || key === 'askTutorTitle' ? 'heading' : ['continue', 'exit', 'retry'].includes(key) ? 'action' : 'body';
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

  it('names the money section Wallet / Cartera / Carteira, never banking (OD-28 glossary)', () => {
    for (const [locale, strings] of namespaceCopy('site')) {
      for (const [key, text] of flatten(strings)) {
        // "Is this a real bank account?" stays a fair question; naming the section banking does not.
        expect(/digital banking|banca digital|banco digital|practi(ce|ca) (the )?bank|pratique o banco|practica la banca/i.test(text), `${locale} ${key}: ${text}`).toBe(false);
      }
    }
    const wallet = { 'en-US': /Wallet/, 'es-MX': /Cartera/, 'pt-BR': /Carteira/ } as const;
    for (const [locale, strings] of namespaceCopy('site')) {
      expect((strings.families as { bankingTitle: string }).bankingTitle).toMatch(wallet[locale as keyof typeof wallet]);
    }
  });
});
