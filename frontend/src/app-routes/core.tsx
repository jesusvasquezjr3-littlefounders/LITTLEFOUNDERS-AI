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

/*
 * Dev-only harnesses, lazy AND declared inside the DEV branch. The `import()`
 * calls must sit behind `import.meta.env.DEV` themselves: a module-level
 * `lazy(() => import(...))` is kept by Rollup even when no route renders it,
 * so the production build used to emit the four lab chunks (about 140 kB,
 * with the lab's local grader) as dead files (S10L.2). Inside the branch the
 * production build folds `false ? … : null` away and no chunk is emitted.
 *
 * - lesson-lab / lesson-view: the Lesson Engine QA surface (LESSON_ENGINE.md
 *   §10), used by verify:lesson-engine.
 * - scene-lab / pose-lab: the Tutor 3D layer's authoring surfaces (measure a
 *   real .glb against tutor-scene/budget.ts; review the pose library by
 *   LOOKING at it). `three` must never reach an entry bundle by a stray import.
 */
const devLabs = import.meta.env.DEV ? {
  LessonLabPage: lazy(() => import('@/lesson-engine/lab/LessonLabPage')),
  LessonViewPage: lazy(() => import('@/lesson-engine/lab/LessonViewPage')),
  SceneLabPage: lazy(() => import('@/tutor-scene/lab/SceneLabPage')),
  PoseLabPage: lazy(() => import('@/tutor-scene/lab/PoseLabPage')),
} : null;

/* The legacy Tutor lab (/dev/tutor-lab) and learn lab (/dev/learn-lab) were
 * removed with the legacy UI (S10L.1, OD-2, 02 rule 23): the rebuilt screens
 * are reviewed in the design-system preview entry and the rebuild audits. */

/** DEV-only harnesses; an empty fragment in a production build. */
export const devRoutes = devLabs ? (
  <>
    <Route path="dev/lesson-lab" element={<DevRoute><devLabs.LessonLabPage /></DevRoute>} />
    <Route path="dev/lesson-view" element={<DevRoute><devLabs.LessonViewPage /></DevRoute>} />
    <Route path="dev/scene-lab" element={<DevRoute><devLabs.SceneLabPage /></DevRoute>} />
    <Route path="dev/pose-lab" element={<DevRoute><devLabs.PoseLabPage /></DevRoute>} />
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
