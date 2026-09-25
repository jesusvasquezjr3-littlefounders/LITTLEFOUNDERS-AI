import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { KidBankingHome } from '../KidBankingHome';
import { resetMoneyRegisterCache } from '../../family/useMoneyRegister';

/*
 * D.1 at the child's Banking page, on the S07.6 rebuilt coin account (D.7):
 * a pending payout stays and its split stays disabled while frozen, the hold
 * is explained with what a freeze really holds, a child is never offered a
 * way to lift a Tutor's freeze, and a failed unfreeze keeps the confirmed
 * frozen state. The server's refusal is the boundary (backend banking and
 * moneyPresentation tests); this is the display.
 */
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic') }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mocks.getToken, session: { user: { id: 'kid' } } }) }));
// S07.3's rebuilt bonus explainer has its own tests (rebuild/family/FamilyMoney.test.tsx).
vi.mock('../SavingsBonusPanel', () => ({ SavingsBonusPanel: () => null }));
// S07.4's rebuilt goals, usual split and split chooser have their own tests
// (rebuild/family/MoneyHabits.test.tsx, routes/app/tasks/__tests__/MoneyHabitsPanels.test.tsx);
// here the page only has to hand the freeze to the payout's split control.
vi.mock('../../tasks/SavingsGoalsPanel', () => ({ SavingsGoalsPanel: () => null }));
vi.mock('../../tasks/UsualSplitPanel', () => ({ UsualSplitPanel: () => null }));
vi.mock('../../tasks/AllocationPanel', () => ({
  AllocationPanel: ({ frozen }: { frozen?: boolean }) => <button type="button" disabled={frozen}>Split them</button>,
}));
beforeEach(async () => { mocks.api.mockReset(); resetMoneyRegisterCache(); await i18n.changeLanguage('en-US'); });

function fixture(owner: 'kid' | 'parent' = 'parent', failure = false) {
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
      : path === '/banking/register' ? { register: 'young' }
      : path === '/banking/account' ? { account: { nickname: 'Synthetic account', cardDesign: 'indigo', frozen, frozenBy: frozen ? owner : null, frozenAt: null } }
      : path === '/tasks/wallet' ? { balances: { save: 10, spend: 0, share: 0 } }
      : path === '/tasks/wallet/ledger' ? { entries: [] }
      : path === '/banking/wallet/pending-credits' ? { credits: [{ id: 'credit', amount: 10, source: 'allowance', createdAt: '2026-09-20T00:00:00Z' }] }
      : { status: { configured: false } };
    return { data, error: null };
  });
  return render(<MemoryRouter><KidBankingHome /></MemoryRouter>);
}

it('preserves the pending credit and explains the hold, and offers no way to lift a Tutor freeze', async () => {
  fixture();
  expect(await screen.findByText('Your Tutor froze it.')).toBeInTheDocument();
  expect(screen.getByText('Only your Tutor can unfreeze it.')).toBeInTheDocument();
  expect(screen.getByText('They wait until the freeze ends.')).toBeInTheDocument();
  for (const hold of ['Rewards', 'Splitting coins', 'New coins', 'Share gifts']) expect(screen.getByText(hold)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Unfreeze' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Split them' })).toBeDisabled();
  expect(mocks.api.mock.calls.some(([path]) => String(path).endsWith('/freeze'))).toBe(false);
});

it("resumes the split only after the child's own freeze is lifted and re-read", async () => {
  fixture('kid');
  fireEvent.click(await screen.findByRole('button', { name: 'Unfreeze' }));
  await waitFor(() => expect(screen.getByText('Not frozen')).toBeInTheDocument());
  expect(mocks.api).toHaveBeenCalledWith('/banking/account/freeze', expect.objectContaining({ method: 'POST', body: { frozen: false } }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Split them' })).toBeEnabled());
  expect(screen.getByRole('status')).toHaveTextContent('Unfrozen.');
});

it('shows a failed unfreeze and keeps the confirmed frozen state and credits', async () => {
  fixture('kid', true);
  fireEvent.click(await screen.findByRole('button', { name: 'Unfreeze' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That did not change. Try again.');
  expect(screen.getAllByText('Frozen').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Split them' })).toBeDisabled();
});
