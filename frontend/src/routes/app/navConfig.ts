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
  { key: 'banking', path: '/banking', icon: 'account_balance', requiresRole: ['parent', 'kid'] },
  { key: 'family', path: '/family', icon: 'family_restroom', requiresRole: 'parent' },
  { key: 'profile', path: '/profile', icon: 'account_circle' },
];

/** Home route after login. */
export const APP_HOME = '/learn';

/** S07.2 (D.3, OD-3 Option B): the self-registered teen's personal wallet. Never locked: absent for everyone else. */
export const WALLET_NAV_ITEM: NavItem = { key: 'wallet', path: '/wallet', icon: 'savings' };

/** What the server says this account's wallet is (routes/app/wallet/useWalletAccess). */
export interface NavWalletAccess { holder: 'teen' | 'managed_child' | null; familyChild: boolean }

export function isUnlocked(item: NavItem, roles: string[], wallet?: NavWalletAccess): boolean {
  if (!item.requiresRole) return true;
  // A teen who linked a verified parent is a child in a family: Tasks and
  // Banking layer onto their wallet (Core admits them by age and link).
  if (wallet?.familyChild && (item.key === 'tasks' || item.key === 'banking')) return true;
  const required = Array.isArray(item.requiresRole) ? item.requiresRole : [item.requiresRole];
  return required.some((r) => roles.includes(r));
}

/**
 * The shell's items for this account. A self-registered teen sees Learn,
 * Mentor, Tasks (locked until a parent links), Wallet and Profile (the
 * Bible's learner shell); Banking appears once a parent links and set it
 * up, and Family never does (a teen cannot become a Tutor). Everyone else
 * keeps the registry as it is.
 */
export function navItemsFor(wallet?: NavWalletAccess): NavItem[] {
  if (wallet?.holder !== 'teen') return NAV_ITEMS;
  const items: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (item.key === 'family' || (item.key === 'banking' && !wallet.familyChild)) continue;
    items.push(item);
    if (item.key === 'tasks') items.push(WALLET_NAV_ITEM);
  }
  return items;
}

/** Where a locked item leads: a teen is sent to their wallet (where a parent is invited), an adult to Tutor verification. */
export function lockedTargetFor(wallet?: NavWalletAccess): string {
  return wallet?.holder === 'teen' ? WALLET_NAV_ITEM.path : '/verify-parent';
}
