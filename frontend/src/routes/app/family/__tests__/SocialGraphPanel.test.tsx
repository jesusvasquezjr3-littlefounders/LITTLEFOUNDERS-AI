import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SocialGraphPanel } from '../SocialGraphPanel';
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));
const member = (name: string) => ({ userId: name, displayName: name, username: name.toLowerCase() });
const response = (name: string, nextOffset: number | null = null, canEnd = false) => ({ data: { users: [member(name)], nextOffset, canEnd }, error: null });
beforeEach(() => mockApi.mockReset());
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Social connections' }));
describe('guardian social panel', () => {
  it('loads only on opening and follows nextOffset for pagination', async () => {
    mockApi.mockResolvedValueOnce(response('First', 60)).mockResolvedValueOnce(response('Last'));
    render(<SocialGraphPanel kidUserId="kid" token="session" />);
    expect(mockApi).not.toHaveBeenCalled(); open();
    expect(await screen.findByText('First')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Last')).toBeVisible();
    expect(screen.getByText('First')).toBeVisible();
    expect(mockApi.mock.calls[1]![0]).toContain('offset=60');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
  it('clears graph data after a failed page and supports retry', async () => {
    mockApi.mockResolvedValueOnce(response('First', 60)).mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND' } }).mockResolvedValueOnce(response('Recovered'));
    render(<SocialGraphPanel kidUserId="kid" token="session" />); open();
    await screen.findByText('First'); fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await screen.findByRole('alert'); expect(screen.queryByText('First')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Recovered')).toBeVisible();
    expect(mockApi.mock.calls[2]![0]).toContain('offset=0');
  });
  it('discards a late follower response after changing direction', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    mockApi.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response('Following'));
    render(<SocialGraphPanel kidUserId="kid" token="session" />); open();
    fireEvent.click(screen.getByRole('radio', { name: 'Following' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
    await act(async () => finish(response('Stale')));
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByRole('list', { name: 'Following' })).toHaveTextContent('Following');
  });
  it('discards pending data on child or session change', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    mockApi.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<SocialGraphPanel kidUserId="first" token="session" />); open();
    rerender(<SocialGraphPanel kidUserId="second" token="new-session" />);
    await act(async () => finish(response('Stale')));
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.getByRole('button', { name: 'Social connections' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not request an unauthenticated graph', async () => {
    render(<SocialGraphPanel kidUserId="kid" token={null} />); open();
    expect(await screen.findByRole('alert')).toBeVisible(); expect(mockApi).not.toHaveBeenCalled();
  });
});
