import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, IconChip } from '@/components/ui';

/*
 * In-app placeholder for product sections whose real feature ships later.
 * The section EXISTS in nav (discoverable, gamified) — the content says
 * honestly that it's on the way.
 */
export function SectionComingSoon({ section, icon }: { section: 'tutor' | 'games' | 'tasks'; icon: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="lf-display-lg text-content">{t(`dashboard.nav.${section}`)}</h1>
      <Card hero className="mt-8 flex flex-col items-center gap-4 py-14 text-center">
        <IconChip size="lg" tone="accent">
          <Icon name={icon} />
        </IconChip>
        <Badge className="bg-primary-soft text-primary">{t('dashboard.sections.soonBadge')}</Badge>
        <h2 className="lf-title text-content">{t(`dashboard.sections.${section}.title`)}</h2>
        <p className="lf-body max-w-md text-content-muted">{t(`dashboard.sections.${section}.body`)}</p>
      </Card>
    </div>
  );
}
