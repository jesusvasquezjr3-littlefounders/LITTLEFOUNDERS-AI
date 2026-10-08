import { STAFF_ROUTE_GRANTS, type StaffGrant } from '@/app-routes/staffGrants';
import { NAV_MARKS } from '@/rebuild/design/navMarks';
import { APP_HOME } from './home';

/*
 * One navigation definition per shell.
 *
 * Each entry is a SLOT: an id, the copy key of its
 * label (`rebuild-core.json` → `appShell.nav` / `appShell.staff`), the path it
 * points at and the area (`owner`) whose route that is. An area that
 * moves or renames its route changes the slot's `path` here (and nothing
 * else); adding, removing or reordering a slot is a shell change, because
 * the order and who sees what are product decisions.
 *
 * Navigation hides what a person cannot open; it never authorises anything.
 * Every destination is still enforced by its route guard and by Core.
 */

export { APP_HOME };
/** The Mentor stage's route. The learner's tab shows the chosen character's name, never this path's word. */
export const MENTOR_PATH = '/tutor';

export type Lane = 'core' | 'site' | 'learn' | 'mentor' | 'profile' | 'staff';
export type AppNavLabel = 'learn' | 'profile' | 'staff' | 'backToApp';
export type StaffNavLabel = 'overview' | 'content' | 'users' | 'ageCorrections' | 'emails' | 'analytics' | 'intel' | 'mentorQuality' | 'generation' | 'audit' | 'reports' | 'roles';

export interface NavSlot<Label extends string = AppNavLabel> {
  id: string;
  label: Label;
  path: string;
  owner: Lane;
  /**
   * The slot's navigation mark (manifest slot `nav.icon`). Every slot has one, so the
   * phone tab bar can show inactive tabs as 48 px icons below a 360 px container.
   */
  iconAssetId: string;
}

/** What the shells know about the signed-in account. Display only: the guards and Core decide access. */
export interface ShellAccount {
  roles: readonly string[];
  adminPermissions: readonly string[];
}

/* ---------------------------------------------------------------------------
 * Slots
 * ------------------------------------------------------------------------- */

export const SLOTS = {
  learn: { id: 'learn', label: 'learn', path: '/learn', owner: 'learn', iconAssetId: NAV_MARKS.learn },
  profile: { id: 'profile', label: 'profile', path: '/profile', owner: 'profile', iconAssetId: NAV_MARKS.profile },
  staff: { id: 'staff', label: 'staff', path: '/admin', owner: 'staff', iconAssetId: NAV_MARKS.staff },
  backToApp: { id: 'back-to-app', label: 'backToApp', path: APP_HOME, owner: 'core', iconAssetId: NAV_MARKS.backToApp },
} as const satisfies Record<string, NavSlot>;

/** Staff console sections in menu order; one per page of app-routes/staffGrants.ts that is not a redirect. */
export const STAFF_SLOTS: readonly NavSlot<StaffNavLabel>[] = [
  { id: 'overview', label: 'overview', path: '/admin', owner: 'staff', iconAssetId: NAV_MARKS.overview },
  { id: 'content', label: 'content', path: '/admin/content', owner: 'staff', iconAssetId: NAV_MARKS.content },
  { id: 'users', label: 'users', path: '/admin/users', owner: 'staff', iconAssetId: NAV_MARKS.users },
  { id: 'ageCorrections', label: 'ageCorrections', path: '/admin/age-corrections', owner: 'staff', iconAssetId: NAV_MARKS.ageCorrections },
  { id: 'emails', label: 'emails', path: '/admin/emails', owner: 'staff', iconAssetId: NAV_MARKS.emails },
  { id: 'analytics', label: 'analytics', path: '/admin/analytics', owner: 'staff', iconAssetId: NAV_MARKS.analytics },
  { id: 'intel', label: 'intel', path: '/admin/intel', owner: 'staff', iconAssetId: NAV_MARKS.intel },
  { id: 'mentorQuality', label: 'mentorQuality', path: '/admin/mentor-quality', owner: 'staff', iconAssetId: NAV_MARKS.mentorQuality },
  { id: 'generation', label: 'generation', path: '/admin/generation', owner: 'staff', iconAssetId: NAV_MARKS.generation },
  { id: 'audit', label: 'audit', path: '/admin/audit', owner: 'staff', iconAssetId: NAV_MARKS.audit },
  { id: 'reports', label: 'reports', path: '/admin/reports', owner: 'staff', iconAssetId: NAV_MARKS.reports },
  { id: 'roles', label: 'roles', path: '/admin/roles', owner: 'staff', iconAssetId: NAV_MARKS.roles },
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

/** The verified parent (the Tutor) gets the Tutor console; everyone else the learner app. */
export function appShellKind(account: Pick<ShellAccount, 'roles'>): 'tutor' | 'learner' {
  return account.roles.includes('parent') ? 'tutor' : 'learner';
}

/** The learner app's destinations, without the Mentor tab (the shell inserts it second). */
export function learnerNav(account: ShellAccount): NavSlot[] {
  const items: NavSlot[] = [SLOTS.learn, SLOTS.profile];
  if (canOpenConsole(account)) items.push(SLOTS.staff);
  return items;
}

/** A verified parent sees the same destinations as a learner. */
export const tutorNav = learnerNav;

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
