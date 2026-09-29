import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SocialGraphPanel } from '../SocialGraphPanel';
import { SocialHistoryPanel } from '../SocialHistoryPanel';
import { SocialRequestsPanel } from '../SocialRequestsPanel';
import { publishSocialUpdate } from '../socialUpdates';
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
let decided: boolean;
let failure: boolean;
const graph = (name: string) => ({ data: { users: [{ userId: name, displayName: name, username: null }], nextOffset: null, canEnd: true }, error: null });
beforeEach(() => {
  decided = false; failure = false; mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path.endsWith('/decision')) {
      if (failure) return { data: null, error: { code: 'DATA_UNAVAILABLE' } };
      decided = true; return { data: { requestId: 'request', status: 'approved' }, error: null };
    }
    if (path.includes('/social/requests')) return { data: { requests: decided ? [] : [{ requestId: 'request', requesterName: 'Requester', status: 'pending', requestedAt: '2026-09-21T00:00:00Z' }], nextOffset: null }, error: null };
    if (path.includes('/social/audit')) return { data: { entries: decided ? [{ id: 1, action: 'social.follow', sourceName: 'New history member', targetName: 'Child', createdAt: '2026-09-21T00:00:00Z' }] : [], nextOffset: null }, error: null };
    return decided ? graph('New graph member') : { data: { users: [], nextOffset: null, canEnd: true }, error: null };
  });
});
function mount() { render(<><SocialRequestsPanel kidUserId="kid" token="session" /><SocialGraphPanel kidUserId="kid" token="session" /><SocialHistoryPanel kidUserId="kid" token="session" /></>); }
async function openAll() {
  for (const name of ['Social connections', 'Connection history', 'Connection requests']) fireEvent.click(screen.getByRole('button', { name }));
  await screen.findByText('Requester'); await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(3));
}
it('updates the open graph and history after a confirmed decision without toggling either panel', async () => {
  mount(); await openAll(); fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(await screen.findByText('New graph member')).toBeVisible();
  expect(await screen.findByText('New history member')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Close history' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Connection approved.')).toBeVisible();
});
it('does not refresh graph or history on an unconfirmed decision', async () => {
  failure = true; mount(); await openAll();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' })); await screen.findByRole('alert');
  expect(mockApi).toHaveBeenCalledTimes(4);
});
it('keeps closed panels lazy and isolates other children and sessions', async () => {
  mount();
  act(() => { publishSocialUpdate('kid', 'session'); publishSocialUpdate('other', 'session'); });
  expect(mockApi).not.toHaveBeenCalled();
  await openAll();
  act(() => { publishSocialUpdate('other', 'session'); publishSocialUpdate('kid', 'different-session'); });
  expect(mockApi).toHaveBeenCalledTimes(3);
});
it('discards an old graph response arriving after invalidation', async () => {
  let finish!: (value: ReturnType<typeof graph>) => void;
  mockApi.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(graph('Current member'));
  render(<SocialGraphPanel kidUserId="kid" token="session" />);
  fireEvent.click(screen.getByRole('button', { name: 'Social connections' }));
  act(() => publishSocialUpdate('kid', 'session'));
  expect(await screen.findByText('Current member')).toBeVisible();
  await act(async () => finish(graph('Obsolete member')));
  expect(screen.queryByText('Obsolete member')).toBeNull();
});
