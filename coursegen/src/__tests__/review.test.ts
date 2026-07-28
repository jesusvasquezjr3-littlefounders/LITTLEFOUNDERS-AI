import { describe, expect, it, vi } from 'vitest';
import { reviewLesson, ReviewFailedError, MAX_REVISE_CYCLES } from '../pipeline/review.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';
import type { ChatCompleteResult } from '../providers/openaiChat.js';

const gateCtx = { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() };

function rubricResponse(overrides: Partial<Record<string, number>> = {}, notes = 'looks good'): ChatCompleteResult {
  return {
    content: JSON.stringify({
      age_fit: 5,
      pedagogy: 5,
      narrative_quality: 5,
      kid_safety: 5,
      naturalness: 5,
      concreteness: 5,
      cognitive_engagement: 5,
      feedback_quality: 5,
      distractor_quality: 5,
      notes,
      ...overrides,
    }),
    promptTokens: 5,
    completionTokens: 5,
  };
}

describe('reviewLesson', () => {
  it('passes immediately when the judge scores kid_safety>=5 and age_fit>=4 on the first call', async () => {
    const judge = vi.fn().mockResolvedValue(rubricResponse());
    const author = vi.fn();
    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(0);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(author).not.toHaveBeenCalled();
  });

  it('revises once when kid_safety fails, then passes on re-judgment', async () => {
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ kid_safety: 3 }, 'too scary, fix it'))
      .mockResolvedValueOnce(rubricResponse());
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(1);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(author).toHaveBeenCalledTimes(1);
  });

  it('throws ReviewFailedError after MAX_REVISE_CYCLES revisions that improve but never pass', async () => {
    // kid_safety improves every cycle (1→2→3→4) yet never reaches the floor of
    // 5 — the early stop must NOT fire on an improving trajectory, so the loop
    // runs its full budget before failing the slot.
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ kid_safety: 1 }, 'unsafe'))
      .mockResolvedValueOnce(rubricResponse({ kid_safety: 2 }, 'still unsafe'))
      .mockResolvedValueOnce(rubricResponse({ kid_safety: 3 }, 'better, still unsafe'))
      .mockResolvedValueOnce(rubricResponse({ kid_safety: 4 }, 'close, still unsafe'));
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const failure = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(failure).toBeInstanceOf(ReviewFailedError);
    expect((failure as ReviewFailedError).earlyStopped).toBe(false);
    expect(judge).toHaveBeenCalledTimes(MAX_REVISE_CYCLES + 1);
    expect(author).toHaveBeenCalledTimes(MAX_REVISE_CYCLES);
  });

  it('EARLY-STOPS when a revise improves no failing dimension — fail fast to the outer retry', async () => {
    // The judge returns the SAME failing score after the first revise: revising
    // this draft is a doomed trajectory, so the loop must break after ONE cycle
    // instead of burning the remaining revise+judge calls.
    const judge = vi.fn().mockResolvedValue(rubricResponse({ kid_safety: 2 }, 'still unsafe'));
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const failure = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(failure).toBeInstanceOf(ReviewFailedError);
    expect((failure as ReviewFailedError).earlyStopped).toBe(true);
    expect((failure as ReviewFailedError).message).toContain('early stop');
    expect(judge).toHaveBeenCalledTimes(2); // initial + one re-judge
    expect(author).toHaveBeenCalledTimes(1); // one revise, then fail fast
  });

  it('a WORSENING re-judge also early-stops (no failing dimension improved)', async () => {
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ pedagogy: 2 }, 'weak teaching'))
      .mockResolvedValueOnce(rubricResponse({ pedagogy: 1 }, 'got worse'));
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const failure = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(failure).toBeInstanceOf(ReviewFailedError);
    expect((failure as ReviewFailedError).earlyStopped).toBe(true);
    expect(judge).toHaveBeenCalledTimes(2);
  });

  it('a gate-breaking revise does NOT trigger the early stop (no new judged rubric to compare)', async () => {
    // Cycle 1's revise returns structurally broken JSON → gates fail → the
    // re-judge is skipped and the rubric keeps the SAME scores with a gate note
    // appended. Comparing that copy against the baseline would read "no
    // improvement" and kill the designed gate-feedback recovery path — so the
    // loop must continue, and cycle 2's valid revise then passes.
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ pedagogy: 2 }, 'weak teaching'))
      .mockResolvedValueOnce(rubricResponse());
    const author = vi
      .fn()
      .mockResolvedValueOnce({ content: JSON.stringify({ nonsense: true }), promptTokens: 5, completionTokens: 5 })
      .mockResolvedValueOnce({ content: JSON.stringify(buildDocument()), promptTokens: 5, completionTokens: 5 });

    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(2);
    expect(judge).toHaveBeenCalledTimes(2); // initial + the ONE re-judge after the valid revise
    expect(author).toHaveBeenCalledTimes(2);
  });

  it('age_fit below 4 also triggers a revise cycle', async () => {
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ age_fit: 2 }, 'too advanced for tier1'))
      .mockResolvedValueOnce(rubricResponse());
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(1);
  });

  it.each(['cognitive_engagement', 'feedback_quality', 'distractor_quality', 'pedagogy'])(
    'a low %s score triggers a revise cycle (new quality gate)',
    async (dim) => {
      const judge = vi
        .fn()
        .mockResolvedValueOnce(rubricResponse({ [dim]: 2 }, `fix ${dim}`))
        .mockResolvedValueOnce(rubricResponse());
      const author = vi.fn().mockResolvedValue({
        content: JSON.stringify(buildDocument()),
        promptTokens: 5,
        completionTokens: 5,
      });
      const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
      expect(result.cycles).toBe(1);
    },
  );

  it('concreteness below 4 also triggers a revise cycle (like age_fit)', async () => {
    const judge = vi
      .fn()
      .mockResolvedValueOnce(rubricResponse({ concreteness: 2 }, 'no worked concrete instance, fully abstract'))
      .mockResolvedValueOnce(rubricResponse());
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(1);
    expect(judge).toHaveBeenCalledTimes(2);
  });

  it('passes at the concreteness gate boundary (concreteness=4)', async () => {
    const judge = vi.fn().mockResolvedValue(rubricResponse({ concreteness: 4 }));
    const author = vi.fn();
    const result = await reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never });
    expect(result.cycles).toBe(0);
    expect(author).not.toHaveBeenCalled();
  });
});
