import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { UserListItem, type ListedUser } from './UserListItem';

/*
 * Generic followers/following list — powers both own (/profile/followers,
 * /profile/following) and public (/@handle/followers, /@handle/following)
 * routes from one component. `allowUnfollow` only makes sense on the
 * viewer's OWN following list (these are edges the viewer controls).
 */
export function UserListPage({
  title,
  fetchPath,
  backPath,
  backLabel,
  emptyTitle,
  emptyBody,
  allowUnfollow = false,
}: {
  title: string;
  fetchPath: string;
  backPath: string;
  backLabel: string;
  emptyTitle: string;
  emptyBody: string;
  allowUnfollow?: boolean;
}) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [users, setUsers] = useState<ListedUser[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUsers(null);
    setErrorCode(null);
    void (async () => {
      const token = await getToken();
      const res = await api<{ users: ListedUser[] }>(fetchPath, { token });
      if (cancelled) return;
      if (res.error) setErrorCode(res.error.code);
      else setUsers(res.data.users);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPath, getToken]);

  async function unfollow(user: ListedUser) {
    if (!user.username) return;
    setBusyId(user.userId);
    const token = await getToken();
    const { error } = await api(`/profiles/${user.username}/follow`, { method: 'DELETE', token });
    setBusyId(null);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    setUsers((list) => list?.filter((u) => u.userId !== user.userId) ?? list);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="lf-tile h-12 w-12 text-accent">
            <Icon name="group" />
          </span>
          <h1 className="lf-display-lg text-content">{title}</h1>
        </div>
        <Link
          to={backPath}
          className="lf-press lf-label inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {backLabel}
        </Link>
      </div>

      <div className="mt-6">
        {errorCode && <ErrorBanner code={errorCode} />}

        {!users && !errorCode && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-md bg-surface-sunken" />
            ))}
          </div>
        )}

        {users && users.length === 0 && (
          <Card hero className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon name="group_off" className="!text-[32px] text-content-muted" />
            <h2 className="lf-title text-content">{emptyTitle}</h2>
            <p className="lf-body text-content-muted">{emptyBody}</p>
          </Card>
        )}

        {users && users.length > 0 && (
          <Card className="flex flex-col gap-1 p-2 sm:p-3">
            {users.map((u) => (
              <UserListItem
                key={u.userId}
                user={u}
                tutorLabel={t('dashboard.tutorBadge')}
                action={
                  allowUnfollow ? (
                    <Button
                      variant="secondary"
                      className="shrink-0 gap-1.5 px-4 py-2"
                      disabled={busyId === u.userId}
                      onClick={() => void unfollow(u)}
                    >
                      <Icon
                        name={busyId === u.userId ? 'progress_activity' : 'person_remove'}
                        className={busyId === u.userId ? 'animate-spin' : undefined}
                      />
                      {t('profile.followers.unfollow')}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
