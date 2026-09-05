import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AuthProvider } from '@/auth/AuthContext';
import { AnalyticsScripts } from '@/lib/analytics';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireGuest } from '@/auth/RequireGuest';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { RequireRole } from '@/auth/RequireRole';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { HowItWorks } from '@/routes/marketing/HowItWorks';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { AuthLayout } from '@/routes/auth/AuthLayout';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { AuthCallbackPage } from '@/routes/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { UpgradeAccountPage } from '@/routes/auth/UpgradeAccountPage';
import { OnboardingPage } from '@/routes/onboarding/OnboardingPage';
import { AppLayout } from '@/routes/app/AppLayout';
import { LearnPage } from '@/routes/app/LearnPage';
import { CoursePage } from '@/routes/app/learn/CoursePage';
import { TerritoryPage } from '@/routes/app/learn/TerritoryPage';
import { PlacementPage } from '@/routes/app/learn/PlacementPage';
import { FamilyPage } from '@/routes/app/family/FamilyPage';
import { KidTerritoryPage } from '@/routes/app/family/KidTerritoryPage';
import { KidTutorPage } from '@/routes/app/family/KidTutorPage';
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
import { LoadingOverlay } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { releaseBootVeil } from '@/lib/boot';

import { AdminUsersPage } from '@/routes/admin/AdminUsersPage';
import { AdminAuditPage } from '@/routes/admin/AdminAuditPage';
import { AdminRolesPage } from '@/routes/admin/AdminRolesPage';
import { AnalyticsHealthPage } from '@/routes/admin/AnalyticsHealthPage';
import { AdminGenerationPage } from '@/routes/admin/AdminGenerationPage';
import { Suspense, lazy, useEffect, useState } from 'react';

/* Dev-only harness — the Lesson Engine QA surface (LESSON_ENGINE.md §10). Lazy +
 * DEV-gated so the lab (and its local grader) never reaches production bundles. */
const LessonLabPage = lazy(() => import('@/lesson-engine/lab/LessonLabPage'));
const LessonViewPage = lazy(() => import('@/lesson-engine/lab/LessonViewPage'));

/* Dev-only harness for the Tutor's 3D layer — measures a real .glb against the
 * asset budget (tutor-scene/budget.ts). Lazy + DEV-gated for the same reason as
 * the lesson lab, and additionally because `three` is a large chunk that must
 * never be pulled into a production entry bundle by a stray import. */
const SceneLabPage = lazy(() => import('@/tutor-scene/lab/SceneLabPage'));
const PoseLabPage = lazy(() => import('@/tutor-scene/lab/PoseLabPage'));

/* Dev-only visual QA for the Tutor's product surfaces (personalize, offer,
 * conversation) against fixtures — the §1.11 both-breakpoints check without
 * needing a live session, a model key or a websocket. */
const TutorLabPage = lazy(() => import('@/tutor/lab/TutorLabPage'));
const LearnLabPage = lazy(() => import('@/routes/app/learn/lab/LearnLabPage'));
const AnalyticsNoticesLab = lazy(() => import('@/routes/admin/analytics/AnalyticsNoticesLab'));
const AudienceLab = lazy(() => import('@/routes/admin/analytics/AudienceLab'));

/* The Tutor's 3D stage. Lazy is MANDATORY, not an optimisation: `three` plus the
 * scene code is a large chunk, and a static import would put it in the entry
 * bundle of every route — including the marketing pages of users who never open
 * the Tutor. */
const TutorPage = lazy(() => import('@/routes/app/TutorPage'));

/** Both staff roles share the console; Roles & Access narrows to superadmin. */
const STAFF = ['admin', 'superadmin'];

/*
 * What a learner sees while the Tutor's chunk downloads. It used to be
 * `fallback={null}` — a BLANK SCREEN for the length of the `three` download,
 * which on a slow connection is seconds of apparently-broken product before
 * the stage's own veil could even mount. The overlay paints the app surface
 * and says loading, in the learner's language, from the first frame.
 */
