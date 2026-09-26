import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { LearnPage } from '@/routes/app/LearnPage';
import { CoursePage } from '@/routes/app/learn/CoursePage';
import { TerritoryPage } from '@/routes/app/learn/TerritoryPage';
import { CoursePathRoute } from '@/routes/app/learn/CoursePathRoute';
import { DecisionJournalRoute } from '@/routes/app/learn/DecisionJournalRoute';
import { LearningRhythmRoute } from '@/routes/app/learn/LearningRhythmRoute';
import { PlacementPage } from '@/routes/app/learn/PlacementPage';
import {
  COURSE_PATH_ROUTE_PATH,
  COURSE_ROUTE_PATH,
  DECISION_JOURNAL_ROUTE_PATH,
  LEARNING_RHYTHM_ROUTE_PATH,
  LESSON_ROUTE_PATH,
  PLACEMENT_ROUTE_PATH,
  TERRITORY_ROUTE_PATH,
} from '@/routes/app/learn/paths';
import { LazyRoute } from './LazyRoute';

/*
 * Lane 2 (learn): learner home, courses, territory, the course path, the
 * decision journal, the learning rhythm, placement and the lesson player.
 */

/*
 * The lesson player is off the first-load path: every learner used to download
 * the Lesson Engine's 57 segment renderers before /learn could paint, and the
 * player is only reached after a learner picks a lesson. RouteErrorBoundary
 * (inside LazyRoute) catches a chunk that fails to arrive after a deploy.
 */
const LessonRoute = lazy(() => import('@/routes/app/learn/LessonRoute'));

/** Pages inside the signed-in app shell (App.tsx wraps them in RequireAuth + RequireOnboarded). */
export const learnShellRoutes = (
  <>
    <Route path="learn" element={<LearnPage />} />
    <Route path={COURSE_ROUTE_PATH} element={<CoursePage />} />
    <Route path={TERRITORY_ROUTE_PATH} element={<TerritoryPage />} />
    <Route path={COURSE_PATH_ROUTE_PATH} element={<CoursePathRoute />} />
    <Route path={DECISION_JOURNAL_ROUTE_PATH} element={<DecisionJournalRoute />} />
    <Route path={LEARNING_RHYTHM_ROUTE_PATH} element={<LearningRhythmRoute />} />
  </>
);

/** Full-screen layers with no app navigation around them. */
export const learnStandaloneRoutes = (
  <>
    {/* Mandatory per-course placement quiz (0043) — its own fullscreen
        layer like onboarding, but still funnels an unboarded guest to
        /onboarding first (RequireOnboarded) so the two one-time flows
        never interleave out of order. */}
    <Route path={PLACEMENT_ROUTE_PATH} element={<RequireAuth><RequireOnboarded><PlacementPage /></RequireOnboarded></RequireAuth>} />
    {/* Lesson Player — its own fullscreen layer, no app chrome. RequireAuth
        only, deliberately outside the app-shell route group. home="/learn":
        a learner stranded here should land on the shelf, not on the
        marketing site. */}
    <Route path={LESSON_ROUTE_PATH} element={<RequireAuth><LazyRoute home="/learn"><LessonRoute /></LazyRoute></RequireAuth>} />
  </>
);
