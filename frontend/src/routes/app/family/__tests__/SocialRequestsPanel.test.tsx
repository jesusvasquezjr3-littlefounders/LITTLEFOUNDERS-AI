import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SocialRequestsPanel } from '../SocialRequestsPanel';
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
const item = { requestId: 'request', requesterName: 'Requester', status: 'pending', requestedAt: '2026-09-21T00:00:00Z' };
const response = (requests = [item], nextOffset: number | null = null) => ({ data: { requests, nextOffset }, error: null });
beforeEach(() => mockApi.mockReset());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Connection requests' }));
it('loads only on opening and renders pending requests with their date', async () => {
  mockApi.mockResolvedValue(response()); render(<SocialRequestsPanel kidUserId="kid" token="session" />);
  expect(mockApi).not.toHaveBeenCalled(); open();
  expect(await screen.findByText('Requester')).toBeVisible();
  expect(screen.getByText('Waiting for Tutor approval')).toBeVisible();
  expect(mockApi).toHaveBeenCalledWith('/family/kids/kid/social/requests?offset=0', { token: 'session' });
  expect(document.querySelector('time')).toHaveAttribute('dateTime', item.requestedAt);
});
it('clears stale queue entries after a failed page and retries from the start', async () => {
  mockApi.mockResolvedValueOnce(response([item], 60)).mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND' } }).mockResolvedValueOnce(response([]));
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Show more' })); await screen.findByRole('alert');
  expect(screen.queryByText('Requester')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('No pending requests.')).toBeVisible();
});
it('refuses a decided request in the pending queue', async () => {
  mockApi.mockResolvedValue(response([{ ...item, status: 'approved' }]));
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open();
  expect(await screen.findByRole('alert')).toBeVisible(); expect(screen.queryByText('Requester')).toBeNull();
});
it('discards requests arriving after the child changes', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  mockApi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<SocialRequestsPanel kidUserId="first" token="session" />); open();
  rerender(<SocialRequestsPanel kidUserId="second" token="session" />);
  await act(async () => finish(response())); expect(screen.queryByText('Requester')).toBeNull();
});

it('waits for approval receipt, prevents duplicate actions and refreshes the queue', async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockResolvedValueOnce(response()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response([]));
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
  expect(screen.queryByText('Connection approved.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(mockApi).toHaveBeenCalledTimes(2);
  expect(mockApi).toHaveBeenLastCalledWith('/family/kids/kid/social/requests/request/decision', { token: 'session', method: 'POST', body: { decision: 'approve' } });
  await act(async () => finish({ data: { requestId: 'request', status: 'approved' }, error: null }));
  expect(await screen.findByText('No pending requests.')).toBeVisible();
  expect(screen.getByText('Connection approved.')).toBeVisible();
});
it('retains retryable rows after a mismatched decision receipt', async () => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: { requestId: 'other', status: 'denied' }, error: null });
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.');
  expect(screen.getByRole('button', { name: 'Deny' })).toBeEnabled();
  expect(screen.getByText('Requester')).toBeVisible();
});
it('refreshes a conflicting request without claiming a successful decision', async () => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: null, error: { code: 'SOCIAL_DECISION_CONFLICT' } }).mockResolvedValueOnce(response([]));
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(await screen.findByText('No pending requests.')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('This request has changed.');
  expect(screen.queryByText('Connection approved.')).toBeNull();
});
it('ignores a decision receipt after switching children', async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockResolvedValueOnce(response()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<SocialRequestsPanel kidUserId="first" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  rerender(<SocialRequestsPanel kidUserId="second" token="session" />);
  await act(async () => finish({ data: { requestId: 'request', status: 'approved' }, error: null }));
  expect(screen.queryByText('Connection approved.')).toBeNull();
  expect(mockApi).toHaveBeenCalledTimes(2);
});

it.each(['GUARDIAN_DECISION_FORBIDDEN', 'PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED'])('removes cached requests when decision access is lost: %s', async code => {
  mockApi.mockResolvedValueOnce(response()).mockResolvedValueOnce({ data: null, error: { code } });
  render(<SocialRequestsPanel kidUserId="kid" token="session" />); open(); await screen.findByText('Requester');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByText('Requester')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
});
