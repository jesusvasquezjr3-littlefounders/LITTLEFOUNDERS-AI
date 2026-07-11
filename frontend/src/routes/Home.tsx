import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChip } from '@/components/ui';

const SECTIONS = [
  { key: 'learn', tone: 'primary', emoji: '📚' },
  { key: 'tutor', tone: 'secondary', emoji: '💬' },
  { key: 'games', tone: 'accent', emoji: '🎮' },
  { key: 'tasks', tone: 'secondary', emoji: '✅' },
  { key: 'profile', tone: 'primary', emoji: '🦖' },
] as const;

export function Home() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="lf-display-xl">{t('home.welcome')}</h1>
      <p className="lf-body-lg mt-3 text-content-muted">{t('home.subtitle')}</p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2">
        {SECTIONS.map(({ key, tone, emoji }) => (
          <li key={key}>
            <Link
              to={`/${key}`}
              className="motion-safe-lift block rounded-lg bg-surface p-6 shadow-clay transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] active:shadow-clay-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <IconChip tone={tone}>{emoji}</IconChip>
              <h2 className="lf-title mt-4">{t(`sections.${key}.title`)}</h2>
              <p className="lf-body mt-1 text-content-muted">{t(`sections.${key}.description`)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
