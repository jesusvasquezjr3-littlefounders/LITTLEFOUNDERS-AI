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

  it('throws ReviewFailedError after MAX_REVISE_CYCLES unsuccessful revisions', async () => {
    const judge = vi.fn().mockResolvedValue(rubricResponse({ kid_safety: 2 }, 'still unsafe'));
    const author = vi.fn().mockResolvedValue({
      content: JSON.stringify(buildDocument()),
      promptTokens: 5,
      completionTokens: 5,
    });

    await expect(
      reviewLesson(buildDocument(), gateCtx, { judge: judge as never, author: author as never }),
    ).rejects.toBeInstanceOf(ReviewFailedError);

    expect(judge).toHaveBeenCalledTimes(MAX_REVISE_CYCLES + 1);
    expect(author).toHaveBeenCalledTimes(MAX_REVISE_CYCLES);
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
});
