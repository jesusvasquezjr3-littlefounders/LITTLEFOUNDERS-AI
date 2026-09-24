import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ANALYTICS_POLICY_SIGNAL } from '@/lib/analyticsPolicySignal';
import i18n from '@/i18n';
import { TeenAnalyticsSetting } from '../TeenAnalyticsSetting';
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic'), refreshMe: vi.fn().mockResolvedValue(undefined), configure: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/lib/insights', () => ({ configureInsights: mocks.configure }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'synthetic' } }, isGuest: false, getToken: mocks.getToken, refreshMe: mocks.refreshMe }) }));
const state = (enabled = false, canManage = true) => ({ data: { enabled, canManage, disclosed: true }, error: null });
const failure = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic failure' } };
beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en-US'); });
it('presents the event disclosure before enabling and refreshes the current policy', async () => {
  mocks.api.mockResolvedValueOnce(state()).mockResolvedValueOnce(state(true));
  render(<TeenAnalyticsSetting />);
  const control = await screen.findByRole('switch', { name: 'Share usage data' });
  expect(control).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText('Lesson activity includes attempts, hints, and completions.')).toBeInTheDocument();
  expect(screen.getByText('Safety records stay on to protect your account.')).toBeInTheDocument();
  fireEvent.click(control);
  await waitFor(() => expect(control).toHaveAttribute('aria-checked', 'true'));
  expect(mocks.api).toHaveBeenLastCalledWith('/auth/analytics-preference', { token: 'synthetic', method: 'PUT', body: { enabled: true } });
  expect(mocks.refreshMe).toHaveBeenCalledOnce();
});
it('retains the confirmed choice on failure, then clears queued events on confirmed opt-out', async () => {
  mocks.api.mockResolvedValueOnce(state(true)).mockResolvedValueOnce(failure).mockResolvedValueOnce(state(false));
  render(<TeenAnalyticsSetting />);
  const control = await screen.findByRole('switch'); fireEvent.click(control);
  await screen.findByRole('alert');
  expect(control).toHaveAttribute('aria-checked', 'true'); expect(mocks.configure).not.toHaveBeenCalled();
  fireEvent.click(control);
  await waitFor(() => expect(control).toHaveAttribute('aria-checked', 'false'));
  expect(mocks.configure).toHaveBeenCalledWith({ enabled: false, getToken: mocks.getToken });
});
it('does not invent a switch state after a failed read and offers recovery', async () => {
  mocks.api.mockResolvedValueOnce(failure).mockResolvedValueOnce(state()); render(<TeenAnalyticsSetting />);
  await screen.findByRole('alert'); expect(screen.queryByRole('switch')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'false');
});
it('hides the self-managed control when the server says another policy applies', async () => {
  mocks.api.mockResolvedValue(state(false, false)); const view = render(<TeenAnalyticsSetting />);
  await waitFor(() => expect(view.container).toBeEmptyDOMElement());
});
it('discards a write response after leaving the account view', async () => {
  let resolve!: (value: ReturnType<typeof state>) => void;
  mocks.api.mockResolvedValueOnce(state(true)).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(<TeenAnalyticsSetting />); fireEvent.click(await screen.findByRole('switch'));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2)); view.unmount(); resolve(state(false));
  await Promise.resolve(); await Promise.resolve();
  expect(mocks.configure).not.toHaveBeenCalled(); expect(mocks.refreshMe).not.toHaveBeenCalled();
});

it('waits for an in-flight write before reconciling a cross-tab change', async () => {
  let resolve!: (value: ReturnType<typeof state>) => void;
  mocks.api.mockResolvedValueOnce(state()).mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce(state(false));
  render(<TeenAnalyticsSetting />);
  fireEvent.click(await screen.findByRole('switch'));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
  fireEvent(window, new StorageEvent('storage', { key: ANALYTICS_POLICY_SIGNAL, newValue: 'opaque' }));
  expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('switch')).toBeDisabled();
  await act(async () => resolve(state(true)));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
  expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'false');
  expect(mocks.api).toHaveBeenLastCalledWith('/auth/analytics-preference', { token: 'synthetic' });
  expect(mocks.refreshMe).toHaveBeenCalledOnce();
});
it('reconciles an external change arriving while policy refresh is pending', async () => {
  let finish!: () => void;
  mocks.refreshMe.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  mocks.api.mockResolvedValueOnce(state()).mockResolvedValueOnce(state(true)).mockResolvedValueOnce(state(false));
  render(<TeenAnalyticsSetting />); fireEvent.click(await screen.findByRole('switch'));
  await waitFor(() => expect(mocks.refreshMe).toHaveBeenCalledOnce());
  fireEvent(window, new StorageEvent('storage', { key: ANALYTICS_POLICY_SIGNAL, newValue: 'opaque' }));
  expect(mocks.api).toHaveBeenCalledTimes(2);
  await act(async () => finish());
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
  expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'false');
});
