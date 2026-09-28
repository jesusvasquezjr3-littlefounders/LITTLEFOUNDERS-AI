import { describe, expect, it } from 'vitest';
import { buildLessonNarrative, lessonEvidence, struggleOf, weekSummary, type NarrativeAttempt, type NarrativeLessonInput } from './courseNarrative.js';

const at = (segmentId: string, score: number, minute: number, extra: Partial<NarrativeAttempt> = {}): NarrativeAttempt => ({
  segmentId, score, createdAt: `2026-09-20T10:${String(minute).padStart(2, '0')}:00.000Z`, hintsUsed: 0, diagnosticCode: null, ...extra,
});

const base: NarrativeLessonInput = {
  lessonId: 'l1', lessonTitle: 'Saving for a bike', topicTitle: 'Savings goals', courseTitle: 'Money basics',
  completedAt: '2026-09-20T10:30:00.000Z', skills: ['Saving toward a goal', 'Math of a saving plan', 'Third'],
  attempts: [], graded: true, decisions: 0, topicComplete: false,
};

describe('struggle, from graded attempts only', () => {
  it('distinguishes a clean run, a mistake worked through, and something still hard', () => {
    expect(struggleOf([at('a', 100, 1), at('b', 90, 2)])).toBe('none');
    expect(struggleOf([at('a', 40, 1, { diagnosticCode: 'initial_incorrect' }), at('a', 100, 2, { diagnosticCode: 'retry_recovery' })])).toBe('resolved');
    expect(struggleOf([at('a', 100, 1), at('b', 30, 2), at('b', 50, 3)])).toBe('open');
    // Chronology comes from the timestamps, not the read order.
    expect(struggleOf([at('a', 100, 5), at('a', 20, 1)])).toBe('resolved');
    expect(struggleOf([])).toBeNull();
  });
});

describe('the guardian narrative entry', () => {
  it('names at most two skills, falls back to the topic, and ends in a conversation starter', () => {
    const entry = buildLessonNarrative({ ...base, attempts: [at('a', 100, 1)] });
    expect(entry).toMatchObject({ skills: ['Saving toward a goal', 'Math of a saving plan'], struggle: 'none', conversation: 'explain', usedHint: false });
    expect(buildLessonNarrative({ ...base, skills: [] }).skills).toEqual(['Savings goals']);
  });

  it('counts story decisions without carrying any choice, and asks the guardian to ask about them', () => {
    const entry = buildLessonNarrative({ ...base, decisions: 2 });
    expect(entry).toMatchObject({ decisions: 2, conversation: 'decision' });
    expect(Object.keys(entry).sort()).toEqual(['completedAt', 'conversation', 'courseTitle', 'decisions', 'lessonId', 'lessonTitle', 'skills', 'struggle', 'topicComplete', 'topicTitle', 'usedHint']);
  });

  it('GAP-FIX-R1: reads a completed v2 run through the same fields, with first-try share and judgment counts, never answers', () => {
    const attempts = [
      at('run:decide-01', 0, 1, { diagnosticCode: 'outcome', judgment: 'partial', hintsUsed: 1 }), at('run:decide-01', 100, 2, { judgment: 'sound' }),
      at('run:coins-01', 100, 3, { judgment: null }),
    ];
    const v2 = buildLessonNarrative({ ...base, attempts });
    expect(v2).toMatchObject({ struggle: 'resolved', usedHint: true });
    const evidence = lessonEvidence({ lessonId: 'l1', attempts, graded: true });
    expect(evidence).toEqual({ lessonId: 'l1', firstTry: { correct: 1, graded: 2 }, judgment: { assessed: 1, sound: 0, partial: 1, unsupported: 0 } });
    expect(JSON.stringify([v2, evidence])).not.toMatch(/choice|answer|rubric/);
    expect(lessonEvidence({ lessonId: 'l1', attempts: [], graded: true })).toBeNull();
  });

  it('claims no struggle where there is no evidence: story-only and placement-credited lessons', () => {
    expect(buildLessonNarrative({ ...base, graded: false, attempts: [at('a', 0, 1)] }).struggle).toBeNull();
    expect(buildLessonNarrative({ ...base, attempts: [] }).struggle).toBeNull();
    expect(buildLessonNarrative({ ...base, attempts: [at('a', 60, 1, { hintsUsed: 1 }), at('a', 80, 2)] })).toMatchObject({ struggle: 'resolved', usedHint: true });
  });

  it('summarises the last seven days in two numbers', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');
    expect(weekSummary([
      { completedAt: '2026-09-23T00:00:00.000Z', topicComplete: true },
      { completedAt: '2026-09-20T00:00:00.000Z', topicComplete: false },
      { completedAt: '2026-09-01T00:00:00.000Z', topicComplete: true },
    ], now)).toEqual({ lessons: 2, topicsCompleted: 1 });
  });
});
