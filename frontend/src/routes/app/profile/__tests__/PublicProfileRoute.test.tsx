import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RebuildProvider } from '@/rebuild/design/controls';
import { PublicProfileRoute, connectFor, parsePublicProfile } from '../PublicProfileRoute';

/*
 * P6 on its real data plane. Core decides who is shown and how a viewer may
 * connect (E.1, E.5, E.8, E.13); the page shows exactly that, never a count
 * (E.9), never a way to write to the person (E.10), and Report and Block on
 * every profile but one's own (E.3). Every action waits for Core's receipt.
 */

type Answer = { data: unknown; error: { code: string; message?: string } | null };
const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), roles: [] as string[] }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
let authValue: Record<string, unknown> = {};
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => authValue }));

const full = (extra: Record<string, unknown> = {}) => ({
  visibility: 'full', displayName: 'Marta Solís', username: 'marta', cover: { preset: 'forest' }, avatarOptions: {}, memberSince: '2026-01-10T00:00:00Z',
  isFollowing: false, requiresGuardianApproval: false, connection: 'follow', isSelf: false, isTutor: false,
  learningStats: { xpPoints: 12450, minutesLearned: 1320, lessonsCompleted: 48, streakDays: 12, lastActiveDate: null },
  courseBadges: [{ slug: 'investing', title: { 'en-US': 'Smart Investing' }, badgeAsset: 'x.png', completedAt: '2026-08-14T12:00:00Z' }], ...extra,
});
const card = (extra: Record<string, unknown> = {}) => ({ visibility: 'private', username: 'rio', cover: { preset: 'grape' }, avatarOptions: {},
  isSelf: false, isFollowing: false, requiresGuardianApproval: false, connection: 'teenRequest', requestPending: false, ...extra });

/** Answers by method and path; anything unlisted is a test failure. */
function core(routes: Record<string, Answer | ((body: unknown) => Answer)>) {
  mocks.api.mockImplementation(async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const key = `${options.method ?? 'GET'} ${path}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected request ${key}`);
    return typeof answer === 'function' ? answer(options.body) : answer;
  });
}
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string): Answer => ({ data: null, error: { code, message: code } });

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.roles = [];
  authValue = { session: { user: { id: '33333333-3333-4333-8333-333333333333' } }, roles: mocks.roles, getToken: mocks.token };
  await i18n.changeLanguage('en-US');
});

