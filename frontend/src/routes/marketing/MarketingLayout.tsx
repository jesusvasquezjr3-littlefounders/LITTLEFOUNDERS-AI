import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { LOCALES } from '@/i18n';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/how-it-works', key: 'howItWorks' },
  { to: '/families', key: 'families' },
  { to: '/faq', key: 'faq' },
] as const;

const CONTACT_EMAIL = 'informame@littlefounders.ai';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'lf-label inline-flex min-h-11 items-center rounded-md px-4 py-3 transition-[background-color,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    isActive
      ? 'bg-primary-soft text-primary'
      : 'text-content-muted hover:bg-surface hover:shadow-clay-sm',
  );
}

export function MarketingLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base text-content">
      <header className="mx-auto flex max-w-container flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link
          to="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img src="/logo-main.png" alt={t('marketing.hero.logoAlt')} className="h-12 w-auto" />
        </Link>

        <nav aria-label={t('app.name')} className="hidden gap-1 lg:flex">
          {NAV_LINKS.map(({ to, key }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              {t(`marketing.nav.${key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label={t('language.label')}
            className="lf-label min-h-11 rounded-md bg-surface-sunken px-2 py-2 text-content shadow-clay-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={i18n.resolvedLanguage ?? 'en-US'}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t('theme.toggle')}
            className="lf-label motion-safe-press min-h-11 min-w-11 rounded-full bg-surface px-4 py-2 text-content-muted shadow-clay-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-clay-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {theme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
          <Link to="/learn" className="hidden sm:block">
            <Button>{t('marketing.nav.cta')}</Button>
          </Link>
          <button
            type="button"
            aria-label={t('app.name')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="lf-title min-h-11 min-w-11 rounded-md bg-surface shadow-clay-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          >
            ☰
          </button>
        </div>

        {menuOpen && (
          <nav
            aria-label={t('app.name')}
            className="w-full rounded-lg bg-surface p-2 shadow-clay lg:hidden"
          >
            {NAV_LINKS.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => cn(navLinkClass({ isActive }), 'flex w-full')}
              >
                {t(`marketing.nav.${key}`)}
              </NavLink>
            ))}
            <Link to="/learn" onClick={() => setMenuOpen(false)} className="mt-2 block sm:hidden">
              <Button className="w-full">{t('marketing.nav.cta')}</Button>
            </Link>
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-16 bg-surface shadow-clay">
        <div className="mx-auto grid max-w-container gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <img src="/logo-main.png" alt={t('marketing.hero.logoAlt')} className="h-10 w-auto" />
            <p className="lf-body mt-3 text-content-muted">{t('marketing.footer.tagline')}</p>
          </div>
          <div>
            <h2 className="lf-title">{t('marketing.footer.legalTitle')}</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/legal/terms"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('marketing.footer.terms')}
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/privacy"
                  className="lf-body inline-flex min-h-11 items-center rounded-sm text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="lf-body mt-3 inline-flex min-h-11 items-center rounded-sm text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-container px-4 pb-8 sm:px-6">
          <p className="lf-caption text-content-faint">
            © {new Date().getFullYear()} LittleFounders. {t('marketing.footer.rights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
