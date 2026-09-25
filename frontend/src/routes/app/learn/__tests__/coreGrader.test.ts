import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import type { Verdict } from '@/lesson-engine/core/types';
import { createCoreGrader } from '../coreGrader';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

const mockedApi = vi.mocked(api);

describe('createCoreGrader', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('POSTs the segment attempt to Core and returns the server verdict', async () => {
    const verdict: Verdict = { correct: true, score: 100, tier: 'perfect', allowRetry: false };
    mockedApi.mockResolvedValueOnce({ data: { verdict }, error: null });

    const getToken = vi.fn().mockResolvedValue('token-123');
    const grader = createCoreGrader('lesson-1', getToken);

    const result = await grader.grade('seg-1', { choice: 'a' }, { attempt_number: 1 });

    expect(result).toEqual(verdict);
    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', {
      method: 'POST',
      token: 'token-123',
      body: { segment_id: 'seg-1', answer: { choice: 'a' }, attempt_number: 1 },
    });
  });

  it('rejects on 409 ATTEMPTS_EXHAUSTED (never fabricates a 0/100 fail)', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'ATTEMPTS_EXHAUSTED', message: 'No attempts left' } });

    const grader = createCoreGrader('lesson-1', async () => 'token-123');

    await expect(grader.grade('seg-1', { choice: 'a' }, { attempt_number: 3 })).rejects.toThrow('ATTEMPTS_EXHAUSTED');
  });

  it('includes run_id and hints_used in the grade body when provided', async () => {
    const verdict: Verdict = { correct: true, score: 90, tier: 'great', allowRetry: false };
    mockedApi.mockResolvedValueOnce({ data: { verdict }, error: null });

    const grader = createCoreGrader('lesson-1', async () => 'token-123', 'run-abc');
    await grader.grade('seg-1', { choice: 'a' }, { attempt_number: 2, hints_used: 1 });

    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1/grade', {
      method: 'POST',
      token: 'token-123',
      body: { segment_id: 'seg-1', answer: { choice: 'a' }, attempt_number: 2, run_id: 'run-abc', hints_used: 1 },
    });
  });

  it('rejects on every other error (e.g. LESSON_LOCKED) so the player shows its outage path, never a fabricated verdict', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'LESSON_LOCKED', message: 'Locked' } });

    const grader = createCoreGrader('lesson-1', async () => 'token-123');

    await expect(grader.grade('seg-1', {}, { attempt_number: 1 })).rejects.toThrow('LESSON_LOCKED');
  });

  it('rejects on a network/INTERNAL failure', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'Network error' } });

    const grader = createCoreGrader('lesson-1', async () => null);

    await expect(grader.grade('seg-1', {}, { attempt_number: 1 })).rejects.toThrow('INTERNAL');
  });
  it('S05.3f (B.26): hands the guided-review offer from Core to the host beside the verdict, and ignores a malformed one', async () => {
    const verdict: Verdict = { correct: false, score: 0, tier: 'tryAgain', allowRetry: true };
    const offer = { skill_key: 'money/save', skill: 'Saving toward a goal', misses: 3, character: 'dina' };
    const onGuidedReview = vi.fn();
    const grader = createCoreGrader('lesson-1', async () => 'token-123', undefined, { onGuidedReview });
    mockedApi.mockResolvedValueOnce({ data: { verdict, guided_review: offer }, error: null });
    expect(await grader.grade('seg-1', { choice: 'b' }, { attempt_number: 1 })).toEqual(verdict);
    expect(onGuidedReview).toHaveBeenCalledWith(offer);
    mockedApi.mockResolvedValueOnce({ data: { verdict, guided_review: { ...offer, misses: 1 } }, error: null });
    await grader.grade('seg-1', { choice: 'b' }, { attempt_number: 2 });
    expect(onGuidedReview).toHaveBeenCalledTimes(1);
  });
});
