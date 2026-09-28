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
}

export const STAFF_ROUTE_GRANTS: readonly StaffRouteGrant[] = [
  { id: 'overview', path: 'admin', grant: ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] },
  { id: 'content', path: 'admin/content', grant: 'manage_content' },
  { id: 'users', path: 'admin/users', grant: 'manage_users' },
  { id: 'emails', path: 'admin/emails', grant: 'manage_support' },
  // G.5 (W2T.3): Insights (S8) is the Insights view of Learning intel, reached from its menu entry; this path opens that view.
  { id: 'insights', path: 'admin/insights', grant: 'view_analytics', redirectTo: 'intel' },
  { id: 'intel', path: 'admin/intel', grant: 'view_analytics' },
  { id: 'analytics', path: 'admin/analytics', grant: 'view_analytics' },
  // C.24: the Mentor-quality dashboard. Core reads it behind view_analytics; naming owners needs manage_users (Core).
  { id: 'mentorQuality', path: 'admin/mentor-quality', grant: 'view_analytics' },
  { id: 'generation', path: 'admin/generation', grant: 'manage_content' },
  { id: 'audit', path: 'admin/audit', grant: 'manage_support' },
  { id: 'reports', path: 'admin/reports', grant: 'manage_support' },
  { id: 'roles', path: 'admin/roles', grant: 'superadmin' },
];
