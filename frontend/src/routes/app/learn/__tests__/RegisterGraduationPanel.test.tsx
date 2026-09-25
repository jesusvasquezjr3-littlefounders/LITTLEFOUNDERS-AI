import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegisterGraduationPanel } from '../RegisterGraduationPanel';

/*
 * B.23 (S05.3f): the learning-home host for the graduation moment. It shows
 * the card only when Core says a graduation is owed, records the learner's
 * acknowledgement through Core with the session token, then removes it. Core
 * decides the register from its own age evidence; the client never states one.
 */

// The real context's getToken is stable across renders; so is this one.
const { mockApi, auth } = vi.hoisted(() => ({ mockApi: vi.fn(), auth: { getToken: async () => 'session' } }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'es-MX', language: 'es-MX' } }) }));

const status = (graduation: unknown) => ({ register: 'transition', copy_band: '10-12', policy_version: '2026-09-24.1', graduation });
beforeEach(() => mockApi.mockReset());

it('shows the owed graduation once, acknowledges it through Core, then removes it', async () => {
  mockApi
    .mockResolvedValueOnce({ data: status({ from: 'young', to: 'transition' }), error: null })
    .mockResolvedValueOnce({ data: { acknowledged: true, register: 'transition' }, error: null });
  const { container } = render(<RegisterGraduationPanel />);
  expect(await screen.findByText('Una nueva etapa para ti')).toBeVisible();
  expect(mockApi.mock.calls[0]).toEqual(['/learn/register', { token: 'session', method: undefined, body: undefined }]);
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
  await waitFor(() => expect(container.querySelector('.lf-graduation')).toBeNull());
  expect(mockApi.mock.calls[1]).toEqual(['/learn/register/graduation', { token: 'session', method: 'POST', body: { register: 'transition' } }]);
});

it('shows nothing when no graduation is owed or the read fails', async () => {
  mockApi.mockResolvedValueOnce({ data: status(null), error: null });
  const first = render(<RegisterGraduationPanel />);
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
  expect(first.container.innerHTML).toBe('');
  first.unmount();
  mockApi.mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE' } });
  const second = render(<RegisterGraduationPanel />);
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  expect(second.container.innerHTML).toBe('');
});
