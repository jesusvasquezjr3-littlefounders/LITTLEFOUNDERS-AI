import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { BankingPage } from '../BankingPage';
import { resetMoneyRegisterCache } from '../../family/useMoneyRegister';

/*
 * /banking (W2F.2): the route picks the rebuilt screen by who is signed in and
 * hands it the wave-1 surfaces. D.1 on the S07.6 freeze card and coin
 * account, ported from the legacy page tests onto the rebuilt screens:
 *   - Tutor: a failed freeze keeps the confirmed state and can be retried, and
 *     a response that arrives after the Tutor picked another child never
 *     lands on the other child; the child in view is written to `?child=`.
 *   - Child: a pending allowance stays and its split is held while frozen,
 *     the hold is explained, a child is never offered a way to lift a
 *     Tutor's freeze, and a failed unfreeze keeps the frozen state.
 */
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic'), roles: ['parent'] as string[], familyChild: false }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mocks.getToken, roles: mocks.roles, session: { user: { id: 'me' } } }) }));
vi.mock('../../wallet/useWalletAccess', () => ({ useWalletAccess: () => ({ loaded: true, holder: null, familyChild: mocks.familyChild }) }));
// The wave-1 surfaces below have their own tests; here the route only has to hand them over.
vi.mock('../SavingsBonusSettingsPanel', () => ({ SavingsBonusSettingsPanel: () => null }));
vi.mock('../SavingsBonusPanel', () => ({ SavingsBonusPanel: () => null }));
vi.mock('../../tasks/DecisionQueuePanel', () => ({ DecisionQueuePanel: () => null }));
vi.mock('../../family/WalletCorrectionsPanel', () => ({ WalletCorrectionsPanel: ({ kidName }: { kidName: string }) => <p data-copy-role="data">{`corrections:${kidName}`}</p> }));
vi.mock('../../family/ShareDestinationsPanel', () => ({ ShareDestinationsPanel: () => null }));
vi.mock('../../family/GovernancePanels', () => ({
  LimitCoachingPanel: () => null, ScopeStatementPanel: () => null, MoneyBridgePanel: () => null, MyResearchPanel: () => null, tokenSession: () => ({}),
}));
vi.mock('../../tasks/SavingsGoalsPanel', () => ({ SavingsGoalsPanel: () => null }));
vi.mock('../../tasks/UsualSplitPanel', () => ({ UsualSplitPanel: () => null }));
vi.mock('../../tasks/WalletActivityPanel', () => ({ WalletActivityPanel: () => null }));
vi.mock('../../tasks/AllocationPanel', () => ({
  AllocationPanel: ({ frozen }: { frozen?: boolean }) => <button type="button" data-copy-role="action" disabled={frozen}>Split</button>,
}));
beforeEach(async () => { mocks.api.mockReset(); resetMoneyRegisterCache(); await i18n.changeLanguage('en-US'); });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}
const page = () => render(<MemoryRouter initialEntries={['/banking']}><Routes><Route path="/banking" element={<><BankingPage /><Where /></>} /></Routes></MemoryRouter>);

