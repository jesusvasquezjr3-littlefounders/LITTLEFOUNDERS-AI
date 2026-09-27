import { describe, expect, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { speechPages } from '../mentor/screen/speechPages';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-mentor.json` (Lane 3): the Mentor stage and its session surfaces. */

describe('rebuild-mentor copy budget', () => {
  for (const [locale, strings] of namespaceCopy('mentor')) {
    it(`fits its budgets in ${locale}`, () => {
      expectBudgetedGroups(strings, ['mentorCalibration', 'mentorSessionEnd', 'mentorCheckIn', 'mentorGoalCheck', 'mentorAllianceCheck', 'mentorProfile', 'mentorStage', 'mentorScreen',
        'mentorPersonalise', 'mentorMap', 'mentorNotebook', 'mentorHistory', 'mentorReplay', 'mentorRoleplay', 'mentorVoiceConsent']);
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
        'interrupt', 'nextLine', 'showBoard', 'hideBoard', 'board.showTable', 'board.showPicture', 'board.showNext', 'board.takeBack', 'board.more', 'board.less',
        'editLast', 'editCancel', 'startOver', 'keepGoing', 'activityUi.check', 'activityUi.checking', 'activityUi.add', 'activityUi.takeBack',
        'activityUi.moveUp', 'activityUi.moveDown', 'activityUi.place', 'activityUi.less', 'activityUi.more']);
      const OPTIONS = new Set(['continue', 'continueGeneric', 'practise', 'practiseSkill', 'courseTopic', 'diagnostic', 'hint', 'tell', 'yes', 'no',
        'explain', 'finishNow', 'activityUi.true', 'activityUi.false', 'activityUi.yes', 'activityUi.no', 'activityUi.choose']);
      const MENTOR = new Set(['unavailable', 'greeting', 'greetingNamed', 'limit', 'thinking', 'loading']);
      const HEADINGS = new Set(['documentTitle', 'chooser.heading', 'startOverHeading', 'activityUi.heading']);
      const DATA = new Set(['step', 'xp', 'activityUi.inTray', 'activityUi.target', 'activityUi.budget', 'activityUi.total', 'activityUi.gap',
        'activityUi.sliderValue', 'activityUi.placed', 'activityUi.unplaced', 'activityUi.practiceOnly', 'activityUi.left']);
      for (const [path, raw] of flatten(screen as never)) {
        const text = raw.replace('{name}', 'Dr. Rho').replace('{nickname}', 'Ana').replace('{topic}', 'Saving money')
          .replace('{item}', 'Water').replace('{n}', '3').replace('{total}', '10').replace('{amount}', '$17').replace('{price}', '$7')
          .replace('{paid}', '$10').replace('{goal}', '$20').replace('{weekly}', '$5').replace('{value}', '35');
        const role = path.startsWith('board.words.') || path === 'board.item' || path === 'board.value' || path === 'you' || DATA.has(path) ? 'data'
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
      // W2M.3 (T1a, T1e-T1g): the learner's own views, measured for the youngest band (the strictest budgets).
      const learnerViews: Record<string, (path: string) => CopyRole> = {
        mentorPersonalise: (path) => (['menu', 'nicknameSave'].includes(path) ? 'action' : path === 'heading' ? 'heading'
          : path === 'companionNone' || path === 'on' || path === 'off' || path.startsWith('islands.') || path.startsWith('lights.') ? 'option' : 'body'),
        mentorMap: (path) => (['menu', 'retry'].includes(path) ? 'action' : ['heading', 'step'].includes(path) ? 'heading' : 'body'),
        mentorNotebook: (path) => (['menu', 'retry', 'keep', 'keeping', 'keptDone'].includes(path) ? 'action'
          : ['heading', 'lastTime', 'plan', 'kept'].includes(path) ? 'heading' : ['recap', 'recapMinutes', 'planUpdated', 'keptOn'].includes(path) ? 'data' : 'body'),
        mentorHistory: (path) => (['menu', 'retry'].includes(path) ? 'action' : path === 'heading' ? 'heading' : path === 'detail' ? 'data' : 'body'),
        mentorReplay: (path) => (['play', 'pause', 'previous', 'next', 'fromStart', 'talk'].includes(path) ? 'action'
          : ['position', 'note', 'activity'].includes(path) ? 'data' : 'body'),
      };
      for (const [group, roleOf] of Object.entries(learnerViews)) {
        for (const [path, raw] of flatten(strings[group] as never)) {
          const text = raw.replace('{title}', 'Give change by counting up').replace('{what}', 'A lesson topic').replace('{name}', 'Dr. Rho')
            .replace('{n}', '12').replace('{date}', 'Sep 24, 2026').replace('{minutes}', '12').replace('{xp}', '30')
            .replace('{current}', '3').replace('{total}', '12').replace('{score}', '80');
          expectFits(text, roleOf(path), locale, '6-9', `${group}.${path}`);
        }
      }
      // A roleplay beat is shown one caption page at a time, each page within the Mentor's budget for 6-9 (08 §2 layer 3).
      const roleplay = strings.mentorRoleplay as unknown as { customer: string; scenes: Record<string, { title: string; beats: string[] }> };
      for (const [id, scene] of Object.entries(roleplay.scenes)) {
        scene.beats.forEach((beat, index) => {
          for (const page of speechPages(beat, locale, '6-9')) expectFits(page, 'mentor', locale, '6-9', `mentorRoleplay.scenes.${id}.beats.${index}`);
          expect(speechPages(beat, locale, '6-9').join(' ').split(/\s+/u), `no word lost in ${id} beat ${index}`).toEqual(beat.split(/\s+/u));
        });
      }
      // C.2: the microphone permission is read by the verified Tutor (a parent, the adult register); its wording is the stored consent record.
      for (const [path, text] of flatten(strings.mentorVoiceConsent!)) {
        const role = path === 'title' ? 'heading' : ['grant', 'revoke', 'confirm', 'cancel'].includes(path) ? 'action' : path === 'body' ? 'legal' : path === 'forChild' ? 'data' : 'body';
        expectFits(text.replace('{date}', 'Sep 24, 2026').replace('{name}', 'Ana'), role, locale, 'adult', `mentorVoiceConsent.${path}`);
      }
      expect(`${(strings.mentorVoiceConsent as Record<string, string>).body}`, 'the consent names the Mentor, never an AI tutor').toMatch(/Mentor/u);
      // C.7: the profile is read by a teen, an adult or a verified Tutor (13-17 budget, the stricter of the two).
      for (const [path, text] of flatten(strings.mentorProfile!)) {
        const role = path.startsWith('title') ? 'heading' : ['reset', 'resetting'].includes(path) ? 'action' : 'body';
        expectFits(text.replace('{n}', '12'), role, locale, '13-17', `mentorProfile.${path}`);
      }
    });
    // 08 §10 item 2 and OD-6: no string of the Mentor feature calls the Mentor a bot, an assistant or an AI, and none says
    // "Tutor" (the verified parent's word, never the character's).
    it(`never labels the Mentor a bot, an assistant, an AI or a Tutor in ${locale}`, () => {
      for (const [path, text] of flatten(strings as never)) {
        expect(text, path).not.toMatch(/\bbot\b|chatbot|assistant|asistente|assistente|\bAI\b|\bIA\b|\bTutor\b|\btutora?\b/iu);
      }
    });
  }
});
