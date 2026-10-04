import type { V2Grade } from '../../v2VisualScorer.js';
import { SAMPLE_ATTEMPT, isAttemptSeed, seedsEqual, type HorizonteAttempt } from '../seed/protocol.js';
import type { HorizonteScorer } from '../types.js';
import { analyse, hasOnly, isPayload, successCount, type Payload } from './model.js';

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const REVIEW: V2Grade = { verdict: 'review', diagnostic: 'value' };

const started = (met: boolean): V2Grade => (met ? MET : REVIEW);

/**
 * The seed a response carries must be the one Core derived from the verified token. With a key (Core) a missing attempt fails
 * closed; without one (the browser, advisory) any well-formed seed passes, and a given attempt still has to match.
 */
function seedHeld(seed: unknown, attempt: HorizonteAttempt | undefined, rubric: unknown): boolean {
  if (!isAttemptSeed(seed)) return false;
  if (attempt) return seedsEqual(seed, attempt.seed);
  return rubric === undefined;
}

const sameAnswers = (key: unknown, answers: readonly number[]): boolean =>
  Array.isArray(key) && key.length === answers.length && key.every((value, index) => value === answers[index]);

type LifeSimSegment = { payload: Payload };

/**
 * invalid: malformed, a choice that is not offered, a seed that is not this attempt's, or a key that is not the exact answer set
 * of the payload (or a payload with no clean answer). valid: the start untouched. met: the choice is an answer and the seeded 100
 * futures meet the goal at least the goal number of times, as the board shows; review: set, but not that.
 */
function gradeLifeSim(segment: LifeSimSegment, response: unknown, rubric: unknown, attempt?: HorizonteAttempt): V2Grade {
  const payload = segment?.payload;
  if (!isPayload(payload)) return INVALID;
  if (!hasOnly(response, ['seed', 'choice']) || !seedHeld(response.seed, attempt, rubric) || !payload.choices.includes(response.choice as number)) return INVALID;
  if (rubric === undefined) return VALID;
  const analysis = analyse(payload);
  const target = hasOnly(rubric, ['target']) ? rubric.target : undefined;
  if (analysis.problem !== null || !hasOnly(target, ['answers']) || !sameAnswers(target.answers, analysis.answers)) return INVALID;
  const choice = response.choice as number;
  if (choice === payload.start) return VALID;
  return started(analysis.answers.includes(choice) && successCount(response.seed as string, payload, choice) >= payload.goal);
}

const SAMPLE_SEED = SAMPLE_ATTEMPT.seed;

/** A sample is the start untouched, under the fixed sample attempt: it proves the key is the solved one, never that it is met. */
export const SIM2_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'money.life-sim.v2': {
    grade: gradeLifeSim as unknown as HorizonteScorer['grade'],
    sample: ((segment: LifeSimSegment) => ({ seed: SAMPLE_SEED, choice: segment.payload.start })) as unknown as HorizonteScorer['sample'],
  },
};
