import { describe, expect, it } from 'vitest';
import { decisionOf, displayStateOf } from '../services/pedagogy/masteryEvidence.js';

describe('the mastery evidence projection (GAP-FIX-R2, Appendix D §2.6)', () => {
  const base = { kc_id: 'k', evidence_rule: null, evidence_observations: null, evidence_required: null, evidence_discounted: null, mastery_revoked: false, created_at: '2026-09-20T10:00:00Z' } as const;

  it('maps each logged rule to the decision a parent reads, and ignores ordinary steps', () => {
    expect(decisionOf(base)).toBeNull();
    expect(decisionOf({ ...base, evidence_rule: 'mastery', evidence_observations: 2, evidence_required: 2, evidence_discounted: 'hint_assisted' }))
      .toEqual({ kind: 'mastered', observations: 2, required: 2, discounted: 'hint_assisted', decidedAt: base.created_at });
    expect(decisionOf({ ...base, evidence_rule: 'remediation', evidence_observations: 2, evidence_required: 2 })?.kind).toBe('remediation');
    expect(decisionOf({ ...base, evidence_rule: 'rescue', evidence_observations: 3, evidence_required: 2 })?.kind).toBe('rescue');
    expect(decisionOf({ ...base, mastery_revoked: true })).toEqual({ kind: 'mastery_withdrawn', observations: null, required: null, discounted: null, decidedAt: base.created_at });
  });

  it('folds the map state into three labels, provisional until corroborated', () => {
    expect(displayStateOf({ pKnown: 0.95, attempts: 5, reviewDue: false, consecutiveCorrect: 2 })).toBe('provisional_mastered');
    // One lucky answer at a high posterior is not mastery (C.10).
    expect(displayStateOf({ pKnown: 0.95, attempts: 5, reviewDue: false, consecutiveCorrect: 1 })).toBe('not_yet');
    expect(displayStateOf({ pKnown: 0.95, attempts: 5, reviewDue: true, consecutiveCorrect: 2 })).toBe('recheck_due');
    expect(displayStateOf({ pKnown: 0.2, attempts: 0, reviewDue: false, consecutiveCorrect: 0 })).toBe('not_yet');
  });
});
