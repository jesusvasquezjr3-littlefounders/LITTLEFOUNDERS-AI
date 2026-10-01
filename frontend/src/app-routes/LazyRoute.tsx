import { Suspense, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ConnectedStandaloneHeader } from '@/app-shell/StandaloneHeader';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { useTheme } from '@/theme/useTheme';
import { LoadingState, RebuildRoot, SkipLink } from '@/rebuild/design/controls';
import './lazyRoute.css';

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
 * What a person sees while a lazy chunk (the lesson player, the staff console)
 * downloads: the rebuilt loading state, in the page's language and mode, from
 * the first frame. A bare design-system root, not `ShellRoot`: the shell root
 * moves focus on its first mount after a route change, and that mount must be
 * the page's own, not this placeholder's. (It replaced the legacy
 * LoadingOverlay with the legacy UI, S10L.1.)
 */
export function TutorChunkFallback() {
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const mainId = useId();
  const probe = useRef<HTMLDivElement>(null);
  const [standalone, setStandalone] = useState(false);
  useLayoutEffect(() => { setStandalone(!probe.current?.closest('[data-shell] main')); }, []);
  return <RebuildRoot theme={isDark ? 'dark' : 'light'} locale={locale}>
    <div ref={probe}>
      {standalone ? <>
        <SkipLink label={rebuildNamespaceCopy[locale].core.appShell.skip} target={mainId} />
        <ConnectedStandaloneHeader />
        <main id={mainId} tabIndex={-1} className="lf-route-loading">
          <LoadingState label={rebuildNamespaceCopy[locale].core.appShell.loading} lines={2} />
        </main>
      </> : <div className="lf-route-loading">
        <LoadingState label={rebuildNamespaceCopy[locale].core.appShell.loading} lines={2} />
      </div>}
    </div>
  </RebuildRoot>;
}

/** A development-only harness: its chunk never reaches a production bundle (the route is DEV-gated). */
export function DevRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
