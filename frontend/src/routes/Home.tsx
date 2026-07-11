import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* DESIGN: pending re-skin */

const SECTIONS = ['learn', 'tutor', 'games', 'tasks', 'profile'] as const;

export function Home() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">{t('home.welcome')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{t('home.subtitle')}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s}>
            <Link
              to={`/${s}`}
              className="block min-h-11 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="font-semibold">{t(`sections.${s}.title`)}</span>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t(`sections.${s}.description`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
