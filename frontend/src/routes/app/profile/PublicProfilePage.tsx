import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { APP_HOME } from '@/routes/app/navConfig';
import { Badge, Button, Card, Icon, SectionHeading, StatCard, LottieIcon } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { ProfileHero } from './ProfileHero';
import { CourseBadgeCollection } from './CourseBadgeCollection';
import type { CourseBadge } from '@/lib/courseBadges';

/*
 * /@username — public profile (session required by routing). Shows exactly
 * what Core whitelists: name, @username, avatar, cover, member-since,
 * counts, Tutor badge, and public learning stats. Follow/unfollow and
 * blocking both live here.
 *
 * Blocking (Jesús, 2026-07-12): a two-step inline confirm (no modal — this
 * is a rare, deliberate action, not worth a dialog) rather than an
 * irreversible single click. On success the profile is no longer visible
 * to either party (mutual 404), so we navigate away.
 */

interface LearningStats {
  xpPoints: number;
  minutesLearned: number;
  lessonsCompleted: number;
  streakDays: number;
  lastActiveDate: string | null;
}

interface PublicProfile {
  displayName: string;
  username: string;
  cover: Record<string, unknown>;
  avatarOptions: Record<string, unknown>;
  memberSince: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  isSelf: boolean;
  isTutor: boolean;
  learningStats: LearningStats;
  courseBadges?: CourseBadge[];
}

const BLOCK_CONFIRM_WINDOW_MS = 4000;

export function PublicProfilePage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const statsHeadingId = useId();
  const username = handle.startsWith('@') ? handle.slice(1).toLowerCase() : null;

  const [data, setData] = useState<PublicProfile | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const isActivated = data?.learningStats.lastActiveDate === today;
  const [busy, setBusy] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const res = await api<PublicProfile>(`/profiles/${username}`, { token });
      if (cancelled) return;
      if (res.error) setErrorCode(res.error.code);
      else setData(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [username, getToken]);

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  if (!username) return <Navigate to={APP_HOME} replace />;
  if (errorCode === 'NOT_FOUND') {
    return (
      <Card hero className="flex flex-col items-center gap-3 py-14 text-center">
        <Icon name="person_off" className="!text-[40px] text-content-muted" />
        <h1 className="lf-title text-content">{t('profile.public.notFound')}</h1>
        <Link to={APP_HOME}>
          <Button variant="secondary">{t('auth.verify.goHome')}</Button>
        </Link>
      </Card>
    );
  }
  if (errorCode) return <ErrorBanner code={errorCode} />;
  if (!data) {
    return (
      <div aria-busy="true">
        <div className="h-36 animate-pulse rounded-md bg-surface-sunken sm:h-48" />
        <div className="-mt-14 ml-5 h-28 w-28 animate-pulse rounded-full bg-surface-sunken ring-4 ring-base sm:ml-8" />
      </div>
    );
  }

  async function toggleFollow() {
    if (!data || data.isSelf) return;
    setBusy(true);
    const token = await getToken();
    const res = await api<{ following: boolean }>(`/profiles/${data.username}/follow`, {
      method: data.isFollowing ? 'DELETE' : 'POST',
      token,
    });
    setBusy(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            isFollowing: res.data.following,
            followers: d.followers + (res.data.following ? 1 : -1),
          }
        : d,
    );
  }

  function onBlockClick() {
    if (!confirmingBlock) {
      setConfirmingBlock(true);
      confirmTimer.current = setTimeout(() => setConfirmingBlock(false), BLOCK_CONFIRM_WINDOW_MS);
      return;
    }
    void block();
  }

  async function block() {
    if (!data) return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setBusy(true);
    const token = await getToken();
    const { error } = await api(`/profiles/${data.username}/block`, { method: 'POST', token });
    setBusy(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    navigate(APP_HOME, { replace: true });
  }

  const memberSince = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'long', year: 'numeric' }).format(
    new Date(data.memberSince),
  );

  return (
    <div>
      <ProfileHero cover={data.cover} avatarOptions={data.avatarOptions} seed={data.username} />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="lf-display-lg text-content">{data.displayName}</h1>
            {data.isTutor && <Badge className="bg-success-soft text-success-strong">{t('dashboard.tutorBadge')}</Badge>}
          </div>
          <p className="lf-body-lg mt-1 text-primary">@{data.username}</p>
          <p className="lf-caption mt-2 text-content-muted">{t('profile.memberSince', { date: memberSince })}</p>
        </div>
        {data.isSelf ? (
          <Link to="/profile">
            <Button variant="secondary" className="gap-2">
              <Icon name="edit" />
              {t('profile.public.editMine')}
            </Button>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void toggleFollow()}
              disabled={busy}
              variant={data.isFollowing ? 'secondary' : 'primary'}
              className="gap-2"
            >
              <Icon name={data.isFollowing ? 'check' : 'person_add'} />
              {data.isFollowing ? t('profile.public.following') : t('profile.public.follow')}
            </Button>
            <Button
              onClick={onBlockClick}
              disabled={busy}
              variant={confirmingBlock ? 'danger' : 'secondary'}
              aria-label={confirmingBlock ? t('profile.public.blockConfirm') : t('profile.public.block')}
              title={confirmingBlock ? t('profile.public.blockConfirm') : t('profile.public.block')}
              className="gap-2 px-4"
            >
              <Icon name={confirmingBlock ? 'report' : 'block'} />
              <span className="hidden sm:inline">{confirmingBlock ? t('profile.public.blockConfirm') : t('profile.public.block')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Gamified stats — same lockup as the owner's view, so one profile
          reads identically wherever it appears (/DESIGN.md §The study's
          component set). */}
      <SectionHeading id={statsHeadingId} icon="insights" tone="accent" className="mt-8">
        {t('profile.stats.title')}
      </SectionHeading>
      {/* 2/3/3, not 2/3/6 — same content, same /DESIGN.md exception as ProfilePage.tsx's own stat grid; see its comment. */}
      <section aria-labelledby={statsHeadingId} className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={<LottieIcon name="streak" value={data.learningStats.streakDays} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.streakDays)} label={t('profile.stats.streak')} />
        <StatCard icon={<LottieIcon name="lesson" value={data.learningStats.lessonsCompleted} activated={isActivated} className="w-10 h-10 scale-125" />} tone="primary" value={String(data.learningStats.lessonsCompleted)} label={t('profile.stats.lessons')} />
        <StatCard icon={<LottieIcon name="gold-coin" value={data.learningStats.xpPoints} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.xpPoints)} label={t('profile.stats.xp')} />
        <StatCard icon={<LottieIcon name="time" value={data.learningStats.minutesLearned} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.learningStats.minutesLearned)} label={t('profile.stats.minutesLearned')} />
        <Link
          to={`/${handle}/followers`}
          className="lf-press block rounded-md transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <StatCard icon={<LottieIcon name="followers" value={data.followers} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.followers)} label={t('profile.stats.followers')} />
        </Link>
        <Link
          to={`/${handle}/following`}
          className="lf-press block rounded-md transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <StatCard icon={<LottieIcon name="following" value={data.following} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.following)} label={t('profile.stats.following')} />
        </Link>
      </section>

      <CourseBadgeCollection badges={data.courseBadges ?? []} isOwn={data.isSelf} />
    </div>
  );
}
