import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FAMILY_WALLET_PATH, LEGACY_FAMILY_WALLET_PATH, SLOTS } from '@/app-shell/navigation';

/*
 * OD-28 glossary: the family Wallet lives at /family-wallet ("bank" is a term
 * the glossary avoids). The retired /banking path redirects there and keeps
 * the Tutor's `?child=` selection; every navigation slot points at the new path.
 */

vi.mock('@/routes/app/banking/BankingPage', () => ({ BankingPage: () => <p>family wallet page</p> }));
vi.mock('@/routes/app/wallet/RequireWalletAccess', () => ({ RequireWalletAccess: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/routes/app/wallet/TeenWalletPage', () => ({ TeenWalletPage: () => null }));
vi.mock('@/routes/app/tasks/TasksPage', () => ({ TasksPage: () => null }));
vi.mock('@/routes/app/family/FamilyPage', () => ({ FamilyPage: () => null }));
vi.mock('@/routes/app/family/KidTerritoryPage', () => ({ KidTerritoryPage: () => null }));
vi.mock('@/routes/app/family/KidTutorPage', () => ({ KidTutorPage: () => null }));
vi.mock('@/auth/RequireRole', () => ({ RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const { familyShellRoutes } = await import('../family');

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/">{familyShellRoutes}</Route></Routes>
    <Where />
  </MemoryRouter>,
);

describe('the family Wallet path (OD-28)', () => {
  it('opens the Wallet at /family-wallet', () => {
    at(FAMILY_WALLET_PATH);
    expect(screen.getByText('family wallet page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/family-wallet');
  });

  it('redirects the retired /banking path and keeps the chosen child', () => {
    at(`${LEGACY_FAMILY_WALLET_PATH}?child=kid-a`);
    expect(screen.getByText('family wallet page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/family-wallet?child=kid-a');
  });

  it('points every family Wallet slot at the new path', () => {
    for (const slot of [SLOTS.childWallet, SLOTS.familyCoins, SLOTS.coins]) expect(slot.path).toBe(FAMILY_WALLET_PATH);
  });
});
