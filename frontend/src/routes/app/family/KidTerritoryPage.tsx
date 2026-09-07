import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { Button, Card, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { TerritoryProgressStrip, TerritoryView } from '@/routes/app/learn/TerritoryPage';
import { type CourseTree } from '@/routes/app/learn/types';

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

interface BadgeIssued {
  token: string;
  imageUrl: string;
  shareUrl: string;
}

type ShareStatus = 'idle' | 'busy' | 'shared' | 'copied' | 'error';

export function KidTerritoryPage() {
  const { t, i18n } = useTranslation();
  const { kidId = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const locale = i18n.resolvedLanguage ?? 'en-US';

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

  /*
   * "Compartir logro" — issues a streak badge (backend/src/routes/family.ts
   * re-enforces MIN_SHAREABLE_STREAK_DAYS server-side regardless of the
   * client-side hide above) and hands it to the OS share sheet, falling back
   * to copy-to-clipboard where navigator.share is unavailable (desktop
   * Safari/Firefox). badge_generated is emitted SERVER-side (0072) on issue;
   * badge_shared is emitted here only on an actually-completed share/copy —
   * never on a cancelled share sheet (AbortError), which is not a share.
   */
  async function handleShare() {
    setShareStatus('busy');
    const token = await getToken();
    if (!token) {
      setShareStatus('error');
      return;
    }
    const { data, error } = await api<BadgeIssued>(`/family/kids/${kidId}/badge`, {
      method: 'POST',
      token,
      body: { kind: 'streak', locale: toSupportedLocale(i18n.resolvedLanguage) },
    });
    if (error || !data) {
      setShareStatus('error');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: t('family.badge.share'), url: data.shareUrl });
        trackInsight('badge_shared', { routeClass: 'family' });
        setShareStatus('shared');
        setTimeout(() => setShareStatus('idle'), 2500);
      } catch {
        // AbortError (user dismissed the share sheet) or any other failure —
        // not a completed share either way, so no event and no error state.
        setShareStatus('idle');
      }
      return;
    }
    await navigator.clipboard.writeText(data.shareUrl);
    trackInsight('badge_shared', { routeClass: 'family' });
    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 2500);
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
        <Button
          onClick={() => void handleShare()}
          disabled={shareStatus === 'busy'}
          className="w-fit gap-2"
          variant={shareStatus === 'shared' || shareStatus === 'copied' ? 'success' : shareStatus === 'error' ? 'secondary' : 'primary'}
        >
          <Icon name={shareStatus === 'shared' || shareStatus === 'copied' ? 'check' : 'ios_share'} />
          {shareStatus === 'busy'
            ? t('family.badge.sharing')
            : shareStatus === 'shared'
              ? t('family.badge.shared')
              : shareStatus === 'copied'
                ? t('family.badge.copied')
                : shareStatus === 'error'
                  ? t('family.badge.error')
                  : t('family.badge.share')}
        </Button>
      ) : null}

      <TerritoryView tree={tree} locale={locale} chipLinkTo="/family" />
    </div>
  );
}

export default KidTerritoryPage;
