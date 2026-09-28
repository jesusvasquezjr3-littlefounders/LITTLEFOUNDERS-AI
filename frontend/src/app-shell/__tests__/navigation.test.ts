import { describe, expect, it } from 'vitest';
import { permittedStaffItems, STAFF_PERMISSIONS, type StaffNavItem, type StaffPermission } from '@/rebuild/design/controls';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { STAFF_ROUTE_GRANTS } from '@/app-routes/staffGrants';
import {
  APP_HOME, appShellKind, canOpenConsole, currentSlot, learnerNav, SLOTS, STAFF_SLOTS, staffNav, tutorNav, type ShellAccount,
} from '../navigation';

const wallet = (holder: ShellAccount['wallet']['holder'], familyChild = false, loaded = true) => ({ loaded, holder, familyChild });
const account = (roles: string[], w = wallet(null), adminPermissions: string[] = []): ShellAccount => ({ roles, adminPermissions, wallet: w });
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('learner navigation (the Mentor tab is inserted second by the shell)', () => {
  it('a parent-created child: Learn, Tasks, their coin card as Wallet, Profile', () => {
    const items = learnerNav(account(['kid'], wallet('managed_child', true)));
    expect(ids(items)).toEqual(['learn', 'tasks', 'banking', 'profile']);
    expect(items.find((item) => item.id === 'banking')?.label).toBe('wallet');
  });

  it('an independent teen (OD-3 Option B): the personal wallet, and no Tasks until a parent links', () => {
    expect(ids(learnerNav(account(['universal'], wallet('teen'))))).toEqual(['learn', 'wallet', 'profile']);
  });

  it('a teen who linked a verified parent: Tasks and the family coin card beside the personal wallet', () => {
    const items = learnerNav(account(['universal'], wallet('teen', true)));
    expect(ids(items)).toEqual(['learn', 'tasks', 'wallet', 'banking', 'profile']);
    expect(items.find((item) => item.id === 'banking')?.label).toBe('familyCoins');
  });

  it('an adult who is not a verified parent: the way into Tutor verification, never a locked item', () => {
    const items = learnerNav(account(['universal'], wallet(null)));
    expect(ids(items)).toEqual(['learn', 'profile', 'become-tutor']);
    expect(items.at(-1)?.path).toBe('/verify-parent');
  });

  it('shows nothing about the wallet until Core has classified the account', () => {
    expect(ids(learnerNav(account(['universal'], wallet(null, false, false))))).toEqual(['learn', 'profile']);
  });

  it('staff learning in the app get the console entry, and no Tutor verification offer', () => {
    expect(ids(learnerNav(account(['admin'], wallet(null), ['view_analytics'])))).toEqual(['learn', 'profile', 'staff']);
    expect(ids(learnerNav(account(['superadmin'], wallet(null))))).toEqual(['learn', 'profile', 'staff']);
    // An admin with no grant can open no console page, so the entry is not shown.
    expect(ids(learnerNav(account(['admin'], wallet(null))))).toEqual(['learn', 'profile']);
  });
});

describe('Tutor console (the verified parent, OD-6)', () => {
  it('is the shell of every account holding the parent role', () => {
    expect(appShellKind({ roles: ['parent'] })).toBe('tutor');
    expect(appShellKind({ roles: ['kid'] })).toBe('learner');
    expect(appShellKind({ roles: ['universal'] })).toBe('learner');
  });

  it('puts the family first, then the parent’s own learning and profile', () => {
    expect(ids(tutorNav(account(['parent'])))).toEqual(['family', 'tasks', 'banking', 'learn', 'profile']);
    expect(ids(tutorNav(account(['parent', 'superadmin'])))).toEqual(['family', 'tasks', 'banking', 'learn', 'profile', 'staff']);
  });

  it('has no Mentor slot and no slot that points at the Mentor stage', () => {
    for (const items of [tutorNav(account(['parent'])), learnerNav(account(['kid'], wallet('managed_child', true)))]) {
      expect(items.map((item) => item.path)).not.toContain('/tutor');
    }
  });
});

