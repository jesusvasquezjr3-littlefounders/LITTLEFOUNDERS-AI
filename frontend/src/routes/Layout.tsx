import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { LOCALES } from '@/i18n';
import { cn } from '@/lib/utils';

const SECTIONS = ['learn', 'tutor', 'games', 'tasks', 'profile'] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-base text-content">
      <header className="mx-auto flex max-w-container flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <NavLink
          to="/"
          className="lf-title rounded-md px-2 py-1 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('app.name')}
        </NavLink>
        <nav aria-label={t('app.name')} className="flex flex-wrap gap-1">
          {SECTIONS.map((s) => (
            <NavLink
              key={s}
              to={`/${s}`}
              className={({ isActive }) =>
                cn(
                  'lf-label motion-safe-press inline-flex min-h-11 items-center rounded-md px-4 py-3',
                  'transition-[transform,box-shadow,background-color] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-on-primary shadow-clay-sm'
                    : 'text-content-muted hover:bg-surface hover:shadow-clay-sm',
                )
              }
            >
              {t(`nav.${s}`)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <label className="lf-label text-content-muted" htmlFor="locale-select">
            {t('language.label')}
          </label>
          <select
            id="locale-select"
            className="lf-label min-h-11 rounded-md bg-surface-sunken px-3 py-2 text-content shadow-clay-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        </div>
      </header>
      <main className="mx-auto max-w-container px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
