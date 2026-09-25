import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AuthProvider } from '@/auth/AuthContext';
import { AnalyticsScripts } from '@/lib/analytics';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireGuest } from '@/auth/RequireGuest';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { RequireRole, RequireStaffPermission } from '@/auth/RequireRole';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { HowItWorks } from '@/routes/marketing/HowItWorks';
import { Families } from '@/routes/marketing/Families';
import { FAQ } from '@/routes/marketing/FAQ';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { BadgeLandingPage } from '@/routes/marketing/BadgeLandingPage';
import { KidSuspendedPage } from '@/routes/auth/KidSuspended';
import { AccountDeletionStatus } from '@/routes/auth/AccountDeletionStatus';
import { AuthLayout } from '@/routes/auth/AuthLayout';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { AuthCallbackPage } from '@/routes/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { UpgradeAccountPage } from '@/routes/auth/UpgradeAccountPage';
import { OnboardingPage } from '@/routes/onboarding/OnboardingPage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { AppLayout } from '@/routes/app/AppLayout';
import { LearnPage } from '@/routes/app/LearnPage';
import { CoursePage } from '@/routes/app/learn/CoursePage';
import { TerritoryPage } from '@/routes/app/learn/TerritoryPage';
import { PlacementPage } from '@/routes/app/learn/PlacementPage';
import { FamilyPage } from '@/routes/app/family/FamilyPage';
import { KidTerritoryPage } from '@/routes/app/family/KidTerritoryPage';
import { KidTutorPage } from '@/routes/app/family/KidTutorPage';
import {
  COURSE_ROUTE_PATH,
  LESSON_ROUTE_PATH,
  PLACEMENT_ROUTE_PATH,
  TERRITORY_ROUTE_PATH,
} from '@/routes/app/learn/paths';
import { TasksPage } from '@/routes/app/tasks/TasksPage';
import { BankingPage } from '@/routes/app/banking/BankingPage';
import { ProfilePage } from '@/routes/app/profile/ProfilePage';
import { AvatarEditorPage } from '@/routes/app/profile/AvatarEditorPage';
import { SettingsPage } from '@/routes/app/profile/SettingsPage';
import { FollowersPage } from '@/routes/app/profile/FollowersPage';
import { FollowingPage } from '@/routes/app/profile/FollowingPage';
import { PublicProfilePage } from '@/routes/app/profile/PublicProfilePage';
import { PublicFollowersPage } from '@/routes/app/profile/PublicFollowersPage';
import { PublicFollowingPage } from '@/routes/app/profile/PublicFollowingPage';
import { useInsightsBeacon } from '@/lib/useInsightsBeacon';
import { useMarketingBeacon } from '@/lib/useMarketingBeacon';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { LoadingOverlay } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { releaseBootVeil } from '@/lib/boot';

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';

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

/*
 * STAFF AND LESSON SURFACES, OFF THE FIRST-LOAD PATH.
 *
 * These were eager imports, so every learner downloaded the whole admin
 * console and the Lesson Engine's 57 segment renderers before /learn could
 * paint. Admin is reachable only behind RequireRole, and the lesson player
 * only after a learner picks a lesson — neither belongs in the bytes that
 * gate the first screen.
 *
 * Each is wrapped in RouteErrorBoundary at its route: a lazy chunk can fail
 * to arrive (most often right after a deploy, when an open tab asks for a
 * hash that no longer exists), and an unhandled rejection inside Suspense is
 * a blank page — the one outcome this app has already shipped once.
 */
