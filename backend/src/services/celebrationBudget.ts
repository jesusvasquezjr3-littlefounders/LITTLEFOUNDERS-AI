import type { CompletionStreak } from './supabaseRest.js';

/*
 * THE CELEBRATION BUDGET (B.20, OD-7; Frontend Bible 02 D7 and rule 17).
 *
 * Celebration effects (confetti, floating XP or coin amounts, spring
 * overshoot) are reserved for a CLOSED list of milestones. Core decides which
 * of them a completion reached and says so in the response (`celebrations`);
 * the client celebrates only what is on that list, and its own gate
 * (frontend/src/rebuild/design/milestones.ts) refuses anything else. A correct
 * answer, a coin split, an ordinary practised day or a routine press is never
 * on the list. The same identifiers are used on both sides.
 */
export const CELEBRATION_MILESTONES = [
  'lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100',
] as const;
export type CelebrationMilestone = (typeof CELEBRATION_MILESTONES)[number];

export function isCelebrationMilestone(value: string): value is CelebrationMilestone {
  return (CELEBRATION_MILESTONES as readonly string[]).includes(value);
}

/**
 * The milestones a lesson completion reached, in display order. Only a pass
 * can reach any of them; a failed run celebrates nothing.
 */
export function completionCelebrations(input: {
  passed: boolean;
  streak?: Pick<CompletionStreak, 'milestone'> | null;
  courseCompleted: boolean;
  badgeEarned: boolean;
}): CelebrationMilestone[] {
  if (!input.passed) return [];
  const out: CelebrationMilestone[] = ['lesson-complete'];
  if (input.courseCompleted) out.push('course-complete');
  if (input.badgeEarned) out.push('badge-earned');
  const milestone = input.streak?.milestone ?? null;
  if (milestone !== null) out.push(`streak-${milestone}`);
  return out;
}

/** Progress shapes the course tree carries (courseTree.ts ProgressShape and the pathway view). */
interface ProgressLike { passed: number; total: number }
interface TreeLike {
  course: { progress: ProgressLike };
  pathway?: { progress: ProgressLike & { complete: boolean }; badge: { earnedStages: readonly string[]; eligible: boolean } };
}

function complete(tree: TreeLike): boolean {
  if (tree.pathway) return tree.pathway.progress.complete;
  return tree.course.progress.total > 0 && tree.course.progress.passed >= tree.course.progress.total;
}

/** A course completes on THIS completion only when it was not complete before it. */
export function courseCompletedNow(before: TreeLike, after: TreeLike | null): boolean {
  return after !== null && !complete(before) && complete(after);
}

/**
 * A badge is earned on this completion when it was not held before. Pathway
 * mode: a stage badge newly eligible and not already stored. Linear mode: the
 * course badge is the completed course itself (the badge RPC derives it).
 */
export function badgeEarnedNow(before: TreeLike, after: TreeLike | null): boolean {
  if (!after) return false;
  if (after.pathway && before.pathway) {
    const newlyEligible = after.pathway.badge.eligible && !before.pathway.badge.eligible;
    const newlyStored = after.pathway.badge.earnedStages.some((stage) => !before.pathway!.badge.earnedStages.includes(stage));
    return newlyEligible || newlyStored;
  }
  return courseCompletedNow(before, after);
}
