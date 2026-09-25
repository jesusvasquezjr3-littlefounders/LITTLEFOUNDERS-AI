import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { ParentBankingControlPanel } from './ParentBankingControlPanel';
import { KidBankingHome } from './KidBankingHome';
import { useWalletAccess } from '../wallet/useWalletAccess';

/*
 * /banking — BANKING.md's money home: a named account, a card, goals in
 * full, allowance automation, a spend limit, a "Parent-Paid" savings bonus,
 * and the monthly statement. Same role-branch shape as TasksPage.tsx — a
 * `parent` sees the control panel, a `kid` sees their own account — because
 * `navConfig`'s `requiresRole: ['parent', 'kid']` already lets both reach
 * this one route, and no real account is expected to hold both roles.
 */
export function BankingPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const wallet = useWalletAccess();

  if (roles.includes('parent')) return <ParentBankingControlPanel />;
  if (roles.includes('kid')) return <KidBankingHome />;
  // S07.2 (D.3): a teen who linked a verified parent sees their own account.
  if (wallet.familyChild) return <KidBankingHome />;

  return <p className="lf-body p-6 text-content-muted">{t('banking.loading')}</p>;
}

export default BankingPage;
