import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { APP_HOME } from '@/routes/app/navConfig';
import { Badge, Button, Card, Icon, StatCard } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { ProfileHero } from './ProfileHero';

/*
 * /@username — public profile (session required by routing). Shows exactly
 * what Core whitelists: name, @username, avatar, cover, member-since,
 * counts, Tutor badge. Follow/unfollow lives here.
 */

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
}

export function PublicProfilePage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { handle = '' } = useParams();
  const username = handle.startsWith('@') ? handle.slice(1).toLowerCase() : null;

  const [data, setData] = useState<PublicProfile | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="h-36 animate-pulse rounded-xl bg-surface-sunken sm:h-48" />
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
          <Button
            onClick={() => void toggleFollow()}
            disabled={busy}
            variant={data.isFollowing ? 'secondary' : 'primary'}
            className="gap-2"
          >
            <Icon name={data.isFollowing ? 'check' : 'person_add'} />
            {data.isFollowing ? t('profile.public.following') : t('profile.public.follow')}
          </Button>
        )}
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:max-w-sm">
        <StatCard icon={<Icon name="group" />} tone="secondary" value={String(data.followers)} label={t('profile.stats.followers')} />
        <StatCard icon={<Icon name="favorite" />} tone="accent" value={String(data.following)} label={t('profile.stats.following')} />
      </section>
    </div>
  );
}
