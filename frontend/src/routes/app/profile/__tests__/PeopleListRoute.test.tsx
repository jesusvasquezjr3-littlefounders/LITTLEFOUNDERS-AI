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
 * GAP-FIX-R8 social (E.3, E.8): the viewer's own rows are addressed by user
 * id, handle-less ones included, and carry Report and Block.
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
    // An adult cannot remove a follower; every own row still carries Report and Block (E.3).
    expect(within(list).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(within(list).getAllByRole('button', { name: 'Report' })).toHaveLength(2);
    expect(within(list).getAllByRole('button', { name: 'Block' })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/\d/);
    expect(document.querySelector('.lf-people-column')!.textContent!.replace(/@\w+/g, '')).not.toMatch(/\d/);
    fireEvent.click(within(list).getByRole('link', { name: /Omar/ }));
    expect(await screen.findByText('elsewhere')).toBeInTheDocument();
  });

  it('P5: unfollows one of my own edges on Core\'s receipt, and keeps the row when it fails', async () => {
    let answer: Answer = refuse('INTERNAL');
    core({ 'GET /profile/following': ok({ users: PEOPLE }), 'GET /profile': me('adult'), 'DELETE /profile/following/id/u2': () => answer });
    renderAt('/profile/following');
    const list = await screen.findByRole('list', { name: 'Following' });
    const omar = within(list).getByRole('link', { name: /Omar/ }).closest('li')!;
    fireEvent.click(within(omar).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('Could not unfollow. Try again.')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Omar/ })).toBeInTheDocument();
    answer = ok({ userId: 'u2', following: false });
    fireEvent.click(within(omar).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('Unfollowed.')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /Omar/ })).toBeNull();
  });

  it('P5 for a child: asks before an unfollow it might not undo on its own, and Cancel sends nothing (E.1, W2P.3)', async () => {
    core({ 'GET /profile/following': ok({ users: PEOPLE }), 'GET /profile': me('guardian'), 'DELETE /profile/following/id/u2': ok({ userId: 'u2', following: false }) });
    renderAt('/profile/following');
    const list = await screen.findByRole('list', { name: 'Following' });
    const omar = () => within(within(list).getByRole('link', { name: /Omar/ }).closest('li')!).getByRole('button', { name: 'Unfollow' });
    fireEvent.click(omar());
    const dialog = await screen.findByRole('alertdialog', { name: 'Stop following?' });
    expect(dialog).toHaveTextContent('To follow again, you might have to ask again.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.api).not.toHaveBeenCalledWith('/profile/following/id/u2', expect.anything());
    fireEvent.click(omar());
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Stop following?' })).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('Unfollowed.')).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith('/profile/following/id/u2', expect.objectContaining({ method: 'DELETE' }));
    expect(within(list).queryByRole('link', { name: /Omar/ })).toBeNull();
  });

  it('P5 when the tier cannot be read: asks first, since the viewer might be a child (E.1, W2P.3)', async () => {
    core({ 'GET /profile/following': ok({ users: PEOPLE }), 'GET /profile': refuse('INTERNAL') });
    renderAt('/profile/following');
    const list = await screen.findByRole('list', { name: 'Following' });
    fireEvent.click(within(within(list).getByRole('link', { name: /Omar/ }).closest('li')!).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByRole('alertdialog', { name: 'Stop following?' })).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalledWith('/profile/following/id/u2', expect.anything());
  });

  it('P4 for an independent teen: removes a follower (E.8)', async () => {
    core({ 'GET /profile/followers': ok({ users: PEOPLE }), 'GET /profile': me('teen'), 'DELETE /profile/followers/id/u1': ok({ userId: 'u1', removed: true }) });
    renderAt('/profile/followers');
    const list = await screen.findByRole('list', { name: 'Followers' });
    fireEvent.click(within(within(list).getByRole('link', { name: /Luz Marina/ }).closest('li')!).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Removed. They no longer see your profile.')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('P4 for a teen: a follower without a @username is listed and reported and blocked by user id (E.3, E.8)', async () => {
    const pat = { userId: 'u9', displayName: 'Pat', username: null, avatarOptions: {}, isTutor: false };
    core({
      'GET /profile/followers': ok({ users: [pat, PEOPLE[1]] }), 'GET /profile': me('teen'),
      'POST /profile/connections/u9/report': ok({ userId: 'u9', reported: true, reportId: 'r1' }),
      'POST /profile/connections/u9/block': ok({ userId: 'u9', blocked: true }),
    });
    renderAt('/profile/followers');
    const list = await screen.findByRole('list', { name: 'Followers' });
    const row = () => within(within(list).getByText('Pat').closest('li')!);
    // No handle: no profile link, but every action is on the row.
    expect(row().queryByRole('link')).toBeNull();
    expect(row().getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    fireEvent.click(row().getByRole('button', { name: 'Report' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Report this account' }));
    fireEvent.click(dialog.getByRole('radio', { name: 'Unwanted contact' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Report sent. Thank you.')).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith('/profile/connections/u9/report', expect.objectContaining({ method: 'POST', body: { category: 'unwanted_contact' } }));
    fireEvent.click(row().getByRole('button', { name: 'Block' }));
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Block this account?' })).getByRole('button', { name: 'Block' }));
    expect(await screen.findByText('Blocked. You will not see each other.')).toBeInTheDocument();
    expect(within(list).queryByText('Pat')).toBeNull();
    expect(mocks.api).toHaveBeenCalledWith('/profile/connections/u9/block', expect.objectContaining({ method: 'POST' }));
  });

  it('P4 for a teen: removes a handle-less follower by user id; a receipt naming someone else is a failure', async () => {
    const pat = { userId: 'u9', displayName: 'Pat', username: null, avatarOptions: {}, isTutor: false };
    let answer: Answer = ok({ userId: 'u2', removed: true });
    core({ 'GET /profile/followers': ok({ users: [pat] }), 'GET /profile': me('teen'), 'DELETE /profile/followers/id/u9': () => answer });
    renderAt('/profile/followers');
    const list = await screen.findByRole('list', { name: 'Followers' });
    fireEvent.click(within(within(list).getByText('Pat').closest('li')!).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Could not remove. Try again.')).toBeInTheDocument();
    answer = ok({ userId: 'u9', removed: true });
    fireEvent.click(within(within(list).getByText('Pat').closest('li')!).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Removed. They no longer see your profile.')).toBeInTheDocument();
    expect(screen.queryByText('Pat')).toBeNull();
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
