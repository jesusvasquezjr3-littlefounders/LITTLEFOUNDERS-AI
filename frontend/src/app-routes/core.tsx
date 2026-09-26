import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { KidSuspendedPage } from '@/routes/auth/KidSuspended';
import { AccountDeletionStatus } from '@/routes/auth/AccountDeletionStatus';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { DevRoute } from './LazyRoute';

/*
 * Lane 0 (core): development-only harnesses, the standalone state routes and
 * the route of last resort. Owned by Lane 0; the wave-2 lanes each own one
 * sibling module (site, learn, mentor, family, profile, staff).
 */

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

/** DEV-only harnesses; an empty fragment in a production build. */
export const devRoutes = import.meta.env.DEV ? (
  <>
    <Route path="dev/lesson-lab" element={<DevRoute><LessonLabPage /></DevRoute>} />
    <Route path="dev/lesson-view" element={<DevRoute><LessonViewPage /></DevRoute>} />
    <Route path="dev/scene-lab" element={<DevRoute><SceneLabPage /></DevRoute>} />
    {/* The pose library, reviewed by LOOKING at it. DEV-only for the same
        reason scene-lab is: it is an authoring surface, not a product one. */}
    <Route path="dev/pose-lab" element={<DevRoute><PoseLabPage /></DevRoute>} />
    <Route path="dev/learn-lab/:courseSlug" element={<DevRoute><LearnLabPage /></DevRoute>} />
    <Route path="dev/audience-lab" element={<DevRoute><AudienceLab /></DevRoute>} />
    <Route path="dev/analytics-notices" element={<DevRoute><AnalyticsNoticesLab /></DevRoute>} />
    <Route path="dev/tutor-lab" element={<DevRoute><TutorLabPage /></DevRoute>} />
  </>
) : null;

/** Standalone state screens: public by design, no navigation around them. */
export const standaloneStateRoutes = (
  <>
    {/* A.1 suspended/removed kid account — public by design: Core has
        already revoked the sessions, so this page must render with no
        session at all. The AuthContext flags pick the wording. */}
    <Route path="account-suspended" element={<KidSuspendedPage />} />
    {/* E.6 account deletion state — public by design: after a confirmed
        request the session is gone (signed out everywhere, or erased),
        and a signed-in account with a scheduled deletion lands here to
        keep it or sign out (RequireAuth redirects). */}
    <Route path="account-deletion" element={<AccountDeletionStatus />} />
  </>
);

/*
 * The route of last resort. Without it an unmatched URL matched no branch and
 * React Router rendered nothing at all — a white screen with no error and no
 * way back, which is how a single wrong `to=` in the /learn chapter list stayed
 * invisible for a week. It never redirects: the URL has to stay in the address
 * bar for the next broken link to be reportable.
 */
export const notFoundRoute = <Route path="*" element={<NotFoundPage />} />;