const LessonRoute = lazy(() => import('@/routes/app/learn/LessonRoute'));
const AdminOverviewPage = lazy(() => import('@/routes/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminContentPage = lazy(() => import('@/routes/admin/AdminContentPage').then((m) => ({ default: m.AdminContentPage })));
const AdminEmailDashboard = lazy(() => import('@/routes/admin/AdminEmailDashboard').then((m) => ({ default: m.AdminEmailDashboard })));
const AdminInsightsPage = lazy(() => import('@/routes/admin/AdminInsightsPage').then((m) => ({ default: m.AdminInsightsPage })));
const AdminIntelPage = lazy(() => import('@/routes/admin/AdminIntelPage').then((m) => ({ default: m.AdminIntelPage })));
const AdminUsersPage = lazy(() => import('@/routes/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAuditPage = lazy(() => import('@/routes/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminReportsPage = lazy(() => import('@/routes/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminRolesPage = lazy(() => import('@/routes/admin/AdminRolesPage').then((m) => ({ default: m.AdminRolesPage })));
const AnalyticsHealthPage = lazy(() => import('@/routes/admin/AnalyticsHealthPage').then((m) => ({ default: m.AnalyticsHealthPage })));
const AdminGenerationPage = lazy(() => import('@/routes/admin/AdminGenerationPage').then((m) => ({ default: m.AdminGenerationPage })));

/** Both staff roles share the console; Roles & Access narrows to superadmin. */
const STAFF = ['admin', 'superadmin'];

/*
 * What a learner sees while the Tutor's chunk downloads. It used to be
 * `fallback={null}` — a BLANK SCREEN for the length of the `three` download,
 * which on a slow connection is seconds of apparently-broken product before
 * the stage's own veil could even mount. The overlay paints the app surface
 * and says loading, in the learner's language, from the first frame.
 */
/*
 * The wrapper every lazy route goes through.
 *
 * Suspense alone is not enough: it handles the WAIT, never the FAILURE. When a
 * dynamic import rejects — which happens routinely to a tab left open across a
 * deploy, whose chunk hashes no longer exist — the rejection escapes Suspense,
 * unmounts the tree and leaves an empty #root. RouteErrorBoundary catches that
 * and says so, with a refresh that actually fixes the stale-chunk case.
 */
function LazyRoute({ children, home }: { children: ReactNode; home?: string }) {
  return (
    <RouteErrorBoundary home={home}>
      <Suspense fallback={<TutorChunkFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

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
            <Route path="families" element={<Families />} />
            <Route path="faq" element={<FAQ />} />
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
          {/* A.1 suspended/removed kid account — public by design: Core has
              already revoked the sessions, so this page must render with no
              session at all. The AuthContext flags pick the wording. */}
          <Route path="account-suspended" element={<KidSuspendedPage />} />
          {/* E.6 account deletion state — public by design: after a confirmed
              request the session is gone (signed out everywhere, or erased),
              and a signed-in account with a scheduled deletion lands here to
              keep it or sign out (RequireAuth redirects). */}
          <Route path="account-deletion" element={<AccountDeletionStatus />} />
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
            path={PLACEMENT_ROUTE_PATH}
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
            <Route path={COURSE_ROUTE_PATH} element={<CoursePage />} />
            <Route path={TERRITORY_ROUTE_PATH} element={<TerritoryPage />} />
            <Route
              path="tasks"
              element={
                <RequireRole role={['parent', 'kid']}>
                  <TasksPage />
                </RequireRole>
              }
            />
            <Route
              path="banking"
              element={
                <RequireRole role={['parent', 'kid']}>
                  <BankingPage />
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

            {/* Staff routes use both role and named-permission guards. The
                server checks the same grants before platform reads or writes.
                Roles & Access remains Superadmin-only. Static paths precede
                the :handle catch-all. */}
            <Route path="admin" element={<RequireRole role={STAFF}><RequireStaffPermission permission={['manage_users', 'manage_content', 'view_analytics', 'manage_support']}><LazyRoute><AdminOverviewPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/content" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_content"><LazyRoute><AdminContentPage /></LazyRoute></RequireStaffPermission></RequireRole>} />

            <Route path="admin/users" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_users"><LazyRoute><AdminUsersPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/emails" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_support"><LazyRoute><AdminEmailDashboard /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/insights" element={<RequireRole role={STAFF}><RequireStaffPermission permission="view_analytics"><LazyRoute><AdminInsightsPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/intel" element={<RequireRole role={STAFF}><RequireStaffPermission permission="view_analytics"><LazyRoute><AdminIntelPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/analytics" element={<RequireRole role={STAFF}><RequireStaffPermission permission="view_analytics"><LazyRoute><AnalyticsHealthPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/generation" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_content"><LazyRoute><AdminGenerationPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/audit" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_support"><LazyRoute><AdminAuditPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/reports" element={<RequireRole role={STAFF}><RequireStaffPermission permission="manage_support"><LazyRoute><AdminReportsPage /></LazyRoute></RequireStaffPermission></RequireRole>} />
            <Route path="admin/roles" element={<RequireRole role="superadmin"><LazyRoute><AdminRolesPage /></LazyRoute></RequireRole>} />

            {/* /@username — public profiles (static routes above always win) */}
            <Route path=":handle/followers" element={<PublicFollowersPage />} />
            <Route path=":handle/following" element={<PublicFollowingPage />} />
            <Route path=":handle" element={<PublicProfilePage />} />
          </Route>

          {/* Shareable-achievement-badge landing page (0072/0073) — the ONE
              route in this app a stranger opens with no account and no
              session. No chrome, no auth: its own fullscreen layer like
              Lesson/Tutor below, but reachable by anyone. The <head> OG tags
              a crawler reads come from frontend/api/badge/[token].ts, which
              injects them into this same app-shell before the SPA boots. */}
          <Route path="badge/:token" element={<BadgeLandingPage />} />

          {/* Lesson Player — its own fullscreen layer, no app chrome (DESIGN.md
              Screen Recipes → Lesson). RequireAuth only, deliberately outside
              the AppLayout route group above. */}
          <Route
            path={LESSON_ROUTE_PATH}
            element={
              <RequireAuth>
                {/* home="/learn" — a learner stranded here should land on the
                    shelf, not on the marketing site. */}
                <LazyRoute home="/learn">
                  <LessonRoute />
                </LazyRoute>
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

          {/* The route of last resort. Without it an unmatched URL matched no
              branch and React Router rendered nothing at all — a white screen
              with no error and no way back, which is how a single wrong `to=`
              in the /learn chapter list stayed invisible for a week. It never
              redirects: the URL has to stay in the address bar for the next
              broken link to be reportable. Must be LAST. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
