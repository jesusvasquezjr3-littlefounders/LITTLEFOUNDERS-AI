import { useEffect, useId } from 'react';
import { Outlet } from 'react-router-dom';
import { SiteFooter } from '@/components/SiteFooter';
import { TopbarControls } from '@/components/TopbarControls';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { landingTitle } from '@/siteTitle';

/*
 * The site around the page: a skip link, the sticky header with the brand and the display controls,
 * one <main>, and the footer (SiteFooter). The document title follows the page (WCAG 2.4.2).
 */

const CONTAINER = 'mx-auto w-full max-w-[1120px] px-4 sm:px-6';

export function AppShell() {
  const copy = useCoreCopy();
  const locale = useLocale();
  const mainId = `${useId().replace(/:/g, '')}-main`;
  const pageTitle = landingTitle(locale);
  const appName = copy.appShell.brand;

  useEffect(() => { document.title = pageTitle ? `${pageTitle} · ${appName}` : appName; }, [pageTitle, appName]);

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
        <a href="/" aria-label={appName} className="flex min-h-12 min-w-0 items-center"><img src="/brand/logo.png" alt={appName} width={560} height={102} className="h-7 w-auto sm:h-8" /></a>
        <TopbarControls />
      </div>
    </header>
    <main id={mainId} tabIndex={-1} className={`${CONTAINER} flex-1 outline-none`}><Outlet /></main>
    <SiteFooter />
  </div>;
}
