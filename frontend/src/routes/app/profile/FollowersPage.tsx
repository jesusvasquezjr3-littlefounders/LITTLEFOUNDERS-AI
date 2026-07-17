import { useTranslation } from 'react-i18next';
import { UserListPage } from './UserListPage';

/** /profile/followers — my own followers (read-only; unfollowing is only ever mine to do on MY following list). */
export function FollowersPage() {
  const { t } = useTranslation();
  return (
    <UserListPage
      title={t('profile.followers.title')}
      fetchPath="/profile/followers"
      backPath="/profile"
      backLabel={t('profile.settings.back')}
      emptyTitle={t('profile.followers.emptyTitle')}
      emptyBody={t('profile.followers.emptyBody')}
    />
  );
}
