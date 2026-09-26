import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, namespaceCopy } from './budget';

/* `rebuild-site.json` (Lane 1): public site, sign-in, recovery, verification, onboarding and the identity states. */

describe('rebuild-site copy budget', () => {
  for (const [locale, strings] of namespaceCopy('site')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['ageScreen', 'kidSuspended']);
      for (const [key, text] of Object.entries(strings.ageScreen as Record<string, string>)) {
        const role = key === 'title' ? 'heading' : ['continue', 'exit', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `ageScreen.${key}`);
      }
      for (const [key, text] of Object.entries(strings.kidSuspended as Record<string, string>)) {
        const role = key === 'title' ? 'heading' : 'body';
        expectFits(text.replace('{email}', 'informame@littlefounders.ai'), role, locale, '6-9', `kidSuspended.${key}`);
      }
    });
  }
});
