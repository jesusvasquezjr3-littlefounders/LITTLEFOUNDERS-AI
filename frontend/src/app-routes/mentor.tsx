import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { TutorChunkFallback } from './LazyRoute';

/*
 * Lane 3 (mentor): the Mentor stage (Bible 08). The route path stays `/tutor`
 * until the Mentor lane renames it (a path change is its decision, with a
 * redirect); the label a learner sees is the character's name (OD-6).
 */

/* The Mentor's 3D stage. Lazy is MANDATORY, not an optimisation: `three` plus
 * the scene code is a large chunk, and a static import would put it in the
 * entry bundle of every route — including the marketing pages of users who
 * never open the Mentor. */
const TutorPage = lazy(() => import('@/routes/app/TutorPage'));

/*
 * The second full-screen layer, and the list is closed at two (lesson and
 * Mentor; adding a third is an owner decision). It sits outside the app shell
 * because the `fixed inset-0` stage cannot hide it on its own: the navigation
 * would still be in the DOM underneath, so a keyboard user would tab into
 * links they cannot see. The onboarding gate is kept, because an un-onboarded
 * learner has no nickname and no preferences for the island to be built from.
 */
export const mentorStandaloneRoutes = (
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
);
