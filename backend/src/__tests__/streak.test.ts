import { describe, expect, it } from 'vitest';
import { isCalendarDate, isFirstActivityToday, nextStreak } from '../services/streak.js';

const TODAY = '2026-07-12';

describe('nextStreak (calendar-date anchored, 0009)', () => {
  it('first pass ever (no anchor) starts the streak at 1', () => {
    expect(nextStreak(null, 0, TODAY)).toBe(1);
  });

  it('increments when the last pass was exactly yesterday', () => {
    expect(nextStreak('2026-07-11', 3, TODAY)).toBe(4);
  });

  it('REGRESSION (2026-07-13 live bug): many lessons on the SAME day never grow the streak past that day', () => {
    // First pass of the day extends...
    const afterFirst = nextStreak('2026-07-11', 3, TODAY);
    expect(afterFirst).toBe(4);
    // ...every further lesson that day keeps it flat — the old updated_at
    // proxy froze, so every completion read "yesterday" and did +1 per lesson.
    expect(nextStreak(TODAY, afterFirst, TODAY)).toBe(4);
    expect(nextStreak(TODAY, afterFirst, TODAY)).toBe(4);
  });

  it('same-day pass with a zeroed streak still counts as day 1', () => {
    expect(nextStreak(TODAY, 0, TODAY)).toBe(1);
  });

  it('resets to 1 after a gap of more than one day', () => {
    expect(nextStreak('2026-07-09', 5, TODAY)).toBe(1);
  });

  it('resets to 1 on backwards clock skew (anchor in the future)', () => {
    expect(nextStreak('2026-07-14', 5, TODAY)).toBe(1);
  });

  it('handles month/year boundaries as real calendar days', () => {
    expect(nextStreak('2026-06-30', 2, '2026-07-01')).toBe(3);
    expect(nextStreak('2025-12-31', 9, '2026-01-01')).toBe(10);
  });
});

describe('isFirstActivityToday', () => {
  it('true with no anchor, true on a new day, false once passed today', () => {
    expect(isFirstActivityToday(null, TODAY)).toBe(true);
    expect(isFirstActivityToday('2026-07-11', TODAY)).toBe(true);
    expect(isFirstActivityToday(TODAY, TODAY)).toBe(false);
  });
});

describe('isCalendarDate', () => {
  it('rejects normalized impossible dates while accepting leap days', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
  });
  it('accepts YYYY-MM-DD and rejects everything else', () => {
    expect(isCalendarDate('2026-07-12')).toBe(true);
    expect(isCalendarDate('2026-7-12')).toBe(false);
    expect(isCalendarDate('12/07/2026')).toBe(false);
    expect(isCalendarDate('2026-13-40')).toBe(false);
    expect(isCalendarDate('not-a-date')).toBe(false);
  });
});
