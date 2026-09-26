import { lazy, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { RequireRole, RequireStaffPermission } from '@/auth/RequireRole';
import { LazyRoute } from './LazyRoute';

/*
 * Lane 6 (staff): the staff console. App.tsx (Lane 0) mounts these inside the
 * staff shell (RequireAuth + RequireOnboarded).
 *
 * The console is off the first-load path: every learner used to download the
 * whole admin console before /learn could paint, and it is reachable only
 * behind the staff guards. Each page is lazy and wrapped in LazyRoute
 * (RouteErrorBoundary), because a lazy chunk can fail to arrive right after a
 * deploy, and an unhandled rejection inside Suspense is a blank page.
 */
const AdminOverviewPage = lazy(() => import('@/routes/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminContentPage = lazy(() => import('@/routes/admin/AdminContentPage').then((m) => ({ default: m.AdminContentPage })));
const AdminEmailDashboard = lazy(() => import('@/routes/admin/AdminEmailDashboard').then((m) => ({ default: m.AdminEmailDashboard })));
const AdminInsightsPage = lazy(() => import('@/routes/admin/AdminInsightsPage').then((m) => ({ default: m.AdminInsightsPage })));
const AdminIntelPage = lazy(() => import('@/routes/admin/AdminIntelPage').then((m) => ({ default: m.AdminIntelPage })));
const AdminUsersPage = lazy(() => import('@/routes/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAuditPage = lazy(() => import('@/routes/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminReportsPage = lazy(() => import('@/routes/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminRolesPage = lazy(() => import('@/routes/admin/AdminRolesPage').then((m) => ({ default: m.AdminRolesPage })));
const AnalyticsHealthPage = lazy(() => import('@/routes/admin/AnalyticsHealthPage').then((m) => ({ default: m.AnalyticsHealthPage })));
const AdminGenerationPage = lazy(() => import('@/routes/admin/AdminGenerationPage').then((m) => ({ default: m.AdminGenerationPage })));

/** Both staff roles share the console; Roles & Access narrows to superadmin. */
export const STAFF_ROLES = ['admin', 'superadmin'];

export type StaffGrant = 'manage_users' | 'manage_content' | 'view_analytics' | 'manage_support';

export interface StaffRoute {
  /** The console section (the staff navigation's slot id). */
  id: string;
  path: string;
  /** The named permissions any one of which opens the page, or `superadmin` for the superadmin-only page. */
  grant: StaffGrant | readonly StaffGrant[] | 'superadmin';
  page: ReactNode;
}

/*
 * Staff routes use both role and named-permission guards. The server checks
 * the same grants before platform reads or writes. Roles & Access remains
 * Superadmin-only. The staff navigation (app-shell/navigation.ts) is tested
 * against this table, so a page and its menu entry cannot disagree.
 */
export const STAFF_ROUTES: readonly StaffRoute[] = [
  { id: 'overview', path: 'admin', grant: ['manage_users', 'manage_content', 'view_analytics', 'manage_support'], page: <AdminOverviewPage /> },
  { id: 'content', path: 'admin/content', grant: 'manage_content', page: <AdminContentPage /> },
  { id: 'users', path: 'admin/users', grant: 'manage_users', page: <AdminUsersPage /> },
  { id: 'emails', path: 'admin/emails', grant: 'manage_support', page: <AdminEmailDashboard /> },
  { id: 'insights', path: 'admin/insights', grant: 'view_analytics', page: <AdminInsightsPage /> },
  { id: 'intel', path: 'admin/intel', grant: 'view_analytics', page: <AdminIntelPage /> },
  { id: 'analytics', path: 'admin/analytics', grant: 'view_analytics', page: <AnalyticsHealthPage /> },
  { id: 'generation', path: 'admin/generation', grant: 'manage_content', page: <AdminGenerationPage /> },
  { id: 'audit', path: 'admin/audit', grant: 'manage_support', page: <AdminAuditPage /> },
  { id: 'reports', path: 'admin/reports', grant: 'manage_support', page: <AdminReportsPage /> },
  { id: 'roles', path: 'admin/roles', grant: 'superadmin', page: <AdminRolesPage /> },
];

function guarded({ grant, page }: StaffRoute) {
  if (grant === 'superadmin') return <RequireRole role="superadmin"><LazyRoute>{page}</LazyRoute></RequireRole>;
  return (
    <RequireRole role={STAFF_ROLES}>
      <RequireStaffPermission permission={typeof grant === 'string' ? grant : [...grant]}>
        <LazyRoute>{page}</LazyRoute>
      </RequireStaffPermission>
    </RequireRole>
  );
}

export const staffShellRoutes = <>{STAFF_ROUTES.map((route) => <Route key={route.path} path={route.path} element={guarded(route)} />)}</>;
