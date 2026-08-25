import { useLayoutEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { Dropdown, LocaleFlag, ThemeToggle, type DropdownOption } from '@/components/ui';

/*
 * Auth pages — full-viewport background image (B&W blurred, color on hover),
 * 2-column split layout (DESIGN.md §Screen Recipes → Auth). Image covers both
 * sides as a unified backdrop; the grid overlays text left, form right.
 * Utility row (logo, language, theme) floats above the image.
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
    prefix: <LocaleFlag locale={l} />,
  }));

  return (
    <div className="relative min-h-screen text-on-inverse">
      <div className="auth-bg">
        <img src="/marketing/auth-bg.jpg" alt="" className="auth-bg-img-bw" />
        <img src="/marketing/auth-bg.jpg" alt="" className="auth-bg-img-color" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col">
        <header className="lf-glass pointer-events-auto sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between gap-4 px-5 md:px-8">
          <Link
            to="/"
            className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-inverse"
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
            <ThemeToggle className="hidden sm:inline-flex" />
          </div>
          </div>
        </header>

        <main key={location.pathname} className="lf-page-enter flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
