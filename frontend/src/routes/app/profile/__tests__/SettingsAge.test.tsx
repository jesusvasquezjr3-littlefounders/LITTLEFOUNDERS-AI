import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SettingsPage } from '../SettingsPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refresh: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'synthetic' } }, isGuest: true, getToken: mocks.token, refreshMe: mocks.refresh }) }));
beforeEach(async () => {
  vi.clearAllMocks();
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
