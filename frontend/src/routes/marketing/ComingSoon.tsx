import { useTranslation } from 'react-i18next';
import { Badge, Card } from '@/components/ui';

export function ComingSoon({ page }: { page: 'howItWorks' | 'families' | 'faq' }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="lf-display-lg">{t(`marketing.pages.${page}.title`)}</h1>
      <p className="lf-body-lg mt-3 text-content-muted">
        {t(`marketing.pages.${page}.description`)}
      </p>
      <Card hero className="mt-10 text-center">
        <Badge className="bg-primary-soft text-primary">{t('marketing.comingSoon.badge')}</Badge>
        <p className="lf-body mt-4 text-content-muted">{t('marketing.comingSoon.body')}</p>
      </Card>
    </div>
  );
}
