import { describe, expect, it } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { decisionSentences, parseMasteryEvidence, type MasteryEvidenceItem } from './MentorDecisions';

const copy = rebuildNamespaceCopy['en-US'].mentor.mentorDecisions;
const item = (over: Partial<MasteryEvidenceItem> = {}): MasteryEvidenceItem => ({
  kcKey: 'k', title: 'Counting coins', state: 'not_yet', correctInARow: 0, attempts: 1, decision: null, nextCheckAt: null, ...over,
});

describe('MentorDecisions (GAP-FIX-R2)', () => {
  it('refuses a drifted projection rather than drawing half a card', () => {
    expect(parseMasteryEvidence({ items: [item()] })).not.toBeNull();
    expect(parseMasteryEvidence({ items: [{ ...item(), state: 'mastered' }] })).toBeNull();
    expect(parseMasteryEvidence({ items: [item({ decision: { kind: 'mastered', observations: 2, required: 2, discounted: 'lucky' as never, decidedAt: '2026-09-20T10:00:00Z' } })] })).toBeNull();
    expect(parseMasteryEvidence({ items: [{ ...item(), transcript: 'x', title: '' }] })).toBeNull();
    expect(parseMasteryEvidence(null)).toBeNull();
  });

  it('phrases every decision kind, singular and plural, and what did not count', () => {
    const at = '2026-09-20T10:00:00Z';
    expect(decisionSentences(item({ decision: { kind: 'mastered', observations: 1, required: 1, discounted: 'none', decidedAt: at } }), copy, 'en-US')).toEqual([copy.masteredOne]);
    expect(decisionSentences(item({ decision: { kind: 'rescue', observations: 3, required: 2, discounted: 'too_fast_and_hint_assisted', decidedAt: at } }), copy, 'en-US'))
      .toEqual(['Made it easier after 3 hard tries in a row.', copy.bothDiscounted]);
    expect(decisionSentences(item({ decision: { kind: 'mastery_withdrawn', observations: null, required: null, discounted: null, decidedAt: at } }), copy, 'en-US')).toEqual([copy.withdrawn]);
    expect(decisionSentences(item({ correctInARow: 3, nextCheckAt: '2026-10-04T12:00:00Z' }), copy, 'en-US'))
      .toEqual(['3 correct answers in a row so far.', 'Will check again on Oct 4, 2026.']);
    // A re-check that is already due is said by the state, not by a date in the past.
    expect(decisionSentences(item({ state: 'recheck_due', nextCheckAt: '2026-09-01T12:00:00Z' }), copy, 'en-US')).toEqual([]);
  });
});
