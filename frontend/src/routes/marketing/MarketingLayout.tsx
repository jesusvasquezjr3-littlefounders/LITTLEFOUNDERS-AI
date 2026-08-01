import { useLayoutEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Dropdown, Icon, ThemeToggle, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';

/* Composition per /DESIGN.md §Screen Recipes → Marketing shell. */

const NAV_LINKS = [
  { to: '/how-it-works', key: 'howItWorks' },
  { to: '/families', key: 'families' },
  { to: '/faq', key: 'faq' },
] as const;

const CONTACT_EMAIL = 'informame@littlefounders.ai';

// Country flag paired with each locale (DESIGN.md exception: flags are content
// labels for language identity, not functional UI icons — Material Symbols
// has no equivalent).
const LOCALE_FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  'es-MX': '🇲🇽',
  'pt-BR': '🇧🇷',
};

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'lf-label inline-flex min-h-11 items-center rounded-sm px-1 transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    isActive ? 'text-primary' : 'text-content-muted hover:text-primary',
  );
}

export function MarketingLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = useAuth();

  // Signed-in visitors get "open my dashboard" instead of "login".
  const ctaTo = session ? APP_HOME : '/login';
  const ctaLabel = session ? t('dashboard.continueCta') : t('marketing.nav.loginCta');

  // Every new page starts at the top — SPA navigation doesn't reset scroll
  // for free (only native full-page loads do that). Explicit 'auto' overrides
  // the global CSS smooth-scroll so the reset is instant, before paint.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <span aria-hidden="true">{LOCALE_FLAGS[l]}</span>,
  }));

  return (
    <div className="min-h-screen bg-base text-content">
      {/* Sticky top app bar — frosted glass over the page (/DESIGN.md §Elevation) */}
      <header className="lf-glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between gap-4 px-5 md:px-8">
          <Link
            to="/"
            className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src="/logo-main-trimmed.png"
              alt={t('marketing.hero.logoAlt')}
              className="h-9 w-auto sm:h-10"
            />
          </Link>

          <nav aria-label={t('app.name')} className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map(({ to, key }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                {t(`marketing.nav.${key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Dropdown
              compact
              value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
              options={localeOptions}
              onChange={(l) => void i18n.changeLanguage(l)}
              ariaLabel={t('language.label')}
            />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link to={ctaTo} className="hidden md:block">
              <Button className="px-6 py-2">{ctaLabel}</Button>
            </Link>
            <button
              type="button"
              aria-label={t('app.name')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            >
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label={t('app.name')}
            className="lf-pop border-t border-outline/60 px-5 pb-4 md:px-8 lg:hidden"
          >
            {NAV_LINKS.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => cn(navLinkClass({ isActive }), 'flex w-full py-1')}
              >
                {t(`marketing.nav.${key}`)}
              </NavLink>
            ))}
            <div className="mt-3 flex items-center justify-between sm:hidden">
              <ThemeToggle />
            </div>
            <Link to={ctaTo} onClick={() => setMenuOpen(false)} className="mt-3 block md:hidden">
              <Button className="w-full">{ctaLabel}</Button>
            </Link>
          </nav>
        )}
      </header>

      {/* Route transition: remount + rise-in on navigation (/DESIGN.md §Motion). */}
      <main key={location.pathname} className="lf-page-enter">
        <Outlet />
      </main>

      {/* Footer — full-bleed inverse band (/DESIGN.md §Layout → Section bands) */}
      <footer className="mt-24 bg-inverse pb-8 pt-16 text-on-inverse">
        <div className="mx-auto grid max-w-container gap-10 px-5 md:grid-cols-3 md:px-8">
          <div>
            <img
              src="/logo-main-trimmed.png"
              alt={t('marketing.hero.logoAlt')}
              className="h-10 w-auto"
            />
            <p className="lf-body mt-4 text-on-inverse-muted">{t('marketing.footer.tagline')}</p>
          </div>
          <div>
            <h2 className="lf-title">{t('marketing.footer.legalTitle')}</h2>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  to="/legal/terms"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-on-inverse-muted transition-colors hover:text-on-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-inverse"
                >
                  {t('marketing.footer.terms')}
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/privacy"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-on-inverse-muted transition-colors hover:text-on-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-inverse"
                >
                  {t('marketing.footer.privacy')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="lf-title">{t('marketing.footer.contactLabel')}</h2>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="lf-body mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-on-inverse-muted transition-colors hover:text-on-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-inverse"
            >
              <Icon name="mail" className="text-xl" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-container border-t border-white/10 px-5 pt-6 md:px-8">
          <p className="lf-caption text-on-inverse-muted/70">
            © {new Date().getFullYear()} LittleFounders. {t('marketing.footer.rights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
