import { useTranslation } from 'react-i18next';
import { Card, Badge } from '@/components/ui';

export function SectionPage({ section }: { section: 'learn' | 'tutor' | 'games' | 'tasks' | 'profile' }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="lf-display-lg">{t(`sections.${section}.title`)}</h1>
      <p className="lf-body-lg mt-2 text-content-muted">{t(`sections.${section}.description`)}</p>
      <Card hero className="mt-8 text-center">
        <Badge>{t(`sections.${section}.comingSoon`)}</Badge>
      </Card>
    </div>
  );
}
