import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '@/lib/api';
import type { CatalogCourse, CatalogGame, GameCompletionResponse } from './api';
import { toServerGameResult } from './api';
import { GamesHubPage, buildHubGroups, pickPrimaryGameId } from './GamesHubPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
// getToken must be a STABLE reference — the page's fetch effect depends on it.
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken }) };
});

const mockedApi = vi.mocked(api);

function game(overrides: Partial<CatalogGame> & Pick<CatalogGame, 'id' | 'slug'>): CatalogGame {
  return {
    title: { 'en-US': `Game ${overrides.id}` },
    mechanic: 'sorter',
    tier: 1,
    xp_max: 10,
    estimated_minutes: 3,
    position: 1,
    state: 'ready',
    best_score: 0,
    plays: 0,
    passed: false,
    xp_earned: 0,
    last_played_at: null,
    ...overrides,
  };
}

/** One course → one adventure → two topics: three playable games and one locked. */
const fixture: CatalogCourse[] = [
  {
    id: 'course-1',
    slug: 'money-basics',
    title: { 'en-US': 'Money Basics' },
    subject: 'money',
    adventures: [
      {
        id: 'adv-1',
        slug: 'adv-1',
        title: { 'en-US': 'Trading Islands' },
        theme: 'archipelago',
        position: 1,
        topics: [
          {
            id: 'topic-1',
            slug: 'what-is-money',
            title: { 'en-US': 'What is money' },
            position: 1,
            unlocked: true,
            games: [
              game({ id: 'g-ready', slug: 'sort-the-coins' }),
              game({ id: 'g-played', slug: 'stack-it', state: 'played', plays: 2, best_score: 40 }),
              game({ id: 'g-passed', slug: 'run-it', state: 'played', plays: 3, best_score: 90, passed: true }),
            ],
          },
          {
            id: 'topic-2',
            slug: 'saving',
            title: { 'en-US': 'Saving up' },
            position: 2,
            unlocked: false,
            games: [game({ id: 'g-locked', slug: 'save-it', state: 'locked' })],
          },
        ],
      },
    ],
  },
];

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/games']}>
      <GamesHubPage />
    </MemoryRouter>,
  );
}

describe('GamesHubPage', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('renders one Card-grid section per course → adventure, with gap-4 at every breakpoint', async () => {
    mockedApi.mockResolvedValue({ data: { courses: fixture }, error: null });
    const { container } = renderHub();

    expect(await screen.findByText('Trading Islands')).toBeInTheDocument();
    expect(screen.getByText('Money Basics')).toBeInTheDocument();

    const grid = container.querySelector('section[aria-labelledby] > div.grid');
    expect(grid).not.toBeNull();
    // DESIGN §Layout → Grid Systems, Card grid category. A breakpoint-specific
    // gap reads as accidental rather than designed, so gap-4 is unconditional.
    for (const cls of ['grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-4']) {
      expect(grid?.className.split(' ')).toContain(cls);
    }
  });

  it('spends papaya once per VIEW — on the next/resume game only', async () => {
    mockedApi.mockResolvedValue({ data: { courses: fixture }, error: null });
    const { container } = renderHub();
    await screen.findByText('Trading Islands');

    const papaya = container.querySelectorAll('.bg-accent');
    expect(papaya).toHaveLength(1);
    expect(container.querySelector('a[href="/games/sort-the-coins"] .bg-accent')).not.toBeNull();
    // …and never on an already-passed card.
    expect(container.querySelector('a[href="/games/run-it"] .bg-accent')).toBeNull();
  });

  it('renders locked games (never hides them) and reveals the unlock reason on activation', async () => {
    mockedApi.mockResolvedValue({ data: { courses: fixture }, error: null });
    renderHub();
    await screen.findByText('Trading Islands');

    // Locked, not hidden: the card is present and reachable.
    const toggle = screen.getByRole('button', { expanded: false });
    expect(screen.getByText('Game g-locked')).toBeInTheDocument();
    // A locked card is not a link into the player.
    expect(document.querySelector('a[href="/games/save-it"]')).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { expanded: true })).toBe(toggle);
    // The reason names the topic and links to where that topic is learned.
    expect(screen.getAllByText('Saving up').length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="/learn/money-basics"]')).not.toBeNull();
  });

  it('shows the empty state only when the learner genuinely has no games', async () => {
    mockedApi.mockResolvedValue({ data: { courses: [] }, error: null });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/arcade is warming up/i)).toBeInTheDocument();
    });
  });

  it('surfaces an API failure through the shared error banner', async () => {
    mockedApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'boom' } });
    renderHub();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('pickPrimaryGameId', () => {
  it('picks the first unlocked, not-yet-passed game in curriculum order', () => {
    expect(pickPrimaryGameId(buildHubGroups(fixture))).toBe('g-ready');
  });

  it('leaves the view with no papaya when every unlocked game is passed', () => {
    const allPassed: CatalogCourse[] = [
      {
        ...fixture[0]!,
        adventures: [
          {
            ...fixture[0]!.adventures[0]!,
            topics: [
              {
                ...fixture[0]!.adventures[0]!.topics[0]!,
                games: [game({ id: 'g1', slug: 'g1', state: 'played', plays: 1, passed: true })],
              },
            ],
          },
        ],
      },
    ];
    expect(pickPrimaryGameId(buildHubGroups(allPassed))).toBeNull();
  });
});

describe('toServerGameResult', () => {
  const base: GameCompletionResponse = {
    score: 80,
    passed: true,
    stats: {},
    best_score: 80,
    plays: 1,
    xp_earned: 8,
    xp_delta: 8,
    streak_days: 1,
    longest_streak: 1,
    streak_extended: true,
    first_today: true,
    minutes_delta: 1,
    minutes_learned: 10,
  };

  it('reports the XP this run actually granted, not the all-time total', () => {
    // A repeat run that does not beat the previous best grants nothing, and the
    // results screen must not claim a reward that was never given.
    const repeat = toServerGameResult({ ...base, plays: 4, score: 60, best_score: 90, xp_earned: 9, xp_delta: 0 });
    expect(repeat.xp_earned).toBe(0);
    expect(repeat.new_best).toBe(false);
    expect(repeat.best_score).toBe(90);
  });

  it('treats the first recorded play as a new best', () => {
    expect(toServerGameResult(base).new_best).toBe(true);
    expect(toServerGameResult({ ...base, score: 0, best_score: 0, xp_delta: 0 }).new_best).toBe(false);
  });
});
