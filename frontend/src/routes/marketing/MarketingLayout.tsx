import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { Button, Dropdown, Icon, ThemeToggle, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';

/* Composition per template/tactile_learning_lab_landing_page (DESIGN.md §0). */

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
  const [menuOpen, setMenuOpen] = useState(false);

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <span aria-hidden="true">{LOCALE_FLAGS[l]}</span>,
  }));

  return (
    <div className="min-h-screen bg-base text-content">
      {/* Sticky top app bar — mockup: h-20, raised surface, subtle drop shadow */}
      <header className="sticky top-0 z-40 bg-surface shadow-clay-sm dark:bg-surface">
        <div className="mx-auto flex h-20 max-w-container items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src="/logo-main-trimmed.png"
              alt={t('marketing.hero.logoAlt')}
              className="h-10 w-auto sm:h-12"
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
              value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
              options={localeOptions}
              onChange={(l) => void i18n.changeLanguage(l)}
              ariaLabel={t('language.label')}
            />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link to="/" className="hidden md:block">
              <Button className="px-6 py-2">{t('marketing.nav.cta')}</Button>
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
            className="border-t border-surface-sunken px-4 pb-4 sm:px-6 lg:hidden"
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
            <Link to="/" onClick={() => setMenuOpen(false)} className="mt-3 block md:hidden">
              <Button className="w-full">{t('marketing.nav.cta')}</Button>
            </Link>
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      {/* Footer — mockup: white surface, top border, brand + meta rows */}
      <footer className="mt-24 border-t border-surface-sunken bg-surface pb-8 pt-16">
        <div className="mx-auto grid max-w-container gap-10 px-4 sm:px-6 md:grid-cols-3">
          <div>
            <img
              src="/logo-main-trimmed.png"
              alt={t('marketing.hero.logoAlt')}
              className="h-10 w-auto"
            />
            <p className="lf-body mt-4 text-content-muted">{t('marketing.footer.tagline')}</p>
          </div>
          <div>
            <h2 className="lf-title">{t('marketing.footer.legalTitle')}</h2>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  to="/legal/terms"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-content-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('marketing.footer.terms')}
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/privacy"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-content-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="lf-body mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="mail" className="text-xl" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-container border-t border-surface-sunken px-4 pt-6 sm:px-6">
          <p className="lf-caption text-content-faint">
            © {new Date().getFullYear()} LittleFounders. {t('marketing.footer.rights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
