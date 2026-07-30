import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GamesReviewQueue, type AdminReviewGame } from '../GamesReviewQueue';
import type { Loadable } from '../adminShared';

/*
 * The Games queue is the human publish gate (§1.9): the only thing standing
 * between a generated game and a child. These tests pin the two properties that
 * make it a gate rather than a list — a status change NEVER fires without an
 * explicit confirmation, and a game with no judge rubric says so instead of
 * rendering as if it had passed.
 */

const { mockGetToken, mockApi } = vi.hoisted(() => ({
  mockGetToken: vi.fn().mockResolvedValue('test-admin-token'),
  mockApi: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: mockApi,
  BASE_URL: 'http://localhost:4000',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US', changeLanguage: () => new Promise(() => {}) },
  }),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ roles: ['admin'], getToken: mockGetToken }),
}));

const GAME: AdminReviewGame = {
  id: '3f1b6c2e-6a51-4a1f-9f4b-2c8d0e7a1b45',
  slug: 'sort-the-savings',
  title: 'Sort the Savings',
  mechanic: 'sorter',
  tier: 2,
  xpMax: 15,
  estimatedMinutes: 3,
  status: 'review',
  courseTitle: 'Money Basics',
  courseSlug: 'money-basics',
  topicTitle: 'Needs vs wants',
  topicPath: 'first-steps/spending/needs-vs-wants',
  locales: ['en-US', 'es-MX', 'pt-BR'],
  rubric: { concept_fit: 5, fun_agency: 4, clarity: 4, kid_safety: 5, difficulty_fairness: 3 },
};

function ready(games: AdminReviewGame[]): Loadable<{ games: AdminReviewGame[] }> {
  return { state: 'ready', data: { games } };
}

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({ data: {}, error: null });
});

describe('GamesReviewQueue', () => {
  it('renders the empty state when nothing is awaiting review', () => {
    render(<GamesReviewQueue data={ready([])} reload={vi.fn()} />);
    expect(screen.getByText('admin.games.empty')).toBeInTheDocument();
  });

  it('surfaces an unreachable queue instead of an empty one', () => {
    render(<GamesReviewQueue data={{ state: 'error', code: 'DATA_UNAVAILABLE' }} reload={vi.fn()} />);
    expect(screen.getByText('admin.unavailable.title')).toBeInTheDocument();
  });

  it('shows what a reviewer needs to decide: mechanic, binding and rubric', () => {
    render(<GamesReviewQueue data={ready([GAME])} reload={vi.fn()} />);
    expect(screen.getByText('Sort the Savings')).toBeInTheDocument();
    expect(screen.getByText('games.mechanics.sorter.title')).toBeInTheDocument();
    expect(screen.getByText('Money Basics')).toBeInTheDocument();
    expect(screen.getByText('Needs vs wants')).toBeInTheDocument();
    for (const dim of ['concept_fit', 'fun_agency', 'clarity', 'kid_safety', 'difficulty_fairness']) {
      expect(screen.getAllByText(`admin.games.dims.${dim}`).length).toBeGreaterThan(0);
    }
  });

  it('says a game was never judged rather than rendering a blank rubric', () => {
    render(<GamesReviewQueue data={ready([{ ...GAME, rubric: null }])} reload={vi.fn()} />);
    expect(screen.getByText('admin.games.rubricEmpty')).toBeInTheDocument();
    expect(screen.queryByText('admin.games.rubricTitle')).not.toBeInTheDocument();
  });

  it('never publishes on a single click — the confirm step is the gate', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<GamesReviewQueue data={ready([GAME])} reload={reload} />);

    fireEvent.click(screen.getByText('admin.games.publish'));
    expect(mockApi).not.toHaveBeenCalled();
    expect(screen.getByText('admin.games.confirmPublish.title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('admin.games.confirmPublish.confirm'));
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
    expect(mockApi).toHaveBeenCalledWith(`/admin/games/${GAME.id}/status`, {
      method: 'POST',
      body: { status: 'published' },
      token: 'test-admin-token',
    });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('cancelling the archive confirm changes nothing', () => {
    render(<GamesReviewQueue data={ready([GAME])} reload={vi.fn()} />);
    fireEvent.click(screen.getByText('admin.games.archive'));
    fireEvent.click(screen.getByText('admin.games.confirmArchive.cancel'));
    expect(mockApi).not.toHaveBeenCalled();
    expect(screen.queryByText('admin.games.confirmArchive.title')).not.toBeInTheDocument();
  });
});
