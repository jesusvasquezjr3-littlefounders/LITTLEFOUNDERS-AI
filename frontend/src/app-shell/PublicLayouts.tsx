import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme, type ThemeChoice } from '@/theme/useTheme';
import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { AuthShell, Button, SegmentedControl, SelectField, SiteShell, type ShellNavItem } from '@/rebuild/design/controls';
import type { Locale } from '@/rebuild/design/copyBudget';
import { APP_HOME } from './navigation';
import { LegacyBody, ShellRoot, useShellCopy, useShellLocale, useShellNavigate } from './ShellRoot';
import { sitePageTitle } from './siteTitles';

/*
 * The public site and the sign-in flow on real routes (W2 Lane 0), replacing
 * the legacy MarketingLayout and AuthLayout. The site header carries the
 * three public pages, "Log in" and one accent call to action (03 §3.4: it
 * docks at the bottom on phones after the first screen of the landing and
 * family pages). Both footers carry what the legacy headers used to: the
 * language and the theme, and the site footer the legal links, the cookie
 * settings and the contact address.
 */

const APP_NAME = 'LittleFounders';
const CONTACT_EMAIL = 'informame@littlefounders.ai';
const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];
/** Each language named in itself: a reader who cannot read the current language still finds their own. */
const LANGUAGE_NAMES: Record<Locale, string> = { 'en-US': 'English', 'es-MX': 'Español', 'pt-BR': 'Português' };
/** 03 §3.4: the docked call to action belongs to the landing and family pages only. */
const DOCKED_CTA = new Set(['/', '/families']);

/** Language and mode: a visitor's two settings, on every public and sign-in page. */
function Preferences() {
  const copy = useShellCopy().siteShell;
  const locale = useShellLocale();
  const { i18n } = useTranslation();
  const { choice, setChoice } = useTheme();
  return <div data-shell-preferences>
    <SelectField label={copy.language} value={locale} onChange={(event) => void i18n.changeLanguage(event.target.value)}
      options={LOCALES.map((value) => ({ value, label: LANGUAGE_NAMES[value], role: 'data' as const }))} />
    <SegmentedControl<ThemeChoice> legend={copy.theme} name="theme-choice" value={choice} onValueChange={setChoice}
      options={[{ value: 'auto', label: copy.themeAuto }, { value: 'light', label: copy.themeLight }, { value: 'dark', label: copy.themeDark }]} />
  </div>;
}

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
    <Preferences />
    <p data-copy-role="body">© {new Date().getFullYear()} {APP_NAME}. {copy.rights}</p>
  </>;
}

/** The public site around the marketing pages. */
export function SiteLayout() {
  const { siteShell: copy, appShell: shell } = useShellCopy();
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  const { session } = useAuth();
  const links: ShellNavItem[] = [
    { id: 'how-it-works', label: copy.howItWorks, href: '/how-it-works' },
    { id: 'families', label: copy.families, href: '/families' },
    { id: 'faq', label: copy.faq, href: '/faq' },
  ];
  // Signed-in visitors (a guest included) get "Open app" instead of "Sign up".
  const primary = session ? { label: copy.openApp, href: APP_HOME } : { label: copy.signup, href: '/signup' };
  return <ShellRoot>
    <SiteShell appName={APP_NAME} pageTitle={sitePageTitle(pathname, locale)} routeKey={pathname} locale={locale} onNavigate={navigate}
      homeHref="/" links={links} current={links.find((link) => link.href === pathname)?.id ?? ''}
      secondaryAction={session ? undefined : { label: copy.login, href: '/login' }} primaryAction={primary}
      stickyAction={DOCKED_CTA.has(pathname) ? primary : undefined}
      labels={{ skip: shell.skip, navigation: shell.navigation, menu: shell.menu, close: shell.close }} footer={<SiteFooter />}>
      {/* The public pages are rebuilt (W2 Lane 1): no legacy body wrapper. */}
      <Outlet />
    </SiteShell>
  </ShellRoot>;
}

const AUTH_TITLES: Record<string, keyof ReturnType<typeof useShellCopy>['siteShell']['pageTitle']> = {
  '/login': 'login', '/signup': 'signup', '/forgot-password': 'forgotPassword', '/reset-password': 'resetPassword',
  '/verify-parent': 'verifyParent', '/auth/callback': 'callback',
};

/** Sign-up, log-in, recovery and verification. */
export function AuthLayout() {
  const { siteShell: copy, appShell: shell } = useShellCopy();
  const { session } = useAuth();
  const locale = useShellLocale();
  const navigate = useShellNavigate();
  const { pathname } = useLocation();
  const title = copy.pageTitle[AUTH_TITLES[pathname] ?? 'login'];
  return <ShellRoot>
    <AuthShell appName={APP_NAME} pageTitle={title} routeKey={pathname} locale={locale} onNavigate={navigate} homeHref="/"
      back={session ? { label: copy.openApp, href: APP_HOME } : { label: copy.home, href: '/' }} labels={{ skip: shell.skip }} footer={<Preferences />}>
      <LegacyBody frame="auth" routeKey={pathname}><Outlet /></LegacyBody>
    </AuthShell>
  </ShellRoot>;
}
