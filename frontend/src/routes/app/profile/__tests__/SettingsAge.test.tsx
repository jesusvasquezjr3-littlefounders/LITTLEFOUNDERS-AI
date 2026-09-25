import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SettingsPage } from '../SettingsPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refresh: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'synthetic' } }, isGuest: true, roles: [], getToken: mocks.token, refreshMe: mocks.refresh }) }));
beforeEach(async () => {
  vi.clearAllMocks();
  // E.6: Settings mounts the rebuilt deletion block, which reads Core directly.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    deletion: null,
    eligibility: { allowed: true, population: 'guest', graceDays: 0, immediate: true, reauth: 'none', children: { lastTutorOf: 0, sharedTutorOf: 0 } },
  }, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  await i18n.changeLanguage('en-US');
  mocks.api.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === 'PATCH') return { data: { updated: true }, error: null };
    return { data: path === '/profile' ? { displayName: 'Synthetic', username: 'synthetic', locale: 'en-US', birthDate: '2016-05-01' } : { users: [] }, error: null };
  });
});

it('keeps the stored date read-only and omits it when saving other profile fields', async () => {
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);
  const date = await screen.findByDisplayValue('2016-05-01');
  expect(date).toHaveAttribute('readonly');
  expect(screen.getByText('Your birth date cannot be edited here.')).toBeInTheDocument();
  const name = screen.getByDisplayValue('Synthetic');
  fireEvent.change(name, { target: { value: 'Updated' } });
  const form = name.closest('form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
  await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/profile', {
    method: 'PATCH', token: 'synthetic', body: { displayName: 'Updated', username: 'synthetic', locale: 'en-US' },
  }));
});

it('offers the guest the E.6 deletion block, stating that the deletion is immediate', async () => {
  render(<MemoryRouter><SettingsPage /></MemoryRouter>);
  expect(await screen.findByText('We delete your account and its data as soon as you confirm.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
  expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://core.test/api/v1/account/deletion', expect.objectContaining({ method: 'GET' }));
});
