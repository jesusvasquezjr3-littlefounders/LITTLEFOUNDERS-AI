import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GuardianInviteJoin, GuardianInvitePanel } from '../GuardianInvitePanel';

/*
 * A.1's second-verified-guardian surfaces: the mint panel creates the
 * single-use invite link for one kid (server-enforced authorization — the
 * panel just renders the transport result), and the join card previews the
 * kid's display name, accepts through the one-shot exchange, and treats an
 * invalid or consumed invite as one indistinguishable expired state.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
// Stable across renders, like the real AuthContext's useCallback-stable getToken.
const stableGetToken = () => Promise.resolve('session');
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: stableGetToken }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

beforeEach(() => mockApi.mockReset());
Object.defineProperty(window, 'location', { value: { origin: 'https://app.test' }, writable: true });

describe('GuardianInvitePanel', () => {
  it('mints an invite and renders the single-use link', async () => {
    mockApi.mockResolvedValue({ data: { token: 'a'.repeat(32) }, error: null });
    render(<GuardianInvitePanel kidUserId="kid" token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite a Tutor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    const link = await screen.findByText(/^https:\/\/app\.test\/family\?join=/);
    // 02 rule 11 and 06 §7: the link is data at the 14 px caption size, named by its own visible text (no hard-coded English label).
    expect(link).toHaveAttribute('data-copy-role', 'data');
    expect(link).not.toHaveAttribute('aria-label');
    expect(link).toHaveClass('lf-guardian-invite-link-value');
    expect(readFileSync(resolve(__dirname, '../../../../rebuild/family/guardianInvite.css'), 'utf8'))
      .toMatch(/\.lf-guardian-invite-link-value \{[^}]*font: var\(--type-caption\);/);
    expect(mockApi).toHaveBeenCalledWith('/family/kids/kid/guardian-invite', { method: 'POST', token: 'session' });
  });

  it('reports a mint failure without a link', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL' } });
    render(<GuardianInvitePanel kidUserId="kid" token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite a Tutor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the invite. Try again.');
    expect(screen.queryByText(/family\?join=/)).toBeNull();
  });
});

describe('GuardianInviteJoin', () => {
  it('previews the kid name and accepts through the one-shot exchange', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: { linked: true, status: 'verified' }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    expect(await screen.findByText(/You were invited to supervise Ana/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('You are now linked as a second Tutor.')).toBeVisible();
    expect(mockApi).toHaveBeenLastCalledWith(`/family/guardian-invite/${'a'.repeat(32)}/accept`, { method: 'POST', token: 'session' });
  });

  it('reports an accepted invite as waiting for the current Tutor, never as linked (S07.1)', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: { linked: false, status: 'pending' }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    await screen.findByText(/You were invited to supervise Ana/);
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText("Joined. The child's Tutor will confirm you next.")).toBeVisible();
    expect(screen.queryByText('You are now linked as a second Tutor.')).toBeNull();
  });

  it('refuses a contradictory receipt instead of guessing', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: { linked: true, status: 'pending' }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    await screen.findByText(/You were invited to supervise Ana/);
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('Could not join. Try again.')).toBeVisible();
  });

  it('treats an unknown or consumed invite as one expired state', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'NOT_FOUND' } });
    render(<GuardianInviteJoin inviteToken={'b'.repeat(32)} />);
    expect(await screen.findByText('This invite is no longer valid.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });

  it('refuses a malformed token shape without calling the API', async () => {
    render(<GuardianInviteJoin inviteToken={'not-a-token!@@'} />);
    expect(await screen.findByText('This invite is no longer valid.')).toBeVisible();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('keeps the accept card on a failed accept and lets the parent retry', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL' } })
      .mockResolvedValueOnce({ data: { linked: true, status: 'verified' }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    await screen.findByText(/You were invited to supervise Ana/);
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('Could not join. Try again.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('You are now linked as a second Tutor.')).toBeVisible();
  });
});
