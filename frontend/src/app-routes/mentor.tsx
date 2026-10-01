import { ConnectedStandaloneHeader } from '@/app-shell/StandaloneHeader';
import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { useShellCopy, useShellLocale } from '@/app-shell/ShellRoot';
import { useTheme } from '@/theme/useTheme';
import { LoadingState, RebuildRoot, SkipLink } from '@/rebuild/design/controls';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';
import '@/rebuild/mentor/screen/mentorScreen.css';

/*
 * Lane 3 (mentor): the Mentor screen (Frontend Bible 08). The route path stays
 * `/tutor` (a path change is a later decision, with a redirect: lessons link a
 * guided review here); the label a learner sees is the character's name (OD-6).
 */

/* The Mentor's 3D stage. Lazy is MANDATORY, not an optimisation: `three` plus
 * the scene code is a large chunk, and a static import would put it in the
 * entry bundle of every route — including the marketing pages of users who
 * never open the Mentor. */
const TutorPage = lazy(() => import('@/routes/app/TutorPage'));

/*
 * While the screen's chunk downloads: the rebuilt loading state, in the
 * learner's language. A bare design-system root, not `ShellRoot`: the shell
 * root moves focus on the first mount after a route change, and that mount
 * must be the Mentor screen's, not this placeholder's (found by the real-route
 * focus check, W2M.2).
 */
function MentorChunkLoading() {
  const locale = useShellLocale();
  const shellCopy = useShellCopy().appShell;
  const { isDark } = useTheme();
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).mentorScreen;
  return <RebuildRoot theme={isDark ? 'dark' : 'light'} locale={locale}>
    <SkipLink label={shellCopy.skip} target="lf-mentor-loading-main" />
    <ConnectedStandaloneHeader />
    <main id="lf-mentor-loading-main" tabIndex={-1} className="lf-mentor-route-loading">
      <LoadingState label={copy.loading} lines={2} />
    </main>
  </RebuildRoot>;
}

/*
 * The second full-screen layer, and the list is closed at two (lesson and
 * Mentor; adding a third is an owner decision). It sits outside the app shell:
 * the Mentor screen has its own top bar with the way out (08 §2), and the app
 * navigation underneath would be a keyboard trap of links nobody can see. The
 * onboarding gate is kept, because an un-onboarded learner has no preferences
 * for the Mentor to be built from.
 */
export const mentorStandaloneRoutes = (
  <Route
    path="tutor"
    element={
      <RequireAuth>
        <RequireOnboarded>
          <Suspense fallback={<MentorChunkLoading />}>
            <TutorPage />
          </Suspense>
        </RequireOnboarded>
      </RequireAuth>
    }
  />
);
