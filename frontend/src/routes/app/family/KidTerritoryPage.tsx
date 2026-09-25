import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api, BASE_URL } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { Button, Card, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { TerritoryProgressStrip, TerritoryView } from '@/routes/app/learn/TerritoryPage';
import { type CourseTree } from '@/routes/app/learn/types';
import { shareAchievementImage, type AchievementImageRequest, type AchievementShareOutcome } from '@/rebuild/family/achievementImage';

/*
 * /family/:kidId/territory — a kid's territory through the parent's eyes:
 * the SAME TerritoryView the kid sees (one renderer, zero drift), fed by
 * Core's guardian-guarded family endpoint, plus a stats strip. Wording
 * discipline: territory still to explore, never deficiency; kids are never
 * ranked against each other (one kid per page, by design).
 */

interface KidStats {
  xpPoints: number;
  lessonsCompleted: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

interface TerritoryPayload {
  tree: CourseTree;
  stats: KidStats | null;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; payload: TerritoryPayload };

/** v1 platform has one published course; first-in-list keeps this correct when more land. */
async function firstCourseSlug(token: string): Promise<string | null> {
  const { data, error } = await api<{ courses: { slug: string }[] }>('/learn/courses', { token });
  if (error || data.courses.length === 0) return null;
  return data.courses[0]?.slug ?? null;
}

type SupportedLocale = 'en-US' | 'es-MX' | 'pt-BR';
const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en-US', 'es-MX', 'pt-BR'];
function toSupportedLocale(resolved: string | undefined): SupportedLocale {
  return SUPPORTED_LOCALES.includes(resolved as SupportedLocale) ? (resolved as SupportedLocale) : 'en-US';
}

/** Mirrors backend/src/routes/family.ts's MIN_SHAREABLE_STREAK_DAYS — a client-side hide, not the enforcement (the server re-checks). */
const MIN_SHAREABLE_STREAK_DAYS = 3;

interface ReachedGoal {
  id: string;
  title: string;
}

type ShareStatus = 'idle' | 'busy' | 'shared' | 'saved' | 'error';

export function KidTerritoryPage() {
  const { t, i18n } = useTranslation();
  const { kidId = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [reachedGoal, setReachedGoal] = useState<ReachedGoal | null>(null);
  const [goalShareStatus, setGoalShareStatus] = useState<ShareStatus>('idle');
  const locale = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      // Independent of the territory load above — the Family Hub's goals
      // are a different domain (tasks.ts, not courseTree), so a failure
      // here degrades to "no share button" rather than blocking the page.
      const { data } = await api<{ goals: { id: string; title: string; status: string }[] }>(`/tasks/${kidId}/goals`, { token });
      if (cancelled || !data) return;
      const reached = data.goals.find((g) => g.status === 'reached');
      setReachedGoal(reached ? { id: reached.id, title: reached.title } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId, getToken]);

  /*
   * OD-20 (Product 10 F.1): a share is a PICTURE Core renders for this
   * verified guardian, handed to the device share sheet where it accepts
   * image files and downloaded otherwise — no link is created, so nothing
   * public exists for anyone the parent did not send it to. Core re-verifies
   * the guardian link and the achievement; this page authorizes nothing.
   * badge_shared fires only on a completed hand-off, never on a dismissed
   * share sheet; Core counts every rendered picture as a share initiated.
   */
  async function shareAchievement(request: AchievementImageRequest, setStatus: (s: ShareStatus) => void) {
    setStatus('busy');
    const token = await getToken();
    if (!token) {
      setStatus('error');
      return;
    }
    const outcome: AchievementShareOutcome = await shareAchievementImage({
      baseUrl: BASE_URL, token, kidId, request, title: t('family.badge.share'),
    });
    if (outcome === 'failed') {
      setStatus('error');
      return;
    }
    if (outcome === 'cancelled') {
      setStatus('idle');
      return;
    }
    trackInsight('badge_shared', { routeClass: 'family' });
    setStatus(outcome === 'shared' ? 'shared' : 'saved');
    setTimeout(() => setStatus('idle'), 2500);
  }

  async function handleShareGoal() {
    if (!reachedGoal) return;
    await shareAchievement({ kind: 'goal_reached', goalId: reachedGoal.id, locale: toSupportedLocale(i18n.resolvedLanguage) }, setGoalShareStatus);
  }

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const slug = await firstCourseSlug(token);
      if (cancelled) return;
      if (!slug) {
        setState({ status: 'error', code: 'NOT_FOUND' });
        return;
      }
      const { data, error } = await api<TerritoryPayload>(`/family/kids/${kidId}/courses/${slug}/territory`, { token });
      if (cancelled) return;
      if (error) {
        setState({ status: 'error', code: error.code });
        return;
      }
      setState({ status: 'ready', payload: data });
      // This IS the parent report: a guardian looking at their kid's stats
      // and progress through Core's guardian-guarded endpoint. Fired once
      // per successful load, never on error/loading (0072).
      trackInsight('parent_report_viewed', { routeClass: 'family' });
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId, getToken]);

  if (state.status === 'loading') return <LoadingOverlay label={t('family.territoryLoading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  const { tree, stats } = state.payload;

  /** Streak picture — the server re-enforces MIN_SHAREABLE_STREAK_DAYS regardless of the client-side hide above. */
  async function handleShare() {
    await shareAchievement({ kind: 'streak', locale: toSupportedLocale(i18n.resolvedLanguage) }, setShareStatus);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/family" className="lf-caption flex items-center gap-1 font-bold text-primary hover:underline">
            <Icon name="arrow_back" className="text-[16px]" aria-hidden /> {t('family.back')}
          </Link>
          <h1 className="lf-display-lg mt-1 text-content">{t('family.territoryTitle')}</h1>
          <p className="lf-body text-content-muted">{t('family.territorySubtitle')}</p>
        </div>
        <TerritoryProgressStrip tree={tree} />
      </header>

      {stats ? (
        /* Stat row grid (/DESIGN.md §Layout → Grid Systems: 2 / 3 / 6, gap-4 at every breakpoint). */
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.xp')}</p>
            <p className="lf-title lf-number mt-1 text-primary">{stats.xpPoints}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.lessons')}</p>
            <p className="lf-title lf-number mt-1 text-content">{stats.lessonsCompleted}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.streak')}</p>
            <p className="lf-title lf-number mt-1 text-warning-strong">{stats.streakDays}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.longestStreak')}</p>
            <p className="lf-title lf-number mt-1 text-success-strong">{stats.longestStreak}</p>
          </Card>
        </div>
      ) : null}

      {stats && stats.streakDays >= MIN_SHAREABLE_STREAK_DAYS ? (
        <>
          <Button
            onClick={() => void handleShare()}
            disabled={shareStatus === 'busy'}
            className="w-fit gap-2"
            variant={shareStatus === 'shared' || shareStatus === 'saved' ? 'success' : shareStatus === 'error' ? 'secondary' : 'primary'}
          >
            <Icon name={shareStatus === 'shared' || shareStatus === 'saved' ? 'check' : 'ios_share'} />
            {shareStatus === 'busy'
              ? t('family.badge.sharing')
              : shareStatus === 'shared'
                ? t('family.badge.shared')
                : shareStatus === 'saved'
                  ? t('family.badge.saved')
                  : shareStatus === 'error'
                    ? t('family.badge.error')
                    : t('family.badge.share')}
          </Button>
          {/* F.3 (OD-20 image flow): the point-of-action disclosure — un-buried,
              beside the button, in the mentor's own voice: a picture with the
              first name, no link, a sent picture stays sent, and it shows
              LittleFounders. */}
          <p className="lf-caption max-w-md text-content-muted">{t('family.badge.disclosure')}</p>
          <p className="lf-caption max-w-md text-content-muted">{t('family.badge.disclosureKeep')}</p>
        </>
      ) : null}

      {reachedGoal ? (
        <>
          <Button
            onClick={() => void handleShareGoal()}
            disabled={goalShareStatus === 'busy'}
            className="w-fit gap-2"
            variant={goalShareStatus === 'shared' || goalShareStatus === 'saved' ? 'success' : goalShareStatus === 'error' ? 'secondary' : 'primary'}
          >
            <Icon name={goalShareStatus === 'shared' || goalShareStatus === 'saved' ? 'check' : 'savings'} />
            {goalShareStatus === 'busy'
              ? t('family.badge.sharing')
              : goalShareStatus === 'shared'
                ? t('family.badge.shared')
                : goalShareStatus === 'saved'
                  ? t('family.badge.saved')
                  : goalShareStatus === 'error'
                    ? t('family.badge.error')
                    : t('family.badge.shareGoal', { title: reachedGoal.title })}
          </Button>
          <p className="lf-caption max-w-md text-content-muted">{t('family.badge.disclosure')}</p>
          <p className="lf-caption max-w-md text-content-muted">{t('family.badge.disclosureKeep')}</p>
        </>
      ) : null}

      <TerritoryView tree={tree} locale={locale} chipLinkTo="/family" />
    </div>
  );
}

export default KidTerritoryPage;
