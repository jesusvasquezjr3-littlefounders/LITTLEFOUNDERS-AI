import { describe, expect, it } from 'vitest';
import { nextStreak } from '../services/streak.js';

const NOW = new Date('2026-07-12T18:00:00.000Z');

describe('nextStreak', () => {
  it('increments when the last update was yesterday', () => {
    expect(nextStreak('2026-07-11T09:00:00.000Z', 3, NOW)).toBe(4);
  });

  it('does not double-increment when already updated today', () => {
    expect(nextStreak('2026-07-12T08:00:00.000Z', 3, NOW)).toBe(3);
  });

  it('starts a first-ever streak at 1, even if the row was created today with streak_days=0', () => {
    expect(nextStreak('2026-07-12T00:00:01.000Z', 0, NOW)).toBe(1);
  });

  it('resets to 1 after a gap of more than a day', () => {
    expect(nextStreak('2026-07-09T09:00:00.000Z', 5, NOW)).toBe(1);
  });
});
