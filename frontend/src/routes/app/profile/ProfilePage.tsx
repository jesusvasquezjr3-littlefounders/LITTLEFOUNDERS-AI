import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { COVER_PRESETS } from '@/lib/coverPresets';
import { Badge, Button, Card, Icon, StatCard, LottieIcon } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { ProfileHero } from './ProfileHero';
import { CourseBadgeCollection } from './CourseBadgeCollection';
import type { CourseBadge } from '@/lib/courseBadges';

/*
 * /profile — the user's own public identity: gradient cover (presets ONLY —
 * uploads don't exist), Avataaars with an explicit edit indicator, gamified
 * learning stats, share-to-invite, and the door to /profile/settings.
 */

interface LearningStats {
  xpPoints: number;
  minutesLearned: number;
  lessonsCompleted: number;
  streakDays: number;
  lastActiveDate: string | null;
}

interface OwnProfile {
  displayName: string;
  username: string | null;
  cover: Record<string, unknown>;
  avatarOptions: Record<string, unknown>;
  memberSince: string;
  email: string;
  locale: string;
  followers: number;
  following: number;
  learningStats: LearningStats;
  courseBadges?: CourseBadge[];
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { session, roles, getToken, refreshMe } = useAuth();
  const [data, setData] = useState<OwnProfile | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pickingCover, setPickingCover] = useState(false);
  const [savingCover, setSavingCover] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const userId = session?.user.id ?? 'littlefounder';
  const isParent = roles.includes('parent');
  const today = new Date().toISOString().split('T')[0];
  const isActivated = data?.learningStats.lastActiveDate === today;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const res = await api<OwnProfile>('/profile', { token });
      if (cancelled) return;
      if (res.error) setErrorCode(res.error.code);
      else setData(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function chooseCover(preset: string) {
    setSavingCover(preset);
    const token = await getToken();
    const res = await api<{ cover: Record<string, unknown> }>('/profile/cover', {
      method: 'PUT',
      body: { preset },
      token,
    });
    setSavingCover(null);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    setData((d) => (d ? { ...d, cover: res.data.cover } : d));
    setPickingCover(false);
    void refreshMe();
  }

  async function copyInvite() {
    if (!data?.username) return;
    await navigator.clipboard.writeText(t('profile.share.text', { username: data.username }));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (errorCode) return <ErrorBanner code={errorCode} />;

  if (!data) {
    return (
      <div aria-busy="true">
        <div className="h-36 animate-pulse rounded-xl bg-surface-sunken sm:h-48" />
        <div className="-mt-14 ml-5 h-28 w-28 animate-pulse rounded-full bg-surface-sunken ring-4 ring-base sm:ml-8" />
      </div>
    );
  }

  const memberSince = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'long', year: 'numeric' }).format(
    new Date(data.memberSince),
  );

  return (
    <div>
      <ProfileHero
        cover={data.cover}
        avatarOptions={data.avatarOptions}
        seed={userId}
        coverAction={
          <button
            type="button"
            onClick={() => setPickingCover((p) => !p)}
            className="lf-caption motion-safe-press flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 font-bold text-content shadow-glass-sm transition-colors duration-150 hover:text-primary lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="palette" className="!text-[16px]" />
            {t('profile.editCover')}
          </button>
        }
        avatarAction={
          <Link
            to="/profile/avatar"
            aria-label={t('profile.editAvatar')}
            title={t('profile.editAvatar')}
            className="motion-safe-press flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent shadow-pop transition-colors duration-150 hover:bg-accent-strong lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="edit" className="!text-[18px]" />
          </Link>
        }
      />

      {pickingCover && (
        <Card className="lf-pop mt-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 text-primary" name="palette" aria-hidden />
            <div>
              <p className="lf-label text-content">{t('profile.coverPicker.title')}</p>
              <p className="lf-caption mt-1 text-content-muted">{t('profile.coverPicker.hint')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {COVER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={t(`profile.covers.${p.id}`)}
                aria-pressed={(data.cover as { preset?: string }).preset === p.id}
                title={t(`profile.covers.${p.id}`)}
                disabled={savingCover !== null}
                onClick={() => void chooseCover(p.id)}
                className={
                  'motion-safe-press flex h-12 items-center justify-center rounded-md transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                  ((data.cover as { preset?: string }).preset === p.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-base' : '')
                }
                style={{ backgroundImage: p.css }}
              >
                {savingCover === p.id ? (
                  <Icon name="progress_activity" className="animate-spin text-on-inverse" aria-hidden />
                ) : (data.cover as { preset?: string }).preset === p.id ? (
                  <Icon name="check" className="text-on-inverse" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Identity row */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="lf-display-lg text-content">{data.displayName}</h1>
            {isParent && <Badge className="bg-success-soft text-success-strong">{t('dashboard.tutorBadge')}</Badge>}
          </div>
          {data.username ? (
            <p className="lf-body-lg mt-1 text-primary">@{data.username}</p>
          ) : (
            <Link
              to="/profile/settings"
              className="lf-label mt-1 inline-flex items-center gap-1 rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="add" className="!text-[16px]" />
              {t('profile.claimUsername')}
            </Link>
          )}
          <p className="lf-caption mt-2 text-content-muted">{t('profile.memberSince', { date: memberSince })}</p>
        </div>
        <Link to="/profile/settings">
          <Button variant="secondary" className="gap-2 px-5 py-2.5">
            <Icon name="settings" />
            {t('profile.settingsCta')}
          </Button>
        </Link>
      </div>

      <section aria-label={t('profile.stats.title')} className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<LottieIcon name="streak" value={data.learningStats.streakDays} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.streakDays)} label={t('profile.stats.streak')} />
        <StatCard icon={<LottieIcon name="lesson" value={data.learningStats.lessonsCompleted} activated={isActivated} className="w-10 h-10 scale-125" />} tone="primary" value={String(data.learningStats.lessonsCompleted)} label={t('profile.stats.lessons')} />
        <StatCard icon={<LottieIcon name="gold-coin" value={data.learningStats.xpPoints} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.xpPoints)} label={t('profile.stats.xp')} />
        <StatCard icon={<LottieIcon name="time" value={data.learningStats.minutesLearned} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.learningStats.minutesLearned)} label={t('profile.stats.minutesLearned')} />
        <Link
          to="/profile/followers"
          className="block rounded-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <StatCard icon={<LottieIcon name="followers" value={data.followers} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.followers)} label={t('profile.stats.followers')} />
        </Link>
        <Link
          to="/profile/following"
          className="block rounded-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          <StatCard icon={<LottieIcon name="following" value={data.following} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.following)} label={t('profile.stats.following')} />
        </Link>
      </section>

      <CourseBadgeCollection badges={data.courseBadges ?? []} isOwn />

      {/* Share / invite */}
      <Card className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-delight-soft">
            <Icon name="celebration" className="text-content" />
          </span>
          <div>
            <h2 className="lf-title text-content">{t('profile.share.title')}</h2>
            <p className="lf-body mt-1 text-content-muted">
              {data.username ? t('profile.share.text', { username: data.username }) : t('profile.share.needUsername')}
            </p>
          </div>
        </div>
        {data.username ? (
          <Button onClick={() => void copyInvite()} className="shrink-0 gap-2" variant={copied ? 'success' : 'primary'}>
            <Icon name={copied ? 'check' : 'content_copy'} />
            {copied ? t('profile.share.copied') : t('profile.share.copy')}
          </Button>
        ) : (
          <Link to="/profile/settings" className="shrink-0">
            <Button variant="secondary">{t('profile.claimUsername')}</Button>
          </Link>
        )}
      </Card>
    </div>
  );
}
