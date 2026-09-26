import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-profile.json` (Lane 5): profile, social, settings and the account. */

describe('rebuild-profile copy budget', () => {
  for (const [locale, strings] of namespaceCopy('profile')) {
    const group = (name: string) => Object.entries(strings[name] as Record<string, string>);
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['analyticsChoice', 'privateProfile', 'teenConnections', 'profileSafety', 'memorySelfReview', 'accountDeletion', 'ownProfile', 'lookEditor', 'settings', 'publicProfile', 'report', 'peopleList']);
      for (const [key, text] of group('analyticsChoice')) {
        const role = key === 'title' ? 'heading' : key === 'label' ? 'option' : ['on', 'off', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '13-17', `analyticsChoice.${key}`);
      }
      // E.8: a child can land on a private teen's card, so it is budgeted for the youngest band.
      for (const [key, text] of group('privateProfile')) {
        const role = key === 'title' ? 'heading' : key === 'request' || key === 'saving' ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `privateProfile.${key}`);
      }
      for (const [key, text] of group('teenConnections')) {
        const role = key === 'title' || key === 'followersTitle' ? 'heading'
          : ['retry', 'accept', 'decline', 'more', 'remove'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '13-17', `teenConnections.${key}`);
      }
      // E.13: a child reads its own notice, so the youngest band applies.
      for (const [key, text] of group('profileSafety')) {
        const role = key === 'title' || key === 'kidTitle' ? 'heading' : 'body';
        expectFits(text.replace('{name}', 'Ana'), role, locale, '6-9', `profileSafety.${key}`);
      }
      for (const [key, text] of group('memorySelfReview')) {
        const role = key === 'title' ? 'heading' : ['approve', 'delete', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '13-17', `memorySelfReview.${key}`);
      }
      for (const [key, text] of group('accountDeletion')) {
        // E.6: every line of the deletion flow, including the layered details, is budgeted; none is exempted as legal text.
        const role = ['title', 'scheduledTitle', 'deletedTitle'].includes(key) ? 'heading'
          : ['start', 'detailsLabel', 'confirm', 'back', 'signInAgain', 'retry', 'keep', 'signIn', 'signOut', 'continue', 'showPassword', 'hidePassword'].includes(key) ? 'action'
            : key === 'acknowledge' ? 'option' : 'body';
        const filled = text.replace('{days}', '14').replace('{count}', '2').replace('{date}', '8 Oct 2026');
        expectFits(filled, role, locale, '13-17', `accountDeletion.${key}`);
      }
      // W2 profile lane (P1-P3): a child reads all three screens, so the youngest band applies to every string.
      for (const [key, text] of group('ownProfile')) {
        const role = ['title', 'failedTitle', 'offlineTitle', 'progressTitle', 'badgesTitle', 'peopleTitle', 'inviteTitle'].includes(key) ? 'heading'
          : ['retry', 'retrying', 'chooseUsername', 'editLook', 'settings', 'followers', 'following', 'copyLink'].includes(key) ? 'action' : 'body';
        const filled = text.replace('{date}', 'September 2026').replace('{link}', 'littlefounders.ai/@ana');
        expectFits(filled, role, locale, '6-9', `ownProfile.${key}`);
      }
      for (const [path, text] of flatten(strings.lookEditor!)) {
        const role = ['title', 'failedTitle', 'offlineTitle'].includes(path) || path.startsWith('parts.') ? 'heading'
          : ['back', 'retry', 'retrying', 'random', 'save', 'saving'].includes(path) ? 'action'
            : path === 'none' || path.startsWith('options.') ? 'option' : 'body';
        expectFits(text, role, locale, '6-9', `lookEditor.${path}`);
      }
      for (const [path, text] of flatten(strings.settings!)) {
        const role = ['title', 'failedTitle', 'offlineTitle', 'guestTitle', 'detailsTitle', 'signInTitle', 'blockedTitle'].includes(path) ? 'heading'
          : ['back', 'retry', 'retrying', 'guestAction', 'save', 'saving', 'changeEmail', 'sendLink', 'sending', 'cancel', 'changePassword', 'savePassword',
            'showPassword', 'hidePassword', 'unblock', 'unblocking'].includes(path) ? 'action'
            : path.startsWith('languages.') ? 'option' : 'body';
        expectFits(text.replace('{email}', 'ana@example.com'), role, locale, '6-9', `settings.${path}`);
      }
      // W2P.2 (P4-P8): a child opens other people's profiles, its own lists and the report, so the youngest band applies.
      for (const [key, text] of group('publicProfile')) {
        const role = ['title', 'unavailableTitle', 'failedTitle', 'offlineTitle', 'leaveTitle', 'privateTitle', 'peopleTitle', 'progressTitle', 'badgesTitle',
          'safetyTitle', 'blockTitle'].includes(key) ? 'heading'
          : ['home', 'retry', 'retrying', 'editMine', 'follow', 'unfollow', 'saving', 'leaveKeep', 'leaveConfirm', 'ask', 'asking', 'followers', 'following',
            'report', 'block', 'blockKeep', 'blockConfirm', 'blocking'].includes(key) ? 'action' : 'body';
        expectFits(text.replace('{date}', 'September 2026'), role, locale, '6-9', `publicProfile.${key}`);
      }
      for (const [path, text] of flatten(strings.report!)) {
        const role = path === 'title' ? 'heading' : ['send', 'sending', 'cancel'].includes(path) ? 'action' : path.startsWith('categories.') ? 'option' : 'body';
        expectFits(text, role, locale, '6-9', `report.${path}`);
      }
      for (const [key, text] of group('peopleList')) {
        const role = ['followersTitle', 'followingTitle', 'failedTitle', 'offlineTitle', 'unavailableTitle', 'emptyFollowers', 'emptyFollowing', 'emptyPublic', 'closedTitle'].includes(key) ? 'heading'
          : ['back', 'retry', 'retrying', 'unfollow', 'unfollowing', 'remove', 'removing'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `peopleList.${key}`);
      }
    });
  }
});
