/*
 * Lane 6 (staff): which named permission opens each staff console page. Data
 * only, so the route guards (./staff.tsx) and the staff navigation
 * (app-shell/navigation.ts) read one table: a page and its menu entry cannot
 * disagree. Core's requireAdminPermission checks the same grants on every
 * platform read or write; this table is presentation and route admission only.
 */
export type StaffGrant = 'manage_users' | 'manage_content' | 'view_analytics' | 'manage_support';

export interface StaffRouteGrant {
  /** The console section (the staff navigation's slot id). */
  id: string;
  path: string;
  /** The named permissions any one of which opens the page, or `superadmin` for the superadmin-only page. */
  grant: StaffGrant | readonly StaffGrant[] | 'superadmin';
  /** A compatibility path that only redirects to another section: kept for old bookmarks, never a menu entry. */
  redirectTo?: string;
  /** The section is a rebuilt console screen (W2T.1): the staff shell renders it directly, not inside a legacy page body. */
  rebuilt?: true;
}

export const STAFF_ROUTE_GRANTS: readonly StaffRouteGrant[] = [
  { id: 'overview', path: 'admin', grant: ['manage_users', 'manage_content', 'view_analytics', 'manage_support'], rebuilt: true },
  { id: 'content', path: 'admin/content', grant: 'manage_content' },
  { id: 'users', path: 'admin/users', grant: 'manage_users', rebuilt: true },
  { id: 'emails', path: 'admin/emails', grant: 'manage_support', rebuilt: true },
  // G.5: Insights now lives inside Learning intel (the page redirects to /admin/intel?focus=learning).
  { id: 'insights', path: 'admin/insights', grant: 'view_analytics', redirectTo: 'intel' },
  { id: 'intel', path: 'admin/intel', grant: 'view_analytics' },
  { id: 'analytics', path: 'admin/analytics', grant: 'view_analytics' },
  { id: 'generation', path: 'admin/generation', grant: 'manage_content' },
  { id: 'audit', path: 'admin/audit', grant: 'manage_support', rebuilt: true },
  { id: 'reports', path: 'admin/reports', grant: 'manage_support', rebuilt: true },
  { id: 'roles', path: 'admin/roles', grant: 'superadmin', rebuilt: true },
];

/** Whether a console path shows a rebuilt screen (the staff shell then gives it the whole content area). */
export function isRebuiltStaffPath(pathname: string): boolean {
  const path = pathname.replace(/^\/+|\/+$/g, '');
  return STAFF_ROUTE_GRANTS.some((route) => route.rebuilt === true && route.path === path);
}
