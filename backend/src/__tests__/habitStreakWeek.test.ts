import { describe, expect, it } from 'vitest';
import { streakWeek } from '../services/habitStreak.js';

/* GAP-FIX-R1 learning (Bible 02 §9.6 rules 4-5, 04 §4.3): the weekly strip's day states. */

const TODAY = '2026-09-24'; // a Thursday
const day = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

describe('the weekly streak strip', () => {
  it('shows practised days, rest days bridged by a live run, today and open days ahead', () => {
    const week = streakWeek({ status: 'open', current: 9, lastActiveDate: '2026-09-23' }, TODAY, new Set(['2026-09-21', '2026-09-23']));
    expect(week.map((d) => d.date)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
    expect(week.map((d) => d.state)).toEqual(['practiced', 'rest', 'practiced', 'today', 'open', 'open', 'open']);
  });

  it('marks a practised today as practised, a paused day as paused, and a gap without a live run as open', () => {
    const practised = streakWeek({ status: 'practiced_today', current: 1, lastActiveDate: TODAY }, TODAY, new Set([TODAY]), new Set([day('2026-09-22')]));
    expect(practised.map((d) => d.state)).toEqual(['open', 'paused', 'open', 'practiced', 'open', 'open', 'open']);
    const resting = streakWeek({ status: 'resting', current: 0, lastActiveDate: '2026-09-15' }, TODAY, new Set());
    expect(resting.map((d) => d.state)).toEqual(['open', 'open', 'open', 'today', 'open', 'open', 'open']);
  });
});
