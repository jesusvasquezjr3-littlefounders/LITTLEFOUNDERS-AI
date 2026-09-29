import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import en from '@/i18n/en-US/rebuild-profile.json';
import { TeenAnalyticsDisclosure } from '../TeenAnalyticsDisclosure';

/*
 * H.1 and Appendix O 2.2(a) (F3-identity-site): the self-managed analytics
 * disclosure is presented to every self-registered teen on the first app
 * session, with two explicit answers, and comes back each session until a
 * choice is on file. Who sees it is Core's answer; a kid-role account or a
 * guest is never even asked.
 */
const copy = en.analyticsChoice;
const mocks = vi.hoisted(() => ({
  api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic'), refreshMe: vi.fn().mockResolvedValue(undefined), configure: vi.fn(),
  auth: { session: { user: { id: 'teen-1' } } as { user: { id: string } } | null, isGuest: false, roles: ['universal'] as string[], meLoaded: true },
}));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/lib/insights', () => ({ configureInsights: mocks.configure }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ ...mocks.auth, getToken: mocks.getToken, refreshMe: mocks.refreshMe }) }));

const answer = (preference: { canManage: boolean; enabled: boolean; disclosed: boolean }) => ({ data: preference, error: null });
const undecided = answer({ canManage: true, enabled: false, disclosed: false });
const methodOf = (call: unknown[]) => (call[1] as { method?: string }).method;

let seq = 0;
beforeEach(async () => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mocks.auth = { session: { user: { id: `teen-${++seq}` } }, isGuest: false, roles: ['universal'], meLoaded: true };
  await i18n.changeLanguage('en-US');
});

describe('the first-session analytics step', () => {
  it('shows a teen with no choice on file the whole disclosure and two equal answers', async () => {
    mocks.api.mockResolvedValue(undecided);
    render(<TeenAnalyticsDisclosure />);
    const dialog = await screen.findByRole('dialog', { name: copy.title });
    for (const text of [copy.purpose, copy.events, copy.lessons, copy.excluded, copy.history, copy.safety, copy.choose]) {
      expect(dialog).toHaveTextContent(text);
    }
    expect(screen.getByRole('button', { name: copy.keepOff })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.turnOn })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('"Keep it off" records the choice off (disclosed, not enabled), clears queued events and closes', async () => {
    mocks.api.mockResolvedValueOnce(undecided).mockResolvedValueOnce(answer({ canManage: true, enabled: false, disclosed: true }));
    render(<TeenAnalyticsDisclosure />);
    fireEvent.click(await screen.findByRole('button', { name: copy.keepOff }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.api).toHaveBeenLastCalledWith('/auth/analytics-preference', { token: 'synthetic', method: 'PUT', body: { enabled: false } });
    expect(mocks.configure).toHaveBeenCalledWith({ enabled: false, getToken: mocks.getToken });
    expect(mocks.refreshMe).toHaveBeenCalledOnce();
  });

  it('"Turn it on" records the choice on and closes', async () => {
    mocks.api.mockResolvedValueOnce(undecided).mockResolvedValueOnce(answer({ canManage: true, enabled: true, disclosed: true }));
    render(<TeenAnalyticsDisclosure />);
    fireEvent.click(await screen.findByRole('button', { name: copy.turnOn }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.api).toHaveBeenLastCalledWith('/auth/analytics-preference', { token: 'synthetic', method: 'PUT', body: { enabled: true } });
  });

  it('stays open and says so when Core does not confirm the choice', async () => {
    mocks.api.mockResolvedValueOnce(undecided).mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    render(<TeenAnalyticsDisclosure />);
    fireEvent.click(await screen.findByRole('button', { name: copy.keepOff }));
    expect(await screen.findByText(copy.failed)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Decide later" closes it for this session only; a new session asks again until a choice is on file', async () => {
    mocks.api.mockResolvedValue(undecided);
    const first = render(<TeenAnalyticsDisclosure />);
    fireEvent.click(await screen.findByRole('button', { name: copy.later }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    first.unmount();
    const second = render(<TeenAnalyticsDisclosure />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.api.mock.calls.every((call) => methodOf(call) === undefined)).toBe(true);
    second.unmount();
    window.sessionStorage.clear();
    render(<TeenAnalyticsDisclosure />);
    expect(await screen.findByRole('dialog', { name: copy.title })).toBeInTheDocument();
  });

  it('never shows once a choice is on file', async () => {
    mocks.api.mockResolvedValue(answer({ canManage: true, enabled: false, disclosed: true }));
    render(<TeenAnalyticsDisclosure />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never shows where Core says another policy applies (an adult, an under-13 origin)', async () => {
    mocks.api.mockResolvedValue(answer({ canManage: false, enabled: false, disclosed: false }));
    render(<TeenAnalyticsDisclosure />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never asks for a kid-role account or a guest', async () => {
    mocks.auth = { session: { user: { id: 'kid-1' } }, isGuest: false, roles: ['kid'], meLoaded: true };
    const kid = render(<TeenAnalyticsDisclosure />);
    kid.unmount();
    mocks.auth = { session: { user: { id: 'guest-1' } }, isGuest: true, roles: ['universal'], meLoaded: true };
    render(<TeenAnalyticsDisclosure />);
    await Promise.resolve();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows nothing, never a guess, when the choice cannot be read', async () => {
    mocks.api.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    render(<TeenAnalyticsDisclosure />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
