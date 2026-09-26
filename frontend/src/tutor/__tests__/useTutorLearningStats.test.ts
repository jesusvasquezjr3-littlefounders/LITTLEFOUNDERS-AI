import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorLearningStats } from '../useTutorLearningStats';

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

describe('useTutorLearningStats — the Tutor reads real /profile numbers', () => {
  beforeEach(() => {
    mockApi.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => window.localStorage.clear());

  it('fetches the same /profile Core endpoint ProfilePage.tsx already uses', async () => {
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 245, streakDays: 12 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi).toHaveBeenCalledWith('/profile', { token: 'tok' });
    expect(result.current.xpPoints).toBe(245);
    expect(result.current.streakDays).toBe(12);
  });

  it('does nothing without a token yet — no premature request', () => {
    const { result } = renderHook(() => useTutorLearningStats(null, 'kid-1'));
    expect(mockApi).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it('never celebrates on the very first visit — there is no baseline to compare against', async () => {
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 10, streakDays: 3 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streakJustAdvanced).toBe(false);
  });

  it('celebrates once the streak crossed a milestone (7, 30, 100) since the learner last opened the Tutor', async () => {
    window.localStorage.setItem('lf.tutor.lastSeenStreak.kid-1', '6');
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 250, streakDays: 7 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.streakJustAdvanced).toBe(true));
    expect(window.localStorage.getItem('lf.tutor.lastSeenStreak.kid-1')).toBe('7');
  });

  it('B.20 / OD-7 (S05.3e): an ordinary increase that crosses no milestone does not celebrate', async () => {
    window.localStorage.setItem('lf.tutor.lastSeenStreak.kid-1', '11');
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 250, streakDays: 12 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streakJustAdvanced).toBe(false);
    expect(window.localStorage.getItem('lf.tutor.lastSeenStreak.kid-1')).toBe('12');
  });

  it('does not celebrate a streak that only held steady', async () => {
    window.localStorage.setItem('lf.tutor.lastSeenStreak.kid-1', '12');
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 250, streakDays: 12 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streakJustAdvanced).toBe(false);
  });

  it('dismissStreakCelebration clears the flag on demand', async () => {
    window.localStorage.setItem('lf.tutor.lastSeenStreak.kid-1', '28');
    mockApi.mockResolvedValue({
      data: { learningStats: { xpPoints: 250, streakDays: 31 } },
      error: null,
    });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.streakJustAdvanced).toBe(true));
    act(() => result.current.dismissStreakCelebration());
    expect(result.current.streakJustAdvanced).toBe(false);
  });

  it('leaves xp/streak at zero and never celebrates when the fetch errors', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'x' } });
    const { result } = renderHook(() => useTutorLearningStats('tok', 'kid-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.xpPoints).toBe(0);
    expect(result.current.streakDays).toBe(0);
    expect(result.current.streakJustAdvanced).toBe(false);
  });
});
