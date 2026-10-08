import { Route } from 'react-router-dom';
import { OwnProfileRoute } from '@/routes/app/profile/OwnProfileRoute';
import { LookEditorRoute } from '@/routes/app/profile/LookEditorRoute';
import { SettingsRoute } from '@/routes/app/profile/SettingsRoute';
import { OwnFollowersRoute, OwnFollowingRoute, PublicFollowersRoute, PublicFollowingRoute } from '@/routes/app/profile/PeopleListRoute';
import { PublicProfileRoute } from '@/routes/app/profile/PublicProfileRoute';

/*
 * Profile routes: the learner's own profile, avatar, settings and social
 * lists, and public profiles at /@username. App.tsx mounts these
 * inside the signed-in app shell (RequireAuth + RequireOnboarded).
 *
 * Every route is a rebuilt screen: /profile, /profile/avatar and
 * /profile/settings (`rebuild/account/`); the people lists
 * and public profiles (`rebuild/social/`).
 */
export const profileShellRoutes = (
  <>
    <Route path="profile" element={<OwnProfileRoute />} />
    <Route path="profile/avatar" element={<LookEditorRoute />} />
    <Route path="profile/settings" element={<SettingsRoute />} />
    <Route path="profile/followers" element={<OwnFollowersRoute />} />
    <Route path="profile/following" element={<OwnFollowingRoute />} />
    {/* /@username — public profiles. Every static path in the app outranks
        these dynamic segments (React Router ranks by specificity). */}
    <Route path=":handle/followers" element={<PublicFollowersRoute />} />
    <Route path=":handle/following" element={<PublicFollowingRoute />} />
    <Route path=":handle" element={<PublicProfileRoute />} />
  </>
);
