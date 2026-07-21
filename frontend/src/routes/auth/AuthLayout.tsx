import { useLayoutEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { Dropdown, ThemeToggle, type DropdownOption } from '@/components/ui';

// Country flag paired with each locale (DESIGN.md exception: flags are content
// labels for language identity, not functional UI icons — Material Symbols
// has no equivalent). Mirrors MarketingLayout's own map (§Screen Recipes).
const LOCALE_FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  'es-MX': '🇲🇽',
  'pt-BR': '🇧🇷',
};

/*
 * Bare trust surface for /login and /signup — no marketing nav links or
 * footer (DESIGN.md §Screen Recipes → Auth: "focused single centered
 * column... ONE resting card"). Just enough utility chrome to not strand
 * the visitor: a way back to `/`, the language switcher, and the theme
 * control — the same controls MarketingLayout offers, minus the nav links
 * and CTA button that don't apply on a page that IS the CTA's destination.
 * AuthShell renders the actual centered title + card; this layout only
 * owns the utility row, the full-height background, and the same
 * scroll-reset + page-enter motion every other top-level route gets.
 */
export function AuthLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

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
      <header className="flex items-center justify-between px-5 py-5 md:px-8">
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Dropdown
            compact
            value={(i18n.resolvedLanguage as Locale) ?? 'en-US'}
            options={localeOptions}
            onChange={(l) => void i18n.changeLanguage(l)}
            ariaLabel={t('language.label')}
          />
          <ThemeToggle />
        </div>
      </header>

      <main key={location.pathname} className="lf-page-enter">
        <Outlet />
      </main>
    </div>
  );
}
