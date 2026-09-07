import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, SectionHeading } from '@/components/ui';
import { CourseBadgeArtwork } from '@/components/course/CourseBadgeArtwork';
import type { CourseBadge } from '@/lib/courseBadges';

export function CourseBadgeCollection({ badges, isOwn }: { badges: CourseBadge[]; isOwn: boolean }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const locale = i18n.resolvedLanguage ?? 'en-US';

  return (
    <section aria-labelledby={headingId} className="mt-8">
      {/*
       * The section lockup, keyed `delight` — the same hue the collection's
       * own trophy well already wore, and the one this grid of cards carries.
       * The count is `meta`: a number pinned right, never a control, and
       * formatted through `Intl` rather than string-built (§1.8).
       */}
      <SectionHeading
        id={headingId}
        icon="workspace_premium"
        tone="delight"
        meta={badges.length > 0 ? new Intl.NumberFormat(locale).format(badges.length) : undefined}
      >
        {t('profile.badges.title')}
      </SectionHeading>
      <p className="lf-body mb-4 text-content-muted">{t('profile.badges.subtitle')}</p>

      {badges.length === 0 ? (
        <Card className="flex items-center gap-3 p-5">
          <span className="lf-tile h-12 w-12 text-delight">
            <Icon name="workspace_premium" className="!text-[22px]" />
          </span>
          <p className="lf-body text-content-muted">
            {isOwn ? t('profile.badges.emptyOwn') : t('profile.badges.emptyPublic')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <Card key={badge.slug} className="flex items-center gap-4 p-4 sm:p-5">
              <CourseBadgeArtwork asset={badge.badgeAsset} slug={badge.slug} size="compact" />
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
