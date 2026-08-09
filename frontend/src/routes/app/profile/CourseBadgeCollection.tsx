import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, IconChip } from '@/components/ui';
import { courseBadgeAsset, type CourseBadge } from '@/lib/courseBadges';

function BadgeArtwork({ asset, slug }: { asset: string; slug: string }) {
  const [failed, setFailed] = useState(false);
  const source = courseBadgeAsset(asset, slug);

  if (!source || failed) {
    return <Icon name="workspace_premium" className="text-[28px]" />;
  }

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      className="h-full w-full object-contain"
      draggable="false"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function CourseBadgeCollection({ badges, isOwn }: { badges: CourseBadge[]; isOwn: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';

  return (
    <section aria-label={t('profile.badges.title')} className="mt-8">
      <div className="mb-4">
        <h2 className="lf-headline text-content">{t('profile.badges.title')}</h2>
        <p className="lf-body mt-1 text-content-muted">{t('profile.badges.subtitle')}</p>
      </div>

      {badges.length === 0 ? (
        <Card className="flex items-center gap-3 p-5">
          <IconChip tone="delight" size="md">
            <Icon name="workspace_premium" className="text-[22px]" />
          </IconChip>
          <p className="lf-body text-content-muted">
            {isOwn ? t('profile.badges.emptyOwn') : t('profile.badges.emptyPublic')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <Card key={badge.slug} className="flex items-center gap-4 p-4 sm:p-5">
              <IconChip tone="delight" size="lg" className="shrink-0 overflow-hidden p-1.5">
                <BadgeArtwork asset={badge.badgeAsset} slug={badge.slug} />
              </IconChip>
              <div className="min-w-0">
                <Badge className="bg-success-soft text-success-strong">{t('profile.badges.completed')}</Badge>
                <h3 className="lf-title mt-2 text-content">
                  {badge.title[locale] ?? badge.title['en-US'] ?? badge.slug}
                </h3>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
