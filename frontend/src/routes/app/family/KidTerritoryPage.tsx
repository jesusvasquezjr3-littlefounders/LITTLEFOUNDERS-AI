import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { ChildProgress } from '@/rebuild/family/console/ChildProgress';
import { shareAchievementImage, type AchievementImageRequest, type AchievementShareOutcome } from '@/rebuild/family/achievementImage';
import { familyHref, useConsoleEnvironment, useConsoleTransport } from './consoleSession';

/*
 * /family/:kidId/territory: F2, one child's progress through the verified
 * Tutor's eyes (W2F.1). Parent-gated route; Core re-checks the verified
 * guardian link and computes the tree from THIS child's progress.
 *
 * OD-20 (Product 10 F.1): a share is a picture Core renders for this Tutor,
 * handed to the device share sheet where it accepts image files and
 * downloaded otherwise; no link is created. `badge_shared` fires only on a
 * completed hand-off, never on a dismissed share sheet. `parent_report_viewed`
 * fires once per successful load (0072).
 */
export function KidTerritoryPage() {
  const { kidId = '' } = useParams();
  const { getToken } = useAuth();
  const transport = useConsoleTransport();
  const { locale, dark, family } = useConsoleEnvironment();
  const navigate = useNavigate();

  async function share(request: AchievementImageRequest): Promise<AchievementShareOutcome> {
    const token = await getToken();
    if (!token) return 'failed';
    const outcome = await shareAchievementImage({ baseUrl: BASE_URL, token, kidId, request, title: family.achievementShare.share });
    if (outcome === 'shared' || outcome === 'downloaded') trackInsight('badge_shared', { routeClass: 'family' });
    return outcome;
  }

  return <ChildProgress key={kidId} copy={family.familyChildProgress} shareCopy={family.achievementShare} locale={locale} dark={dark} transport={transport}
    kidId={kidId} backHref={familyHref(kidId)} onNavigate={(href) => navigate(href)} onShare={share}
    onViewed={() => trackInsight('parent_report_viewed', { routeClass: 'family' })} />;
}

export default KidTerritoryPage;
