import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { ParentTaskBoard } from './ParentTaskBoard';
import { KidTaskBoard } from './KidTaskBoard';

/*
 * /tasks — FAMILY_HUB.md's earn (chores) -> allocate (Save/Spend/Share) ->
 * goal loop. Unlike every other product-section page, this ONE branches by
 * role at the top rather than being two separate routes: a `parent` assigns
 * and approves, a `kid` completes and allocates, and `RequireRole` in
 * App.tsx already lets both roles reach `/tasks` (navConfig's
 * `requiresRole: ['parent', 'kid']`). A family where the SAME account somehow
 * held both roles would see the parent view — `parent` is checked first
 * because approving/assigning is the higher-stakes action, and no real
 * account is expected to ever hold both.
 */
export function TasksPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();

  if (roles.includes('parent')) return <ParentTaskBoard />;
  if (roles.includes('kid')) return <KidTaskBoard />;

  // Reachable only mid-flight while roles are still loading (RequireRole
  // already redirects anyone without either role away from this route).
  return <p className="lf-body p-6 text-content-muted">{t('tasks.loading')}</p>;
}

export default TasksPage;
