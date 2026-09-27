import { Route } from 'react-router-dom';
import { OwnProfileRoute } from '@/routes/app/profile/OwnProfileRoute';
import { LookEditorRoute } from '@/routes/app/profile/LookEditorRoute';
import { SettingsRoute } from '@/routes/app/profile/SettingsRoute';
import { OwnFollowersRoute, OwnFollowingRoute, PublicFollowersRoute, PublicFollowingRoute } from '@/routes/app/profile/PeopleListRoute';
import { PublicProfileRoute } from '@/routes/app/profile/PublicProfileRoute';

/*
 * Lane 5 (profile): the learner's own profile, avatar, settings and social
 * lists, and public profiles at /@username. App.tsx (Lane 0) mounts these
 * inside the signed-in app shell (RequireAuth + RequireOnboarded).
 *
 * Every route is a rebuilt screen: /profile (P1), /profile/avatar (P2) and
 * /profile/settings (P3) since W2P.1 (`rebuild/account/`); the people lists
 * (P4, P5, P7, P8) and public profiles (P6) since W2P.2 (`rebuild/social/`).
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
