import { describe, expect, it } from 'vitest';
import { assembleLearningQaSignals, loadTeachingVisualCoverage } from '../services/learningQaSignals.js';
import { LEARN_QA_EVENTS, RECORDABLE_EVENTS, SERVER_ONLY_EVENTS } from '../services/insights.js';

/*
 * GAP-FIX-R2 learning: Appendix P Part 8 (scorer parity, d′ pre/post,
 * representation A/B, tap and locale coverage) and Appendix C 1.3 (B.1, B.2,
 * B.4, defect escapes).
 */

const empty = { graded: 0, reported: 0, agreed: 0, agreement_share: null };
const base = { parity: empty, phases: [], cues: { responses: 0, hits: 0, missed: 0, false_ticks: 0 }, variants: [], entries: [], qa: [], escapes: [], coverage: null };

describe('learning QA signals', () => {
  it('computes placement commit success, gate counts and parity misses from the events', () => {
    const signals = assembleLearningQaSignals({ ...base,
      parity: { graded: 40, reported: 38, agreed: 38, agreement_share: 1 },
      qa: [
        { event: 'placement_commit_ok', detail: 'adaptive_quiz', events: 7 }, { event: 'placement_commit_ok', detail: 'learner_adjusted', events: 2 },
        { event: 'placement_commit_failed', detail: 'write_failed', events: 1 }, { event: 'prerequisite_refused', detail: 'pathway', events: 3 },
        { event: 'prerequisite_passed', detail: 'pathway', events: 5 }, { event: 'lesson_update_required', detail: 'completion', events: 2 },
        { event: 'scorer_parity_miss', detail: 'seg-01', events: 1 },
      ],
      escapes: [{ gate_id: 'forge.gate.18.wellbeing-language', escapes: 2, published_versions: 30 }] });
    expect(signals.placementCommit).toMatchObject({ ok: 9, failed: 1, successRate: 0.9, byMethod: { adaptive_quiz: 7, learner_adjusted: 2 }, target: 1 });
    expect(signals.prerequisiteGate).toEqual({ refused: 3, passed: 5, target: 1 });
    expect(signals.forcedUpdate).toEqual({ blocked: 2, target: 1 });
    expect(signals.scorerParity).toMatchObject({ agreement_share: 1, refusedButClientValid: 1, target: 1 });
    expect(signals.defectEscapes).toEqual({ escapes: 2, publishedVersions: 30, byGate: [{ gateId: 'forge.gate.18.wellbeing-language', escapes: 2 }], target: 0 });
  });

  it('splits d′ by phase and labels the diagnostic metrics', () => {
    const signals = assembleLearningQaSignals({ ...base,
      phases: [{ item_phase: 'pre', responses: 10, hits: 10, misses: 10, false_alarms: 8, correct_rejections: 12 },
        { item_phase: 'post', responses: 10, hits: 18, misses: 2, false_alarms: 2, correct_rejections: 18 }],
      variants: [{ kc: 'kc-unit-price', variant: 'ratio-lines', first_attempts: 4, successes: 3, success_share: 0.75 }] });
    const [pre, post] = signals.detectionByPhase;
    expect(post!.dPrime).toBeGreaterThan(pre!.dPrime);
    expect(signals.variantTransfer.diagnostic).toBe(true);
    expect(signals.cueHits.diagnostic).toBe(true);
    expect(signals.cpaEntryStages.diagnostic).toBe(true);
    expect(signals.placementCommit.successRate).toBeNull();
    expect(signals.defectEscapes).toMatchObject({ escapes: 0, publishedVersions: 0, byGate: [] });
  });

  it('reads the committed coverage snapshot and refuses a malformed one', () => {
    const coverage = loadTeachingVisualCoverage();
    expect(coverage?.locale_rendering.share).toBe(1);
    expect(coverage?.tap_alternative.missing).toEqual([]);
    expect(coverage?.chart_kinds).toMatchObject({ kinds: 58, reading: 12, reading_missing: [] });
    expect(coverage?.horizonte).toMatchObject({ packs: 18, segment_types: 64, missing: [] });
    expect(loadTeachingVisualCoverage({ generated_at: '2026-09-28' })).toBeNull();
  });

  it('keeps the QA events server-only (a forged denominator cannot move a release metric)', () => {
    for (const event of LEARN_QA_EVENTS) {
      expect(RECORDABLE_EVENTS).toContain(event);
      expect(SERVER_ONLY_EVENTS.has(event)).toBe(true);
    }
  });
});
