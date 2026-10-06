import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { ThemeProvider } from '@/theme/useTheme';
import { childShelf, childTree } from '@/rebuild/learning/learnHomeFixtures';
import { clearCoursesCache } from '../coursesCache';
import { clearGamesCache, readGamesCache, writeGamesCache } from '@/games/kartrush/gamesCache';
import { LearnHomeRoute } from '../LearnHomeRoute';
import { playPath, PLAY_ROUTE_PATH } from '../paths';

/*
 * The "Play with {Mentor}" card on the Learn home: offered only when Core lists the
 * game as enabled for this learner, painted from what the learner last saw while a
 * fresh read goes out, and hidden (never an error, never a broken Learn) when that
 * read fails.
 */

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/lib/insights', async () => ({ ...(await vi.importActual<typeof import('@/lib/insights')>('@/lib/insights')), trackInsight: vi.fn() }));
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  const session = { user: { id: 'kid-1' } };
  return { useAuth: () => ({ getToken, session, profile: { display_name: 'Sofía Pérez' } }) };
});

const mockedApi = vi.mocked(api);
type Answer = { data: unknown; error: null } | { data: null; error: { code: string; message: string } };
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string): Answer => ({ data: null, error: { code, message: code } });
const RHYTHM = ok({
  streak: { model: 'rest-days-v1', status: 'open', current: 4, best: 12, daysPracticed: 41, restDaysLeft: 1, lastActiveDate: '2026-09-22', pause: null },
  pace: { goal: 2, chosen: true, passedToday: 1, goalMet: false }, mentor: { character: 'dina', chosen: true }, levers: ['path', 'mentor', 'pace'],
});
const list = (enabled: boolean) => ok({ games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 2, enabled }] });

function answer(games: Answer | 'pending', rhythm: Answer = RHYTHM) {
  const table: Record<string, Answer> = {
    '/learn/courses': ok(childShelf()), '/learn/courses/financial-education/path': refuse('PATHWAY_ENGINE_DISABLED'),
    '/learn/courses/financial-education/tree': ok(childTree()), '/learn/rhythm': rhythm, '/learn/bridges': ok({ prompts: [] }), '/learn/register': refuse('INTERNAL'),
  };
  mockedApi.mockImplementation((async (path: string) => {
    if (path === '/learn/games') return games === 'pending' ? new Promise(() => {}) : games;
    const entry = Object.entries(table).find(([prefix]) => path === prefix || path.startsWith(`${prefix}?`));
    return entry ? entry[1] : refuse('NOT_FOUND');
  }) as unknown as typeof api);
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderHome() {
  return render(<ThemeProvider><MemoryRouter initialEntries={['/learn']}>
    <Routes>
      <Route path="/learn" element={<LearnHomeRoute />} />
      <Route path={`/${PLAY_ROUTE_PATH}`} element={<p>the game</p>} />
    </Routes>
    <Where />
  </MemoryRouter></ThemeProvider>);
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mockedApi.mockReset();
  clearGamesCache();
  clearCoursesCache();
});
afterEach(() => { cleanup(); clearGamesCache(); clearCoursesCache(); });

describe('the game card on the Learn home', () => {
  it('names the learner\'s Mentor and opens the game', async () => {
    answer(list(true));
    renderHome();
    const link = await screen.findByRole('link', { name: "Let's race" });
    expect(await screen.findByRole('heading', { name: 'Play with Dina' })).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/learn/play/kartrush');
    expect(mockedApi).toHaveBeenCalledWith('/learn/games', expect.objectContaining({ token: 'token-123' }));
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/learn/play/kartrush'));
  });

  it('is one link, not a second call to action: the page keeps its one accent button', async () => {
    answer(list(true));
    renderHome();
    await screen.findByRole('link', { name: "Let's race" });
    expect(document.querySelectorAll('.lf-button--accent')).toHaveLength(1);
  });

  it.each([
    ['a game Core lists as off for this learner', list(false)],
    ['a list with no game in it', ok({ games: [] })],
    ['a list that fails', refuse('INTERNAL')],
    ['a route Core does not have yet', refuse('NOT_FOUND')],
    ['an answer that is not the contract', ok({ games: 'kartrush' })],
  ])('shows no card for %s, and Learn is whole without it', async (_label, games) => {
    answer(games);
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Streak' })).toBeTruthy();
    await waitFor(() => expect(mockedApi.mock.calls.some(([path]) => path === '/learn/games')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('link', { name: "Let's race" })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Needs and wants' })).toBeTruthy();
  });

  it('shows no card while the learner\'s Mentor is unknown, rather than a guessed character', async () => {
    answer(list(true), refuse('INTERNAL'));
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Streak' })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('link', { name: "Let's race" })).toBeNull();
  });

  it('paints from what the learner last saw while a fresh read is still out', async () => {
    writeGamesCache('kid-1', true);
    answer('pending');
    renderHome();
    expect(await screen.findByRole('link', { name: "Let's race" })).toBeTruthy();
  });

  it('never paints another learner\'s answer, and removes a card a failed read could not confirm', async () => {
    writeGamesCache('someone-else', true);
    answer('pending');
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Streak' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: "Let's race" })).toBeNull();
    cleanup();
    writeGamesCache('kid-1', true);
    answer(refuse('INTERNAL'));
    renderHome();
    await waitFor(() => expect(readGamesCache('kid-1')).toBeNull());
    expect(screen.queryByRole('link', { name: "Let's race" })).toBeNull();
  });

  it('refreshes the remembered answer from the fresh read', async () => {
    writeGamesCache('kid-1', true);
    answer(list(false));
    renderHome();
    await waitFor(() => expect(readGamesCache('kid-1')).toBe(false));
    await waitFor(() => expect(screen.queryByRole('link', { name: "Let's race" })).toBeNull());
  });

  it('speaks Spanish and Portuguese', async () => {
    answer(list(true));
    await i18n.changeLanguage('es-MX');
    const view = renderHome();
    expect(await screen.findByRole('heading', { name: 'Juega con Dina' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'A correr' })).toBeTruthy();
    view.unmount();
    await i18n.changeLanguage('pt-BR');
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Jogue com Dina' })).toBeTruthy();
  });
});

describe('the game route\'s address', () => {
  it('is built by playPath and matched by its own pattern, ahead of any course slug', () => {
    expect(playPath('kartrush')).toBe('/learn/play/kartrush');
    expect(PLAY_ROUTE_PATH).toBe('learn/play/:gameId');
    expect(playPath('a/b')).toBe('/learn/play/a%2Fb');
  });
});

describe('the game card cache', () => {
  it('is keyed by user and forgets', () => {
    writeGamesCache('a', true);
    expect(readGamesCache('a')).toBe(true);
    expect(readGamesCache('b')).toBeNull();
    expect(readGamesCache(null)).toBeNull();
    clearGamesCache();
    expect(readGamesCache('a')).toBeNull();
  });
});
