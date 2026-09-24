import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SocialNoticesPanel } from '../SocialNoticesPanel';

/*
 * E.3's guardian notices surface: loads only when opened, validates the
 * wire shape (an unknown subjectName shape fails the list, never renders a
 * stranger-shaped row), and resolves names server-side through Core's
 * discovery admission — the panel never leaks a name itself.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

const notice = {
  noticeId: 'n1',
  kidUserId: 'kid',
  subjectId: 'subject',
  subjectName: null as string | null,
  createdAt: '2026-09-01T00:00:00Z',
};
const response = (notices = [notice]) => ({ data: { notices }, error: null });
beforeEach(() => mockApi.mockReset());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Safety notices' }));

it('loads only on opening and renders a named notice', async () => {
  mockApi.mockResolvedValue(response([{ ...notice, subjectName: 'Ana' }]));
  render(<SocialNoticesPanel token="session" />);
  expect(mockApi).not.toHaveBeenCalled(); open();
  expect(await screen.findByText('A report involved Ana.')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/family/social-notices', { token: 'session' });
});

it('renders the unnamed fallback when Core hides the subject name', async () => {
  mockApi.mockResolvedValue(response());
  render(<SocialNoticesPanel token="session" />); open();
  expect(await screen.findByText('A report involved one of your kids.')).toBeVisible();
});

it('refuses a malformed notice row and shows the failure state', async () => {
  mockApi.mockResolvedValue({ data: { notices: [{ ...notice, subjectName: 42 }] }, error: null });
  render(<SocialNoticesPanel token="session" />); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Notices could not load. Try again.');
});

it('shows the empty state', async () => {
  mockApi.mockResolvedValue(response([]));
  render(<SocialNoticesPanel token="session" />); open();
  expect(await screen.findByText('No safety notices.')).toBeVisible();
});

it('recovers from a failed load', async () => {
  mockApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL' } }).mockResolvedValueOnce(response([]));
  render(<SocialNoticesPanel token="session" />); open();
  expect(await screen.findByRole('alert')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No safety notices.')).toBeVisible();
});
