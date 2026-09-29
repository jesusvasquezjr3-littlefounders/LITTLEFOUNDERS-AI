import type { PathwayView } from './pathway/coursePathway.js';
import { binaryFrontier } from './pathway/coursePathProjection.js';
import { autonomyOffer, type LearnerRegister } from './learnerRegisterPolicy.js';

/*
 * B.24 (S05.3e): the learner's real autonomy levers.
 *
 * Sailer et al. (2017, Appendix B §3.5) found that avatar customization does
 * not measurably serve the autonomy need; real choice over path, approach or
 * pace does. So the product's autonomy levers are exactly these three, each a
 * choice the SERVER honours, never a cosmetic:
 *
 *   path    which lesson to take next from the course path's frontier (B.6).
 *           Core serves every lesson the learner may start now and marks one
 *           as the recommendation; opening any other is a real choice, and
 *           the lesson gate accepts it.
 *   mentor  which of the four Mentor characters teaches (tutor_preferences).
 *           It changes the character on every lesson's Mentor stage and in
 *           the live Mentor (a relatedness choice as well, and the learner's).
 *   pace    how many lessons a day is the learner's own plan (1, 2 or 3). Core
 *           counts passed lessons per local day and tells the learner when
 *           today's plan is done: a natural stopping point they chose.
 *
 * Avatar customization is deliberately NOT in this list and must never be
 * counted toward autonomy support in a design review (B.24; the policy's
 * design-review checklist). The Appendix C adoption metric
 * (learning_autonomy_adoption) reports these three levers only.
 */
/*
 * GAP-FIX-R5 (Product 10 Block B "Age-band registers", autonomy column; B.24):
 * two more levers, offered by register (learnerRegisterPolicy.AUTONOMY_OFFERS,
 * read from REGISTERS[register].autonomy):
 *   approach    which of two or three equally valid, fully graded strategies
 *               to practise (a v2 document's `approaches`), from 10;
 *   enrichment  optional depth lessons on the course path, never required,
 *               for 13-17 and adults.
 * And the path lever narrows to a binary pick of two recommended next topics
 * for 6-9 (the young register's 'topic' mechanism).
 */
export const AUTONOMY_LEVERS = ['path', 'approach', 'enrichment', 'mentor', 'pace'] as const;
export type AutonomyLever = (typeof AUTONOMY_LEVERS)[number];

/**
 * The levers a register offers, in registry order (REGISTERS[register].autonomy
 * through AUTONOMY_OFFERS): path, Mentor and pace for every band (path is the
 * binary pick for 6-9), approach from 10-12, enrichment for 13-17 and adults.
 */
export function offeredLevers(register: LearnerRegister): AutonomyLever[] {
  const offer = autonomyOffer(register);
  return AUTONOMY_LEVERS.filter((lever) => (lever === 'approach' || lever === 'enrichment' ? offer[lever] : true));
}

/** Personalization that is NOT an autonomy lever. Listed so a review can check it is never counted. */
export const COSMETIC_PERSONALIZATION = ['avatar', 'nickname', 'backdrop'] as const;

export const PACE_GOALS = [1, 2, 3] as const;
export type PaceGoal = (typeof PACE_GOALS)[number];
/** The default before a learner chooses: the smallest plan, which habit research favours for a start. A proposal. */
export const DEFAULT_DAILY_LESSON_GOAL: PaceGoal = 1;

export interface PaceStatus {
  goal: PaceGoal;
  /** False until the learner has chosen a pace themselves. */
  chosen: boolean;
  passedToday: number;
  goalMet: boolean;
}

export function paceStatus(preference: { daily_lesson_goal: number } | null, passedToday: number): PaceStatus {
  const goal = (PACE_GOALS as readonly number[]).includes(preference?.daily_lesson_goal ?? 0)
    ? preference!.daily_lesson_goal as PaceGoal
    : DEFAULT_DAILY_LESSON_GOAL;
  const passed = Math.max(0, passedToday);
  return { goal, chosen: preference !== null, passedToday: passed, goalMet: passed >= goal };
}

/**
 * Whether opening `lessonId` was a real path choice, and whether the learner
 * took something other than the recommendation. `null` when the path offered
 * no choice (fewer than two lessons, or the lesson is not on the frontier).
 */
export function pathChoice(view: Pick<PathwayView, 'frontier' | 'optional'> & { autonomy?: PathwayView['autonomy'] }, lessonId: string): { exercised: boolean } | null {
  // 6-9: the choice offered was the binary pick, so only its two lessons are a path choice.
  const frontier = view.autonomy?.path === 'binary' ? binaryFrontier(view.frontier) : view.frontier;
  const options = [...new Set([...frontier, ...view.optional].map((item) => item.lessonId))];
  if (options.length < 2 || !options.includes(lessonId)) return null;
  const recommended = view.frontier[0]?.lessonId ?? null;
  return { exercised: recommended !== lessonId };
}
