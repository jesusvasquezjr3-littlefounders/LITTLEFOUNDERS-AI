import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { ParentBankingControlPanel } from '../ParentBankingControlPanel';

/*
 * D.1 at the Tutor's Banking page, on the S07.6 rebuilt freeze card (D.7): a
 * failed freeze keeps the confirmed state and can be retried, and a response
 * that arrives after the Tutor switched child never lands on the other child.
 */
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic') }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
// S07.3's rebuilt bonus settings and S07.5's decision queue have their own tests.
vi.mock('../SavingsBonusSettingsPanel', () => ({ SavingsBonusSettingsPanel: () => null }));
vi.mock('../../tasks/DecisionQueuePanel', () => ({ DecisionQueuePanel: () => null }));
beforeEach(async () => { mocks.api.mockReset(); await i18n.changeLanguage('en-US'); });

const legacy = (kidId: string) => ({ nickname: `Account ${kidId}`, cardDesign: 'indigo', displayNumber: 'LF-0000-0000', frozen: false, frozenBy: null, frozenAt: null, openedAt: '2026-01-01T00:00:00Z' });
const view = (kidId: string, frozen: boolean) => ({
  register: 'young',
  account: { nickname: `Account ${kidId}`, design: 'indigo', simulated: true,
    freeze: { frozen, by: frozen ? 'you' : null, since: frozen ? '2026-09-20T00:00:00Z' : null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: true } },
});

function fixture(write: () => Promise<unknown>) {
  const frozen: Record<string, boolean> = { a: false, b: false };
  mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => {
    const freeze = path.match(/^\/banking\/accounts\/(\w)\/freeze$/);
    if (freeze && options.method === 'POST') {
      const result = await write() as { error: unknown };
      if (!result.error) frozen[freeze[1]!] = true;
      return result;
    }
    if (freeze) return { data: view(freeze[1]!, frozen[freeze[1]!]!), error: null };
    const data = path === '/family/kids' ? { kids: [{ userId: 'a', displayName: 'Child A' }, { userId: 'b', displayName: 'Child B' }] }
      : path.startsWith('/banking/accounts/') ? { account: legacy(path.split('/').at(-1)!) }
      : path.startsWith('/banking/spend-limit') ? { status: { configured: false } }
      : { rule: null };
    return { data, error: null };
  });
  return render(<ParentBankingControlPanel />);
}

it('shows a freeze failure, keeps the confirmed state and permits a retry', async () => {
  let attempts = 0;
  fixture(async () => ++attempts === 1 ? { data: null, error: { code: 'DATA_UNAVAILABLE' } } : { data: { account: { frozen: true } }, error: null });
  fireEvent.click(await screen.findByRole('button', { name: 'Freeze' }));
  fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That did not change. Try again.');
  expect(screen.getByText('Not frozen')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
  fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
  await waitFor(() => expect(screen.getByText('You froze it.')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Unfreeze' })).toBeEnabled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('does not apply a pending freeze response to another child', async () => {
  let finish!: (value: unknown) => void;
  fixture(() => new Promise((resolve) => { finish = resolve; }));
  fireEvent.click(await screen.findByRole('button', { name: 'Freeze' }));
  fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Child B' }));
  await screen.findByText('Account b');
  await act(async () => finish({ data: { account: { frozen: true } }, error: null }));
  expect(screen.getByText('Account b')).toBeInTheDocument();
  expect(screen.queryByText('Account a')).toBeNull();
  expect(screen.getByText('Not frozen')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Freeze' })).toBeEnabled();
});
