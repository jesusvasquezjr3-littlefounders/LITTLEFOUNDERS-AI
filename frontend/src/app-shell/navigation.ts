import { STAFF_ROUTE_GRANTS, type StaffGrant } from '@/app-routes/staffGrants';
import { APP_HOME } from './home';

/*
 * One navigation definition per shell (W2 "Shells and routing", Lane 0).
 *
 * Lane 0 owns this file. Each entry is a SLOT: an id, the copy key of its
 * label (`rebuild-core.json` → `appShell.nav` / `appShell.staff`), the path it
 * points at and the wave-2 lane (`owner`) whose route that is. A lane that
 * moves or renames its route changes the slot's `path` here (and nothing
 * else); adding, removing or reordering a slot is a Lane 0 change, because
 * the order and who sees what are product decisions (owner proposals in
 * docs/rebuild/sprints/W2-SHELLS-AND-ROUTING.md).
 *
 * Navigation hides what a person cannot open; it never authorises anything.
 * Every destination is still enforced by its route guard and by Core.
 */

export { APP_HOME };
/** The Mentor stage's route (Lane 3). The learner's tab shows the chosen character's name, never this path's word. */
export const MENTOR_PATH = '/tutor';

export type Lane = 'core' | 'site' | 'learn' | 'mentor' | 'family' | 'profile' | 'staff';
export type AppNavLabel = 'learn' | 'tasks' | 'wallet' | 'familyCoins' | 'coins' | 'profile' | 'family' | 'becomeTutor' | 'staff' | 'backToApp';
export type StaffNavLabel = 'overview' | 'content' | 'users' | 'ageCorrections' | 'emails' | 'analytics' | 'intel' | 'mentorQuality' | 'generation' | 'audit' | 'reports' | 'roles';

export interface NavSlot<Label extends string = AppNavLabel> {
  id: string;
  label: Label;
  path: string;
  owner: Lane;
}

/** What the shells know about the signed-in account. Display only: the guards and Core decide access. */
export interface ShellAccount {
  roles: readonly string[];
  adminPermissions: readonly string[];
  /** GET /wallet/access, by age (S07.2, OD-3 Option B). */
  wallet: { loaded: boolean; holder: 'teen' | 'managed_child' | null; familyChild: boolean };
}

/* ---------------------------------------------------------------------------
 * Slots
 * ------------------------------------------------------------------------- */

export const SLOTS = {
  learn: { id: 'learn', label: 'learn', path: '/learn', owner: 'learn' },
  tasks: { id: 'tasks', label: 'tasks', path: '/tasks', owner: 'family' },
  /** The independent teen's personal wallet (OD-3 Option B). */
  teenWallet: { id: 'wallet', label: 'wallet', path: '/wallet', owner: 'family' },
  /** A parent-created child's coin card: their wallet. */
  childWallet: { id: 'banking', label: 'wallet', path: '/banking', owner: 'family' },
  /** A teen who linked a verified parent: the family coin card beside their own wallet. */
  familyCoins: { id: 'banking', label: 'familyCoins', path: '/banking', owner: 'family' },
  /** The verified parent's view of the family's coin cards. */
  coins: { id: 'banking', label: 'coins', path: '/banking', owner: 'family' },
  family: { id: 'family', label: 'family', path: '/family', owner: 'family' },
  /** An adult who is not yet a verified parent: the way into Tutor verification. */
  becomeTutor: { id: 'become-tutor', label: 'becomeTutor', path: '/verify-parent', owner: 'site' },
  profile: { id: 'profile', label: 'profile', path: '/profile', owner: 'profile' },
  staff: { id: 'staff', label: 'staff', path: '/admin', owner: 'staff' },
  backToApp: { id: 'back-to-app', label: 'backToApp', path: APP_HOME, owner: 'core' },
} as const satisfies Record<string, NavSlot>;

/** Staff console sections in menu order; one per page of app-routes/staffGrants.ts that is not a redirect (tested). */
export const STAFF_SLOTS: readonly NavSlot<StaffNavLabel>[] = [
  { id: 'overview', label: 'overview', path: '/admin', owner: 'staff' },
  { id: 'content', label: 'content', path: '/admin/content', owner: 'staff' },
  { id: 'users', label: 'users', path: '/admin/users', owner: 'staff' },
  { id: 'ageCorrections', label: 'ageCorrections', path: '/admin/age-corrections', owner: 'staff' },
  { id: 'emails', label: 'emails', path: '/admin/emails', owner: 'staff' },
  { id: 'analytics', label: 'analytics', path: '/admin/analytics', owner: 'staff' },
  { id: 'intel', label: 'intel', path: '/admin/intel', owner: 'staff' },
  { id: 'mentorQuality', label: 'mentorQuality', path: '/admin/mentor-quality', owner: 'staff' },
  { id: 'generation', label: 'generation', path: '/admin/generation', owner: 'staff' },
  { id: 'audit', label: 'audit', path: '/admin/audit', owner: 'staff' },
  { id: 'reports', label: 'reports', path: '/admin/reports', owner: 'staff' },
  { id: 'roles', label: 'roles', path: '/admin/roles', owner: 'staff' },
];

