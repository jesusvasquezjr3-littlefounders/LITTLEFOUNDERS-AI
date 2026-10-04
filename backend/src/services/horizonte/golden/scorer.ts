import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import { isTenFrameCounts, respectsRule, sameCounts, targetReachable, type TenFrameCounts } from './model.js';

type Segment = { payload: { start: TenFrameCounts } };
type Rubric = { target: TenFrameCounts };

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };

/**
 * invalid: malformed, or breaks the frame rule. valid: the start left untouched (and every well-formed response
 * when there is no rubric, as in the browser). review: changed, not the target. met: the target.
 */
function grade(segment: Segment, response: unknown, rubric: Rubric | undefined): V2Grade {
  const start = segment?.payload?.start;
  if (!isTenFrameCounts(start)) return INVALID;
  if (typeof response !== 'object' || response === null || Array.isArray(response) || Object.keys(response).join() !== 'counts') return INVALID;
  const counts = (response as { counts: unknown }).counts;
  if (!isTenFrameCounts(counts, start.length) || !respectsRule(start, counts)) return INVALID;
  if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
  if (!isTenFrameCounts(rubric.target, start.length) || !targetReachable(start, rubric.target)) return INVALID;
  if (sameCounts(counts, start)) return { verdict: 'valid', diagnostic: 'none' };
  return sameCounts(counts, rubric.target) ? { verdict: 'met', diagnostic: 'none' } : { verdict: 'review', diagnostic: 'value' };
}

export const GOLDEN_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.ten-frame.v2': {
    grade: grade as HorizonteScorer['grade'],
    sample: ((segment: Segment) => ({ counts: [...segment.payload.start] })) as HorizonteScorer['sample'],
  },
};
