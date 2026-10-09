import { useEffect, useId } from 'react';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { TopbarControls } from '@/components/TopbarControls';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { landingTitle } from '@/siteTitle';

/*
 * The site around the page: a skip link, the sticky header with the brand and
 * the display controls, one <main>, and the footer with contact, cookie
 * settings and copyright. The document title follows the page (WCAG 2.4.2).
 */

const APP_NAME = 'LittleFounders';

const CONTACT_EMAIL = 'informame@littlefounders.ai';

const CONTAINER = 'mx-auto w-full max-w-[1120px] px-4 sm:px-6';

export function AppShell() {
  const copy = useCoreCopy();
  const locale = useLocale();
  const mainId = `${useId().replace(/:/g, '')}-main`;
  const pageTitle = landingTitle(locale);

  useEffect(() => { document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME; }, [pageTitle]);

  return <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]" lang={locale}>
    <a href={`#${mainId}`} className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--primary)] focus:px-5 focus:py-3 focus:text-[var(--primary-foreground)]"
      onClick={(event) => {
        const main = document.getElementById(mainId);

        if (!main) return;

        event.preventDefault();
        main.focus();
      }}>{copy.appShell.skip}</a>
    <header className="sticky top-0 z-30 border-b border-[var(--v-border)] bg-[var(--background)]/90 backdrop-blur">
      <div className={`${CONTAINER} flex h-[72px] items-center justify-between`}>
        <a href="/" aria-label={APP_NAME}><img src="/brand/logo.png" alt={APP_NAME} width={560} height={102} className="h-8 w-auto" /></a>
        <TopbarControls />
      </div>
    </header>
    <main id={mainId} tabIndex={-1} className={`${CONTAINER} flex-1 outline-none`}><Outlet /></main>
    <footer className="border-t border-[var(--v-border)]">
      <div className={`${CONTAINER} flex flex-col gap-3 py-8 text-[length:var(--fs-small)] text-[var(--muted-foreground)]`}>
        <nav aria-label={copy.siteShell.legal} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button type="button" variant="ghost" size="sm" onClick={openCookiePreferences}>{copy.siteShell.cookies}</Button>
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all underline underline-offset-4">{CONTACT_EMAIL}</a>
        </nav>
        <p>© {new Date().getFullYear()} {APP_NAME}. {copy.siteShell.rights}</p>
      </div>
    </footer>
  </div>;
}
