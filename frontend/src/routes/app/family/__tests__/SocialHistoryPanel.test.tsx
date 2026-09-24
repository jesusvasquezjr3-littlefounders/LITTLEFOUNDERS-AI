import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SocialHistoryPanel } from '../SocialHistoryPanel';
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
const result = { data: { entries: [{ id: 1, action: 'social.follow', sourceName: 'Child', targetName: null, createdAt: '2026-09-21T00:00:00Z' }], nextOffset: null }, error: null };
beforeEach(() => mockApi.mockReset());
it('loads history on demand and labels a protected participant without exposing an identifier', async () => {
  mockApi.mockResolvedValue(result);
  render(<SocialHistoryPanel kidUserId="kid" token="session" />);
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Connection history' }));
  expect(await screen.findByText('Child')).toBeVisible();
  expect(screen.getByText('Private or unavailable account')).toBeVisible();
  expect(screen.getByText('followed')).toBeVisible();
  expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-09-21T00:00:00Z');
});
it('shows an unavailable state for malformed events and recovers on retry', async () => {
  mockApi.mockResolvedValueOnce({ data: { entries: [{ id: 1, action: 'private.event' }], nextOffset: null }, error: null }).mockResolvedValueOnce(result);
  render(<SocialHistoryPanel kidUserId="kid" token="session" />);
  fireEvent.click(screen.getByRole('button', { name: 'Connection history' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Child')).toBeVisible();
});
it('discards history arriving after a child change', async () => {
  let finish!: (value: typeof result) => void;
  mockApi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<SocialHistoryPanel kidUserId="first" token="session" />);
  fireEvent.click(screen.getByRole('button', { name: 'Connection history' }));
  rerender(<SocialHistoryPanel kidUserId="second" token="session" />);
  await act(async () => finish(result));
  expect(screen.queryByText('Child')).toBeNull();
});
