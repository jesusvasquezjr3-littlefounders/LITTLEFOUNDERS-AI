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

  it('maps 409 ATTEMPTS_EXHAUSTED to a terminal, non-retryable verdict instead of throwing', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'ATTEMPTS_EXHAUSTED', message: 'No attempts left' } });

    const grader = createCoreGrader('lesson-1', async () => 'token-123');
    const result = await grader.grade('seg-1', { choice: 'a' }, { attempt_number: 3 });

    expect(result).toEqual({ correct: false, score: 0, tier: 'tryAgain', allowRetry: false });
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
});
