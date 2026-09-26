import { describe, expect, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { expectBudgetedGroups, expectFits, flatten, namespaceCopy } from './budget';

/* `rebuild-learn.json` (Lane 2): learner home, courses, placement, lessons and results. Youngest (6–9) budget. */

const flat: Record<string, CopyRole> = { lessonUnavailable: 'heading', lessonInvalid: 'heading', back: 'action' };

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
};
const course: Record<string, CopyRole> = {
  allCourses: 'action', map: 'action', progress: 'body', loading: 'heading', start: 'action', minutes: 'data',
  placementTitle: 'heading', placementBody: 'body', placementAction: 'action', completeTitle: 'heading', completeBody: 'body', badgeEarned: 'body',
  contentGap: 'body', building: 'body', moreTitle: 'heading', showMore: 'action', showLess: 'action', waiting: 'body', reasons: 'body', extra: 'body',
  skillsTitle: 'heading', shown: 'body', chaptersTitle: 'heading', access: 'body', closedOne: 'body', closedOther: 'body', state: 'body', lesson: 'body',
  best: 'data', lessons: 'action', ageTitle: 'heading', ageBody: 'body', prereqTitle: 'heading', prereqBody: 'body',
  notFoundTitle: 'heading', notFoundBody: 'body', errorTitle: 'heading', errorBody: 'body', offlineTitle: 'heading', offlineBody: 'body',
  refusedTitle: 'heading', refusedBody: 'body', emptyTitle: 'heading', emptyBody: 'body', retry: 'action', retrying: 'action', preview: 'body',
};

const LONGEST_TITLE = { 'en-US': 'My first lemonade stand', 'es-MX': 'Mi primer puesto de limonada', 'pt-BR': 'Minha primeira barraca de limonada' } as const;
const filled = (text: string, locale: keyof typeof LONGEST_TITLE) => text
  .replace('{name}', 'Sofía').replace('{course}', LONGEST_TITLE[locale])
  .replace(/\{(n|passed|total|done|goal)\}/g, '12');

describe('rebuild-learn copy budget', () => {
  for (const [locale, strings] of namespaceCopy('learn')) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expectBudgetedGroups(strings, [...Object.keys(flat), 'home', 'course']);
      for (const [key, role] of Object.entries(flat)) expectFits(strings[key] as string, role, locale, '6-9', key);
      for (const [group, roles] of [['home', home], ['course', course]] as const) {
        const entries = flatten(strings[group]!);
        // Exhaustive: every key of the group has a role here, and every role names a key.
        expect(new Set(entries.map(([key]) => key.split('.')[0]))).toEqual(new Set(Object.keys(roles)));
        for (const [key, text] of entries) {
          const role = roles[key.split('.')[0]!]!;
          if (role !== 'data') expectFits(filled(text, locale), role, locale, '6-9', `${group}.${key}`);
          // One design system, one glossary (OD-6, 02 §1.2): the AI is the Mentor, coins are never money, no lives, no em dash.
          expect(text, `${group}.${key}`).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|freeze|congel|—/i);
        }
      }
    });
  }
});