describe('staff console', () => {
  it('has one slot per staff page that is not a compatibility redirect, at the route’s own path', () => {
    expect(STAFF_SLOTS.map((slot) => slot.id).sort()).toEqual(STAFF_ROUTE_GRANTS.filter((route) => !route.redirectTo).map((route) => route.id).sort());
    // G.5: /admin/insights only redirects into Learning intel, so Insights is reached through that entry.
    expect(STAFF_ROUTE_GRANTS.find((route) => route.id === 'insights')?.redirectTo).toBe('intel');
    for (const slot of STAFF_SLOTS) expect(slot.path).toBe(`/${STAFF_ROUTE_GRANTS.find((route) => route.id === slot.id)!.path}`);
  });

  it('shows exactly the pages the route guards admit, for every grant and role (mirrors RequireStaffPermission)', () => {
    const admits = (roles: string[], permissions: string[], grant: (typeof STAFF_ROUTE_GRANTS)[number]['grant']) => {
      if (grant === 'superadmin') return roles.includes('superadmin');
      const accepted: readonly string[] = typeof grant === 'string' ? [grant] : grant;
      return roles.includes('superadmin') || (roles.includes('admin') && accepted.some((entry) => permissions.includes(entry)));
    };
    const cases: [string[], string[]][] = [
      [['superadmin'], []], [['admin'], []], [['admin'], ['view_analytics']], [['admin'], ['manage_content']],
      [['admin'], ['manage_users']], [['admin'], ['manage_support']], [['admin'], [...STAFF_PERMISSIONS]],
    ];
    for (const [roles, permissions] of cases) {
      const items: StaffNavItem[] = staffNav({ roles, adminPermissions: permissions }).map(({ slot, grant }) => ({
        id: slot.id, label: slot.label, href: slot.path, ...(grant ? { permission: grant as StaffPermission | readonly StaffPermission[] } : {}),
      }));
      const shown = permittedStaffItems(items, { superadmin: roles.includes('superadmin'), permissions: permissions as StaffPermission[] })
        .map((item) => item.id).filter((id) => id !== SLOTS.backToApp.id);
      const admitted = STAFF_SLOTS.filter((slot) => admits(roles, permissions, STAFF_ROUTE_GRANTS.find((route) => route.id === slot.id)!.grant)).map((slot) => slot.id);
      expect(shown, `${roles.join('+')} ${permissions.join('+')}`).toEqual(admitted);
    }
  });

  it('a view_analytics admin sees the overview, analytics, Learning intel (Insights lives there, G.5) and Mentor quality (C.24), then the way back', () => {
    const items = staffNav({ roles: ['admin'], adminPermissions: ['view_analytics'] }).map(({ slot, grant }) => ({
      id: slot.id, label: slot.label, href: slot.path, ...(grant ? { permission: grant as StaffPermission | readonly StaffPermission[] } : {}),
    }));
    expect(permittedStaffItems(items, { superadmin: false, permissions: ['view_analytics'] }).map((item) => item.id))
      .toEqual(['overview', 'analytics', 'intel', 'mentorQuality', 'back-to-app']);
    expect(items.at(-1)?.href).toBe(APP_HOME);
  });

  it('opens the console for a superadmin or an admin holding a grant', () => {
    expect(canOpenConsole({ roles: ['superadmin'], adminPermissions: [] })).toBe(true);
    expect(canOpenConsole({ roles: ['admin'], adminPermissions: ['manage_support'] })).toBe(true);
    expect(canOpenConsole({ roles: ['admin'], adminPermissions: [] })).toBe(false);
    expect(canOpenConsole({ roles: ['parent'], adminPermissions: ['manage_support'] })).toBe(false);
  });
});

describe('current slot', () => {
  const learner = learnerNav(account(['kid'], wallet('managed_child', true)));
  it('matches a section and everything under it', () => {
    expect(currentSlot('/learn', learner)).toBe('learn');
    expect(currentSlot('/learn/money-basics/territory', learner)).toBe('learn');
    expect(currentSlot('/profile/settings', learner)).toBe('profile');
    expect(currentSlot('/family-wallet', learner)).toBe('banking');
    expect(currentSlot('/banking', learner)).toBe('');
    expect(currentSlot('/@ana', learner)).toBe('');
  });
  it('marks the console overview only on /admin itself', () => {
    const staff = staffNav({ roles: ['superadmin'], adminPermissions: [] }).map(({ slot }) => slot);
    expect(currentSlot('/admin', staff)).toBe('overview');
    expect(currentSlot('/admin/content', staff)).toBe('content');
    expect(currentSlot('/admin/roles', staff)).toBe('roles');
  });
});

describe('navigation copy (OD-6, OD-13)', () => {
  it('has a label for every slot in every locale, and never calls the AI a Tutor', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const copy = rebuildNamespaceCopy[locale].core.appShell;
      for (const slot of Object.values(SLOTS)) expect(copy.nav[slot.label], `${locale} ${slot.label}`).toBeTruthy();
      for (const slot of STAFF_SLOTS) expect(copy.staff[slot.label], `${locale} ${slot.label}`).toBeTruthy();
      expect(copy.mentor).toBe('Mentor');
      expect(copy.tutorRole).toBe('Tutor');
      // "Tutor" names only the verified parent: the role pill and the way into verification.
      const withTutor = Object.entries(copy.nav).filter(([, label]) => /tutor/i.test(label)).map(([key]) => key);
      expect(withTutor).toEqual(['becomeTutor']);
    }
  });
});
