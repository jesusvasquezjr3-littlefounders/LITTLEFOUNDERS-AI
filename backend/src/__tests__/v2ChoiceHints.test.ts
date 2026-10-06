import { describe, expect, it } from 'vitest';
import { v2FeedbackProblems, v2SegmentFeedback } from '../services/v2SegmentFamilies.js';

const segment = {
  id: 'cash-choice', type: 'story.branch.v2', grading: 'server', prompt: 'You have 95; reserve 60.',
  payload: { options: [{ id: 'spend-all', label: '95' }, { id: 'reserve-first', label: '35' }] },
  feedback: { met: 'You kept the reserved amount intact.', not_yet: 'Separate the reserved amount first.', choice_hints: {
    'spend-all': 'This is all the money, including the amount already reserved.',
    'reserve-first': 'Compare what remains after reserving the bill amount.',
  } },
};

describe('choice-specific hints preserve the answerless public contract', () => {
  it('accepts a complete hint map and checks it against actual visible choices', () => {
    expect(v2SegmentFeedback.safeParse(segment.feedback).success).toBe(true);
    expect(v2FeedbackProblems({ age_band: 'adult', segments: [segment] })).toEqual([]);
  });
  it('rejects a wrong-only map that would reveal which option is accepted', () => {
    const copy = structuredClone(segment); delete (copy.feedback.choice_hints as Record<string, string>)['reserve-first'];
    expect(v2FeedbackProblems({ age_band: 'adult', segments: [copy] }).join(' ')).toContain('every visible choice');
  });
  it('rejects hidden answer numbers in choice-specific copy', () => {
    const copy = structuredClone(segment); copy.feedback.choice_hints['spend-all'] = 'The answer is 1234.';
    expect(v2FeedbackProblems({ age_band: 'adult', segments: [copy] }).join(' ')).toContain('1234');
  });
  it('does not silently accept hints on a board without a corresponding renderer', () => {
    const copy = { ...segment, type: 'reasoning.decide-justify.v2' };
    expect(v2FeedbackProblems({ age_band: 'adult', segments: [copy] }).join(' ')).toContain('unsupported');
  });
});
