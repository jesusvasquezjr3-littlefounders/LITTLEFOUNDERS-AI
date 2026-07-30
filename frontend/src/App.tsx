import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AuthProvider } from '@/auth/AuthContext';
import { AnalyticsScripts } from '@/lib/analytics';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireGuest } from '@/auth/RequireGuest';
import { RequireRole } from '@/auth/RequireRole';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { AuthLayout } from '@/routes/auth/AuthLayout';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { AuthCallbackPage } from '@/routes/auth/AuthCallbackPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { AppLayout } from '@/routes/app/AppLayout';
import { LearnPage } from '@/routes/app/LearnPage';
import { CoursePage } from '@/routes/app/learn/CoursePage';
import { TerritoryPage } from '@/routes/app/learn/TerritoryPage';
import { FamilyPage } from '@/routes/app/family/FamilyPage';
import { KidTerritoryPage } from '@/routes/app/family/KidTerritoryPage';
import { LessonRoute } from '@/routes/app/learn/LessonRoute';
import { SectionComingSoon } from '@/routes/app/SectionComingSoon';
import { ProfilePage } from '@/routes/app/profile/ProfilePage';
import { AvatarEditorPage } from '@/routes/app/profile/AvatarEditorPage';
import { SettingsPage } from '@/routes/app/profile/SettingsPage';
import { FollowersPage } from '@/routes/app/profile/FollowersPage';
import { FollowingPage } from '@/routes/app/profile/FollowingPage';
import { PublicProfilePage } from '@/routes/app/profile/PublicProfilePage';
import { PublicFollowersPage } from '@/routes/app/profile/PublicFollowersPage';
import { PublicFollowingPage } from '@/routes/app/profile/PublicFollowingPage';
import { AdminOverviewPage } from '@/routes/admin/AdminOverviewPage';
import { AdminContentPage } from '@/routes/admin/AdminContentPage';
import { AdminEmailDashboard } from '@/routes/admin/AdminEmailDashboard';
import { AdminInsightsPage } from '@/routes/admin/AdminInsightsPage';
import { AdminIntelPage } from '@/routes/admin/AdminIntelPage';
import { useInsightsBeacon } from '@/lib/useInsightsBeacon';
import { useMarketingBeacon } from '@/lib/useMarketingBeacon';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

import { AdminUsersPage } from '@/routes/admin/AdminUsersPage';
import { AdminAuditPage } from '@/routes/admin/AdminAuditPage';
import { AdminRolesPage } from '@/routes/admin/AdminRolesPage';
import { AnalyticsHealthPage } from '@/routes/admin/AnalyticsHealthPage';
import { AdminGenerationPage } from '@/routes/admin/AdminGenerationPage';
import { Suspense, lazy, useState } from 'react';

/* Dev-only harness — the Lesson Engine QA surface (LESSON_ENGINE.md §10). Lazy +
 * DEV-gated so the lab (and its local grader) never reaches production bundles. */
const LessonLabPage = lazy(() => import('@/lesson-engine/lab/LessonLabPage'));
const LessonViewPage = lazy(() => import('@/lesson-engine/lab/LessonViewPage'));

/* Dev-only harness — the Game Engine QA surface (GAME_ENGINE.md §7/§10). Lazy +
 * DEV-gated so the lab (and every mechanic slice it eagerly loads) never reaches
 * production bundles. */
const GameLabPage = lazy(() => import('@/game-engine/lab/GameLabPage'));

/* The games product surface (GAME_ENGINE.md §8). BOTH lazy: the hub so its
 * catalog view is its own chunk, and the play route so the player, its overlays
 * and the mechanic chunk it pulls in never enter the main bundle — nobody
 * downloads a simulator to read the dashboard. */
const GamesHubPage = lazy(() => import('@/routes/app/games/GamesHubPage'));
const GameRoute = lazy(() => import('@/routes/app/games/GameRoute'));

/** Both staff roles share the console; Roles & Access narrows to superadmin. */
const STAFF = ['admin', 'superadmin'];

/*
 * First-party usage beacon (/INSIGHTS.md), mounted ONCE above BOTH route
 * groups — the lesson player lives OUTSIDE AppLayout, so a layout-level
 * beacon died on every lesson entry, silently discarding lesson events.
 * Renders nothing; transmits nothing without a session + analyticsEnabled.
 */
function InsightsBeacon({ consentVersion }: { consentVersion: number }) {
  useInsightsBeacon();
  // Acquisition funnel: anonymous, marketing-only, cookie-consent gated.
  // consentVersion is bumped by the banner so accepting starts tracking
  // IMMEDIATELY — the banner's own setState only re-renders the banner, so
  // without this the hook would not re-evaluate consent until the next
  // navigation and the landing visit that produced the accept would be lost.
  useMarketingBeacon(consentVersion);
  return null;
}

