/*
 * Staff-console sections, as the legacy Overview page uses them to decide
 * which of its cards to show. The console NAVIGATION is no longer built from
 * this list: the staff shell (app-shell/navigation.ts, W2) reads
 * app-routes/staffGrants.ts, the same table the route guards use. Gating:
 * every section needs admin OR superadmin; `superadminOnly` items (Roles &
 * Access) are superadmin-only (§1.4). Replaced with the staff lane's rebuild.
 */

export interface AdminSection {
  key: string; // i18n: admin.nav.<key>
  path: string;
  icon: string; // Material Symbols ligature
  superadminOnly?: boolean;
  permission?: 'manage_users' | 'manage_content' | 'view_analytics' | 'manage_support';
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', path: '/admin', icon: 'space_dashboard' },
  { key: 'content', path: '/admin/content', icon: 'menu_book', permission: 'manage_content' },
  { key: 'users', path: '/admin/users', icon: 'group', permission: 'manage_users' },
  { key: 'emails', path: '/admin/emails', icon: 'mail', permission: 'manage_support' },
  { key: 'analytics', path: '/admin/analytics', icon: 'monitoring', permission: 'view_analytics' },
  { key: 'intel', path: '/admin/intel', icon: 'bar_chart', permission: 'view_analytics' },
  { key: 'generation', path: '/admin/generation', icon: 'precision_manufacturing', permission: 'manage_content' },
  { key: 'audit', path: '/admin/audit', icon: 'history', permission: 'manage_support' },
  { key: 'reports', path: '/admin/reports', icon: 'report', permission: 'manage_support' },
  { key: 'roles', path: '/admin/roles', icon: 'admin_panel_settings', superadminOnly: true },
];

/** Sections visible to a user holding these roles. */
export function visibleAdminSections(roles: string[], permissions: string[] = []): AdminSection[] {
  const isSuperadmin = roles.includes('superadmin');
  if (!isSuperadmin && !roles.includes('admin')) return [];
  const hasAnyGrant = ['manage_users', 'manage_content', 'view_analytics', 'manage_support']
    .some((permission) => permissions.includes(permission));
  return ADMIN_SECTIONS.filter((s) => (!s.superadminOnly || isSuperadmin)
    && (s.key !== 'overview' || isSuperadmin || hasAnyGrant)
    && (!s.permission || isSuperadmin || permissions.includes(s.permission)));
}
