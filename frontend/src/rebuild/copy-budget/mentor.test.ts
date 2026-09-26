import { describe, expect, it } from 'vitest';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-mentor.json` (Lane 3): the Mentor stage and its session surfaces. */

describe('rebuild-mentor copy budget', () => {
  for (const [locale, strings] of namespaceCopy('mentor')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['mentorCalibration', 'mentorSessionEnd', 'mentorCheckIn', 'mentorGoalCheck', 'mentorAllianceCheck', 'mentorProfile', 'mentorStage', 'mentorScreen']);
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
      // Bible 08 §3/§7: the stage's accessible name, the character's name and what it is doing, for the youngest band.
      const stage = strings.mentorStage as { label: string; states: Record<string, string> };
      for (const [state, text] of Object.entries(stage.states)) {
        expectFits(stage.label.replace('{name}', 'Dr. Rho').replace('{state}', text), 'body', locale, '6-9', `mentorStage.states.${state}`);
      }
      // W2M.2: the Mentor screen (Bible 08 §2-§8), measured for the youngest band (the strictest budgets).
      const screen = strings.mentorScreen as Record<string, unknown>;
      const ACTIONS = new Set(['close', 'menu', 'changeMentor', 'transcript', 'grownUp', 'sheetClose', 'retry', 'send', 'talk', 'stopTalking',
        'interrupt', 'nextLine', 'showBoard', 'hideBoard', 'board.showTable', 'board.showPicture', 'board.showNext', 'board.takeBack', 'board.more', 'board.less']);
      const OPTIONS = new Set(['continue', 'continueGeneric', 'practise', 'practiseSkill', 'courseTopic', 'diagnostic', 'hint', 'tell', 'yes', 'no']);
      const MENTOR = new Set(['unavailable', 'greeting', 'greetingNamed', 'limit', 'thinking', 'loading']);
      const HEADINGS = new Set(['documentTitle', 'activity', 'chooser.heading']);
      for (const [path, raw] of flatten(screen as never)) {
        const text = raw.replace('{name}', 'Dr. Rho').replace('{nickname}', 'Ana').replace('{topic}', 'Saving money')
          .replace('{item}', 'Water').replace('{n}', '3').replace('{total}', '10');
        const role = path.startsWith('board.words.') || path === 'board.item' || path === 'board.value' || path === 'you' ? 'data'
          : ACTIONS.has(path) ? 'action' : OPTIONS.has(path) || path.startsWith('faq.') ? 'option' : MENTOR.has(path) ? 'mentor'
            : HEADINGS.has(path) ? 'heading' : path.startsWith('adaptation.') ? 'prompt' : 'body';
        expectFits(text, role, locale, '6-9', `mentorScreen.${path}`);
      }
      // 08 §8: each character's line is at most 6 words.
      for (const [character, line] of Object.entries((screen.chooser as { lines: Record<string, string> }).lines)) {
        expect(line.split(/\s+/u).length, `mentorScreen.chooser.lines.${character}`).toBeLessThanOrEqual(6);
      }
      // C.13: the hint-ladder chips are sent as the learner's own words, which Oracle's ladder must read as a hint and a tell.
      expect(`${screen.hint}`.toLowerCase()).toMatch(/pista|hint|dica/u);
      expect(`${screen.tell}`.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()).toMatch(/just tell me|solo dime|so me diz/u);
      // C.7: the profile is read by a teen, an adult or a verified Tutor (13-17 budget, the stricter of the two).
      for (const [path, text] of flatten(strings.mentorProfile!)) {
        const role = path.startsWith('title') ? 'heading' : ['reset', 'resetting'].includes(path) ? 'action' : 'body';
        expectFits(text.replace('{n}', '12'), role, locale, '13-17', `mentorProfile.${path}`);
      }
    });
  }
});
