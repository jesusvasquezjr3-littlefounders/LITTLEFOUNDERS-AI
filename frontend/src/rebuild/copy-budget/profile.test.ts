import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, namespaceCopy } from './budget';

/* `rebuild-profile.json` (Lane 5): profile, social, settings and the account. */

describe('rebuild-profile copy budget', () => {
  for (const [locale, strings] of namespaceCopy('profile')) {
    const group = (name: string) => Object.entries(strings[name] as Record<string, string>);
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['analyticsChoice', 'socialRequest', 'socialRequestTeen', 'privateProfile', 'teenConnections', 'profileSafety', 'memorySelfReview', 'accountDeletion']);
      for (const [key, text] of group('analyticsChoice')) {
        const role = key === 'title' ? 'heading' : key === 'label' ? 'option' : ['on', 'off', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '13-17', `analyticsChoice.${key}`);
      }
      for (const [key, text] of group('socialRequest')) {
        expectFits(text, key === 'action' || key === 'saving' ? 'action' : 'body', locale, '13-17', `socialRequest.${key}`);
      }
      for (const [key, text] of group('socialRequestTeen')) {
        expectFits(text, key === 'action' || key === 'saving' ? 'action' : 'body', locale, '13-17', `socialRequestTeen.${key}`);
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
    });
  }
});
