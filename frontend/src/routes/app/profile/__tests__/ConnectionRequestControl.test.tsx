import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ConnectionRequestControl } from '../ConnectionRequestControl';
const { mockApi, getToken } = vi.hoisted(() => ({ mockApi: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken, session: { user: { id: 'viewer' } } }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
const receipt = { data: { requestId: 'request', status: 'pending', following: false }, error: null };
beforeEach(() => { mockApi.mockReset(); getToken.mockReset().mockResolvedValue('session'); });
it('shows pending only after receipt and never calls direct follow', async () => {
  mockApi.mockResolvedValue(receipt);
  render(<ConnectionRequestControl username="child" />);
  fireEvent.click(screen.getByRole('button', { name: 'Request connection' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Waiting for guardian approval.');
  expect(mockApi).toHaveBeenCalledWith('/profiles/child/connection-request', { method: 'POST', token: 'session', body: {} });
  expect(screen.getByRole('button')).toBeDisabled();
});
it('keeps failure retryable and rejects a non-pending response', async () => {
  mockApi.mockResolvedValueOnce({ data: { ...receipt.data, following: true }, error: null }).mockResolvedValueOnce(receipt);
  render(<ConnectionRequestControl username="child" />);
  fireEvent.click(screen.getByRole('button')); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button')); expect(await screen.findByRole('status')).toBeVisible();
});
it('does not submit an old profile after changing target while token resolution is pending', async () => {
  let finish!: (token: string) => void;
  getToken.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<ConnectionRequestControl username="first" />);
  fireEvent.click(screen.getByRole('button')); rerender(<ConnectionRequestControl username="second" />);
  await act(async () => finish('session'));
  expect(mockApi).not.toHaveBeenCalled(); expect(screen.queryByRole('status')).toBeNull();
});
