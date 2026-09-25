import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { COVER_PRESETS } from '@/lib/coverPresets';
import { Badge, Button, Card, Icon, SectionHeading, StatCard, LottieIcon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { ProfileHero } from './ProfileHero';
import { TeenConnectionsPanel } from './TeenConnectionsPanel';
import { ProfileSafetyControl } from './SocialTierNotes';
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
  learningStats: LearningStats;
  courseBadges?: CourseBadge[];
  /** E.8: this account's social tier (null when Core could not read it). */
  social?: { tier: 'guardian' | 'teen' | 'adult' | 'closed' | null; privateProfile: boolean };
  /** E.13: which of the owner's fields keeps their profile hidden. */
  profileReview?: { flagged: boolean; fields: ('username' | 'displayName')[] };
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { session, roles, getToken, refreshMe } = useAuth();
  const coverHeadingId = useId();
  const statsHeadingId = useId();
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
        <div className="h-36 animate-pulse rounded-md bg-surface-sunken sm:h-48" />
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
        <Card className="lf-pop mt-4 p-4 sm:p-5" aria-labelledby={coverHeadingId}>
          {/*
           * PICK ONE OF TEN, so these are the study's pick cards (/DESIGN.md
           * §The study's component set): a 2px border at full strength, an
           * outer coloured glow and a corner check disc, where the resting
           * card has a 1px hairline. The old treatment was an offset focus
           * ring doubling as a selected ring — one signal, and the same one
           * the keyboard already uses for something else.
           *
           * `-on`'s fill never shows here on purpose: an inline
           * `background-image` gradient IS the swatch, and it wins over the
           * class's background. The border, the glow and the disc are what
           * carry the state.
           */}
          <SectionHeading id={coverHeadingId} icon="palette" tone="delight">
            {t('profile.coverPicker.title')}
          </SectionHeading>
          <p className="lf-caption text-content-muted">{t('profile.coverPicker.hint')}</p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {COVER_PRESETS.map((p) => {
              const selected = (data.cover as { preset?: string }).preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={t(`profile.covers.${p.id}`)}
                  aria-pressed={selected}
                  title={t(`profile.covers.${p.id}`)}
                  disabled={savingCover !== null}
                  onClick={() => void chooseCover(p.id)}
                  className={cn(
                    'lf-pick-card motion-safe-press flex h-12 items-center justify-center lf-press',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected && 'lf-pick-card-on',
                  )}
                  style={{ backgroundImage: p.css }}
                >
                  {savingCover === p.id ? (
                    <Icon name="progress_activity" className="animate-spin text-on-inverse" aria-hidden />
                  ) : selected ? (
                    <span className="lf-pick-check" aria-hidden>
                      <Icon name="check" className="!text-[12px]" />
                    </span>
                  ) : null}
                </button>
              );
            })}
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
              className="lf-press lf-label mt-1 inline-flex items-center gap-1 rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

      {/* E.9: the lists stay reachable, with no number, outside the stats block. */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/profile/followers">
          <Button variant="secondary" className="gap-2"><Icon name="group" />{t('profile.stats.followers')}</Button>
        </Link>
        <Link to="/profile/following">
          <Button variant="secondary" className="gap-2"><Icon name="person_search" />{t('profile.stats.following')}</Button>
        </Link>
      </div>

      {data.profileReview?.flagged && (data.social?.tier === 'teen' || data.social?.tier === 'guardian') && (
        <div className="mt-4">
          <ProfileSafetyControl audience={data.social.tier === 'teen' ? 'self' : 'kidSelf'} fields={data.profileReview.fields} />
        </div>
      )}
      {data.social?.tier === 'teen' && <div className="mt-4"><TeenConnectionsPanel /></div>}

      {/*
       * The stats grid was named by a hidden `aria-label` and headed by
       * nothing. The lockup gives it the same name on screen, keyed `accent`
       * — the hue three of these six tiles already carry.
       */}
      <SectionHeading id={statsHeadingId} icon="insights" tone="accent" className="mt-8">
        {t('profile.stats.title')}
      </SectionHeading>
      {/*
       * 2/3/3, not the Stat row category's own 2/3/6 (/DESIGN.md §Layout →
       * Grid Systems, "Profile's Stat row is 2/3/3" — a documented exception,
       * corrected 2026-09-09 alongside this call site). Six columns at the
       * 1280px width `lg:` actually ships at leaves under 50px for a
       * label's text column after the icon chip and padding — nowhere near
       * enough for "Lecciones completadas" or "Minutos aprendidos" even
       * wrapped (line-clamp-2 in StatCard.tsx is the defense-in-depth floor
       * for whatever space a caller gives the label, not a substitute for
       * giving it enough).
       */}
      <section aria-labelledby={statsHeadingId} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<LottieIcon name="streak" value={data.learningStats.streakDays} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.streakDays)} label={t('profile.stats.streak')} />
        <StatCard icon={<LottieIcon name="lesson" value={data.learningStats.lessonsCompleted} activated={isActivated} className="w-10 h-10 scale-125" />} tone="primary" value={String(data.learningStats.lessonsCompleted)} label={t('profile.stats.lessons')} />
        <StatCard icon={<LottieIcon name="gold-coin" value={data.learningStats.xpPoints} activated={isActivated} className="w-10 h-10 scale-125" />} tone="accent" value={String(data.learningStats.xpPoints)} label={t('profile.stats.xp')} />
        <StatCard icon={<LottieIcon name="time" value={data.learningStats.minutesLearned} activated={isActivated} className="w-10 h-10 scale-125" />} tone="secondary" value={String(data.learningStats.minutesLearned)} label={t('profile.stats.minutesLearned')} />
      </section>

      <CourseBadgeCollection badges={data.courseBadges ?? []} isOwn />

      {/* Share / invite */}
      <Card className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {/* The study's icon well: one class, one colour named by the caller. */}
          <span className="lf-tile h-12 w-12 text-delight">
            <Icon name="celebration" />
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
