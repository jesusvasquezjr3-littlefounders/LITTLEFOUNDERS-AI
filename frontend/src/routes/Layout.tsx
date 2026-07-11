import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { LOCALES } from '@/i18n';
import { cn } from '@/lib/utils';

/* DESIGN: pending re-skin */

const SECTIONS = ['learn', 'tutor', 'games', 'tasks', 'profile'] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <NavLink to="/" className="text-xl font-bold">
          {t('app.name')}
        </NavLink>
        <nav aria-label={t('app.name')} className="flex flex-wrap gap-1">
          {SECTIONS.map((s) => (
            <NavLink
              key={s}
              to={`/${s}`}
              className={({ isActive }) =>
                cn(
                  'min-h-11 min-w-11 rounded px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )
              }
            >
              {t(`nav.${s}`)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="locale-select">
            {t('language.label')}
          </label>
          <select
            id="locale-select"
            className="min-h-11 rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-600"
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
            className="min-h-11 min-w-11 rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
          >
            {theme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
