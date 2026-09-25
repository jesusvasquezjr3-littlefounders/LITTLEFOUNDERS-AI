import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BadgeSharesPanel } from '../BadgeSharesPanel';

/*
 * F.2's Family-panel surface: loads a kid's live badge shares only when
 * opened, validates the wire shape, revokes through the parent-only DELETE
 * route, and isolates late responses after a child/session change. Core
 * remains the enforcing boundary; these tests are about the panel's own
 * rendering and transport discipline.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

const item = { token: 'a'.repeat(32), achievementLabel: '7-day streak', createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z' };
const response = (shares = [item]) => ({ data: { shares }, error: null });
beforeEach(() => mockApi.mockReset());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Old share links' }));

it('loads only on opening and renders each share with its expiry', async () => {
  mockApi.mockResolvedValue(response()); render(<BadgeSharesPanel kidUserId="kid" token="session" />);
  expect(mockApi).not.toHaveBeenCalled(); open();
  expect(await screen.findByText('7-day streak')).toBeVisible();
  expect(screen.getByText(/Expires /)).toBeVisible();
  // OD-20: the list is legacy links only, and the panel says they end on their date.
  expect(screen.getByText('Older links stop working on the date shown.')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/family/kids/kid/badges', { token: 'session' });
});

it('revokes a share on confirmation and removes the row', async () => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: { revoked: true }, error: null });
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open(); await screen.findByText('7-day streak');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(await screen.findByText('Link revoked.')).toBeVisible();
  expect(screen.queryByText('7-day streak')).toBeNull();
  expect(mockApi).toHaveBeenLastCalledWith(`/family/kids/kid/badges/${item.token}`, { token: 'session', method: 'DELETE' });
});

it('refuses a malformed share row and shows the failure state', async () => {
  mockApi.mockResolvedValue({ data: { shares: [{ ...item, token: 'short' }] }, error: null });
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open();
  expect(await screen.findByRole('alert')).toHaveTextContent('Links could not load. Try again.');
  expect(screen.queryByText('7-day streak')).toBeNull();
});

it('clears cached shares and fails when revoke access is lost', async () => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: null, error: { code: 'FORBIDDEN' } });
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open(); await screen.findByText('7-day streak');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Links could not load. Try again.');
  expect(screen.queryByText('7-day streak')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Revoke link' })).toBeNull();
});

it('keeps the row and reports failure when the revoke is not confirmed', async () => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL' } });
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open(); await screen.findByText('7-day streak');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not revoke. Try again.');
  expect(screen.getByText('7-day streak')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Revoke link' })).toBeEnabled();
});

it('prevents a duplicate revoke while one is in flight', async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockResolvedValueOnce(response()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open(); await screen.findByText('7-day streak');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(screen.getByRole('button', { name: 'Revoke link' })).toBeDisabled();
  expect(screen.queryByText('Link revoked.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  expect(mockApi).toHaveBeenCalledTimes(2);
  await act(async () => finish({ data: { revoked: true }, error: null }));
  expect(await screen.findByText('Link revoked.')).toBeVisible();
});

it('discards a late list response after the child changes', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  mockApi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<BadgeSharesPanel kidUserId="first" token="session" />); open();
  rerender(<BadgeSharesPanel kidUserId="second" token="session" />);
  await act(async () => finish(response())); expect(screen.queryByText('7-day streak')).toBeNull();
});

it('ignores a late revoke receipt after switching children', async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockResolvedValueOnce(response()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<BadgeSharesPanel kidUserId="first" token="session" />); open(); await screen.findByText('7-day streak');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }));
  rerender(<BadgeSharesPanel kidUserId="second" token="session" />);
  await act(async () => finish({ data: { revoked: true }, error: null }));
  expect(screen.queryByText('Link revoked.')).toBeNull();
  expect(mockApi).toHaveBeenCalledTimes(2);
});

it('recovers from a failed page and shows the empty state', async () => {
  mockApi.mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND' } }).mockResolvedValueOnce(response([]));
  render(<BadgeSharesPanel kidUserId="kid" token="session" />); open();
  expect(await screen.findByRole('alert')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No active links.')).toBeVisible();
});
