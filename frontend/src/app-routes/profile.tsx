import { Route } from 'react-router-dom';
import { OwnProfileRoute } from '@/routes/app/profile/OwnProfileRoute';
import { LookEditorRoute } from '@/routes/app/profile/LookEditorRoute';
import { SettingsRoute } from '@/routes/app/profile/SettingsRoute';
import { FollowersPage } from '@/routes/app/profile/FollowersPage';
import { FollowingPage } from '@/routes/app/profile/FollowingPage';
import { PublicProfilePage } from '@/routes/app/profile/PublicProfilePage';
import { PublicFollowersPage } from '@/routes/app/profile/PublicFollowersPage';
import { PublicFollowingPage } from '@/routes/app/profile/PublicFollowingPage';

/*
 * Lane 5 (profile): the learner's own profile, avatar, settings and social
 * lists, and public profiles at /@username. App.tsx (Lane 0) mounts these
 * inside the signed-in app shell (RequireAuth + RequireOnboarded).
 *
 * W2P.1: /profile (P1), /profile/avatar (P2) and /profile/settings (P3) are
 * the rebuilt screens (`rebuild/account/`); the social lists and public
 * profiles are still the legacy pages until the lane's next checkpoint.
 */
export const profileShellRoutes = (
  <>
    <Route path="profile" element={<OwnProfileRoute />} />
    <Route path="profile/avatar" element={<LookEditorRoute />} />
    <Route path="profile/settings" element={<SettingsRoute />} />
    <Route path="profile/followers" element={<FollowersPage />} />
    <Route path="profile/following" element={<FollowingPage />} />
    {/* /@username — public profiles. Every static path in the app outranks
        these dynamic segments (React Router ranks by specificity). */}
    <Route path=":handle/followers" element={<PublicFollowersPage />} />
    <Route path=":handle/following" element={<PublicFollowingPage />} />
    <Route path=":handle" element={<PublicProfilePage />} />
  </>
);
