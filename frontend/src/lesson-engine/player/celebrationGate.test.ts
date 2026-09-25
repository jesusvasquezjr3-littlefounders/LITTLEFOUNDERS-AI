import { describe, expect, it } from 'vitest'
import { streakCelebrationFor, type ServerCompletion } from './completion'

/*
 * B.20 / OD-7 (S05.3e): the live lesson player's streak takeover is gated by
 * the milestone list. The static scan of every celebration effect lives in
 * rebuild/design/celebrationBudget.test.ts.
 */
describe('streakCelebrationFor', () => {
  it('the live lesson player\'s streak takeover needs Core\'s milestone AND Core\'s list', () => {
    const base: ServerCompletion = {
      score: 100, passed: true, best_score: 100, xp_earned: 20, xp_delta: 20, streak_days: 7, longest_streak: 7,
      streak_extended: true, first_today: true, minutes_learned: 5, lessons_completed: 3, next_lesson_id: null,
    };
    const streak = (milestone: 7 | 30 | 100 | null) => ({ outcome: 'extended', milestone, rest_days_bridged: 0, rest_days_left: 2 });
    expect(streakCelebrationFor({ ...base, streak: streak(7), celebrations: ['lesson-complete', 'streak-7'] })).toBe('streak-7');
    // An ordinary extended day (the old trigger: streak_extended && first_today) no longer celebrates.
    expect(streakCelebrationFor({ ...base, streak_days: 8, streak: streak(null), celebrations: ['lesson-complete'] })).toBeNull();
    // An older Core with neither field: fail closed.
    expect(streakCelebrationFor(base)).toBeNull();
    // A milestone Core did not name, or a failed run: nothing.
    expect(streakCelebrationFor({ ...base, streak: streak(7), celebrations: ['lesson-complete'] })).toBeNull();
    expect(streakCelebrationFor({ ...base, passed: false, streak: streak(7), celebrations: ['streak-7'] })).toBeNull();
  });
})
