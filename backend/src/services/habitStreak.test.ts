import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HABIT_STREAK_MODEL, REST_DAYS_PER_WEEK, STREAK_MILESTONES, addDays, advanceHabitStreak, habitStateFromStats,
  pauseRangeRefusal, pausedDays, readHabitStreak, type HabitStreakState,
} from './habitStreak.js';

/*
 * B.21 (S05.3e): the shared vectors are the contract between this module and
 * the SQL function habit_streak_advance (database/scripts/test-habit-streak.sql
 * runs the same file in PostgreSQL). A change to either implementation that
 * is not a change to the vectors fails here or there.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const vectorsPath = path.resolve(here, '../../../database/scripts/habit-streak-vectors.json');
interface Pause { startsOn: string; endsOn: string }
interface Vectors {
  model: string;
  advance: Array<{ name: string; state: HabitStreakState; today: string; pauses: Pause[]; expect: Record<string, unknown> }>;
  read: Array<{ name: string; state: HabitStreakState; today: string; pauses: Pause[]; expect: Record<string, unknown> }>;
}
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8')) as Vectors;

describe('habit streak model: shared vectors', () => {
  it('names the same model as the vectors', () => {
    expect(vectors.model).toBe(HABIT_STREAK_MODEL);
    expect(vectors.advance.length).toBeGreaterThanOrEqual(20);
  });

  for (const vector of vectors.advance) {
    it(`advance: ${vector.name}`, () => {
      const result = advanceHabitStreak(vector.state, vector.today, pausedDays(vector.pauses));
      expect({ ...result.state, outcome: result.outcome, restDaysBridged: result.restDaysBridged, milestone: result.milestone }).toEqual(vector.expect);
    });
  }

  for (const vector of vectors.read) {
    it(`read: ${vector.name}`, () => {
      const view = readHabitStreak(vector.state, vector.today, pausedDays(vector.pauses));
      expect({ status: view.status, current: view.current, best: view.best, restDaysLeft: view.restDaysLeft }).toEqual(vector.expect);
    });
  }
});

describe('habit streak model: properties', () => {
  const start: HabitStreakState = { current: 0, best: 0, lastActiveDate: null, restDaysUsed: 0, daysPracticed: 0 };

  it('never lowers the best or the days practised, whatever the practice pattern', () => {
    // A deterministic pseudo-random walk (no Math.random: B.22's own gate forbids it near rewards).
    let seed = 7;
    const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let state = start;
    let day = '2026-01-05';
    for (let i = 0; i < 2000; i += 1) {
      day = addDays(day, 1 + Math.floor(next() * 4));
      const advanced = advanceHabitStreak(state, day).state;
      expect(advanced.best).toBeGreaterThanOrEqual(state.best);
      expect(advanced.daysPracticed).toBe(state.daysPracticed + 1);
      expect(advanced.best).toBeGreaterThanOrEqual(advanced.current);
      expect(advanced.restDaysUsed).toBeLessThanOrEqual(REST_DAYS_PER_WEEK);
      state = advanced;
    }
  });

  it('keeps a five-days-a-week learner on one unbroken run (Lally: habits tolerate lapses)', () => {
    let state = start;
    let day = '2026-09-21'; // Monday
    for (let week = 0; week < 20; week += 1) {
      for (let weekday = 0; weekday < 5; weekday += 1) state = advanceHabitStreak(state, addDays(day, weekday)).state;
      day = addDays(day, 7);
    }
    expect(state.current).toBe(100);
    expect(state.best).toBe(100);
  });

  it('only 7, 30 and 100 are milestones, each reached exactly once on a daily run', () => {
    let state = start;
    const reached: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const result = advanceHabitStreak(state, addDays('2026-01-01', i));
      if (result.milestone !== null) reached.push(result.milestone);
      state = result.state;
    }
    expect(reached).toEqual([...STREAK_MILESTONES]);
  });

  it('a read never changes the stored state', () => {
    const state: HabitStreakState = { current: 4, best: 9, lastActiveDate: '2026-09-21', restDaysUsed: 0, daysPracticed: 30 };
    const copy = { ...state };
    readHabitStreak(state, '2026-10-30');
    expect(state).toEqual(copy);
  });

  it('reads a pre-migration stats row with the migration defaults', () => {
    expect(habitStateFromStats({ streak_days: 5, longest_streak: 3, last_active_date: '2026-09-20' }))
      .toEqual({ current: 5, best: 5, lastActiveDate: '2026-09-20', restDaysUsed: 0, daysPracticed: 0 });
  });
});

describe('guardian holiday pause ranges', () => {
  const today = '2026-09-24';
  it('accepts up to 21 days, a week back and two months ahead', () => {
    expect(pauseRangeRefusal('2026-09-24', '2026-10-14', today)).toBeNull();
    expect(pauseRangeRefusal('2026-09-17', '2026-09-20', today)).toBeNull();
    expect(pauseRangeRefusal('2026-11-23', '2026-11-30', today)).toBeNull();
  });
  it('refuses a reversed, too long, too old or too distant range', () => {
    expect(pauseRangeRefusal('2026-09-30', '2026-09-29', today)).toBe('order');
    expect(pauseRangeRefusal('2026-09-24', '2026-10-15', today)).toBe('too_long');
    expect(pauseRangeRefusal('2026-09-16', '2026-09-20', today)).toBe('too_early');
    expect(pauseRangeRefusal('2026-11-24', '2026-11-30', today)).toBe('too_far');
  });
});
