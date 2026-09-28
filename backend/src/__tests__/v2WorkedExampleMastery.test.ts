import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { applyMasteryFade } from '../services/pedagogy/courseLessonEvidence.js';
import { longArithmeticSchema, longArithmeticSteps, masteryFadeCount } from '../services/v2SegmentFamilies.js';

/* GAP-FIX-R1 learning (Appendix P Part 1 M9–M10): long arithmetic steps and the mastery-driven fade chosen on Core. */

afterEach(() => vi.unstubAllGlobals());

describe('M9 long arithmetic', () => {
  it('builds the standard long-division and long-multiplication steps', () => {
    expect(longArithmeticSteps({ kind: 'long-division', dividend: 156, divisor: 12 })).toEqual([
      { digit: 1, product: 12, remainder: 3 }, { digit: 3, product: 36, remainder: 0 },
    ]);
    expect(longArithmeticSteps({ kind: 'long-multiplication', multiplicand: 23, multiplier: 14 })).toEqual([
      { digit: 4, product: 92, remainder: 92 }, { digit: 1, product: 230, remainder: 322 },
    ]);
  });

  it('refuses steps that do not follow the algorithm', () => {
    const division = { kind: 'long-division', dividend: 156, divisor: 12, steps: [{ digit: 1, product: 12, remainder: 3 }, { digit: 3, product: 36, remainder: 0 }] };
    expect(longArithmeticSchema.safeParse(division).success).toBe(true);
    expect(longArithmeticSchema.safeParse({ ...division, steps: [{ digit: 1, product: 12, remainder: 3 }, { digit: 4, product: 48, remainder: 0 }] }).success).toBe(false);
  });
});

describe('mastery-driven backward fade', () => {
  it('keeps novices on full worked examples and fades with mastery, never the first step', () => {
    expect(masteryFadeCount(4, null)).toBe(0);
    expect(masteryFadeCount(4, 0.2)).toBe(0);
    expect(masteryFadeCount(4, 0.5)).toBe(1);
    expect(masteryFadeCount(4, 0.7)).toBe(2);
    expect(masteryFadeCount(4, 0.95)).toBe(3);
    expect(masteryFadeCount(3, 0.95)).toBe(2);
  });

  it('sets the delivered fade from the topic primary KC, and keeps the authored fade when mastery cannot be read', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const topicId = '66666666-6666-4666-8666-666666666666';
    const kcId = 'abababab-abab-4bab-8bab-abababababab';
    const doc = { segments: [{ id: 'we-01', type: 'math.worked-example.v2', payload: { steps: [1, 2, 3], fade_count: 0 } }, { id: 'x', type: 'visual.goal-bullet.v2', payload: {} }] };
    const db = { topic_knowledge_components: [{ topic_id: topicId, kc_id: kcId, role: 'teaches', is_primary: true }],
      kc: [{ id: kcId, key: 'k', title: {}, status: 'active' }], learner_kc_mastery: [{ user_id: userId, kc_id: kcId, p_known: 0.9, attempts: 3, correct: 3 }] } as unknown as FakeDb;
    vi.stubGlobal('fetch', createFakeFetch(db));
    const faded = await applyMasteryFade(doc, userId, topicId);
    expect((faded.segments as Array<{ payload: { fade_count?: number } }>)[0]!.payload.fade_count).toBe(2);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await applyMasteryFade(doc, userId, topicId)).toBe(doc);
  });
});
