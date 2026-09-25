import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { KidBankingHome } from '../KidBankingHome';
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic') }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
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
beforeEach(async () => { mocks.api.mockReset(); await i18n.changeLanguage('en-US'); });
function fixture(owner = 'parent', failure = false) {
  let frozen = true;
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith('/freeze')) {
      if (failure) return { data: null, error: { code: 'DATA_UNAVAILABLE' } };
      frozen = false;
    }
    const account = { kidUserId: 'kid', nickname: 'Synthetic account', cardDesign: 'indigo', displayNumber: 'LF-0000-0000', frozen, frozenBy: owner, frozenAt: null };
    const data = path.startsWith('/banking/account') ? { account }
      : path === '/tasks/wallet' ? { balances: { save: 10, spend: 0, share: 0 } }
      : path === '/tasks/goals' ? { goals: [] }
      : path === '/tasks/wallet/ledger' ? { entries: [] }
      : path === '/banking/wallet/pending-credits' ? { credits: [{ id: 'credit', amount: 10, source: 'allowance' }] }
      : { status: { configured: false } };
    return { data, error: null };
  });
  return render(<MemoryRouter><KidBankingHome /></MemoryRouter>);
}
it('preserves pending credit and explains the hold while disabling guardian unfreeze', async () => {
  fixture();
  expect(await screen.findByText('Your credits stay here while the card is frozen. You can split them after it is unfrozen.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Split them' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
  const toggle = screen.getByRole('switch', { name: 'Freeze this card' });
  expect(toggle).toBeDisabled(); fireEvent.click(toggle);
  expect(mocks.api.mock.calls.some(([path]) => path.endsWith('/freeze'))).toBe(false);
});
it('resumes allocation controls only after successful own-freeze release', async () => {
  fixture('kid'); await screen.findByText('Synthetic account');
  fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Freeze this card' }));
  await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
  expect(screen.getByRole('button', { name: 'Split them' })).toBeEnabled();
});
it('shows a failed unfreeze and retains the confirmed frozen state and credits', async () => {
  fixture('kid', true); await screen.findByText('Synthetic account');
  fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Freeze this card' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('button', { name: 'Split them' })).toBeDisabled();
});
