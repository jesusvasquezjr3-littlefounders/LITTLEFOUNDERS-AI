import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserListPage } from './UserListPage';

/** /@handle/followers — read-only: viewing someone else's followers, not managing your own edges. */
export function PublicFollowersPage() {
  const { t } = useTranslation();
  const { handle = '' } = useParams();
  const username = handle.startsWith('@') ? handle.slice(1).toLowerCase() : '';
  return (
    <UserListPage
      title={t('profile.followers.title')}
      fetchPath={`/profiles/${username}/followers`}
      backPath={`/${handle}`}
      backLabel={t('profile.settings.back')}
      emptyTitle={t('profile.followers.emptyTitle')}
      emptyBody={t('profile.followers.emptyBody')}
    />
  );
}
