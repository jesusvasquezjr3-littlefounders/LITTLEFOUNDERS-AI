import { Outlet } from 'react-router-dom';
import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { Button } from '@/rebuild/design/buttons';
import { SiteShell } from '@/rebuild/design/shells';
import { ShellRoot, useShellCopy, useShellLocale } from '@/ShellRoot';
import { SiteTopbarControls } from '@/SiteTopbarControls';
import { landingTitle } from '@/siteTitle';

/*
 * The site around the landing: the brand, a round theme toggle and a round
 * language menu in the topbar; contact, cookie settings and copyright in the
 * footer.
 */

const APP_NAME = 'LittleFounders';
const CONTACT_EMAIL = 'informame@littlefounders.ai';

function SiteFooter() {
  const copy = useShellCopy().siteShell;
  return <>
    <nav aria-label={copy.legal} data-shell-footer-links>
      <Button size="sm" onClick={openCookiePreferences}>{copy.cookies}</Button>
      <a href={`mailto:${CONTACT_EMAIL}`} data-copy-role="data" className="ugc">{CONTACT_EMAIL}</a>
    </nav>
    <p data-copy-role="legal">© {new Date().getFullYear()} {APP_NAME}. {copy.rights}</p>
  </>;
}

export function SiteLayout() {
  const { appShell: shell } = useShellCopy();
  const locale = useShellLocale();
  return <ShellRoot>
    <SiteShell appName={APP_NAME} pageTitle={landingTitle(locale)} locale={locale} utilities={<SiteTopbarControls />} homeHref="/"
      labels={{ skip: shell.skip }} footer={<SiteFooter />}>
      <Outlet />
    </SiteShell>
  </ShellRoot>;
}
