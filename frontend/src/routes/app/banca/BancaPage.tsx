import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { ParentBancaControlPanel } from './ParentBancaControlPanel';
import { KidBancaHome } from './KidBancaHome';

/*
 * /banca — BANCA_DIGITAL.md's money home: a named account, a card, goals in
 * full, allowance automation, a spend limit, a "Parent-Paid" savings bonus,
 * and the monthly statement. Same role-branch shape as TasksPage.tsx — a
 * `parent` sees the control panel, a `kid` sees their own account — because
 * `navConfig`'s `requiresRole: ['parent', 'kid']` already lets both reach
 * this one route, and no real account is expected to hold both roles.
 */
export function BancaPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();

  if (roles.includes('parent')) return <ParentBancaControlPanel />;
  if (roles.includes('kid')) return <KidBancaHome />;

  return <p className="lf-body p-6 text-content-muted">{t('banca.loading')}</p>;
}

export default BancaPage;
