import { useTranslation } from 'react-i18next';
import { UserListPage } from './UserListPage';

/** /profile/following — who I follow; each row can be unfollowed (my own edges). */
export function FollowingPage() {
  const { t } = useTranslation();
  return (
    <UserListPage
      title={t('profile.following.title')}
      fetchPath="/profile/following"
      backPath="/profile"
      backLabel={t('profile.settings.back')}
      emptyTitle={t('profile.following.emptyTitle')}
      emptyBody={t('profile.following.emptyBody')}
      allowUnfollow
    />
  );
}
