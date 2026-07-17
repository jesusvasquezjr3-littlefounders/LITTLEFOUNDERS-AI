import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserListPage } from './UserListPage';

/** /@handle/following — read-only: viewing who someone else follows. */
export function PublicFollowingPage() {
  const { t } = useTranslation();
  const { handle = '' } = useParams();
  const username = handle.startsWith('@') ? handle.slice(1).toLowerCase() : '';
  return (
    <UserListPage
      title={t('profile.following.title')}
      fetchPath={`/profiles/${username}/following`}
      backPath={`/${handle}`}
      backLabel={t('profile.settings.back')}
      emptyTitle={t('profile.following.emptyTitle')}
      emptyBody={t('profile.following.emptyBody')}
    />
  );
}