export function App() {
  const [consentVersion, setConsentVersion] = useState(0);
  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalyticsScripts />
        <InsightsBeacon consentVersion={consentVersion} />
        <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
        <Routes>
          {import.meta.env.DEV ? (
            <Route
              path="dev/lesson-lab"
              element={
                <Suspense fallback={null}>
                  <LessonLabPage />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/lesson-view"
              element={
                <Suspense fallback={null}>
                  <LessonViewPage />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/game-lab"
              element={
                <Suspense fallback={null}>
                  <GameLabPage />
                </Suspense>
              }
            />
          ) : null}

          {/* Marketing (marketing chrome) */}
          <Route element={<MarketingLayout />}>
            <Route index element={<Landing />} />
            <Route path="how-it-works" element={<ComingSoon page="howItWorks" />} />
            <Route path="families" element={<ComingSoon page="families" />} />
            <Route path="faq" element={<ComingSoon page="faq" />} />
            <Route path="legal/terms" element={<LegalPage doc="terms" />} />
            <Route path="legal/privacy" element={<LegalPage doc="privacy" />} />
            {/* OAuth landing — not guest-guarded: it completes the transition from guest to authed. */}
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="verify-parent"
              element={
                <RequireAuth>
                  <VerifyParentPage />
                </RequireAuth>
              }
            />
          </Route>

          {/* Auth (login/signup) — bare trust surface, no marketing chrome
              (DESIGN.md §Screen Recipes → Auth). */}
          <Route element={<AuthLayout />}>
            <Route
              path="login"
              element={
                <RequireGuest>
                  <LoginPage />
                </RequireGuest>
              }
            />
            <Route
              path="signup"
              element={
                <RequireGuest>
                  <SignupPage />
                </RequireGuest>
              }
            />
          </Route>

          {/* App (dashboard chrome — sections come from routes/app/navConfig) */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/:courseSlug" element={<CoursePage />} />
            <Route path="learn/:courseSlug/territory" element={<TerritoryPage />} />
            <Route path="tutor" element={<SectionComingSoon section="tutor" icon="smart_toy" />} />
            <Route
              path="games"
              element={
                <Suspense fallback={null}>
                  <GamesHubPage />
                </Suspense>
              }
            />
            <Route
              path="tasks"
              element={
                <RequireRole role="parent">
                  <SectionComingSoon section="tasks" icon="checklist" />
                </RequireRole>
              }
            />
            <Route
              path="family"
              element={
                <RequireRole role="parent">
                  <FamilyPage />
                </RequireRole>
              }
            />
            <Route
              path="family/:kidId/territory"
              element={
                <RequireRole role="parent">
                  <KidTerritoryPage />
                </RequireRole>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/avatar" element={<AvatarEditorPage />} />
            <Route path="profile/settings" element={<SettingsPage />} />
            <Route path="profile/followers" element={<FollowersPage />} />
            <Route path="profile/following" element={<FollowingPage />} />

            {/* Staff console — INTEGRATED into the app shell (DESIGN.md Screen
                Recipes → Staff sections). HIDDEN for non-staff (no nav item +
                RequireRole redirect). Both admin & superadmin see the sections;
                Roles & Access is superadmin-only (§1.4). Static paths above the
                :handle catch-all, and static routes always outrank it. */}
            <Route path="admin" element={<RequireRole role={STAFF}><AdminOverviewPage /></RequireRole>} />
            <Route path="admin/content" element={<RequireRole role={STAFF}><AdminContentPage /></RequireRole>} />

            <Route path="admin/users" element={<RequireRole role={STAFF}><AdminUsersPage /></RequireRole>} />
            <Route path="admin/emails" element={<RequireRole role={STAFF}><AdminEmailDashboard /></RequireRole>} />
            <Route path="admin/insights" element={<RequireRole role={STAFF}><AdminInsightsPage /></RequireRole>} />
            <Route path="admin/intel" element={<RequireRole role={STAFF}><AdminIntelPage /></RequireRole>} />
            <Route path="admin/analytics" element={<RequireRole role={STAFF}><AnalyticsHealthPage /></RequireRole>} />
            <Route path="admin/generation" element={<RequireRole role={STAFF}><AdminGenerationPage /></RequireRole>} />
            <Route path="admin/audit" element={<RequireRole role={STAFF}><AdminAuditPage /></RequireRole>} />
            <Route path="admin/roles" element={<RequireRole role="superadmin"><AdminRolesPage /></RequireRole>} />

            {/* /@username — public profiles (static routes above always win) */}
            <Route path=":handle/followers" element={<PublicFollowersPage />} />
            <Route path=":handle/following" element={<PublicFollowingPage />} />
            <Route path=":handle" element={<PublicProfilePage />} />
          </Route>

          {/* Lesson Player — its own fullscreen layer, no app chrome (DESIGN.md
              Screen Recipes → Lesson). RequireAuth only, deliberately outside
              the AppLayout route group above. */}
          <Route
            path="learn/lesson/:lessonId"
            element={
              <RequireAuth>
                <LessonRoute />
              </RequireAuth>
            }
          />

          {/* Game Player — the Lesson player's peer: its own fullscreen layer,
              no app chrome (DESIGN.md Screen Recipes → Game player). Same
              placement rule, deliberately outside the AppLayout route group. */}
          <Route
            path="games/:slug"
            element={
              <RequireAuth>
                <Suspense fallback={null}>
                  <GameRoute />
                </Suspense>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
