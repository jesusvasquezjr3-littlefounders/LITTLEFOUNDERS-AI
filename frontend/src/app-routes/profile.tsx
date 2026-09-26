import { Route } from 'react-router-dom';
import { ProfilePage } from '@/routes/app/profile/ProfilePage';
import { AvatarEditorPage } from '@/routes/app/profile/AvatarEditorPage';
import { SettingsPage } from '@/routes/app/profile/SettingsPage';
import { FollowersPage } from '@/routes/app/profile/FollowersPage';
import { FollowingPage } from '@/routes/app/profile/FollowingPage';
import { PublicProfilePage } from '@/routes/app/profile/PublicProfilePage';
import { PublicFollowersPage } from '@/routes/app/profile/PublicFollowersPage';
import { PublicFollowingPage } from '@/routes/app/profile/PublicFollowingPage';

/*
 * Lane 5 (profile): the learner's own profile, avatar, settings and social
 * lists, and public profiles at /@username. App.tsx (Lane 0) mounts these
 * inside the signed-in app shell (RequireAuth + RequireOnboarded).
 */
export const profileShellRoutes = (
  <>
    <Route path="profile" element={<ProfilePage />} />
    <Route path="profile/avatar" element={<AvatarEditorPage />} />
    <Route path="profile/settings" element={<SettingsPage />} />
    <Route path="profile/followers" element={<FollowersPage />} />
    <Route path="profile/following" element={<FollowingPage />} />
    {/* /@username — public profiles. Every static path in the app outranks
        these dynamic segments (React Router ranks by specificity). */}
    <Route path=":handle/followers" element={<PublicFollowersPage />} />
    <Route path=":handle/following" element={<PublicFollowingPage />} />
    <Route path=":handle" element={<PublicProfilePage />} />
  </>
);
