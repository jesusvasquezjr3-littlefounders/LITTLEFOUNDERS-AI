import { describe, expect, it } from 'vitest';
import { nextStreak } from './streak.js';
import {
  REST_DAYS_PER_WEEK,
  dayDifference,
  evaluateStreak,
  lapseCounts,
  milestoneReached,
  resolveLocalToday,
  utcDayOffset,
  type StreakInput,
} from './choreStreak.js';

/*
 * D.2: the chore streak's lapse-tolerant model (Frontend Bible 02 §9.6).
 * 2026-09-07 is a Monday; weeks run Monday to Sunday.
 */

const days = (from: string, count: number, skip: string[] = []) => {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    if (!skip.includes(day)) out.push(day);
  }
  return out;
};

const run = (input: Partial<StreakInput> & { practisedDays: string[]; today: string }) =>
  evaluateStreak({ pauses: [], ...input });

describe('the SPEC "Current State" defect no longer reproduces', () => {
  it('the legacy arithmetic reset a 5-day chore streak to 1 after one missed day', () => {
    // 0080 reused the learning streak's nextStreak(): any gap restarts at 1.
    expect(nextStreak('2026-09-11', 5, '2026-09-13')).toBe(1);
  });

  it('the model keeps the same streak alive through that missed day, using one rest day', () => {
    const { state, lapses } = run({ practisedDays: [...days('2026-09-07', 5), '2026-09-13'], today: '2026-09-13' });
    expect(state).toMatchObject({ status: 'practised_today', current: 6, best: 6, totalDays: 6, restDaysUsedThisWeek: 1, restDaysLeftThisWeek: 1 });
    expect(lapses).toEqual([{ day: '2026-09-12', covered: true }]);
  });
});

describe('rest days', () => {
  it('gives exactly two free rest days a week; the third miss rests the streak, never erasing the best or the total', () => {
    const practised = days('2026-09-07', 4); // Mon-Thu
    const alive = run({ practisedDays: practised, today: '2026-09-13' }); // Fri, Sat missed; Sun is today
    expect(alive.state).toMatchObject({ status: 'alive', current: 4, restDaysLeftThisWeek: 0 });
    const rested = run({ practisedDays: practised, today: '2026-09-14' }); // Sun missed too: a third miss
    expect(rested.state).toMatchObject({ status: 'resting', current: 0, best: 4, totalDays: 4 });
    expect(rested.lapses.map((l) => l.covered)).toEqual([true, true, false]);
  });

  it('renews the allowance each Monday', () => {
    // Sat+Sun missed (week 1), then Mon+Tue missed (week 2): four misses, never three in one week.
    const practised = [...days('2026-09-07', 5), '2026-09-16'];
    const { state } = run({ practisedDays: practised, today: '2026-09-16' });
    expect(state).toMatchObject({ status: 'practised_today', current: 6, restDaysUsedThisWeek: 2 });
  });

  it('never counts a rest day toward the streak number (no padding toward a milestone)', () => {
    const practised = days('2026-09-07', 14, ['2026-09-12', '2026-09-13', '2026-09-19', '2026-09-20']);
    const { state } = run({ practisedDays: practised, today: '2026-09-20' });
    expect(state.current).toBe(10);
  });

  it('never treats today as a miss', () => {
    const { state, lapses } = run({ practisedDays: ['2026-09-07'], today: '2026-09-08' });
    expect(state).toMatchObject({ status: 'alive', current: 1, restDaysLeftThisWeek: REST_DAYS_PER_WEEK });
    expect(lapses).toEqual([]);
  });

  it('starts a new run after resting, keeping the best', () => {
    const practised = [...days('2026-09-07', 3), '2026-09-20', '2026-09-21'];
    const { state } = run({ practisedDays: practised, today: '2026-09-21' });
    expect(state).toMatchObject({ status: 'practised_today', current: 2, best: 3, totalDays: 5 });
  });
});

