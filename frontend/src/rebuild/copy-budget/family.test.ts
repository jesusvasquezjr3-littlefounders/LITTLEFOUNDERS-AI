import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-family.json` (Lane 4): Family Hub, Tutor console, tasks, banking, teen wallet, family social decisions. */

describe('rebuild-family copy budget', () => {
  for (const [locale, strings] of namespaceCopy('family')) {
    const group = (name: string) => Object.entries(strings[name] as Record<string, string>);
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['socialGraph', 'socialHistory', 'socialRequests', 'socialNotices', 'badgeShares', 'achievementShare', 'guardianInvite',
        'familyConsole', 'familyChildAccount', 'familyChildConsent', 'familyChildProgress', 'familyChildMentor', 'familyMemoryNotes']);
      // W2F.1: the rebuilt Family console (F1), a child's progress (F2) and Mentor talks (F3). Adult Tutor copy;
      // placeholders take realistic values (a data value counts as its own words, 06 §3).
      const sample = (text: string) => text.replace('{name}', 'Ana').replace('{username}', '@ana_2016').replace('{count}', '12').replace('{date}', 'Sep 20')
        .replace('{course}', 'Money Basics').replace('{goal}', 'Bike').replace('{passed}', '3').replace('{total}', '8').replace('{topic1}', 'saving')
        .replace('{topic2}', 'sharing').replace('{topic}', 'saving').replace('{correct}', '4').replace('{score}', '80').replace('{steps}', '+10, -5')
        .replace('{label}', 'Ana saves 5 a week');
      const budget = (name: string, roles: Record<string, 'heading' | 'action' | 'option' | 'data' | 'legal'>) => {
        for (const [key, text] of flatten(strings[name] as never)) {
          const role = roles[key] ?? roles[key.split('.')[0]!] ?? 'body';
          if (role === 'data' || role === 'legal') continue;
          expectFits(sample(text), role, locale, 'adult', `${name}.${key}`);
        }
      };
      budget('familyConsole', { title: 'heading', failedTitle: 'heading', verifyTitle: 'heading', emptyTitle: 'heading', learning: 'heading', money: 'heading',
        connections: 'heading', privacy: 'heading', account: 'heading', retry: 'action', retrying: 'action', verifyAction: 'action', approvals: 'action',
        progress: 'action', mentor: 'action', coinCard: 'action', coins: 'data' });
      budget('familyChildAccount', { addTitle: 'heading', doneTitle: 'heading', remove: 'heading', add: 'action', create: 'action', creating: 'action', cancel: 'action',
        done: 'action', manage: 'action', close: 'action', saveName: 'action', savePassphrase: 'action', removeAction: 'action', removing: 'action', keep: 'action',
        show: 'action', hide: 'action', saving: 'action' });
      // The microphone consent is the stored, mandated disclosure (06 §3.3 `legal`): shown in full behind "Allow microphone", never shortened.
      budget('familyChildConsent', { micTitle: 'heading', micAllow: 'action', micTurnOff: 'action', micConfirm: 'action', micCancel: 'action', micSaving: 'action',
        on: 'option', off: 'option', micConsent: 'legal' });
      budget('familyChildProgress', { title: 'heading', titleFallback: 'heading', failedTitle: 'heading', forbiddenTitle: 'heading', noCourseTitle: 'heading',
        glance: 'heading', shareTitle: 'heading', mapTitle: 'heading', back: 'action', retry: 'action', retrying: 'action', shareStreak: 'action',
        shareBadge: 'action', done: 'option', inProgress: 'option', notStarted: 'option', reviewDue: 'option' });
      budget('familyChildMentor', { title: 'heading', titleFallback: 'heading', failedTitle: 'heading', forbiddenTitle: 'heading', flagsTitle: 'heading',
        sessionsTitle: 'heading', keptTitle: 'heading', intent: 'heading', back: 'action', retry: 'action', retrying: 'action', read: 'action', hide: 'action',
        more: 'action', loadingMore: 'action', high: 'option', medium: 'option', low: 'option' });
      budget('familyMemoryNotes', { title: 'heading', approve: 'action', reject: 'action', retry: 'action', outOfDate: 'option' });
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
