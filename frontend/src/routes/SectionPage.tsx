import { useTranslation } from 'react-i18next';

/* DESIGN: pending re-skin */

export function SectionPage({ section }: { section: 'learn' | 'tutor' | 'games' | 'tasks' | 'profile' }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">{t(`sections.${section}.title`)}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{t(`sections.${section}.description`)}</p>
      <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        {t(`sections.${section}.comingSoon`)}
      </p>
    </div>
  );
}
