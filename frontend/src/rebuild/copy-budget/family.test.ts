import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, LOCALES, namespaceCopy } from './budget';

/* `rebuild-family.json` (Lane 4): Family Hub, Tutor console, tasks, banking, teen wallet, family social decisions. */

describe('rebuild-family copy budget', () => {
  for (const [locale, strings] of namespaceCopy('family')) {
    const group = (name: string) => Object.entries(strings[name] as Record<string, string>);
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['socialGraph', 'socialHistory', 'socialRequests', 'socialNotices', 'badgeShares', 'achievementShare', 'guardianInvite',
        'familyConsole', 'familyChildAccount', 'familyChildConsent', 'familyChildProgress', 'familyChildMentor', 'familyMemoryNotes',
        'familyTasks', 'childTasks', 'familyCoins', 'childCoins', 'coinCard', 'teenWalletScreen', 'familyCoopGoals', 'familyDeletionNotices']);
      // W2F.1: the rebuilt Family console (F1), a child's progress (F2) and Mentor talks (F3). Adult Tutor copy;
      // placeholders take realistic values (a data value counts as its own words, 06 §3).
      const sample = (text: string) => text.replace('{name}', 'Ana').replace('{username}', '@ana_2016').replace('{count}', '12').replace('{date}', 'Sep 20')
        .replace('{course}', 'Money Basics').replace('{goal}', 'Bike').replace('{passed}', '3').replace('{total}', '8').replace('{topic1}', 'saving')
        .replace('{topic2}', 'sharing').replace('{topic}', 'saving').replace('{correct}', '4').replace('{score}', '80').replace('{steps}', '+10, -5')
        .replace('{label}', 'Ana saves 5 a week').replace('{title}', 'Set the table').replace('{used}', '20').replace('{cap}', '50');
      const budget = (name: string, roles: Record<string, 'heading' | 'action' | 'option' | 'data' | 'legal'>, band: '6-9' | '13-17' | 'adult' = 'adult') => {
        for (const [key, text] of flatten(strings[name] as never)) {
          const role = roles[key] ?? roles[key.split('.')[0]!] ?? 'body';
          if (role === 'data' || role === 'legal') continue;
          expectFits(sample(text), role, locale, band, `${name}.${key}`);
        }
      };
      budget('familyConsole', { title: 'heading', failedTitle: 'heading', verifyTitle: 'heading', emptyTitle: 'heading', learning: 'heading', money: 'heading',
        connections: 'heading', privacy: 'heading', account: 'heading', retry: 'action', retrying: 'action', verifyAction: 'action', approvals: 'action',
        progress: 'action', mentor: 'action', coinCard: 'action', coins: 'data' });
      budget('familyChildAccount', { addTitle: 'heading', doneTitle: 'heading', remove: 'heading', add: 'action', create: 'action', creating: 'action', cancel: 'action',
        done: 'action', manage: 'action', close: 'action', saveName: 'action', saveUsername: 'action', savePassphrase: 'action', removeAction: 'action', removing: 'action', keep: 'action',
        show: 'action', hide: 'action', saving: 'action', saveAge: 'action', ageUnder13: 'option', ageTeen: 'option' });
      // The microphone consent is the stored, mandated disclosure (06 §3.3 `legal`): shown in full behind "Allow microphone", never shortened.
      // L-04 (OD-27 (1)): the Tutor's opt-in for goals together, for a child aged 13 to 17. Adult Tutor copy.
      budget('familyCoopGoals', { title: 'heading', on: 'option', off: 'option', retry: 'action' });
      budget('familyChildConsent', { micTitle: 'heading', micAllow: 'action', micTurnOff: 'action', micConfirm: 'action', micCancel: 'action', micSaving: 'action',
        on: 'option', off: 'option', micConsent: 'legal' });
      budget('familyChildProgress', { title: 'heading', titleFallback: 'heading', failedTitle: 'heading', forbiddenTitle: 'heading', noCourseTitle: 'heading',
        glance: 'heading', shareTitle: 'heading', mapTitle: 'heading', back: 'action', retry: 'action', retrying: 'action', shareStreak: 'action',
        shareBadge: 'action', done: 'option', inProgress: 'option', notStarted: 'option', reviewDue: 'option' });
      budget('familyChildMentor', { title: 'heading', titleFallback: 'heading', failedTitle: 'heading', forbiddenTitle: 'heading', flagsTitle: 'heading',
        sessionsTitle: 'heading', keptTitle: 'heading', intent: 'heading', back: 'action', retry: 'action', retrying: 'action', read: 'action', hide: 'action',
        more: 'action', loadingMore: 'action', high: 'option', medium: 'option', low: 'option' });
      // W2F.2: the Tutor's Tasks (F4-P) and coin cards (F5-P) are adult copy; the child's Tasks (F4-K) and wallet (F5-K) are
      // written to the youngest band's budget (6-9), so they read plainly in every register (D.12); the teen wallet's page states to 13-17.
      budget('familyTasks', { title: 'heading', failedTitle: 'heading', verifyTitle: 'heading', emptyTitle: 'heading', glance: 'heading', choresTitle: 'heading',
        waiting: 'heading', toDo: 'heading', recent: 'heading', rewardsTitle: 'heading', photoTitle: 'heading', retry: 'action', retrying: 'action',
        verifyAction: 'action', emptyAction: 'action', seePhoto: 'action', photoRetry: 'action', photoClose: 'action', pause: 'action', offer: 'action',
        addReward: 'action', create: 'action', creating: 'action', cancel: 'action', coinCards: 'action', toApprove: 'option', toDecide: 'option',
        coinsGiven: 'option', statusOpen: 'option', statusDone: 'option', statusApproved: 'option', statusCancelled: 'option', contribution: 'option',
        bonus: 'option', weekly: 'option', photoNeeded: 'option', offered: 'option', paused: 'option', coin: 'data', coins: 'data' });
      budget('childTasks', { title: 'heading', failedTitle: 'heading', refusedTitle: 'heading', payoutsTitle: 'heading', choresTitle: 'heading',
        rewardsTitle: 'heading', pocketsTitle: 'heading', photoTitle: 'heading', retry: 'action', retrying: 'action', refusedAction: 'action',
        addPhoto: 'action', newPhoto: 'action', savingPhoto: 'action', seePhoto: 'action', photoRetry: 'action', close: 'action', walletLink: 'action',
        statusOpen: 'option', statusDone: 'option', contribution: 'option', bonus: 'option', weekly: 'option', photoNeeded: 'option', asked: 'option',
        save: 'option', spend: 'option', share: 'option', coin: 'data', coins: 'data' }, '6-9');
      budget('familyCoins', { title: 'heading', failedTitle: 'heading', verifyTitle: 'heading', emptyTitle: 'heading', childFailed: 'heading',
        openTitle: 'heading', allowanceTitle: 'heading', limitTitle: 'heading', retry: 'action', retrying: 'action', verifyAction: 'action',
        emptyAction: 'action', open: 'action', opening: 'action', save: 'action', saving: 'action', rewardsLink: 'action', children: 'option',
        cardName: 'option', colour: 'option', allowanceSwitch: 'option', on: 'option', off: 'option', amount: 'option', often: 'option', weekly: 'option',
        biweekly: 'option', monthly: 'option', weekday: 'option', monthday: 'option', days: 'option', limitSwitch: 'option', window: 'option',
        days7: 'option', days30: 'option', cap: 'option', usedLabel: 'option', usedValue: 'data', next: 'data' });
      budget('childCoins', { title: 'heading', titleFamily: 'heading', failedTitle: 'heading', refusedTitle: 'heading', payoutsTitle: 'heading',
        lookTitle: 'heading', retry: 'action', retrying: 'action', refusedAction: 'action', edit: 'action', save: 'action', saving: 'action',
        cancel: 'action', tasksLink: 'action', cardName: 'option', colour: 'option' }, '6-9');
      budget('coinCard', { indigo: 'option', emerald: 'option', violet: 'option', amber: 'option', sunrise: 'option', ocean: 'option' }, '6-9');
      budget('teenWalletScreen', { failedTitle: 'heading', refusedTitle: 'heading', retry: 'action', retrying: 'action', refusedAction: 'action' }, '13-17');
      budget('familyMemoryNotes', { title: 'heading', approve: 'action', reject: 'action', retry: 'action', outOfDate: 'option' });
      // GAP-FIX-R2 (D-14 (b)): a linked teen's own account deletion, told to the Tutor. Adult copy, notify only.
      budget('familyDeletionNotices', { title: 'heading', retry: 'action' });
      for (const [key, text] of group('socialGraph')) {
        expectFits(text, ['loading', 'empty', 'failed'].includes(key) ? 'body' : 'action', locale, '13-17', `socialGraph.${key}`);
      }
      for (const [key, text] of group('socialHistory')) {
        expectFits(text, ['title', 'close', 'retry', 'more'].includes(key) ? 'action' : 'body', locale, '13-17', `socialHistory.${key}`);
      }
      for (const [key, text] of group('socialRequests')) {
        expectFits(text, ['title', 'close', 'retry', 'more', 'approve', 'deny'].includes(key) ? 'action' : 'body', locale, '13-17', `socialRequests.${key}`);
      }
      for (const [key, text] of group('badgeShares')) {
        expectFits(text.replace('{date}', '20 Sep 2026'), ['title', 'close', 'retry', 'revoke'].includes(key) ? 'action' : 'body', locale, '13-17', `badgeShares.${key}`);
      }
      for (const [key, text] of group('achievementShare')) {
        // F.3's point-of-action disclosure is budgeted as body copy, never exempted as legal text.
        expectFits(text, ['share', 'shareGoal'].includes(key) ? 'action' : 'body', locale, '13-17', `achievementShare.${key}`);
      }
      for (const [key, text] of group('socialNotices')) {
        expectFits(text.replace('{name}', 'Ana'), ['title', 'close', 'retry'].includes(key) ? 'action' : 'body', locale, '13-17', `socialNotices.${key}`);
      }
      for (const [key, text] of group('guardianInvite')) {
        const role = key === 'title' || key === 'acceptTitle' || key === 'acceptTitleTeen' ? 'heading'
          : ['close', 'open', 'invite', 'copy', 'accept'].includes(key) ? 'action' : 'body';
        expectFits(text.replace('{name}', 'Ana'), role, locale, '13-17', `guardianInvite.${key}`);
      }
    });
  }
});

