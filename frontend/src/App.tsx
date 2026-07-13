import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireRole } from '@/auth/RequireRole';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { AppLayout } from '@/routes/app/AppLayout';
import { LearnPage } from '@/routes/app/LearnPage';
import { CoursePage } from '@/routes/app/learn/CoursePage';
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
import { Suspense, lazy } from 'react';

/* Dev-only harness — the Lesson Engine QA surface (LESSON_ENGINE.md §10). Lazy +
 * DEV-gated so the lab (and its local grader) never reaches production bundles. */
const LessonLabPage = lazy(() => import('@/lesson-engine/lab/LessonLabPage'));

export function App() {
  return (
    <AuthProvider>
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

        {/* Marketing + auth (marketing chrome) */}
        <Route element={<MarketingLayout />}>
          <Route index element={<Landing />} />
          <Route path="how-it-works" element={<ComingSoon page="howItWorks" />} />
          <Route path="families" element={<ComingSoon page="families" />} />
          <Route path="faq" element={<ComingSoon page="faq" />} />
          <Route path="legal/terms" element={<LegalPage doc="terms" />} />
          <Route path="legal/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route
            path="verify-parent"
            element={
              <RequireAuth>
                <VerifyParentPage />
              </RequireAuth>
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
          <Route path="tutor" element={<SectionComingSoon section="tutor" icon="smart_toy" />} />
          <Route path="games" element={<SectionComingSoon section="games" icon="stadia_controller" />} />
          <Route
            path="tasks"
            element={
              <RequireRole role="parent">
                <SectionComingSoon section="tasks" icon="checklist" />
              </RequireRole>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/avatar" element={<AvatarEditorPage />} />
          <Route path="profile/settings" element={<SettingsPage />} />
          <Route path="profile/followers" element={<FollowersPage />} />
          <Route path="profile/following" element={<FollowingPage />} />
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
      </Routes>
    </AuthProvider>
  );
}
