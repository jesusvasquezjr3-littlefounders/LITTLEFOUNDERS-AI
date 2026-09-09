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
  /** A single role, or "at least one of" a set — e.g. tasks/ is reachable by BOTH parent (assign/approve) and kid (complete/allocate), a shape family/ never needed. */
  requiresRole?: string | string[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'learn', path: '/learn', icon: 'school' },
  { key: 'tutor', path: '/tutor', icon: 'smart_toy' },
  { key: 'tasks', path: '/tasks', icon: 'checklist', requiresRole: ['parent', 'kid'] },
  { key: 'banca', path: '/banca', icon: 'account_balance', requiresRole: ['parent', 'kid'] },
  { key: 'family', path: '/family', icon: 'family_restroom', requiresRole: 'parent' },
  { key: 'profile', path: '/profile', icon: 'account_circle' },
];

/** Home route after login. */
export const APP_HOME = '/learn';

export function isUnlocked(item: NavItem, roles: string[]): boolean {
  if (!item.requiresRole) return true;
  const required = Array.isArray(item.requiresRole) ? item.requiresRole : [item.requiresRole];
  return required.some((r) => roles.includes(r));
}