/* ---------------------------------------------------------------------------
 * Who sees which shell and which slots
 * ------------------------------------------------------------------------- */

const STAFF_GRANTS: readonly StaffGrant[] = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'];

/** A staff member who can open at least one console page (a superadmin, or an admin with a grant). */
export function canOpenConsole(account: Pick<ShellAccount, 'roles' | 'adminPermissions'>): boolean {
  if (account.roles.includes('superadmin')) return true;
  return account.roles.includes('admin') && account.adminPermissions.some((grant) => (STAFF_GRANTS as readonly string[]).includes(grant));
}

/** The verified parent (the Tutor, OD-6) gets the Tutor console; everyone else the learner app. */
export function appShellKind(account: Pick<ShellAccount, 'roles'>): 'tutor' | 'learner' {
  return account.roles.includes('parent') ? 'tutor' : 'learner';
}

/**
 * The learner app's destinations, without the Mentor tab (the shell inserts it
 * second, where the mockup puts it). Learn and Profile for everyone; Tasks for
 * a child in a family (a parent-created child, or a teen who linked a verified
 * parent); the personal wallet for a self-registered teen (OD-3 Option B); the
 * family coin card for a child in a family; "Become a Tutor" for an adult who
 * is not yet a verified parent (never for a staff account); the staff console
 * for staff who can open at least one console page.
 */
export function learnerNav(account: ShellAccount): NavSlot[] {
  const { roles, wallet } = account;
  const kid = roles.includes('kid');
  const items: NavSlot[] = [SLOTS.learn];
  if (kid || wallet.familyChild) items.push(SLOTS.tasks);
  if (wallet.holder === 'teen') items.push(SLOTS.teenWallet);
  if (kid) items.push(SLOTS.childWallet);
  else if (wallet.holder === 'teen' && wallet.familyChild) items.push(SLOTS.familyCoins);
  items.push(SLOTS.profile);
  const staff = canOpenConsole(account);
  const staffRole = roles.includes('admin') || roles.includes('superadmin');
  if (!kid && !staffRole && !roles.includes('parent') && wallet.loaded && wallet.holder === null) items.push(SLOTS.becomeTutor);
  if (staff) items.push(SLOTS.staff);
  return items;
}

/** The verified parent's console: the family first, then their own learning and profile. */
export function tutorNav(account: ShellAccount): NavSlot[] {
  const items: NavSlot[] = [SLOTS.family, SLOTS.tasks, SLOTS.coins, SLOTS.learn, SLOTS.profile];
  if (canOpenConsole(account)) items.push(SLOTS.staff);
  return items;
}

/** The staff console's sections this account may open (superadmin-only sections only for a superadmin), then the way back. */
export function staffNav(account: Pick<ShellAccount, 'roles' | 'adminPermissions'>): { slot: NavSlot<StaffNavLabel | 'backToApp'>; grant?: StaffGrant | readonly StaffGrant[] }[] {
  const superadmin = account.roles.includes('superadmin');
  const sections = STAFF_SLOTS.flatMap((slot) => {
    const route = STAFF_ROUTE_GRANTS.find((entry) => entry.id === slot.id);
    if (!route) return [];
    if (route.grant === 'superadmin') return superadmin ? [{ slot }] : [];
    return [{ slot, grant: route.grant }];
  });
  return [...sections, { slot: SLOTS.backToApp }];
}

/* ---------------------------------------------------------------------------
 * The current slot of a path
 * ------------------------------------------------------------------------- */

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The slot a path belongs to among `items` (the longest matching path wins), or '' when none does. */
export function currentSlot(pathname: string, items: readonly Pick<NavSlot<string>, 'id' | 'path'>[]): string {
  let best = { id: '', length: -1 };
  for (const item of items) {
    // "Back to app" points home; it is never where a staff page is.
    if (item.id === SLOTS.backToApp.id) continue;
    const exactOnly = item.path === '/admin' && items.some((other) => other.path.startsWith('/admin/'));
    const matches = exactOnly ? pathname === item.path : within(pathname, item.path);
    if (matches && item.path.length > best.length) best = { id: item.id, length: item.path.length };
  }
  return best.id;
}
