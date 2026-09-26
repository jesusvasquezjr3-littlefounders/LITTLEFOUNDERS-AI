import { describe, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-mentor.json` (Lane 3): the Mentor stage and its session surfaces. */

describe('rebuild-mentor copy budget', () => {
  for (const [locale, strings] of namespaceCopy('mentor')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['mentorCalibration', 'mentorSessionEnd', 'mentorCheckIn', 'mentorGoalCheck', 'mentorAllianceCheck', 'mentorProfile']);
      for (const [key, text] of Object.entries(strings.mentorCalibration as Record<string, string>)) {
        const role = key === 'question' ? 'prompt' : ['youngest', 'middle', 'older', 'retry'].includes(key) ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `mentorCalibration.${key}`);
      }
      // C.8/C.12 + C.16: the Mentor's session-end choice and closing state, for the youngest band.
      for (const [path, text] of flatten(strings.mentorSessionEnd!)) {
        const role = path.endsWith('Title') ? 'heading'
          : ['stop', 'more', 'backToPath'].includes(path) ? 'action' : path === 'previewTopic' ? 'data' : 'body';
        expectFits(text, role, locale, '6-9', `mentorSessionEnd.${path}`);
      }
      // C.19: the check-in reply chips are option controls (Bible 08 §2: 5 words for ages 6–9).
      for (const [key, text] of Object.entries(strings.mentorCheckIn as Record<string, string>)) {
        expectFits(text, key === 'choiceLabel' ? 'body' : 'option', locale, '6-9', `mentorCheckIn.${key}`);
      }
      // C.15: the goal chips and the bond-proxy chips are option controls for the youngest band;
      // the bond-proxy question is a prompt (12 words for ages 6–9).
      for (const [key, text] of Object.entries(strings.mentorGoalCheck as Record<string, string>)) {
        expectFits(text, key === 'choiceLabel' ? 'body' : 'option', locale, '6-9', `mentorGoalCheck.${key}`);
      }
      for (const [key, text] of Object.entries(strings.mentorAllianceCheck as Record<string, string>)) {
        const role = key === 'question' ? 'prompt' : ['yes', 'partly', 'no'].includes(key) ? 'option' : key === 'retry' ? 'action' : 'body';
        expectFits(text, role, locale, '6-9', `mentorAllianceCheck.${key}`);
      }
      // C.7: the profile is read by a teen, an adult or a verified Tutor (13-17 budget, the stricter of the two).
      for (const [path, text] of flatten(strings.mentorProfile!)) {
        const role = path.startsWith('title') ? 'heading' : ['reset', 'resetting'].includes(path) ? 'action' : 'body';
        expectFits(text.replace('{n}', '12'), role, locale, '13-17', `mentorProfile.${path}`);
      }
    });
  }
});
