import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CoGuardiansPanel, GuardianRequestsPanel } from '../CoGuardiansPanel';
import { WalletCorrectionsPanel } from '../WalletCorrectionsPanel';
import { WalletActivityPanel } from '../../tasks/WalletActivityPanel';
import en from '@/i18n/en-US/familyHub.json';

/*
 * S07.1 data planes: every decision is re-read from Core afterwards, refusals
 * map to honest copy, a malformed receipt is never shown as success, and the
 * surfaces load nothing until opened (except the invited adult's own status).
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en-US' } }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

const KID = '11111111-1111-4111-8111-111111111111';
const LINK_ME = '22222222-2222-4222-8222-222222222222';
const LINK_PENDING = '33333333-3333-4333-8333-333333333333';
const GOAL = '44444444-4444-4444-8444-444444444444';
const REDEMPTION = '55555555-5555-4555-8555-555555555555';
const CATALOG = '66666666-6666-4666-8666-666666666666';
const ACTION = '77777777-7777-4777-8777-777777777777';
const T = '2026-09-20T00:00:00.000Z';

const guardians = (pendingStatus = 'pending') => ({ data: { guardians: [
  { linkId: LINK_ME, displayName: 'Ana', status: 'verified', isMe: true, since: T, decidedAt: null, revokedAt: null },
  { linkId: LINK_PENDING, displayName: 'Luis', status: pendingStatus, isMe: false, since: T, decidedAt: null, revokedAt: null },
] }, error: null });

// Braced: a bare arrow would return the mock, which Vitest then runs as a cleanup hook.
beforeEach(() => { mockApi.mockReset(); });

describe('CoGuardiansPanel', () => {
  it('loads only when opened, confirms through Core and re-reads the Tutors', async () => {
    mockApi.mockResolvedValueOnce(guardians())
      .mockResolvedValueOnce({ data: { linkId: LINK_PENDING, status: 'verified' }, error: null })
      .mockResolvedValueOnce(guardians('verified'));
    render(<CoGuardiansPanel kidUserId={KID} kidName="Nico" token="t" />);
    expect(mockApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    fireEvent.click(await screen.findByRole('button', { name: en.coGuardians.confirm }));
    expect(await screen.findByText(en.coGuardians.confirmed)).toBeVisible();
    expect(mockApi).toHaveBeenNthCalledWith(2, `/family/kids/${KID}/guardians/${LINK_PENDING}/decision`, { token: 't', method: 'POST', body: { decision: 'confirm' } });
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByRole('button', { name: en.coGuardians.confirm })).toBeNull());
  });

  it('tells the Tutor when another Tutor already decided', async () => {
    mockApi.mockResolvedValueOnce(guardians())
      .mockResolvedValueOnce({ data: null, error: { code: 'GUARDIAN_LINK_NOT_PENDING', message: 'x' } })
      .mockResolvedValueOnce(guardians('verified'));
    render(<CoGuardiansPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    fireEvent.click(await screen.findByRole('button', { name: en.coGuardians.reject }));
    expect(await screen.findByText(en.coGuardians.conflict)).toBeVisible();
  });

  it('never shows a decision the server did not confirm', async () => {
    mockApi.mockResolvedValueOnce(guardians())
      .mockResolvedValueOnce({ data: { linkId: LINK_PENDING, status: 'rejected' }, error: null })
      .mockResolvedValueOnce(guardians());
    render(<CoGuardiansPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    fireEvent.click(await screen.findByRole('button', { name: en.coGuardians.confirm }));
    expect(await screen.findByText(en.coGuardians.decisionFailed)).toBeVisible();
    expect(screen.queryByText(en.coGuardians.confirmed)).toBeNull();
  });

  it('steps away only after the second confirmation and hands the child back to the page', async () => {
    const onAccessLost = vi.fn();
    mockApi.mockResolvedValueOnce(guardians('verified')).mockResolvedValueOnce({ data: { status: 'revoked' }, error: null });
    render(<CoGuardiansPanel kidUserId={KID} kidName="Nico" token="t" onAccessLost={onAccessLost} />);
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    fireEvent.click(await screen.findByRole('button', { name: en.coGuardians.leave }));
    expect(mockApi).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole('group', { name: en.coGuardians.leave })).getByRole('button', { name: en.coGuardians.leaveConfirm }));
    await waitFor(() => expect(onAccessLost).toHaveBeenCalledOnce());
    expect(mockApi).toHaveBeenLastCalledWith(`/family/kids/${KID}/guardians/leave`, { token: 't', method: 'POST', body: {} });
  });

  it('explains the last-Tutor refusal', async () => {
    mockApi.mockResolvedValueOnce(guardians('verified'))
      .mockResolvedValueOnce({ data: null, error: { code: 'LAST_GUARDIAN', message: 'x' } })
      .mockResolvedValueOnce(guardians('verified'));
    render(<CoGuardiansPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.title }));
    fireEvent.click(await screen.findByRole('button', { name: en.coGuardians.leave }));
    fireEvent.click(screen.getByRole('button', { name: en.coGuardians.leaveConfirm }));
    expect(await screen.findByText(en.coGuardians.leaveLast)).toBeVisible();
  });
});

describe('GuardianRequestsPanel', () => {
  it('shows the invited adult their pending link, and nothing when there is none', async () => {
    mockApi.mockResolvedValueOnce({ data: { links: [{ linkId: LINK_PENDING, kidDisplayName: 'Nico', status: 'pending', updatedAt: T }] }, error: null });
    const view = render(<GuardianRequestsPanel token="t" />);
    expect(await screen.findByText('Nico: waiting for their Tutor to confirm you.')).toBeVisible();
    view.unmount();
    mockApi.mockResolvedValueOnce({ data: { links: [] }, error: null });
    const empty = render(<GuardianRequestsPanel token="t" />);
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
    expect(empty.container).toBeEmptyDOMElement();
  });

  it('rejects a malformed list instead of rendering it', async () => {
    mockApi.mockResolvedValueOnce({ data: { links: [{ linkId: 'x', status: 'verified' }] }, error: null });
    render(<GuardianRequestsPanel token="t" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.guardianRequests.failed);
  });
});

function walletResponses() {
  return (path: string) => {
    if (path.endsWith('/goals')) return Promise.resolve({ data: { goals: [{ id: GOAL, title: 'Bike', target: 10, status: 'active', saved: 6, progress: { own: 6, bonus: 0, family: 0, total: 6 } }] }, error: null });
    if (path.startsWith('/tasks/redemptions?kidId=')) return Promise.resolve({ data: { redemptions: [{ id: REDEMPTION, catalogId: CATALOG, status: 'approved', createdAt: T, decidedAt: T, fulfilledAt: null }] }, error: null });
    if (path === '/tasks/catalog') return Promise.resolve({ data: { items: [{ id: CATALOG, title: 'Movie night' }] }, error: null });
    if (path.endsWith('/guardian-actions')) return Promise.resolve({ data: { actions: [] }, error: null });
    // GAP-FIX-R6: the child's pockets, read beside the correction.
    if (path === `/tasks/${KID}/wallet`) return Promise.resolve({ data: { balances: { save: 6, spend: 20, share: 2 } }, error: null });
    return Promise.resolve({ data: null, error: { code: 'NOT_STUBBED', message: path } });
  };
}

describe('WalletCorrectionsPanel', () => {
  it('posts a correction with its reason, then re-reads the wallet', async () => {
    const respond = walletResponses();
    mockApi.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === 'POST' && path.endsWith('/wallet/adjustments') ? Promise.resolve({ data: { actionId: ACTION }, error: null }) : respond(path));
    const onChanged = vi.fn();
    render(<WalletCorrectionsPanel kidUserId={KID} kidName="Nico" token="t" onChanged={onChanged} />);
    expect(mockApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.title }));
    const form = await screen.findByRole('form', { name: en.walletCorrections.adjustHeading });
    expect(within(form).getByText('In this pocket now: 20')).toBeVisible();
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '5' } });
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.reason), { target: { value: 'Birthday gift' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    expect(await screen.findByText(en.walletCorrections.saved)).toBeVisible();
    expect(mockApi).toHaveBeenCalledWith(`/tasks/${KID}/wallet/adjustments`, { token: 't', method: 'POST', body: { bucket: 'spend', amount: 5, reason: 'Birthday gift' } });
    await waitFor(() => expect(mockApi.mock.calls.filter(([p]) => String(p).endsWith('/guardian-actions'))).toHaveLength(2));
    // The Wallet's read of this child's coins re-reads too.
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('maps the protected-savings refusal to honest copy', async () => {
    const respond = walletResponses();
    mockApi.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === 'POST' ? Promise.resolve({ data: null, error: { code: 'GOAL_SAVINGS_PROTECTED', message: 'x' } }) : respond(path));
    render(<WalletCorrectionsPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.title }));
    const form = await screen.findByRole('form', { name: en.walletCorrections.adjustHeading });
    fireEvent.click(within(form).getByRole('radio', { name: en.walletCorrections.remove }));
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.amount), { target: { value: '5' } });
    fireEvent.change(within(form).getByLabelText(en.walletCorrections.reason), { target: { value: 'Correction' } });
    fireEvent.click(within(form).getByRole('button', { name: en.walletCorrections.submit }));
    expect(await screen.findByText(en.walletCorrections.protected)).toBeVisible();
  });

  it('delivers an approved reward by its title and re-reads', async () => {
    const respond = walletResponses();
    mockApi.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === 'POST' && path.endsWith('/fulfill') ? Promise.resolve({ data: { fulfilled: true }, error: null }) : respond(path));
    render(<WalletCorrectionsPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.title }));
    expect(await screen.findByText('Movie night')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.deliver }));
    expect(await screen.findByText(en.walletCorrections.delivered)).toBeVisible();
    expect(mockApi).toHaveBeenCalledWith(`/tasks/redemptions/${REDEMPTION}/fulfill`, { token: 't', method: 'POST', body: {} });
  });

  it('shows a failed load when any source is unreadable', async () => {
    mockApi.mockImplementation((path: string) => path.endsWith('/guardian-actions')
      ? Promise.resolve({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } }) : walletResponses()(path));
    render(<WalletCorrectionsPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.walletCorrections.title }));
    expect(await screen.findByText(en.walletCorrections.failed)).toBeVisible();
    expect(screen.queryByRole('form')).toBeNull();
  });
});

describe('WalletActivityPanel (child)', () => {
  it('shows each Tutor reason and the delivered reward', async () => {
    mockApi.mockImplementation((path: string) => {
      if (path === '/tasks/wallet/ledger') return Promise.resolve({ data: { entries: [{ id: 1, bucket: 'spend', amount: 5, reason: 'manual_adjustment', note: 'Birthday gift', createdAt: T }] }, error: null });
      if (path === '/tasks/redemptions/mine') return Promise.resolve({ data: { redemptions: [{ id: REDEMPTION, catalogId: CATALOG, status: 'fulfilled', createdAt: T, decidedAt: T, fulfilledAt: T }] }, error: null });
      return Promise.resolve({ data: { items: [{ id: CATALOG, title: 'Movie night' }] }, error: null });
    });
    render(<WalletActivityPanel token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.walletActivity.open }));
    expect(await screen.findByText('Why: Birthday gift')).toBeVisible();
    expect(screen.getByText(en.walletActivity.fulfilled)).toBeVisible();
  });

  it('refuses to show a guardian movement that arrives without its reason', async () => {
    mockApi.mockImplementation((path: string) => path === '/tasks/wallet/ledger'
      ? Promise.resolve({ data: { entries: [{ id: 1, bucket: 'spend', amount: 5, reason: 'manual_adjustment', note: null, createdAt: T }] }, error: null })
      : Promise.resolve({ data: { redemptions: [], items: [] }, error: null }));
    render(<WalletActivityPanel token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.walletActivity.open }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.walletActivity.failed);
  });
});
