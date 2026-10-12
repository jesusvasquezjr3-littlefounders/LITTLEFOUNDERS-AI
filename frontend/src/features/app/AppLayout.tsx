import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/AppIcon';
import { PageSkeleton } from '@/components/PageSkeleton';
import { TopbarControls } from '@/components/TopbarControls';
import { Dock, type DockItem } from '@/components/ui/dock';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenuButton, SidebarMenuLabel, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuthDialog } from '@/features/auth/AuthDialog';
import { useSession } from '@/features/auth/session';
import { SavedNotice } from '@/features/onboarding/SavedNotice';
import { onboarding, useOnboardingAnswers } from '@/features/onboarding/store';
import { useGuest } from '@/features/app/guest';
import { useHome, type Destination, type HomeState } from '@/features/app/homeData';
import { destinationOf, nextPlace } from '@/features/app/nextPlace';
import { useAppCopy, useCoreCopy, useLocale } from '@/i18n/useCopy';
import { ENTER } from '@/lib/motionPresets';
import { useTheme } from '@/theme/useTheme';

/*
 * The signed-in application around its pages (D-051): on a desktop a sidebar that can be collapsed
 * and follows the color mode (light in light, dark in dark),
 * on a phone a dock of icons with no words, a bar with the display controls and the account, and
 * one <main>. Every destination's icon is the application's own (AppIcon), alive on the current one.
 *
 * Nobody gets in without a session: a visitor is sent to the home page of the site with the sign-in
 * window open, and an account that still owes its age waits here, empty, while that window asks for
 * it. What the menu lists comes from Core (the home read); until it answers, the menu shows the
 * places everybody has.
 */
const EVERYBODY: Destination[] = ['home', 'learn', 'mentor', 'wallet', 'tasks'];

/** What the layout hands its pages through the router's outlet. */
export type AppContext = { home: HomeState };

const OPEN_KEY = 'lf.sidebar';

/** How large a dock icon may be so that `count` of them fit this screen: 46 px, less on the narrowest phones. */
function useDockItemSize(count: number): number {
  const fit = () => Math.max(34, Math.min(46, Math.floor((window.innerWidth - 56) / count) - 8));
  const [size, setSize] = useState(fit);

  useEffect(() => {
    const onResize = () => setSize(fit());

    onResize();

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, [count]);

  return size;
}

/** Whether the sidebar was left open on this device. A convenience: it works the same without storage. */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeOpen(isOpen: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, isOpen ? '1' : '0');
  } catch {
    // storage can be blocked: the sidebar simply opens the next time
  }
}

export function AppLayout() {
  const session = useSession();
  const dialog = useAuthDialog();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const copy = useAppCopy();
  const core = useCoreCopy();
  const locale = useLocale();
  const { isDark } = useTheme();
  const mainId = `${useId().replace(/:/g, '')}-main`;
  const [isOpen, setIsOpen] = useState(readOpen);
  const hasAccount = session.status === 'signedIn' && session.account !== null && !session.account.needsAge;
  // An account made with "Sign in", without the onboarding, has no name and no mentor yet. It chooses
  // them before it comes in: the home greets by name and every place is led by the mentor.
  // Unless the onboarding was just walked and its answers are about to be given to this account
  // (Handoff.tsx): then there is nothing to ask, only a moment to wait.
  const answers = useOnboardingAnswers();
  const hasNoProfile = hasAccount && session.account?.displayName === '' && session.account.mentor === null;
  const isTakingAnswers = hasNoProfile && answers?.finished === true && onboarding.isOwnerPresent();
  const isNew = hasNoProfile && !isTakingAnswers;
  // somebody with no account who walked the onboarding comes in as a guest (guest.ts)
  const guest = useGuest();
  const isIn = (hasAccount && !hasNoProfile) || guest !== null;
  const current = destinationOf(pathname);

  // A visitor is taken to the site's home page, where the sign-in window opens, and the place they
  // asked for is kept for when they are in (nextPlace.ts). Somebody who was in and signed out goes
  // there too, but nothing opens and nothing is kept: they just said they were leaving.
  const wasIn = useRef(false);

  if (isIn) wasIn.current = true;

  useEffect(() => {
    if (session.status !== 'signedOut' || guest) return;

    if (!wasIn.current) nextPlace.keep(pathname);

    void navigate('/', { replace: true });

    if (!wasIn.current) dialog.open();
  }, [session.status, navigate, dialog, pathname, guest]);

  useEffect(() => {
    if (!isNew) return;

    nextPlace.keep(pathname);
    void navigate(session.account?.parentIntent ? '/onboarding/parent' : '/onboarding', { replace: true });
  }, [isNew, navigate, pathname, session.account]);

  // the person arrived: nothing is owed to where they were going
  useEffect(() => {
    if (isIn) nextPlace.clear();
  }, [isIn, pathname]);

  useEffect(() => {
    const appName = core.appShell.brand;

    document.title = current ? `${copy.nav[current]} · ${appName}` : appName;
  }, [current, copy, core]);

  if (!isIn) return <div className="min-h-dvh bg-[var(--background)]" lang={locale}><PageSkeleton /></div>;

  return <Signed mainId={mainId} isOpen={isOpen} isDark={isDark} current={current} onOpenChange={(next) => { setIsOpen(next); writeOpen(next); }} />;
}

