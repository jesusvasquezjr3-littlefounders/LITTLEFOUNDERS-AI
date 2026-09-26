import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-staff.json` (Lane 6): the staff console (adult staff; the app budget for adults). */

describe('rebuild-staff copy budget', () => {
  for (const [locale, strings] of namespaceCopy('staff')) {
    it(`fits the adult app budget in ${locale}`, () => {
      expectBudgetedGroups(strings, ['staffLiveContent', 'staffMentorQuality']);
      // C.5 / C.6: the staff live-content surfaces.
      for (const [path, text] of flatten(strings.staffLiveContent!)) {
        const role = ['title', 'reviewTitle', 'packsTitle'].includes(path) || path.startsWith('category.') ? 'heading'
          : ['approve', 'quality', 'safety', 'publish', 'archive'].includes(path) ? 'action' : 'body';
        const filled = text.replace('{n}', '12').replace('{rate}', '50%').replace('{floor}', '15%')
          .replace('{tier}', '3').replace('{locale}', 'es-MX').replace('{count}', '4');
        expectFits(filled, role, locale, 'adult', `staffLiveContent.${path}`);
      }
      // C.24: the staff Mentor-quality dashboard. Placeholders filled with the longest real value (the longest owner-role name).
      const quality = strings.staffMentorQuality as { ownerRole: Record<string, string> };
      for (const [path, text] of flatten(strings.staffMentorQuality!)) {
        const role = ['title', 'flagsTitle', 'signalsTitle', 'reviewTitle'].includes(path) || path.startsWith('category.') ? 'heading'
          : ['acknowledge', 'resolve', 'confirmResolve', 'cancel', 'signReview'].includes(path) ? 'action' : 'body';
        const filled = text.replace('{n}', '12').replace('{rate}', '50%').replace('{role}', quality.ownerRole.safety_trust_lead!);
        expectFits(filled, role, locale, 'adult', `staffMentorQuality.${path}`);
      }
    });
  }
});
