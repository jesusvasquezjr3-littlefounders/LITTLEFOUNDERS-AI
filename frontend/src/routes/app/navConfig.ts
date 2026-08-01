/*
 * The single registry the whole app shell renders from. Adding a product
 * section = one entry here + a route in App.tsx — sidebar, mobile tabs, and
 * lock states follow automatically.
 *
 * `requiresRole` gates by the 6-role model (/AGENTS.md §1.4): absent = every
 * signed-in user; present = the item renders LOCKED until the account holds
 * that role (upgrades happen through verification, never client-side).
 */

export interface NavItem {
  key: string; // i18n: dashboard.nav.<key>
  path: string;
  icon: string; // Material Symbols ligature
  requiresRole?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'learn', path: '/learn', icon: 'school' },
  { key: 'tutor', path: '/tutor', icon: 'smart_toy' },
  { key: 'tasks', path: '/tasks', icon: 'checklist', requiresRole: 'parent' },
  { key: 'family', path: '/family', icon: 'family_restroom', requiresRole: 'parent' },
  { key: 'profile', path: '/profile', icon: 'account_circle' },
];

/** Home route after login. */
export const APP_HOME = '/learn';

export function isUnlocked(item: NavItem, roles: string[]): boolean {
  return !item.requiresRole || roles.includes(item.requiresRole);
}
