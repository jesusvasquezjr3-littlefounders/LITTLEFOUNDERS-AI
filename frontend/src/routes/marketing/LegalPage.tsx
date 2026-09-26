import { openCookiePreferences } from '@/components/CookieConsentBanner';
import { LegalDocumentPage } from '@/rebuild/site/LegalDocumentPage';
import type { LegalDoc } from '@/rebuild/site/legalContent';
import { useSiteActions } from './siteActions';

/** `/legal/terms` (M5) and `/legal/privacy` (M6). The cookie preferences (M8) open from the Privacy Notice. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { locale, onNavigate } = useSiteActions();
  return <LegalDocumentPage locale={locale} doc={doc} onNavigate={onNavigate} onOpenCookies={openCookiePreferences} />;
}
