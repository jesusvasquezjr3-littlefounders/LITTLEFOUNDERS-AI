/**
 * streakUtils.ts
 *
 * The 3 visual states of a daily streak:
 *
 *  'zero'     — Streak = 0.  Either never started or missed 2+ days.
 *               Flame: gray   Number: 0
 *
 *  'inactive' — Had activity YESTERDAY, but none today yet. Streak is
 *               "sleeping" — the user still has until 11:59 PM to save it.
 *               Flame: gray   Number: current streak value (e.g. 365)
 *
 *  'active'   — Already completed an activity TODAY. Streak is "on fire".
 *               The celebration animation fires only once per day (on
 *               the first completion that transitions inactive → active).
 *               Flame: colored  Number: current streak value
 */

export type StreakState = 'zero' | 'inactive' | 'active';

/**
 * Compute the visual streak state from stored values.
 *
 * Uses the user's LOCAL calendar date (via `toLocaleDateString('sv')`)
 * to avoid UTC midnight boundary bugs.
 *
 * @param currentStreak  Value stored in DB / localStorage.
 * @param lastActivityDate  YYYY-MM-DD string of the last day with activity
 *                          (the user's LOCAL date at time of last completion).
 */
export function getStreakState(
    currentStreak: number,
    lastActivityDate: string | null | undefined
): StreakState {
    if (!lastActivityDate || currentStreak === 0) return 'zero';

    const today = new Date().toLocaleDateString('sv');                          // e.g. "2026-04-14"
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv'); // e.g. "2026-04-13"

    if (lastActivityDate === today) return 'active';
    if (lastActivityDate === yesterday) return 'inactive';
    return 'zero'; // missed 2+ days
}

/**
 * The number to actually display next to the flame icon.
 * 'zero' always shows 0 even if the DB still holds a stale value.
 * 'inactive' / 'active' show the real streak number.
 */
export function getDisplayStreak(
    currentStreak: number,
    state: StreakState
): number {
    return state === 'zero' ? 0 : currentStreak;
}
