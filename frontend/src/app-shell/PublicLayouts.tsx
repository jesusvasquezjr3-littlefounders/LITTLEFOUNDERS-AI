import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { AuthShell, Button, SiteShell, type ShellNavItem } from '@/rebuild/design/controls';
import { APP_HOME } from './navigation';
import { ShellRoot, useShellCopy, useShellLocale, useShellNavigate } from './ShellRoot';
import { SiteTopbarControls } from './SiteTopbarControls';
import { ShellPreferences } from './ShellPreferences';
import { sitePageTitle } from './siteTitles';

/*
 * The public site and the sign-in flow on real routes (W2 Lane 0), replacing
 * the legacy MarketingLayout and AuthLayout. Owner direction, 2026-10-06: the
 * site topbar is the brand, a round theme toggle, a round language menu and a
 * ghost "Log in"; there are no page links and no header call to action (the
 * landing carries the calls to action). The footer carries legal links, cookie
 * settings, contact and copyright.
 */

const APP_NAME = 'LittleFounders';
const CONTACT_EMAIL = 'informame@littlefounders.ai';

function SiteFooter() {
  const copy = useShellCopy().siteShell;
  const navigate = useShellNavigate();
  const link = (href: string, label: string) => <a href={href} data-copy-role="action" onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }}>{label}</a>;
  return <>
    <nav aria-label={copy.legal} data-shell-footer-links>
      {link('/legal/terms', copy.terms)}
      {link('/legal/privacy', copy.privacy)}
      <Button size="sm" onClick={openCookiePreferences}>{copy.cookies}</Button>
      <a href={`mailto:${CONTACT_EMAIL}`} data-copy-role="data" className="ugc">{CONTACT_EMAIL}</a>
    </nav>
    <p data-copy-role="legal">© {new Date().getFullYear()} {APP_NAME}. {copy.rights}</p>
  </>;
}

/** The public site around the marketing pages. */
export function SiteLayout() {
  const { siteShell: copy, appShell: shell } = useShellCopy();
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  const { session } = useAuth();
  const links: ShellNavItem[] = [];
  // Signed-in visitors (a guest included) get "Open app" instead of "Log in".
  const entry = session ? { label: copy.openApp, href: APP_HOME, variant: 'ghost' as const } : { label: copy.login, href: '/login', variant: 'ghost' as const };
  return <ShellRoot>
    <SiteShell appName={APP_NAME} pageTitle={sitePageTitle(pathname, locale)} routeKey={pathname} locale={locale} onNavigate={navigate}
      utilities={<SiteTopbarControls />} homeHref="/" links={links} secondaryAction={entry}
      labels={{ skip: shell.skip, navigation: shell.navigation, menu: shell.menu, close: shell.close }} footer={<SiteFooter />}>
      {/* The public pages are rebuilt (W2 Lane 1): no legacy body wrapper. */}
      <Outlet />
    </SiteShell>
  </ShellRoot>;
}

const AUTH_TITLES: Record<string, keyof ReturnType<typeof useShellCopy>['siteShell']['pageTitle']> = {
  '/login': 'login', '/signup': 'signup', '/forgot-password': 'forgotPassword', '/reset-password': 'resetPassword',
  '/verify-parent': 'verifyParent', '/auth/callback': 'callback', '/upgrade-account': 'upgradeAccount',
};

/** Sign-up, log-in, recovery and verification. */
export function AuthLayout() {
  const { siteShell: copy, appShell: shell } = useShellCopy();
  const { session } = useAuth();
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  // GAP-FIX-R5: /join/:token, a Tutor invite's landing.
  const title = copy.pageTitle[pathname.startsWith('/join/') ? 'joinInvite' : AUTH_TITLES[pathname] ?? 'login'];
  return <ShellRoot>
    <AuthShell appName={APP_NAME} pageTitle={title} routeKey={pathname} locale={locale} onNavigate={navigate} homeHref="/" utilities={<ShellPreferences />}
      back={session ? { label: copy.openApp, href: APP_HOME } : { label: copy.home, href: '/' }} labels={{ skip: shell.skip }} footer={<SiteFooter />}>
      {/* The sign-in screens are rebuilt (W2 Lane 1, W2S.2): no legacy body wrapper. */}
      <Outlet />
    </AuthShell>
  </ShellRoot>;
}
