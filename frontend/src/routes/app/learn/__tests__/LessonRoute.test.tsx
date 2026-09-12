import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ComponentProps } from 'react';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import type { LessonDocument } from '@/lesson-engine/core/types';
import type LessonPlayerType from '@/lesson-engine/player/LessonPlayer';
import { LessonRoute } from '../LessonRoute';

const mockNavigate = vi.fn();

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
// getToken must be a STABLE reference — the route's fetch effect depends on it
// (in the real app it's a memoized useCallback from AuthContext). A fresh
// function per render would re-fire the effect forever.
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken }) };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/lesson-engine/player/LessonPlayer', () => ({
  default: ({ onComplete, onExit }: ComponentProps<typeof LessonPlayerType>) => (
    <div>
      <button type="button" onClick={() => onComplete?.({ score: 100, passed: true, xp: 10, seconds_spent: 42 })}>
        mock-complete
      </button>
      <button type="button" onClick={onExit}>
        mock-exit
      </button>
    </div>
  ),
}));

const mockedApi = vi.mocked(api);

const fixtureDocument: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'l1', title: 'Lesson One', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: [], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [],
};

function renderLessonRoute(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/learn/lesson/:lessonId" element={<LessonRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  mockedApi.mockReset();
  mockNavigate.mockReset();
  await i18n.changeLanguage('en-US');
});

describe('LessonRoute', () => {
  it('fetches the lesson document and renders the player', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);

    expect(await screen.findByText('mock-complete')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/learn/lessons/lesson-1', { token: 'token-123' });
  });

  it('posts the measured seconds_spent on complete WITHOUT navigating away (the Results screen must stay up until the kid exits)', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    mockedApi.mockResolvedValueOnce({ data: { score: 100, passed: true, xp_earned: 10, xp_delta: 10, streak_days: 1, streak_extended: true, first_today: true, minutes_learned: 1, lessons_completed: 1, progress: { passed: 1, total: 1, pct: 100 }, next_lesson_id: null }, error: null });

    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);
    await screen.findByText('mock-complete');

    fireEvent.click(screen.getByText('mock-complete'));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        '/learn/lessons/lesson-1/complete',
        expect.objectContaining({
          method: 'POST',
          token: 'token-123',
          body: { seconds_spent: 42, run_id: expect.any(String), local_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        }),
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates back to the course page on exit, using the courseSlug passed via location state', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute([{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]);
    await screen.findByText('mock-exit');

    fireEvent.click(screen.getByText('mock-exit'));

    expect(mockNavigate).toHaveBeenCalledWith('/learn/money-basics');
  });

  it('falls back to /learn on exit when no courseSlug was passed', async () => {
    mockedApi.mockResolvedValueOnce({ data: { lesson: { id: 'lesson-1', slug: 'l1' }, locale: 'en-US', document: fixtureDocument }, error: null });
    renderLessonRoute(['/learn/lesson/lesson-1']);
    await screen.findByText('mock-exit');

    fireEvent.click(screen.getByText('mock-exit'));

    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  it('shows an error banner with a way back when the lesson fetch fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'LESSON_LOCKED', message: 'Locked' } });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't unlocked yet/);
    fireEvent.click(screen.getByRole('button', { name: /Back to course/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  /*
   * PLACEMENT_REQUIRED is a missing step, not an error: Core 403s every
   * lesson-access endpoint until the course's placement quiz is taken, and
   * /learn will happily offer the lesson anyway. Showing the banner made the
   * learner read a red message and then press a button that lands on the
   * course page, which redirects to that same quiz — so go straight there.
   */
  it('sends the learner to the placement quiz instead of a dead-end error', async () => {
    mockedApi.mockResolvedValueOnce({
      data: null,
      error: { code: 'PLACEMENT_REQUIRED', message: "Complete this course's placement quiz first" },
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/learn/lesson/lesson-1', state: { courseSlug: 'money-basics' } }]}>
        <Routes>
          <Route path="/learn/lesson/:lessonId" element={<LessonRoute />} />
          <Route path="/learn/:courseSlug/placement" element={<div>placement quiz</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('placement quiz')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the banner when the course is unknown, rather than guessing a quiz URL', async () => {
    // A bare deep link carries no router state, so there is no courseSlug to
    // build the placement URL from. Being visibly stuck beats a wrong redirect.
    mockedApi.mockResolvedValueOnce({
      data: null,
      error: { code: 'PLACEMENT_REQUIRED', message: "Complete this course's placement quiz first" },
    });
    renderLessonRoute(['/learn/lesson/lesson-1']);

    expect(await screen.findByRole('alert')).toHaveTextContent(/placement quiz first/i);
  });
});