/** The application once somebody is in. Apart from the guard above so the home is asked for only then. */
function Signed({ mainId, isOpen, isDark, current, onOpenChange }: { mainId: string; isOpen: boolean; isDark: boolean; current: Destination | null; onOpenChange: (isOpen: boolean) => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const copy = useAppCopy();
  const core = useCoreCopy();
  const locale = useLocale();
  const { account } = useSession();
  const guest = useGuest();
  const home = useHome(`${account?.displayName ?? ''}|${account?.mentor ?? ''}`, guest);
  const destinations = home.status === 'ready' ? home.home.destinations : EVERYBODY;
  const context: AppContext = { home };
  const dockItemSize = useDockItemSize(destinations.length);
  const items: DockItem[] = destinations.map((destination) => ({ value: destination, label: copy.nav[destination], icon: <AppIcon name={destination} size={Math.round(dockItemSize * 0.66)} active={current === destination} /> }));

  // a place the account does not have (Family, for somebody under 18) is not shown: back to the home
  useEffect(() => {
    if (home.status === 'ready' && current && !home.home.destinations.includes(current)) void navigate('/home', { replace: true });
  }, [home, current, navigate]);

  return <div className="min-h-dvh bg-[var(--background)] text-[color:var(--v-text)]" lang={locale}>
    <a href={`#${mainId}`} className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--primary)] focus:px-5 focus:py-3 focus:text-[var(--primary-foreground)]"
      onClick={(event) => {
        const main = document.getElementById(mainId);

        if (!main) return;

        event.preventDefault();
        main.focus();
      }}>{core.appShell.skip}</a>

    <div className="lg:flex lg:items-start lg:gap-6 lg:p-4">
      {/* The library draws its sidebar dark in both modes; ours follows the mode, so in light it is a light panel. */}
      <Sidebar open={isOpen} onOpenChange={onOpenChange} className={`sticky top-4 h-[calc(100dvh-32px)] shrink-0 max-lg:!hidden ${isDark ? '' : 'lf-sidebar-light'}`}>
        <SidebarHeader>
          {isOpen ? <img src={isDark ? '/brand/logo-white.png' : '/brand/logo.png'} alt={core.appShell.brand} width={560} height={102} className="h-6 w-auto" /> : null}
          <SidebarTrigger aria-label={isOpen ? copy.nav.collapse : copy.nav.expand} className="text-[color:var(--sidebar-foreground)]"><AppIcon name="chevron" size={22} className={isOpen ? '' : 'rotate-180'} /></SidebarTrigger>
        </SidebarHeader>
        <SidebarContent aria-label={copy.nav.label}>
          {/* A row is 48 px tall, a target a finger can hit, and the current one keeps the color of the
              others: the library's orange label is too faint to read on either sidebar (3.4 to 1 on the dark one). */}
          {destinations.map((destination) => <SidebarMenuButton key={destination} asChild isActive={current === destination} label={copy.nav[destination]} className="!h-12 [&_.v-nav\_\_label]:!text-[color:var(--sidebar-foreground)] data-[state=active]:!bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)]">
            <NavLink to={`/${destination}`}><AppIcon name={destination} size={30} active={current === destination} /><SidebarMenuLabel>{copy.nav[destination]}</SidebarMenuLabel></NavLink>
          </SidebarMenuButton>)}
        </SidebarContent>
      </Sidebar>

      <div className="mx-auto grid w-full min-w-0 max-w-[1160px] gap-6 px-4 pb-[120px] pt-3 sm:px-6 lg:px-0 lg:pb-8 lg:pt-0">
        <header className="flex min-h-14 items-center justify-between gap-2">
          <img src={isDark ? '/brand/logo-white.png' : '/brand/logo.png'} alt={core.appShell.brand} width={560} height={102} className="h-5 w-auto min-[400px]:h-6 sm:h-7 lg:invisible" />
          <TopbarControls />
        </header>
        {/* a guest is told that what they chose lives on this device, with the way to keep it and the way to erase it */}
        <SavedNotice compact />
        <main id={mainId} tabIndex={-1} className="min-w-0 outline-none">
          <Suspense fallback={<PageSkeleton />}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: ENTER }}>
              <Outlet context={context} />
            </motion.div>
          </Suspense>
        </main>
      </div>
    </div>

    {/* On a phone the menu is a dock of icons with no words; each keeps its name for a screen reader.
        The dock's own colored tiles are left blank: the icons carry the color. */}
    <div className="fixed inset-x-0 bottom-3 z-20 flex justify-center px-3 lg:hidden [&_[data-part=label]]:!hidden [&_[data-part=visual]]:![background:transparent] [&_[data-part=visual]]:!shadow-none">
      <Dock items={items} variant="glass" value={current ?? 'home'} onValueChange={(value) => { void navigate(`/${value}`); }} itemSize={dockItemSize} magnification={1.12} aria-label={copy.nav.label} />
    </div>
  </div>;
}
