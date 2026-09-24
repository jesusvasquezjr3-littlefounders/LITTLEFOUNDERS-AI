import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WireBankingAccount } from '../types';
import i18n from '@/i18n';
import { ParentBankingControlPanel } from '../ParentBankingControlPanel';
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic') }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
const account = (kidId: string, frozen = false): WireBankingAccount => ({ nickname: `Account ${kidId}`, cardDesign: 'indigo', displayNumber: 'LF-0000-0000', frozen, frozenBy: frozen ? 'parent' : null, frozenAt: null, openedAt: '2026-01-01T00:00:00Z' });
beforeEach(async () => { mocks.api.mockReset(); await i18n.changeLanguage('en-US'); });
function fixture(write: () => Promise<unknown>) {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith('/freeze')) return write();
    const data = path === '/family/kids' ? { kids: [{ userId: 'a', displayName: 'Child A' }, { userId: 'b', displayName: 'Child B' }] }
      : path.startsWith('/banking/accounts/') ? { account: account(path.split('/').at(-1)!) }
      : path.startsWith('/tasks/redemptions') ? { redemptions: [] }
      : path.startsWith('/banking/spend-limit') ? { status: { configured: false } }
      : { rule: null };
    return { data, error: null };
  });
  return render(<ParentBankingControlPanel />);
}
it('shows a freeze failure, retains the confirmed state and permits retry', async () => {
  let attempts = 0;
  fixture(async () => ++attempts === 1 ? { data: null, error: { code: 'DATA_UNAVAILABLE' } } : { data: { account: account('a', true) }, error: null });
  fireEvent.click(await screen.findByRole('switch', { name: 'Freeze this card' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('switch', { name: 'Freeze this card' })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('switch', { name: 'Freeze this card' }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Freeze this card' })).toHaveAttribute('aria-checked', 'true'));
  expect(screen.queryByRole('alert')).toBeNull();
});
it('does not apply a pending freeze response to another child', async () => {
  let finish!: (value: unknown) => void;
  fixture(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(await screen.findByRole('switch', { name: 'Freeze this card' }));
  expect(screen.getByRole('switch', { name: 'Freeze this card' })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Child B' }));
  await screen.findByText('Account b');
  await act(async () => finish({ data: { account: account('a', true) }, error: null }));
  expect(screen.getByText('Account b')).toBeInTheDocument();
  expect(screen.queryByText('Account a')).toBeNull();
  expect(screen.getByRole('switch', { name: 'Freeze this card' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('switch', { name: 'Freeze this card' })).toBeEnabled();
});
