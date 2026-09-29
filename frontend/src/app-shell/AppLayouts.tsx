import { Fragment, useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useWalletAccess } from '@/routes/app/wallet/useWalletAccess';
import { LearnerShell, StaffShell, STAFF_PERMISSIONS, TutorShell, type ShellNavItem, type StaffGrants, type StaffNavItem, type StaffPermission } from '@/rebuild/design/controls';
import { appShellKind, currentSlot, learnerNav, MENTOR_PATH, staffNav, tutorNav, type NavSlot, type ShellAccount } from './navigation';
import { ShellRoot, useShellCopy, useShellLocale, useShellNavigate } from './ShellRoot';
import { useLearnerBand } from './useLearnerBand';
import { useMentorCharacter } from './useMentorCharacter';
import { TeenAnalyticsDisclosure } from './TeenAnalyticsDisclosure';

/*
 * The signed-in shells on real routes (W2 Lane 0), replacing the legacy
 * AppLayout. RequireAuth and RequireOnboarded stay in App.tsx around these
 * layouts, and every page keeps its own guard; the shells only choose what
 * navigation a person sees:
 *
 *   AppShellLayout  the learner app (LearnerShell) for learners, teens, adults
 *                   and staff learning; the Tutor console (TutorShell) for a
 *                   verified parent (OD-6).
 *   StaffShellLayout  /admin: the staff console (StaffShell), its items
 *                   filtered by the same grants the route guards check.
 */

const APP_NAME = 'LittleFounders';

/** The account as the shells need it, from the auth context and Core's wallet classification. */
function useShellAccount(): ShellAccount {
  const { roles, adminPermissions } = useAuth();
  const wallet = useWalletAccess();
  return { roles, adminPermissions, wallet };
}

/** A.1: a suspended or purged kid never sees an app shell; the language of record follows the profile. */
function useSignedInFrame(): ReactNode | null {
  const { suspended, deleted, profile } = useAuth();
  const { i18n } = useTranslation();
  // The DB locale is the user's language of record — the UI follows it.
  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.resolvedLanguage) void i18n.changeLanguage(profile.locale);
  }, [profile?.locale, i18n]);
  if (suspended || deleted) return <Navigate to="/account-suspended" replace />;
  return null;
}

function toItems<Label extends string>(slots: readonly NavSlot<Label>[], label: (slot: NavSlot<Label>) => string): ShellNavItem[] {
  return slots.map((slot) => ({ id: slot.id, label: label(slot), href: slot.path, iconAssetId: slot.iconAssetId }));
}

/** A public profile's page title is its handle; any other page is titled by its navigation slot. */
function pageTitleFor(pathname: string, items: readonly ShellNavItem[], current: string, fallback: string): string {
  const item = items.find((entry) => entry.id === current);
  if (item) return item.label;
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? decodeURIComponent(segment) : fallback;
}

/** The learner app or the Tutor console, around every signed-in page that is not the staff console. */
export function AppShellLayout() {
  const redirect = useSignedInFrame();
  const account = useShellAccount();
  const kind = appShellKind(account);
  const character = useMentorCharacter(kind === 'learner' && !redirect);
  // Bible 06 §7 (GAP-FIX-R4): the learner's band on the shell root, so every learner page and the shell chrome
  // are budgeted at the learner's age; the Tutor console serves a verified parent, always an adult.
  const learnerBand = useLearnerBand(kind === 'learner' && !redirect);
  const copy = useShellCopy().appShell;
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  if (redirect) return redirect;

  const slots = kind === 'tutor' ? tutorNav(account) : learnerNav(account);
  const items = toItems(slots, (slot) => copy.nav[slot.label]);
  const onMentor = pathname === MENTOR_PATH || pathname.startsWith(`${MENTOR_PATH}/`);
  const current = onMentor ? 'mentor' : currentSlot(pathname, slots);
  const common = {
    appName: APP_NAME, pageTitle: pageTitleFor(pathname, items, current, copy.nav.profile), routeKey: pathname, locale,
    onNavigate: navigate, current, items,
  };
  // Every page is rebuilt (02 rule 23, D13): the shell's <main> owns the content box and the route entrance.
  // The key keeps a page's own state from surviving a move to another address on the same route.
  const body = <Fragment key={pathname}><Outlet /></Fragment>;
  return <ShellRoot ageBand={kind === 'tutor' ? 'adult' : learnerBand}>
    {kind === 'tutor'
      ? <TutorShell {...common} roleLabel={copy.tutorRole}
        labels={{ skip: copy.skip, navigation: copy.navigation, menu: copy.menu, close: copy.close }}>{body}</TutorShell>
      : <LearnerShell {...common} labels={{ skip: copy.skip, navigation: copy.navigation }}
        mentor={{ href: MENTOR_PATH, name: copy.mentor, character }}>{body}</LearnerShell>}
    {/* H.1, Appendix O 2.2(a) (F3-identity-site): a self-registered teen's first-session analytics choice. */}
    {kind === 'learner' ? <TeenAnalyticsDisclosure /> : null}
  </ShellRoot>;
}

/** The staff grants of this account, as StaffShell filters by them (mirrors RequireStaffPermission). */
function staffGrants(roles: readonly string[], permissions: readonly string[]): StaffGrants {
  return {
    superadmin: roles.includes('superadmin'),
    permissions: STAFF_PERMISSIONS.filter((grant) => roles.includes('admin') && permissions.includes(grant)),
  };
}

/** The staff console around every /admin page. */
export function StaffShellLayout() {
  const redirect = useSignedInFrame();
  const { roles, adminPermissions } = useAuth();
  const copy = useShellCopy().appShell;
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  if (redirect) return redirect;

  const entries = staffNav({ roles, adminPermissions });
  const items: StaffNavItem[] = entries.map(({ slot, grant }) => ({
    id: slot.id, href: slot.path, iconAssetId: slot.iconAssetId,
    label: slot.label === 'backToApp' ? copy.nav.backToApp : copy.staff[slot.label],
    ...(grant ? { permission: grant as StaffPermission | readonly StaffPermission[] } : {}),
  }));
  const current = currentSlot(pathname, entries.map(({ slot }) => slot));
  // The staff console serves staff, adults only (Bible 06 §7: the root carries the band).
  return <ShellRoot ageBand="adult">
    <StaffShell appName={APP_NAME} pageTitle={items.find((item) => item.id === current)?.label ?? copy.staffRole} routeKey={pathname}
      locale={locale} onNavigate={navigate} current={current} items={items} grants={staffGrants(roles, adminPermissions)}
      roleLabel={copy.staffRole} labels={{ skip: copy.skip, navigation: copy.navigation, menu: copy.menu, close: copy.close }}>
      <Outlet />
    </StaffShell>
  </ShellRoot>;
}
