import { Landing as LandingSurface } from '@/rebuild/site/Landing';
import { useSiteActions } from './siteActions';

/** `/` (M1): the rebuilt landing page, fed the session-aware calls to action. */
export function Landing() {
  const { locale, onNavigate, start, onSecondary } = useSiteActions();
  return <LandingSurface locale={locale} start={start} onNavigate={onNavigate} onSecondary={onSecondary} />;
}
