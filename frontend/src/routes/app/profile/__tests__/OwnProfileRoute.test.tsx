import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RebuildProvider } from '@/rebuild/design/controls';
import { OwnProfileRoute, parseOwnProfile } from '../OwnProfileRoute';

/*
 * P1 on its real data plane: what Core's GET /profile decides (tier, E.13
 * review, badges) is what the page shows, E.9 holds (no follower or
 * following number anywhere), and a child is never handed an invite link.
 */

const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), roles: [] as string[] }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
let authValue: Record<string, unknown> = {};
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => authValue }));

const wire = (extra: Record<string, unknown> = {}) => ({
  displayName: 'Ana Ruiz', username: 'ana_ruiz', memberSince: '2026-01-10T00:00:00Z', avatarOptions: {}, cover: { preset: 'forest' },
  learningStats: { xpPoints: 12450, minutesLearned: 1320, lessonsCompleted: 48, streakDays: 12, lastActiveDate: null },
  courseBadges: [{ slug: 'investing', title: { 'en-US': 'Smart Investing', 'es-MX': 'Inversión inteligente' }, badgeAsset: 'x.png', completedAt: '2026-08-14T12:00:00Z' }],
  social: { tier: 'adult', privateProfile: false }, profileReview: { flagged: false, fields: [] }, ...extra,
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.roles = [];
  authValue = { session: { user: { id: '33333333-3333-4333-8333-333333333333' } }, roles: mocks.roles, getToken: mocks.token };
  await i18n.changeLanguage('en-US');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { requests: [], nextOffset: null, users: [] }, error: null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })));
});

function renderProfile() {
  authValue = { ...authValue, roles: mocks.roles };
  return render(<MemoryRouter initialEntries={['/profile']}>
    <RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
      <Routes><Route path="/profile" element={<OwnProfileRoute />} /><Route path="*" element={<p>elsewhere</p>} /></Routes>
    </RebuildProvider>
  </MemoryRouter>);
}

describe('own profile (P1)', () => {
  it('shows the progress numbers and the badges, and no follower or following number anywhere (E.9)', async () => {
    mocks.api.mockResolvedValue({ data: wire(), error: null });
    renderProfile();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Ruiz' })).toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'Your progress' });
    for (const text of ['12', '48', '12,450', '1,320']) expect(within(progress).getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Smart Investing')).toBeInTheDocument();
    const people = screen.getByRole('region', { name: 'Followers and following' });
    expect(within(people).getByRole('link', { name: 'Followers' })).toHaveAttribute('href', '/profile/followers');
    expect(people.textContent).not.toMatch(/\d/);
    // Not in the same block as the progress numbers.
    expect(progress.contains(people)).toBe(false);
    expect(document.querySelector('[data-cover="forest"]')).not.toBeNull();
  });

  it('hands an adult an invite link and copies it, but never a child (E.1: their Tutor approves connections)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mocks.api.mockResolvedValue({ data: wire(), error: null });
    const { unmount } = renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`Learn with me on LittleFounders: ${window.location.origin}/@ana_ruiz`);
    unmount();

    mocks.roles = ['kid'];
    mocks.api.mockResolvedValue({ data: wire({ social: { tier: 'guardian', privateProfile: true } }), error: null });
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Ana Ruiz' });
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(screen.getByText('Your Tutor approves who you connect with.')).toBeInTheDocument();
    expect(document.querySelector('[data-screen="own-profile"]')?.getAttribute('data-age-band')).toBe('6-9');
  });

  it('tells a teen which field keeps the profile hidden (E.13) and shows their own connection requests (E.8)', async () => {
    mocks.api.mockResolvedValue({ data: wire({ social: { tier: 'teen', privateProfile: true }, profileReview: { flagged: true, fields: ['username'] } }), error: null });
    renderProfile();
    expect(await screen.findByText('Change your username in Settings.')).toBeInTheDocument();
    expect(await screen.findByText('Your profile is private. You choose who connects.')).toBeInTheDocument();
  });

  it('shows the Tutor pill on a verified parent\'s own profile, and a way to choose a username when there is none', async () => {
    mocks.roles = ['parent'];
    mocks.api.mockResolvedValue({ data: wire({ username: null, isTutor: true }), error: null });
    renderProfile();
    expect(await screen.findByText('Tutor')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Choose a username' })[0]).toHaveAttribute('href', '/profile/settings');
  });

  it('OD-6: shows the Tutor pill only when Core says the owner is a verified parent, whatever the roles say (W2P.3)', async () => {
    mocks.roles = ['parent'];
    mocks.api.mockResolvedValue({ data: wire({ isTutor: false }), error: null });
    renderProfile();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByText('Tutor')).toBeNull();
  });

  it('shows a retryable failure, and says so when the device is offline', async () => {
    mocks.api.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'Network error' } });
    renderProfile();
    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    mocks.api.mockResolvedValueOnce({ data: wire(), error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Ruiz' })).toBeInTheDocument();
  });

  it('moves inside the app when a link is pressed', async () => {
    mocks.api.mockResolvedValue({ data: wire(), error: null });
    renderProfile();
    fireEvent.click(await screen.findByRole('link', { name: 'Edit look' }));
    expect(await screen.findByText('elsewhere')).toBeInTheDocument();
  });
});

describe('parseOwnProfile', () => {
  it('refuses an answer without the fields the page relies on, and localises badge titles', () => {
    expect(parseOwnProfile(null, 'en-US', 's', false)).toBeNull();
    expect(parseOwnProfile(wire({ learningStats: { xpPoints: 'lots' } }), 'en-US', 's', false)).toBeNull();
    expect(parseOwnProfile(wire({ displayName: 42 }), 'en-US', 's', false)).toBeNull();
    const parsed = parseOwnProfile(wire(), 'es-MX', 's', false)!;
    expect(parsed.data.badges[0]!.title).toBe('Inversión inteligente');
    expect(parseOwnProfile(wire(), 'pt-BR', 's', false)!.data.badges[0]!.title).toBe('Smart Investing');
    expect(parseOwnProfile(wire({ social: { tier: 'public' } }), 'en-US', 's', false)!.data.tier).toBeNull();
    expect(parseOwnProfile(wire({ cover: { preset: 'https://example.com/x.png' } }), 'en-US', 's', false)!.data.cover).toBe('aurora');
    // OD-6: Core's verdict wins over the role; the role is only the fallback for an older Core.
    expect(parseOwnProfile(wire({ isTutor: true }), 'en-US', 's', false)!.data.tutor).toBe(true);
    expect(parseOwnProfile(wire({ isTutor: false }), 'en-US', 's', true)!.data.tutor).toBe(false);
    expect(parseOwnProfile(wire(), 'en-US', 's', true)!.data.tutor).toBe(true);
  });
});