describe('the Tutor (F5-P)', () => {
  const legacy = (kidId: string) => ({ nickname: `Account ${kidId}`, cardDesign: 'indigo', frozen: false, frozenBy: null, frozenAt: null, openedAt: '2026-01-01T00:00:00Z' });
  const view = (kidId: string, frozen: boolean) => ({
    register: 'young',
    account: { nickname: `Account ${kidId}`, design: 'indigo', simulated: true,
      freeze: { frozen, by: frozen ? 'you' : null, since: frozen ? '2026-09-20T00:00:00Z' : null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: true } },
  });
  const kid = (userId: string, displayName: string) => ({ userId, displayName, username: null, analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 0,
    taskStreakDays: 0, accountType: 'child', profileReview: null });

  function fixture(write: () => Promise<unknown>) {
    mocks.roles = ['parent'];
    const frozen: Record<string, boolean> = { a: false, b: false };
    mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      const freeze = path.match(/^\/banking\/accounts\/(\w)\/freeze$/);
      if (freeze && options.method === 'POST') {
        const result = await write() as { error: unknown };
        if (!result.error) frozen[freeze[1]!] = true;
        return result;
      }
      if (freeze) return { data: view(freeze[1]!, frozen[freeze[1]!]!), error: null };
      const data = path === '/family/kids' ? { kids: [kid('a', 'Child A'), kid('b', 'Child B')] }
        : path.startsWith('/banking/accounts/') ? { account: legacy(path.split('/').at(-1)!) }
        : path.startsWith('/banking/spend-limit') ? { status: { configured: false } }
        : { rule: null };
      return { data, error: null };
    });
    return page();
  }

  it('shows a freeze failure, keeps the confirmed state and permits a retry', async () => {
    let attempts = 0;
    fixture(async () => ++attempts === 1 ? { data: null, error: { code: 'DATA_UNAVAILABLE' } } : { data: { account: { frozen: true } }, error: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Freeze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not change. Try again.');
    expect(screen.getByText('Active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    await waitFor(() => expect(screen.getByText('You froze it.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Unfreeze' })).toBeEnabled();
    expect(screen.getByText('corrections:Child A')).toBeInTheDocument();
  });

  it('does not apply a pending freeze response to another child, and writes the child in view to the address', async () => {
    let finish!: (value: unknown) => void;
    fixture(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(await screen.findByRole('button', { name: 'Freeze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Child B' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/banking?child=b'));
    await screen.findByText('Account b');
    await act(async () => finish({ data: { account: { frozen: true } }, error: null }));
    expect(screen.getByText('Account b')).toBeInTheDocument();
    expect(screen.queryByText('Account a')).toBeNull();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Freeze' })).toBeEnabled();
  });
});

describe('the child (F5-K)', () => {
  function fixture(owner: 'kid' | 'parent' = 'parent', failure = false) {
    mocks.roles = ['kid'];
    let frozen = true;
    mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => {
      if (path === '/banking/account/freeze' && options.method === 'POST') {
        if (failure) return { data: null, error: { code: 'DATA_UNAVAILABLE' } };
        frozen = false;
        return { data: { account: { frozen } }, error: null };
      }
      const by = frozen ? (owner === 'kid' ? 'you' : 'tutor') : null;
      const data = path === '/banking/overview' ? {
        register: 'young',
        account: { nickname: 'Synthetic account', design: 'indigo', simulated: true,
          freeze: { frozen, by, since: frozen ? '2026-09-20T00:00:00Z' : null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: !frozen || owner === 'kid' } },
        pockets: { save: 10, spend: 0, share: 0 }, pendingCredits: 1, spendLimit: { configured: false },
        statement: { month: '2026-09', earned: 10, spent: 0, saved: 10 },
      }
        : path.startsWith('/banking/overview/month?month=') ? { register: 'young', statement: { month: path.slice(-7), earned: 3, spent: 1, saved: 2 } }
        : path === '/banking/register' ? { register: 'young' }
        : path === '/banking/account' ? { account: { nickname: 'Synthetic account', cardDesign: 'indigo', frozen, frozenBy: frozen ? owner : null, frozenAt: null, openedAt: '2026-01-01T00:00:00Z' } }
        : path === '/banking/wallet/pending-credits' ? { credits: [{ id: 'credit', amount: 10, source: 'allowance', createdAt: '2026-09-20T00:00:00Z' }] }
        : { status: { configured: false } };
      return { data, error: null };
    });
    return page();
  }

  it('preserves the pending credit and explains the hold, and offers no way to lift a Tutor freeze', async () => {
    fixture();
    expect(await screen.findByText('Your Tutor froze it.')).toBeInTheDocument();
    expect(screen.getByText('Only your Tutor can unfreeze it.')).toBeInTheDocument();
    expect(screen.getByText('They wait until the freeze ends.')).toBeInTheDocument();
    for (const hold of ['Rewards', 'Splitting coins', 'New coins', 'Share gifts']) expect(screen.getByText(hold)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unfreeze' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Split' })).toBeDisabled();
    expect(mocks.api.mock.calls.some(([path]) => String(path).endsWith('/freeze'))).toBe(false);
  });

  it("resumes the split only after the child's own freeze is lifted and re-read", async () => {
    fixture('kid');
    fireEvent.click(await screen.findByRole('button', { name: 'Unfreeze' }));
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(mocks.api).toHaveBeenCalledWith('/banking/account/freeze', expect.objectContaining({ method: 'POST', body: { frozen: false } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split' })).toBeEnabled());
  });

  it('shows a failed unfreeze and keeps the confirmed frozen state and credits', async () => {
    fixture('kid', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Unfreeze' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not change. Try again.');
    expect(screen.getAllByText('Frozen').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled();
  });

  it("reads the month before from Core in the child's register and comes back to this month (F5-K, W2F.3)", async () => {
    fixture();
    fireEvent.click(await screen.findByRole('button', { name: 'Month before' }));
    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith('/banking/overview/month?month=2026-08', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { name: 'This month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).toBeNull();
  });
});
