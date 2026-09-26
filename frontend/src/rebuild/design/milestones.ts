/*
 * OD-7 is a closed list (Frontend Bible 02 D7 and rule 17; Product 10 B.20).
 * Celebration effects (confetti, floating XP or coin amounts, spring overshoot,
 * the streak flame takeover) fire ONLY for these milestones. A correct answer,
 * a coin split, an ordinary practised day, reaching one's own daily pace or a
 * routine press cannot celebrate.
 *
 * This module is the only gate. Every celebration effect in the frontend is
 * registered in `celebrationBudget.test.ts`, which scans the source and fails
 * when an effect appears anywhere that does not decide through one of the
 * functions below. Core names the milestones a completion reached
 * (`celebrations`, backend/src/services/celebrationBudget.ts, same
 * identifiers); the client never infers one on its own except by crossing a
 * streak mark it can see (`crossedStreakMilestone`).
 */
export type Milestone = 'lesson-complete' | 'course-complete' | 'savings-goal-reached' | 'badge-earned' | 'streak-7' | 'streak-30' | 'streak-100';
export const MILESTONES: readonly Milestone[] = [
  'lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100',
];
const milestones = new Set<string>(MILESTONES);
export const STREAK_MILESTONE_DAYS = [7, 30, 100] as const;

export function isMilestone(event: string): event is Milestone {
  return milestones.has(event);
}

/** The server's `celebrations`, reduced to the closed list. Anything else, or a malformed value, celebrates nothing. */
export function celebrationsFrom(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((value): value is Milestone => typeof value === 'string' && isMilestone(value)))];
}

/** True only when the server's list names this milestone. */
export function mayCelebrate(raw: unknown, milestone: Milestone): boolean {
  return celebrationsFrom(raw).includes(milestone);
}

/** The streak milestone for exactly this many days, or null (8, 29 and 101 are ordinary days). */
export function streakMilestone(days: number): Milestone | null {
  return days === 7 ? 'streak-7' : days === 30 ? 'streak-30' : days === 100 ? 'streak-100' : null;
}

/**
 * The highest streak milestone crossed between two observed streak values
 * (e.g. the value the learner last saw and the value now), or null. Used where
 * no server list exists yet (the legacy Mentor's streak pill): an increase that
 * crosses no mark is an ordinary day and does not celebrate.
 */
export function crossedStreakMilestone(previous: number | null, current: number): Milestone | null {
  if (previous === null || !(current > previous)) return null;
  const crossed = STREAK_MILESTONE_DAYS.filter((mark) => previous < mark && current >= mark);
  const top = crossed[crossed.length - 1];
  return top === undefined ? null : streakMilestone(top);
}
