import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SocialGraphPanel } from '../SocialGraphPanel';
import { SocialNoticesPanel } from '../SocialNoticesPanel';

/*
 * E.1/E.3/E.13 (GAP-FIX-R3 social): the Tutor ends or reports a child's
 * connection from the Family list and from a safety notice. Ending asks
 * first and is offered only where Core says so (canEnd); success is claimed
 * only on Core's receipt; the panels re-read after a change.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

const graph = (canEnd: boolean) => ({ data: { users: [{ userId: 'other-id', displayName: 'Zed', username: 'zed' }], nextOffset: null, canEnd }, error: null });
type Call = [string, { method?: string; body?: unknown; token?: string }?];
const calls = () => mockApi.mock.calls as Call[];
const writes = () => calls().filter(([, options]) => options?.method === 'DELETE' || options?.method === 'POST');
beforeEach(() => { mockApi.mockReset(); });

async function openGraph(canEnd: boolean, write?: unknown) {
  mockApi.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method && write !== undefined) return write;
    if (path.includes('/social?')) return graph(canEnd);
    return { data: null, error: { code: 'INTERNAL' } };
  });
  render(<SocialGraphPanel kidUserId="kid-id" token="session" />);
  fireEvent.click(screen.getByRole('button', { name: 'Social connections' }));
  await screen.findByText('Zed');
}

async function confirmEnd() {
  fireEvent.click(within(screen.getByRole('group', { name: 'Zed' })).getByRole('button', { name: 'End connection' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('End connection with Zed?');
  expect(dialog).toHaveTextContent('Connecting again needs your approval.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'End connection' }));
}

describe('Family social list', () => {
  it('ends a connection after confirmation, through Core, and re-reads the list', async () => {
    await openGraph(true, { data: { ended: true, removed: 2 }, error: null });
    const reads = calls().length;
    await confirmEnd();
    expect(await screen.findByText('Connection ended.')).toBeVisible();
    expect(writes()).toEqual([['/family/kids/kid-id/social/connections/other-id', { token: 'session', method: 'DELETE' }]]);
    await waitFor(() => expect(calls().length).toBeGreaterThan(reads + 1));
  });

  it('keeping the connection sends nothing', async () => {
    await openGraph(true, { data: { ended: true, removed: 2 }, error: null });
    fireEvent.click(within(screen.getByRole('group', { name: 'Zed' })).getByRole('button', { name: 'End connection' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep connection' }));
    expect(writes()).toEqual([]);
  });

  it('offers no end action where Core says the list is read-only (a self-registered teen)', async () => {
    await openGraph(false);
    const row = screen.getByRole('group', { name: 'Zed' });
    expect(within(row).queryByRole('button', { name: 'End connection' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Report' })).toBeVisible();
  });

  it('says a connection already ended on a 404 and reports a failure otherwise', async () => {
    await openGraph(true, { data: null, error: { code: 'NOT_FOUND' } });
    await confirmEnd();
    expect(await screen.findByText('This connection already ended.')).toBeVisible();
  });

  it.each([{ data: null, error: { code: 'GUARDIAN_DECISION_FORBIDDEN' } }, { data: { ended: true }, error: null }, { data: { ended: 'yes', removed: 2 }, error: null }])(
    'never claims an end Core did not confirm: %j', async receipt => {
      await openGraph(true, receipt);
      await confirmEnd();
      expect(await screen.findByRole('alert')).toHaveTextContent('The connection was not ended. Try again.');
    });

  it('reports an account with the bounded dialog and the guardian session', async () => {
    await openGraph(false, { data: { reported: true, reportId: 'r' }, error: null });
    fireEvent.click(within(screen.getByRole('group', { name: 'Zed' })).getByRole('button', { name: 'Report' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Harassment or bullying'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Report sent to our safety team.')).toBeVisible();
    expect(writes()).toEqual([['/family/kids/kid-id/social/connections/other-id/report', { token: 'session', method: 'POST', body: { category: 'harassment' } }]]);
  });
});

describe('Safety notices', () => {
  const notice = { noticeId: 'n1', kidUserId: 'kid-id', subjectId: 'other-id', subjectName: 'Zed', createdAt: '2026-09-01T00:00:00Z', canEnd: true };

  it('a named notice about a current connection offers both actions; an unnamed one offers none', async () => {
    mockApi.mockImplementation(async (_path: string, options?: { method?: string }) => options?.method
      ? { data: { ended: true, removed: 1 }, error: null }
      : { data: { notices: [notice, { ...notice, noticeId: 'n2', subjectId: 'hidden', subjectName: null, canEnd: false }] }, error: null });
    render(<SocialNoticesPanel token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Safety notices' }));
    await screen.findByText('A report involved Zed.');
    expect(screen.getAllByRole('group')).toHaveLength(1);
    await confirmEnd();
    expect(await screen.findByText('Connection ended.')).toBeVisible();
    expect(writes()).toEqual([['/family/kids/kid-id/social/connections/other-id', { token: 'session', method: 'DELETE' }]]);
    // The change re-reads the notices (canEnd may have changed).
    await waitFor(() => expect(calls().filter(([path]) => path === '/family/social-notices').length).toBeGreaterThan(1));
  });

  it('a named notice about an ended connection still offers the report', async () => {
    mockApi.mockResolvedValue({ data: { notices: [{ ...notice, canEnd: false }] }, error: null });
    render(<SocialNoticesPanel token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Safety notices' }));
    const row = await screen.findByRole('group', { name: 'Zed' });
    expect(within(row).queryByRole('button', { name: 'End connection' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Report' })).toBeVisible();
  });

  it('refuses a notice row without the canEnd verdict', async () => {
    const { canEnd: _dropped, ...legacy } = notice;
    mockApi.mockResolvedValue({ data: { notices: [legacy] }, error: null });
    render(<SocialNoticesPanel token="session" />);
    fireEvent.click(screen.getByRole('button', { name: 'Safety notices' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Notices could not load. Try again.');
  });
});
