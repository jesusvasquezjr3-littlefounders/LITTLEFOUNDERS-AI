import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { APP_HOME } from '@/routes/app/navConfig';
import { Badge, Button, Card, Icon, SectionHeading, StatCard, LottieIcon } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { ConnectionRequestControl } from './ConnectionRequestControl';
import { PrivateProfileControl } from './PrivateProfileControl';
import { ManagedConnectionsControl } from './SocialTierNotes';
import { ProfileHero } from './ProfileHero';
import { ProfileReportControl } from './ProfileReportControl';
import { CourseBadgeCollection } from './CourseBadgeCollection';
import type { CourseBadge } from '@/lib/courseBadges';

/*
 * /@username — public profile (session required by routing). Shows exactly
 * what Core whitelists: name, @username, avatar, cover, member-since,
 * Tutor badge, and public learning stats. Follow/unfollow and
 * blocking both live here.
 *
 * S08.6: Core decides the tier (E.8). A private teen arrives as a card
 * (visibility 'private': handle, cartoon avatar, cover) and is rendered by the
 * rebuild PrivateProfile; `connection` says how this viewer may connect. No
 * follower or following count exists on the wire any more (E.9): the lists
 * are plain links, outside the stats block.
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

type ConnectionMode = 'follow' | 'guardianRequest' | 'teenRequest' | 'managed' | 'none';

interface PrivateCard {
  visibility: 'private';
  username: string;
  cover: Record<string, unknown>;
  avatarOptions: Record<string, unknown>;
  connection: ConnectionMode;
  requestPending: boolean;
}

interface PublicProfile {
  visibility?: 'full';
  displayName: string;
  username: string;
  cover: Record<string, unknown>;
  avatarOptions: Record<string, unknown>;
  memberSince: string;
  connection?: ConnectionMode;
  isFollowing: boolean;
  requiresGuardianApproval: boolean;
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
  const [card, setCard] = useState<PrivateCard | null>(null);
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
      const res = await api<PublicProfile | PrivateCard>(`/profiles/${username}`, { token });
      if (cancelled) return;
      if (res.error) setErrorCode(res.error.code);
      else if (res.data.visibility === 'private') { setCard(res.data); setData(null); }
      else { setData(res.data); setCard(null); }
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
  const target = card?.username === username ? card.username : data?.username === username ? data.username : null;
  if (!target) {
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
    // Leaving a child's or a private teen's profile: it is no longer visible to this account.
    if ((data.requiresGuardianApproval || data.connection === 'teenRequest') && !res.data.following) {
      navigate(APP_HOME, { replace: true });
      return;
    }
    setData((d) => (d ? { ...d, isFollowing: res.data.following } : d));
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
    if (!target) return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setBusy(true);
    const token = await getToken();
    const { error } = await api(`/profiles/${target}/block`, { method: 'POST', token });
    setBusy(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    navigate(APP_HOME, { replace: true });
  }

  const safetyControls = (
    <>
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
      <ProfileReportControl username={target} />
    </>
  );

  if (card) {
    // E.8: a private teen. Only the handle this viewer typed, the cartoon avatar and the cover preset.
    return (
      <div>
        <ProfileHero cover={card.cover} avatarOptions={card.avatarOptions} seed={card.username} />
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{safetyControls}</div>
        <div className="mt-4">
          <PrivateProfileControl
            username={card.username}
            mode={card.connection === 'teenRequest' || card.connection === 'managed' ? card.connection : 'none'}
            requestPending={card.requestPending}
          />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const memberSince = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'long', year: 'numeric' }).format(
    new Date(data.memberSince),
  );
  // Older Core answers without `connection`: keep the earlier child-only rule.
  const connection: ConnectionMode = data.connection ?? (data.requiresGuardianApproval ? 'guardianRequest' : 'follow');

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
          <div className="flex flex-wrap items-center gap-2">
            {(data.isFollowing || connection === 'follow') && <Button
              onClick={() => void toggleFollow()}
              disabled={busy}
              variant={data.isFollowing ? 'secondary' : 'primary'}
              className="gap-2"
            >
              <Icon name={data.isFollowing ? 'check' : 'person_add'} />
              {data.isFollowing ? t('profile.public.following') : t('profile.public.follow')}
            </Button>}
            {safetyControls}
          </div>
        )}
      </div>

      {/* E.9: the lists stay reachable, with no number, outside the stats block. */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={`/${handle}/followers`}>
          <Button variant="secondary" className="gap-2"><Icon name="group" />{t('profile.stats.followers')}</Button>
        </Link>
        <Link to={`/${handle}/following`}>
          <Button variant="secondary" className="gap-2"><Icon name="person_search" />{t('profile.stats.following')}</Button>
        </Link>
      </div>

      {!data.isSelf && !data.isFollowing && (connection === 'guardianRequest' || connection === 'teenRequest') && (
        <ConnectionRequestControl username={data.username} decidedBy={connection === 'teenRequest' ? 'subject' : 'guardian'} />
      )}
      {!data.isSelf && connection === 'managed' && (
        <div className="mt-4"><ManagedConnectionsControl /></div>
      )}

      {/* Gamified stats — same lockup as the owner's view, so one profile
          reads identically wherever it appears (/DESIGN.md §The study's
          component set). */}
      <SectionHeading id={statsHeadingId} icon="insights" tone="accent" className="mt-8">
        {t('profile.stats.title')}
      </SectionHeading>
      <section aria-labelledby={statsHeadingId} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<LottieIcon name="streak" value={data.learningStats.streakDays} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.streakDays)} label={t('profile.stats.streak')} />
        <StatCard icon={<LottieIcon name="lesson" value={data.learningStats.lessonsCompleted} activated={isActivated} className="w-10 h-10 scale-125" />} tone="primary" value={String(data.learningStats.lessonsCompleted)} label={t('profile.stats.lessons')} />
        <StatCard icon={<LottieIcon name="gold-coin" value={data.learningStats.xpPoints} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.xpPoints)} label={t('profile.stats.xp')} />
        <StatCard icon={<LottieIcon name="time" value={data.learningStats.minutesLearned} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.learningStats.minutesLearned)} label={t('profile.stats.minutesLearned')} />
      </section>

      <CourseBadgeCollection badges={data.courseBadges ?? []} isOwn={data.isSelf} />
    </div>
  );
}