function TutorChunkFallback() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-surface">
      <LoadingOverlay label={t('tutor.page.loading')} />
    </div>
  );
}

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

  /*
   * Dissolve the boot veil index.html armed before the first paint
   * (/DESIGN.md §Motion recipe 11). Here rather than in main.tsx because an
   * effect at the app root is the first moment React has actually COMMITTED —
   * calling it beside createRoot().render() would only mean "render was
   * requested", which under concurrent rendering can be several frames early,
   * and revealing an empty #root is the defect this replaces, not a fix for it.
   */
  useEffect(() => {
    void releaseBootVeil();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalyticsScripts consentVersion={consentVersion} />
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
              path="dev/scene-lab"
              element={
                <Suspense fallback={null}>
                  <SceneLabPage />
                </Suspense>
              }
            />
          ) : null}
          {/* The pose library, reviewed by LOOKING at it. DEV-only for the same
              reason scene-lab is: it is an authoring surface, not a product one. */}
          {import.meta.env.DEV ? (
            <Route
              path="dev/pose-lab"
              element={
                <Suspense fallback={null}>
                  <PoseLabPage />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/learn-lab/:courseSlug"
              element={
                <Suspense fallback={null}>
                  <LearnLabPage />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/audience-lab"
              element={
                <Suspense fallback={null}>
                  <AudienceLab />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/analytics-notices"
              element={
                <Suspense fallback={null}>
                  <AnalyticsNoticesLab />
                </Suspense>
              }
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              path="dev/tutor-lab"
              element={
                <Suspense fallback={null}>
                  <TutorLabPage />
                </Suspense>
              }
            />
          ) : null}
          {/* Marketing (marketing chrome) */}
          <Route element={<MarketingLayout />}>
            <Route index element={<Landing />} />
            <Route path="how-it-works" element={<HowItWorks />} />
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
            <Route
              path="forgot-password"
              element={
                <RequireGuest>
                  <ForgotPasswordPage />
                </RequireGuest>
              }
            />
            {/* Not guest-guarded: driven entirely by the recovery link's URL
                fragment, which is valid regardless of any existing session
                on this device (e.g. an older link opened while logged in
                elsewhere). */}
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Onboarding — guest-first, one-time. Its own fullscreen layer, no
              app/marketing chrome; RequireAuth only (a guest already has a
              session the moment they land here — see Landing's startAsGuest). */}
          <Route
            path="onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          {/* Attach a permanent identity to the current guest session in
              place — never /signup, which would mint a second blank identity. */}
          <Route
            path="upgrade-account"
            element={
              <RequireAuth>
                <UpgradeAccountPage />
              </RequireAuth>
            }
          />
          {/* Mandatory per-course placement quiz (0043) — its own fullscreen
              layer like onboarding, but still funnels an unboarded guest to
              /onboarding first (RequireOnboarded) so the two one-time flows
              never interleave out of order. */}
          <Route
            path="learn/:courseSlug/placement"
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <PlacementPage />
                </RequireOnboarded>
              </RequireAuth>
            }
          />

          {/* App (dashboard chrome — sections come from routes/app/navConfig) */}
          <Route
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <AppLayout />
                </RequireOnboarded>
              </RequireAuth>
            }
          >
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/:courseSlug" element={<CoursePage />} />
            <Route path="learn/:courseSlug/territory" element={<TerritoryPage />} />
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
            {/* Parent visibility into a child's tutor conversations is a
                product invariant (§1.9), not a feature — same parent gate,
                and Core re-checks the verified guardian link per request. */}
            <Route
              path="family/:kidId/tutor"
              element={
                <RequireRole role="parent">
                  <KidTutorPage />
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

          {/* Tutor — the SECOND fullscreen layer, and the list is closed at two
              (DESIGN.md → Layout → the immersive exception; adding a third is an
              owner decision). It sits outside AppLayout for a reason the
              `fixed inset-0` stage cannot achieve on its own: the sidebar and
              the mobile tab bar would still be in the DOM underneath it, so a
              keyboard user would tab into navigation they cannot see. The
              onboarding gate is kept, because an un-onboarded learner has no
              nickname and no preferences for the island to be built from. */}
          <Route
            path="tutor"
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <Suspense fallback={<TutorChunkFallback />}>
                    <TutorPage />
                  </Suspense>
                </RequireOnboarded>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
