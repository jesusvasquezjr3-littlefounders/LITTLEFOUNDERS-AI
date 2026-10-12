import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { BackToTop } from '@/components/BackToTop';
import { MobileSignInBar } from '@/components/MobileSignInBar';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { ShellContext } from '@/components/pageTitle';
import { SiteFooter } from '@/components/SiteFooter';
import { TopbarControls } from '@/components/TopbarControls';
import { KeepLearningButton, useHasSession } from '@/features/app/KeepLearning';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { ENTER } from '@/lib/motionPresets';
import { landingTitle } from '@/siteTitle';

/*
 * The site around the page: a skip link, the sticky header with the brand and the display controls,
 * one <main>, and the footer (SiteFooter). The document title follows the page (WCAG 2.4.2): the home
 * page's own, or the one a page sets with `usePageTitle`. Around the page: a skeleton while its code
 * loads, a short fade-in on every navigation after the first, a jump back to the top of the new page,
 * the back-to-top button and, on phones, the fixed sign-in bar.
 */

const CONTAINER = 'mx-auto w-full max-w-[1120px] px-4 sm:px-6';

export function AppShell() {
  const copy = useCoreCopy();
  const locale = useLocale();
  const mainId = `${useId().replace(/:/g, '')}-main`;
  const { pathname, hash } = useLocation();
  const [title, setTitle] = useState<string | null>(null);
  const pageTitle = title ?? landingTitle(locale);
  const appName = copy.appShell.brand;
  const navigated = useRef(false);
  const hasSession = useHasSession();
  const context: ShellContext = { setTitle };

  useEffect(() => { document.title = pageTitle ? `${pageTitle} · ${appName}` : appName; }, [pageTitle, appName]);

  // A new page starts at its top (an in-page #anchor keeps its own target). The first render is not a navigation.
  useEffect(() => {
    if (navigated.current && !hash) window.scrollTo({ top: 0, behavior: 'instant' });
    navigated.current = true;
  }, [pathname, hash]);

  return <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]" lang={locale}>
    <a href={`#${mainId}`} className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--primary)] focus:px-5 focus:py-3 focus:text-[var(--primary-foreground)]"
      onClick={(event) => {
        const main = document.getElementById(mainId);

        if (!main) return;

        event.preventDefault();
        main.focus();
      }}>{copy.appShell.skip}</a>
    <header className="sticky top-0 z-30 border-b border-[var(--v-border)] bg-[var(--background)]/90 backdrop-blur">
      <div className={`${CONTAINER} flex h-[72px] items-center justify-between gap-2`}>
        <a href="/" data-brand-link aria-label={appName} className="flex min-h-12 min-w-0 items-center"><img src="/brand/logo.png" alt={appName} width={560} height={102} className="h-5 w-auto min-[400px]:h-6 sm:h-8" /></a>
        <div className="flex items-center gap-2">
          {/* somebody with a session goes back to their home from here; phones have the bar at the bottom for it */}
          {hasSession ? <KeepLearningButton size="sm" origin="topbar" className="max-md:!hidden" /> : null}
          <TopbarControls />
        </div>
      </div>
    </header>
    <main id={mainId} tabIndex={-1} className={`${CONTAINER} flex-1 outline-none`}>
      <Suspense fallback={<PageSkeleton />}>
        <motion.div key={pathname} initial={navigated.current ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: ENTER }}>
          <Outlet context={context} />
        </motion.div>
      </Suspense>
    </main>
    <SiteFooter />
    <BackToTop />
    <MobileSignInBar />
  </div>;
}