/*
 * OD-28 (owner glossary §5, 27 September 2026): the money section formerly
 * called "Digital Banking" is Wallet / Cartera / Carteira, and never a bank or
 * a banking account. Pinned over every namespace this lane owns (the rebuilt
 * one and the wave-1 family, money and wallet namespaces its screens mount)
 * and over the inline copy of its rebuilt components. A sentence that says
 * coins are NOT in a bank ("not a bank interest rate") stays allowed: the
 * rule is about naming the section or the card, not about the disclaimer.
 */
const LANE_NAMESPACES = ['rebuild-family', 'familyHub', 'familyMoney', 'familyAutonomy', 'familyGovernance', 'moneyHabits', 'moneyRegister', 'coinAccount', 'teenWallet'];
const SECTION_NAMES: Record<(typeof LOCALES)[number], RegExp> = {
  'en-US': /(?<![\p{L}])(?:digital banking|online banking|bank account|banking account|banking)(?![\p{L}])/iu,
  'es-MX': /(?<![\p{L}])(?:billetera|banca digital|banca en l[ií]nea|cuenta bancaria|monedero)(?![\p{L}])/iu,
  'pt-BR': /(?<![\p{L}])(?:banco digital|conta banc[aá]ria|carteira digital)(?![\p{L}])/iu,
};

function laneSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return laneSources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/Fixtures\.ts$/.test(entry.name) ? [path] : [];
  });
}
/** In source, a bare "banking" is a route or an API path (`/banking`), not a name a family reads. */
const INLINE_NAMES = new RegExp(`${SECTION_NAMES['en-US'].source.replace('|banking)', ')')}|${SECTION_NAMES['es-MX'].source}|${SECTION_NAMES['pt-BR'].source}`, 'iu');
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('the money section is the Wallet (OD-28)', () => {
  const root = process.cwd();
  for (const locale of LOCALES) {
    it(`${locale}: no lane namespace names it a bank or "Digital Banking"`, () => {
      const found = LANE_NAMESPACES.flatMap((namespace) => flatten(JSON.parse(readFileSync(join(root, 'src/i18n', locale, `${namespace}.json`), 'utf8')) as never)
        .filter(([, text]) => SECTION_NAMES[locale].test(text)).map(([key, text]) => `${namespace}:${key} "${text}"`));
      expect(found).toEqual([]);
    });
  }

  it('no rebuilt family, banking or wallet component carries such a name inline', () => {
    const files = ['src/rebuild/family', 'src/rebuild/banking', 'src/rebuild/wallet'].flatMap((dir) => laneSources(join(root, dir)));
    expect(files.length).toBeGreaterThan(20);
    const found = files.flatMap((file) => {
      const text = withoutComments(readFileSync(file, 'utf8'));
      return INLINE_NAMES.test(text) ? [relative(root, file).split('\\').join('/')] : [];
    });
    expect(found).toEqual([]);
  });
});
