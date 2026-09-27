import { HowItWorks as HowItWorksSurface } from '@/rebuild/site/HowItWorks';
import { useSiteActions } from './siteActions';

/** `/how-it-works` (M2). */
export function HowItWorks() {
  const { locale, onNavigate, start } = useSiteActions();
  return <HowItWorksSurface locale={locale} start={start} onNavigate={onNavigate} />;
}
