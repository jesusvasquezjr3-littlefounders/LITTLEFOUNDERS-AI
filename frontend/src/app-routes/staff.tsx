import { lazy, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { RequireRole, RequireStaffPermission } from '@/auth/RequireRole';
import { LazyRoute } from './LazyRoute';
import { STAFF_ROUTE_GRANTS, type StaffRouteGrant } from './staffGrants';

/*
 * Lane 6 (staff): the staff console. App.tsx (Lane 0) mounts these inside the
 * staff shell (RequireAuth + RequireOnboarded); ./staffGrants.ts says which
 * grant opens each page.
 *
 * The console is off the first-load path: every learner used to download the
 * whole admin console before /learn could paint, and it is reachable only
 * behind the staff guards. Each page is lazy and wrapped in LazyRoute
 * (RouteErrorBoundary), because a lazy chunk can fail to arrive right after a
 * deploy, and an unhandled rejection inside Suspense is a blank page.
 */
/*
 * W2T.1: Overview, Users, Emails, Audit log, Reports and Roles & Access; W2T.2:
 * Content, Generation and Mentor quality (C.24) are the rebuilt console
 * screens (./staffConsole.tsx hosts them). Analytics & Health and Learning
 * intel are still legacy page bodies until this lane rebuilds them.
 */
const loadConsole = () => import('./staffConsole');
const StaffOverviewRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffOverviewRoute })));
const StaffUsersRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffUsersRoute })));
const StaffEmailsRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffEmailsRoute })));
const StaffAuditRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffAuditRoute })));
const StaffReportsRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffReportsRoute })));
const StaffRolesRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffRolesRoute })));
const StaffContentRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffContentRoute })));
const StaffGenerationRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffGenerationRoute })));
const StaffMentorQualityRoute = lazy(() => loadConsole().then((m) => ({ default: m.StaffMentorQualityRoute })));
const AdminInsightsPage = lazy(() => import('@/routes/admin/AdminInsightsPage').then((m) => ({ default: m.AdminInsightsPage })));
const AdminIntelPage = lazy(() => import('@/routes/admin/AdminIntelPage').then((m) => ({ default: m.AdminIntelPage })));
const AnalyticsHealthPage = lazy(() => import('@/routes/admin/AnalyticsHealthPage').then((m) => ({ default: m.AnalyticsHealthPage })));

/** Both staff roles share the console; Roles & Access narrows to superadmin. */
export const STAFF_ROLES = ['admin', 'superadmin'];

/** The page of each console section (./staffGrants.ts ids). */
export const STAFF_PAGES: Readonly<Record<string, ReactNode>> = {
  overview: <StaffOverviewRoute />,
  content: <StaffContentRoute />,
  users: <StaffUsersRoute />,
  emails: <StaffEmailsRoute />,
  insights: <AdminInsightsPage />,
  intel: <AdminIntelPage />,
  analytics: <AnalyticsHealthPage />,
  mentorQuality: <StaffMentorQualityRoute />,
  generation: <StaffGenerationRoute />,
  audit: <StaffAuditRoute />,
  reports: <StaffReportsRoute />,
  roles: <StaffRolesRoute />,
};

/*
 * Staff routes use both role and named-permission guards. The server checks
 * the same grants before platform reads or writes. Roles & Access remains
 * Superadmin-only.
 */
function guarded({ id, grant }: StaffRouteGrant) {
  const page = <LazyRoute>{STAFF_PAGES[id]}</LazyRoute>;
  if (grant === 'superadmin') return <RequireRole role="superadmin">{page}</RequireRole>;
  return (
    <RequireRole role={STAFF_ROLES}>
      <RequireStaffPermission permission={typeof grant === 'string' ? grant : [...grant]}>{page}</RequireStaffPermission>
    </RequireRole>
  );
}

export const staffShellRoutes = <>{STAFF_ROUTE_GRANTS.map((route) => <Route key={route.path} path={route.path} element={guarded(route)} />)}</>;
