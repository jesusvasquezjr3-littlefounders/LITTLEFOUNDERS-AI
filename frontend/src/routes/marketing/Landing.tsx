import { Landing as LandingSurface } from '@/rebuild/site/Landing';
import { useSiteActions } from './siteActions';

/** `/`: the rebuilt landing page, fed the session-aware calls to action. */
export function Landing() {
  const { locale, onNavigate, start, tutor, onSecondary } = useSiteActions();
  return <LandingSurface locale={locale} start={start} tutor={tutor} onNavigate={onNavigate} onSecondary={onSecondary} />;
}
