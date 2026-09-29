import { describe, expect, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { verdictWords } from '../learning/placementOutcome';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-learn.json` (Lane 2): learner home, courses, placement, lessons and results. Youngest (6–9) budget. */

const flat: Record<string, CopyRole> = { lessonInvalid: 'heading', back: 'action' };
/*
 * GAP-FIX-R1 learning: the general v2 player's shared strings (segmentKit.tsx,
 * LessonDocumentView.tsx): the Mentor prompt label and help turn (Bible 08
 * §11), the locale number echo (Appendix P Part 5), the check row, the step
 * counter, and the B.4 update-required screen.
 */
const player: Record<string, CopyRole> = {
  asks: 'body', help: 'action', moreHelp: 'action', closeHelp: 'action', readsAs: 'body', notNumber: 'body', check: 'action', continue: 'action',
  met: 'body', review: 'body', reviewStructure: 'body', reviewAnswer: 'body', unavailable: 'body', step: 'data', progress: 'body',
  viewFailed: 'body', updateTitle: 'heading', updateBody: 'body', reload: 'action', moveTo: 'action', mentorHeading: 'heading',
};

/*
 * W2L.1: the learner home (L1) and the one course screen (L2), each string by
 * the role it is rendered with (LearnHomeView.tsx, CourseView.tsx). `{…}`
 * placeholders are filled with realistic values first: a first name, the
 * longest published course title, two-digit counts.
 */
const home: Record<string, CopyRole> = {
  greeting: 'heading', greetingAnon: 'heading', loading: 'body', errorTitle: 'heading', errorBody: 'body', offlineTitle: 'heading', offlineBody: 'body',
  refusedTitle: 'heading', refusedBody: 'body', retry: 'action', retrying: 'action', emptyTitle: 'heading', emptyBody: 'body', unavailable: 'body',
  nextStep: 'body', continue: 'action', start: 'action', findStart: 'action', openCourse: 'action', review: 'action', explore: 'action',
  placementTitle: 'heading', doneTitle: 'heading', coursesTitle: 'heading', lessonsOne: 'body', lessonsOther: 'body', progress: 'body',
  older: 'body', building: 'body', streakTitle: 'heading', best: 'body', daysOne: 'body', daysOther: 'body', restLeft: 'body',
  rhythm: 'action', storyTitle: 'heading', journal: 'action',
  // L-04 (OD-27 (1)): the goals-together card, shown only to a 13-to-17 participant.
  togetherTitle: 'heading', together: 'action', togetherAsked: 'body',
  // Bible 08 §8 (GAP-FIX-R1): the Mentor home card.
  mentorTitle: 'heading', askMentor: 'action',
};
const course: Record<string, CopyRole> = {
  allCourses: 'action', map: 'action', progress: 'body', loading: 'heading', start: 'action', minutes: 'data',
  placementTitle: 'heading', placementBody: 'body', placementAction: 'action', completeTitle: 'heading', completeBody: 'body', badgeEarned: 'body',
  contentGap: 'body', building: 'body', moreTitle: 'heading', showMore: 'action', showLess: 'action', waiting: 'body', reasons: 'body', extra: 'body',
  skillsTitle: 'heading', shown: 'body', chaptersTitle: 'heading', access: 'body', closedOne: 'body', closedOther: 'body', state: 'body', lesson: 'body',
  best: 'data', lessons: 'action', ageTitle: 'heading', ageBody: 'body', prereqTitle: 'heading', prereqBody: 'body',
  notFoundTitle: 'heading', notFoundBody: 'body', errorTitle: 'heading', errorBody: 'body', offlineTitle: 'heading', offlineBody: 'body',
  refusedTitle: 'heading', refusedBody: 'body', emptyTitle: 'heading', emptyBody: 'body', retry: 'action', retrying: 'action', preview: 'body',
  // W2L.4 (OD-25): the one-stage-early chapter and the Mentor-mastery topic, each a question the learner answers.
  earlyTitle: 'heading', earlyAsk: 'body', earlyYes: 'action', earlyDone: 'body', masteryTitle: 'heading', masteryAsk: 'body',
  masteryYes: 'action', notNow: 'action', masteryDone: 'body', saveFailed: 'body',
  // W3L.1 (OD-25): what each offer means, the skills it rests on, and the recorded "no".
  earlyMeans: 'body', earlyShowed: 'body', earlyMoreOne: 'action', earlyMoreOther: 'action', earlySkillsTitle: 'heading', earlySkillsClose: 'action', masteryMeans: 'body', masteryNo: 'action', masteryDeclined: 'body',
};
/*
 * W2L.2: the course world (L3, TerritoryMapView.tsx) and the placement flow
 * (L4, PlacementFlowView.tsx). The flow's Mentor turns are budgeted as
 * `mentor` (06 §3.1, 12 words for ages 6 to 9); the placeholder and the line
 * sent to Core for Oracle's fallback are budgeted as what they read like.
 */
const territory: Record<string, CopyRole> = {
  course: 'action', title: 'heading', loading: 'heading', progress: 'body', reviewsOne: 'body', reviewsOther: 'body', here: 'body', extra: 'body',
  done: 'body', later: 'body', topics: 'action', topic: 'body', placementTitle: 'heading', placementAction: 'action', closedOne: 'body',
  closedOther: 'body', errorTitle: 'heading', offlineBody: 'body', preview: 'body',
};
const placement: Record<string, CopyRole> = {
  close: 'action', back: 'action', loading: 'heading', welcomeTitle: 'heading', welcomeMentor: 'mentor', start: 'action', fromBeginning: 'action',
  intakeTitle: 'heading', intakeMentor: 'mentor', intakeLabel: 'body', intakePlaceholder: 'body', continue: 'action', reading: 'action',
  askInstead: 'action', neutral: 'mentor', question: 'body', dontKnow: 'option', confirmMentor: 'mentor', stepError: 'body', saveError: 'body',
  offlineError: 'body', retry: 'action', saving: 'action', capped: 'body', adjustTitle: 'heading', adjustMentor: 'mentor',
  adjustEarlier: 'action', adjustKeep: 'action', errorTitle: 'heading', errorBody: 'body', offlineBody: 'body', courses: 'action',
};
/*
 * W2L.3: the lesson layer's document titles and the result's badge and
 * course moments (LessonLayer.tsx, LessonResultView.tsx).
 */
const lesson: Record<string, CopyRole> = { pageTitle: 'heading', resultTitle: 'heading', badgeEarned: 'body', courseComplete: 'body' };
/*
 * L-04 (OD-27 (1)): goals together (TogetherView.tsx). Only a 13-to-17
 * participant reaches it, so it is budgeted in the teen band; the Tutor it
 * names is the verified parent (glossary), never the Mentor.
 */
const together: Record<string, CopyRole> = {
  title: 'heading', intro: 'body', rules: 'body', back: 'action', loading: 'body', errorTitle: 'heading', errorBody: 'body', offlineBody: 'body',
  retry: 'action', retrying: 'action', closedTitle: 'heading', closedBody: 'body', closedHint: 'body', invitationsTitle: 'heading',
  invitedBy: 'body', goalLine: 'heading', withPeople: 'body', join: 'action', decline: 'action', goalsTitle: 'heading', progressLabel: 'body',
  progressValue: 'data', reached: 'body', membersTitle: 'heading', you: 'data', waiting: 'body', invite: 'action', remove: 'action',
  withdraw: 'action', leave: 'action', report: 'action', leaveTitle: 'heading', leaveBody: 'body', leaveYes: 'action', stay: 'action',
  removeTitle: 'heading', removeBody: 'body', removeYes: 'action', newTitle: 'heading', newTarget: 'body', lessonsOption: 'option',
  newDays: 'body', daysOption: 'option', newPeople: 'body', peopleHelp: 'body', noPeople: 'body', start: 'action', starting: 'action',
  cancel: 'action', emptyTitle: 'heading', emptyBody: 'body', finishedTitle: 'heading', finishedLine: 'data', pickPeople: 'body',
  started: 'body', joined: 'body', declined: 'body', left: 'body', removed: 'body', invited: 'body', memberUnavailable: 'body', full: 'body',
  limit: 'body', alreadyAsked: 'body', saveFailed: 'body', reportLeave: 'body', reported: 'body',
};
const DATE = { 'en-US': 'Oct 12', 'es-MX': '12 oct', 'pt-BR': '12 de out.' } as const;

const LONGEST_TITLE = { 'en-US': 'My first lemonade stand', 'es-MX': 'Mi primer puesto de limonada', 'pt-BR': 'Minha primeira barraca de limonada' } as const;
/* OD-25: a realistic chapter and skill title (the longest published ones are catalog content, budgeted in Forge). */
const CHAPTER = { 'en-US': 'The market stall', 'es-MX': 'El puesto del mercado', 'pt-BR': 'A banca da feira' } as const;
const SKILL = { 'en-US': 'Saving toward a goal', 'es-MX': 'Ahorrar para una meta', 'pt-BR': 'Poupar para uma meta' } as const;
const filled = (text: string, locale: keyof typeof LONGEST_TITLE) => text
  .replace('{name}', 'Sofía').replace('{course}', LONGEST_TITLE[locale]).replace('{chapter}', CHAPTER[locale]).replace('{skill}', SKILL[locale])
  .replace('{date}', DATE[locale]).replace('{names}', 'Luz, Río y Sofía').replace('{value}', '1,234.5')
  .replace(/\{(n|passed|total|done|goal)\}/g, '12');

describe('rebuild-learn copy budget', () => {
  for (const [locale, strings] of namespaceCopy('learn')) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expectBudgetedGroups(strings, [...Object.keys(flat), 'home', 'course', 'territory', 'placement', 'lesson', 'together', 'player']);
      for (const [key, role] of Object.entries(flat)) expectFits(strings[key] as string, role, locale, '6-9', key);
      for (const [group, roles] of [['home', home], ['course', course], ['territory', territory], ['placement', placement], ['lesson', lesson], ['player', player]] as const) {
        const entries = flatten(strings[group]!);
        // Exhaustive: every key of the group has a role here, and every role names a key.
        expect(new Set(entries.map(([key]) => key.split('.')[0]))).toEqual(new Set(Object.keys(roles)));
        for (const [key, text] of entries) {
          const role = roles[key.split('.')[0]!]!;
          if (role !== 'data') expectFits(filled(text, locale), role, locale, '6-9', `${group}.${key}`);
          // One design system, one glossary (OD-6, 02 §1.2): the AI is the Mentor, coins are never money, no lives, no em dash.
          expect(text, `${group}.${key}`).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|freeze|congel|—/i);
          // B.15: nothing on the placement or the map reads as a verdict on ability, a rank or a failure.
          if (group === 'placement' || group === 'territory') expect(verdictWords(text, locale), `${group}.${key}`).toEqual([]);
        }
      }
      // L-04: goals together, in the teen band. No rank, score, reward or celebration word; no messaging word (E.10).
      const entries = flatten(strings.together!);
      expect(new Set(entries.map(([key]) => key))).toEqual(new Set(Object.keys(together)));
      for (const [key, text] of entries) {
        const role = together[key]!;
        if (role !== 'data') expectFits(filled(text, locale), role, locale, '13-17', `together.${key}`);
        expect(text, `together.${key}`).not.toMatch(/\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|—|\bcoins?\b|monedas|moedas|\bxp\b|leader|winner|ganador|vencedor|\bmessages?\b|mensaje|mensagem|congrat|felicidades|parabéns/i);
      }
    });
  }
});
