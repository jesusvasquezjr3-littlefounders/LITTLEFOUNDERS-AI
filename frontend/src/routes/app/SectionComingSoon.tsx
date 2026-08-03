import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trackInsight } from '@/lib/insights';
import { Badge, Card, Icon, IconChip } from '@/components/ui';

/*
 * In-app placeholder for product sections whose real feature ships later.
 * The section EXISTS in nav (discoverable, gamified) — the content says
 * honestly that it's on the way.
 */
/** Opening a locked surface IS the demand signal for building it. */
const DEMAND_EVENT = { tutor: 'tutor_open', tasks: 'task_view' } as const;

export function SectionComingSoon({ section, icon }: { section: 'tutor' | 'tasks'; icon: string }) {
  const { t } = useTranslation();
  // These sections have no feature yet, but the INTENT to open them is real
  // product data: "how many people tried Tasks this week" is a roadmap input
  // (/INSIGHTS.md). No-op for unconsented kids.
  useEffect(() => {
    trackInsight(DEMAND_EVENT[section], { routeClass: section === 'tutor' ? 'tutor' : section });
  }, [section]);
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
