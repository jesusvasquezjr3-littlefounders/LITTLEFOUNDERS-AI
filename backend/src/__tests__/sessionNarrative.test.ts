import { describe, expect, it } from 'vitest';
import { buildSessionNarrative, type KcAttemptForNarrative } from '../services/pedagogy/sessionNarrative.js';

/*
 * The guardian "what is happening" narrative (/ORACLE.md §12, 2026-09-01).
 * Pure and deterministic — these are the fixtures a real `kc_attempt` page
 * would produce, not implementation-detail probes.
 */

function attempt(over: Partial<KcAttemptForNarrative> & { kcId: string; correct: boolean }): KcAttemptForNarrative {
  return { kcTitle: over.kcId, createdAt: '2026-08-30T10:00:00Z', ...over };
}

describe('buildSessionNarrative', () => {
  it('returns null when there is nothing topic-specific or numeric to report', () => {
    const result = buildSessionNarrative({
      attempts: [],
      fallbackTopic: null,
      gradedCorrect: null,
      gradedTotal: null,
    });
    expect(result).toBeNull();
  });

  it('also returns null when the session closed with a graded total of exactly zero — a real zero is not "nothing to report" for AGENTS.md §1.14, but neither is it something worth narrating here', () => {
    const result = buildSessionNarrative({
      attempts: [],
      fallbackTopic: null,
      gradedCorrect: 0,
      gradedTotal: 0,
    });
    expect(result).toBeNull();
  });

  it('names one topic and reports no struggle when every attempt on it was correct', () => {
    const result = buildSessionNarrative({
      attempts: [
        attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:00:00Z' }),
        attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:01:00Z' }),
      ],
      fallbackTopic: null,
      gradedCorrect: 2,
      gradedTotal: 2,
    });
    expect(result).toEqual({
      topics: ['Making Change'],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: 2,
      gradedTotal: 2,
    });
  });

  it('reports a struggle that was worked through — wrong, then right, on the same topic, in the order it actually happened, not insertion order', () => {
    const result = buildSessionNarrative({
      attempts: [
        // Deliberately out of chronological order — the function must sort
        // by `createdAt`, not trust the array order it was handed.
        attempt({ kcId: 'kc-1', kcTitle: 'Subtracting Money', correct: true, createdAt: '2026-08-30T10:05:00Z' }),
        attempt({ kcId: 'kc-1', kcTitle: 'Subtracting Money', correct: false, createdAt: '2026-08-30T10:00:00Z' }),
      ],
      fallbackTopic: null,
      gradedCorrect: 1,
      gradedTotal: 2,
    });
    expect(result).toEqual({
      topics: ['Subtracting Money'],
      struggledTopic: 'Subtracting Money',
      struggleResolved: true,
      gradedCorrect: 1,
      gradedTotal: 2,
    });
  });

  it('reports an ongoing struggle when the last attempt on the missed topic is still wrong', () => {
    const result = buildSessionNarrative({
      attempts: [
        attempt({ kcId: 'kc-1', kcTitle: 'Subtracting Money', correct: false, createdAt: '2026-08-30T10:00:00Z' }),
        attempt({ kcId: 'kc-1', kcTitle: 'Subtracting Money', correct: false, createdAt: '2026-08-30T10:05:00Z' }),
      ],
      fallbackTopic: null,
      gradedCorrect: 0,
      gradedTotal: 2,
    });
    expect(result?.struggledTopic).toBe('Subtracting Money');
    expect(result?.struggleResolved).toBe(false);
  });

  it('names up to two topics, in the order first attempted, when three or more were covered', () => {
    const result = buildSessionNarrative({
      attempts: [
        attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:00:00Z' }),
        attempt({ kcId: 'kc-2', kcTitle: 'Saving for a Goal', correct: true, createdAt: '2026-08-30T10:05:00Z' }),
        attempt({ kcId: 'kc-3', kcTitle: 'Counting Coins', correct: true, createdAt: '2026-08-30T10:10:00Z' }),
      ],
      fallbackTopic: null,
      gradedCorrect: 3,
      gradedTotal: 3,
    });
    expect(result?.topics).toEqual(['Making Change', 'Saving for a Goal']);
  });

  it('can name a struggle on a THIRD topic even when it fell outside the two-topic cap — the struggle signal is chosen independently of the display cap, by design', () => {
    const result = buildSessionNarrative({
      attempts: [
        attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:00:00Z' }),
        attempt({ kcId: 'kc-2', kcTitle: 'Saving for a Goal', correct: true, createdAt: '2026-08-30T10:05:00Z' }),
        attempt({ kcId: 'kc-3', kcTitle: 'Counting Coins', correct: false, createdAt: '2026-08-30T10:10:00Z' }),
      ],
      fallbackTopic: null,
      gradedCorrect: 2,
      gradedTotal: 3,
    });
    expect(result?.topics).toEqual(['Making Change', 'Saving for a Goal']);
    expect(result?.struggledTopic).toBe('Counting Coins');
    expect(result?.struggleResolved).toBe(false);
  });

  it('falls back to the session digest topic when the v3 brain never touched this session (no kc_attempt rows)', () => {
    const result = buildSessionNarrative({
      attempts: [],
      fallbackTopic: 'Cobrar y dar cambio',
      gradedCorrect: 4,
      gradedTotal: 5,
    });
    expect(result).toEqual({
      topics: ['Cobrar y dar cambio'],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: 4,
      gradedTotal: 5,
    });
  });

  it('reports the graded fraction alone when there is a score but no topic at all — a diagnostic or open session with no course/topic anchor', () => {
    const result = buildSessionNarrative({
      attempts: [],
      fallbackTopic: null,
      gradedCorrect: 3,
      gradedTotal: 4,
    });
    expect(result).toEqual({
      topics: [],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: 3,
      gradedTotal: 4,
    });
  });

  it('prefers real kc_attempt evidence over the fallback topic when both exist', () => {
    const result = buildSessionNarrative({
      attempts: [attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:00:00Z' })],
      fallbackTopic: 'A different, staler topic name',
      gradedCorrect: 1,
      gradedTotal: 1,
    });
    expect(result?.topics).toEqual(['Making Change']);
  });

  it('an ongoing (unclosed) session with live kc_attempt evidence but no summary yet still narrates from the evidence, with a null graded fraction', () => {
    const result = buildSessionNarrative({
      attempts: [attempt({ kcId: 'kc-1', kcTitle: 'Making Change', correct: true, createdAt: '2026-08-30T10:00:00Z' })],
      fallbackTopic: null,
      gradedCorrect: null,
      gradedTotal: null,
    });
    expect(result).toEqual({
      topics: ['Making Change'],
      struggledTopic: null,
      struggleResolved: false,
      gradedCorrect: null,
      gradedTotal: null,
    });
  });
});
