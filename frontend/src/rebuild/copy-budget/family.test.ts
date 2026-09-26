import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, namespaceCopy } from './budget';

/* `rebuild-family.json` (Lane 4): Family Hub, Tutor console, tasks, banking, teen wallet, family social decisions. */

describe('rebuild-family copy budget', () => {
  for (const [locale, strings] of namespaceCopy('family')) {
    const group = (name: string) => Object.entries(strings[name] as Record<string, string>);
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['socialGraph', 'socialHistory', 'socialRequests', 'socialNotices', 'badgeShares', 'achievementShare', 'guardianInvite']);
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
          : ['close', 'invite', 'copy', 'accept'].includes(key) ? 'action' : 'body';
        expectFits(text.replace('{name}', 'Ana'), role, locale, '13-17', `guardianInvite.${key}`);
      }
    });
  }
});
