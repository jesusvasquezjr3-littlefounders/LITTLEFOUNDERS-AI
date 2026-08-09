import { useTranslation } from 'react-i18next';
import { CookiePreferencesButton } from '@/components/CookieConsentBanner';
import { Badge, Card } from '@/components/ui';

const CONTACT_EMAIL = 'informame@littlefounders.ai';

export function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="lf-display-lg">{t(`marketing.legal.${doc}.title`)}</h1>
      <Card hero className="mt-10 text-center">
        {doc === 'privacy' ? (
          <div className="text-left">
            <Badge className="bg-success-soft text-success-strong">{t('cookies.manage')}</Badge>
            <h2 className="lf-heading mt-6">{t('marketing.legal.privacy.cookiesTitle')}</h2>
            <p className="lf-body mt-3 text-content-muted">{t('marketing.legal.privacy.cookiesBody')}</p>
            <h2 className="lf-heading mt-8">{t('marketing.legal.privacy.controlsTitle')}</h2>
            <p className="lf-body mt-3 text-content-muted">{t('marketing.legal.privacy.controlsBody')}</p>
            <CookiePreferencesButton className="mt-6 text-secondary hover:text-primary" />
            <h2 className="lf-heading mt-8">{t('marketing.legal.privacy.contactTitle')}</h2>
            <p className="lf-body mt-3 text-content-muted">{t('marketing.legal.privacy.contactBody')}</p>
          </div>
        ) : (
          <>
            <Badge className="bg-warning-soft text-warning-strong">{t('marketing.legal.badge')}</Badge>
            <p className="lf-body mt-4 text-content-muted">{t('marketing.legal.body')}</p>
          </>
        )}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="lf-label mt-3 inline-flex min-h-11 items-center rounded-sm text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {CONTACT_EMAIL}
        </a>
      </Card>
    </div>
  );
}
