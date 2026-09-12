import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@/components/ui';

/*
 * The boundary that keeps a broken route from becoming a white screen.
 *
 * Two reasons this exists, and both were live defects rather than theory:
 *
 *   1. A route that throws while rendering unmounts the whole React tree. The
 *      app had no boundary above any route, so the result was an empty #root —
 *      the exact failure mode that hid a wrong `to=` in the /learn chapter list
 *      for a week, reported as "the Lesson Engine is dead".
 *   2. Lazy routes add a SECOND way to get there, and it is routine rather than
 *      rare: after a deploy, a tab that is still running the previous build
 *      asks for a chunk whose content hash no longer exists. The import
 *      rejects, Suspense cannot recover, and the page goes blank — for a user
 *      who did nothing wrong except leave the app open.
 *
 * A stale chunk is fixed by reloading, so that case says so and offers it. Any
 * other error keeps the same shell but sends the learner somewhere real
 * instead of leaving them nowhere. Either way the screen SAYS something: a
 * blank page is the one outcome this component exists to prevent.
 */

interface Props {
  children: ReactNode;
  /** Where "take me somewhere that works" goes. Defaults to the app home. */
  home?: string;
}

interface State {
  error: Error | null;
}

/**
 * A failed dynamic import, as every engine words it differently.
 *
 * Chrome/Edge: "Failed to fetch dynamically imported module"
 * Firefox:     "error loading dynamically imported module"
 * Safari:      "Importing a module script failed"
 * Vite also throws its own "Unable to preload CSS" for the stylesheet half.
 */
function isStaleChunk(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
    `${error.name} ${error.message}`,
  );
}

function Fallback({ error, home }: { error: Error; home: string }) {
  const { t } = useTranslation();
  const stale = isStaleChunk(error);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-base px-5 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-content-muted">
        <Icon name="cloud_off" className="!text-[32px]" aria-hidden />
      </span>

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="lf-display-lg text-content">
          {t(stale ? 'routeError.staleTitle' : 'routeError.title')}
        </h1>
        <p className="lf-body-lg text-content-muted">
          {t(stale ? 'routeError.staleBody' : 'routeError.body')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {/*
         * A full reload, not a router navigation: the point of the stale-chunk
         * case is to fetch the new index and its new hashes, which client-side
         * routing would not do.
         */}
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('routeError.reload')}
        </Button>
        <Button variant="secondary" onClick={() => window.location.assign(home)}>
          <Icon name="arrow_back" className="mr-1" aria-hidden />
          {t('routeError.goHome')}
        </Button>
      </div>
    </main>
  );
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept to the console on purpose: this is the one place that knows a route
    // died, and a silent boundary trades a white screen for an invisible one.
    console.error('[app] route boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <Fallback error={this.state.error} home={this.props.home ?? '/learn'} />;
    return this.props.children;
  }
}

export default RouteErrorBoundary;
