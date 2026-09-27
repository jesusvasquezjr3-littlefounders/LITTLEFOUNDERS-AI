import { describe, expect, it } from 'vitest';
import { SELF_GOAL_DEFAULTS, selfGoalDetails } from './familyBridge.js';
import { tutorSeesChoices, type TutorChoicesInput } from './tutorChoices.js';

/*
 * L-13 (OD-27 (3)): which learners' story choices the verified Tutor sees, and
 * L-12 (OD-28): the teen's own goal defaults. Pure rules; the route boundary
 * is attacked in src/__tests__/learnNarrative.test.ts.
 */

const NOW = new Date('2026-09-26T12:00:00.000Z');
const under13 = { ageBand: 'under_13' as const, protectedOrigin: false };
const teen = { ageBand: '13_to_17' as const, protectedOrigin: false };
const input = (over: Partial<TutorChoicesInput>): TutorChoicesInput => ({ roles: ['kid'], birthDate: null, age: under13, ...over });

describe('L-13: the verified Tutor sees story choices only for a parent-created child under 13', () => {
  it.each([
    ['parent-created child of 7 by birth date', input({ birthDate: '2019-05-05' }), true],
    ['parent-created child the day before turning 13', input({ birthDate: '2013-09-27' }), true],
    ['parent-created child on the 13th birthday', input({ birthDate: '2013-09-26' }), false],
    ['parent-created child of 15 by birth date, even with an under-13 screen', input({ birthDate: '2011-01-01', age: under13 }), false],
    ['parent-created child, no birth date, under-13 age screen', input({ birthDate: null, age: under13 }), true],
    ['parent-created child, no birth date, under-13 origin marker', input({ birthDate: null, age: { ageBand: '13_to_17', protectedOrigin: true } }), true],
    ['parent-created child, no birth date, teen age screen', input({ birthDate: null, age: teen }), false],
    ['parent-created child with no age evidence at all', input({ birthDate: null, age: { ageBand: null, protectedOrigin: false } }), false],
    ['parent-created child whose age screen was not read', input({ birthDate: null, age: null }), false],
    ['an invalid birth date falls back to the age screen', input({ birthDate: '2019-02-30', age: teen }), false],
    ['self-registered child under 13 (no kid role), even with a Tutor', input({ roles: [], birthDate: '2019-05-05' }), false],
    ['self-registered teen', input({ roles: [], birthDate: '2011-05-05', age: teen }), false],
    ['a parent account', input({ roles: ['parent'], birthDate: '1985-05-05', age: { ageBand: 'adult', protectedOrigin: false } }), false],
  ])('%s', (_label, value, expected) => {
    expect(tutorSeesChoices(value, NOW)).toBe(expected);
  });
});

describe('L-12: the teen\'s own goal when "I will try" arrives without details', () => {
  it('uses a generic label in the teen\'s locale, a documented target and the form\'s default icon', () => {
    expect(selfGoalDetails({}, 'en-US')).toEqual({ title: 'My savings goal', target: 100, icon: 'star' });
    expect(selfGoalDetails({}, 'es-MX').title).toBe('Mi meta de ahorro');
    expect(selfGoalDetails({}, 'pt-BR').title).toBe('Minha meta de poupança');
    expect(selfGoalDetails({ title: 'Bike', target: 250, icon: 'bike' }, 'es-MX')).toEqual({ title: 'Bike', target: 250, icon: 'bike' });
  });

  it('every default fits the goal form and the database limits', () => {
    for (const title of Object.values(SELF_GOAL_DEFAULTS.title)) expect(title.length >= 1 && title.length <= 80 && title === title.trim()).toBe(true);
    expect(SELF_GOAL_DEFAULTS.target >= 1 && SELF_GOAL_DEFAULTS.target <= 100000).toBe(true);
  });
});
