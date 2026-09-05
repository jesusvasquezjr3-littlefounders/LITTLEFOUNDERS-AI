import { useLayoutEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { Dropdown, LocaleFlag, ThemeToggle, type DropdownOption } from '@/components/ui';

/*
 * Auth shell chrome. /DESIGN.md §Screen Recipes → Auth: "A minimal utility row
 * sits above the column (logo → `/`, language Dropdown, ThemeToggle) — no nav
 * links, no CTA button; it's an escape hatch and two settings, not a second
 * header."
 *
 * THE PAGE IS `base`, NOT A PHOTOGRAPH. It carried a full-viewport stock photo
 * (blurred greyscale, colour on hover) under a `bg-black/40` scrim, with the
 * whole layer forced to `text-on-inverse`. Three things followed from that and
 * all three were bugs: the recipe says the trust surface is a focused column on
 * `base`; a permanently dark layer meant a visitor in light mode still got a
 * dark page, so the theme they chose stopped applying exactly where they were
 * asked to type a password; and the glass Card had a grey blur behind it rather
 * than the page, so it read as flat plastic. The colour-on-hover flourish also
 * did nothing on a phone, which has no hover (§1.11).
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
    <div className="relative flex min-h-screen flex-col bg-base text-content">
      <header className="lf-glass sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between gap-4 px-5 md:px-8">
          <Link
            to="/"
            className="lf-press flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            {/* Visible at EVERY width. It shipped `hidden sm:inline-flex`, so a
                phone lost the one theme control the rest of the product gives
                it everywhere else - and the recipe lists it in this row without
                a breakpoint. */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main key={location.pathname} className="lf-page-enter flex-1">
        <Outlet />
      </main>
    </div>
  );
}
