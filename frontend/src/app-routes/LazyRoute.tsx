import { Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { LoadingOverlay } from '@/components/ui';

/*
 * The wrapper every lazy route goes through (Lane 0; shared by every route
 * module in this folder).
 *
 * Suspense alone is not enough: it handles the WAIT, never the FAILURE. When a
 * dynamic import rejects — which happens routinely to a tab left open across a
 * deploy, whose chunk hashes no longer exist — the rejection escapes Suspense,
 * unmounts the tree and leaves an empty #root. RouteErrorBoundary catches that
 * and says so, with a refresh that actually fixes the stale-chunk case.
 */
export function LazyRoute({ children, home }: { children: ReactNode; home?: string }) {
  return (
    <RouteErrorBoundary home={home}>
      <Suspense fallback={<TutorChunkFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

/*
 * What a learner sees while a lazy chunk (the Mentor's 3D stage above all)
 * downloads. It used to be `fallback={null}` — a BLANK SCREEN for the length
 * of the `three` download, which on a slow connection is seconds of
 * apparently-broken product before the stage's own veil could even mount. The
 * overlay paints the app surface and says loading, in the learner's language,
 * from the first frame.
 */
export function TutorChunkFallback() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-surface">
      <LoadingOverlay label={t('tutor.page.loading')} />
    </div>
  );
}

/** A development-only harness: its chunk never reaches a production bundle (the route is DEV-gated). */
export function DevRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
