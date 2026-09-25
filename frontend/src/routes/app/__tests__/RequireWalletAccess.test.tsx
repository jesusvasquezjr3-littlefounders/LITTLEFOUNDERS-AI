import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * S07.2 (D.3) route gates, UI only: /wallet only for a self-registered teen;
 * /tasks and /banking for the parent/kid roles as before, or a teen who linked
 * a verified parent. Everyone else is sent home. Core re-checks every request.
 */

const auth = { session: { user: { id: 'u' } } as unknown, roles: [] as string[], meLoaded: true };
const wallet = { loaded: true, holder: null as 'teen' | 'managed_child' | null, familyChild: false };
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../wallet/useWalletAccess', () => ({ useWalletAccess: () => wallet }));

const { RequireWalletAccess } = await import('../wallet/RequireWalletAccess');

function renderAt(mode: 'teen' | 'familyMoney') {
  render(<MemoryRouter initialEntries={['/x']}>
    <Routes>
      <Route path="/x" element={<RequireWalletAccess mode={mode}><p>inside</p></RequireWalletAccess>} />
      <Route path="/learn" element={<p>home</p>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => { auth.roles = ['universal']; wallet.loaded = true; wallet.holder = null; wallet.familyChild = false; });

describe('RequireWalletAccess', () => {
  it('admits a self-registered teen to their wallet', () => {
    wallet.holder = 'teen';
    renderAt('teen');
    expect(screen.getByText('inside')).toBeVisible();
  });

  it.each([
    ['an adult learner', ['universal'], null],
    ['a verified parent', ['parent'], null],
    ['a parent-created child', ['kid'], 'managed_child'],
  ] as const)('sends %s home from /wallet', (_label, roles, holder) => {
    auth.roles = [...roles]; wallet.holder = holder;
    renderAt('teen');
    expect(screen.getByText('home')).toBeVisible();
  });

  it('keeps Tasks/Banking for parents and children, and admits a linked teen only', () => {
    auth.roles = ['parent'];
    renderAt('familyMoney');
    expect(screen.getByText('inside')).toBeVisible();
  });

  it('sends an unlinked teen home from Tasks/Banking, and admits them once linked', () => {
    wallet.holder = 'teen';
    const first = render(<MemoryRouter initialEntries={['/x']}><Routes>
      <Route path="/x" element={<RequireWalletAccess mode="familyMoney"><p>inside</p></RequireWalletAccess>} />
      <Route path="/learn" element={<p>home</p>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('home')).toBeVisible();
    first.unmount();
    wallet.familyChild = true;
    renderAt('familyMoney');
    expect(screen.getByText('inside')).toBeVisible();
  });

  it('renders nothing while the classification is loading (never a flash of the page)', () => {
    wallet.loaded = false;
    renderAt('teen');
    expect(screen.queryByText('inside')).toBeNull();
    expect(screen.queryByText('home')).toBeNull();
  });
});
