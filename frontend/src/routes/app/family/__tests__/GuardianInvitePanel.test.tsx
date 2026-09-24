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
    fireEvent.click(screen.getByRole('button', { name: 'Invite a second Tutor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(await screen.findByLabelText('invite link')).toHaveTextContent('https://app.test/family?join=');
    expect(mockApi).toHaveBeenCalledWith('/family/kids/kid/guardian-invite', { method: 'POST', token: 'session' });
  });

  it('reports a mint failure without a link', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'INTERNAL' } });
    render(<GuardianInvitePanel kidUserId="kid" token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite a second Tutor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the invite. Try again.');
    expect(screen.queryByLabelText('invite link')).toBeNull();
  });
});

describe('GuardianInviteJoin', () => {
  it('previews the kid name and accepts through the one-shot exchange', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: { linked: true }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    expect(await screen.findByText(/You were invited to supervise Ana/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('You are now linked as a second Tutor.')).toBeVisible();
    expect(mockApi).toHaveBeenLastCalledWith(`/family/guardian-invite/${'a'.repeat(32)}/accept`, { method: 'POST', token: 'session' });
  });

  it('treats an unknown or consumed invite as one expired state', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'NOT_FOUND' } });
    render(<GuardianInviteJoin inviteToken={'b'.repeat(32)} />);
    expect(await screen.findByText('This invite is no longer valid.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('refuses a malformed token shape without calling the API', async () => {
    render(<GuardianInviteJoin inviteToken={'not-a-token!@@'} />);
    expect(await screen.findByText('This invite is no longer valid.')).toBeVisible();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('keeps the accept card on a failed accept and lets the parent retry', async () => {
    mockApi.mockResolvedValueOnce({ data: { displayName: 'Ana' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL' } })
      .mockResolvedValueOnce({ data: { linked: true }, error: null });
    render(<GuardianInviteJoin inviteToken={'a'.repeat(32)} />);
    await screen.findByText(/You were invited to supervise Ana/);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Could not accept the invite. Try again.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('You are now linked as a second Tutor.')).toBeVisible();
  });
});
