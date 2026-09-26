import { Families as FamiliesSurface } from '@/rebuild/site/Families';
import { useSiteActions } from './siteActions';

/** `/families` (M3). */
export function Families() {
  const { locale, onNavigate, tutor } = useSiteActions();
  return <FamiliesSurface locale={locale} tutor={tutor} onNavigate={onNavigate} />;
}