describe('a Tutor holiday pause', () => {
  it('makes paused days neutral: no rest day used, no break, no count', () => {
    const practised = [...days('2026-09-07', 3), '2026-09-21'];
    const pauses = [{ startsOn: '2026-09-10', endsOn: '2026-09-20' }];
    const { state, lapses } = run({ practisedDays: practised, pauses, today: '2026-09-21' });
    expect(state).toMatchObject({ status: 'practised_today', current: 4, restDaysUsedThisWeek: 0 });
    expect(lapses).toEqual([]);
    const without = run({ practisedDays: practised, today: '2026-09-21' });
    expect(without.state.current).toBe(1);
  });

  it('reports a pause covering today', () => {
    const { state } = run({ practisedDays: ['2026-09-07'], pauses: [{ startsOn: '2026-09-08', endsOn: '2026-09-12' }], today: '2026-09-10' });
    expect(state).toMatchObject({ status: 'alive', pausedToday: true, current: 1 });
  });
});

describe('permanent stats and inputs', () => {
  it('keeps a legacy best as the floor', () => {
    const { state } = run({ practisedDays: ['2026-09-07'], today: '2026-09-07', legacyBest: 12 });
    expect(state).toMatchObject({ current: 1, best: 12 });
  });

  it('reports none for a child who never practised', () => {
    expect(run({ practisedDays: [], today: '2026-09-07' }).state).toMatchObject({ status: 'none', current: 0, best: 0, totalDays: 0, lastPractisedDay: null });
  });

  it('ignores duplicates and malformed days, and treats a practised day ahead of today as today', () => {
    const { state } = run({ practisedDays: ['2026-09-07', '2026-09-07', 'nope', '2026-02-30', '2026-09-08'], today: '2026-09-07' });
    expect(state).toMatchObject({ status: 'practised_today', current: 2, totalDays: 2, lastPractisedDay: '2026-09-08' });
  });

  it('refuses a malformed today', () => {
    expect(() => run({ practisedDays: [], today: '09/07/2026' })).toThrow(RangeError);
  });
});

describe('milestones (OD-7: only 7, 30 and 100 celebrate)', () => {
  const at = (n: number) => days('2026-01-01', n);
  const lastOf = (list: string[]) => list[list.length - 1]!;

  it.each([7, 30, 100])('celebrates the first chore of the day that reaches %i', (n) => {
    const reached = at(n);
    const before = run({ practisedDays: reached.slice(0, -1), today: lastOf(reached) }).state;
    const after = run({ practisedDays: reached, today: lastOf(reached) }).state;
    expect(milestoneReached(before, after, true)).toBe(`streak-${n}`);
  });

  it.each([1, 2, 6, 8, 29, 31, 99, 101])('never celebrates an ordinary day (%i)', (n) => {
    const reached = at(n);
    const before = run({ practisedDays: reached.slice(0, -1), today: lastOf(reached) }).state;
    const after = run({ practisedDays: reached, today: lastOf(reached) }).state;
    expect(milestoneReached(before, after, true)).toBeNull();
  });

  it('never celebrates a second chore on the milestone day', () => {
    const reached = at(7);
    const state = run({ practisedDays: reached, today: lastOf(reached) }).state;
    expect(milestoneReached(state, state, false)).toBeNull();
  });
});

describe('local today and metric helpers', () => {
  const now = new Date('2026-09-24T12:00:00Z');

  it('accepts a local day within one day of the server day, otherwise uses the server day', () => {
    expect(resolveLocalToday('2026-09-25', now)).toBe('2026-09-25');
    expect(resolveLocalToday('2026-09-23', now)).toBe('2026-09-23');
    expect(resolveLocalToday('2026-09-26', now)).toBe('2026-09-24');
    expect(resolveLocalToday('2026-09-21', now)).toBe('2026-09-24');
    expect(resolveLocalToday(undefined, now)).toBe('2026-09-24');
    expect(resolveLocalToday('garbage', now)).toBe('2026-09-24');
  });

  it('shifts and compares days', () => {
    expect(utcDayOffset(-7, now)).toBe('2026-09-17');
    expect(dayDifference('2026-09-01', '2026-09-21')).toBe(20);
  });

  it('counts covered and run-ending misses inside the window', () => {
    const { lapses } = run({ practisedDays: days('2026-09-07', 4), today: '2026-09-15' });
    expect(lapseCounts(lapses, '2026-09-01')).toEqual({ covered: 2, ended: 1 });
    expect(lapseCounts(lapses, '2026-09-13')).toEqual({ covered: 0, ended: 1 });
  });
});
