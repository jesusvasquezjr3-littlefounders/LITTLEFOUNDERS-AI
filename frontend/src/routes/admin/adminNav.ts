/*
 * Staff-console section registry. The admin experience is INTEGRATED into the
 * app shell (same sidebar/chrome as Learn/Profile) — these render as a "Staff"
 * group in the sidebar (desktop) and a horizontal sub-nav on the admin pages
 * (mobile). Gating: every section needs admin OR superadmin; `superadminOnly`
 * items (Roles & Access) render only for superadmin (§1.4). Never shown to
 * non-staff — hidden, not locked (admin is not an aspirational upgrade).
 */

export interface AdminSection {
  key: string; // i18n: admin.nav.<key>
  path: string;
  icon: string; // Material Symbols ligature
  superadminOnly?: boolean;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', path: '/admin', icon: 'space_dashboard' },
  { key: 'content', path: '/admin/content', icon: 'menu_book' },
  { key: 'users', path: '/admin/users', icon: 'group' },
  { key: 'emails', path: '/admin/emails', icon: 'mail' },
  { key: 'analytics', path: '/admin/analytics', icon: 'monitoring' },
  { key: 'generation', path: '/admin/generation', icon: 'precision_manufacturing' },
  { key: 'audit', path: '/admin/audit', icon: 'history' },
  { key: 'roles', path: '/admin/roles', icon: 'admin_panel_settings', superadminOnly: true },
];

/** Sections visible to a user holding these roles. */
export function visibleAdminSections(roles: string[]): AdminSection[] {
  const isSuperadmin = roles.includes('superadmin');
  return ADMIN_SECTIONS.filter((s) => !s.superadminOnly || isSuperadmin);
}
