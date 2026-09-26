import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RebuildProvider } from '@/rebuild/design/controls';
import { OwnFollowersRoute, OwnFollowingRoute, PublicFollowersRoute, PublicFollowingRoute, parsePeople } from '../PeopleListRoute';

/*
 * P4, P5, P7 and P8 on their real data plane: people, never a number (E.9);
 * the Tutor pill exactly as Core bound it (E.5); the viewer's own edges only
 * (P5 unfollow, and E.8's remove for an independent teen); a child's lists say
 * who approves its connections and a guest has none (E.1, OD-3).
 */

type Answer = { data: unknown; error: { code: string; message?: string } | null };
const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), roles: [] as string[] }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
let authValue: Record<string, unknown> = {};
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => authValue }));

const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string): Answer => ({ data: null, error: { code, message: code } });
const PEOPLE = [
  { userId: 'u1', displayName: 'Luz Marina', username: 'luz_m', avatarOptions: {}, isTutor: true },
  { userId: 'u2', displayName: 'Omar', username: 'omar', avatarOptions: {}, isTutor: false },
];
const me = (tier: string) => ok({ displayName: 'Me', username: 'me', social: { tier } });

function core(routes: Record<string, Answer | (() => Answer)>) {
  mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => {
    const key = `${options.method ?? 'GET'} ${path}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected request ${key}`);
    return typeof answer === 'function' ? answer() : answer;
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.roles = [];
  authValue = { session: { user: { id: 'viewer' } }, roles: mocks.roles, getToken: mocks.token };
  await i18n.changeLanguage('en-US');
});

function renderAt(path: string) {
  authValue = { ...authValue, roles: mocks.roles };
  return render(<MemoryRouter initialEntries={[path]}>
    <RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
      <Routes>
        <Route path="/learn" element={<p>home</p>} />
        <Route path="/profile/followers" element={<OwnFollowersRoute />} />
        <Route path="/profile/following" element={<OwnFollowingRoute />} />
        <Route path="/:handle/followers" element={<PublicFollowersRoute />} />
        <Route path="/:handle/following" element={<PublicFollowingRoute />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </RebuildProvider>
  </MemoryRouter>);
}

describe('people lists (P4, P5, P7, P8)', () => {
  it('P4: lists my followers as people who open their profiles, with the Tutor pill as Core bound it, and no number (E.5, E.9)', async () => {
    core({ 'GET /profile/followers': ok({ users: PEOPLE }), 'GET /profile': me('adult') });
    renderAt('/profile/followers');
    expect(await screen.findByRole('heading', { level: 1, name: 'Followers' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Followers' });
    expect(within(list).getByRole('link', { name: /Luz Marina/ })).toHaveAttribute('href', '/@luz_m');
    expect(within(list).getAllByText('Tutor')).toHaveLength(1);
    // An adult's followers are read-only.
    expect(within(list).queryByRole('button')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/\d/);
    expect(document.querySelector('.lf-people-column')!.textContent!.replace(/@\w+/g, '')).not.toMatch(/\d/);
    fireEvent.click(within(list).getByRole('link', { name: /Omar/ }));
    expect(await screen.findByText('elsewhere')).toBeInTheDocument();
  });

  it('P5: unfollows one of my own edges on Core\'s receipt, and keeps the row when it fails', async () => {
    let answer: Answer = refuse('INTERNAL');
    core({ 'GET /profile/following': ok({ users: PEOPLE }), 'GET /profile': me('adult'), 'DELETE /profiles/omar/follow': () => answer });
    renderAt('/profile/following');
    const list = await screen.findByRole('list', { name: 'Following' });
    const omar = within(list).getByRole('link', { name: /Omar/ }).closest('li')!;
    fireEvent.click(within(omar).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('Could not unfollow. Try again.')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Omar/ })).toBeInTheDocument();
    answer = ok({ following: false });
    fireEvent.click(within(omar).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('Unfollowed.')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /Omar/ })).toBeNull();
  });

  it('P4 for an independent teen: removes a follower (E.8)', async () => {
    core({ 'GET /profile/followers': ok({ users: PEOPLE }), 'GET /profile': me('teen'), 'DELETE /profile/followers/luz_m': ok({ removed: true }) });
    renderAt('/profile/followers');
    const list = await screen.findByRole('list', { name: 'Followers' });
    fireEvent.click(within(within(list).getByRole('link', { name: /Luz Marina/ }).closest('li')!).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Removed. They no longer see your profile.')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('a child\'s own lists say its Tutor approves its connections, at the youngest copy budget (E.1)', async () => {
    mocks.roles = ['kid'];
    core({ 'GET /profile/followers': ok({ users: [] }), 'GET /profile': me('guardian') });
    renderAt('/profile/followers');
    expect(await screen.findByText('Your Tutor approves who you connect with.')).toBeInTheDocument();
    expect(screen.getByText('No followers yet')).toBeInTheDocument();
    expect(document.querySelector('[data-screen="people-list"]')?.getAttribute('data-age-band')).toBe('6-9');
  });

  it('a guest has no social layer (OD-3)', async () => {
    core({ 'GET /profile/following': ok({ users: [] }), 'GET /profile': me('closed') });
    renderAt('/profile/following');
    expect(await screen.findByText('Guests have no connections')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('P7 and P8: another person\'s lists are read-only, name whose they are, and say so when the profile is not available', async () => {
    core({ 'GET /profiles/marta/followers': ok({ users: PEOPLE }), 'GET /profiles/marta/following': refuse('NOT_FOUND') });
    const { unmount } = renderAt('/@marta/followers');
    const list = await screen.findByRole('list', { name: 'Followers' });
    expect(screen.getByText('@marta')).toBeInTheDocument();
    expect(within(list).queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/@marta');
    unmount();
    renderAt('/@marta/following');
    expect(await screen.findByText('This list is not available')).toBeInTheDocument();
  });

  it('shows a retryable failure for a malformed or unreachable answer, never an empty list', async () => {
    mocks.api.mockImplementation(async (path: string) => path === '/profile' ? me('adult') : { data: null, error: { code: 'INTERNAL', message: 'Network error' } });
    renderAt('/profile/followers');
    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    mocks.api.mockImplementation(async (path: string) => path === '/profile' ? me('adult') : ok({ users: 'nobody' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('The list did not load')).toBeInTheDocument();
    expect(screen.queryByText('No followers yet')).toBeNull();
  });
});

describe('parsePeople', () => {
  it('accepts only lists of people, and a handle only when it is a real one', () => {
    expect(parsePeople({ users: 'x' })).toBeNull();
    expect(parsePeople({ users: [{ userId: 1, displayName: 'x', username: null }] })).toBeNull();
    const [row] = parsePeople({ users: [{ userId: 'a', displayName: 'Ana', username: '../admin', isTutor: 'yes' }] })!;
    expect(row).toMatchObject({ userId: 'a', username: null, tutor: false });
  });
});
