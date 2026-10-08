import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { LearnHomeRoute } from '@/routes/app/learn/LearnHomeRoute';
import { CoursePathRedirect, CourseRoute } from '@/routes/app/learn/CourseRoute';
import { TerritoryRoute } from '@/routes/app/learn/TerritoryRoute';
import { DecisionJournalRoute } from '@/routes/app/learn/DecisionJournalRoute';
import { LearningRhythmRoute } from '@/routes/app/learn/LearningRhythmRoute';
import { TogetherRoute } from '@/app-routes/TogetherRoute';
import { PlacementRoute } from '@/routes/app/learn/PlacementRoute';
import {
  COURSE_PATH_ROUTE_PATH,
  COURSE_ROUTE_PATH,
  DECISION_JOURNAL_ROUTE_PATH,
  LEARNING_RHYTHM_ROUTE_PATH,
  LESSON_ROUTE_PATH,
  PLACEMENT_ROUTE_PATH,
  TERRITORY_ROUTE_PATH,
  TOGETHER_ROUTE_PATH,
} from '@/routes/app/learn/paths';
import { LazyRoute } from './LazyRoute';

/*
 * Learn routes: learner home, courses, territory, the course path, the
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
    {/* The rebuilt learner home and the one course screen (both course engines). */}
    <Route path="learn" element={<LearnHomeRoute />} />
    <Route path={COURSE_ROUTE_PATH} element={<CourseRoute />} />
    {/* The rebuilt course world. */}
    <Route path={TERRITORY_ROUTE_PATH} element={<TerritoryRoute />} />
    {/* The course path became the course screen; its old address redirects. */}
    <Route path={COURSE_PATH_ROUTE_PATH} element={<CoursePathRedirect />} />
    <Route path={DECISION_JOURNAL_ROUTE_PATH} element={<DecisionJournalRoute />} />
    <Route path={LEARNING_RHYTHM_ROUTE_PATH} element={<LearningRhythmRoute />} />
    {/* Goals together, the one peer mechanic for 13 to 17 year olds. */}
    <Route path={TOGETHER_ROUTE_PATH} element={<TogetherRoute />} />
  </>
);

/** Full-screen layers with no app navigation around them. */
export const learnStandaloneRoutes = (
  <>
    {/* The rebuilt placement flow, the per-course entry placement (0043). Its own full-screen
        layer like onboarding, but still funnels an unboarded guest to /onboarding first (RequireOnboarded)
        so the two one-time flows never interleave out of order. */}
    <Route path={PLACEMENT_ROUTE_PATH} element={<RequireAuth><RequireOnboarded><PlacementRoute /></RequireOnboarded></RequireAuth>} />
    {/* Lesson Player — its own fullscreen layer, no app chrome. RequireAuth
        only, deliberately outside the app-shell route group. home="/learn":
        a learner stranded here should land on the shelf, not on the
        marketing site. */}
    <Route path={LESSON_ROUTE_PATH} element={<RequireAuth><LazyRoute home="/learn"><LessonRoute /></LazyRoute></RequireAuth>} />
  </>
);
