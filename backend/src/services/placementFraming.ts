import type { DoneStep, PlacementMethod } from './placementAlgorithm.js';

/*
 * B.15 (S05.3d): placement outcome framing as accompaniment, not a verdict.
 *
 * Core classifies every outcome into one closed frame; the client owns the
 * words (three locales, the Copy Budget and the B.15 lexicon gate in
 * frontend/src/rebuild/learning/placementOutcome.ts). The frame carries what
 * the learner needs to hear and nothing that could rank them: no score, no
 * count of right or wrong answers, no percentile and no comparison with any
 * other learner. `basis` is always 'prior_exposure': a starting point
 * reflects what the learner has already seen, never what they can do.
 *
 *   path   which of the four placement paths produced this start
 *   start  'beginning' (nothing credited) or 'further_in'
 */

export type PlacementFramePath = PlacementMethod;
export interface PlacementFrame {
  path: PlacementFramePath;
  start: 'beginning' | 'further_in';
  basis: 'prior_exposure';
  /** True when the learner, not the quiz, chose this start. */
  learner_chosen: boolean;
}

export function placementFrame(done: Pick<DoneStep, 'method' | 'creditedLessonIds'>): PlacementFrame {
  return {
    path: done.method,
    start: done.creditedLessonIds.length > 0 ? 'further_in' : 'beginning',
    basis: 'prior_exposure',
    learner_chosen: done.method === 'learner_chose_start' || done.method === 'learner_adjusted',
  };
}

/**
 * The exact keys a placement result may carry. A test pins the response to
 * this list so a comparative or score field cannot be added by accident.
 */
export const PLACEMENT_RESULT_KEYS = [
  'frontier', 'startTopicId', 'startLessonId', 'creditedLessonCount', 'creditedTopicCount',
  'totalTopicCount', 'method', 'cappedByPrerequisite', 'framing',
] as const;