function renderAt(path = '/@marta') {
  authValue = { ...authValue, roles: mocks.roles };
  return render(<MemoryRouter initialEntries={[path]}>
    <RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
      <Routes>
        <Route path="/learn" element={<p>home</p>} />
        <Route path="/:handle" element={<PublicProfileRoute />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </RebuildProvider>
  </MemoryRouter>);
}

describe('public profile (P6)', () => {
  it('shows only the whitelisted fields, the progress and the lists with no number beside them (E.9, E.13, E.10)', async () => {
    core({ 'GET /profiles/marta': ok(full({ email: 'marta@example.com', birthDate: '2012-02-02', school: 'Lincoln Elementary',
      learningStats: { xpPoints: 12450, minutesLearned: 1320, lessonsCompleted: 48, streakDays: 12, lastActiveDate: '2026-09-25' } })) });
    const { container } = renderAt();
    expect(await screen.findByRole('heading', { level: 1, name: 'Marta Solís' })).toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'Progress' });
    for (const text of ['12', '48', '12,450', '1,320']) expect(within(progress).getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Smart Investing')).toBeInTheDocument();
    const people = screen.getByRole('region', { name: 'Followers and following' });
    expect(within(people).getByRole('link', { name: 'Followers' })).toHaveAttribute('href', '/@marta/followers');
    expect(within(people).getByRole('link', { name: 'Following' })).toHaveAttribute('href', '/@marta/following');
    expect(people.textContent).not.toMatch(/\d/);
    expect(progress.contains(people)).toBe(false);
    for (const leak of ['marta@example.com', '2012', 'Lincoln', '2026-09-25', 'Sep 25']) expect(container.textContent).not.toContain(leak);
    // E.10: no way to write to the person.
    expect(screen.queryByRole('button', { name: /message|chat|say hi/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /message|chat/i })).toBeNull();
    // E.5: no Tutor pill unless Core says so.
    expect(screen.queryByText('Tutor')).toBeNull();
  });

  it('shows the Tutor pill exactly when Core\'s relationship-bound verdict says so (E.5)', async () => {
    core({ 'GET /profiles/marta': ok(full({ isTutor: true })) });
    renderAt();
    expect(await screen.findByText('Tutor')).toBeInTheDocument();
  });

  it('follows only on Core\'s receipt, and keeps Follow when it fails', async () => {
    let following = false;
    core({
      'GET /profiles/marta': ok(full()),
      'POST /profiles/marta/follow': () => (following ? ok({ following: true }) : refuse('INTERNAL')),
      'DELETE /profiles/marta/follow': ok({ following: false }),
    });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByText('That did not work. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    following = true;
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(await screen.findByRole('button', { name: 'Unfollow' })).toBeInTheDocument();
    expect(screen.getByText('Following', { selector: 'span' })).toBeInTheDocument();
    // An adult's open profile: unfollowing needs no confirmation and keeps the page.
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });

  it('confirms before unfollowing a child, then leaves the profile it can no longer see (E.1)', async () => {
    core({
      'GET /profiles/marta': ok(full({ isFollowing: true, requiresGuardianApproval: true, connection: 'guardianRequest' })),
      'DELETE /profiles/marta/follow': ok({ following: false }),
    });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Unfollow' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Stop following?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.api).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Unfollow' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('asks a child\'s Tutor to approve, and shows pending only for a pending receipt with no follow (E.1)', async () => {
    let receipt: Answer = ok({ requestId: 'r1', status: 'pending', following: true, decidedBy: 'guardian' });
    core({ 'GET /profiles/marta': ok(full({ requiresGuardianApproval: true, connection: 'guardianRequest' })),
      'POST /profiles/marta/connection-request': (body) => { expect(body).toEqual({}); return receipt; } });
    renderAt();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask to connect' }));
    expect(await screen.findByText('Not sent. Try again.')).toBeInTheDocument();
    receipt = ok({ requestId: 'r1', status: 'pending', following: false, decidedBy: 'guardian' });
    fireEvent.click(screen.getByRole('button', { name: 'Ask to connect' }));
    expect(await screen.findByText('Asked. Their Tutor decides.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask to connect' })).toBeDisabled();
  });

  it('shows a private teen as the card only: the handle, one ask the teen decides, and Report and Block (E.8)', async () => {
    core({ 'GET /profiles/rio': ok(card()), 'POST /profiles/rio/connection-request': refuse('SOCIAL_REQUEST_COOLDOWN') });
    const { container } = renderAt('/@rio');
    expect(await screen.findByRole('heading', { level: 1, name: '@rio' })).toBeInTheDocument();
    expect(screen.getByText('This profile is private')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Progress' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Followers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask to connect' }));
    expect(await screen.findByText('You can ask again later.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('a pending ask stays pending when the teen has not decided yet', async () => {
    core({ 'GET /profiles/rio': ok(card({ requestPending: true })) });
    renderAt('/@rio');
    expect(await screen.findByText('Asked. They decide.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask to connect' })).toBeDisabled();
  });

  it('a child viewer gets its Tutor line instead of any way to connect, at the youngest copy budget', async () => {
    mocks.roles = ['kid'];
    core({ 'GET /profiles/marta': ok(full({ connection: 'managed' })), 'GET /profiles/rio': ok(card({ connection: 'managed' })) });
    const { unmount } = renderAt();
    expect(await screen.findByText('Your Tutor handles your connections.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask to connect' })).toBeNull();
    expect(document.querySelector('[data-screen="public-profile"]')?.getAttribute('data-age-band')).toBe('6-9');
    unmount();
    renderAt('/@rio');
    expect(await screen.findByText('Your Tutor handles your connections.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask to connect' })).toBeNull();
  });

  it('blocks only after a confirmation that names the consequence, then leaves (E.3)', async () => {
    let answer: Answer = refuse('INTERNAL');
    core({ 'GET /profiles/marta': ok(full()), 'POST /profiles/marta/block': () => answer });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Block' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Block this account?' });
    expect(dialog).toHaveTextContent('You will not see each other. You can unblock in Settings.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block' }));
    expect(await screen.findByText('Could not block. Try again.')).toBeInTheDocument();
    answer = ok({ blocked: true });
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Block' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('reports with a chosen reason and an optional note, keeps both when sending fails (E.3)', async () => {
    const bodies: unknown[] = [];
    let answer: Answer = refuse('DATA_UNAVAILABLE');
    core({ 'GET /profiles/marta': ok(full()), 'POST /profiles/marta/report': (body) => { bodies.push(body); return answer; } });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Report' }));
    const dialog = await screen.findByRole('dialog', { name: 'Report this account' });
    expect(dialog).toHaveTextContent('Only our safety team reads this.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(within(dialog).getByText('Choose what is happening.')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Harassment or bullying' }));
    const note = within(dialog).getByRole('textbox', { name: 'Tell us more (optional)' });
    expect(note).toHaveAttribute('maxLength', '140');
    fireEvent.change(note, { target: { value: '  mean words  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(await within(dialog).findByText('The report was not sent. Try again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Harassment or bullying' })).toBeChecked();
    expect(note).toHaveValue('  mean words  ');
    answer = ok({ reported: true, reportId: 'x' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Report sent. Thank you.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bodies).toEqual([{ category: 'harassment', note: 'mean words' }, { category: 'harassment', note: 'mean words' }]);
  });

  it('on one\'s own profile offers the way to edit it and no Report, Block or Follow', async () => {
    core({ 'GET /profiles/marta': ok(full({ isSelf: true, connection: 'none' })) });
    renderAt();
    expect(await screen.findByRole('link', { name: 'Edit my profile' })).toHaveAttribute('href', '/profile');
    for (const name of ['Report', 'Block', 'Follow']) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('says a profile is not available without saying why, and retries a failure', async () => {
    core({ 'GET /profiles/marta': refuse('NOT_FOUND') });
    const { unmount } = renderAt();
    expect(await screen.findByRole('heading', { level: 1, name: 'This profile is not available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Learn' })).toHaveAttribute('href', '/learn');
    unmount();
    mocks.api.mockReset();
    mocks.api.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'Network error' } });
    renderAt();
    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    mocks.api.mockResolvedValueOnce({ data: { ...full(), learningStats: null }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This profile did not load')).toBeInTheDocument();
  });

  it('sends an address without "@" home, and never asks Core about a malformed handle', async () => {
    renderAt('/marta');
    expect(await screen.findByText('home')).toBeInTheDocument();
    renderAt('/@a');
    expect(await screen.findByText('This profile is not available')).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});

describe('parsePublicProfile and connectFor', () => {
  it('refuses answers for another handle or without the fields the page relies on', () => {
    expect(parsePublicProfile(full(), 'en-US', 'someone_else')).toBeNull();
    expect(parsePublicProfile(full({ isTutor: 'yes' }), 'en-US', 'marta')).toBeNull();
    expect(parsePublicProfile(full({ visibility: 'public' }), 'en-US', 'marta')).toBeNull();
    expect(parsePublicProfile(card({ requestPending: undefined }), 'en-US', 'rio')).toBeNull();
  });

  it('maps Core\'s connection modes, and keeps the child-only rule for an older answer without one', () => {
    const mode = (extra: Record<string, unknown>) => connectFor(parsePublicProfile(full(extra), 'en-US', 'marta')!);
    expect(mode({ connection: 'follow' })).toMatchObject({ kind: 'follow', following: false });
    expect(mode({ connection: 'teenRequest', isFollowing: true })).toMatchObject({ kind: 'follow', following: true, leaving: true });
    expect(mode({ connection: 'teenRequest' })).toEqual({ kind: 'request', decidedBy: 'subject', status: 'idle' });
    expect(mode({ connection: 'managed' })).toEqual({ kind: 'managed' });
    expect(mode({ connection: 'none' })).toEqual({ kind: 'none' });
    expect(mode({ connection: undefined, requiresGuardianApproval: true })).toEqual({ kind: 'request', decidedBy: 'guardian', status: 'idle' });
    expect(mode({ connection: undefined })).toMatchObject({ kind: 'follow' });
    expect(mode({ isSelf: true })).toEqual({ kind: 'self' });
    expect(connectFor(parsePublicProfile(card({ connection: 'none' }), 'en-US', 'rio')!)).toEqual({ kind: 'none' });
  });
});
