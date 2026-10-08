import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { LegalDocumentPage } from '@/rebuild/site/LegalDocumentPage';
import type { LegalDoc } from '@/rebuild/site/legalContent';
import { useSiteActions } from './siteActions';

/** `/legal/terms` and `/legal/privacy`. The cookie preferences open from the Privacy Notice. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { locale, onNavigate } = useSiteActions();
  return <LegalDocumentPage locale={locale} doc={doc} onNavigate={onNavigate} onOpenCookies={openCookiePreferences} />;
}
