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
  /** The section is a rebuilt console screen (W2T.1-W2T.3): the staff shell renders it directly, not inside a legacy page body. */
  rebuilt?: true;
}

export const STAFF_ROUTE_GRANTS: readonly StaffRouteGrant[] = [
  { id: 'overview', path: 'admin', grant: ['manage_users', 'manage_content', 'view_analytics', 'manage_support'], rebuilt: true },
  { id: 'content', path: 'admin/content', grant: 'manage_content', rebuilt: true },
  { id: 'users', path: 'admin/users', grant: 'manage_users', rebuilt: true },
  { id: 'emails', path: 'admin/emails', grant: 'manage_support', rebuilt: true },
  // G.5 (W2T.3): Insights (S8) is the Insights view of Learning intel, reached from its menu entry; this path opens that view.
  { id: 'insights', path: 'admin/insights', grant: 'view_analytics', redirectTo: 'intel', rebuilt: true },
  { id: 'intel', path: 'admin/intel', grant: 'view_analytics', rebuilt: true },
  { id: 'analytics', path: 'admin/analytics', grant: 'view_analytics', rebuilt: true },
  // C.24: the Mentor-quality dashboard. Core reads it behind view_analytics; naming owners needs manage_users (Core).
  { id: 'mentorQuality', path: 'admin/mentor-quality', grant: 'view_analytics', rebuilt: true },
  { id: 'generation', path: 'admin/generation', grant: 'manage_content', rebuilt: true },
  { id: 'audit', path: 'admin/audit', grant: 'manage_support', rebuilt: true },
  { id: 'reports', path: 'admin/reports', grant: 'manage_support', rebuilt: true },
  { id: 'roles', path: 'admin/roles', grant: 'superadmin', rebuilt: true },
];

/** Whether a console path shows a rebuilt screen (the staff shell then gives it the whole content area). */
export function isRebuiltStaffPath(pathname: string): boolean {
  const path = pathname.replace(/^\/+|\/+$/g, '');
  return STAFF_ROUTE_GRANTS.some((route) => route.rebuilt === true && route.path === path);
}
